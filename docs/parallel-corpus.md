# The parallel corpus — private data, open package

<!-- Background doc. Not loaded into context automatically. -->

Read this before touching `scripts/lib/corpus.mjs`, `scripts/eval-parallel.mjs`,
or anything that reads reader-written sentences.

## Why it exists

Every other source of truth here is either **another converter** or a **lemma
list**, and both distort in ways that have already cost this project real time:

| source | size | what is wrong with it |
|---|---|---|
| harvested lexicon | ~30k rows | Tungaamal output — a real converter that disagrees with us on documented points, reviewed by nobody |
| inflected gold | 1,884 forms | built from a **lemma dictionary**; 273 of its rows are the attached -тай³ class and score **0.0%**, because a lemma list only carries the adjectival ones as headwords |
| verb gold | 197 forms | same word-list shape, so it says nothing about running text |
| `test/rulings.test.ts` | ~90 assertions | genuinely ground truth, and it costs a human's attention every single round |

Reader-written running prose has none of those problems. It is ground truth, it
is weighted the way real text is weighted, and — unlike the review loop, which
is the standing bottleneck on everything — it is paid for once and then scored
again on every commit, free, forever.

`docs/roadmap.md` carries a ⚠ saying not to trust the -тай³ figure without
checking the corpus first. This is the thing that answers it.

## ⚠ The boundary: words and rules cross it, sentences never do

The sentences are somebody's writing and are **not** released. The package stays
MIT. Both of those are true at once because of one rule:

> **A word pair is a fact about Mongolian. A sentence is an article.**

So:

| crosses into the repo, ships MIT | never leaves the corpus |
|---|---|
| lexicon rows (`нас` → `nasu`) | the sentences themselves |
| suffix rows, allomorph conditions | eval fixtures built from them |
| rules, and the reasoning for them | anything that could reconstruct them |
| aggregate counts and frequencies | |

Three things enforce it today, and they are cheap to keep:

- The corpus lives **outside this repository** — `../gege-corpus` by default,
  or `$GEGE_CORPUS`, or `--corpus PATH`. Nothing here reads it unless asked.
- `.tmp` is gitignored and `package.json` has `files: ["dist"]`, so npm ships
  compiled output only.
- `scripts/lib/corpus.mjs` has **no write half**. Nothing it returns may be
  committed to `src/data/` except word-level rows, and the eval half must stay
  held out or it stops measuring anything.

⚠ **A trained model memorises its training data and would leak the corpus.**
`training/` is already not a runtime dependency (`docs/neural-model.md`); this
is a second, independent reason it must not become one, and a reason not to
publish a checkpoint trained on these sentences.

`pnpm eval:parallel` prints **word-level** diagnostics by default, which are
shareable for the same reason a lexicon row is. Whole sentences appear only
under `--sentences`, for reading on your own machine.

## The format

One `.txt` file per batch, anywhere under the corpus root (subdirectories are
walked). Pairs are separated by blank lines; `#` starts a comment.

```
# batch: 2026-08-06 — from the гэр article
Монгол бичиг бол бидний өв.
<the same sentence, written in the gege editor>

Зүрхний хэмжээнд хүрсэн.
<the same sentence, written in the gege editor>
```

**Which line is which is decided by the script it is written in, not by its
order.** That is not politeness: a batch is made by pasting two lines at a time
out of an editor, transposing a pair is *the* obvious mistake, and detecting the
scripts turns a silent corruption of a gold set into a parse error.

### What is checked on load, and what deliberately is not

Checked — things no correct text can contain, which mean it did not come from
the editor it was supposed to:

- Menksoft **PUA** (U+E000–U+F8FF)
- **NNBSP** (U+202F), the legacy suffix connector this package exists to replace
- **ZWJ / ZWNJ**, which are shaping hacks rather than orthography

A pair with any of these is reported *and excluded from scoring*, because
grading our correct output against broken text reports it as wrong.

**Not** checked: spelling. Where the text disagrees with our orthography, the
finding is about **us** — the author is the authority. That is the entire point,
and normalising the corpus toward our conventions would destroy the signal.
(Compare the 2026-07-27 training export, which skipped `normalizeOrthography`
on *harvested* rows and trained a model that reproduced three reader rulings
wrongly. Opposite direction, same lesson: know which side is authoritative.)

## Scoring

```
pnpm build && pnpm eval:parallel
```

Three numbers, each answering something different:

- **exact match** per sentence — harsh, and the one that matters for prose.
- **token-aligned** — sentences where our token count matches theirs. Counts
  diverge *legitimately*: мэдэхгүй is one Cyrillic word and two bichig ones
  (`medeqü üγei`), which `splitClitics` is supposed to do.
- **word accuracy** over aligned sentences, plus the heaviest wrong words.

Ragged sentences are reported, never force-aligned. `scripts/align-sentences.mjs`
measured naive positional alignment at **83.4%**, with errors arriving in runs —
the signature of a silent offset, which would poison a gold set quietly.

## Holdout

`bucketOf()` gives each sentence a stable 0–99 bucket from its Cyrillic alone,
so it keeps its side of the split no matter what order files are read in or
which batch it arrives in. Nothing splits on it yet — the whole corpus is eval
while it is small. **When row-mining starts, the eval half has to stay
untouched**, and a split that moves between runs cannot promise that.

## Collecting submissions

Not built, and two things should be settled before it is:

1. **Terms.** Contributors need to know that their *sentences* stay private
   while *derived word pairs* ship under MIT. That is a decision for the
   repository owner, not an agent.
2. **Trust tiering.** A submission from a known reader and one from an unknown
   account are not the same evidence. The loader already carries `where` (file
   and line) on every pair, which is the hook for recording provenance.
