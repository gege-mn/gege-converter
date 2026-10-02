# Training bundle — Cyrillic → Mongol bichig

Self-contained. Copy the folder to any Mac, run one command, come back to a
trained model. No repo checkout, no GitHub access, no GPU.

```sh
./run.sh
```

That is the whole thing. It finds a usable Python, makes a venv, installs
PyTorch, trains, and prints the score. Re-running reuses the venv, so only the
first run pays the download.

Collect two files when it finishes:

```
model/model.pt       the trained weights
model/report.json    scores, timing, per-epoch history
```

## Prerequisites

| | |
|---|---|
| **Python 3.10–3.13** | 3.14 is too new — PyTorch has no wheels for it yet. `run.sh` looks for a good one and tells you what to install if it can't find one. |
| **Internet, once** | ~2 GB PyTorch download on the first run only. |
| **Apple Silicon** | Not required, but uses the GPU via MPS when present. Intel Macs fall back to CPU and take longer. |
| **Disk** | ~3 GB, almost all of it PyTorch. |

No GPU needed. The model is ~7.4M parameters.

## Useful flags

```sh
./run.sh --epochs 80              # train longer
./run.sh --threads 2              # leave more of the machine free
./run.sh --device cpu             # skip MPS
./run.sh --batch-size 128         # if memory is tight
```

To survive a closed terminal or a dropped SSH session:

```sh
nohup ./run.sh > run.log 2>&1 &
tail -f train.log
```

⚠ **Launch Python unbuffered, or a live run looks like a dead one.** Python
buffers stdout when it is not attached to a terminal, so under `nohup` the log
can sit unchanged for many minutes while training is perfectly healthy. Use
`python -u` (or export `PYTHONUNBUFFERED=1`) for `train.py`.

This is worth the line because the wrong diagnosis is *available and looks
confirmed*: the abandoned v4b run's log stops at exactly the same torch warning
a healthy run stops at while it is still working. There is no way to tell the
two apart from the log alone, and "the run died" is the tempting reading.

## Testing a trained model

```sh
source .venv/bin/activate
python convert.py --model model/model.pt монгол сайн байна
python convert.py --model model/model.pt --codepoints монгол
```

Use `--codepoints` for anything you actually intend to judge. **Terminal output
cannot be used to review bichig** — fonts and shaping lie about it. Real review
goes through `scripts/build-spotcheck.mjs` in the main repo, which is the only
working review channel.

## Scoring a checkpoint properly

`report.json`'s `test_exact_gold` is one number on one set. A run is not
evaluated until all three of these have been produced, because they disagree
with each other and the disagreements are the informative part.

Generate predictions on the training box, score them in the main repo:

```sh
# on the training box, for each of the three word lists
cd ~/gege-train
tr '\n' ' ' < gold-words.txt     | ./.venv/bin/python convert.py --model model/model.pt > gold-preds.tsv
tr '\n' ' ' < rulings-words.txt  | ./.venv/bin/python convert.py --model model/model.pt > rulings-preds.tsv
tr '\n' ' ' < consensus-words.txt| ./.venv/bin/python convert.py --model model/model.pt > consensus-preds.tsv
```

```sh
# in the main repo
node scripts/eval-model.mjs   --preds .tmp/gold-preds.tsv        # per tier + hybrid
node scripts/eval-rulings.mjs --preds .tmp/rulings-preds.tsv     # the reader's verdicts
node scripts/benchmark.mjs    --model .tmp/consensus-preds.tsv   # WER/CER, two-silver
```

The word lists come from the repo, and **must be regenerated whenever the
fixtures change** — gold grew 1,768 → 1,884 on 2026-07-31, which silently makes
any cross-run comparison against an older list wrong. `benchmark.mjs
--dump-words` writes the consensus list; the other two are derived from
`.tmp/training/test.jsonl` and `test/rulings.test.ts`.

**Score the previous model on the new lists too.** Comparing a new run's number
against a number computed on a different set is the easiest way to invent an
improvement that did not happen.

Why three:

| set | what it can see | what it cannot |
|---|---|---|
| gold, 1,884 | per-tier and hybrid behaviour, aggregate | it is silver-derived, like the model's training targets |
| `rulings.test.ts`, 90 | the only human verdicts in the repo; outranks everything | tiny, and mostly answered from the lexicon |
| benchmark, 604 | WER/CER against two independent converters | only types both converters agree on — conventional words |

`docs/data-and-accuracy.md` records a case where the first two rank the model and
the pipeline in opposite directions. Quote which set a number came from, always.

Use `--beam 5` for the best decode and `--nbest 3` for ranked alternatives with
scores. Keep decoding consistent between the runs being compared: on v3, beam 5
was worth 0.5pp on the model alone and **nothing** on the slice the hybrid uses.

## What this trains

Character-level encoder-decoder transformer, Cyrillic characters in, **Unicode
Mongolian code points out**. Not romanization — romanization is neither
canonical (`q`/`k` and `γ`/`g` are harmony-selected allographs, so most words
have several valid spellings of one identical output) nor total (seven galig
letters and the space have no romanization at all). Both problems vanish when
the target is the script itself. Full reasoning in `docs/neural-model.md`.

The model exists to replace the **guesser**, not the pipeline. On held-out gold
the rule-based guesser scores 4.1%, while the rest of the pipeline reaches 94.7%
given a correct stem. That is the bar, and that slice is 26.8% of running-text
tokens.

## Data

Generated by `scripts/export-training-data.mjs` in the main repo.

| | pairs |
|---|---|
| train | 29,630 |
| val | 1,559 |
| test (gold) | 1,884 |

These move as the fixtures and the harvest do — the figures above are
2026-07-31, and the export prints the current ones every run. Do not compare a
score across two different splits.

**The split matters more than anything else here.** Every gold key also appears
in the raw harvest, so training on it unfiltered leaks the whole test set and
produces a score that looks excellent and means nothing. The export removes
held-out words by Cyrillic surface form — gold plus the `rulings.test.ts`
words — and asserts no leak before writing. The seed is fixed, so re-running
reproduces identical files.

Do not regenerate the split with a different seed and compare scores across it.

## Reading the result

`report.json` has `test_exact_gold` — whole-word exact match on the gold set,
which is scored exactly once, at the end, from the best checkpoint. Compare it
to `baseline_guesser_gold` (0.041) in the same file.

Whole-word exact match is the only honest metric: a word with one wrong letter
is a wrong word, so per-character accuracy would flatter the model badly.

Expect gold to score below val. Gold is inflected forms, which are harder, and
val is a random slice of the same distribution as train.
