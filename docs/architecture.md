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
