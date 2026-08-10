#!/usr/bin/env python3
"""
Character-level Cyrillic -> Mongol bichig transducer.

Target is Unicode code points, not romanization. See docs/neural-model.md for
why: romanization is neither canonical (q/k and gamma/g are harmony-selected
allographs, so most words have several valid spellings of one identical output)
nor total (seven galig letters and the space have no romanization at all).

This model exists to replace the *guesser*, not the pipeline. On held-out gold
the rule-based guesser scores 4.1% while the rest of the pipeline reaches 94.7%
given a correct stem, so the bar here is low and the slice is worth 26.8% of
running-text tokens.

Runs on Apple Silicon (MPS), CUDA, or plain CPU. Roughly 8M parameters --
minutes per run on an M4, not hours.
"""

import argparse
import json
import math
import os
import random
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

PAD, BOS, EOS, UNK = 0, 1, 2, 3
SPECIALS = ["<pad>", "<bos>", "<eos>", "<unk>"]


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def pick_device(requested: str) -> torch.device:
    if requested != "auto":
        return torch.device(requested)
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


# ---------------------------------------------------------------- data


def read_jsonl(path: Path):
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


class Vocab:
    def __init__(self, chars):
        self.itos = SPECIALS + sorted(chars)
        self.stoi = {c: i for i, c in enumerate(self.itos)}

    def __len__(self):
        return len(self.itos)

    def encode(self, text):
        return [self.stoi.get(c, UNK) for c in text]

    def decode(self, ids):
        out = []
        for i in ids:
            if i in (PAD, BOS):
                continue
            if i == EOS:
                break
            out.append(self.itos[i] if i < len(self.itos) else "�")
        return "".join(out)


class PairDataset(Dataset):
    def __init__(self, rows, src_vocab, tgt_vocab, max_len):
        self.rows = rows
        self.src_vocab = src_vocab
        self.tgt_vocab = tgt_vocab
        self.max_len = max_len

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        row = self.rows[i]
        src = self.src_vocab.encode(row["src"])[: self.max_len]
        tgt = self.tgt_vocab.encode(row["tgt"])[: self.max_len - 2]
        return torch.tensor(src), torch.tensor([BOS] + tgt + [EOS])


def collate(batch):
    srcs, tgts = zip(*batch)
    return (
        nn.utils.rnn.pad_sequence(srcs, batch_first=True, padding_value=PAD),
        nn.utils.rnn.pad_sequence(tgts, batch_first=True, padding_value=PAD),
    )


# ---------------------------------------------------------------- model


class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=512):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        return x + self.pe[:, : x.size(1)]


class Transducer(nn.Module):
    def __init__(self, n_src, n_tgt, d_model=256, nhead=4, layers=4, ff=1024, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        self.src_emb = nn.Embedding(n_src, d_model, padding_idx=PAD)
        self.tgt_emb = nn.Embedding(n_tgt, d_model, padding_idx=PAD)
        self.pos = PositionalEncoding(d_model)
        self.transformer = nn.Transformer(
            d_model=d_model,
            nhead=nhead,
            num_encoder_layers=layers,
            num_decoder_layers=layers,
            dim_feedforward=ff,
            dropout=dropout,
            batch_first=True,
            norm_first=True,
        )
        self.out = nn.Linear(d_model, n_tgt)

    def encode(self, src):
        pad = src == PAD
        mem = self.transformer.encoder(
            self.pos(self.src_emb(src) * math.sqrt(self.d_model)),
            src_key_padding_mask=pad,
        )
        return mem, pad

    def decode(self, tgt_in, mem, mem_pad):
        # Bool masks throughout: -inf float masks can produce NaN on MPS.
        causal = torch.triu(
            torch.ones(tgt_in.size(1), tgt_in.size(1), dtype=torch.bool, device=tgt_in.device),
            diagonal=1,
        )
        hidden = self.transformer.decoder(
            self.pos(self.tgt_emb(tgt_in) * math.sqrt(self.d_model)),
            mem,
            tgt_mask=causal,
            tgt_key_padding_mask=(tgt_in == PAD),
            memory_key_padding_mask=mem_pad,
        )
        return self.out(hidden)

    def forward(self, src, tgt_in):
        mem, mem_pad = self.encode(src)
        return self.decode(tgt_in, mem, mem_pad)


# ---------------------------------------------------------------- decode / eval


@torch.no_grad()
def greedy(model, src, max_len, device):
    model.eval()
    mem, mem_pad = model.encode(src)
    ys = torch.full((src.size(0), 1), BOS, dtype=torch.long, device=device)
    done = torch.zeros(src.size(0), dtype=torch.bool, device=device)
    for _ in range(max_len - 1):
        logits = model.decode(ys, mem, mem_pad)
        nxt = logits[:, -1].argmax(-1)
        nxt = torch.where(done, torch.full_like(nxt, PAD), nxt)
        ys = torch.cat([ys, nxt.unsqueeze(1)], dim=1)
        done |= nxt == EOS
        if bool(done.all()):
            break
    return ys


@torch.no_grad()
def exact_match(model, loader, tgt_vocab, max_len, device, limit=None):
    """Whole-word exact match -- the only metric that means anything here.

    A word with one wrong letter is a wrong word, so per-character accuracy
    would flatter the model badly.

    `limit` caps how many examples are scored. Greedy decoding is autoregressive
    and MPS pays a launch cost per step, so scoring the full val set every epoch
    costs more than the training epoch itself. Per-epoch monitoring uses a fixed
    prefix of val; the final numbers are always computed over everything.
    """
    hits = total = 0
    for src, tgt in loader:
        if limit is not None and total >= limit:
            break
        src, tgt = src.to(device), tgt.to(device)
        pred = greedy(model, src, max_len, device)
        for p, t in zip(pred, tgt):
            if tgt_vocab.decode(p.tolist()) == tgt_vocab.decode(t.tolist()):
                hits += 1
            total += 1
    return hits / max(total, 1)


# ---------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("data"))
    ap.add_argument("--out", type=Path, default=Path("model"))
    ap.add_argument("--epochs", type=int, default=120)
    ap.add_argument("--batch-size", type=int, default=256)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--d-model", type=int, default=256)
    ap.add_argument("--layers", type=int, default=4)
    ap.add_argument("--nhead", type=int, default=4)
    # ff and dropout were hardcoded in Transducer until 2026-07-31. They are CLI
    # args now *and* recorded in the checkpoint config, which is the load-bearing
    # half: convert.py rebuilds the module from that config before loading the
    # state dict, so a run with a non-default ff that was not written down would
    # produce a checkpoint nothing could load back.
    ap.add_argument("--ff", type=int, default=1024)
    ap.add_argument("--dropout", type=float, default=0.1)
    ap.add_argument("--max-len", type=int, default=64)
    ap.add_argument("--patience", type=int, default=12)
    ap.add_argument(
        "--val-subset",
        type=int,
        default=512,
        help="val examples scored per epoch (full val is scored at the end)",
    )
    ap.add_argument("--seed", type=int, default=20260727)
    ap.add_argument("--device", default="auto")
    ap.add_argument(
        "--threads",
        type=int,
        default=4,
        help="CPU threads. Capped by default so a training run leaves the machine usable.",
    )
    args = ap.parse_args()

    torch.set_num_threads(max(1, args.threads))
    set_seed(args.seed)
    device = pick_device(args.device)
    args.out.mkdir(parents=True, exist_ok=True)

    train_rows = read_jsonl(args.data / "train.jsonl")
    val_rows = read_jsonl(args.data / "val.jsonl")
    test_rows = read_jsonl(args.data / "test.jsonl")

    # Vocab from TRAIN ONLY. Building it over val/test would leak which
    # characters occur there -- small, but free to avoid.
    src_vocab = Vocab({c for r in train_rows for c in r["src"]})
    tgt_vocab = Vocab({c for r in train_rows for c in r["tgt"]})

    print(f"device      {device}")
    print(f"train/val/test  {len(train_rows)}/{len(val_rows)}/{len(test_rows)}")
    print(f"vocab       {len(src_vocab)} source, {len(tgt_vocab)} target")

    mk = lambda rows: PairDataset(rows, src_vocab, tgt_vocab, args.max_len)
    train_loader = DataLoader(
        mk(train_rows), batch_size=args.batch_size, shuffle=True, collate_fn=collate
    )
    val_loader = DataLoader(mk(val_rows), batch_size=args.batch_size, collate_fn=collate)
    test_loader = DataLoader(mk(test_rows), batch_size=args.batch_size, collate_fn=collate)

    model = Transducer(
        len(src_vocab),
        len(tgt_vocab),
        d_model=args.d_model,
        nhead=args.nhead,
        layers=args.layers,
        ff=args.ff,
        dropout=args.dropout,
    ).to(device)
    params = sum(p.numel() for p in model.parameters())
    print(f"parameters  {params/1e6:.1f}M\n")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    steps = max(1, args.epochs * len(train_loader))
    warmup = min(1000, steps // 20)

    def lr_at(step):
        if step < warmup:
            return step / max(1, warmup)
        pct = (step - warmup) / max(1, steps - warmup)
        return 0.5 * (1 + math.cos(math.pi * min(1.0, pct)))

    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_at)
    # label_smoothing regularises a small model on a small, partly noisy corpus.
    loss_fn = nn.CrossEntropyLoss(ignore_index=PAD, label_smoothing=0.1)

    # -1.0, not 0.0: a model scoring exactly 0% early on must still write a
    # checkpoint, or a run that never improves finishes with no model.pt at all
    # and crashes at the final load. Found by smoke-testing a 2-epoch run.
    best, best_epoch, started = -1.0, -1, time.time()
    history = []

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        for src, tgt in train_loader:
            src, tgt = src.to(device), tgt.to(device)
            logits = model(src, tgt[:, :-1])
            loss = loss_fn(logits.reshape(-1, logits.size(-1)), tgt[:, 1:].reshape(-1))
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            running += loss.item()

        avg = running / max(1, len(train_loader))
        acc = exact_match(
            model, val_loader, tgt_vocab, args.max_len, device, limit=args.val_subset
        )
        history.append({"epoch": epoch, "loss": round(avg, 4), "val_exact": round(acc, 4)})
        mark = ""

        if acc > best:
            best, best_epoch, mark = acc, epoch, "  <- best"
            torch.save(
                {
                    "model": model.state_dict(),
                    "src_itos": src_vocab.itos,
                    "tgt_itos": tgt_vocab.itos,
                    "config": {
                        "d_model": args.d_model,
                        "nhead": args.nhead,
                        "layers": args.layers,
                        "ff": args.ff,
                        "max_len": args.max_len,
                    },
                },
                args.out / "model.pt",
            )

        mins = (time.time() - started) / 60
        print(
            f"epoch {epoch:3d}/{args.epochs}  loss {avg:.4f}  "
            f"val_exact {acc*100:5.2f}%  [{mins:.1f}m]{mark}",
            flush=True,
        )

        if epoch - best_epoch >= args.patience:
            print(f"\nno val improvement in {args.patience} epochs -- stopping early")
            break

    # Final score on gold, from the best checkpoint. This set has never been
    # trained on and never selected on -- it is scored exactly once, here.
    ckpt = torch.load(args.out / "model.pt", map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model"])
    print("\nscoring full val and gold sets...")
    val_acc = exact_match(model, val_loader, tgt_vocab, args.max_len, device)
    test_acc = exact_match(model, test_loader, tgt_vocab, args.max_len, device)

    elapsed = (time.time() - started) / 60
    report = {
        "params": params,
        "device": str(device),
        "epochs_run": len(history),
        "best_epoch": best_epoch,
        "val_exact_subset": round(best, 4),
        "val_exact": round(val_acc, 4),
        "test_exact_gold": round(test_acc, 4),
        "minutes": round(elapsed, 1),
        "baseline_guesser_gold": 0.041,
        "history": history,
    }
    (args.out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("\n" + "=" * 58)
    print(f"  val exact-match      {val_acc*100:.2f}%")
    print(f"  GOLD exact-match     {test_acc*100:.2f}%   <- the number that counts")
    print(f"  rule-based guesser    4.10%   (what this replaces)")
    print(f"  trained in {elapsed:.1f} min on {device}")
    print("=" * 58)
    print(f"\nwrote {args.out/'model.pt'} and {args.out/'report.json'}")


if __name__ == "__main__":
    main()
