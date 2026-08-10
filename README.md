# @gege-mn/gege-converter

Convert Mongolian Cyrillic to traditional Mongolian script (Mongol bichig),
emitting **correct Unicode** — MVS (U+180E) as the suffix connector, per the
Unicode 16.0 core specification, never the legacy NNBSP (U+202F).

A dictionary-and-rules engine: pure TypeScript plus data tables, nothing
trained. Closer to a spell checker than to a language model. No third-party
runtime dependencies — the one dependency is [`@gege-mn/mongol-bichig`][facts],
first-party, pure data and pure functions, itself dependency-free.

[facts]: https://github.com/gege-mn/mongol-bichig

```ts
import { convert, analyze } from '@gege-mn/gege-converter';

convert('Монгол бичиг');   // → ᠮᠣᠩᠭᠤᠯ ᠪᠢᠴᠢᠭ
convert('хотод');          // → ᠬᠣᠲᠠ + U+180E + ᠳᠤ   (qota-du)
```

## Read this before using it

**This is a candidate generator for a human-in-the-loop editor, not an
unattended converter.** Measured over 1,611 held-out inflected forms and 3,000
sentences of real running text:

| | | |
|---|---|---|
| **73.7%** | correct per word, top-1 — what `convert()` returns | |
| **95.3%** | correct given a *correct stem* | the ceiling the data is chasing |
| **91.4%** | of running-text words have a real dictionary stem | the rest are guessed, and a guess is right **6.0%** of the time |
| **46.0%** | of sentences have every stem from real data | see below |

That last row is the one that matters for "can I just run text through it":
**54.0%** of real sentences still contain at least one word being guessed at,
and a single guessed word is usually enough to make the sentence wrong.

The 95.3% oracle is the reason to be optimistic anyway — the segmenter, suffix
table and generator are not the bottleneck. With a complete dictionary and no
code changes, **~62%** of ten-word sentences (the corpus median) would come out
exact. The gap is data, and a large part of it is verb morphology (see below).

Token-weighted against a 451k-token parallel corpus, rather than by word type,
the same build scores **69.3%** — `node scripts/eval-corpus.mjs`. Both numbers
are real and they answer different questions: a type list cannot see a fix to a
frequent word land, and a token count over-rewards it.

⚠ **The top-1 figure has two definitions and they are 2.2pp apart.** The table
gives what a user actually gets. `eval.mjs` also prints *best segmented* (75.9%),
which skips a memorised whole-word reading to ask whether the segmenter and the
suffix chain did their job. Both were called "top-1" until 2026-08-10, on which
day they were briefly equal for unrelated reasons and an hour went into
attributing a regression to the wrong change. Say which one you mean.

Regenerate every figure above with `node scripts/eval.mjs --coverage
--sentences`; `pnpm status` adds the per-tier and per-ending breakdowns. Quote
them from a command, never from memory — this table drifted for a release
because nobody re-ran it, and every number in it was **understating** the
converter by the end.

Everything above is measured against another converter, not against a bichig
reader. A reader has ruled on **160** sampled words and forms, all 160 of which
this build reproduces; that fixture is `test/rulings.test.ts` and it is the
highest authority in the suite. A further 35 are recorded there as known-wrong
`it.todo`s rather than quietly omitted.

## The API

`analyze` is the real function. `convert` is a thin wrapper over it.

```ts
analyze('хар');
// [{
//   token: { kind: 'word', text: 'хар', start: 0, end: 3 },
//   candidates: [
//     { classical: 'qar-a', script: 'ᠬᠠᠷ᠎ᠠ', gloss: 'black',          confidence: 0.8, provenance: 'lexicon', … },
//     { classical: 'qara',  script: 'ᠬᠠᠷᠠ',  gloss: 'to look (stem)', confidence: 0.2, provenance: 'lexicon', … },
//   ],
// }]
```

Ambiguity comes back as **data**, not as a silent wrong answer — so an editor
can underline the word and offer both readings. Offsets are **code points**,
matching gege-linter's diagnostic model; never `String.slice` with them.

⚠ **The token count is not the input's.** The two orthographies disagree about
where words end, in both directions, so `analyze` fixes the boundary: мэдэхгүй
and монголруу come back as **two** words, and "бодож ч" as **one**. Offsets
still tile the input and stay usable as caret positions or linter spans; what
you cannot do is reconstruct the input by concatenating every `text`.

### Reading the output honestly

Two fields tell you how much to trust a candidate, and they are most useful
together:

- **`provenance`** — `lexicon` (hand-curated, reviewed by a bichig reader),
  `harvested` (bulk, unreviewed), `toli` (bulk dictionary headwords, the largest
  and least reviewed tier), or `guess` (rule-based fallback for an unknown stem,
  right about 6% of the time on held-out forms). Descending trust, left to right.
- **`verbForm`** on the token — set when the word carries a Khalkha verb
  ending. Verb morphology is **partial** (see the limitations below), so this
  marks a reading as worth more scepticism than its `provenance` alone suggests.

```ts
const [token] = analyze('хүлээгээд');
token.verbForm;                  // { kind: 'converb-perfective', ending: 'ээд' }
token.candidates[0].provenance;  // 'guess'  → almost certainly wrong
```

`verbForm` set **and** `provenance: 'guess'` is where this converter is most
likely to be silently wrong — **3.9%** of running-text words. `verbForm` set
with `lexicon`/`harvested` is usually right, and now for two different reasons:
either the harvest memorised the whole inflected form, or the verb suffix table
built it.

### Options

```ts
convert(text, {
  ranker,          // swap the scoring function (see below)
  validate,        // reject malformed candidates — wire up gege-linter here
  maxCandidates,   // default 5
  digits,          // 'ascii' (default) | 'mongolian'
  punctuation,     // 'ascii' (default) | 'mongolian'
});
```

`digits` and `punctuation` default to `'ascii'` deliberately: the reference
charts record U+1810–1819 as "less used now" and UTN #57 §2.2.3 defers every
numeral specification, so converting them by default would be inventing a
convention. Digits are applied uniformly across the document, because mixing
the two systems is exactly what gege-linter's `digit-consistency` rule flags.

Using the linter as a discriminator, which no other converter can offer:

```ts
import { lint } from '@gege-mn/gege-linter';

convert(text, { validate: (s) => lint(s).every((d) => d.severity !== 'error') });
```

## Why this exists

Existing converters either emit a proprietary font encoding (Menksoft PUA and
its relatives) or produce Unicode that is malformed at the encoding level. One
study found **45.25% of words** on a professionally edited Mongolian newspaper
front page were visually correct but encoding-wrong.[^1] Correct output is the
entire point of this package — which is why `validate` exists, and why the
sibling linter was written first.

[^1]: 白双成, 呼斯勒, CCL 2020 — https://aclanthology.org/2020.ccl-1.45.pdf

## How it works

Eight stages. Exactly one of them is statistical.

| # | Stage | Made of |
|---|-------|---------|
| 1 | Tokenize | code |
| 2 | Normalize Cyrillic | code |
| 3 | Segment stem + suffix chain (keeps *all* parses) | code + data |
| 4 | Resolve stem — lexicon hit, else a flagged guess | data + code |
| 5 | Generate Classical suffixes with harmony + connector | code + data |
| 6 | Assemble candidates | code |
| 7 | **Rank** | numbers |
| 8 | Validate (optional `validate` hook) | code |

Stage 7 is the whole "model": a frequency number per lexicon row, multiplied
by a penalty for how much segmentation the reading needed. It sits behind the
`Ranker` interface, so a context n-gram — or anything else — can replace it
without touching another stage:

```ts
interface Ranker {
  name: string;
  score(candidate: Candidate, context: RankContext): number;
}
```

Segmentation is constrained by grammar, not just by string matching. The
Khalkha suffix chain is **stem + plural + case + reflexive**, and orders the
language cannot form are refused — a word ending `-аад` is the perfective
converb, never reflexive `аа` + dative `д`.

## Data

50,065 stem entries in three tiers, plus 101 nominal suffix rows and 34 verbal
ones.

| Tier | Rows | What it is |
|---|---|---|
| `lexicon` | 224 | Hand-curated, glossed, reviewed by a bichig reader. |
| `harvested` | 9,048 | Bulk, machine-repaired to correct Unicode. **Unreviewed.** |
| `toli` | 40,793 | Bulk dictionary headwords, romanized from a galig column. **Unreviewed**, and the tier most likely to disagree with this project. |

A curated entry short-circuits the lookup, so a lower row can never outrank a
reviewed one for the same word.

⚠ **`toli` is bigger than everything above it combined, and that is why it is
consulted last, not first.** It answers where the alternative was a guess — ~69%
against the guesser's ~6% — and nowhere else. Anywhere the code asks "do we
already have a real reading, so stop looking", this tier is excluded **by name**;
`!== 'guess'` is a bug there, and it broke seven reader-confirmed rulings three
separate ways before the rule was in place. In none of those was a toli row's
data wrong: a weak tier's damage is the better paths it stops from running, not
the weight it carries.

Classical forms are written in **romanization**, not as bichig literals, so
data rows are auditable by eye and diff readably. `src/romanize.ts` re-exports
the canonical implementation from `@gege-mn/mongol-bichig`.

| Romanization | Meaning |
|---|---|
| `-` | chachlag / suffix connector → MVS (U+180E) |
| `.` | forces a letter boundary (`n.g` = NA+GA, not ANG) |
| `1`–`4` | selects FVS1–FVS4 for the preceding letter |
| `gh` `ch` `sh` `j` `v` | ASCII aliases for γ č š ǰ w |
| `q`/`k`, `γ`/`g` | back/front readings of U+182C, U+182D |

`test/data.test.ts` asserts every entry romanizes to Hudum letters and MVS
only, so a typo fails the build instead of shipping malformed Unicode.

## Known limitations

Ordered by how much they cost.

- **Verb morphology is partial.** It is no longer absent — 34 verb-suffix rows
  build the participles, the converbs and the past tenses, so ирж → `ireǰü` and
  харав → `qaraba` are constructed rather than memorised. But on 197 held-out
  verb forms top-1 is **50.8%**, and this is still the biggest single gap:
  **20.9% of running-text words carry a verb ending, and 45.2% of everything the
  guesser emits is verb-shaped.** That second figure rose sharply in 0.5.0 while
  the first fell, and both moves are the same event: the `toli` tier absorbed a
  large share of the *nominal* guesses, so what the guesser still emits is now
  far more concentrated in verbs. The gap did not widen; it got easier to see.

  The failure has moved, which changes what would fix it. **79 of the 91
  guess-tier verb failures never segment at all** — the suffix row exists and is
  waiting for a stem that the dictionary does not have. That is a data problem
  now, not a morphology one. The remaining 12 segment and then lose to a
  competing nominal reading: бодлоо is ranked as `bodul-iyan` (reflexive) rather
  than as the past, because ranking is a static unigram prior with no context.
- **The guesser is deliberately minimal.** It collapses long vowels and
  transliterates; it does *not* reverse the `V+γ/g+V` contraction that produced
  them (улаан ← *ulaγan*). That is not laziness — the origin is **not derivable
  from Cyrillic**: measured over 1,191 stems, no predictive rule exceeds 54%.
  Inventing a consonant is a worse failure than omitting one.
- **Ranking is a static unigram prior** and cannot see context. It is also
  where several known errors live: a whole-word dictionary entry can lose to a
  segmented reading of itself.
- **Bare genitive `-н` is unhandled**, deliberately. Cyrillic `-н` is at least
  two suffixes — a contracted genitive (далайн) and a noun-to-adjective derivation
  (ус → усан) — and telling them apart needs stem metadata the dictionary does
  not yet carry.
- **Frequencies are hand-assigned**, not counted from a corpus.
- **Loanwords needing variation selectors cannot be emitted at all** (автобус),
  about 6% of harvested rows.
- **Clitics** (нь, минь, чинь) are separate tokens; joining them with MVS is
  not implemented. The particle **ч is** joined, on a reader's ruling — it is
  the one that was asked about, and л is deliberately still waiting.

## Development

```bash
pnpm install
pnpm test        # vitest — 299 tests
pnpm typecheck
pnpm lint
pnpm build

node scripts/eval.mjs --coverage --sentences   # the accuracy numbers above
```

Bichig **cannot be judged from terminal output** — wrong glyphs, no vertical
layout. `node scripts/build-spotcheck.mjs .tmp/out.html` renders a review page
for a human reader instead.

## Related

- [`@gege-mn/gege-linter`](https://github.com/gege-mn/gege-linter) —
  validates Mongol bichig Unicode. Pairs with this package's `validate` hook.
- [`@gege-mn/mongol-bichig`](https://github.com/gege-mn/mongol-bichig) —
  the canonical data and the source-cited reference documents.

## License

MIT — see `LICENSE`. That grant is written for **code**, and this package is
mostly not code by weight.

**Data provenance.** Of the 50,065 stem entries, 224 are original to this
project. The `harvested` tier (9,048) is derived from the output of an existing
Cyrillic→bichig converter; the `toli` tier (40,793) is derived from the galig
column of a bundled dictionary database. Both were transformed substantially —
re-romanized through this project's own `toScript`, orthographically normalised,
and reduced to `cyrillic classical` stem pairs carrying no definitions, glosses
or example sentences from either source.

We make no copyright claim over those two tiers and cannot grant rights in them.
If you intend to redistribute the data itself — as opposed to depending on this
package to convert text — that is yours to clear. The MIT grant over the code,
the suffix tables, the rules and the curated `lexicon` tier is unencumbered.
