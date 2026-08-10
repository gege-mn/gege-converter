# Where to pick up next, and the known gaps

<!-- Background doc. Not loaded into context automatically. -->

Read this when choosing what to work on. Ordered by measured value, not by
appeal.

## ⭐ Where the remaining loss actually is — measured 2026-08-10

**This section supersedes the "morphophonology, not a wordlist" thesis below.**
That thesis was right when it was written and it has been *spent*: the stem
layer took the class it named, and what is left underneath is a different
problem with a different answer.

Numbers to anchor against, all from `node scripts/eval.mjs` on the working tree
of 2026-08-10: detached gold **75.9%** (1,222 / 1,611), oracle 95.3%, whole
fixture 64.9% (1,884). See `docs/data-and-accuracy.md` for the other commands
and for the two scripts that both say "top-1" and disagree by 34 forms.

### The failure clusters

Every detached failure was assigned to exactly one cluster — the clusters are
mutually exclusive and this is the whole failure set, not a sample. Measured
over the **423 failures** left at the session's starting point of 73.7% top-1
on the 1,611 detached forms; `pp` is that cluster's share of the 1,611, i.e.
what taking it whole would be worth.

| cluster | n | pp | what the fix is |
|---|---|---|---|
| Loanword transliteration and FVS | 145 | 9.00 | lexicon rows plus a reader verdict. ⚠ rule-from-a-wordlist trap |
| Plural allomorph and peeling | 58 | 3.60 | ⚠ **tried and reverted** — see below; needs the reader, not a row |
| Linking г | 43 | 2.67 | **done this session** — see below |
| Residual chain-shape mismatches | 46 | 2.86 | ~38 separate causes; not a lever |
| Stem in no tier at all | 40 | 2.48 | data rows |
| Stem-final н over- or under-applied | 20 | 1.24 | an additive genitive candidate |
| Stem present under another Cyrillic key | 20 | 1.24 | partly taken by the н case below |
| Adjectival `-тай³` | 16 | 0.99 | **not a gap** — a convention question, see below |
| Accusative before reflexive | 11 | 0.68 | one suffix row |
| Stem-final и/ь not restored | 9 | 0.56 | a restoration rule |

The ten clusters account for 408 of the 423; the remainder did not group.

### ⚠ The plural cluster was attempted on 2026-08-10 and reverted

Worth reading before anyone tries it again, because the evidence for it is
strong, entirely one-sided, and wrong.

Split `after: 'consonant'` on `-ууд/-үүд` into `consonant-not-n` + `n`, so an
NA-final stem takes `nuγud` with the vowels. The gold set is emphatic: n-final
stems take `nuγud` **37 times and the bare `ud/üd` zero times**. The change
duly fixed настангууд (`nasutan-ud` → the gold's `nasutan-nuγud`) with no gold
regression anywhere.

It broke a **reader-confirmed** ruling. мэргэжилтнүүд is `merγeǰilten-üd`,
reader-supplied 2026-07-26 for a word Tungaamal has no row for — an NA-final
stem taking the bare `üd`.

**Nothing available to `after` separates the two.** настан and мэргэжилтэн are
the same morphology, an agentive in -тан/-тэн; the only difference is which
source answered. `test/rulings.test.ts` outranks the gold by construction, so
the change was reverted and the reasoning written into `src/data/suffixes.ts`
where the next person will meet it.

What this really found is that **~37 gold rows disagree with the reader about
the plural of an NA-final stem**. That is an ask-page question, and until it is
asked this cluster's 3.60pp is not available at all — some unknown share of it
is the gold being wrong.

⚠ **The linking-г row is marked done and the table is otherwise as measured
before that fix.** It is kept whole rather than re-derived because the *shape*
is the finding and re-running it after each fix would cost more than it tells
you. Re-derive it when the top-1 number has moved by several points, not
between items.

### The thesis that is now spent

Of the 134 rows that had the suffix chain right and the stem wrong when the
clusters were assigned, **zero** were a lost intervocalic γ/g contraction and
**zero** were a bad o/u fold on a native word. `src/stem.ts` takes both classes
now. (`eval.mjs` reports 128 in that bucket at the end of the session; the
audit was done at 134 and the difference is the linking-г fix, not a
re-classification.) What is left in the bucket is a wordlist-and-loanword
problem: the largest single cluster, at 9.00pp, is foreign words and their
variation selectors.

That is uncomfortable, because it is the one class this project is forbidden to
generalise from. CLAUDE.md's rule stands unchanged — *never derive a rule from
foreign words* — so 9.00pp is **145 lexicon rows and one reader verdict**, not a
transliteration rule waiting to be written. Anyone who finds a pattern in that
cluster has found the reference converter's transliteration convention, not
Mongolian.

### ~1.8pp of the "errors" may not be errors

28 of the 423 failures (**1.74pp of 1,611**) become exactly correct once FVS1–4
are stripped from both sides, and the source contradicts itself across the
paradigm — автокран is `aü1t1okhran1` bare and `aü1t1okhran-iyar` inflected.
`docs/rulings.md` already records the reader saying of `khlü1b` that *"fvs1
isn't necessary"*.

**This is one unasked reader question.** Queue it as an ask; do not treat the
1.74pp as available accuracy, and do not strip FVS to collect it.

### Done this session (2026-08-10)

- **`dropLinkingG` in `src/stem.ts`**, mirroring `dropLinkingN`. далай + аар is
  written далайгаар; the segmenter peeled only `-аар`, hit the unmatched далайг
  and read the linking г as a **bare accusative**, emitting `dalai-yi-bar`.
  Measured in isolation: detached gold **68.4% → 71.1%**.
- **Extended to allow н before the г** (булангийн), worth a further **+0.3pp**
  and closing a standing `it.todo` (байшингийн). One rule covers both because
  the restored key is *looked up* and its attested Classical used unchanged:
  булан's Classical genuinely ends in NG (`bulung`) while нян's does not
  (`niyan`), and nothing has to decide which.
- **The `toli` holdout leak**, in `docs/data-and-accuracy.md`.
- **The sentence aligner rewrite**, in `docs/neural-model.md` — 2,037 → 6,217
  word pairs at unchanged precision.
- **Seven reader answers**, in `docs/rulings.md`. `node scripts/eval-rulings.mjs`
  reads **160/160** confirmed; `rulings.test.ts` grew 153 → 174 `same()` rows.

⚠ The two isolation figures above (68.4% → 71.1%, and +0.3pp) are the only
numbers on this page that were **not** re-derived at the end of the session, and
they cannot be without reverting `src/stem.ts`. They are recorded as measured at
the time. The end-state number that *is* reproducible is the 75.9% above.

## ⚠ The `-тай³` 12pp is withdrawn — a reader ruled, 2026-08-10

**Everything below that treats the 273 attached gold rows as ~12pp of available
accuracy is superseded.** The full ruling is in `docs/rulings.md`; the part that
matters for planning:

> both correct, and it's simply a choice. we chose to detach, but we can also
> attach. when attaching, гэдэс жийрэглэх rule apply btw

Three consequences, in order of how much they change the plan:

1. **Those 273 rows are not accuracy.** They encode the reference converter's
   house style on a question that has two correct answers, so matching them
   measures agreement with Tungaamal, not correctness. The fixture cannot score
   this class and should not be read as if it could.
2. **The whole-fixture number moves the wrong way when the output improves.**
   With the залгаж reading as the default, the attached half went 0.0% → 66.7%
   and the whole fixture went **68.2% → 64.9%** when it was reverted — while the
   output got *more* correct, because the standing house choice is дагуулж.
   Read the two halves, never the whole line alone.
3. **Attaching is blocked on гэдэс жийрэглэх, which is unimplemented.** Our
   attached output on a chachlag stem strands the stem's MVS mid-word (санаатай
   → `sanaγ-atai`), the same `unknown-suffix` shape the linter already reports
   for `-лаг⁴`. `pnpm lint:output` went **19 → 38** warnings with залгаж as the
   default and back to **19** when it was reverted. That is the gate: implement
   гэдэс жийрэглэх first, or do not attach.

⚠ The end states are reproducible and were re-derived: whole fixture **64.9%**
(`node scripts/eval.mjs`) and **19** `unknown-suffix` warnings
(`pnpm lint:output`). The залгаж-on states — attached half 66.7%, whole 68.2%,
38 warnings — cannot be re-derived without flipping the default back, and are
recorded as measured at the time.

The залгаж reading ships as an alternative candidate (`OFF_CONVENTION` in
`src/generate.ts`) rather than as a `share`, because `SuffixEntry.share` is
documented as a count over running text and "not a judgement".

⚠ And the corpus could not have settled it anyway, because the reader's answer
is that both spellings are correct — a frequency count cannot rule on a choice.
What the corpus *does* say, over running text with forced pairing (n=791), is
**72.4% attached**. The two derived corpora disagree with each other — 69.8%
attached over 2,407 word-harvest rows against 38.7% over 142 sentence-aligned
pairs — and that inversion is the lemma-list selection bias warned about in the
2026-07-31 section below, measured: the aligned set is the *complement* of the
harvest, so the two are oppositely selected and neither samples text. Quote the
forced-pairing figure; see `docs/rulings.md` for the method.

## ⭐ The stem is the whole game — measured 2026-08-07

One number reframes every item below it. From `node scripts/eval.mjs`, 1,611
detached gold forms:

```
top-1 exact                   1122    69.6%
chain right, stem wrong        169    10.5%
chain wrong                    292    18.1%
no segmented reading            28     1.7%

ORACLE (perfect stem)         1530    95.0%
```

**A perfect Cyrillic stem is worth +25.4 points — more than every other open
item on this page combined.** And the tier split says the same thing twice over:

| stem came from | top-1 |
|---|---|
| lexicon | 83.7% (216 / 258) |
| harvested | 77.9% (890 / 1142) |
| **guess** | **7.6% (16 / 211)** |

The suffix machinery is *not* the bottleneck. "Chain right, stem wrong" is
10.5% on its own — those are forms where we picked every suffix correctly and
still lost, purely on the stem.

> **Update 2026-08-10.** The `toli` tier landed and moved top-1 to **72.8%**
> and coverage to **91.5%**, halving the guesser's share of running text
> (13.0% → 8.5%). That does **not** contradict the section below — the oracle
> barely moved (95.0% → 95.3%), so the +22.5pp still sitting behind a perfect
> stem is untouched and is still the largest item on this page. What the tier
> shows is that the two levers are independent: a bigger wordlist buys ~1.7pp
> and cannot buy the rest, exactly as argued below. Numbers in this section
> predate it. See `docs/data-and-accuracy.md`.

### It is a morphophonology problem, not a wordlist problem

> **Superseded 2026-08-10 — kept because the reasoning was right and the
> measurement that retired it is the interesting part.** The three-row failure
> table below is fixed: сургуулийн is `surγaγuli-yin`, confirmed by the reader
> as answer S1 on 2026-08-10 (`docs/rulings.md`). Of the 134 chain-right /
> stem-wrong rows that remained afterwards, **zero** were a lost intervocalic
> γ/g contraction and **zero** were a bad o/u fold on a native word. The layer
> this section asked for exists, in `src/stem.ts`. What is underneath it is a
> wordlist-and-loanword problem — see the top of this page.

The tempting reading is "add more words". That is not what fails. The stems are
frequently **already in the lexicon and correct in isolation**, and the
inflected form throws them away because *Cyrillic changes the stem's surface
shape before a suffix* and nothing connects the two spellings:

| bare | we emit | inflected | we emit | should be |
|---|---|---|---|---|
| сургууль | `surγaγuli` ✅ | сургуулийн | `surγul-un` ❌ | `surγaγuli-…` |
| дуурь | `daγuri` ✅ | дуурийн | `dur-un` ❌ | `daγuri-yin` |
| морь | `mori` ✅ | морийн | `mor-un` ❌ | `mori-yin` |

So what is needed is a **Cyrillic stem → surface-form** layer (ь ↔ и before a
suffix, and the long-vowel ↔ contracted γ/g alternation), not 50k more
headwords. A bigger wordlist without it inherits the same failure on every new
row.

⚠ **Grade this in script, and only on real forms.** Two ways to get a wrong
number here, both hit on 2026-08-07: comparing romanizations invents
disagreements (хонийн → `qoni-yin` is *correct* but fails a string compare),
and synthesising inflections mechanically produces harmony-violating non-words
(харээс, хэлаас, монголчуудээс) that inflate the failure rate. `eval.mjs`
already reports the oracle on attested forms — use it rather than a new metric.

### Where it should live

The Cyrillic layer belongs in **`~/Projects/mongol-bichig`**, not here.
`src/romanize.ts` already had to be migrated there after a copy drifted within
a day of being made, and `src/data/suffixes.ts` is still duplicated. A third
shared table maintained in this repo would repeat a mistake this project has
already paid for twice.

## Where to pick up next (rewritten 2026-07-31, after the rulebook)

The 2026 national rulebook was read end to end. It is **adopted, not draft**,
and it is the highest-authority source this project has. Canonical extraction:
mongol-bichig `references/rulebook-2026.md`; what it changed here is in
`docs/rulings.md`.

Current: inflected gold **59.4%** over all 1,884 forms, which is **69.5%** of
the 1,611 the eval scores (the other 273 are the attached -тай³ class below, at
0.0%). Verb gold **47.7%** (94 / 197). `check:orphans` at **1.51%** of running
text. Was 57.5% / 67.2% / 2.05% before the тогтворгүй н landed on 2026-08-06.

> **Stale as of 2026-08-10** — kept so the deltas below stay readable. Current:
> whole fixture 64.9%, detached 75.9%, verb gold 50.8%, `check:orphans` 1.30%.
> The commands and denominators are at the top of this page and in
> `docs/data-and-accuracy.md`.

### Where the losses actually are (measured 2026-07-31)

The two fixtures have **different** bottlenecks and should not be pooled.

**Verb gold** — the guess tier is 101 of 197 forms and scores 3.0%. Of its 98
failures, **80 never segment**. But the missing thing is not a root: the 99
unresolvable stems are overwhelmingly *derived* — дарагда, мөрдөгддөг,
солигдож (passive -гд), ойлгуулж, өлгүүлэ (causative), болчихдог, өнгөрчихсөн
(aspectual -чих), маажилца (reciprocal). **37% carry a derivational suffix
whose root we already know.** Across the corpus, 5,878 words (14.3%) carry one
of those markers and **2,727 of them — 6.6% of running text — have no
resolvable stem today.** That is the largest running-text lever identified.

**Inflected gold** — the fixture carries a `detached` flag, and the split is
brutal: `detached: true` scores **67.2%** (1,083/1,611) — **69.5%** since the
тогтворгүй н — while `detached: false` scores **0.0%** (0/273). Every failing
attached row ends -тай/-тэй/-той. 234 of
the 273 are the **adjective-forming -тай³**, which rulebook §2.3.6 says is
*always* залгаж (хэрэгтэй, ёстой, санаатай) while the case-like -тай³ is
дагуулж. We only ever offer the дагуулж reading, so we score zero on the whole
class. It is a missing **candidate**, not a missing rule.

> **Superseded 2026-08-10 by a reader ruling — and the warning below turned out
> to be right for a reason it did not name.** §2.3.6's дагавар/comitative split
> is a fact about morphology and does not decide the spelling: both spellings
> are correct and the choice is house style. So the 12pp was never there to
> bank. The warning's own instinct — offer both readings, check the corpus
> before believing the fixture — was correct, and the corpus check it asked for
> now exists: **72.4% attached over 791 forced-paired tokens of running text**.
> The two derived corpora invert against each other (69.8% over 2,407
> word-harvest rows, 38.7% over 142 sentence-aligned pairs) for precisely the
> reason this warning gave, which is why the running-text figure is the one to
> quote. See the withdrawal section at the top of this page.

⚠ **Do not simply fuse -тай and bank the 12pp.** The fixture is built from a
lemma dictionary, and the only -тай words a lemma list carries as headwords are
the adjectival ones — the identical selection bias that inverted the `-лаа`
reading in 2026-07-27 (see the header in `data/verb-suffixes.ts`). In running
text the same string is often the genuine comitative, where дагуулж is right.
Offer both readings and let the ranker weigh them; do not replace one with the
other, and check the corpus before believing the fixture.

The remaining ~39 attached rows are a different problem: homographs where a
whole word merely looks segmentable — аваар `awar`, гэрээс `γeriyesü`,
бэлчээр `belčiγer`, анхаар `angqar`. Same shape as item 1's prerequisite below.

### The next five, in value order

1. ~~**Тогтворгүй н (`hiddenN`).**~~ **Done 2026-08-06.** Implemented, with the
   reader's own finding-rule as the default behind the flag: *a stem whose
   script form ends in a vowel takes the н*. Inflected gold **67.9% → 69.5%**
   (1,094 → 1,119), `check:orphans` **2.05% → 1.51%** of running text, four
   `it.todo`s closed, one exception found (хэл). Written up in `docs/rulings.md`.

   Two follow-ons it did **not** do, both still open:

   - **The dative side.** Хавсралт 2.1.1 row 2(c) gives тогтворгүй-н words a
     third dative form `-a/-e` alongside `-du/-dü` and `-tu/-tü`. Only the
     genitive was implemented; the dative works today because the н comes back
     through `dropLinkingN`/`unstableNStems` and then takes the ordinary
     `not-hard` allomorph. Whether that is right, or whether these words want
     the `-a/-e` row, is a reader question.
   - **The exception list.** One word needed `hiddenN: false` out of 311 tests
     and a 2,316-word diff. There will be more, and each is a row.
2. **The genitive n on a vowel-final stem** — ruled 2026-07-30, still not
   implemented, and Хавсралт 2.1.1 gives the same two-way choice the reader
   described. Additive: it adds a candidate rather than replacing one.
3. **§2.1.2.4, н → нг before a г/х/н-initial suffix** (хан + гах = хангах).
   Categorical, mechanical, currently not done at all.
4. **The remaining дэвсгэр-conditioned allomorphs**: causative -га⁴/-ха⁴ by д/с,
   passive -д/-т, pluractional -цгаа⁴. The machinery now exists — `after` on
   `VerbSuffixEntry` plus the `hard`/`not-hard`/`b` conditions — so these are
   data rows, not code.
5. **Хавсралт 3–5, the closed inventories.** 113 pronoun forms, 144 particles
   and conjunctions, and 59 forms of гэ-. The largest correct-data import
   available to us, and гэ- alone is the commonest verb in running text.

   **No longer blocked on scan resolution** (2026-07-31). This was listed as
   needing a re-shoot; it does not. The PDF's page images are 1448×2048 JPEGs
   and the Read tool downsamples a whole page far below that, which is what made
   the column look illegible. Pulling the embedded image at native resolution,
   rotating it 90° CCW — the appendix sets each entry as a vertical column, so
   the bichig reads left-to-right once rotated — and cropping one entry at a
   time is legible. `scripts/`-adjacent tooling for this lives in the session
   scratchpad, not the repo; the recipe is: PyMuPDF `extract_image`, rotate,
   project ink onto the y axis to find entry rows, crop, upscale.

   What is left is a **reader's verdict**, not resolution. All 241 entries of
   Хавсралт 3, 4.1 and 5 have been cropped per entry and put beside our output
   on a review page. Reading the glyphs well enough to import them as data is
   still exactly the fabrication risk the romanization discipline exists to
   prevent — so the forms go in after the verdict, not before.

   The one thing that fell out of the appendices as a *rule* rather than a word
   list is already shipped: the guesser's bare-final-consonant fix (see the
   0.3.0 changelog). Everything else there is lexical, and by this project's own
   standing rule a word list becomes lexicon rows, not a rule.

### Known issue: `-лаг⁴` on a chachlag stem (pre-existing, 2026-07-30)

`pnpm lint:output` reports **14 `unknown-suffix` warnings**, all one shape:
a chachlag stem plus `-лаг⁴` leaves the stem's MVS mid-word with ЛИГ after it
(тоосго → ᠲᠣᠭᠤᠰᠭ᠎ᠠᠯᠢᠭ), which the linter cannot parse as a suffix. Confirmed
unchanged from HEAD — it arrived with the `-лаг⁴` rows, not with this session.
The rulebook classes -лаг⁴ as a **дагавар**, so it is written залгаж; what it
does not say is what becomes of the stem's chachlag underneath. Needs the
reader, not a guess.

> **Update 2026-08-10: the count is 19, and the reader has named the rule.**
> `pnpm lint:output` reports 19 `unknown-suffix` warnings, still all one shape.
> The reader's answer to T1/T2 says that when a suffix is attached, **гэдэс
> жийрэглэх** applies — which is the missing rule, for `-лаг⁴` and for an
> attached `-тай³` alike. This stopped being "needs the reader" and became
> "needs implementing", and it now gates two things instead of one.

## Superseded — where to pick up next (written 2026-07-27, end of session)

**0.1.0 is prepped, not shipped.** Version bumped, CHANGELOG + LICENSE + README
written, 212 tests green, `npm pack` clean at 145 kB. Repo is private *by
choice*; making it public and publishing are the owner's. ⚠ **The README and
CHANGELOG are stale** — written before the last three commits, they still quote
coverage 73.8% and omit verb morphology and the linking-н fix. Refresh first.

Current: top-1 66.5%, oracle 95.6%, coverage 75.5%, sentence ceiling 9.4%.

### Done this session

Suffix-order rule (reflexive is chain-final); `verbEnding()`/`verbForm`; bare
`-г` accusative with a habitual-participle guard; the linking н (жийрэг н); and
the **verb suffix table** — 1,717 stems derived from `-х` infinitives already in
the dictionary, suffixes mined by `scripts/mine-verb-suffixes.mjs`. `pnpm dev`
serves a paste-and-inspect playground.

### The next four

1. **Refresh README + CHANGELOG** against current numbers.
2. ~~**`-аад/-ээд` perfective converb.**~~ **Done 2026-07-29.** The premise —
   "zero attestations, cannot be mined" — was true of the *word harvest* and
   expired when the sentence alignment landed: running text carries 83 of them.
   Rows added, plus the linking `u`/`ü` a consonant-final Classical stem takes
   before them (`ab` + `γad` = `abuγad`, attested 14/14). converb-perfective
   4.0% → 48.0%, verb gold 37.1% → 42.6%, nothing else moved. The linking
   vowel then took it to 47.2% once the reader ruled on it.
3. **A whole-word entry can lose to a segmented reading of itself.** `усан` was
   already correct until `ус`+`н` (curated prior 1.0 × 0.7) outscored it
   (harvested 0.5). This recurs and is the root cause behind bare `-н` too.
   Prerequisite is `hiddenN`, which exists in `LexiconEntry` but is set on 13
   curated rows and zero harvested ones, and is mechanically derivable
   (Classical ends `-n`, Cyrillic does not).
4. **A new lemma source** — see the section below. Deliberately deferred.

### The lemma source, researched 2026-07-27

`sura0111/writtenMongolianKeyboard` — `src/database/dictionary.json`, 28,263
rows, **MIT** (declared in `package.json`; no LICENSE file, so keep an
attribution note). Measured against us with gege-linter:

| | |
|---|---|
| NNBSP occurrences | **zero** — 1,258 rows use MVS correctly |
| lint-clean | 84.8% (1,124 rows carry NIRUGU U+180A; 281 `mvs-context`) |
| Cyrillic keys new to us | **22,821** (80.7%) — 3.5× the lexicon |
| new `-х` infinitives | **12,446** — verb stems 1,717 → ~14,163 |
| agreement where both answer | 67.2% raw, **86.5%** after NIRUGU strip + `orthography.ts` |

**Not imported, deliberately.** Same provenance as our `harvested` tier —
machine-converted by an undisclosed converter over scraped news, reviewed by
nobody — so it grows coverage, not accuracy. The verb half is *inert* until more
endings are handled, and the data has documented one-to-many collapse (`уул`
carries only ᠤᠤᠯ, ᠠᠭᠤᠯᠠ missing), which injects confidently-single answers for
ambiguous words and corrodes the ambiguity-as-data design. When it is imported,
gate it: normalise, lint, never overwrite an existing reading.

> **One of those two objections has expired (2026-07-29).** "The verb half is
> inert until more endings are handled" was a sequencing argument, and the
> sequencing is now done: `-ж`, `-на/-нэ` and `-аад/-ээд` all landed, and the
> verb gold set says the table is no longer what binds. **80 of the 97
> still-failing verb forms never segment because the *stem* is missing**, with
> the rule already sitting in the table waiting for it — `pnpm status` prints
> the split, and `docs/data-and-accuracy.md` reads it. The 12,446 new `-х`
> infinitives take verb stems 1,717 → ~14,163 and are aimed straight at that 80.
>
> The **provenance** objection has not expired and is the one that still
> decides. Unreviewed bulk import grows coverage, not accuracy, and the
> one-to-many collapse actively damages the ambiguity design. So this is a
> judgement call about tiers and gating, not a sequencing question any more —
> and it is the owner's call, not an agent's.

`bigune/khudam` repackages exactly this data under **CC BY-SA 4.0** — copyleft,
so it cannot go into an MIT package — and has **zero `verified: true` rows** out
of 27,977. Go to the MIT upstream; there is nothing in the repackaging to want.

## Superseded — the 2026-07-26 list, kept for context

Ordered by measured value, not by appeal. Everything below is committed and
pushed; `pnpm test` is green (132 passing, 3 todo) and `pnpm lint:output` is
clean.

1. **Verb morphology — largely addressed 2026-07-27, see above.** Done 2026-07-27: a suffix-order rule
   (`suffix-order.test.ts`) refuses reflexive-then-case chains, which Khalkha
   cannot form, killing 58% of the `-аад` converb misparses — хүлээгээд went
   from a confident `qüliy-e-ben-dü` to an honest `küleged` guess. And
   `verb.ts` now reports the ending on `AnalyzedToken.verbForm`. Neither
   converts a verb. What that bought is that the converter no longer asserts a
   noun reading of a verb; what remains is real verb morphology, and the
   measurement that decides whether it is worth it is in
   `docs/data-and-accuracy.md`: **48.5% of all guesser output is verb-shaped.**
   Still open: `ангижрасан → anγiǰraγsan` needs the `-гсан` γ, and хэвтэрт is a
   separate over-segmentation problem, not a verb one.

2. **Bare genitive `-н` and accusative `-г` — needs a human decision, then ten
   minutes of work.** ~21 gold forms (авгалдайн, далайн, гуайг) and the largest
   remaining reachability group. They were left out *deliberately* because they
   over-match. What has changed is that the gold set can now measure the damage
   exactly instead of us reasoning about it, so the honest move is to add them,
   run `scripts/eval.mjs`, and look. **Do not do this silently** — reversing a
   deliberate call is the user's, and they asked to be consulted.

3. **A new lemma source — now known to be a half-measure.** The word harvest is
   finished and re-running it buys nothing: 46.4% of harvested rows are
   rejected as not-a-lemma, so the 12,691-lemma set (UniMorph + MonWN +
   Wiktionary) is the binding constraint. Stems like энг (энгийн) and хэвтэр are
   missing purely because no lemma list contains them. **But 48.5% of the
   guesser's output is verb-shaped**, so a noun lemma source addresses at most
   half of the 26.8% gap. This item was written before that was measured.
   Sequence it against item 1 deliberately rather than by default.

4. **The `-нх-` possessive stack** — ангийнхаа is `ang-un-iyan`, гэрийнхээ is
   `γer-ün-iyen`. A genitive with a reflexive fused onto it; small, mechanical.

5. **FVS / loanword rows — genuinely blocked.** 24 gold forms and 6.2% of the
   harvest carry explicit variation selectors for foreign sounds (автобус is
   `aü1t1ubü1s`). We cannot emit these at all. Unblocking needs mongfontbuilder's
   `variants.json` vendored into mongol-bichig first — an open item recorded in
   that repo's `sources.md`, not something to solve here.

6. **Open ranking decision, still unresolved:** a guess can outrank a low-prior
   curated entry — долоо's `dol-iyan` guess at 0.10 beats the confirmed
   imperative at 0.09. Affects how much the curated tier is actually worth.

**The review loop is the process now.** After any change to the suffix table,
the guesser or the lexicon: dump the corpus before and after, then
`node scripts/build-spotcheck.mjs .tmp/spotcheck.html --changed <diff.json>`
and send the HTML. That loop found the unstable vowel — worth +11pp top-1 — in
a single round of 24 words. Terminal output cannot be used to judge bichig, so
this is not optional politeness; it is the only working review channel.

## Known gaps (v0)

Ordered by what would most improve output quality:

1. **The segmenter does not know the reflexive paradigm.** This is the highest
   -value next task — see the өөр finding above. Deterministic, cheap, and it
   resolves most of the disambiguation problem without touching ranking.
2. **No verb morphology** — only the `-х` infinitive, via the lexicon. Frequent
   inflected forms (байсан, гэдэг, байна) convert anyway because the harvest
   memorised them whole; the tail does not. `verbEnding()` recognises the
   endings but converts none of them.
3. **Ranking is a static unigram prior.** `frequencyRanker` cannot use context
   at all. The `Ranker` interface is the seam; labelled data now exists.
   A guess can currently outrank a low-prior curated entry (долоо: a `dol-iyan`
   guess at 0.10 beats the imperative at 0.09) — arguably wrong, undecided.
4. **Guesser is deliberately minimal**: collapses long vowels, transliterates,
   harmonises г/х, applies the o/ö rule (including inside ё). Does *not*
   reverse the `V+γ/g+V` contraction (улаан ← *ulaγan*) because inventing a
   consonant is worse than omitting one. Widening needs linguistic review.
5. **Epenthesis is handled** (хот + д → хотод) via `stemForms()` in `segment.ts`.
6. Bare genitive `-н` / accusative `-г` excluded — they over-match.
7. Clitics (нь, минь, чинь) tokenize separately; MVS-joining them is unimplemented.
8. Frequencies are hand-assigned, not corpus-counted. The 4,000 harvested
   sentences could supply real counts.
9. **The harvest scripts have no unit tests** — they are verified by running
   them. The *converter* is now measured end to end (see Accuracy above), which
   was the bigger of the two gaps.
10. **The 26,659-word single-word seed list is fully harvested** (2026-07-26,
    31,320 rows total, zero drops). Growth now needs a NEW word source, not
    more requests: 46.4% of harvested rows are rejected as not-a-lemma, so the
    12,691-lemma set is the binding constraint, not Tungaamal.
11. **6.2% of harvested rows carry an FVS digit** (`aü1t1ubü1s` = автобус) —
    Tungaamal marks foreign sounds with explicit variation selectors. Our generator
    never emits these, so those rows can never be matched or reproduced.
