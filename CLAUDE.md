# gege-converter

`@gege-mn/gege-converter` — Mongolian Cyrillic → traditional Mongolian script
(Mongol bichig). **Unicode correctness is the whole differentiator**: the
incumbent converters emit encodings that are not correct Unicode, and the Inner
Mongolian ecosystem emits Menksoft PUA.

An algorithm with dictionaries, **not a model**: pure TypeScript + data tables,
no third-party runtime dependencies, nothing trained. A wrong word is a data row
you edit, not a retraining run. Eight pipeline stages, one per file in `src/`,
pure functions; only stage 7 (ranking) is statistical.

`src/tungaamal.ts` is a second, self-contained thing in the same package:
Tungaamal-convention bichig → Unicode. It shares no code with the eight stages
and `scripts/standardize-silver.mjs` uses it to read silver data.

<!-- Maintainer notes — block-level HTML comments are stripped before this file
     reaches Claude's context, so they cost zero tokens.

     KEEP THIS FILE UNDER ~80 LINES. It was 524 lines on 2026-07-26 and 219 on
     2026-08-10. Anthropic's guidance: target under 200, shorter reads better,
     and a bloated file makes Claude ignore the rules that matter.

     Two mechanisms, and only one of them actually saves context:
       - `.claude/rules/*.md` with `paths:` frontmatter load ONLY when Claude
         reads a matching file. This is where the per-area detail went.
       - `@path` imports load EAGERLY at launch and save nothing. Never use
         them here. Link with plain backticked paths, as the table below does.

     Pruning test for every line: "would removing this cause a mistake?" -->

## Commands

`pnpm build` · `pnpm typecheck` · `pnpm test` · `pnpm lint` — all four must pass
before anything is called done. `pnpm status` prints where the converter stands;
`node scripts/eval.mjs` and `scripts/eval-corpus.mjs` are the two scores, and
`scripts/eval-sentences.mjs` the running-text one. Quote a number from a
command, never from memory, and name the script that produced it.

pnpm only — `npm`, `npx` and `pnpm exec` are blocked in this environment.

## Rules that hold in every session

- **Never run `npm publish`.** Publishing is the owner's, never an agent's — the
  registry needs an OTP an agent cannot supply, so an attempt fails at best and
  half-releases at worst. You *may* bump the version, write the CHANGELOG, run
  the four commands above, confirm `pnpm pack` ships the right files, then stop
  and report it ready. Same rule in gege-linter and mongol-bichig.
- **Grade in SCRIPT, never in romanization.** γ/g and q/k are allographs of one
  letter chosen by vowel harmony, so `ger` and `γer` are the same word and the
  identical code points. Comparing romanizations invents disagreements — it once
  scored the curated lexicon at 56% when the truth was 83%. Use
  `toScript(a) === toScript(b)`.
- **Exclude the `toli` tier by name, never by `!== 'guess'`.** Tiers rank
  `lexicon` > `attested` > `harvested` > `toli` > `guess`. Wherever code asks
  "do we already have a real reading, so stop looking", `toli` must be named
  explicitly; it broke seven reader rulings three separate ways otherwise, and
  its data was wrong in none of them. A weak tier's damage is the better paths
  it stops from running. (`!== 'guess'` is still right for "is this attested at
  all".) **An `attested` row used as a STEM is the same kind of weak claim** —
  the row is a whole word; only as a whole word does it settle anything.
- **Score a gold fixture with the `attested` tier emptied.** That tier stores
  whole words from the same silver the gold came from, so left live it
  answers gold from memory. `scripts/lib/derivation.mjs` empties it for the
  duration; running text, the rulings and `attested-heldout.json` are scored
  with it live.
- **The parallel corpus is private; this package is not.** Reader-written
  sentences live outside this repo (`../gege-corpus`, `$GEGE_CORPUS`, or
  `--corpus PATH`) and are never released. Word pairs, rules and aggregate
  counts may cross in and ship; sentences and any fixture built from them never
  do. A trained model memorises them, so `training/` must not become a runtime
  dependency and no checkpoint trained on them may be published.
- **Naming the outside world.** Encodings may be named as technical artifacts
  — Tungaamal (the keyboard-and-font convention, and the module that reads it:
  `tungaamalToUnicode`), Menksoft PUA, Saiyin. Company names, service domains,
  endpoints and anything reading as credit never appear. **Where bulk data
  came from is not discussed at all** in new code, comments, docs, tests,
  branch names or commit messages — no source named, no "reference", no
  "harvest" story (owner, 2026-10-02). Data that is good but unreviewed is
  **silver**; scores are "against the silver". The older tier and file names
  (`harvested`, `docs/harvest.md`) stay as they are.

## Authority, in order

1. **`test/rulings.test.ts`** — a bichig reader's verdicts as executable tests,
   the highest-authority fixture here. **Do not re-litigate these.**
2. **The 2026 rulebook** — the adopted national orthography, extracted in
   mongol-bichig `references/rulebook-2026.md`. Where it speaks it outranks
   Poppe, the 2015 Цэвэл and any reader answer it contradicts. **Where it is
   silent — encoding, MVS/FVS, PUA, anything Unicode — the reader is still the
   only authority.**
3. Everything else.

## Read on demand

Do not read these by default. Open one when its topic actually comes up.

| File | Read it when |
|---|---|
| `docs/architecture.md` | changing a pipeline stage, `romanize.ts`, the data layout, or the one remaining duplication |
| `docs/data-and-accuracy.md` | optimising anything, quoting a metric, or touching the ranker |
| `docs/harvest.md` | importing data, or writing a script that talks to silver data |
| `docs/tungaamal.md` | touching `src/tungaamal.ts`, reading silver data, or anything about the Tungaamal convention |
| `docs/roadmap.md` | choosing what to work on next |
| `docs/rulings.md` | changing romanization, the guesser, the suffix table, or anything about o/ö |
| `docs/architecture-rationale.md` | re-litigating algorithm-vs-model |
| `docs/neural-model.md` | starting the model, or exporting training data |
| `docs/parallel-corpus.md` | ingesting reader-written sentences, or scoring against them |
| mongol-bichig `references/rulebook-2026.md` | which allomorph a stem selects, залгах vs дагуулах, or whether a rule generalises |
| mongol-bichig `skills/mongol-bichig/references/` | any question about the script itself |

Per-area rules in `.claude/rules/` load automatically when you touch the files
they cover — invisible characters, data rows, and the reader review loop.

## Siblings

- **~/Projects/mongol-bichig** — the shared source of truth: canonical data,
  reference documents, both agent skills. Script-fact and suffix corrections go
  there. Install with `npx skills add gege-mn/mongol-bichig`.
- **~/Projects/gege-linter** — validates bichig; this generates it. Stage 8 takes
  its `lint` as an **injected hook, not an import**.
