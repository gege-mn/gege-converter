# Architecture

<!-- Background doc. CLAUDE.md points here; it is NOT loaded into context
automatically. Read it before touching the pipeline or the data layout. -->

Read this before changing a pipeline stage, `romanize.ts`, or the data files.

## The pipeline

Only stage 7 (ranking) is statistical — a frequency number per lexicon row,
behind the `Ranker` interface, which is the one seam where a context n-gram or
a model could later plug in. **Stages 1–6 and 8 never change.**

`analyze()` is the real entry point and returns ranked `Candidate[]` per word;
`convert()` is a thin wrapper taking the top pick. Ambiguity is **data**, not
a failure — the UI surfaces alternatives, mirroring gege-linter's
diagnostics-with-fixes model.

| # | Stage | File |
|---|-------|------|
| 1 | Tokenize | `tokenize.ts` |
| 2 | Normalize Cyrillic | `normalize.ts` |
| 3 | Segment stem + suffix chain, all parses | `segment.ts` |
| 4 | Resolve stem (lexicon, else flagged guess) | `stem.ts` |
| 5–6 | Generate + assemble candidates | `generate.ts` |
| 7 | Rank | `rank.ts` |
| 8 | Validate (injected `validate` hook) | consumer |

Stage 8 is a **hook, not an import** — that is what keeps the core
free of the linter while letting consumers wire in its `lint`.

### Where each tier is asked (stage 4), and why the order is the design

`resolveStem(cyrillic, innermost)` is called once per segmentation, and
`innermost === undefined` means "nothing was peeled — this is the whole word".
The tiers are not one lookup with five priors; each is asked at a different
*point*, and moving one changes which readings are ever built:

| # | Asked | Tier | Claim |
|---|---|---|---|
| 1 | always, first | `lexicon` | a reviewed row; short-circuits everything |
| 2 | **whole word only** | `attested` | "this exact word is spelled so" |
| 3 | any stem | `harvested` | "this is a stem" |
| 4 | after 3 misses | restorations — unstable vowel, agent plural, linking н/г, soft sign | a letter Cyrillic moved or inserted; attested forms only. The linking н only under a peeled suffix: on a whole word a final -н is the word's own |
| 5 | last resort, as a stem | `attested` | "the silver spells this word so; maybe the rest is a suffix" |
| 6 | last resort | `toli` | a dictionary headword |
| 7 | nothing else | `guess` | invented — first as two attested words written together (`guessCompound`, ганболд), then letter by letter |

`attested` appears twice on purpose. As a whole word it outranks every
derivation, because a row exists only where the derivation was wrong. As a stem
it is the same kind of weak claim `toli` is — an attested row can be an
inflected word (яваа, хэлэн) — so it sits beside `toli`, after every path that
works from a real stem, and it does not hold the verb gate in `generate.ts`
shut. `test/attested.test.ts` pins both placements with the two words that
broke the `toli` tier when it was asked early.

### Three stages fix the word boundary before anything else runs

Cyrillic and bichig disagree about where a word ends, in both directions, so
`analyze` rewrites the token stream first: `clitics.ts` cuts мэдэхгүй and
монголруу in two (and төлбөргүйгээр into host + үгүйгээр); `particles.ts`
joins "бодож ч" with MVS; `attached.ts` does the same for an ending Cyrillic
hangs on a hyphen after a number or an abbreviation (2020-ны), choosing the
allomorph from how the number is read. A fourth case needs no stage: an
`attested` row may itself be two words (юмуу `yum uu`), and a whole-word row
stops `clitics.ts` from splitting the word first.

### Two kinds of condition on a suffix row

`after` is checked against the **Classical** stem, in stage 5, once the stem is
resolved: Cyrillic хот is consonant-final and Classical `qota` is not.
`afterCyrillic` is checked against the **Cyrillic** stem, in stage 3, while
peeling. It exists for one surface, Cyrillic -т, where the spelling itself says
which suffix it is — the dative is written -т only after a hard final, so after
a vowel or л/м/н a -т is the adjective-forming one. A condition belongs to
whichever side actually carries the information; do not move one to the other
stage to save a field.

### A second thing in the package: `tungaamal.ts`

Bichig → bichig, not a pipeline stage. It imports the shared script data and
its own table (`data/tungaamal-rules.ts`) and nothing from the eight stages, so
it can be lifted into a library of its own. It is here because the importers
need it: silver data is in the Tungaamal convention, and
`scripts/lib/silver.mjs` is the one place that decides how a silver row is
normalised. `docs/tungaamal.md` has the model and the proof.

### The romanization layer

`romanize.ts` is the keystone. All data files write Classical forms in
romanization (`qar-a`, `mongγol`) rather than bichig literals, because
romanization is auditable by eye and diffs readably. `toScript()` throws on
anything outside the Hudum alphabet, and `test/data.test.ts` runs it over
every data row — so a typo fails the build instead of shipping malformed
Unicode. `-` means MVS; `.` forces a letter boundary; loan/Ali Gali letters
are deliberately unmapped.

## ⚠ Pending migration to @gege-mn/mongol-bichig (2026-07-26)

The shared facts now have one canonical home: **~/Projects/mongol-bichig**
(npm `@gege-mn/mongol-bichig`), which gege-linter already imports. This
package has **not** been migrated yet, so two things here are knowingly
duplicated:

- **`src/romanize.ts`** — copied verbatim into the package as the canonical
  Classical romanization. Replace this file with a re-export; it is a pure
  duplicate today and will drift.
- **Classical suffix forms** in `src/data/suffixes.ts` — the package ships
  them with harmony, attachment condition, join type and shaping-registry
  flag, cross-checked row by row against the normative document. Read those
  from the package.

What stays here either way: the **Khalkha Cyrillic surface pairings** and the
`separate` flags. They are this project's own unreviewed work, so they were
deliberately left out of the canonical registry rather than laundered into it.
Same for `harmonyOf` over Cyrillic vowels — the package's `harmonyOf` reads
bichig.

Also worth knowing: the package exports `spaceParticles`
(ᠤᠤ/ᠦᠦ/ᠪᠦᠦ/ᠦᠭᠡᠢ) — words that take a plain space and must **never** be
MVS-joined. Stage 5–6 must not connector-join them.
