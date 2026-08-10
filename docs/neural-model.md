# A small neural model, in parallel with the algorithm

<!-- Background doc. Not loaded into context automatically. -->

Read this when deciding whether to start the model, or before the first
training run. It does **not** re-litigate algorithm-vs-model — that decision
is in `architecture-rationale.md` and stands. This is about the one slice the
algorithm cannot reach, and how a model would take it.

**Verdict: yes, it is practical, and the measured numbers argue for it more
strongly than intuition does. But it replaces the guesser, not the pipeline.**

## 1. The case

### This is grapheme-to-phoneme, not translation

Cyrillic → Classical is a monotonic character-level transduction over a closed
alphabet: same-order output, ~35 output symbols, heavy regularity, a long tail
of lexical exceptions. That is structurally the same task as grapheme-to-phoneme
conversion, where small encoder-decoders trained on 20–50k word lexicons are the
standard, well-benchmarked solution. It is nothing like machine translation, and
it does not need a large model.

The two things that cost this project the most effort are exactly the things
this model class learns for free from data:

- **Vowel harmony and the γ/g, q/k allographs** — no feature engineering, and
  no risk of the romanization-comparison trap in CLAUDE.md, because the model
  never string-compares romanizations.
- **o/ö restricted to the first syllable** — a positional rule, which is what
  attention over a short string is good at.

### The measured argument

From `data-and-accuracy.md`, held-out gold, 1,203 forms:

| Tier | top-1 | share of tokens |
|---|---|---|
| `lexicon` | 79.3% | — |
| `harvested` | 84.2% | 73.2% (with lexicon) |
| `guess` | **4.1%** | **26.8%** |

Oracle, given a perfect stem: **94.7%**.

Read those two numbers together. The segmenter, suffix table and generator are
*already solved* — hand them a stem and they are right 95% of the time. The
guesser is right **4.1%** of the time and handles a quarter of all running-text
tokens. There is no tuning left to do; there is one hole.

**What the model would be beating is 4.1%.** That is the lowest bar this
project will ever offer. Even a mediocre model changes the picture:

| model on the guessed slice | top-1 overall | 9-word sentence |
|---|---|---|
| 4.1% (today's guesser) | 65.7% | 2.3% |
| 60% | ~78% | ~11% |
| 80% | ~83% | ~19% |

Sentence accuracy is per-word accuracy to the ninth power, which is why a slice
worth 26.8% of tokens dominates the number anyone actually cares about.

### The part data cannot fix

**48.5% of the guesser's output is verb-shaped, and verbs are 24.8% of all
tokens.** Verb morphology is excluded from the suffix table *by design*, so
this is a categorical hole, not a missing dictionary row. Harvesting more nouns
closes at most half the remaining gap — that is measured, not estimated.

Verb morphology is productive: you cannot enumerate it, and the harvest only
memorised the frequent forms as whole rows, which collapses on the tail. This
is the strongest single argument for the model. A sequence model learns
productive morphology from paradigms; a hand-written table cannot be extended
to cover an open class.

## 1b. It has been run (2026-07-27)

First training run, so this section is measurement rather than argument.
7.4M-parameter character transformer, 50 epochs, **31.7 minutes on an M4** —
no GPU, no cloud. Scored on the 1,474-form gold set, verified to share zero
keys with train or val.

| tier | n | pipeline | model |
|---|---|---|---|
| `harvested` | 1,078 | **61.9%** | 58.5% |
| `lexicon` | 187 | **64.2%** | 47.6% |
| **`guess`** | **209** | **0.0%** | **42.1%** |
| all | 1,474 | 53.4% | 54.8% |
| **hybrid** — pipeline for real-data stems, model where it would guess | | | **59.4%** |

**The `guess` row is the finding.** On the 209 forms where the pipeline falls
back to guessing it gets *none* of them right, and the model gets 42.1%. The
pipeline still wins on both real-data tiers, which is exactly why the model
goes below the dictionaries rather than in front of them — and the hybrid,
53.4% → 59.4%, beats either alone.

(The pipeline's 53.4% here is not comparable to the 65.7% quoted above: that
figure was measured on a 1,203-form subset. Compare within one gold set only,
as the warning in `data-and-accuracy.md` says.)

### The data bug this exposed, which is the real lesson

The first run scored 49.6% and failed **all three** of the bichig reader's
rulings — монгол as ᠮᠣᠩᠭᠣᠯ, сайн as `sayin`, найм without its FVS1. Those are
precisely Tungaamal's three documented errors.

The model was faithful; the export was wrong. `.tmp/harvest-harvest.jsonl`'s
`unicode` field is gege-linter's **encoding** repair only — the orthographic
layer is a separate pass, `normalizeOrthography`, which the package applies
before harvested rows enter the lexicon and which the export had skipped. 7/7
монгол rows and 35/35 сай rows carried the old convention.

Applying it moved gold **49.6% → 54.8%** and fixed монгол and сайн. найм still
fails, correctly: the ruling *adds* YA+FVS1 where Tungaamal writes a bare I, so
no mechanical rule can derive it. It is lexical, which is what the `lexicon`
tier is for.

**Score every future run against `rulings.test.ts` separately.** Aggregate
accuracy could not have caught this — the model looked like it was working.

### First reader verdict on running prose (2026-07-27)

A bichig reader read a 43-word passage converted by the hybrid and put it at
**">90% correct, at least for this exact text"**. Informal and a single sample,
so it is not a metric — but it is the first end-to-end read by someone who can
judge the output, and it outranks the gold number as a description of what a
user experiences.

It is not in tension with the 59.4% above. Gold is *entirely* inflected forms,
held out precisely because they are the cases the pipeline could not derive.
Running prose is mostly common words the dictionaries already cover: of the 43
words, 37 came from dictionaries and only 6 needed the model. **Quote the gold
number for progress on the hard part; quote a reader for what the tool feels
like.** Never swap them.

Of the 6 model-supplied words, `байхгүй` → ᠪᠠᠢᠬᠤ ᠦᠭᠡᠢ is the one to notice: a
two-word output with a real space, which romanization cannot express at all.
The weakest were all verb forms (`тээж`, `хийж`, `бэлгэшээсэн`), consistent
with verbs being the categorical hole.

## 1c. Second run, and the metric that was hiding the result (2026-07-27)

Same architecture, same seed, same 50 epochs, 40.9 min on the office M4 Pro.
The only change was data: +1,966 sentence-aligned pairs (train 28,341 →
30,197). Reproduce both columns with `scripts/eval-model.mjs`, which regenerates
§1b's table exactly.

**On the noun gold set — the metric this project has always quoted:**

| tier | n | pipeline | v1 | v2 |
|---|---|---|---|---|
| `lexicon` | 187 | **64.2%** | 47.6% | 60.4% |
| `harvested` | 1,078 | **61.9%** | 58.5% | 61.7% |
| `guess` | 209 | 0.0% | 42.1% | **45.0%** |
| all | 1,474 | 53.4% | 54.8% | **59.2%** |
| hybrid | | | 59.4% | **59.8%** |

The hybrid moved +0.4pp. That is not disappointing, it is arithmetic: the model
only fires on the `guess` slice, which is 14% of gold, so +2.9pp there is
+0.4pp overall. **The hybrid architecture caps the model's contribution at the
size of the slice it is allowed to touch.**

**On the verb gold set, built the same day because the above cannot see verbs:**

| group | n | pipeline | v1 | v2 |
|---|---|---|---|---|
| `-ж/-ч` imperfective converb | 58 | 0.0% | 19.0% | **63.8%** |
| `-сан` past participle | 46 | 17.4% | 52.2% | **80.4%** |
| `-даг` habitual | 28 | 17.9% | 39.3% | **71.4%** |
| `-на/-нэ` present | 27 | 0.0% | 37.0% | **81.5%** |
| `-аад/-ээд` perfective converb | 25 | 0.0% | 24.0% | **72.0%** |
| `-лаа` (ambiguous) | 8 | 25.0% | 37.5% | 50.0% |
| **all** | **197** | **8.6%** | 33.5% | **72.1%** |

**Same model, same run: the noun set reports +4.4pp and the verb set reports
+38.6pp.** Nine tenths of the effect was invisible to the only metric that
existed. This is the second time on this project that aggregate accuracy hid
something structural, and the first — the `normalizeOrthography` bug — was also
found by looking at a specific class rather than at the mean.

Two things fall out that matter more than the headline:

- **The pipeline is at 8.6% on verbs, 2.2% on the 91% of them it must guess.**
  That is not a weak tier, it is a non-functional one. Whatever the converter
  currently emits for a verb is close to arbitrary.

  > **Superseded 2026-08-10: it is 50.8%, and the guess slice is 47.7% of the
  > fixture rather than 91%.** See §1f. The word "non-functional" was accurate
  > when written and has been quoted since as if it were a standing property.
  > The rest of this section's finding — that the noun set and the verb set
  > report different things about the same run — is unaffected.
- **`-аад/-ээд` went 0% → 72%.** `verb-suffixes.ts` refuses to guess that ending
  because it has *zero* attestations, and the rules still score 0%. 83 aligned
  examples were enough.

**The caveat, which is real and must travel with the number.** The verb gold set
is drawn from the same source as the new training data, so v2 is in-distribution
and v1 is not. Leak is verified zero (0 of 197 in train/val) and learning
`-ж → ǰü` from 136 examples and applying it to 58 unseen words is genuine
morphological generalisation. But part of the +38.6 is domain match rather than
learning, and the two cannot be separated without verb data from an independent
source. **Quote 72.1% as "verbs of this kind", never as "verbs".**

The reader rulings went 15/28 → 14/28, which is noise at n=28. An early
hypothesis that v2 systematically over-applied `-iyar`/`-iyen` was **wrong** and
is recorded here so it is not re-derived: recall went 64% → 82% with precision
roughly flat (91% → 88%), so v2 uses that ending considerably more accurately.
`тоосгоор` and `гэрээгээ` are two individual losses against 36 gains.

## 1d. Third run, and the first independent confirmation (2026-07-30/31)

**v3 was never written up here; this section is the record.** Same 7.4M
architecture, 120-epoch budget with early stopping, **81.8 min on the M4 mini**,
stopped at epoch 103 with best epoch 91. Train/val/test 29,740/1,565/1,768.

| | v1 | v2 | v3 |
|---|---|---|---|
| gold exact-match | 54.8% | 59.2% | **67.59%** |
| val exact-match | — | — | 71.12% |
| rule-based guesser, same set | 4.1% | 4.1% | 4.1% |

The artifacts live on the Mac mini at `~/gege-train/model-v3/` — the box is
`spacehub@192.168.1.29`, it has the venv and torch 2.13 with MPS, and
`~/gege-train/` holds every run's data and weights. That is the working copy;
`.tmp/` on the laptop is not.

### Confirmed on an independent set, with the literature's metrics

The run above scores against gold, which is Tungaamal-derived. `benchmark.mjs`
now scores the same checkpoint on the two-reference consensus set —
`--dump-words` to export the types, `--model` to read `convert.py`'s TSV back:

| system | types | WER | CER |
|---|---|---|---|
| pipeline — where the guesser fired | 68 | 88.24% | 23.29% |
| **model v3 — the same 68 types** | 68 | **29.41%** | **7.05%** |
| pipeline — all | 604 | 22.02% | 5.40% |
| model v3 alone — all | 604 | 21.52% | 4.67% |
| **hybrid** | 604 | **15.40%** | **3.67%** |

**This is the third measurement pointing at one conclusion**, and the first from
a source that is not the gold set: the guesser is the whole gap, and the model
closes most of it. Whole-set WER goes 22.02% → 15.40%, a 30% relative reduction;
token-weighted, 21.51% → 12.31%, because the guessed slice is frequency-heavy.

The leak argument and the one thing it does *not* control for (the model was
trained on Tungaamal's output and half the reference is Tungaamal) are in
`data-and-accuracy.md`. Read them before quoting either number.

**The model alone is 21.52% — barely better than the pipeline's 22.02%.** Only
the combination is worth anything, which is the §1c lesson again: the hybrid caps
the model's contribution at the slice it may touch, and that cap is also what
keeps the dictionaries' 13.62% on everything else.

## 1e. Fourth run — no improvement, and the val curve lied (2026-07-31)

**v4a is not better than v3. It is marginally worse on all three sets, and the
hybrid is unchanged.** Recorded in full because a negative result from a
correctly-run experiment is worth as much as a positive one, and because the way
it misled mid-run is the reusable part.

The run was a clean control: identical hyperparameters to v3 (7.4M, d_model 256,
4 layers, 4 heads, seed 20260727), identical trainer. The only change was the
data — targets corrected after `repairDevoicedGa` was withdrawn, which v3 had
trained on wrongly across 224 rows, plus the lexicon changes since 2026-07-30.
74.3 min, stopped early at epoch 89, best epoch 77.

Every number below is on **identical** sets, with v3 re-scored rather than
quoted from its own report:

| | v3 | v4a |
|---|---|---|
| gold, model alone | **68.6%** | 67.0% |
| gold, `harvested` tier | **71.4%** | 69.0% |
| gold, `guess` tier | **60.8%** | 60.4% |
| gold, **hybrid** | 65.2% | 65.2% |
| reader-confirmed, model alone | **57.5%** | 52.5% |
| reader-confirmed, **hybrid** | 96.3% | 96.3% |
| benchmark, model alone | **21.52% WER** | 22.02% WER |
| benchmark, guessed slice | **29.41% WER** | 30.88% WER |
| benchmark, **hybrid** | **15.40% WER** | 15.56% WER |

### ⚠ The val curve was ahead the whole way and meant nothing

Mid-run, v4a led v3 by 6–7 points at every matched epoch — 58.8% against 52.0%
at epoch 25 — and finished with a *higher* val than v3 (72.87% against 71.12%,
and 74.61% against 72.27% on the selection subset). It reached v3's final val
by epoch 50, half the epochs.

All of that was real and none of it transferred. **The two runs have different
val splits**, because the split is drawn from data that changed, so the
comparison was never valid — v4a fit its own val better and generalised to gold
slightly worse. The trap is that the numbers are printed side by side in two log
files and look directly comparable.

**Only compare on a set both models were scored against after the fact.** That
is now written into `training/README.md` as procedure, and it is the same
failure mode as the gold set growing 1,768 → 1,884 mid-session: a denominator
moved and the number kept its name.

### What it says about where the gains are

The obvious hypothesis — fewer training rows — does not hold: train went 29,740
→ 29,630, a 0.4% reduction. Held-out keys grew 2,110 → 2,226 as the fixtures
grew, which makes gold slightly harder, but not by 1.6 points. What is left is
ordinary run-to-run variance on a 7.4M model over ~30k pairs, and that is the
finding: **a variance band of ±1–2pp is wide enough to swallow a data
correction affecting 224 rows.** Do not read a single run's delta as signal at
this scale; either average several seeds or change something bigger.

Correcting the `repairDevoicedGa` targets was still right — they were wrong —
but it should not have been expected to show up in aggregate, and it did not.

**v3 remains the best checkpoint.** Nothing about the pipeline changed, and the
hybrid — the only arrangement that would ever ship — is identical on gold and on
the reader's verdicts, and 0.16pp worse on the benchmark, which is noise.

## 1f. Re-scored against today's pipeline (2026-08-10)

**Every pipeline and hybrid column in §1b–§1e is stale.** The fixtures have not
changed since 2026-07-31, so the v3 and v4a *predictions* remain valid and were
re-used rather than regenerated — but the pipeline has moved 20+ commits,
including a whole new stem tier and the stem-restoration layer, so its column
and the hybrid that depends on it are answers about a converter that no longer
exists. This section is the current reading. It does not retract §1b–§1e; those
were correct on the day and the deltas inside each are still comparable.

`node scripts/eval-model.mjs --preds .tmp/gold-preds-v3-on-v4gold.tsv`, noun
gold, 1,884 forms, graded in SCRIPT:

| tier | n | pipeline | v3 model | v3 hybrid | v4a model | v4a hybrid |
|---|---|---|---|---|---|---|
| `lexicon` | 305 | **76.4%** | 64.3% | 76.4% | 64.9% | 76.4% |
| `harvested` | 1,337 | 68.4% | **71.9%** | 68.4% | 69.9% | 68.4% |
| `toli` | 45 | **73.3%** | 55.6% | 73.3% | 57.8% | 73.3% |
| `guess` | 197 | 5.1% | **55.8%** | 55.8% | 53.3% | 53.3% |
| all | 1,884 | 63.2% | **68.6%** | **68.5%** | 67.0% | 68.2% |

(The v4a columns come from `--preds .tmp/gold-preds-v4a.tsv` over the same
fixture. `.tmp/preds-v3-gold.tsv` and `.tmp/preds-v4a-gold.tsv` are byte-identical
duplicates of the two files named here — either path reproduces the table.)

`--gold test/fixtures/verb-gold.json --preds .tmp/preds-v3-verb.tsv`, 197 forms:

| tier | n | pipeline | v3 | v3 hybrid |
|---|---|---|---|---|
| `lexicon` | 20 | **90.0%** | 65.0% | 90.0% |
| `harvested` | 82 | **96.3%** | 73.2% | 96.3% |
| `toli` | 1 | 0.0% | 100.0% | 0.0% |
| `guess` | 94 | 3.2% | **51.1%** | 51.1% |
| all | 197 | 50.8% | 61.9% | **73.6%** |

By ending: converb-imperfective 58 (50.0 / 58.6 / 74.1), participle-past 46
(45.7 / 78.3 / 78.3), participle-habitual 28 (46.4 / 64.3 / 75.0),
present-future 27 (59.3 / 63.0 / 74.1), converb-perfective 25 (48.0 / 52.0 /
60.0), past-or-nominal 8 (87.5 / 12.5 / 87.5), converb-conditional 4 (50.0 /
75.0 / 75.0), converb-terminative 1 (0.0 / 0.0 / 0.0).

### Three things this changes

**1. §1c's "the verb tier is non-functional at 8.6%" is superseded.** It is
**50.8%**. The sentence "whatever the converter currently emits for a verb is
close to arbitrary" was true of the pipeline of 2026-07-27 and is not true of
this one — `harvested` alone reads 96.3% on that fixture now. The *shape* of
§1c's finding survives intact: the noun set and the verb set still disagree
about what improved, and averaging still hides it.

**2. The model's headroom is now small on nouns and large on verbs.** That is
the whole picture in one line, and it is a change of kind rather than degree:

| | guess slice | share | v3 there |
|---|---|---|---|
| noun gold | 197 / 1,884 | 10.5% | 55.8% |
| verb gold | 94 / 197 | 47.7% | 51.1% |

The hybrid's contribution is capped at the slice it may touch — §1c's arithmetic
— and on nouns that slice is now a tenth of the fixture. On verbs it is nearly
half. **The model is a verb instrument.** Anyone measuring it on noun gold is
measuring a cap, not a model.

**3. v3 still beats v4a**, on identical sets and identical predictions, exactly
as §1e concluded — but the *hybrids* are no longer tied. §1e recorded both at
65.2% on gold, a dead heat, and that tie was part of its case for treating the
two checkpoints as interchangeable in the only arrangement that would ship.
Re-scored today they are **68.5% (v3) against 68.2% (v4a)**. Nothing about
either model changed; the pipeline underneath them did.

The reusable part is §1e's own rule, applied one step further out: **compare
only on sets both were scored against after the fact — and re-apply that every
time the *pipeline* moves, not only every time a model does.** A hybrid number
is a joint measurement of two systems, and it goes stale when either one of
them changes.

⚠ The pipeline column above (63.2%) is `candidates[0]` — what the converter
emits. `scripts/eval.mjs` reports 64.9% over the same 1,884 because it scores
the best *segmented* candidate. Both are honest; they are different questions.
`docs/data-and-accuracy.md` has the split. **Never mix them in one table.**

### v5 — the first run since v2 that clearly beats its predecessor (2026-08-10)

Same 7.4M architecture, same seed, same hyperparameters as v3 and v4a. The only
change is the data: **34,218 pairs against v4a's 29,630**, essentially all of it
the rewritten sentence aligner below. 105.6 min on the M4 mini, early-stopped at
epoch 116, best epoch 104. Artifacts at `~/gege-train/model-v5/`.

Every column below was produced **today, by the same script, against the same
fixtures**, with v3 and v4a re-scored rather than quoted — §1e's rule. The
`pipeline` column is identical across rows by construction, so only the model
and hybrid columns move.

**Noun gold — `harvested-inflected.json`, 1,884 forms** (pipeline 63.2%):

| | v3 | v4a | **v5** |
|---|---|---|---|
| model alone | 68.6% | 67.0% | **72.7%** |
| `guess` slice (n=197) | 55.8% | 53.3% | **56.9%** |
| `harvested` tier | 71.9% | 69.9% | **75.8%** |
| **hybrid** | 68.5% | 68.2% | **68.6%** |

**Verb gold — `verb-gold.json`, 197 forms** (pipeline 50.8%):

| | v3 | **v5** |
|---|---|---|
| model alone | 61.9% | **74.6%** |
| `guess` slice (n=94) | 51.1% | **68.1%** |
| **hybrid** | 73.6% | **81.7%** |

**Reader rulings, 160 confirmed words** (pipeline 160/160):

| | v3 | **v5** |
|---|---|---|
| model alone | 68.1% | **73.8%** |
| words the model breaks that the pipeline gets right | 51 | **42** |
| hybrid | 98.1% | 98.1% |

**The verb numbers are the result, and they are where the data went.** +17.0pp
on the verb guess slice and +8.1pp on the verb hybrid, against +1.1pp and
+0.1pp on the noun equivalents. That asymmetry was predicted before the run
from the slice sizes — the noun guess slice is 197 of 1,884 and already sat at
55.8%, capping any possible gain at ~2.3pp, while the verb slice is 94 of 197 —
and it is the reason the aligner was rewritten rather than more nouns
harvested. By group, habitual `-даг` reaches 85.7% and present `-на/-нэ` 81.5%.

⚠ **The hybrid barely moved on nouns and that is not a disappointment, it is
the architecture.** The model only fires where the pipeline guesses, so its
contribution is capped by that slice — the §1c lesson, now with a much better
model and the same ceiling.

⚠ **This reopens the "where does the model sit" question, and does not settle
it.** v5 now beats the pipeline on gold's `harvested` tier by a wide margin
(75.8% against 68.4%) and overall (72.7% against 63.2%), which reads as a clear
promote. §7 item 2 records that the *same* comparison on the two-reference
benchmark ranked them oppositely in 2026-07-31, and that benchmark has not been
re-run against v5. **Do not promote the model above `harvested` on the gold
reading alone** — that is exactly the mistake §7 already documents. Re-run
`benchmark.mjs --model` first.

### ⚠ `train.py` under `nohup` buffers stdout — launch with `python -u`

Python buffers stdout when it is not a terminal, so a `nohup`-ed run writes
nothing to its log for many minutes and is **indistinguishable from a dead
one**. The abandoned v4b run's log stops at exactly the same torch warning a
healthy run stops at while it is still working, which is what makes this
expensive rather than merely annoying: the wrong diagnosis is available and
looks confirmed.

Launch with `python -u` (or `PYTHONUNBUFFERED=1`). `training/README.md` records
the same thing beside its `nohup` recipe.

## 2. What data you already have

Enough to start. This is the part people usually block on, and you are past it.

| Source | Rows | What it is |
|---|---|---|
| `.tmp/harvest-harvest.jsonl` | **31,320** | Cyrillic → Unicode bichig word pairs, machine-repaired |
| `.tmp/harvest-sentences.jsonl` | **4,000** | **parallel sentences** — the highest-value file here |
| `src/data/harvested-lexicon.ts` | 8,680 | the filtered subset that survived into the package |
| `src/data/lexicon.ts` | ~165 | hand-curated, reviewed by a bichig reader |
| `.tmp/unimorph-khk.tsv` | 30,143 | UniMorph Khalkha — Cyrillic-only, but supplies **verb paradigms with tags** |
| `.tmp/kaikki-mn.jsonl` | 6,623 | Wiktionary |
| `.tmp/monwn.tsv` | 42,610 | Mongolian WordNet |
| `test/fixtures/harvested-inflected.json` | 1,203 | the held-out gold set |

31k word pairs is a workable training set for this task class. The 4,000
parallel sentences matter more than their count suggests — they are the only
thing that can teach context, and they are already aligned.

UniMorph is Cyrillic-only so it is not directly parallel, but its verb
paradigms tell you *which* Cyrillic forms belong to one lemma. That is exactly
the structure the suffix table refuses to encode, and it is usable as an
auxiliary signal or for generating a synthetic verb training set once a handful
of verb stems have Classical forms.

### Correction, 2026-07-27: what UniMorph actually offers

The row count above is real but the conclusion drawn from it was wrong, and it
drove this document's former top recommendation. **The 30,143-row file is about
17× duplicated.** Deduplicated:

| | |
|---|---|
| unique verb rows | **899** |
| unique verb surface forms | **745** |
| distinct verb **lemmas** | **55** |
| already present in `.tmp/harvest-harvest.jsonl` | **745 / 745 — 100%** |
| held out in gold | 0, so all 745 were already training data |

So "harvest the UniMorph verbs" was already done before v1 trained, and buys
exactly nothing. Morphological depth is excellent — 55 lemmas × 14 tags — but
lexical diversity is 55 verbs, which is not a training set.

What it *is* good for is reading suffixes off with their grammatical tag: for
every one of the 14 tags, both the infinitive and the inflected form have
Classical in the harvest, giving **627 alignable (lemma, form) pairs** at n=42–52
per tag. That is 3–50× the evidence behind `src/data/verb-suffixes.ts`, and it
covers nine tags that table does not have at all (`-в`, `-чих`, `-магц`,
`-маар`, `-цгаа`, `-уул`, `-нгаа`, `-я`, `-асай`). It does **not** contain
`-ж/-ч` or `-аад/-ээд` under any tag — those come only from the source below.

### ⚠ The IMU parallel corpus is a test set, not a training set (2026-07-31)

The obvious next move after the corpus arrived was to train on it: 49,452 types
over 450,860 tokens of real Cyrillic|bichig running text, verb-rich, which is
1.5× the entire existing training set and addresses the exact hole §1c names.
**It was measured and rejected.** Do not re-derive this.

The test: on the 684 types Tungaamal and IMU both answer, transform the IMU side
into our convention and count **exact** matches against the Tungaamal side —
Tungaamal being the convention the harvest already carries.

| transform applied to the IMU side | exact match |
|---|---|
| raw | 8.3% |
| `normalizeOrthography` | 9.4% |
| `normalizeOrthography` + NNBSP→MVS | **71.9%** |
| the above + ᠶᠢ→ᠢ | 63.2% |

**71.9% is not good enough to train on.** Roughly 28% of imported rows would
carry a convention we reject, and the residual is not noise — it is systematic
MVS placement: нартай IMU `nara᠎tai` against our `naratai`, болохоор IMU fused
against our detached. Importing it would teach the model IMU's connector
decisions, which is the single thing this project is most opinionated about.

**And note the last row, which is why this had to be measured rather than
assumed.** Folding ᠶᠢ→ᠢ *lowers* agreement by 8.7 points. That fold is correct
in `benchmark.mjs`, where it is applied to **both** sides to neutralise a known
difference; as a one-sided transform it is simply wrong, because our convention
writes YA+I in the genitive (тэнгэрийн is `᠎ᠶᠢᠨ`). A transform that is right for
scoring was nearly shipped as a transform for data.

**The obvious rescue was tried and fails too.** If the residual is connector
*placement*, then corpus forms containing no connector at all should be safe —
and that slice is large, 24,072 types and 64.6% of running text. It agrees at
**77.5%**, against 71.2% for the connector-bearing forms. Six points is not the
difference between unusable and usable.

The disagreements say why, and it is worth understanding rather than retrying:
those forms have no connector precisely because **IMU fuses where we detach** —
болохоор, хүчтэй, гүнд, эвтэй, зүйтэй are all one unit for IMU and stem᠎suffix
for us. Selecting on "no connector" does not filter the convention difference
out, it filters *for* it. Any similar filter will have the same shape.

The corpus keeps its real job: it is half of the two-reference benchmark, and it
is the only token-weighted denominator this project has. Both of those depend on
it staying **out** of training.

### ⚠ The toli dictionary is a runtime tier, not training data (2026-08-10)

The same move suggested itself the day the `toli` tier shipped: it is 41,640
reviewed-by-nobody but *convention-clean* pairs, larger than the entire existing
training set, and it needs no import work because it is already in the package.
**It was measured and rejected.** Do not re-derive this.

It even passes the test the IMU corpus failed. On the keys the word harvest and
the dictionary both answer, with `normalizeOrthography` applied to both sides
and graded in script:

| | n | exact agreement |
|---|---|---|
| IMU corpus (rejected 2026-07-31) | 684 | 71.9% |
| **toli dictionary** | **7,447** | **86.7%** |

Reproduce: read `.tmp/harvest-harvest.jsonl`'s `unicode` field through
`normalizeOrthography`, render each galig with `toScript` and normalise it the
same way, and compare on the intersection of the Cyrillic keys.

Three findings, and the first is the one that decides:

**1. 99.94% of what would be added is not covered by that test.** The agreement
figure is computed on shared keys — and shared keys are exactly the ones the
importer *drops* as `outranked`. Of the 40,793 distinct Cyrillic keys in the
shipped tier, **25 are also in the harvest**. So the reassuring 86.7% validates
0.06% of the rows an import would actually contribute, and says nothing about
the other 40,768. A number measured on the complement of the thing you are
buying is not evidence about the thing you are buying.

**2. The residual is systematic, and it is the same defect as IMU's.** Of the
991 disagreements, 111 (11.2%) differ *only* in MVS placement. The comitative
makes it visible: there are **621 shared keys ending -тай/-тэй/-той and
exactly zero** of the dictionary's forms carry a connector on any of them. The
126 shared `-гүй` keys agree at **7.9%** against the 86.7% baseline.

And the same rescue fails the same way. Filtering to dictionary forms that
contain no connector at all leaves 6,830 shared keys at **88.0%** — 1.3 points
above baseline, for the same reason it failed for IMU: **connector-absence *is*
the fusion**, so the filter selects for the defect rather than against it.

**3. It is a lemma list, and the model's hole is verbs.** Share of forms whose
script carries an MVS connector, i.e. that are more than one morpheme:

| | n | multi-morpheme |
|---|---|---|
| word harvest | 32,070 keys | **54.0%** |
| shipped toli tier | 41,640 rows | **4.1%** |

Adding it would take the training set from majority-inflected to overwhelmingly
bare stems. The one thing §1c and §1f both say the model needs is verb *forms*;
this is a dictionary of headwords. It is aimed at the opposite end of the
problem from the hole.

**It keeps its real job.** As a runtime stem tier it is worth ~1.7pp of top-1
and halves the guesser's share of running text, because there its unreviewed
bulk competes only against `guessStem`. As training data the same bulk would be
weights nobody can edit. See `docs/data-and-accuracy.md`.

### The parallel sentences were the real find (2026-07-27)

`.tmp/harvest-sentences.jsonl` was collected for homograph detection and never
mined for word pairs. It is **running text**, and running text has inflected
verbs, which is precisely what a lemma-dictionary harvest cannot have. This is
the root cause of the verb hole: not that verbs are hard, but that there was
never any verb signal in the data.

`scripts/align-sentences.mjs` extracts them. Alignment cannot be naive — the
reference converter does not preserve token count, and a merge (миний л → one
token) shifts every later token with no error. Worse, a merge and a split in
the same sentence leave the counts equal, so a length check does not catch it.
Naive positional alignment agrees with the word harvest only **83.4%** of the
time, and the errors arrive in runs.

The word harvest is an independent oracle for any token it already contains, so
the fix is to align positionally and then require that *every* anchorable token
agrees — one disagreement condemns the whole sentence, because a shift is a
property of the sentence rather than of the token.

| | |
|---|---|
| sentences | 4,000 |
| token counts differ — undroppable merge/split | 2,188 (54.7%) |
| anchor mismatch — **silently misaligned**, dropped whole | 717 (17.9%) |
| accepted | 1,095 (27.4%) |
| **new word pairs** | **1,966** |
| leave-one-out precision on held-out anchors | **95.3%** |

A bichig reader ruled a stratified 28-form sample **28/28 correct** before any
of it was trained on. Coverage of the endings that were missing:

| ending | new forms | attestation in `verb-suffixes.ts` before |
|---|---|---|
| `-ж/-ч` imperfective converb | 194 | n=1 |
| `-аад/-ээд` perfective converb | 83 | **zero** |
| `-сан/-сэн` past participle | 154 | n=17/7 |
| `-даг/-дэг` habitual | 94 | n=4/3 |
| `-на/-нэ` present | 90 | n=2 |
| `-лаа/-лээ` | 28 | absent on purpose |

The extraction independently reproduced a reader ruling it had not been shown:
`хийж` → ᠬᠢᠵᠦ, byte-identical to `toScript('kiǰü')`, which is the correction
the reader gave on 2026-07-27 and which both the rules and the v1 model got
wrong. It is held out rather than trained on, for that reason.

**Do not use this to conclude the sentence file is exhausted.** 72.6% of
sentences were dropped, most for a token-count mismatch that a real aligner
(rather than a positional one) could recover.

### ★ The real aligner was written, and it tripled the yield (2026-08-10)

The prediction in the paragraph above was correct. `scripts/align-sentences.mjs`
now drives a DP aligner in `scripts/lib/align.mjs` instead of aligning by
position, and the harvest changed role: it was a **check** (align positionally,
then reject the sentence if any anchor disagrees) and it is now a
**constraint** (the anchors are fixed points, and the aligner solves the short
unknown spans between them). Reproduce the whole table with
`node scripts/align-sentences.mjs OUT.jsonl`.

| | before | after |
|---|---|---|
| sentences contributing a pair | 1,153 / 4,000 | **3,781 / 4,000** (94.5%) |
| new word pairs | 2,037 | **6,217** |
| verb-shaped pairs | 675 | **1,671** |
| leave-one-out precision on held-out anchors | 95.3% (§2 above) | **96.3%** (22,460 / 23,329) |

The `after` column and both `verb-shaped` figures were re-derived on
2026-08-10; the old pair file is kept at `.tmp/aligned-words.before.jsonl`, so
the `before` column is a count over real rows rather than a quoted memory. The
1,153 sentences are recorded in `align-sentences.mjs`'s own header.

**Precision did not fall, and that is the claim that needed checking rather
than asserting.** Scored on the anchors *both* algorithms answer, the two are
level; the new pairs are additional, not a lowered bar. ⚠ That comparison
cannot be re-run — it needs the old algorithm, which no longer exists in the
tree — so it stands as recorded at the time and is the one number in this
section without a command beside it.

Training set: `node scripts/export-training-data.mjs OUT_DIR` now reports
**train 34,214 / val 1,801 / test 1,884**, from harvest 32,070 + 860 recovered
from quarantine + **6,217 sentence-aligned** − 2,354 held-out keys, deduped to
36,015. Leak check passes. The same command over the 2,037-pair file is what
the ~30k figures in §1c–§1e were built on.

Four properties of the design, each of which is load-bearing:

- **The only reward is agreement with the word harvest**, used as an oracle.
  There is no length prior, no character-overlap heuristic, and nothing that
  can prefer an alignment because it looks tidy.
- **The operation set is 1:1, merge, split and skip.** The converter merges
  (миний л → one token) and splits (усны → two), so an aligner without both is
  wrong by construction on this data.
- **A pair is emitted only if a forward and a backward pass both force it.**
  Everything else is dropped rather than guessed. 1,166 of 38,297 Cyrillic
  tokens (3.0%) end up unaligned and are simply not used.
- **Nothing tests token counts for equality.** A merge and a split in one
  sentence leave the counts equal, so the check the old version relied on was
  never sound — it only happened to be conservative.

`attachDetachedSuffix` is applied **across the token boundary first**, before
alignment. The converter writes the genitive detached in sentence mode and
MVS-connected in word mode, so without that pass the same word is two different
strings depending on which file it came from, and every such anchor
mis-scores.

**Measured and rejected: charging cost 1 for a merge or a split.** It yields
slightly more pairs at meaningfully worse precision (recorded at the time as
6,296 pairs at 95.4%, against 6,217 at 96.3%). The mechanism is the part worth
keeping: with a uniform cost, a run of 1:1 steps becomes uniquely cheapest
through a span where a merge and a split cancel each other out. The aligner then
confidently produces a shifted alignment with no signal that anything is wrong
— which is the original positional failure mode returning in a new form, and
the reason "more pairs" is not on its own an improvement here.

⚠ **244 held-out forms appear in the aligner's output and are removed
downstream** by `export-training-data.mjs`; the script asserts no leak before
writing and prints `leak assertion PASS`. Do not treat the aligner's own file
as training-ready.

## 3. The training target format

**This is the section to get right before spending a GPU-hour.**

### The target is Unicode code points, not romanization

The requirement is a representation that is **total and canonical**. Being
human-readable is romanization's requirement, not the model's, and the two
pull in opposite directions. Emit the script itself; keep romanization for the
data files humans read.

**Romanization is not canonical, and that alone disqualifies it.** U+182C is
written `q` or `k` and U+182D is written `γ` or `g`, chosen by vowel harmony —
so many romanizations decode to byte-identical script. Measured over the
31,320-row harvest:

| | |
|---|---|
| rows containing U+182C or U+182D | **72.9%** |
| mean distinct romanizations per row | **3.08** |
| worst row | **1,024** valid romanizations of one identical output |

Training against that means the loss penalises a model for emitting `ger` when
the gold string says `γer`, though the two produce the same code points. This
is CLAUDE.md's "**grade in SCRIPT, never in romanization**" footgun — the one
that once scored the curated lexicon at 56% instead of 83% — reappearing as a
bug in the loss function rather than in an eval script. Canonicalising the
targets first would work, but it is machinery that can silently go wrong,
protecting a representation that has no other advantage here.

**Romanization is also not total.** Seven galig letters (U+183A GAA, U+183B KA,
U+183E HAA, U+183F ZRA, U+1840 LHA, U+1841 ZHI, U+1842 CHI), the space, and
U+180A/U+1806 have no romanization at all. That is what quarantines 1,638
harvest rows — **5% of the corpus, lost to notation, not to bad data**:

| Missing | Rows |
|---|---|
| U+0020 space — multi-word forms, аавгүй is `abu üγei` | 1,038 |
| U+183B ᠻ KA — Tungaamal writes кино as ᠻᠢᠨᠣ᠋ | 521 |
| U+183E ᠾ HAA | 57 |
| U+1806, U+180A | 16 |
| U+183A ᠺ, U+183F ᠿ, U+1840 ᡀ | 5 |

Filling those gaps is not mechanical. `romanize.ts` refuses the galig letters
*deliberately*, so that emitting one from native vocabulary throws instead of
shipping a wrong-block error — and U+183A/U+183B are taught with **opposite
values by region** (`script-styles.md` logs it as a cross-border hazard:
Inner Mongolia and GB/T 25914-2023 teach U+183A as "ka", Mongolia U+183B). A
romanization for them would have to be invented here and would pick a side.

**Choosing code points makes all of that moot.** Nothing to invent, nothing to
decide, no quarantine.

### What this costs, honestly

Only the `toScript` gate, and it was worth less than it looked: it checks
alphabet membership, not well-formedness. The real validation is
`gege-linter`, already wired in as the stage-8 `validate` hook, and it is the
thing that catches FVS placement, stray ZWJ/ZWNJ and wrong-block letters. Keep
it on and the model is gated better than romanization ever gated it.

Eye-auditability survives too: `fromScript()` renders code points back to
romanization on demand for debugging. And it was never the review channel
anyway — terminal output cannot be used to judge bichig, which is why
`scripts/build-spotcheck.mjs` exists.

Alphabet size is a wash: ~46 symbols (letters + MVS + FVS1–4) against
romanization's ~35. No meaningful data-efficiency difference at this scale.

### The data is already in this format

`.tmp/harvest-harvest.jsonl` stores a `unicode` field — the repaired, correct
code points — on all 31,320 rows, and **all 1,638 romanize-quarantined rows
carry it too**. Romanization was the only thing rejecting them.

| | pairs |
|---|---|
| harvest | 31,320 |
| recovered from quarantine | +1,638 |
| **usable immediately** | **32,958** |

No export step, no notation work, no upstream release. The training set exists.

### One refinement to consider later

MVS and FVS are invisible and positionally conditioned, so the model has to
learn to place them. Since MVS placement follows from the suffix boundary,
which the pipeline already knows, a later version could have the model emit
base letters only and let deterministic code insert the connector. Do not do
this in v1 — it reintroduces a notation, which is the thing this section is
about avoiding.

### The FVS digit collision (still worth fixing)

Independent of the model: `toScript('1234')` returns four variation selectors
**silently, with no error**, because `1`–`4` select FVS1–FVS4, while
`toScript('2026')` throws on the `0`. Word tokens never contain digits so it
does not bite today, but it is a silent-corruption footgun. A guard belongs
upstream: an FVS digit must follow a base letter.

The same collision covers `-` (MVS) and `.` (letter boundary, silently
dropped). Three of romanization's metacharacters are ASCII characters that
occur in ordinary text — which is why romanization stays **word-scoped**, and
another reason not to make it carry model output.

### Digits and punctuation stay outside the model

They were the original worry and they turn out not to be a blocker. `tokenize`
already separates `word` / `number` / `punctuation` / `latin` / `space`, and
`punctuation.ts` now renders the non-word kinds under an explicit policy —
ASCII by default, because UTN #57 §2.2.3 defers every number and punctuation
specification and there is no canonical target to convert *to*. See the ruling
in `rulings.md`.

**For the model this is the right shape anyway**: the model should convert word
tokens only, and the pipeline splices digits, punctuation and Latin through
verbatim. Never make a sequence model learn to copy `2026` — it is wasted
capacity and a hallucination surface, and a model that occasionally renders a
year wrong is far worse than one that never touches it.

### Training pair format

Word-level first, since that is where the 4.1% is. Source characters in,
target code points out — the romanization column is shown here only so a human
can read the example, and is **not** part of the pair:

```
монголын  →  U+182E 1823 1828 182D 1824 182F 180E 1824 1828     (mongγul-un)
ажлаас    →  U+1820 1835 1822 182F 180E 1820 183C 1820          (aǰil-ača)
```

Note MVS (U+180E) is a target symbol like any other — the model learns the
connector, and `rulings.md` is unambiguous that case suffixes always detach.

Sentence-level second, from the 4,000 parallel sentences, for homograph
context. Do not start there — `data-and-accuracy.md` shows the ambiguity is
mostly *morphological* rather than contextual (the өөр finding: only ~7 in 248
occurrences need real context), so sentence context is a late, small win.

## 4. Architecture and deployment

Deliberately boring. Nothing here is a research question.

- **Character-level encoder-decoder transformer**, 4+4 layers, d_model 256,
  ~5–10M parameters. A ByT5-small fine-tune is a reasonable alternative if you
  would rather not write a training loop, at the cost of a much larger model.
- **Trains in well under an hour** on one consumer GPU at this data size.
  Iteration cost is low enough to sweep hyperparameters casually.
- **CPU inference.** A 10M-parameter model over ~10-character words runs in
  single-digit milliseconds per word on a server CPU — no GPU on your box.
  Export to ONNX if you want it in-process rather than behind HTTP.
- **Beam search, width ~5**, so the model returns *ranked candidates* with
  scores. This matters: it matches `Candidate[]` exactly, so the model slots
  into the existing shape rather than forcing a new one.

## 5. How it plugs in

**Not as a replacement, and not as a second project.** It fires only where the
algorithm currently guesses:

```
resolveStem:  lexicon  →  harvested  →  [model]  →  guessStem
```

The tiers above it are unchanged, so a reviewed row still wins outright and the
"a wrong word is a data row you edit" property survives everywhere the
dictionaries reach. The model takes the 26.8% that currently scores 4.1%, and
`guessStem` stays as the floor for when the model is unavailable.

Two seams already exist and neither needs new architecture:

- **`Ranker`** (stage 7) — the documented statistical seam. The homograph work
  already produced labelled data for it: Tungaamal's choice across 4,000
  sentences, for words where the two readings share no substring.
- **`ConvertOptions.validate`** (stage 8) — the injected `lint` hook. Point it
  at gege-linter and malformed model output is rejected by the same gate that
  already guards everything else.

This also means the model **cannot fail as a project**. Worst case it is an
unused tier and the package ships exactly as it does today.

A `Provenance` value of `'model'` should be added when this lands, so output
carries its own trust level and the eval can score the tiers separately —
the same way `guess` is scored separately now.

## 6. Risks

**The harvest inherits the reference converter's errors.** This is the real
one. `data-and-accuracy.md` already warns that "correct" means agreeing with
Tungaamal, not with a bichig reader, and that the true figure is unknown and
probably lower. A model trained on 31k harvested pairs will reproduce those
disagreements faithfully and with confidence, and unlike a data row you cannot
edit one out. Mitigations, in order of importance:

1. **Never train on the held-out gold set.** `harvested-inflected.json` and the
   `rulings.test.ts` fixtures are test-only, permanently.
2. **Fine-tune last on the curated tier** and the rulings fixtures, so the
   final gradient steps come from bichig-reader-verified data.
3. **Score against `rulings.test.ts`** as a separate metric. Those are a
   reader's verdicts and are the highest-authority fixture in the suite — if
   the model contradicts them it is wrong regardless of what the harvest says.

**Confident wrongness.** The guesser is transparently bad, which is honest; a
model is opaquely bad, which is worse for users. Keep `provenance` visible in
the API and keep the linter gate on.

**The review loop still applies.** Terminal output cannot be used to judge
bichig. Model changes go through `scripts/build-spotcheck.mjs` like every other
change — that is not optional politeness, it is the only working review channel.

**Do not let it stall the algorithm.** Every improvement to the dictionaries
raises the algorithm *and* shrinks the slice the model has to cover, and
dictionary rows are reviewable in a way that weights are not. The model is
insurance against the verb hole, not a reason to stop harvesting.

## 7. Where this stands, and what to do next

**Done.** The split is frozen and leak-checked (`scripts/export-training-data.mjs`,
seed 20260727 — re-running reproduces identical files). The model trains,
scores, and beats the guesser. `training/` holds `train.py`, `convert.py`,
`run.sh` and a README; `./run.sh` is the whole workflow.

### ⚠ The trained artifacts live in `.tmp/`, which is gitignored

`.tmp/bundle/gege-train/` (the working copy, including `.venv`) and
`.tmp/gege-train-bundle.zip` (27 MB, portable, includes `model.pt`). **A clean
of `.tmp` destroys the trained weights.** The data is reproducible in seconds
from the export script; the model is a 32-minute retrain. If the weights matter,
move the zip somewhere outside `.tmp` — they are deliberately not committed,
since a 30 MB binary does not belong in this repo.

### Next, in the order that buys the most

**Updated 2026-07-27 after the second run.** Items 1–2 below are done; what
follows them is now the live list.

0. **Recover the 72.6% of parallel sentences currently dropped.** 2,188
   sentences fail on token count (the converter merges and splits) and 717 more
   are rejected as misaligned. A real aligner rather than a positional one
   would reach most of them, and verbs are the scarcest signal in the corpus —
   658 forms total, of which 197 are now held out as the test set. Everything
   else on this list is bounded by how much verb data exists.
1. **An independent verb test set.** 72.1% is measured in-distribution, so it
   cannot be defended as a general verb figure. A few dozen reader-supplied
   verb forms — from prose, not from the aligned pool — would settle it, and
   would outrank the generated fixture the way `rulings.test.ts` does.
2. **Revisit where the model sits.** It was placed below the dictionaries when
   it scored 47.6/58.5 against their 64.2/61.9. It is now 60.4/61.7 — a dead
   heat on `harvested` — and it beats the pipeline 72.1% to 8.6% on verbs. A
   flat "dictionaries always win" rule is no longer obviously right; a
   per-tier or per-confidence rule may beat it. Do not change this without
   measuring, and note the hybrid ceiling above: the model's contribution is
   capped by the size of the slice it is allowed to touch.

   **Measured 2026-07-31, and the answer is "not yet" — see
   `data-and-accuracy.md`.** v3 does pull ahead on gold's `harvested` tier,
   71.4% against 64.6%, which reads as a clear promote. On the two-reference
   benchmark's data-backed slice the same two go the other way, 19.96% WER for
   the model against the pipeline's 13.62%. The two sets rank them oppositely
   because they are different populations folded differently, and neither is
   authoritative enough to break the tie. **Do not promote on the gold reading
   alone.** The guessed slice is the part both sets agree on, and it is the only
   thing the current hybrid relies on.

Still live, unchanged by the second run:

3. **Wire the model in as a tier.** `resolveStem`: lexicon → harvested →
   model → `guessStem`. Add `'model'` to `Provenance` so output carries its own
   trust level and the eval can score it separately, exactly as `guess` is now.
   Keep `guessStem` as the floor for when the model is unavailable.

   **Ruled 2026-07-30, by the owner: the model is never shipped.** Not in the
   npm package, and not exposed even if it goes behind an API. That settles the
   no-third-party-runtime-dependency question by removing it — no
   `onnxruntime-node`, no weights in the tarball, no HTTP client in the library.
   The package continues to ship exactly what it ships today, and the model is a
   server-side tier that the website may call and consumers may not. Anything
   below that reads "wire the model in" means *in the service*, never in
   `@gege-mn/gege-converter`.
4. **Beam search instead of greedy.** `convert.py` decodes greedily. Beam
   width ~5 returns ranked alternatives with scores, which is what `Candidate[]`
   already expects — so the model would produce candidates rather than one
   answer, and the existing ranker could weigh them. Beam scores would also
   supply the confidence signal item 2 needs.
5. **Tune.** Two 50-epoch runs, neither tuned. Nothing about them is a ceiling.

**Done — the former item 1, kept for the reasoning that was wrong.** "Verb
training data" was the top recommendation, and it named `.tmp/unimorph-khk.tsv`
(30,143 rows, Khalkha verb paradigms with tags) as the source. That file turned
out to be 17× duplicated over 745 forms and 55 lemmas, **all of which were
already in the harvest and already trained on**. The verbs came from the
parallel sentences instead. The instinct — *a few hundred verified verb forms
are worth more than another 10k harvested nouns* — was exactly right and is
what the second run measured: 658 verb forms moved the verb metric 38.6pp,
while 1,966 pairs moved the noun metric 4.4pp.

### Still open, and not gating anything

- The galig-letter policy and the U+183A/U+183B regional split
  (`mongol-bichig`) — a real decision for `romanize.ts`, but the model does not
  wait on it, and neither does the training data.
- Space in the romanization alphabet. Same.
- The FVS digit guard, because silent corruption is silent corruption.

### Two rules for anyone picking this up

- **Score against `rulings.test.ts` separately, every run.** Aggregate accuracy
  hid a data bug that reproduced all three of the reader's rulings wrongly. The
  model looked like it was working.
- **Never train on the gold set or the rulings fixtures.** The export removes
  them by Cyrillic surface form and asserts no leak before writing. Do not
  weaken that check to gain rows.

### The holdout filter had a hole, fixed 2026-07-27

The rulings words were extracted with `/'[а-яөүё]+'/` — a quoted string that is
Cyrillic **end to end**. That silently misses every `it.todo` case, because
those are written `it.todo('хийж → kiǰü')` and the arrow and romanization break
the match. So `хийж`, `бэлгэшээсэн`, `хэвтэрт`, `ангижрасан` and `хүлээгээд`
were never held out — **the five known-wrong words whose held-out status matters
most**, since they are the ones any future claim of improvement will be measured
on.

It was inert until sentence alignment became the first data source that
actually contains one of them, at which point `хийж` went straight into train.
Had that not been checked, the next run would have "fixed" `хийж` by
memorising it. The filter now takes every Cyrillic run of length ≥2 in the
file: held-out keys 1,496 → 1,517.

**A holdout filter that has never rejected anything is not known to work.** This
one had been running since the split was frozen, silently matching nothing on
the cases it existed for.

### What is in training and must not be quoted as generalisation

`монгол`, `сайн` and `найм` are **not** in `rulings.test.ts` — they live in
`docs/rulings.md` — so they are in the training set, in v1 and since. The model
producing ᠮᠣᠩᠭᠤᠯ is therefore **recall of a training row, not evidence that it
learned the first-syllable o/ö rule.** Section 1b above reads as if fixing them
demonstrated something about the rule; it demonstrated that the targets were
normalised. To test the rule, score o/ö on held-out words instead.
