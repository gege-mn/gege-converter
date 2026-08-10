#!/usr/bin/env python3
"""
Run a trained checkpoint. This is the "did it actually work" script -- copy
model.pt back to any Mac and convert words with it.

  python3 convert.py --model model/model.pt монгол сайн байна
  echo "монголын нийслэл" | python3 convert.py --model model/model.pt

Output is Unicode Mongol bichig. Terminal output cannot be used to judge
bichig -- fonts and shaping lie -- so `--codepoints` prints U+XXXX instead,
and anything you actually want to review goes through
scripts/build-spotcheck.mjs in the main repo.
"""

import argparse
import sys
from pathlib import Path

import torch

from train import BOS, EOS, PAD, Transducer, Vocab, pick_device


def load(model_path: Path, device):
    ckpt = torch.load(model_path, map_location=device, weights_only=False)
    src_vocab, tgt_vocab = Vocab([]), Vocab([])
    src_vocab.itos = ckpt["src_itos"]
    src_vocab.stoi = {c: i for i, c in enumerate(src_vocab.itos)}
    tgt_vocab.itos = ckpt["tgt_itos"]
    tgt_vocab.stoi = {c: i for i, c in enumerate(tgt_vocab.itos)}
    cfg = ckpt["config"]
    model = Transducer(
        len(src_vocab),
        len(tgt_vocab),
        d_model=cfg["d_model"],
        nhead=cfg["nhead"],
        layers=cfg["layers"],
        # `ff` was hardcoded before 2026-07-31, so v1-v3 checkpoints have no such
        # key. Defaulting to the old constant keeps them loadable; dropout is
        # inference-irrelevant because model.eval() disables it.
        ff=cfg.get("ff", 1024),
    ).to(device)
    model.load_state_dict(ckpt["model"])
    model.eval()
    return model, src_vocab, tgt_vocab, cfg["max_len"]


@torch.no_grad()
def beam_search(words, model, src_vocab, tgt_vocab, max_len, device, beam=5, alpha=0.6, nbest=1):
    """Beam search with length-normalised scores.

    Greedy decoding commits to the highest-probability character at every step,
    which on this task is exactly the wrong bet: the choice that decides a word
    is often the *first* vowel, and its evidence arrives several characters
    later. A beam keeps the alternatives alive until that evidence lands.

    Returns, per input word, a list of `nbest` (text, score) pairs already sorted
    best-first, so the caller can feed `Candidate[]` rather than one answer.

    Scores are log-probabilities divided by length**alpha. Without that division
    beam search systematically prefers short strings, because every extra
    character adds a negative term -- and short-by-one is this model's most
    common error shape to begin with.
    """
    batch = [torch.tensor(src_vocab.encode(w.lower())[:max_len]) for w in words]
    src = torch.nn.utils.rnn.pad_sequence(batch, batch_first=True, padding_value=PAD).to(device)
    n, k, vocab = src.size(0), beam, len(tgt_vocab)

    mem, mem_pad = model.encode(src)
    mem = mem.repeat_interleave(k, dim=0)
    mem_pad = mem_pad.repeat_interleave(k, dim=0)

    ys = torch.full((n * k, 1), BOS, dtype=torch.long, device=device)
    # Only beam 0 is live at the first step; without -inf on the rest, all k
    # beams would expand the identical BOS state and return k copies of greedy.
    scores = torch.full((n, k), float("-inf"), device=device)
    scores[:, 0] = 0.0
    finished = torch.zeros(n * k, dtype=torch.bool, device=device)

    for _ in range(max_len - 1):
        logp = torch.log_softmax(model.decode(ys, mem, mem_pad)[:, -1].float(), dim=-1)
        # A finished beam may only extend with PAD, at zero cost, so it keeps its
        # score and competes on equal terms instead of decaying every step.
        hold = torch.full_like(logp, float("-inf"))
        hold[:, PAD] = 0.0
        logp = torch.where(finished.unsqueeze(1), hold, logp)

        total = (scores.view(-1, 1) + logp).view(n, k * vocab)
        scores, idx = total.topk(k, dim=-1)
        origin = (torch.arange(n, device=device).unsqueeze(1) * k + idx // vocab).view(-1)
        token = (idx % vocab).view(-1, 1)

        ys = torch.cat([ys[origin], token], dim=1)
        finished = finished[origin] | (token.view(-1) == EOS)
        if bool(finished.all()):
            break

    out = []
    for i in range(n):
        cand = []
        for j in range(k):
            text = tgt_vocab.decode(ys[i * k + j].tolist())
            raw = scores[i, j].item()
            if raw == float("-inf"):
                continue
            cand.append((text, raw / max(len(text), 1) ** alpha))
        cand.sort(key=lambda c: -c[1])
        out.append(cand[:nbest] or [("", float("-inf"))])
    return out


@torch.no_grad()
def convert(words, model, src_vocab, tgt_vocab, max_len, device):
    batch = [torch.tensor(src_vocab.encode(w.lower())[:max_len]) for w in words]
    src = torch.nn.utils.rnn.pad_sequence(batch, batch_first=True, padding_value=PAD).to(device)
    mem, mem_pad = model.encode(src)
    ys = torch.full((src.size(0), 1), BOS, dtype=torch.long, device=device)
    done = torch.zeros(src.size(0), dtype=torch.bool, device=device)
    for _ in range(max_len - 1):
        nxt = model.decode(ys, mem, mem_pad)[:, -1].argmax(-1)
        nxt = torch.where(done, torch.full_like(nxt, PAD), nxt)
        ys = torch.cat([ys, nxt.unsqueeze(1)], dim=1)
        done |= nxt == EOS
        if bool(done.all()):
            break
    return [tgt_vocab.decode(row.tolist()) for row in ys]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("words", nargs="*")
    ap.add_argument("--model", type=Path, default=Path("model/model.pt"))
    ap.add_argument("--device", default="auto")
    ap.add_argument("--codepoints", action="store_true", help="print U+XXXX, not glyphs")
    ap.add_argument("--beam", type=int, default=1, help="beam width; 1 keeps greedy decoding")
    ap.add_argument("--alpha", type=float, default=0.6, help="beam length-normalisation exponent")
    ap.add_argument("--nbest", type=int, default=1, help="alternatives per word, tab-separated")
    ap.add_argument("--batch", type=int, default=256)
    args = ap.parse_args()

    words = args.words or [w for line in sys.stdin for w in line.split()]
    if not words:
        print("no input", file=sys.stderr)
        return 1

    device = pick_device(args.device)
    model, src_vocab, tgt_vocab, max_len = load(args.model, device)
    show = lambda s: " ".join(f"U+{ord(c):04X}" for c in s) if args.codepoints else s

    # Batched: a beam of k multiplies the decoder's working set by k, and the
    # whole-input-as-one-batch form below was already the largest allocation here.
    for start in range(0, len(words), args.batch):
        chunk = words[start : start + args.batch]
        if args.beam > 1:
            for word, cands in zip(
                chunk,
                beam_search(
                    chunk, model, src_vocab, tgt_vocab, max_len, device,
                    beam=args.beam, alpha=args.alpha, nbest=args.nbest,
                ),
            ):
                cols = [f"{show(t)}\t{s:.4f}" for t, s in cands] if args.nbest > 1 else [show(cands[0][0])]
                print(f"{word}\t" + "\t".join(cols), flush=True)
        else:
            for word, out in zip(chunk, convert(chunk, model, src_vocab, tgt_vocab, max_len, device)):
                print(f"{word}\t{show(out)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
