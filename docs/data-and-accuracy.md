# Data tiers, accuracy, and where the loss is

<!-- Background doc. Not loaded into context automatically. -->

Read this before optimising anything, quoting a number, or touching the
ranker. The short version: **getting a real stem is the only lever that
matters**, and coverage — not top-1 — is the metric that tracks progress.

## Data status (tiers updated 2026-10-02)

The lexicon is **five provenance tiers**. A hit in a higher tier short-circuits
the lookup, so a reviewed entry always wins outright rather than competing on
prior:

| Tier | Rows | Prior | What it is |
|---|---|---|---|
| `lexicon` | 224 | per-row `freq` | Hand-curated, reviewed by a bichig reader. `src/data/lexicon.ts`. |
| `attested` | 92,550 | `ATTESTED_PRIOR` 0.9 | **Whole words**, as the silver writes them, stored only where the derivation below disagrees. **Unreviewed.** `src/data/attested-forms.ts`, GENERATED. |
| `harvested` | 9,048 | `HARVESTED_PRIOR` 0.5 | Stems harvested from the silver, machine-repaired. **Unreviewed.** `src/data/harvested-lexicon.ts`, GENERATED. |
| `toli` | 40,793 | `TOLI_PRIOR` 0.25 | Headwords from a bundled SQLite dictionary, romanized from its galig column. **Unreviewed, and the largest tier.** `src/data/toli-lexicon.ts`, GENERATED. |
| `guess` | — | `GUESS_PRIOR` 0.15 | Rule-based fallback in `stem.ts`. |

⚠ `toli` is **not** just "another harvested tier", and treating it as one is
measurably wrong — see its section below. It is consulted only where every
other path, including each restoration rule, has already missed.

⚠ `attested` is not a stem tier at all. A row is one whole word. It answers
that word outright, and as a stem it is asked last — after every real stem,
above only `toli` and a guess. See the next section.

## ★ The attested tier, and where the numbers stand (2026-10-02)

The silver set is **running text**: the 200,000
commonest word types of a 133M-token corpus — 98.99% of its tokens — plus
16,816 sentences that show each common word in context (`docs/harvest.md` has
how, and what it cost to find out). Where its answer for a whole word differs
from what the pipeline derives, the word is stored: 92,550 rows out of 206,375
words. The other half the pipeline already writes the same way.

### Why whole words, when `harvested` deliberately refused them

`import-harvest.mjs` routes anything inflected to the gold fixture, because a
stored inflected form "inflates coverage and hides the fact that the pipeline
could not have derived it". That was right for a 31k-word lemma silver set and it
leaves every inflected word in running text to the derivation — which is where
the loss was. Over the 9,000 commonest words the pipeline and the silver
disagreed on 12.6% of tokens, and an independent silver set sided with the
silver about five times in six.

So the two concerns are separated instead of traded. The **package** stores the
word. The **metric** is protected by scoring every gold fixture with the tier
emptied (`scripts/lib/derivation.mjs`), so the fixtures go on measuring the
derivation and nothing else. `--withhold-gold` on the importer restores the
older rule.

### What it bought

Main (0.5.0) against this working tree, same scripts, same fixtures. The first
block is what a user gets; the second is the derivation alone, tier emptied.

| | main | now | command |
|---|---|---|---|
| words agreeing with the silver, in 2,000 held-out sentences | 79.8% | **94.6%** | `node scripts/eval-sentences.mjs` |
| …sentences agreeing in every word | 10.8% | **58.4%** | same |
| independent corpus (lyrics), by token — 450,860 | 69.3% | **79.4%** | `node scripts/eval-corpus.mjs` |
| independent corpus, by type | 39.3% | **55.8%** | same |
| held-out words the tier never saw (5,746), letters | 63.9% by token, 39.7% by type | **79.0% by token, 59.4% by type** | `node scripts/eval-heldout.mjs` |
| …of which built from a stem, not stored anywhere (5,289) | — | **75.0% by token, 56.6% by type** | same, `derived` row |
| stems from real data, by token | 88.7% | **97.8%** | `node scripts/eval.mjs --coverage` |
| sentences with no guessed stem | 26.4% | **76.7%** | `node scripts/eval.mjs --sentences` |
| reader rulings | 160/160 | **196/196** | `node scripts/eval-rulings.mjs` |
| gold, whole fixture (1,884) — tier emptied | 63.2% | **64.7%** | `node scripts/eval.mjs` |
| gold, detached half (1,611) — tier emptied | 73.7% | **75.5%** | same |
| verb gold (197) — tier emptied | 50.8% | **81.7%** | `pnpm status` |

The lyrics corpus is the row to trust most: it is an independent silver set's
output over different text, so it cannot be flattered by storing the
silver's own answers.

The gold rows moved for a different reason than the rest — the tier is switched
off there. They moved because the misses the silver set exposed were read for
rules: verb stems from the dictionary's infinitives, the agentive plural
-чид, a final -н that is the word's own and not a linking letter, -тай³ + г +
case, the dative of a Cyrillic -т chosen by the Classical stem, and an unknown
compound read as its two known words.

The last 1.2pp of the sentence row is not data either. It is the answers the
owner gave on two review pages built from this silver set (2026-10-02):
нэг is `nige`; a suffix after a number or an abbreviation is written as on
the word it stands for (`attached.ts`); -гүй takes its case on үгүй
(`clitics.ts`); a word the silver writes as two is stored as two (юмуу
`yum uu`); and possession is `qi` / `qin` after a genitive (албаныхан
`alban-u-qin`), a suffix the registry had and this table did not.

### Three things keep it in its place

1. **A whole word is asked first; as a stem it is asked last.** Attested rows
   include inflected words (яваа, хэлэн). Consulted early as stems they capture
   every longer word that starts with them — the failure that put `toli` last.
2. **It does not hold the verb gate shut as a stem.** Only a whole-word row is
   "settled"; an attested word pressed into service as a stem is not, so
   яваад still reaches the converb.
3. **The importer judges the rows twice.** The first pass decides each word
   with the tier EMPTY, or last run's rows would answer for themselves and the
   next run would drop them. But at runtime the tier is not empty, and a row
   used as a stem can take a longer word that was judged fine a moment ago:
   ингэ's row turned ингээд, which derived correctly, into ингэ + dative. So
   the accepted rows go live and every word left without one is asked again;
   where its answer moved, the judged reading is pinned. An independent review
   found this by reading output, not from a metric — eleven words, 53,766
   tokens.

### What is withheld, and why each

- **Every word a test asserts on**, unless the silver agrees with a
  reader's recorded answer for it. A test is a specification.
- **A 3% hash sample outside the 5,000 commonest words** —
  `test/fixtures/attested-heldout.json`. The only measurement of what the
  import does for a word it was not given.
- **Classes a reader has ruled on**, where the silver follows another
  convention systematically: the chachlag genitive, the plural after н
  (`-ud` against `-nuγud` — ⚠ one verdict against 660 silver forms,
  an open question for the reader), the reflexive after a linking нг. Ours is
  kept.
- **Connector-only differences.** MVS against a fused suffix is house style;
  where our own reading has the silver's letters, ours is kept.

⚠ "Never saw" is true of this tier and not of the package: one held-out word
in twelve (457) is a whole-word row in an OLDER tier. `eval-heldout.mjs`
prints them apart — `stored whole` against `derived` — and `derived` is the
number that speaks for the next unseen word.

### What it cost

`pnpm pack` goes from 488 kB to 1,254 kB. `dist/data/attested-forms.js` is
2.9 MB unpacked — the largest file in the package, ahead of `toli`.

Most of that is the rare end, and the rare end buys little. The same import at
four depths (`--min-freq`, occurrences in the 133M-token corpus), each rebuilt
and scored:

| `--min-freq` | rows | `pnpm pack` | words agreeing, sentences | sentences agreeing | lyrics, by token |
|---|---|---|---|---|---|
| 50 | 19,888 | 718 kB | 94.0% | 55.1% | 79.0% |
| 20 | 40,065 | 871 kB | 94.3% | 56.5% | 79.2% |
| 10 | 68,346 | 1,077 kB | 94.5% | 57.9% | 79.3% |
| 0 (shipped) | 92,550 | 1,254 kB | 94.6% | 58.4% | 79.4% |

Shipped at full depth because every band is still worth having — against an
independent silver set the stored row is right about twice as often as the
derivation it replaces, all the way down (the table is in the importer's
header). But the first 20,000 rows carry almost all of the gain, and a build
that cares about bytes loses 0.6pp of words for half a megabyte. That is the
owner's call, and it is one flag.

### What is still wrong, largest first

From `node scripts/eval-sentences.mjs --misses 75`, by weight in running text
— 1,490 words in 2,000 sentences still differ:

- **Abbreviations.** УИХ, НҮБ, ХХК. The silver spells one out by its
  letter names (ХХК as хэ-хэ-ка); we transliterate the letters as if they
  were a word (`qqkh`). A reader confirmed the letter names are right. What is
  not settled is how the syllables are joined in correct Unicode — the
  silver's own way is a Tungaamal device (ZWJ and a comma after each).
- **Bare тогтворгүй-н numerals.** нэг was ruled `nige` on 2026-10-02 and
  fixed. мянга, гурав, ам, нар are still curated with their н (`mingγan`,
  `aman`) where the silver has none. Only нэг was asked; тав is `tabun` by
  an earlier ruling.
- **Homographs.** хүнд is `qündü` "heavy" 81 times and `qümün-dü` "to a
  person" 70; гэрээ is `γer-e` "contract" 47 times and `γer-iyen` 12, and a test
  pins it to the second; аж and юу likewise. One answer per word cannot be
  right about both.
- **The ordinal after a number** (5-р, 27 дугаар) and the particles ч / л
  after a word the aligner pairs oddly.
- **The guesser**, as ever: 2.2% of running tokens, right 15% of the time on
  held-out words. Loanwords and names. One rule from the reader is not
  implemented yet: in a foreign word у, ү and ө are written with the shilbe
  (паул `paü1l`), о is not.

## ★ The toli tier (2026-08-10)

A dictionary app's bundled SQLite asset: ~52k single-word headwords whose
`tolgoi_ug_hudam_galig` column is already written in this project's own
romanization. That is what makes it importable — rendering the galig with our
`toScript` applies our conventions for free, while its own hudum column carries
its conventions (ᠮᠣᠩᠭᠣᠯ for монгол, the older V+y+i, the ᠶᠢ notation UTN #57
ruled against). **The hudum column is never read.**

`docs/rulings.md` previously recorded this source as "a conflict queue, not a
tier". Both are now true: it ships as the bottom tier, and the words where it
contradicts a reader still go to the reader.

### What it bought

Measured on the 1,611 held-out detached gold forms and 28,982 word tokens of
running text:

| | before | after |
|---|---|---|
| top-1 exact | 71.1% | **72.8%** |
| oracle (perfect stem) | 95.0% | **95.3%** |
| running text from real data | 87.0% | **91.5%** |
| running text on the **guesser** | 13.0% | **8.5%** |
| `check:orphans` | 1.50% | **1.35%** |
| reader rulings | 141/141 | 141/141 (+1 `it.todo` closed) |

The release spot check that followed took it further — to **73.7%** top-1,
**91.9%** coverage, 8.1% guesser and 152/152 rulings — but almost none of that
came from the tier. It came from two `stem.ts` bugs the reader's X group
exposed, in words whose stems were already correct in our data. See
"The toli-release spot check" in `docs/rulings.md`.

Per-tier top-1: `lexicon` 83.5%, `harvested` 78.0%, **`toli` 69.4%**, `guess`
7.5%. The tier is worse than everything above it and roughly **nine times**
better than the guesser it displaces. That gap is the entire case for it; do
not read 69.4% as an endorsement of the data.

### Three things keep it in its place, and all three are load-bearing

This was measured the hard way, in this order:

1. **Merged into `harvested` at the harvested prior — broke 7 reader rulings.**
   Not because its Classical forms are wrong: 45k new short stems invent
   *segmentations* that outrank the right ones. хэлэнд became `qeleng-dü`
   instead of `kele-dü`, because the source lists хэлэн as its own headword.
2. **Own tier at `TOLI_PRIOR`, but consulted where the harvested lookup is —
   still broke 6.** A prior cannot fix this. The lookup returns early, so
   `dropLinkingN` and the other restoration paths never run, and the competing
   reading is never *constructed* to be ranked.
3. **Last-resort placement — 5 left.** Then the derivable-headword filter at
   import (below) took it to 1, and the reader's four verdicts took it to 0.

The general lesson, and it recurred twice more the same day in `generate.ts`
and in the importer itself: **a weak tier's real damage is not the weight it
carries, it is the better paths it prevents from running.** Anywhere the
codebase branches on "do we already have a non-guess reading", `toli` must be
excluded by name.

### Import filters

`node scripts/import-toli.mjs --db PATH`. Of 53,609 source rows:

| dropped | n | why |
|---|---|---|
| outranked | 7,091 | already in `lexicon` or `harvested` |
| derivable | 3,288 | our own morphology already derives it from real data — аваа is ав+аа, хэлэн is хэл+н. **Not a stem.** |
| dirty | 630 | lints above info severity |
| held out | 283 | a surface form from **any** of the three fixtures, which must never become a stem |
| unromanizable | 48 | `toScript` rejects the galig |
| not Cyrillic | 10 | editorial notation (`бонс(оо)`), or Latin homoglyphs inside Cyrillic (`кепкa`, `хойшoo`) |
| **imported** | **41,638** | |

⚠ **This table is a re-run, not the shipped file.** It is what the importer
printed on 2026-08-10 against the build of that afternoon; the file actually
shipped says **41,640 entries, from 53,609 source rows** in its own header
(counted over **40,793 distinct Cyrillic keys**), and was generated a few
lexicon rows earlier. Re-running always
produces a slightly smaller file, because the tiers above it have grown in the
meantime and `outranked`/`derivable` claim the difference. Quote the file
header for what ships and this table for the shape of the filters.

An earlier version of this table read outranked 7,090 / derivable 3,286 /
dirty 585 / held out 246 / imported 41,678. **Superseded 2026-08-10** by the
holdout fix below, which is the only one of those deltas that was a bug.

⚠ The lemma gate that `import-harvest.mjs` applies is deliberately **not** used
here. Those lists total 12,691 words and the harvest already took all of them —
applying it keeps **17 rows**. The whole value of this source is the headwords
no lemma list has.

⚠ The derivable filter tests `lexicon`/`harvested` **by name**, not
`!== 'guess'`. The script imports from a build that already contains the
previous generation of its own output, so the loose test lets the tier judge
itself and each run shrinks the file (41,679 → 39,362 on the first repeat).

### ⚠ The shipped tier memorised part of the test set (found and fixed 2026-08-10)

**The first release of this tier leaked the holdout, and it leaked it into the
runtime rather than into a training run.** `import-toli.mjs` built `goldForms`
from `test/fixtures/harvested-inflected.json` **only**. There are three
fixtures. The shipped `src/data/toli-lexicon.ts` therefore carried **10
verb-gold surface forms as stems** — аж, давсан, дэнж, өнө, унадаг, ууж, хуурч,
цаана, шарж, эсвэл — plus six words `rulings.test.ts` asserts on.

What it cost, measured on the 197-form verb gold set:

| | with the leak | without |
|---|---|---|
| verb gold, pipeline top-1 | 53.3% | **51.9%** |
| forms answered by the `toli` tier | 7 | **1** |

Nearly the whole "the `toli` tier scores well on verbs" reading was the fixture
being read back to itself. Verify the fix by grepping the shipped file for
those ten words: all ten return zero, and `node scripts/eval-model.mjs --gold
test/fixtures/verb-gold.json` shows the `toli` row at n=1.

⚠ Neither 53.3% nor 51.9% is the current verb-gold figure — that pair is the
*leak measurement*, taken before/after one change with everything else held
still, which is the only way to attribute the difference to the leak. The
pipeline moved afterwards; the end-of-session reading is **50.8%**. Do not
carry the 51.9% forward as a current number.

**The lesson is not "check your holdout".** It is sharper than that, and it is
the second instance of the same sentence in this repo — `docs/neural-model.md`
records the first, in the training export, in almost the same words:

> **A holdout filter that has never rejected anything is not known to work.**

The noun gold set showed **zero** collisions with this source, which is why
nothing looked wrong. *The one fixture that was checked was the one with
nothing to find.* The gate now reads all three, scraping `rulings.test.ts` for
every Cyrillic run of length ≥2 exactly as `export-training-data.mjs` does.

**The fix cost nothing measurable.** The over-matching rulings scrape withholds
26 further rows out of 41,666 — it picks up suffix fragments like `ийн` out of
test prose — and the script records known-stem accuracy on the noun gold set as
identical to four decimal places either way (0.7360). Tier size went 41,678 →
41,640. That trade is worth stating plainly, because the narrow gate is always
the tempting one: **a few dozen extra headwords withheld costs nothing against
a 40k tier, and one leaked ruling silently corrupts the highest-authority
fixture in the suite.**

### Two traps in measuring this source

- **SQLite's `lower()` is ASCII-only.** Every headword is uppercase Cyrillic, so
  folding case in SQL yields keys that match nothing. The first measurement run
  reported 0 overlap with the curated lexicon and 51,429 novel headwords — a
  clean-looking result that was entirely an artifact. Fold in JS.
- **Normalization is not optional.** Raw galig scores 72.3% against 72.8%
  normalized, and on the rescued-from-guesser class specifically it is 49% vs
  66%. The galig is in our romanization but not in our orthography.

### Cost

Package: 208 kB → 488 kB packed, 1.7 MB → 2.9 MB unpacked. The generated file
stores one `cyrillic classical` pair per line in a single string rather than
41k object literals; the object form is a 2.9 MB source file on its own.
`biome.json` needed `files.maxSize` raised or the file is silently skipped
rather than checked.

## ★ Where the numbers stand, 2026-08-10 (end of session)

Every figure below was produced by running the command named beside it, against
the working tree of 2026-08-10 after `pnpm build`. Read the denominators; three
different scripts report "top-1" over the same fixture and two of them mean
different things (see the next section).

`node scripts/eval.mjs` — the historical number, and the one `docs/` quotes:

| block | n | top-1 | oracle |
|---|---|---|---|
| detached gold | 1,611 | **75.9%** (1,222) | 95.3% (1,536) |
| attached gold | 273 | **0.0%** (0) | 100.0% |
| whole fixture | 1,884 | **64.9%** (1,222) | — |

Detached breakdown: chain right / stem wrong **128** (7.9%), chain wrong 234
(14.5%), no segmented reading 27 (1.7%), unreachable 75 (4.7%). By tier:
`lexicon` 232/272 85.3%, `harvested` 945/1,142 82.7%, `toli` 36/47 76.6%,
`guess` 9/150 6.0%.

The session started at detached 73.7% by the same script, so the day is
**+2.2pp on the detached half**. The whole-fixture line moved the *other* way
for one turn while the output got better, which is the subject of the roadmap's
`-тай³` entry. Do not read the whole-fixture line alone.

⚠ **73.7% is an ambiguous figure in this repo and always needs its script
named.** It is both the session-start `eval.mjs` reading *and* the current
`candidates[0]` reading of the same 1,611 forms (1,188). Those are different
measurements that coincide. See the next section.

Everything else, each from its own command:

| | | command |
|---|---|---|
| reader rulings | **160/160** (10 `it.todo`, 1 incidentally passing) | `node scripts/eval-rulings.mjs` |
| test suite | 352 passed, 35 todo, 17 files | `pnpm test` |
| linter on generated output | 9,514 forms; 19 `unknown-suffix`, 29 `non-initial-o` info, **0 NNBSP** | `pnpm lint:output` |
| orphaned running text | **1.30%**, ceiling 2.5% | `pnpm check:orphans` |
| verb gold | **50.8%** (197 forms) | `pnpm status` |
| running-text coverage | 28,982 tokens, guesser share **8.6%** | `pnpm status --coverage` |

### ⚠ Two scripts say "top-1" about the same fixture and disagree by 34 forms

This is a live instance of the failure mode `docs/neural-model.md` §1e names —
a denominator (here, a *selection*) moved and the number kept its name — and it
is worth knowing before quoting either.

- `scripts/eval.mjs` scores
  `candidates.find(c => c.segmentation.suffixes.length > 0)` — the best
  **segmented** reading. On the 1,611 detached forms: **1,222 = 75.9%**.
- `scripts/eval-model.mjs` and `scripts/status.mjs` score `candidates[0]` — what
  the converter would actually **emit**. On the same 1,611: **1,188 = 73.7%**.

Both are honest and they answer different questions. eval.mjs is asking "can the
morphology get there", which is the right question when the subject is the
suffix table or the stem layer, and it is the definition every figure in `docs/`
and the CHANGELOG was measured under. eval-model.mjs is asking "what does a user
see", which is the right question when the subject is the model or a release.

The 34-form gap is words where a whole-word reading outranks a correct segmented
one. **Say which script produced a number.** Over the whole 1,884-form fixture
the same split reads 64.9% against 63.2%.

### ⚠ `pnpm status` silently drops the `toli` tier

`scripts/status.mjs` has `TIER_ORDER = ['lexicon', 'harvested', 'guess', 'none']`
and a `counts` object with the same four keys. `toli` is in neither, so its rows
are accumulated into a key that is never printed. Verified 2026-08-10:

- Gold table: the tier rows sum to 1,839 of 1,884; the 45 `toli` forms are
  missing from the breakdown while the `ALL` line still counts them.
- `--coverage`: the rows sum to 27,796 of 28,982 word tokens; **1,186 tokens
  (4.1%) vanish**, and the printed `REAL DATA 87.3%` understates the real
  figure, which is 91.4% (100% minus the 8.6% guesser share).

`eval.mjs` and `eval-model.mjs` both know about the tier — `eval-model.mjs`
deliberately crashes on an unknown provenance rather than scoring it as
something else. Quote those two for tier splits until `status.mjs` is fixed.

## ⚠ The gold set changed size on 2026-07-28 — numbers do not compare across it

`test/fixtures/harvested-inflected.json` went from **1,474 to 1,771 forms**.
Nothing was re-labelled: `attachDetachedSuffix` (see `docs/rulings.md`) turned
2,271 harvested rows from `stem<SPACE>suffix` into `stem<MVS>suffix`, and
`import-harvest.mjs` routes a row to gold when its Classical form carries a
suffix chain — which is decided by looking for a `-`. Those 297 rows were
inflected all along and were invisible to the test that sorts them.

So any figure quoted against "the gold set" before 2026-07-28 was measured on a
different, smaller set, and is not comparable to one measured after. Both are
honest; they are answers to different questions. Re-measure rather than
interpolating, and say which set a number came from.

**And again on 2026-07-29: 1,771 → 1,768.** Smaller cause, same warning. The
regeneration that carried `repairDevoicedGa` also finally applied the
already-curated filter to four rows that had been curated since before this
window — зүгээр, өөрийн and өөрөө left the inflected fixture, and массаж, өөр,
целлюлоз and цөөн left `harvested-lexicon.ts` (8,684 → 8,680). Nothing was lost;
the generated files had simply been stale against `lexicon.ts`. Figures dated
2026-07-28 and 2026-07-29 below were measured on the 1,771-form set.

**And a third time on 2026-07-31: 1,768 → 1,884.** Withdrawing
`repairDevoicedGa` (rulebook §2.1.2.3 — see `docs/rulings.md`) restored the
harvest's own ХА spellings, and 368 rows that the repair had been pushing into
round-trip or lint failure now import cleanly: `harvested-lexicon.ts` went
**8,680 → 9,048** and the inflected fixture **1,768 → 1,884**. Every figure
below dated before 2026-07-31 was measured on a smaller set.

Current, 2026-07-31, on the 1,884-form set: **1,083 / 1,884 = 57.5%**, against
**1,010 / 1,884 = 53.6%** for the same fixture scored on pre-session code.

The verb gold set is fixed at 197 forms and *is* comparable: the revert took it
**46.2% → 47.2%**, with the harvested tier 91.5% → 93.9% — which is the same
47.2% it read before the repair landed, so the repair's cost is now measured
rather than argued. The guesser's bare-final-consonant fix then took it to
**47.7%** (94/197), and the inflected set 1,081 → 1,083.

### The gold sets systematically under-report guesser fixes

Worth knowing before optimising against them. The bare-final-consonant fix
changed **647 corpus words, 1.6% of running text**, and moved the two gold sets
by one form each. That is not a contradiction — both fixtures are built from the
harvest, which is a **lemma dictionary**, so a word whose dictionary form the
harvest carries is a lexicon hit and never reaches the guesser at all. The gold
sets can only see a guesser fix on the residue.

The corpus is the honest denominator for anything touching `guessStem`. Count
there first, and treat a flat gold reading as "invisible to this fixture" rather
than "no effect" — the same selection bias that produced the verb hole, one
level down again.

### ★ Token-weighted accuracy against running text (2026-07-31)

`scripts/eval-corpus.mjs` closes the hole above. It scores every word type in a
**79,071-line Cyrillic|bichig parallel corpus** and weights each by how often it
actually occurs, so a fix to a common word moves the number and a fix to a rare
one does not pretend to.

The corpus is `lyrics.txt.gz` from `tugstugi/mongolian-nlp` — 451k tokens over
49k types, converted by Inner Mongolia University's online tool. Verified on
import: **pure Unicode, zero PUA**, 726k code points in U+1800–18AF. It is the
first parallel Cyrillic↔bichig data this project has had.

⚠ **It is silver, the same trust tier as `harvested`.** It follows Inner
Mongolian convention, predates the 2026 rulebook, and it is song lyrics, so the
genre skew is severe (минь occurs 10,437 times). A disagreement is a *question*
ranked by how much running text it is worth — never an error. Two differences
are deliberate on our side and are folded away before scoring, or they drown
everything else: the NNBSP/MVS connector, and the V+y+i diphthong we rejected
per UTN #57 — that one alone is 808 types and 6.26% of running text.

Baseline at 0.3.0, then after the three letter-map fixes below:

| tier | type | token | share of running text |
|---|---|---|---|
| `lexicon` | 54.9% | 80.5% | 25.0% |
| `harvested` | 68.1% | 76.7% | 49.2% |
| `guess` | 8.0% → **10.9%** | 14.1% → **17.3%** | 25.8% |
| **overall** | 30.8% → **32.6%** | 61.5% → **62.3%** | — |

**Read the last row of the table, not the last column.** A quarter of all
running text goes through the guesser and it is wrong ~83% of the time. That is
where the loss is, and it is not visible in any type-list fixture.

Note the type/token divergence is enormous — 32.6% against 62.3%. Report both,
always, and say which population a claim is about. They can rank two systems
differently on the same data.

### ⚠ The inflected fixture was contaminated by the repair; the verb fixture was not

Scoring both builds on the **identical** pre-revert 1,768-form fixture reads
**HEAD 1012/1768 (57.2%) → now 1010/1768 (57.1%)**, i.e. two words *lost*. Both
are artefacts, not regressions:

| word | fixture wants | we now emit |
|---|---|---|
| гүтгэлгийн | `γüdγelγe-yin` (ГА) | ХА |
| сэтгэлийн | `sedγil-ün` (ГА) | ХА |

The fixture is regenerated by `import-harvest.mjs`, so when the repair ran, the
repair's output became the *answer key* — сэтгэл, the rulebook's own worked
example for ХА, was recorded as taking ГА. A metric generated by the pipeline it
grades cannot see that pipeline's systematic errors. Scored on the regenerated
fixture the same words are correct.

`verb-gold.json` is built by a different script, never picked the repair up, and
contains **zero** answers with ГА after a д/с дэвсгэр — so it is the trustworthy
comparable set here. Its two gained words are **гүйцэтгэсэн** and **цутгаж**,
which the 2026-07-29 session had written off in this very file's neighbourhood as
"the verb gold is now stale in three places". The fixture was right and the
repair was wrong; the staleness was ours.

**Rule of thumb this earns:** when a fixture is generated by the code under test,
a change that improves the code will *appear* as a regression for exactly as long
as the fixture is stale. Regenerate, then compare — and prefer the fixture the
pipeline did not write.

Pipeline-only, on the 1,771-form set, 2026-07-28: lexicon 66.9%, harvested
65.2%, guess 0.0%, **all 55.3%**.

The verb gold set (`test/fixtures/verb-gold.json`, 197 forms) did not change
size, so it *is* comparable across the same edit: pipeline **8.6% → 36.5%**,
from the imperfective-converb and present-future rows plus the restored verb
stem vowel.

### The perfective converb, 2026-07-29: 37.1% → 42.6%

> Superseded the same day: the linking vowel on the present-future and
> past-participle rows took verb gold to **47.2%**. See docs/rulings.md.

Adding the `-аад/-ээд` rows and the linking vowel took the verb gold set to
**42.6%** overall, entirely from one group — converb-perfective **4.0% →
48.0%** — with every other group's score byte-identical, and the noun gold set
(1,771 forms, 55.6%) and `eval.mjs` (66.4% top-1, 94.7% oracle) unmoved. The
rows only fire on the verb fallback path, so that isolation is expected and is
the reason to trust the delta.

⚠ **This particular delta is not a clean held-out measurement.** `verb-gold.json`
is carved out of `.tmp/aligned-words.jsonl` and every one of its 197 forms is
still in that file, so the mining run that produced these rows saw the eval set.
`scripts/mine-verb-suffixes.mjs` now excludes them by default and the shares
hold up when it does (`γad`/`γed` still dominant, `uγad`/`üγed` still the
consonant-final variant) — which argues the rows are right, not that 42.6% is
an out-of-sample number. `scripts/export-training-data.mjs` had this guard from
the start; the miner did not.

Slightly **less** than half of that came from the rows: 4.0% → 24.0% with the
rows alone, then 24.0% → 48.0% once `ab` + `γad` became `abuγad`. So the linking
vowel is the larger of the two halves, +24pp against +20pp — worth knowing,
because the rows are the part that was blocked on evidence and the linking vowel
is the part that is one flag. Re-derive both with `pnpm build && pnpm status`
after deleting the four rows, then after deleting their `linking`.

| group | n | pipeline |
|---|---|---|
| converb-imperfective | 58 | 46.6% |
| participle-past | 46 | 34.8% |
| participle-habitual | 28 | 46.4% |
| present-future | 27 | 44.4% |
| converb-perfective | 25 | 48.0% |
| past-or-nominal | 8 | 25.0% |
| converb-conditional | 4 | 50.0% |
| converb-terminative | 1 | 0.0% |

**Where the rest of the verb loss is, measured 2026-07-29.** 100 of the 197
forms still resolve at the `guess` tier and score 3.0%, against 81.3% (lexicon)
and 84.0% (harvested) where the stem is known. 97 of those 100 are wrong, and
`pnpm status` splits them by cause — which is what should drive the next task:

- **80 never segment at all** — the suffix row exists and the *stem* does not
  (автсан needs автах, амьдарсан needs амьдрах, залардаг needs залрах). These
  are not a rules problem; they fire the moment the stem exists.
- **17 segment but wrong** — mostly `-лаа/-лээ`, which is still deliberately
  unrowed because its two readings are not distinguishable from the surface.

So the verb table is no longer the binding constraint on verb accuracy; the
**stem inventory** is. That is what makes the deferred lemma import live — see
`docs/roadmap.md`.

## Accuracy, and where the loss is (measured 2026-07-26)

`node scripts/eval.mjs [--coverage]` scores the pipeline. Two metrics, and
**they move in opposite directions — read the warning below before quoting
either.**

**1. Coverage** — share of word tokens in real running text whose stem came
from real data rather than the guesser. This is the metric that tracks
progress:

| | 2nd harvest | + allomorphs | + unstable vowel | + suffix order |
|---|---|---|---|---|
| real data (lexicon + harvested) | 63.8% | 70.1% | 74.0% | **73.2%** |
| guessed | 36.2% | 29.9% | 26.0% | **26.8%** |

> The last column is the one time coverage **falling** was the fix. The
> suffix-order rule (2026-07-27) stopped the segmenter offering
> reflexive-then-case chains, which Khalkha cannot form. Those parses had been
> resolving to real dictionary stems, so they counted as covered — 0.8pp of the
> old 74.0% was measuring a lie. Top-1 and oracle did not move at all.

**2. Top-1 against held-out gold** — 1,203 inflected forms in
`test/fixtures/harvested-inflected.json`, the harvest's own answers, kept out of the
lexicon so nothing can be answered from memory.

| | |
|---|---|
| top-1 exact | **65.7%** (was 50.9% before the allomorph + unstable-vowel work) |
| oracle — same test, given a perfect stem | **94.7%** |

| Tier | top-1 | n |
|---|---|---|
| `lexicon` | 79.3% | 150 |
| `harvested` | 84.2% | 784 |
| `guess` | **4.1%** | 269 |

> ⚠ **Top-1 is not comparable across harvests.** Every harvest grows the
> lexicon *and* the gold set together, and the forms it adds are the harder
> ones. The 2026-07-26 harvest added 4,124 stems; top-1 went 52.5% → 50.9%
> while coverage went 63.8% → 70.1%. Re-scored against the *pinned* old gold
> set it was 52.5% → 52.5% — flat, because those gold forms were inflections
> of stems that were already known. **Quote coverage for progress; use top-1
> only within a fixed gold set.** `test/inflected.test.ts` keeps a slack floor
> for this reason.

**3. Per sentence** — `node scripts/eval.mjs --sentences`, same 3,000-sentence
corpus as coverage, median length 9 words. **Quote this one whenever anyone asks
whether the converter can handle arbitrary text**, because every other number
here is per word and accuracy multiplies:

| | |
|---|---|
| sentences where every stem came from real data (**ceiling**) | **7.4%** |
| estimated fully-correct sentences | **~2.3%** |
| sentences with 3+ guessed stems | 45.9% |

The ceiling is a measurement — a guessed stem is right 4.1% of the time, so a
sentence containing one is ~certainly wrong, and 92% of real sentences contain
at least one. The estimate multiplies per-tier top-1 across a sentence's tokens
and so assumes independence, which is optimistic; treat the gap between the two
rows as modelling risk, and both as upper bounds.

> ⚠ **Quote the ceiling, not the estimate.** The estimate has now moved the
> *wrong way* twice — down, while top-1 and coverage both rose — because it
> multiplies **per-tier** rates, and every improvement pulls hard words out of
> `guess` into the real tiers, dragging those tiers' averages down. It measures
> tier composition as much as quality. The ceiling has no such coupling.

**This does not indict the architecture — it indicts the data.** Raising the
same numbers to the ninth power:

| per word | → 9-word sentence | |
|---|---|---|
| 65.7% | 2.3% | today |
| 84.2% | 21.3% | if every stem resolved at harvested-tier quality |
| 94.7% | **61.3%** | oracle — a perfect stem for every word |
| 97.6% | 80.0% | what unattended conversion would actually need |

The oracle row is the one that matters: with a perfect dictionary and **no code
changes at all**, 61% of sentences would come out exactly right. But 80% needs
97.6% per word, which is *above* the current oracle — so closing the data gap
buys a good assistive tool, not an unattended converter. The rest is the
categorical holes (verbs, bare `-н`/`-г`, clitics, FVS/loanwords), which are
missing features rather than tuning.

Caveat on all of it: "correct" means agreeing with the silver, not
with a bichig reader. The true figure is unknown and probably lower.

**Read this before optimising anything.** A known stem converts correctly ~84%
of the time; an unknown one is right ~4%, and 26% of running-text tokens still
fall to the guesser. The segmenter, suffix table and generator are not the
bottleneck — they reach 94.7% when handed a correct stem. **Getting a real stem
is the only lever that matters** — either by harvesting more words, or by
recognising a stem the Cyrillic has disguised (see the unstable vowel below).

`SUFFIX_PENALTY` was swept 0.7 → 0.3 on 2026-07-26: 0.7 and 0.6 tie and
everything lower is worse, so 0.7 stays. Over-segmentation (хэвтэрт →
`qeb-tü-ber-tü`) is not a ranking-tuning problem; it happens when the real stem
is absent from every dictionary and a short known stem plus three suffixes is
genuinely the best available reading.

### Bare `-н` / `-г`: measured, and only half of it shipped (2026-07-27)

The long-standing open decision, settled with numbers. **Method matters here**:
the held-out gold set is 1,203 *inflected noun forms* — precisely the
population these rows help — so it cannot be trusted alone. Every variant was
also scored over the corpus against the silver, counting words
that moved **toward** its answer versus **away**.

| variant | changed | better | worse | net | top-1 | oracle |
|---|---|---|---|---|---|---|
| baseline | — | — | — | — | 65.7% | 94.7% |
| bare `-г` | 224 | 20 | 8 | +12 | 66.5% | 95.6% |
| bare `-н` | 367 | 11 | 9 | +2 | 66.0% | 94.7% |
| `ны`/`ний` → `yin` | 99 | 0 | 1 | −1 | 66.0% | 95.1% |
| `-г` + guard *all* verb endings | 177 | 20 | 20 | 0 | 66.4% | 95.5% |
| **`-г` + guard habitual only** | **100** | **20** | **4** | **+16** | **66.5%** | **95.6%** |

Shipped the last row. Note the gold set rated the full stack at +1.5pp top-1
while the corpus said 31 better / 18 worse — **the gold set would have approved
a net regression.** Any future suffix-table change gets scored both ways.

**Bare `-н` is rejected, and not because it over-matches.** It moves oracle not
at all (94.7% → 94.7%): it unlocks no unreachable form, it only re-ranks. It
breaks numerals (долоон → `doluγ-a-yin`, найман → `nay1ma-yin`) and the whole
hidden-n class (усан → `usu-yin`, should be `usun`).

The reason, from a Mongolian speaker: **Cyrillic `-н` is at least two
suffixes.** One is the genitive contracted after a vowel-final stem (далайн =
далай + н). The other derives an adjective from a noun — ус → усан — and is the
Classical unstable `-n` resurfacing, which fuses rather than detaching. The
dictionary already separates them cleanly: усан, тэмээн, долоон, найман, мөнгөн
are all present **as whole words**, while далайн and тухайн are not.

So bare `-н` was never a segmentation problem — it is a **ranking** one. усан
was already correct; the new row let `ус` + `н` (curated stem, prior 1.0 × 0.7)
outscore the whole-word `усан` (harvested, prior 0.5). That is the open ranking
item in `docs/roadmap.md`, now with a concrete reproduction.

Its prerequisite — marking `hiddenN` — **landed 2026-08-06**, and not by the
mechanical derivation guessed at here ("Classical ends `-n`, Cyrillic does
not"), which only ever recovers rows that already spell the н. What actually
supplies the missing ~30,000 answers is the reader's finding-rule: *a stem whose
script form ends in a vowel takes the н*, used as the default behind the flag.
See `docs/rulings.md`. The ranking item itself is still open.

### Half the coverage gap is verbs, not missing nouns (2026-07-27)

The most important thing measured this session, because it reprices the
roadmap. Tagging every running-text token by Khalkha verb ending:

| | |
|---|---|
| tokens carrying a verb ending | **24.8%** |
| of the guesser's output, verb-shaped | **48.5%** |

So **a noun lemma source can close at most half the remaining gap.** Roadmap
item 3 ("a new lemma source", the only lever left on coverage) was written
before this was measured and is now known to be a half-measure — the other half
needs verb morphology, which the suffix table excludes by design.

Second finding, the reason the numbers looked better than they were: **the
harvest memorised inflected verb forms as whole dictionary rows.** байсан,
ирсэн, гэдэг, байна all convert correctly — not by analysis but because the
whole form is in `harvested-lexicon.ts`. That is genuinely useful and should not
be undone, but it means verb coverage is lookup-shaped: it works for frequent
forms and collapses entirely on the tail, which is exactly what the 48.5% is.

`verb.ts` recognises the endings and `AnalyzedToken.verbForm` reports them. It
converts nothing — the point is to distinguish "unknown noun, fixable with a
dictionary row" from "verb form, structurally out of scope". Read it with the
winner's `provenance`; verb-shaped + `guess` is ~13% of running-text tokens and
is where the converter is most likely to be silently wrong.

It is a **spelling test, not a parse**. Measured noun-collision rate per ending
(does stripping it leave a known stem?) runs 0–12%, worst for `-ж/-ч` and
`-тал`. Real part-of-speech tagging needs a POS lexicon this project lacks.

### The unstable vowel (biggest single win so far)

Cyrillic drops a stem's final unstable vowel before a vowel-initial suffix:
ажил + аас is written **ажлаас**, мэргэжил + ийн is **мэргэжлийн**, учир + аас
is **учраас**. Peeling the suffix leaves ажл / мэргэжл / учр, which match
nothing, so the whole word fell through to the guesser.

`restoreUnstableVowel` in `stem.ts` runs only after both dictionaries miss: it
proposes every vowel in the gap and keeps **only forms the lexicon actually
knows**, so nothing is invented. The vowel is not predictable (ажил takes и,
хамаг takes а, мөрөөдөл takes ө) — which is exactly why it proposes and filters
rather than deriving. Worth +11pp top-1 on its own, and a bichig reader ruled
all eight sampled cases in our favour afterwards.

Corollary: the ranker and any context model are premature. There is no point
choosing better between candidates while a third of them are invented.

### The remaining reachability gaps

**Mostly closed 2026-07-26.** The contracted Cyrillic allomorphs after an и/й-final
stem (анги + ийн → ангийн, анги + аар → ангиар, морьтой + аа → морьтойгоо) were
the single hole behind ~84% of unreachable forms. Adding them as extra *surface*
pairings — same Classical suffix, all pinned to `after: 'vowel'` — moved, on the
identical gold set and lexicon:

| | before | after |
|---|---|---|
| oracle (perfect stem) | 88.7% | **94.7%** |
| unreachable | 136 | **64** |
| top-1 | 50.9% | **54.6%** |

Over the whole sentence corpus the change touched **142 of 7,823 distinct words
(1.8%)**, essentially all of them guesser-garbage becoming real segmented forms
(`kögǰmiyn` → `qöγǰimi-yin`). Short surfaces like `ар`/`ас` do not shred ordinary
words because `after: 'vowel'` is checked against the resolved *Classical* stem
and `MIN_STEM_LENGTH` drops the rest (сар → с is too short).

What is left of the 64: **24 are FVS/loanword rows we cannot emit at all**, and
the largest remaining group needs **bare genitive `-н` / accusative `-г`**
(авгалдайн, далайн, гуайг), which were omitted *deliberately* for over-matching.
That decision is now measurable rather than a guess — but it is the user's call,
not a mechanical one. Also outstanding: the `-нх-` possessive stack (ангийнхаа =
`ang-un-iyan`).

Known pre-existing misparse, NOT caused by the allomorphs: the converb `-аад/
-ээд/-оод` (тэгээд, хийлгээд, оноогоод) is read as reflexive + dative, because
verb morphology is out of the suffix table entirely. It was wrong before the
change too — only the shape of the wrong answer moved.

`src/data/suffixes.ts` — Classical forms are sound; the Cyrillic pairings were
this project's own work and the **case-suffix `separate` flags were confirmed
correct** by a bichig reader on 2026-07-26 (the plural had been wrong the same
way, which is why they were suspect). Rows also carry `after`, the condition on
the **Classical** stem — Cyrillic хот is consonant-final but Classical `qota` is
not, so хотын is `qota-yin`.

**CoPiT is a dead end** (arXiv 2607.05849): the only repo URL returns HTTP 410
`repository_expired`, nothing on GitHub/HF/Wayback, and the CC BY 4.0 is the
*paper* licence, not a data licence. Emailing `burtebay@korea.ac.kr` was the
remaining action and has NOT been done.

## Homograph discovery (works, unused so far)

Running 4,000 news sentences through the silver and asking whether each word's **solo**
rendering survives in context found 59 context-dependent words with no seed list.
The discriminator is the shift rate: 0% = unambiguous, 100% = systematic
difference (the silver just has another default in running text), **in between =
genuine homograph**. Found this way: нар (sun / human plural), ард (behind /
people), хүнд (heavy / to-a-person), ч (you / concessive particle), сая (million /
just-now), юу (what / question particle), хар.

This **detects, it does not extract** — it says which words carry a second
reading, not what it is, because the silver maps one Cyrillic word to a variable
number of bichig tokens and word alignment is unreliable.

**The өөр finding, which reframes disambiguation generally:** the ambiguity is
mostly *morphological*, not contextual. All 158 inflected occurrences (өөрийн,
өөрөө, өөрийгөө, өөрсдөө…) are "self" `öber` — zero exceptions. Only bare өөр is
ambiguous, 59 "different" `öger-e` to 7 "self". So a segmenter that knows the
reflexive paradigm resolves ~70% of occurrences outright, the frequency prior
gets bare өөр right ~89%, and only ~7 in 248 need real context. **Teach the
segmenter the reflexive paradigm before touching ranking.** Where the two
readings share no substring, the silver's choice across the 4,000 sentences is
labelled training data for the `Ranker` seam.

## ★ Benchmark: a two-silver consensus set (2026-07-31)

`scripts/benchmark.mjs`. The first number in this project that can sit beside a
published one, because it uses the literature's metrics (WER, CER) on a set
that is not circular.

**The construction.** There is no large true-gold set, and `harvested-lexicon.ts`
**is** the silver's answers — so scoring against the silver is circular wherever
the harvested tier fires. Two independent converters are now available:
The silver via the held-out `harvested-inflected.json`, and Inner Mongolia
University via the parallel corpus. Their intersection is **684 word types that
both answer and our lexicon does not contain.**

They agree with each other on **604 of 684 (88.3%)**. That consensus is the
benchmark set — 17,371 corpus tokens. The 80 contested types are excluded
because neither silver set is trustworthy there.

| system | types | WER | CER | token-WER |
|---|---|---|---|---|
| ours — consensus set, all | 604 | 22.02% | 5.40% | 21.51% |
| ours — where a lexicon tier fired | 536 | **13.62%** | **3.27%** | 10.88% |
| ours — where the guesser fired | 68 | **88.24%** | 23.29% | 91.41% |
| model v3 alone — all | 604 | 21.52% | 4.67% | 19.80% |
| model v3 — where the guesser fired | 68 | **29.41%** | 7.05% | 21.72% |
| **hybrid — model only on the guessed slice** | 604 | **15.40%** | **3.67%** | **12.31%** |
| *Transformer, Na et al. 2022* | *5,232* | *16.92%* | *3.15%* | *—* |
| *joint-sequence n-gram, same paper* | *5,232* | *22.63%* | *4.20%* | *—* |

**Read this carefully — it is indicative, not a head-to-head.** The published
rows are a different test set (58k dictionary headwords, random split) and a
different population (citation forms, not inflected forms in running text).
Nothing here licenses "we beat the Transformer" — and that applies to the hybrid
row too, whose 15.40% is *not* a win over the published 16.92%.

What it does support: **where we have data we are competitive with published
neural work** (13.62% WER / 3.27% CER against 16.92% / 3.15%), and **where we
guess we are catastrophic** (88.24%). The overall 22.02% sits almost exactly on
the pre-neural joint-n-gram baseline. The guesser is the entire gap, and that is
the same conclusion the tier slice reaches from the other direction.

### The model rows, and why they are a fair test (2026-07-31)

Run with `--dump-words` and `--model`; predictions come from `training/convert.py`
against `model-v3/model.pt`. Three things make the comparison legitimate, and one
does not:

- **No leak.** The benchmark set is drawn from `harvested-inflected.json`, and
  `export-training-data.mjs` removes all 1,768 of those keys from train and val
  *by Cyrillic surface form*, asserting no leak before writing. The model has
  never seen these 604 words.
- **Same handicap.** It has seen their *stems*, in other inflected forms — which
  is exactly the pipeline's position, so neither side is advantaged.
- **Same slice.** Both model rows are scored on the types the *pipeline* routes,
  so each sits directly under the row it is meant to be read against.
- ⚠ **Not controlled for:** the model's training targets are the harvest, which
  is the silver's output, and half of this silver set is the silver. It was trained
  to imitate the convention it is being graded on. The pipeline's harvested tier
  has the identical advantage — the two are comparable **to each other**, and
  neither number transfers to a reader-gold set.

**The finding is the guessed slice: 88.24% WER → 29.41%.** That is the same
result `neural-model.md` measured on gold (0.0% → 42.1%), reproduced on an
independent set with the literature's metrics, and it is now the third
measurement pointing at one conclusion.

**The hybrid is the number to carry forward: 22.02% → 15.40% WER**, a 30%
relative reduction, and token-WER 21.51% → 12.31% because the guessed slice is
frequency-heavy. Note what produces it — the model alone is only 21.52%, barely
better than the pipeline. Neither component is close to the combination. The
dictionaries win on data-backed types and the model wins on the guessed ones,
which is precisely the arrangement `neural-model.md` specified, and it is worth
more than either side's headline.

⚠ **Nothing here changes what ships.** Ruled 2026-07-30: the model is never in
the npm package. These rows measure a server-side tier, not
`@gege-mn/gege-converter`.

### ★ The two evaluation sets rank the model and the pipeline oppositely

This is the most important thing in this section, because it is the kind of
disagreement that gets resolved by whichever number someone looked at first.

On the **data-backed slice** — the types where a dictionary tier fires, which is
where the "should the model be promoted above the dictionaries?" question lives:

| set | silver | pipeline | model v3 |
|---|---|---|---|
| benchmark consensus, 536 types | silver A ∩ IMU, folded | **13.62% WER** | 19.96% WER |
| gold `harvested`, 1,355 forms | The silver, exact | 64.6% correct | **71.4% correct** |

**The pipeline wins by 6.3 points on one and loses by 6.8 on the other.** Same
model, same pipeline, same day.

They are not measuring the same thing, and the differences all push the same way:

- **Population.** The benchmark keeps only types where two independent
  converters agree — conventional, unambiguous words, which is exactly what a
  dictionary is best at. Gold keeps the contested ones too.
- **Folding.** The benchmark folds MVS/FVS/space and ᠶᠢ on both sides; gold
  compares exactly. Connector errors are free in one and fatal in the other.
- **Size.** 536 types against 1,355 forms, and the benchmark's is the narrower
  population by construction.

**So `neural-model.md` item 2 — "revisit where the model sits" — is not settled,
and the gold-set reading of it is not sufficient grounds to act.** Its own
instruction was "do not change this without measuring"; this is what measuring
produced. A promotion would need a set that is neither silver set-derived nor
restricted to types two converters agree on, which is to say a reader set.

What both sets *do* agree on, unambiguously, is the guessed slice: pipeline
7.5% correct against the model's 60.8% on gold, 88.24% WER against 29.41% on the
benchmark. **The hybrid is safe because that agreement is the only thing it
depends on.**

⚠ **Consensus is not truth.** Both silver sets follow Inner Mongolian convention
and predate the 2026 rulebook, so they can agree and both be wrong — and they
agree most confidently exactly where a shared convention differs from ours.
Upper bound on divergence, not a certificate.

### The dominant error class, now visible

Two shapes account for most of the consensus misses:

1. **The elided stem vowel before a suffix.** зүрхний ᠵᠦᠷᠬᠨ᠎ᠦ vs ᠵᠢᠷᠦᠬᠡᠨ᠎ᠦ, анхны
   ᠠᠩᠬᠨ᠎ᠤ vs ᠠᠩᠬᠠᠨ᠎ᠤ, нарны ᠨᠠᠷᠨ᠎ᠤ vs ᠨᠠᠷᠠᠨ᠎ᠤ, дууны ᠳᠤᠨ᠎ᠤ vs ᠳᠠᠭᠤᠨ᠎ᠤ, тэдний
   ᠲᠡᠳᠨ᠎ᠦ vs ᠲᠡᠳᠡᠨ᠎ᠦ. Classical keeps a vowel that Cyrillic drops, and the
   guesser has no way to know where.
2. **Over-segmentation.** дандаа → ᠳᠠᠩ᠎ᠳᠤ᠎ᠪᠠᠨ (three pieces) for ᠳᠠᠩᠳᠠ; ганцаар →
   ᠭᠠᠭᠴᠠ᠎ᠪᠠᠷ for ᠭᠠᠭᠴᠠᠭᠠᠷ; алдаа → ᠠᠯᠳᠠ᠎ᠪᠠᠨ for ᠠᠯᠳᠠᠭ᠎ᠠ. The ranker peels
   suffixes off words that are single stems — `-аа` read as reflexive, `-тэй`
   as comitative.

### ⚠ The invisible-character rule earned its keep

The first run of this benchmark reported that the two silver sets agree **10%**
of the time. They agree 88%. The cause was a regex character class written with
the connector characters **typed as literals** instead of `\uXXXX` escapes —
retyping it in an edit silently dropped U+202F, so NNBSP survived folding on one
side and MVS did not on the other, and almost every pair mismatched.

It produced a plausible, quotable, completely wrong headline. This is precisely
what CLAUDE.md's escape rule is for, and the rule was violated in a *script*
rather than in `src/`, where the `grep -rlP` guard does not look.
