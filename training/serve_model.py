#!/usr/bin/env python3
"""
Keep a checkpoint loaded and convert words on demand, one JSON line at a time.

`convert.py` loads the model, converts, and exits. That is right for a batch
run and wrong for the playground: loading 30 MB of weights takes seconds, and
doing it per keystroke would make the page unusable. This holds the model open
and answers over stdin/stdout instead.

Protocol, one JSON value per line in each direction:

    in   ["монгол", "хийж"]
    out  ["ᠮᠣᠨᠭᠤᠯ", "ᠬᠢᠵᠦ"]

Output is always the same length as input and in the same order. A word that
fails to convert comes back as an empty string rather than shifting every later
answer — the same discipline the harvest learned the hard way, where a dropped
line silently shifted a whole batch.

`READY` is printed to stderr once the weights are loaded, so a caller can wait
for it rather than guessing.

    python3 serve_model.py --model model/model.pt
"""

import argparse
import json
import sys
from pathlib import Path

import torch

from convert import convert, load
from train import pick_device


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", type=Path, default=Path("model/model.pt"))
    ap.add_argument("--device", default="auto")
    # Long inputs are batched so a paragraph does not become one enormous
    # forward pass; greedy decoding runs to the longest word in the batch.
    ap.add_argument("--batch-size", type=int, default=64)
    args = ap.parse_args()

    device = pick_device(args.device)
    model, src_vocab, tgt_vocab, max_len = load(args.model, device)

    print("READY", file=sys.stderr, flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            words = json.loads(line)
            if not isinstance(words, list):
                raise ValueError("expected a JSON array of words")
        except Exception as exc:  # noqa: BLE001 - report and keep serving
            print(json.dumps({"error": str(exc)}), flush=True)
            continue

        out = []
        try:
            with torch.no_grad():
                for i in range(0, len(words), args.batch_size):
                    chunk = [str(w) for w in words[i : i + args.batch_size]]
                    if chunk:
                        out.extend(convert(chunk, model, src_vocab, tgt_vocab, max_len, device))
        except Exception as exc:  # noqa: BLE001
            print(json.dumps({"error": str(exc)}), flush=True)
            continue

        # Never let the lengths drift apart: the caller pairs these back up by
        # position, so a short answer would mislabel every word after it.
        out = (out + [""] * len(words))[: len(words)]
        print(json.dumps(out), flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
