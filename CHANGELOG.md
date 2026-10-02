# Changelog

## Unreleased — 2026-10-02

**Not versioned and not published.** `Provenance` gains a member and the package
exports a second converter, so by this project's own convention it is a minor
bump (0.6.0) when the owner cuts it.

Two things: a fifth data tier, built from a silver set of
running text, and a Tungaamal → Unicode converter that had to exist before that
text could be read correctly.

Main (0.5.0) against this build, same scripts:

| | 0.5.0 | now |
|---|---|---|
| words agreeing with the silver, 2,000 held-out sentences | 79.8% | **94.6%** |
| …sentences agreeing in every word | 10.8% | **58.4%** |
| independent corpus, token-weighted — 450,860 tokens | 69.3% | **79.4%** |
| independent corpus, by type | 39.3% | **55.8%** |
| words withheld from the new tier (5,746) | 63.9% by token, 39.7% by type | **79.0% by token, 59.4% by type** |
| gold — all inflected forms (1,884), new tier switched off | 63.2% | **64.7%** |
| gold — verbs, held out (197), new tier switched off | 50.8% | **81.7%** |
| reader rulings | 160/160 | **196/196** |

### Added — the `attested` tier

92,550 whole Cyrillic words as the silver writes them,
kept only where the pipeline's own derivation disagrees. Tier order is now
`lexicon` > `attested` > `harvested` > `toli` > `guess`.

- A row answers its word outright. As a stem it is asked last, after every
  real stem — the placement lesson `toli` taught, applied before it could be
  learned again.
- Gold fixtures are scored with the tier emptied (`scripts/lib/derivation.mjs`).
  ⚠ This departs from `import-toli.mjs`, which withholds gold words from its
  tier instead; that rule here would leave about seven hundred common words
  converting wrongly to protect a metric.
- A 3% sample of the silver set is withheld as
  `test/fixtures/attested-heldout.json`, the only measurement of what the tier
  does for a word it was not given.
- The importer runs a second pass with its rows live, because a row used as a
  stem can take a longer word the first pass judged fine.

### Added — `tungaamalToUnicode`

`tungaamalToUnicode(text, { faithful? })`, `rewriteTungaamal`, and
`detectTungaamal`. Tungaamal-convention bichig — Mongolia's dominant keyboard
and font family — rewritten into the code points Unicode 16 writes the same
words with. Self-contained: it shares no code with the Cyrillic pipeline.

It is not a character map. The convention types gender instead of shaping it,
uses one selector as a toggle, and marks a suffix with a selector rather than a
connector; 111 rows measured out of the fonts' own GSUB tables say what each
letter becomes. Faithful mode reproduces what the Tungaamal fonts drew on 9,662
of 9,686 real tokens (99.7% of occurrences), against Noto Sans Mongolian 3.002
and the hinted 3.100 build alike. See `docs/tungaamal.md`.

⚠ The old import treated the convention as "standard Hudum plus two letters".
Every `harvested` row carries the silver's selectors where it has any. That
tier was **not** regenerated — measured, 174 of 9,048 rows would change and an
independent silver set prefers the new ones 39 to 23, which is too thin to
replace a tier every ruling has been tested against.

### Changed — rules found by reading what the silver set disagreed with

- **Verb stems also come from the dictionary's infinitives**, and a parse on a
  real stem outranks an earlier suffix row's parse on a dictionary one.
- **A final -н on a whole word is the word's own.** салан was the noun сал
  with a "linking н" taken off; it is the converb `salun`.
- **-тай³ + linking г + case** — амжилттайгаар, морьтойгоо. No reading before.
  Written detached, as -тай³ is by house style; refused where the word up to
  -тай is itself a row (эмэгтэйгээ is эмэгтэй + г + ээ).
- **A suffix that attaches to a chachlag stem takes the connector with it** —
  гавьяат `γabiyatu`, тоосголог `toγusγalig`, where there used to be an MVS
  stranded mid-word. 231 of 231 in the silver. ⚠ A reader named the rule
  (гэдэс жийрэглэх) and has not been shown these forms. `pnpm lint:output`
  goes from 19 warnings to 0.
- **The dative of a Cyrillic -т follows the Classical stem**: `du` after a
  vowel (бичлэгт `bičilγe-dü`), 86 of 86 in the silver. And Cyrillic -т is
  two suffixes — the adjective-forming -т (чөлөөт) is now a row, told from the
  dative by what the CYRILLIC stem ends in (`SuffixEntry.afterCyrillic`).
- **An unknown compound is read as its two known words** — ганболд is ган +
  болд. Still labelled `guess`; right four times in five where the
  letter-by-letter guess was right one time in twelve.
- **A case may not sit inside a case**, apart from genitive + dative and
  dative + ablative.
- **-чид**, the agentive plural, takes a case whole.

### Changed — ruled on the two review pages (2026-10-02)

- **нэг is `nige`**; `nigen` is нэгэн. The curated row was wrong, and it was
  the largest single disagreement with running text.
- **үнэт is `ünetü`** — a reversal of the 2026-07 ruling `ünedü`, on seeing the
  silver's whole class of -т adjectives.
- **A suffix after a number, an abbreviation, a Latin word or a closing quote**
  (2020-ны, 13-нд, АНУ-ын) is written as on the word it stands for: the
  allomorph follows how the number is read (13-нд `du`, 1-нд `dü`), and the
  hyphen becomes MVS. New stage, `src/attached.ts`. ⚠ The connector is the
  owner's working assumption, not a reader's ruling. `tungaamalToUnicode`
  reads U+1806 before a suffix the same way.
- **-гүй takes case on үгүй**: төлбөргүйгээр is `tölbüri` + `ügei-ber`.
- **A word the silver writes as two is stored as two**: юмуу `yum uu`,
  улстөрийн `ulus törü-yin`. An `attested` reading may contain a space;
  `wordsToScript` romanizes it word by word, and `foldNonInitialO` no longer
  reads two words as one.

- **Possession is `qi` / `qin` after a genitive** — албаныхан `alban-u-qin`,
  өөрийнх `öber-ün-qi`, мориныход `morin-u-qi-du`. The registry had the suffix;
  the converter's table did not, and 3,421 words in the silver set were guesses.
  New `SuffixCategory` member, `possession`.
- **гэрээ is the contract first** (`ger-e`), with гэр + reflexive still
  offered; хүйтэн `küiten`, зургаа `ǰirγuγ-a`, уух `uuγuqu`, мөч `möče`.

### Changed — 17 reader answers that were `it.todo` are assertions

Three are derived by the rules above, five had been passing unretired, and nine
are answered by an `attested` row — the word is right, the rule its todo was
filed under is as missing as it was. `test/rulings.test.ts` says which is
which.

### Fixed

- `eval.mjs --coverage` left the new tier out of its "real data" total, and
  `--sentences` read the tier's missing gold rate as zero.

## 0.5.0 — 2026-08-10

**A fourth stem tier.** 41,640 headwords from a bundled SQLite dictionary,
romanized from its galig column through our own `toScript` and normalised by
`orthography.ts`, land as a new `toli` provenance below `harvested`. It is by
far the largest source here and by far the least reviewed, and both facts are
load-bearing. The public API is unchanged; `Provenance` gains a member, which is
a widening for consumers who read it and a break for anyone exhaustively
switching on it — hence minor, not patch.

Scored 0.4.0 against this build with the same scripts and the same fixtures, so
only `src/` differs:

| | 0.4.0 | 0.5.0 |
|---|---|---|
| corpus, token-weighted — 450,860 tokens | 66.1% | **69.3%** |
| corpus, by type | 34.2% | **39.3%** |
| tokens reaching the guesser | 88,475 | **57,331** |
| gold — all inflected forms (1,884) | 60.7% | **63.2%** |
| gold — detached half (1,611), emitted | 70.9% | **73.7%** |
| gold — verbs, held out (197) | 50.8% | 50.8% |
| running-text stem coverage | 87.0% | **91.4%** |
| **reader rulings, scored on today's 160** | 12 failing | **160/160** |

Verbs are unmoved again, and again by design: their bottleneck is derived stems
(passive -гд, causative -уул), still open.

### Added — the `toli` tier, and the discipline it requires

It scores ~69% where it fires against ~8% for the guesser it displaces. That
gap is the entire case for it; the 69% on its own would not be.

**It must be excluded by name — `!== 'guess'` is the bug.** Merged into
`harvested` it broke seven confirmed reader rulings; given its own prior but
consulted before the restoration paths, six; placed last but left in the verb
gate, five. In none of those was a toli row's data wrong. A weak tier's damage
is not the weight it carries, it is the better paths it stops from running, and
no re-weighting can fix that because the right candidate is never built to be
ranked. `stem.ts` therefore reaches it only after every other path has missed,
and the verb gate in `generate.ts` now tests `'lexicon' || 'harvested'`
explicitly — the difference between ахиад reading `aqiγad` and `aqiyad`.

### Added — the linking г

далай + аар is written далайгаар and the Classical `dalai-bar` has no GA at all.
Peeling only `-аар` left далайг, which matched nothing, so the word took далай +
`-г` + `-аар` and emitted `dalai-yi-bar` — a bare accusative the word does not
contain. Worth 43 native forms and 2.67pp of top-1, the largest cluster needing
neither the reader nor a new wordlist.

Attested-only and vowel-initial-suffix-only, like `dropLinkingN`, and it runs
only after both dictionaries have missed: a stem whose Classical genuinely ends
in GA is resolved long before reaching it. The н case (булан `bulung`, нян
`niyan`) is folded in without a branch, because the restored key's attested
Classical is used unchanged — the data answers, so no rule has to.

### Fixed — the тогтворгүй н was tested on the wrong side

`unstableNStems` tested for a vowel-final **Cyrillic** stem. The rule is a fact
about the **Classical** form, and the two disagree constantly: хувцас is
consonant-final in Cyrillic but `qubčasu` is vowel-final and takes the н, so
хувцаснаас was rejected and fell to the guesser as `qubčasn-ača` where the
reader gives `qubčasun-ača`. The Classical-side test already existed and is
strictly better — `resolveStem` keeps only matches whose `hiddenN` is true, read
off the script.

### Changed — -тай³ stays detached, and the reason is written down

Asked whether -тай⁴ is joined or detached, the reader declined the either/or:
*"both correct, and it's simply a choice. we chose to detach, but we can also
attach. when attaching, гэдэс жийрэглэх rule apply btw"*. So §2.3.6 does not
decide it, and the running-text majority (залгаж 72.4% over 791 paired tokens)
measures house style, not correctness.

Two separate things now carry that, and keeping them separate is the point.
`SuffixEntry.share` is new and holds the **measurement**, because it is a count
over running text — the field is documented as evidence, not judgement, and
folding a preference into it would falsify the data to get a ranking. The
**choice** is a distinct ranking factor in `generate.ts`. It is also not merely
a preference today: our залгаж output on a chachlag stem strands the stem's MVS
mid-word (санаатай → `sanaγ-atai`), which `pnpm lint:output` reports as
`unknown-suffix` — 19 of them. The attached reading stays a candidate, because
the reader confirms it is correct; it does not win by default. Revisit when
гэдэс жийрэглэх is implemented, with the reader rather than on the corpus number.

### Fixed — a holdout leak into the shipped tier

`import-toli.mjs` was filtering against the noun gold only. Ten verb-gold forms
and six reader-ruled words were being memorised into the shipped runtime, which
makes those fixtures measure recall of themselves. It now excludes all three
sources, including every Cyrillic run in `rulings.test.ts`. Verb gold read 53.3%
with the leak and 51.9% without; the tier's share of that fixture fell from 7
forms to 1. The import is also idempotent now — its own filter had let the tier
judge itself.

### Fixed — reader rulings, 2026-08-10

Eight answers from the 2026-08-07 ask page and the toli spot check, all as rows
rather than rules, two of them loanwords which by standing policy generalise to
nothing: найм `nay1ma`, сургуулийн `surγaγuli-yin`, бие `bey-e`, байшин
`baising`, банан `banana`, филармони `filarmoni`, токар `toqar`, энг `eng`,
худалдаа `qudalduγ-a`, сэргэ `sergü`, дэнг `d1ēng`, ахь `aqi`, уйл `uqil`.

- **алт is two rows now.** *"both are correct and both should be offered — alta
  would be more closer modern one, so offer it at higher freq"*: `alta` at 0.8
  and `altan` at 0.3.
- **хүү was `köbegün` on the wrong key.** *"köbegün = хөвгүүн (not хүү, but is a
  synonym)."* The seed had not mistranslated anything — it attached one word's
  Classical form to its synonym's Cyrillic, which no gloss check could catch
  because the gloss was true of both. Now хүү `qüü` and хөвгүүн `köbegün`.
- **хийн stays ambiguous on purpose.** *"genuinely ambiguous, needs the
  sentence."* Both readings are kept and a test asserts they both survive.
- `hiddenN: false` on both loanwords is load-bearing: their Classical forms end
  in a vowel, so the default would give them a тогтворгүй н and write
  `bananan-u`.

### Fixed — two measurement bugs, both of which had produced quotable numbers

- `status.mjs` built its tier counts from an object literal missing the new
  tier, so a missing key wrote `NaN` and silently dropped 1,186 of 28,982
  tokens. It printed 87.3% real-data coverage where the true figure was 91.4%.
- `eval.mjs` reported one number under a name that meant two different things.
  It now prints **both** `EMITTED candidates[0]` (what a user gets, 73.7%) and
  `best segmented` (whether segmentation worked, 75.9%), and the header says so.
  The two were briefly equal at 73.7% for unrelated reasons, and an hour went
  into attributing a regression to the wrong change.

### Not done, deliberately

The plural allomorph after an NA-final stem. Gold says `nuγud` 37/37, but the
reader's own ruling мэргэжилтнүүд = `merγeǰilten-üd` is an NA-final stem taking
bare `üd`, and настан and мэргэжилтэн are the same -тан/-тэн morphology, so
nothing in `after` separates them. Tried, measured at +1.49, reverted, and put
back to the reader. Worth 3.6pp when it is answered.

## 0.4.0 — 2026-08-09

**Stems.** One theme, arrived at from two directions: the тогтворгүй н, which
gives a stem back a letter the citation form drops, and two Cyrillic
alternations that were hiding stems the data already held. Nothing in the public
API changed — `index.ts` is untouched and the type additions are optional — but
output changes for a broad class of words, so this is a minor rather than a
patch.

Scored 0.3.0 against this build with the same scripts and the same fixtures, so
only `src/` differs:

| | 0.3.0 | 0.4.0 |
|---|---|---|
| corpus, token-weighted — 450,860 tokens | 64.6% | **66.1%** |
| corpus, by type | 33.1% | **34.2%** |
| `guess` tier, token-weighted | 18.5% | **19.2%** |
| tokens still reaching the guesser | 95,227 | **88,475** |
| gold — all inflected forms (1,884) | 58.0% | **60.7%** |
| gold — stems that reach the guess tier | 260 | **179** |
| gold — verbs, held out (197) | 50.8% | 50.8% |
| running-text words with no resolvable stem | 2.05% | **1.50%** |
| **reader rulings, scored on today's 64** | 56/64 | **64/64** |

Verbs are unmoved by design: every change here is nominal morphology. Their
bottleneck is derived stems (passive -гд, causative -уул), still open.

### Added — тогтворгүй н

A Classical stem that ends in a vowel in its citation form and brings back a
final NA in oblique forms: мод `modu` → модны `modun-u`. Implemented from the
rule a reader gave for finding it — *a stem whose script form ends in a vowel
takes the н* — which is carried as the **default** behind a tri-state
`hiddenN` flag rather than as a hard rule. That matters because the flag can
only ever be set on a few rows by hand, while the default reaches all ~30,000
harvested ones. One confirmed exception so far: хэл `kele`, where the н of
хэлэнд is the жийрэг н that Cyrillic inserts and Classical does not have.

### Fixed — stems the Cyrillic spelling was hiding

Two alternations, one shape. Cyrillic absorbs a stem-final letter into a
vowel-initial suffix, so peeling only the suffix leaves something that is not a
lexicon key, and a stem the data already held — **held correctly** — was thrown
away and rebuilt by the guesser:

- the **soft sign**: сургууль + ийн is written сургуулийн, and сургууль alone
  gave `surγaγuli` while сургуулийн gave `surγul-un`. Also морь, дуурь, хонь.
- the **chachlag vowel**: утга + ыг is written утгыг. Also хаалга, найруулга,
  орчуулга, арга, аялга, аяга — the last three had been producing double
  accusatives of nothing (`аргыг` was `aru-yi-yi`, now `arγ-a-yi`).

Both restorations are **attested-only** — they propose a form and keep it only
if the lexicon or the harvest has it — and both fire **only in front of a
vowel-initial suffix**, because that is the environment where the letter
actually disappears. A version without that gate shipped briefly during 0.4.0
development and made `хоног` parse as хон + accusative г: хонь is a real word,
so attestation alone could not reject it.

### Fixed — three bugs found by auditing the above

`resolveStem` returned the first matching recovery path, silently deleting a
stem that assembles in favour of one that does not; it now returns both and
lets ranking decide. `бананы` was read as a genitive of бан off two speculative
steps stacked. `багшнар` was a coin flip because the plural -нар begins with н
and the тогтворгүй-н genitives do too — the trigger now distinguishes them.

### Notes

- No breaking API change. `resolveStem` takes an optional second argument (the
  innermost peeled suffix); `LexiconEntry` and `StemMatch` gained an optional
  `hiddenN`.
- The `-лаг⁴`-on-a-chachlag-stem warning from 0.3.0 is unchanged at 19
  occurrences; it is a known gap, not a regression.

## 0.3.0 — 2026-08-06

The first release since **0.2.1 (2026-07-30)**. A 0.3.0 was prepared on
2026-07-31 and never reached the registry, so its entry — "the rulebook round",
below — ships here rather than on its own. Everything between those two dates is
in this one version.

Scored 0.2.1 against this build with the same scripts and the same fixtures, so
only `src/` differs:

| | 0.2.1 | 0.3.0 |
|---|---|---|
| corpus, token-weighted — 450,860 tokens | 59.8% | **64.6%** |
| corpus, by type | 29.3% | **33.1%** |
| `guess` tier, token-weighted | 12.7% | **18.5%** |
| tokens still reaching the guesser | 116,506 | **95,275** |
| running-text words with a real dictionary stem | 81.9% | **85.6%** |
| gold — all inflected forms (1,884) | 53.6% | **58.0%** |
| gold — verbs, held out (197) | 46.2% | **50.8%** |
| **reader rulings, scored on today's 91** | 80/91 | **91/91** |
| WER / CER — 604-type consensus set | 23.18% / 6.17% | **21.36% / 5.25%** |

⚠ **Two stages now change the token count**, which matters if you consume
`analyze` output positionally. -гүй splits into two words and ч merges into the
word before it. The directive -руу did this already in 0.2.0, so it is not new
behaviour, but it is newly common. Offsets still tile the input; concatenating
every `text` no longer reproduces it.

### Fixed — where Cyrillic and bichig disagree about word boundaries

- **The negative -гүй is two words** (`üγei`), ruled 2026-08-03 on five stems
  chosen to span the range from "obviously two ideas" to "surely one word by
  now" — мэдэхгүй, хэрэггүй, дургүй, үнэгүй, болоогүй. The answer was **space,
  all five**: a rule, not a list. Note the Cyrillic loses a letter the bichig
  keeps, so the emitted second word is **үгүй**, not the three letters peeled.

  The gate is deliberately weaker than the directive's, and it was measured
  rather than reasoned. Over all 641 single-word harvest rows ending in -гүй,
  requiring an attested host recalls 47.5%; requiring only that the whole word
  be unattested recalls **100.0%** and breaks no attested fusion. The fused
  class is held by that first test alone, because every member of it —
  the -нгүй adjectives (бишрэнгүй, хичээнгүй), the lexicalised бүсгүй, аягүй —
  is an attested row in its own right. The residual is stated rather than
  hidden in `clitics.ts`: an **unattested** -нгүй word would split, and -нгүй
  is productive.

- **The particle ч attaches with MVS, and takes its form from the word before
  it** — `ču` after a masculine host, `čü` after a feminine one (reader,
  2026-08-03). What we emitted before was worse than a wrong letter: a
  free-standing `či`, which **is the pronoun чи, "you"** — the old output
  substituted a different word into the sentence. This is the first thing in the
  pipeline to carry harmony across a token boundary. л is deliberately not
  included; it was never asked of a reader directly.

### Fixed — the oblique pronoun stems, ruled 2026-08-04

Ranking running text by frequency put these at the top of what the converter
still guessed at, and they fail structurally rather than for a missing word: чи
becomes чам-, би becomes над-/нам-, and no amount of guessing gets from one to
the other. Six forms went to a reader; seven more stems were settled from data
already held. Together about **6,100 corpus tokens**.

| | was | now | occurrences |
|---|---|---|---|
| чамайг | `čama-yi` | **`čimai`** | 1,967 |
| намайг | `nama-yi` | **`namai`** | 1,904 |
| чамдаа | — | **`čim-a-du-ban`** | 1,010 |
| чамд | — | **`čim-a-du`** | 891 |
| чамайгаа | `čamai-ban` | **`čimai-ban`** | 795 |

The accusatives are solid, one word. The reader's own note on why: `čima-yi` is
technically correct and follows the тийн ялгал, but the one-word form is the
traditional spelling and is what carried over. Also added: над `nada`, түүн
`tegün`, үүн `egün`, тэдэн `teden`, тан `tan`, миний `minu`, чиний `činu`.

The chachlag is **retained under every suffix** — чамаас is `čim-a-ača`, from
one row. That was corrected on 2026-08-06, two days after the ask, and it is
worth recording why the ask missed it: the чамд question offered `čima-du`,
`čimad` and `čimada`, and **none of the three carried a chachlag**. The reader
picked the best available option, which was then read as a ruling on a
chachlag they had never been shown. It took a second look at running output —
*"for some reason the chachlag got lost… чам = čim-a"* — to surface it.

The release originally shipped a `bare-form key on LexiconEntry` todo built on
that misreading. There was no conflict to solve: retention is the rule, as
хойноосоо `qoin-a-ača-ban` and зорилгоор `ǰorilγ-a-bar` already asserted.

### Fixed — smaller, all reader-ruled

- **-лаа/-лоо/-лээ/-лөө is the past tense.** Verb gold's `past-or-nominal`
  bucket goes **12.5% → 87.5%**.
- **ш is ᠰ in four lexicon rows**, and **чоно takes the chachlag** (2026-08-04).

### The pre-release spot-check, 2026-08-06

A reader reviewed the diff against 0.2.1 before this shipped. **No regressions**
— every word ruled wrong was already wrong in the published version, and six
verdicts confirmed changes made here (мэдэхгүй splitting, шүү `siü`, байлаа
`bail-a`, авлаа `abul-a`, хөгжсөн `qöγǰiγsen`, парламентын `parlamēn1t-un`).

Three words fixed as rows: дизайн `d1izain1` (a loanword carrying two FVS1s),
боловч `bolbaču` (the concessive converb had been read as a verb ending), and
хомхой `qomuqai`.

Eleven more are recorded as failing `it.todo`s instead of fixed, because they
are one defect rather than eleven. The reader ruled on **inflected** forms while
the bare stems were already right — хэмжээ is `qemǰiy-e` but хэмжээнд came out
`qemǰen-dü` against the correct `qemǰiyen-dü`; үнэ is `ün-e` but үнийг was `ün-i`
against `ün-e-yi`. **The stem is in the dictionary, correct, and attaching a
suffix throws it away.** Two things ride on that: the **тогтворгүй н**, which
the reader flagged unprompted three times and which `LexiconEntry.hiddenN`
already records with no code reading it, and the epenthetic vowel. `docs/rulings.md`
has the full list.

### The measurement layer

**A parallel corpus, and the first token-weighted number this project has had.**
79,071 lines of Cyrillic|bichig from `tugstugi/mongolian-nlp` — 451k tokens,
49k types, verified pure Unicode with **zero PUA** on import. `pnpm build &&
node scripts/eval-corpus.mjs` scores against it, weighting each word type by how
often it actually occurs.

That closes a hole the docs had already named: every fixture in the repo is a
*type* list, and a type list cannot see a guesser fix land. The two numbers
diverge hard — **33.1% of types are right against 64.6% of tokens** — and the
per-tier slice says where the loss is. As shipped in this release:

| tier | token accuracy | share of running text |
|---|---|---|
| `lexicon` | 80.0% | 29.4% |
| `harvested` | 75.1% | 49.4% |
| `guess` | **18.5%** | **21.1%** |

⚠ The silver is **silver**, same trust tier as `harvested`. A disagreement is
a ranked question, never an error.

**Three guesser fixes, each with zero counterexamples in the attested data.**
Native з is ᠵ (`ǰ`) and never the galig ᠽ (695/726 rows, 0 counterexamples);
Cyrillic й is ᠢ (`i`) and never ᠶ (395/400 word-final, 0); н before г or х is ᠩ
(`ng`) (249/253 and 93/97). The first two were producing forms that could not be
Mongolian at all — зүрхний came out as ᠽᠦᠷᠬᠨ᠎ᠦ, with a foreign letter inside a
native word.

The н rule was **scoped by measurement rather than plausibility**: every
following consonant was counted separately, and only the two velars are clean
(нч is 22%, нд 14%), so даанч stays lexical instead of being swept in.

Effect: 3,693 of 43,257 words change; 439 occur in the corpus, worth **1.66% of
running text**. Guess tier 14.1% → 17.3% token accuracy, overall 61.5% → 62.3%.

**Wiktionary evaluated as a data source and rejected.** `scripts/crosscheck-wiktionary.mjs`
reports 964 agreements and 110 conflicts against the kaikki.org extraction. It
is not imported: as a tier it would add 31 words worth 0.078% of running text,
17 of them affix headwords that would corrupt stem lookups, and where it
disagrees with `harvested` a third source sides with harvested 37:18.

**A benchmark that can sit beside a published number.** `scripts/benchmark.mjs`
scores WER and CER on a **two-silver consensus set**: the 684 word types that
The silver and Inner Mongolia University's converter both answer and our lexicon
does not contain. The two agree with each other on **604 (88.3%)**, and that
consensus is the benchmark; the 80 contested types are excluded.

| system | types | WER | CER |
|---|---|---|---|
| ours — all | 604 | 21.36% | 5.25% |
| ours — where a lexicon tier fired | 541 | **13.49%** | **3.24%** |
| ours — where the guesser fired | 63 | **88.89%** | 23.24% |
| model v3 alone — all | 604 | 21.52% | 4.67% |
| model v3 — where the guesser fired | 63 | **31.75%** | 7.47% |
| **hybrid — model only on the guessed slice** | 604 | **15.40%** | **3.67%** |
| *Transformer, Na et al. 2022 — different data* | *5,232* | *16.92%* | *3.15%* |
| *joint-sequence n-gram, same paper* | *5,232* | *22.63%* | *4.20%* |

Indicative, not a head-to-head — the published rows use dictionary headwords on
a random split, not inflected forms in running text. What it supports: where we
have data we are competitive with published neural work; where we guess we are
catastrophic; and the guesser is the entire gap.

**The model rows close that gap and are a clean test** — all 604 types are held
out of training by Cyrillic surface form, with a leak assertion before the export
writes. The guessed slice goes **88.89% → 31.75% WER**, and the hybrid —
dictionaries on data-backed types, model only where the pipeline would guess —
takes the whole set **21.36% → 15.40%**, token-WER 18.58% → 12.31%. The model
*alone* is 21.52%, so neither component is close to the combination. Nothing here
ships: ruled 2026-07-30, the model is never in the npm package.

**Retracted:** rulebook §2.3.1 was misread earlier the same day as saying the
pronoun case forms should be fused. The silver attests them MVS-connected and the
reader's бидэнд verdict confirms the detached `biden-dü`. Nothing shipped on it.
The real defect there was the oblique stem (`čima`/`nama`, not `čam`), ~6,100
tokens — queued for a reader verdict rather than guessed at, and answered on
2026-08-04. It ships in this release; see the pronoun section above.

### Also in this release — the rulebook round, prepared 2026-07-31

**The 2026 national orthography rulebook, read end to end.** 66 scanned pages
that had sat unread for a day. It is *adopted*, not draft — Хэлний бодлогын
үндэсний зөвлөл, 2026-02-11, resolution 02, ordered followed by everyone — which
makes it the highest-authority source this project has. The extraction lives in
`@gege-mn/mongol-bichig`'s `references/rulebook-2026.md`.

Accuracy, both builds scored on the same 1,884-form fixture: inflected gold
**1,010 → 1,083 (53.6% → 57.5%, +73 forms)**, verb gold **91 → 94 (46.2% →
47.7%, +3 forms)**. The fixture itself grew 1,768 → 1,884 during this release, so
neither figure compares to anything published earlier. The harvested lexicon grew
**8,680 → 9,048 rows**, and **4,184 corpus words — 10.2% — change output.**

Almost all of the +73 is coverage rather than cleverness: withdrawing the ГА
repair let 368 previously quarantined rows import, and those rows then answer
questions the pipeline used to guess at. The rule fixes themselves are worth
little on these fixtures — the converb and -в fixes move both by **0.0pp**, the
guesser fix by +1 and +2 — because both fixtures are lemma-derived and cannot
see the things those fixes touch. Corpus-side the same work reads very
differently: words ending in a shape no native word has went **784 → 41**, and
the twelve reader-ruled function words below cover 36,422 occurrences in a 24M
corpus. The bottleneck remains missing stems (79 of 97 verb-gold guess failures
never segment at all), not missing rules.

The appendices were the part of the rulebook that had not been read. They are
five closed inventories — 113 pronoun forms, 144 particles and conjunctions, 59
forms of гэ- — and they are aimed squarely at that bottleneck. Reading them is
in progress; what shipped here is the one fix that fell out as a *rule* rather
than a word list.

#### Fixed — a rule we had backwards

- **ГА after a д/с дэвсгэр: withdrawn.** `repairDevoicedGa` rewrote ХА → ГА
  across 224 harvested rows on the strength of six reader answers. Rulebook
  §2.1.2.3 says the opposite outright — "ᠳ (-д), ᠰ (-с) дэвсгэрийн дараа дуутай
  ᠭ (-г) гийгүүлэгч орохгүй" — and gives **тосгон** and **сэтгэл** as two of its
  four examples, both of which we had been rewriting. 221 rows revert; 368
  further rows that the repair had been pushing into round-trip or lint failure
  now import cleanly.

  тоосго remains `toγusγ-a` as an explicit **curated lexical exception**, on the
  reader's direct 2026-07-29 verdict for that word. Whether it is genuinely
  exceptional is open.

#### Fixed — the imperfective converb had one form and needs two

- **-ж and -ч are one ending, selected by the stem** (§2.2.2/16): the -ж form
  after a vowel or зөөлөн дэвсгэр, the -ч form after a **хатуу дэвсгэр**
  (б, г, р, с, д). The Cyrillic letter does not decide — босож is spelled with ж
  and is `bosču`, because `bos` ends in с.

  So босож `bosǰu` → **`bosču`** and нисэж `nisǰü` → **`nisčü`**, both of which
  `verb-suffixes.ts` had already named as the attested forms while leaving them
  "to the generator", which never did it. And **авч, сурч, өгч now convert at
  all** — bare -ч had no rows, because mining could not separate the converb
  from the agentive noun-former. The rulebook separates them by condition rather
  than by counting: the converb -ч occurs only after a хатуу дэвсгэр, the
  agentive -аач⁴ only after a vowel, so ажиллаач is still not a converb.

- **The -в past's linking vowel is a rule, not a lexical split** (§2.2.3/39–40):
  a **б-final** verb stem inserts у/ү. авав `abba` → **`abuba`**, while болов
  `bolba`, төгсөв `teγüsbe` and сонсов `sonusba` stay flat. One condition, all
  four attestations. This had been recorded as an irreducible disagreement
  between two reader-confirmed forms.

#### Fixed — the guesser was spelling words in a shape no native word has

- **No word ends on a bare ᠬ/ᠴ/ᠵ/ᠱ.** The out-of-vocabulary guesser
  transliterates letter by letter, so a Cyrillic-final х/ц/ч/ж/ш came out as a
  bare `q`/`k`/`č`/`ǰ`/`š`. Of the 2,460 harvested rows whose Cyrillic ends that
  way, exactly **10** have a Classical form ending in a bare consonant, and all
  10 are loanwords or letter names (амбиц, марш, перц, польш, and the letters
  themselves). It was affecting **647 of the 41,220 corpus words — 1.6% of
  running text** — including every unknown verb in its dictionary form, since
  Cyrillic -х *is* the infinitive: тэгэх was `teγeq`, now `tegekü`.

  The vowel is measured, not guessed: -х is `qu`/`qü` (98%, harmony-selected),
  -ч `či` (98%), -ц `ča`/`če` (95%, harmony-selected), -ж `ǰi` (73%), -ш `si`
  (89%). After the fix 41 corpus words still end bare, and they are the
  loanwords and letter names that should — техник, франц, ххк, ж, х.

  This is a rule and not a lexical row because the evidence is structural rather
  than a word list, and because its only exceptions are the one class the
  project already refuses to generalise from.

- **A native ц is ᠴ, not ᠼ.** ᠼ is the foreign-word letter; 581 of the 598
  native harvest rows containing a ц and no ч spell it ᠴ — арц `arča`, авцалд
  `abčaldu`. The 17 that use ᠼ are loanwords, which are curated rows and never
  reach the guesser.

- Measured and **rejected**: mapping medial ш → `si` throughout. The share looks
  compelling (570 of 710 native rows spell a ш as `s`) but the naive rule scores
  *worse* — inflected gold 1,083 → 1,082 — because it misses the epenthetic
  vowel that travels with it (агшаа is `aγsiγ-a`). Noted in `stem.ts` so it is
  not rediscovered and re-tried.

#### Fixed — twelve function words, from the first reader pass over the appendices

- A reader ruled on the appendix entries where our output and the rulebook scan
  disagreed. Twelve forms corrected, together **36,422 occurrences** in a
  24M-token corpus: шүү `šü1`→**`siü`** (23,049), гэлээ `γel-iyen`→**`gel-e`**
  (5,415), яах `yaqu`→**`yaγaqiqu`** (4,389), гэжээ `γeǰü-ben`→**`geǰei`**
  (2,610), гэмээр `γem-iyer`→**`gemer`**, бээр `bui-ber`→**`ber`**, plus гэгд,
  гэцгээ, гэмээ, бүлт, пиг, гуд.

  One bug produced most of them: the segmenter read a long-vowel **verb** ending
  as a stem plus a **case** ending, so гэмээр parsed as гэм + instrumental.
  Neither gold set moves — both are lemma-derived and cannot see function words,
  the same blind spot documented above for the guesser.

- **Retracted before it shipped:** the бид- oblique stem. I had read the scan as
  `bidan-` and was about to import eight rows; the reader's verdict is that our
  `biden-` was already right. Recorded in `docs/rulings.md` as the argument for
  rendering a transcription and showing it rather than trusting it.

- Not swept, on purpose: 152 harvested rows spelling ш as ᠱ. The reader ruled on
  **шүү** alone, and the standing 2026-07-29 rule exempts "traditional spelt
  words" — generalising one answer to 152 rows is exactly what `repairDevoicedGa`
  did and had to retract. шинэ stays ᠱ for the same reason.

#### Added

- `VerbSuffixEntry.after` and `.linkingAfter` — the verb-side twin of
  `SuffixEntry.after`, so a verb ending can select its allomorph from the
  Classical stem's дэвсгэр. New `StemCondition` value `'b'`.
- `src/allomorph.ts` — `allomorphFits` moved here so both the noun and verb
  paths can use it without an import cycle. Still re-exported from
  `generate.ts` and the package root; no public API change.

#### Changed

- The HTML review pages (`build-spotcheck.mjs`, `build-ask.mjs`) now use the
  gege house style and **embed** Noto Sans Mongolian rather than naming fonts
  and hoping. A reader's verdict should not depend on which Mongolian font their
  machine happens to have, and those fonts disagree.

#### Known

- `pnpm lint:output`: **17** `unknown-suffix` warnings as of release, all one
  class — `-лаг⁴` on a chachlag stem (ᠲᠣᠭᠤᠰᠭ᠎ᠠᠯᠢᠭ). Pre-existing since
  2026-07-30; it was 15 when this entry was first written, and the two that
  joined are rows added later in this release (гэлээ `gel-e`, чиний `činu`)
  falling into the same class. **Zero errors.** Not a new defect.
- Four unresolved contradictions between the rulebook's залгах/дагуулах split
  and mongol-bichig's suffix registry — руу/рүү, -дахь, -дугаар, -дэг. Listed
  with citations in `references/rulebook-2026.md` §2.3. The directive is the
  consequential one and needs the owner's call.

## 0.2.1 — 2026-07-31

The one item 0.2.0 shipped without, now that its dependency exists.

### Added

- **кирилл converts.** `khirill`, using the loan letter KHA (U+183B) — so
  кириллээс is `khirill-eče` rather than the invented `kirilles`, and the
  sentence that opened this whole line of work converts end to end.

  Ruled 2026-07-30, and blocked until now for a good reason rather than an
  oversight: every row in `lexicon.ts` is written in romanization and
  `test/data.test.ts` converts all of them, so a word needing a letter the
  romanizer could not spell could not be added at all. `@gege-mn/mongol-bichig`
  0.2.2 added the spelling; this uses it.

  It is a **loanword**, so it is exempt from the rules native words follow and
  generalises to nothing. See the loanword footgun in `CLAUDE.md`.

### Changed

- Requires `@gege-mn/mongol-bichig` **^0.2.2** (was ^0.2.0).

No accuracy change: 67.7% per word, 95.3% oracle, both unmoved. One loanword
does not shift an aggregate, and saying so is the point — the verification that
matters is that the word is right, not that a number moved.

## 0.2.0 — 2026-07-31

**Everything here came from one person hooking 0.1.0 to a UI and pasting two
failing sentences.** Five failures, five different root causes, and the rulings
that followed settled four more. That is the shape of this release: not an
optimisation pass, but a reader's corrections turned into rules.

Accuracy: **67.2% → 67.7%** per word, oracle **94.7% → 95.3%**, and the guess
tier scores above zero for the first time — **0.0% → 5.2%** on the inflected
gold set. Whole-sentence output is still **4.0%** on nine-word sentences; this
release does not change that it is a candidate generator for a human-in-the-loop
editor.

> Read those numbers skeptically. The gold sets contain **zero** forms ending
> in -в, -гч or a directive clitic, so they structurally cannot see most of what
> changed here. The verification that matters is that the reader's own examples
> now convert correctly; the aggregate is a floor, not the measurement.

### Added — the directive (чиглэхийн тийн ялгал)

`-руу/-рүү/-луу/-лүү` converts, having been excluded in v0 as having "no clean
Classical form". It has a very clean one; it is just not a suffix.

- **One Classical form for all four Cyrillic surfaces** — `uruγu`, whatever the
  stem's harmony. There is no feminine variant, so the harmony reflex every
  other case needs produces a form that does not exist here.
- **Always two words in bichig, joined by a plain space**, so it is a new
  token-level stage (`splitClitics`) rather than a suffix row: `assemble` joins
  with MVS and `toScript` cannot spell a space at all.
- **Either spelling is accepted in Cyrillic** — монголруу and монгол руу
  produce identical output.
- The л-forms are used only after a host word ending in р. That rule is what
  makes the split safe: swept over 26,876 single-word types, it produces no
  split that should not happen.

### Added — four suffixes and a repair

- **`-в` past tense**: болов `bolba`, ирэв `irebe`. Reader-confirmed, mined at
  60 of 70 forms on a known verb stem. No linking vowel, which is measured
  rather than assumed — авав `abuba` is the one attested exception and ships as
  a curated whole form rather than as a rule.
- **`-гч` agent noun**: хөрвүүлэгч `qörbeγülüγči`. 162 of 162 forms on a known
  verb stem, with the linking vowel unanimous the other way. It had been
  excluded by an objection about bare `-ч`, which is a different suffix that
  merely ends in the same letter.
- **`-лаг⁴` adjectival** → `lig`, attached: загварлаг `ǰaγburlig`. The second
  suffix whose four Cyrillic surfaces collapse to one bichig form.
- **The `-нх-` possessive stack** is the genitive followed by the reflexive,
  and the Cyrillic х has no bichig counterpart: ангийнхаа `angγi-yin-iyan`.
  New `case-possessive` suffix category, because its allomorph conditions are
  the genitive's three-way set rather than the reflexive's two-way one.
- **No variation selector on native words**: даа/дээ/дөө, and дахь/дэх where
  the canonical registry already said `daqi`/`deqi`. Deliberately **not**
  generalised to the other 467 harvested rows carrying one — дал keeps its
  selector, because `d1al` is the palm tree and `dala` is the number 70.

### Fixed

- **A guessed whole word no longer outranks a guessed stem plus a real suffix.**
  The suffix penalty exists so a dictionary entry beats an over-segmented
  reading of itself; when the whole-word reading is *also* a guess it ran
  backwards, protecting the weakest claim the pipeline can make. This is what
  moved the guess tier off zero.
- Curated stems the aligned corpus already had and nothing had ever imported:
  сүүлч `seγülči`, яруу `iraγu`.

### Changed

- `VerbEndingKind` gains `agent`; `SuffixCategory` gains `derivational` and
  `case-possessive`. Additive for consumers that read them.
- `splitClitics` is exported. It rewrites the token stream, so an attached
  directive becomes two word tokens with an inserted space over an empty span —
  offsets still tile the input, but `tokenize`'s round-trip no longer holds
  across this stage, by design.

### Not in this release

**кириллээс.** A reader confirmed that кирилл takes the loan letter KHA
(U+183B), and `@gege-mn/mongol-bichig` 0.2.2 adds the romanization for it
(`kh`). The row lands here once that version is published.

## 0.1.0 — 2026-07-30

First published release. The pipeline has been complete and tested for a while;
what changed is that the *data* is now large enough, and measured well enough,
to be worth putting in someone's hands.

**Read the accuracy section of the README before using this.** It is a
candidate generator for a human-in-the-loop editor, not an unattended
converter: **67.2%** correct per word, but only **3.8%** of nine-word sentences
fully correct, because accuracy multiplies.

> This entry was dated 2026-07-27 and describes work through 2026-07-30. The
> release was prepared, not published, on the 27th — nothing ever reached the
> registry — so rather than leave a phantom version behind, the entry was
> amended to describe what actually ships. Every figure in it was re-derived
> from `node scripts/eval.mjs --coverage --sentences` on the day of release,
> not carried over.

### Rulings from a bichig reader, 2026-07-29

The most valuable three days of the project so far, and worth its own section
because these are the only changes here graded against a human rather than
against another converter. Each was asked as a small batch with controls, and
the controls twice caught the question being wrong.

- **The chachlag** on five curated nouns — нэр `ner-e`, ах `aq-a`, тал `tal-a`,
  шар `šir-a`→`sir-a`, бага `baγ-a`. Our lexicon had been contradicting its own
  documentation, which cites `qar-a` as the example. Curated-tier top-1
  67.8% → 72.2%. **Deliberately not generalised**: an independent source says
  *joined* for twelve of the other 28 bare-vowel rows, and the reader's caveat is
  that some words carry both spellings with different meanings.
- **A linking vowel** on the present-future and past-participle suffix rows, so
  a consonant-final stem takes u/ü: авна `abun-a`, бэлдсэн `beledüγsen`. Verb
  gold 42.6% → 47.2%. Held back from a measurement-only decision on purpose —
  nearly all the evidence was the eval set, so applying it without a human would
  have been fitting to the test set.
- **ᠰ against ᠱ.** The double-dotted ᠱ is only for foreign or traditionally
  spelt words, so native words take plain ᠰ where Cyrillic writes ш. The reader
  supplied a **minimal pair** — ᠰᠢᠷ᠎ᠠ the colour against ᠱᠠᠷ a noise — and both
  readings now ship.
- **The devoiced ГА was never a rule.** The harvest wrote ХА after с/ш/т/д where
  the Cyrillic has г (асгах `asqaqu`) but ГА after л, which looked like a
  devoicing rule and was not. 224 harvested rows corrected. The reader's
  explanation is the useful part: ГА is drawn with the double dot before a vowel
  and without it elsewhere, and older encodings reached for ХА to obtain the
  undotted shape — a *rendering* problem solved by picking a different
  *character*, which is the same class of error as the Menksoft PUA this package
  exists to avoid.
- **Foreign words are exempt from all of this**, and no rule may be derived from
  them. массаж is ᠮᠠᠰᠰᠠᠵᠢ because it has a traditional spelling; целлюлоз is
  ᠼᠧᠯᠯᠶᠦ᠋ᠯᠦᠽ and ends bare because it has none.

`docs/rulings.md` carries the evidence and the open questions;
`test/rulings.test.ts` asserts every verdict.

### Added

- **`verbForm` on `AnalyzedToken`**, and the `verbEnding()` function behind it.
  Recognises ten Khalkha verb endings and converts none of them — the package
  has no verb morphology. The point is to distinguish "unknown noun, fixable
  with a dictionary row" from "verb form, structurally out of scope". Read it
  with the winning candidate's `provenance`: verb-shaped **and** `guess` is
  ~13% of running-text words and is where output is most likely to be silently
  wrong.
- **`digits` and `punctuation` options**, both defaulting to `'ascii'`. The
  reference charts record U+1810–1819 as "less used now" and UTN #57 §2.2.3
  defers every numeral specification, so converting by default would invent a
  convention. Digits apply uniformly across the document, because mixing the
  two systems is what gege-linter's `digit-consistency` flags.
- **Bare `-г` accusative** after a vowel-final Classical stem, with a segmenter
  guard so it cannot carve up the habitual participle (ажилладаг is `-даг`, not
  `aǰilla` + dative + accusative).
- `--sentences` on `scripts/eval.mjs`, reporting per-sentence rather than
  per-word accuracy.

### Changed

- **Segmentation is constrained by grammar.** The Khalkha suffix chain is
  stem + plural + case + reflexive, and orders the language cannot form are now
  refused. A word ending `-аад` is the perfective converb; it was being read as
  reflexive `аа` + dative `д`, a chain Khalkha does not build, for 66% of such
  tokens at up to 70% confidence. хүлээгээд went from a confident
  `qüliy-e-ben-dü` to an honest `küleged` guess.
- **`src/romanize.ts` is now a re-export** of `@gege-mn/mongol-bichig`, which
  is this package's single runtime dependency. It was a verbatim copy and had
  drifted within a day of being made.
- **`repairDevoicedGa` is exported** from `src/orthography.ts`. It takes the
  Cyrillic *and* the script, because the correction is not decidable from the
  script alone — ХА after с is legitimate wherever the Cyrillic really has х
  (амсхий, зайлсхий, гүдэсхэн), and a script-only rule fixes 221 rows and breaks
  16. Anyone importing data from the same sources needs it; it is deliberately
  not folded into `normalizeOrthography`, which is script-only by contract.
- **The perfective converb `-аад/-ээд` is now converted**, which the suffix table
  previously refused for want of any attestation. A lemma dictionary structurally
  cannot contain an inflection, so "zero attestations" was a property of the old
  source rather than of the language; the sentence alignment attests it 83 times.

### Fixed

- Contracted Cyrillic allomorphs after an и/й-final stem (ангийн, ангиар,
  морьтойгоо), which accounted for ~84% of forms unreachable even with a
  perfect stem.
- The unstable vowel Cyrillic drops before a vowel-initial suffix (ажлаас →
  ажил, мэргэжлийн → мэргэжил). Worth +11pp top-1 on its own, and a bichig
  reader ruled all eight sampled cases in our favour.

### Known limitations

Ordered by measured cost; the README carries the evidence for each.

- **Verb morphology exists but is thin, and the gap is stems rather than rules.**
  1,717 verb stems derived from `-х` infinitives already in the dictionary, plus
  22 mined suffix rows. On the held-out 197-form verb set it scores **47.2%**
  overall — but 87.5% where the stem is curated and 91.4% where it is harvested,
  against **3.0%** where the stem must be guessed. Of the 97 failures, **80 never
  segment at all**, meaning no stem was found under any reading. The suffix rows
  that would convert those words are already present and fire the moment the
  stem exists. 24.8% of running-text words carry a verb ending.
- The guesser does not reverse the `V+γ/g+V` long-vowel contraction, because
  the origin is **not derivable from Cyrillic** — no rule over 1,191 stems
  exceeds 54%.
- Ranking is a static unigram prior with no context, and a whole-word entry can
  lose to a segmented reading of itself.
- Bare genitive `-н` is unhandled. Cyrillic `-н` is at least two suffixes — a
  contracted genitive (далайн) and a noun-to-adjective derivation (ус → усан) —
  and separating them needs stem metadata the dictionary does not yet carry.
- Loanwords requiring variation selectors cannot be emitted at all (автобус),
  ~6% of harvested rows.
- Clitics (нь, минь, чинь) tokenize separately; MVS-joining is unimplemented.

### Notes on the numbers

**What is measured, and against what.** 1,498 held-out inflected forms and
3,000 sentences of real running text, scored against **another converter** —
not against a bichig reader. A reader has now ruled on roughly 70 words across
several sessions; those verdicts are `test/rulings.test.ts`, the highest
authority in the suite, and where they disagree with the harvested tier the
reader wins.

Graded in **script**, never in romanization: γ/g and q/k are harmony-selected
allographs of one letter, so comparing romanized strings invents disagreements —
it once scored the curated lexicon at 56% when the real figure was 83%.

**Three ways these numbers have misled, all now guarded against.**

1. Coverage **fell** 74.0% → 73.2% when the suffix-order rule landed, and the
   fall *was* the fix: those parses had been resolving to real dictionary stems,
   so 0.8pp of the old figure was measuring chains Khalkha cannot form.
2. The noun gold set once rated a change at +1.5pp that corpus scoring showed to
   be a net regression. Suffix-table changes are scored both ways now, and there
   is a separate 197-form held-out **verb** set, because the two answer different
   questions and are not comparable.
3. The suffix miner was reading the held-out gold set — every one of its 197
   forms — so a +5.5pp verb result was measured on the data the rows were
   derived from. It now excludes held-out forms by default. **A figure produced
   before that fix is not out-of-sample.**

Regenerate everything with `node scripts/eval.mjs --coverage --sentences`, or
`pnpm status` for the per-tier and per-ending breakdown. This table drifted a
full release once because the numbers were quoted from memory instead of from a
command — and every one of them was *understating* the converter by the end.
