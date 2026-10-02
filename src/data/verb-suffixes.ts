/**
 * Verb suffixes — the inflections the noun table deliberately excludes.
 *
 * ## Where these came from, and why that matters
 *
 * **The canonical registry has no verb suffixes.** `references/suffixes.md` in
 * `@gege-mn/mongol-bichig` is entirely nominal — case, reflexive, plural,
 * clitics — and its one verb-adjacent row (`daγ`/`deγ`) sits under "Registry
 * entries not yet in scope" marked *low confidence, verify why detached*. So
 * unlike `suffixes.ts`, whose Classical column is the registry's to own, there
 * was nothing upstream to copy.
 *
 * Rather than write forms from memory — which is what this project's rules
 * exist to prevent — every row below was **mined from attested pairs**:
 * `scripts/mine-verb-suffixes.mjs` takes the `-х` infinitives already in the
 * dictionary (which give a verb stem in both alphabets: нэрлэх / `nereleqü` →
 * нэрлэ- / `nerele-`), finds corpus words beginning with one, and reads off the
 * two remainders. `attested` records how many times the pairing was seen and
 * `share` how dominant it was among competing readings for that ending.
 *
 * **This is evidence, not authority.** The counts are small. A row here is a
 * measurement of what one machine converter produced, not a grammarian's
 * ruling — with one exception: `-сан`/`-сон` → `γsan` was independently
 * confirmed by a bichig reader on 2026-07-27 ("сан/сон = гсан (past tense
 * suffix)"), and the mining agrees at 94–100% over 25 occurrences. That
 * convergence is the reason to trust the method for the rest.
 *
 * ## What is deliberately missing
 *
 * - `-жээ` (n=1) — attested too thinly to assert.
 *
 *   > **No longer missing (2026-10-02).** n=1 was the lemma silver set. The
 *   > running-text silver set has 130, and the rows are below.
 * - **Bare `-ч` is not one ending.** It splits between the imperfective converb
 *   (алсарч `alusraǰu`) and the agentive noun-former (ажиллаач `aǰillaγači`),
 *   and over 42 aligned forms the readings run 33% `či` / 21% `ǰu` / 21% `ču` /
 *   17% `ǰü`. Nothing dominates because two different suffixes are being
 *   counted as one. A row here would assert a reading the evidence does not
 *   support; disambiguating them needs the segmenter, not a table entry.
 *
 *   > **`-гч` is not covered by that objection and now has rows (2026-07-30).**
 *   > The paragraph above was written about the ending `ч`, and the split it
 *   > describes is real. But `гч` is only ever the agentive: 162 forms on a
 *   > known verb stem, 162 reading `Vγči`, zero competing readings. The
 *   > measurement that looked ambiguous was measuring the wrong string.
 *
 *   > **Re-measured 2026-10-02, and the split is gone once it is conditioned.**
 *   > 96 forms on a known verb stem: `ǰu`/`ǰü`/`ču`/`čü` in 85 of them, a bare
 *   > `či` in 7. The two suffixes were separable all along, by the Cyrillic
 *   > letter the ч follows; see the converb rows for the cells and the guard.
 *
 * ## Addition, 2026-07-28: two endings the lemma harvest could not see
 *
 * `-ж` and `-на/-нэ` were listed above as too thin at n=2 and n=1. That was a
 * property of the source, not of the language: a lemma dictionary carries verbs
 * only as `-х` infinitives. Measuring the same endings over the 1,966 word pairs
 * aligned out of the parallel sentences (`scripts/align-sentences.mjs`) plus the
 * held-out verb gold set gives 210 and 117 attestations, and both are
 * near-unanimous once harmony is read with `harmonyOf` rather than by eye.
 *
 * A bichig reader converted an article on 2026-07-27 and flagged both endings
 * independently — "it mistook жу жү чу чү for жи чи", and туурвиж → `toγurbiǰu`
 * where the model had produced `toγurbiǰi`. The 56/56 sample ruling on the
 * aligned pool covers both groups. Two independent lines of evidence agreeing
 * is why these are asserted and `-ч` still is not.
 * - `-лаа/-лээ` is **not here on purpose**, but the stated reason was wrong and
 *   is corrected below.
 *
 * ## Addition, 2026-07-29: the perfective converb, no longer unattested
 *
 * This header used to say the perfective converb `-аад/-ээд/-оод/-өөд` had
 * **zero** attestations and must not be guessed. That was true of the word
 * harvest and was never true of the language: it is an inflection, so a lemma
 * dictionary cannot contain it by construction. The same sentence alignment
 * that unblocked `-ж` carries **83** of them, and they are the most regular
 * group yet measured — 81 of the 83 end in exactly ᠭᠠᠳ (47) or ᠭᠡᠳ (34), split
 * by harmony, with the two strays a misaligned dative and a truncation.
 *
 * Mined properly with `--corpus .tmp/aligned-words.jsonl`, the shares are lower
 * than that 97.6% because mining is sensitive to how each stem's Classical form
 * was written. The runners-up are `uγad`/`üγed`, and they are **not a competing
 * reading**: they appear exactly when the dictionary's Classical stem is
 * consonant-final (`γar`) where its Cyrillic stem is vowel-final (гара), so the
 * stem's own final vowel lands in the remainder. Same suffix, different stem
 * bookkeeping — which is why the row is `γad` and the fix for the rest belongs
 * in the affected lexicon rows, not here.
 *
 * The Cyrillic column is `ад/од/эд/өд`, not `аад/оод/ээд/өөд`: the stem's final
 * vowel merges into the long vowel on the surface, so peeling the shorter form
 * lands the head on the vowel-final stem the index actually holds (аваад → ава,
 * болоод → боло) instead of one letter short of it.
 *
 * ## Addition, 2026-10-02: the silver word list became running text
 *
 * Every earlier section above is, one way or another, about the same defect:
 * the silver word list was a lemma list, so an inflection could only be measured
 * by going round it — the aligned sentences, the gold set, a reader. On
 * 2026-10-02 the silver set was rebuilt from the commonest words of a 133M-token
 * corpus (18,743 rows), which are mostly inflected, and the miner was taught
 * to recover a stem the way `parseVerb` does. 9,135 forms now match a known
 * verb stem, 3,068 of them only because the stem is recovered rather than
 * read off the front of the word.
 *
 * What that changed here, each with its counts on the rows:
 *
 * - **New endings**: the evidential past -жээ/-чээ, the modal converb -н,
 *   bare -ч after a vowel-final Classical stem, the conditional's -вол and
 *   -бал/-бэл spellings, the perfective converb after a long vowel
 *   (-гаад/-гээд/-гоод), five attested combinations with the completive -чих-,
 *   and the durative converb, the voluntative and the polite imperative.
 * - **Re-measured in place**: the four хатуу-дэвсгэр converb rows, whose share
 *   had been taken over the wrong denominator, and the habitual participle.
 * - **Measured and left alone**, because their provenance is a reader's
 *   ruling and a count does not get to rewrite one: the past participle, the
 *   present-future, the perfective converb, the -в past and the -лаа past.
 *   Where the new data disagrees with the share on one of those rows, the
 *   comment on the row says by how much.
 *
 * ## Correction, 2026-07-27: the `-лаа` reading was inverted by sampling bias
 *
 * This header used to claim `-лаа` is `l-iyan`/`l-iyen` at 61–81% — "nominal
 * morphology that merely looks verbal". That was measured against the word
 * harvest, which is built from a **lemma dictionary**, and the only `-лаа`
 * words a lemma list carries as headwords are the nominalised ones (тавуулаа,
 * "one's setting-up"). Running text inverts it.
 *
 * Measured over 28 `-лаа/-лээ/-лоо/-лөө` forms word-aligned out of the parallel
 * sentences (`scripts/align-sentences.mjs`), all reader-sampled:
 *
 *   verbal past `l-a`/`l-e`     19  (68%)   гэлээ γel-e, ирлээ irel-e, оллоо olul-a
 *   nominal `l-iyan`/`-ban`      7  (25%)   тавуулаа tabuγula-ban, нүглээ niγül-iyen
 *   other                        2
 *
 * Both readings are real and a bichig reader confirmed examples of each, so the
 * segmenter must still offer the reflexive reading — that part of the original
 * note stands. What does not stand is "mostly nominal": in the text a user
 * actually converts, it is mostly verbal. This is the same selection bias that
 * produced the verb hole itself, showing up one level down.
 *
 * No row is added here yet: the two readings are not distinguishable from the
 * Cyrillic surface form, so this needs the segmenter to weigh both, not a table
 * entry asserting one.
 */

import type { VerbSuffixEntry } from '../types.js';

/**
 * Mined against 1,717 infinitive stems. Ordered by attestation. Re-derive with
 * `scripts/mine-verb-suffixes.mjs` rather than editing by hand — a row without
 * a count is a guess.
 *
 * Four different measurements are stacked here, and the invocation that
 * reproduces a row depends on which:
 *
 * - past participle, habitual, conditional, terminative — 2026-07-27, the
 *   31,320-row word harvest, which is the script's default corpus.
 * - perfective converb — 2026-07-29, `--corpus .tmp/aligned-words.jsonl
 *   --include-held-out`. Exact: ад 23 × 70%, од 9 × 56%, эд 15 × 80%,
 *   өд 5 × 60%.
 * - `-ж` and `-на/-нэ` — 2026-07-28, and these do **not** come back out of the
 *   script, because it does not split an ending by the word's harmony and these
 *   rows are split that way. The totals it does produce are the surface counts
 *   quoted in the header, 210 and 117.
 *
 * - everything dated 2026-10-02 — the running-text silver word list of that day
 *   (18,743 rows), which is the script's default corpus **now**, read with
 *   `--ending <the row's Cyrillic>`. A row with `harmony` or `after` quotes its
 *   own cell of that output, and a `linking` row counts the linked spelling
 *   as the same reading; the row's comment gives the arithmetic. ⚠ The first
 *   bullet's corpus is therefore no longer the default, and those rows will
 *   not come back out of a plain run: `--prefix-only --no-corpus-stems`
 *   against the 31,320-row file is what reproduces them.
 *
 * The `--include-held-out` above is the honest part: the aligned pool contains
 * every form of `test/fixtures/verb-gold.json`, so these counts and the gold
 * score share data. The script now excludes them by default.
 */
export const verbSuffixes: readonly VerbSuffixEntry[] = [
  // Past participle — reader-confirmed, and the strongest mined row.
  //
  // `linking` set 2026-07-29 after the reader ruled бэлдсэн `beledüγsen` and
  // төгссөн `teγüsüγsen` against the flat forms we were emitting. Gold agreed
  // 5 of 5 and the word harvest independently gives `uγsan`/`üγsen`, but the
  // evidence was mostly the eval set, so the rows waited for the ruling.
  //
  // Re-measured 2026-10-02 (`--ending сан,сон,сэн,сөн`) and **not rewritten** —
  // the rows are the reader's. With the linked spelling counted as this
  // reading: сан 277 of 280, сон 79 of 80, сэн 162 of 163, сөн 40 of 40, and
  // the linking vowel on 128 of 129 consonant-final stems. Agreement
  // throughout; сөн's 0.83 on n=6 is the only share a larger sample moves.
  {
    cyrillic: 'сан',
    classical: 'γsan',
    kind: 'participle-past',
    harmony: 'masculine',
    attested: 17,
    share: 0.94,
    linking: true,
  },
  {
    cyrillic: 'сон',
    classical: 'γsan',
    kind: 'participle-past',
    harmony: 'masculine',
    attested: 8,
    share: 1,
    linking: true,
  },
  {
    cyrillic: 'сэн',
    classical: 'γsen',
    kind: 'participle-past',
    harmony: 'feminine',
    attested: 7,
    share: 1,
    linking: true,
  },
  {
    cyrillic: 'сөн',
    classical: 'γsen',
    kind: 'participle-past',
    harmony: 'feminine',
    attested: 6,
    share: 0.83,
    linking: true,
  },

  // Habitual participle. Written attached, despite the registry's open question
  // about why its entry appears detached — the corpus is unanimous.
  //
  // Re-measured 2026-10-02 over the running-text silver set (`--ending
  // даг,дог,дэг,дөг`): 322 forms where the lemma silver set had 15, and 318 of
  // them this. The two feminine rows stood at 0.67 on n=3 each — two right and
  // one stray apiece — which read as "a third of the time it is something
  // else" and was only a small sample. No `linking`: 64 of 67 consonant-final
  // stems are written flat (явуулдаг `yabuγuldaγ`, өсдөг `ösdeγ`).
  {
    cyrillic: 'даг',
    classical: 'daγ',
    kind: 'participle-habitual',
    harmony: 'masculine',
    attested: 150,
    share: 0.99,
  },
  {
    cyrillic: 'дог',
    classical: 'daγ',
    kind: 'participle-habitual',
    harmony: 'masculine',
    attested: 41,
    share: 1,
  },
  {
    cyrillic: 'дэг',
    classical: 'deγ',
    kind: 'participle-habitual',
    harmony: 'feminine',
    attested: 103,
    share: 0.99,
  },
  {
    cyrillic: 'дөг',
    classical: 'deγ',
    kind: 'participle-habitual',
    harmony: 'feminine',
    attested: 24,
    share: 0.96,
  },

  // Imperfective converb — the single commonest verb ending in running text,
  // and the one the reader corrected on туурвиж.
  //
  // ## `ǰu` and `ču` are one ending, selected by the stem (2026-07-31)
  //
  // The note that stood here said the 2% surfacing as ču/čü (босож `bosču`,
  // нисэж `nisčü`) were "voicing against a stem-final с/д … left to the
  // generator rather than given a row of its own". The generator never did it,
  // so босож converted as `bosǰu` and нисэж as `nisǰü` — both wrong, and both
  // named in that very sentence as the attested forms.
  //
  // Rulebook 2.2.2/16 (Зэрэгцүүлэх -ж, -ч) gives the condition: the ending is
  // written **-ж after a vowel or a зөөлөн дэвсгэр** and **-ч after a хатуу
  // дэвсгэр** (б, г, р, с, д). Rule 2.1.2.1 states the same law generally, and
  // 2.2.3/33–38 applies it to -жээ/-чээ.
  //
  // Two consequences worth being explicit about:
  //
  // 1. **The Cyrillic letter does not decide.** босож is spelled with ж and is
  //    `bosču` all the same, because `bos` ends in с. The condition reads the
  //    Classical stem, never the surface.
  // 2. **Bare `-ч` gets rows after all.** The header above refuses it because
  //    the imperfective converb and the agentive noun-former were being counted
  //    as one ending, giving 33% `či` / 21% `ǰu` / 21% `ču` / 17% `ǰü` and no
  //    majority. That objection was about *evidence*, and it stands: the mining
  //    could not separate them. The rulebook separates them by condition — the
  //    converb -ч occurs only after a хатуу дэвсгэр, and the agentive -аач⁴
  //    only after a vowel — so the `after: 'hard'` rows below cannot swallow
  //    ажиллаач, whose stem ends in a vowel.
  //
  // `share` is left at what the mining measured for the ж rows; the ч rows
  // carry the ču/čü share of the same pool, which is why they are lower. They
  // are asserted on the rulebook, not on the counts.
  //
  // ## Re-measured 2026-10-02: a conditioned row's share is the share in its cell
  //
  // The paragraph above is kept because it explains the numbers that stood here
  // until today, and those numbers were the bug. The four `after: 'hard'` rows
  // carried 0.02, 0.07, 0.21 and 0.17 — the ču/čü share of *every* -ж or -ч
  // form — while the rows themselves fire only on a хатуу дэвсгэр stem. The
  // ranker multiplies the stem's prior by `share`, so a correct reading off a
  // harvested stem scored 0.5 × 0.02 = 0.01 and lost to the guesser's 0.09:
  // жолоодож came out `ǰoluduǰi` with `ǰiluγudču` sitting second, and босч
  // `bosči` with `bosču` second. The condition had been applied to the row and
  // not to its denominator.
  //
  // The silver word list is running text now, and the miner splits an ending by
  // harmony and by the stem's дэвсгэр (`--ending ж,ч`), so the cells can be
  // read directly — 730 -ж forms and 96 -ч forms on a known verb stem:
  //
  //   -ж, vowel or зөөлөн дэвсгэр   masc  ǰu 425 of 438 (97%)   fem  ǰü 254 of 255
  //   -ж, хатуу дэвсгэр             masc  ču  16 of  20 (80%)   fem  čü  16 of  17 (94%)
  //   -ч, хатуу дэвсгэр             masc  ču  13 of  15 (87%)   fem  čü  11 of  15 (73%)
  //   -ч, vowel or зөөлөн дэвсгэр   masc  ǰu  45 of  48 (94%)   fem  ǰü  16 of  18 (89%)
  //
  // Rulebook 2.2.2/16 holds in every cell, and the last line is a cell the
  // table did not have: Cyrillic writes ч after р and с whatever the Classical
  // stem ends in, so амьдарч is амьдра- `amidura` + `ǰu` and хүсч is хүсэ-
  // `qüse` + `ǰü`. Those stems are vowel-final in Classical, so no `hard` row
  // could take them and they went to the guesser (`amidarči`, `küsči`).
  //
  // The two `not-hard` ж rows are left exactly as they were: they were mined
  // from the reader-sampled aligned pool, and 0.98 / 0.93 against 0.97 / 1.00
  // here is agreement, not a correction.
  //
  // ## Why the header's objection to bare -ч no longer holds, and what guards it
  //
  // The header refuses -ч because "two different suffixes are being counted as
  // one". Counted again on words that parse as a known verb stem + ч, the two
  // separate **by the Cyrillic letter in front** (`--ending ч --hosts`):
  //
  //   after р, с, в         97 forms, 84 the converb (73 of 79 after р)
  //   after г               өгч `ögčü`; the rest are -гч, which has its own row
  //   after л, м, н, vowel   6 forms, 0 the converb — эмч, өмч, голч, илч
  //
  // The thirteen strays in the first line are not the agentive either. Eight
  // are verbs the silver itself wrote with a bare `či` (нисч, үүсч, зогсч)
  // and five are a stem spelled differently or another word (асч, яавч, эрч).
  // So the converb never follows anything but в/г/р/с, which is the Cyrillic
  // spelling rule for this ending read backwards, and that is the guard: a
  // condition on the Cyrillic surface, which `after` cannot express, so
  // `parseVerb` applies it (`CH_HOSTS` in verb-stem.ts).
  //
  // It is a guard against most of the agentive, not all of it. Agent nouns in
  // р + ч exist — харч, зарч, найрч, хадуурч — and where only the dictionary
  // tier lists one, the converb reading now outranks it. Of the 400 words whose
  // output the -ч rows changed among the 120,000 commonest, 104 have a
  // silver answer and now match it, 10 have one and do not, and 6 of the
  // rest displaced a dictionary headword (314 tokens between them), which is
  // where those nouns are.
  {
    cyrillic: 'ж',
    classical: 'ǰu',
    kind: 'converb-imperfective',
    harmony: 'masculine',
    after: 'not-hard',
    attested: 132,
    share: 0.98,
  },
  {
    cyrillic: 'ж',
    classical: 'ǰü',
    kind: 'converb-imperfective',
    harmony: 'feminine',
    after: 'not-hard',
    attested: 62,
    share: 0.93,
  },
  {
    cyrillic: 'ж',
    classical: 'ču',
    kind: 'converb-imperfective',
    harmony: 'masculine',
    after: 'hard',
    attested: 16,
    share: 0.8,
  },
  {
    cyrillic: 'ж',
    classical: 'čü',
    kind: 'converb-imperfective',
    harmony: 'feminine',
    after: 'hard',
    attested: 16,
    share: 0.94,
  },
  {
    cyrillic: 'ч',
    classical: 'ču',
    kind: 'converb-imperfective',
    harmony: 'masculine',
    after: 'hard',
    attested: 13,
    share: 0.87,
  },
  {
    cyrillic: 'ч',
    classical: 'čü',
    kind: 'converb-imperfective',
    harmony: 'feminine',
    after: 'hard',
    attested: 11,
    share: 0.73,
  },
  {
    cyrillic: 'ч',
    classical: 'ǰu',
    kind: 'converb-imperfective',
    harmony: 'masculine',
    after: 'not-hard',
    attested: 45,
    share: 0.94,
  },
  {
    cyrillic: 'ч',
    classical: 'ǰü',
    kind: 'converb-imperfective',
    harmony: 'feminine',
    after: 'not-hard',
    attested: 16,
    share: 0.89,
  },

  // ─── The modal converb -н, 2026-10-02 ──────────────────────────────────
  // үйлдвэрлэн, эхлэн, нэрлэн, хуульчлан. There was no row, so each of these
  // went to the guesser (`eklen`, `üildberlen`).
  //
  // ⚠ The rows do not reach худалдан, оршин or өргөжүүлэн, and that is not
  // this table's to fix. The noun path reads those as a harvested stem whose
  // тогтворгүй н the word happens to spell, emits the bare stem (`qudaldu`,
  // `orusi`) and — being a harvested reading — holds the verb gate in
  // `buildCandidates` shut. 140 words and 440,000 tokens of the silver set are
  // in that state with `parseVerb` already giving the silver's answer.
  //
  // 402 forms on a known verb stem (`--ending н`), and the reading is the
  // stem plus NA, with the linking vowel on a consonant-final stem:
  //
  //   vowel-final       masc  `n`  185 of 195   fem  `n`  109 of 110
  //   зөөлөн дэвсгэр    masc  `un`  42 of  43   fem  `ün`  26 of  27
  //   хатуу дэвсгэр     masc  `un`  14 of  14   fem  `ün`   7 of  13
  //
  // So `linking` is set: болон `bolun`, дамжуулан `damǰiγulun`, үзүүлэн
  // `üǰeγülün`, аван `abun` — 89 of 97 consonant-final stems, and not one
  // written flat. The shares are the three cells of each harmony together,
  // 241 of 252 and 142 of 150.
  //
  // **What the remainder is, because bare -н is also how a noun ends.** The 19
  // forms that read otherwise are nearly all nouns that happen to be a verb
  // stem plus н: the `ng` nouns (тариалан `tariyalang`, хүрээлэн, дүүрэн,
  // хүрэн), олон `olan`, and гэсэн, which is гэ + сэн. That is 5%, and it is
  // the rate on words the silver knows — where a noun is likeliest.
  //
  // What reaches the output is a different and smaller number, because
  // `parseVerb` runs only when no curated or harvested noun reading exists.
  // Measured on the words whose output these two rows changed, among the
  // 120,000 commonest: 174 have a silver answer, 164 now match it and 10 do
  // not. Four of the ten are nouns taken for converbs — тариалан, гандан,
  // султан, даян — so the collision that actually lands is 4 in 174, 2.3% of
  // types and 1.9% of tokens; the other six are converbs on a stem the two
  // sources spell differently (тэмүүлэн, сэтгэн). 1,105 more changed with no
  // silver to judge them by; 97 of those displaced a dictionary headword,
  // which is where any further nouns are (озон, лион).
  //
  // Two conditions on the Cyrillic keep it that low, and both are measured
  // where they are applied (`surfaceFits` in verb-stem.ts): the ending follows
  // a vowel, and that vowel is not й — after й it is the genitive (жирийн,
  // биржийн, зүйн), which the first version of these rows got wrong 8 times
  // in 10.
  {
    cyrillic: 'н',
    classical: 'n',
    kind: 'converb-modal',
    harmony: 'masculine',
    attested: 241,
    share: 0.96,
    linking: true,
  },
  {
    cyrillic: 'н',
    classical: 'n',
    kind: 'converb-modal',
    harmony: 'feminine',
    attested: 142,
    share: 0.95,
    linking: true,
  },

  // ─── The evidential past -жээ / -чээ, 2026-10-02 ───────────────────────
  // The header lists this ending as "(n=1) — attested too thinly to assert".
  // That was the lemma silver set, which cannot contain an inflection. Over the
  // running-text silver set it is 130 forms on a known verb stem, and it is the
  // most regular ending in the table after -гч:
  //
  //   vowel or зөөлөн дэвсгэр   `ǰei`  117 of 118   (-жээ 109 of 110, -чээ 8 of 8)
  //   хатуу дэвсгэр             `čei`   10 of  12   (-жээ   5 of   6, -чээ 5 of 6)
  //
  // The two strays after a хатуу дэвсгэр are төржээ `törüǰei` and авчээ, which
  // the silver did not read as a verb at all. This is rulebook 2.2.3/33–38,
  // the same ж/ч law as the converb above, and the same two consequences
  // follow from it:
  //
  // - **The Cyrillic letter does not decide.** шийджээ is `siidčei` and
  //   зөвшөөрчээ is `ǰöbsiyereǰei`; the Classical stem's дэвсгэр decides, so
  //   each spelling needs both rows.
  // - **One form for both harmonies.** `ǰei`/`čei` are written the same in
  //   байжээ and in гэжээ — 52 masculine and 34 feminine vowel-final stems,
  //   no exception — so the rows carry no `harmony`.
  //
  // No linking vowel: 23 of 24 зөөлөн-дэвсгэр stems are written flat (болжээ
  // `bolǰei`, үзүүлжээ `üǰeγülǰei`), as on the converb.
  {
    cyrillic: 'жээ',
    classical: 'ǰei',
    kind: 'evidential',
    after: 'not-hard',
    attested: 109,
    share: 0.99,
  },
  {
    cyrillic: 'жээ',
    classical: 'čei',
    kind: 'evidential',
    after: 'hard',
    attested: 5,
    share: 0.83,
  },
  {
    cyrillic: 'чээ',
    classical: 'ǰei',
    kind: 'evidential',
    after: 'not-hard',
    attested: 8,
    share: 1,
  },
  {
    cyrillic: 'чээ',
    classical: 'čei',
    kind: 'evidential',
    after: 'hard',
    attested: 5,
    share: 0.83,
  },

  // Present-future. Written `n` + MVS + the harmony vowel — зорино is
  // `ǰorin-a`, not `ǰorinu` and not `ǰorin-iyan`. Dominant in all four Cyrillic
  // spellings but NOT unanimous: `attested` sums to 108 and `attested / share`
  // to 117, so nine aligned forms read otherwise. Re-mining says the runner-up
  // on -нэ/-нө is `ün-e` — this same suffix after a consonant-final Classical
  // stem (төрнө `törün-e`), i.e. the linking vowel — which these rows now
  // carry, ruled 2026-07-29. The reader confirmed авна `abun-a`, төрнө
  // `törün-e` and үнсэнэ `ünüsün-e` against the flat forms we emitted, matching
  // the held-out gold's 4 of 4 consonant-final stems linked with none flat.
  //
  // The ruling was asked for rather than inferred. Nearly all the evidence was
  // the eval set itself, so applying it from measurement alone would have been
  // fitting to the test set — the failure `mine-verb-suffixes.mjs` had just
  // been guarded against. Two controls in the same batch bounded the rule:
  // судлаж stays flat `sudulǰu` (so it is not every consonant-initial suffix)
  // and ашиглаад inserts nothing (so it is genuinely conditioned on the stem
  // ending in a consonant).
  //
  // Re-measured 2026-10-02 (`--ending на,но,нэ,нө`) and not rewritten: на 128
  // of 129, но 40 of 40, нэ 77 of 77, нө 18 of 19, the linking vowel on 62 of
  // 63 consonant-final stems. The ruling holds on six times the data; нө's
  // 0.75 is the one share that reads low against it.
  {
    cyrillic: 'на',
    classical: 'n-a',
    kind: 'tense-present',
    harmony: 'masculine',
    attested: 49,
    share: 0.91,
    linking: true,
  },
  {
    cyrillic: 'но',
    classical: 'n-a',
    kind: 'tense-present',
    harmony: 'masculine',
    attested: 13,
    share: 0.93,
    linking: true,
  },
  {
    cyrillic: 'нэ',
    classical: 'n-e',
    kind: 'tense-present',
    harmony: 'feminine',
    attested: 40,
    share: 0.98,
    linking: true,
  },
  {
    cyrillic: 'нө',
    classical: 'n-e',
    kind: 'tense-present',
    harmony: 'feminine',
    attested: 6,
    share: 0.75,
    linking: true,
  },

  // Perfective converb. The ending a reader flagged on хүлээгээд, and the one
  // this table refused to carry until the sentence alignment attested it.
  // Cyrillic is the short form — see the header on why `ад` and not `аад`.
  //
  // Re-measured 2026-10-02 (`--ending ад,од,эд,өд`) and not rewritten: ад 115
  // of 119, од 31 of 32, эд 66 of 67, өд 20 of 22. Those are 0.97, 0.97, 0.99
  // and 0.91 against the rows' 0.70, 0.56, 0.80 and 0.60 — the largest gap in
  // the table, and the one the header predicted: the old shares count
  // `uγad`/`üγed` as a rival reading, and with the split by дэвсгэр it is
  // visibly this row's own linked form, 58 of 61 consonant-final stems.
  {
    cyrillic: 'ад',
    classical: 'γad',
    kind: 'converb-perfective',
    harmony: 'masculine',
    attested: 16,
    share: 0.7,
    linking: true,
  },
  {
    cyrillic: 'од',
    classical: 'γad',
    kind: 'converb-perfective',
    harmony: 'masculine',
    attested: 5,
    share: 0.56,
    linking: true,
  },
  {
    cyrillic: 'эд',
    classical: 'γed',
    kind: 'converb-perfective',
    harmony: 'feminine',
    attested: 12,
    share: 0.8,
    linking: true,
  },
  {
    cyrillic: 'өд',
    classical: 'γed',
    kind: 'converb-perfective',
    harmony: 'feminine',
    attested: 3,
    share: 0.6,
    linking: true,
  },

  // The perfective converb after a long vowel or a diphthong, 2026-10-02.
  // A stem that already ends in two vowel letters cannot take a third, so
  // Cyrillic puts a г between: бай + аад is байгаад, хий + ээд is хийгээд,
  // тогтоо + оод is тогтоогоод. The short rows above peel `ад` and are left
  // holding байга, which is no stem. Classical writes nothing extra — the
  // suffix is the same `γad`/`γed` — 28 of 28 (`--ending гаад,гээд,гоод`).
  // -гөөд is attested once and has no row.
  {
    cyrillic: 'гаад',
    classical: 'γad',
    kind: 'converb-perfective',
    harmony: 'masculine',
    attested: 15,
    share: 1,
  },
  {
    cyrillic: 'гоод',
    classical: 'γad',
    kind: 'converb-perfective',
    harmony: 'masculine',
    attested: 3,
    share: 1,
  },
  {
    cyrillic: 'гээд',
    classical: 'γed',
    kind: 'converb-perfective',
    harmony: 'feminine',
    attested: 10,
    share: 1,
  },

  // Conditional converb.
  //
  // `вол` and the two б-spellings added 2026-10-02 (`--ending
  // вал,вэл,вол,вөл,бал,бэл`). Cyrillic writes this ending -бал⁴ after в, л and
  // м and -вал⁴ elsewhere; Classical writes `bal`/`bel` for both, so the new
  // rows are spellings of the two that were here, not a second reading.
  // -вөл is attested twice and both times `bel`, which is below the miner's
  // floor, so it has no row. The two rows that were here stood at n=5 and n=1
  // and are re-counted on the same run: 16 of 17 and 13 of 13.
  //
  // `linkingAfter: 'b'` on -бал is one form, авбал `abubal`, against four
  // зөөлөн-дэвсгэр stems written flat (тодруулбал `toduraγulbal`). It is set
  // on that one because the alternative is to emit `abbal` for the commonest
  // verb in the language against the only attestation there is, and because
  // it is the condition the rulebook gives the endings beside this one (the
  // -в past below, and -ваас⁴ at 2.2.2/21). -бэл has no б-final attestation
  // and so no flag.
  {
    cyrillic: 'вал',
    classical: 'bal',
    kind: 'converb-conditional',
    harmony: 'masculine',
    attested: 16,
    share: 0.94,
  },
  {
    cyrillic: 'вэл',
    classical: 'bel',
    kind: 'converb-conditional',
    harmony: 'feminine',
    attested: 13,
    share: 1,
  },
  {
    cyrillic: 'вол',
    classical: 'bal',
    kind: 'converb-conditional',
    harmony: 'masculine',
    attested: 9,
    share: 1,
  },
  {
    cyrillic: 'бал',
    classical: 'bal',
    kind: 'converb-conditional',
    harmony: 'masculine',
    attested: 6,
    share: 1,
    linking: true,
    linkingAfter: 'b',
  },
  {
    cyrillic: 'бэл',
    classical: 'bel',
    kind: 'converb-conditional',
    harmony: 'feminine',
    attested: 4,
    share: 1,
  },

  // Terminative converb. The chachlag is in the mined form: `tal-a`, not `tala`.
  {
    cyrillic: 'тал',
    classical: 'tal-a',
    kind: 'converb-terminative',
    harmony: 'masculine',
    attested: 5,
    share: 0.6,
  },
  {
    cyrillic: 'тэл',
    classical: 'tel-e',
    kind: 'converb-terminative',
    harmony: 'feminine',
    attested: 1,
    share: 1,
  },

  // ─── The -в past, 2026-07-30 ───────────────────────────────────────────
  // Reader-confirmed ("bolba is correct") after a UI test surfaced болов as
  // `bolub`, which is not a word. Mined over the aligned pairs and the word
  // harvest together, gated on a known verb stem: 70 forms, 60 of them
  // exactly this, split by harmony.
  //
  // **The linking vowel is conditional, and the condition is б (2026-07-31).**
  // What stood here was that consonant-final stems run 3 flat (болов `bolba`,
  // төгсөв `teγüsbe`, сонсов `sonusba`) to 1 linking (авав `abuba`), and that
  // the odd one out was therefore "a property of that stem, not of this
  // ending" — recorded in docs/rulings.md as a real disagreement between two
  // reader-confirmed forms that must not be reconciled by inference.
  //
  // Rulebook 2.2.3/39–40 reconciles it by statement rather than inference:
  // the -в past attaches directly, **but a б-final verb stem takes у/ү**. `ab`
  // ends in б; `bol`, `teγüs` and `sonus` end in л, с, с. One condition, all
  // four attestations, no exception left over. 2.2.2/21 says the same of the
  // -ваас⁴ conditional.
  //
  // Cyrillic is `в`, not `ов/эв/өв`: the stem's final vowel is already in
  // the stem the index holds (боло-, ирэ-), same bookkeeping as `ад` above.
  //
  // Re-measured 2026-10-02 (`--ending в`) and not rewritten: `ba` 57 of 63,
  // `be` 36 of 38 — 0.90, which is the row's, and 0.95 against the row's 0.79.
  // On the б condition the new data has авав `abuba` linked and дурдав,
  // сонсов, өгөв, хүрэв, шийдэв flat, as ruled, and one form against it,
  // одов `oduba`.
  {
    cyrillic: 'в',
    classical: 'ba',
    kind: 'tense-past',
    harmony: 'masculine',
    attested: 38,
    share: 0.9,
    linking: true,
    linkingAfter: 'b',
  },
  {
    cyrillic: 'в',
    classical: 'be',
    kind: 'tense-past',
    harmony: 'feminine',
    attested: 22,
    share: 0.79,
    linking: true,
    linkingAfter: 'b',
  },

  // ─── The -гч agent noun, 2026-07-30 ────────────────────────────────────
  // The header above says `-ч` must not get a row because two suffixes are
  // being counted as one. That still holds for **bare** `-ч`. It never
  // applied to `-гч`, which is only ever the agentive, and the corpus says
  // so with no dissent at all: 162 forms on a known verb stem, 162 of them
  // `Vγči`, no competing reading. It was missing because nobody separated
  // the two endings, not because the evidence was thin.
  //
  // Derivational rather than inflectional, which widens what this table
  // covers. That is deliberate — хөрвүүлэгч is a word people type, it is
  // built from a verb stem by a fully regular rule, and the alternative is a
  // lexicon row per agent noun. Its own case forms (хөрвүүлэгчийн) still
  // fail, because `parseVerb` peels one suffix.
  //
  // `linking` here is unanimous the other way: 36 consonant-final stems, 36
  // with the vowel (хэрэгжүүлэгч `qereγǰiγülüγči`), 0 without.
  {
    cyrillic: 'гч',
    classical: 'γči',
    kind: 'agent',
    harmony: 'masculine',
    attested: 87,
    share: 1,
    linking: true,
  },
  {
    cyrillic: 'гч',
    classical: 'γči',
    kind: 'agent',
    harmony: 'feminine',
    attested: 75,
    share: 1,
    linking: true,
  },

  // The `-лаа` past, ruled by a bichig reader on 2026-08-03 — see the section
  // in this header for the sampling bias that kept it out until now, and
  // `docs/rulings.md` for the verdict.
  //
  // The reader was asked боллоо and билээ, two words chosen because one is
  // regular and one is not, and answered `bolul-a` and `bile`. **The rule
  // covers боллоо; билээ is lexical** and is not derivable from it, which is
  // why only the rule lands here.
  //
  // `linking` is unanimous across every verbal attestation in the aligned pool:
  // a consonant-final Classical stem takes the u/ü (ol → `olul-a`, qasqir →
  // `qasqirul-a`, ab → `abul-a`), a vowel-final one takes nothing (bai →
  // `bail-a`, ire → `irel-e`, oči → `očil-a`). 17 of 17, no counterexample —
  // атлаа `atal-a` looks like one until атах's stem is read as `ata`, which is
  // vowel-final.
  //
  // The shares are low because they are honest: this ending is genuinely
  // ambiguous with the nominal reflexive reading (тавуулаа `tabuγula-ban`,
  // нүглээ `niγül-iyen`), which stays available because `parseVerb` runs only
  // after every dictionary reading has missed. Counted over the aligned pool
  // with the 197 held-out gold forms excluded.
  //
  // Re-measured 2026-10-02 (`--ending лаа,лоо,лээ,лөө`) and not rewritten: лаа
  // 50 of 68, лоо 19 of 31, лээ 31 of 56, лөө 7 of 12 — 0.74, 0.61, 0.55 and
  // 0.58. The verbal past is the majority in all four and the nominal reading
  // is most of the remainder, as ruled. ⚠ лоо's share of 1 on n=4 is the one
  // figure here the larger sample says is too high.
  {
    cyrillic: 'лаа',
    classical: 'l-a',
    kind: 'tense-past',
    harmony: 'masculine',
    attested: 4,
    share: 0.67,
    linking: true,
  },
  {
    cyrillic: 'лоо',
    classical: 'l-a',
    kind: 'tense-past',
    harmony: 'masculine',
    attested: 4,
    share: 1,
    linking: true,
  },
  {
    cyrillic: 'лээ',
    classical: 'l-e',
    kind: 'tense-past',
    harmony: 'feminine',
    attested: 4,
    share: 0.5,
    linking: true,
  },
  // n=1, thinner than any other row here and below the miner's own `--min 3`.
  // It is kept because it is not an independent claim: -лөө is the rounded
  // spelling of -лээ, whose form is attested four times, and the one
  // attestation (өнгөрлөө `öngγerel-e`) agrees with it. If it ever disagrees,
  // delete it rather than reconciling.
  {
    cyrillic: 'лөө',
    classical: 'l-e',
    kind: 'tense-past',
    harmony: 'feminine',
    attested: 1,
    share: 0.5,
    linking: true,
  },

  // ─── The completive -чих-, as five attested combinations, 2026-10-02 ────
  // `parseVerb` peels one suffix, and its comment says why: "nothing in the
  // mined table is attested in combination". This one now is. -чих- sits
  // between the stem and the ending and is written `čiqa`/`čiqe`, 38 forms out
  // of 38 across eleven endings (`--ending чихсан,чихсэн,…`), and — unlike
  // every other consonant-initial suffix here that follows a consonant-final
  // stem — with no linking vowel: авчихсан `abčiqaγsan`, гарчихаад
  // `γarčiqaγad`, 9 of 9.
  //
  // The rows are the five combinations seen three times or more, spelled out
  // whole, rather than a rule that -чих- may precede any ending. The other six
  // (-чихдаг, -чихна, -чихлаа, -чихжээ, -чихаж, -чихвал) agree with the rule
  // at n=1 or 2 each and are not here.
  {
    cyrillic: 'чихсан',
    classical: 'čiqaγsan',
    kind: 'participle-past',
    harmony: 'masculine',
    attested: 12,
    share: 1,
  },
  {
    cyrillic: 'чихсон',
    classical: 'čiqaγsan',
    kind: 'participle-past',
    harmony: 'masculine',
    attested: 3,
    share: 1,
  },
  {
    cyrillic: 'чихсэн',
    classical: 'čiqeγsen',
    kind: 'participle-past',
    harmony: 'feminine',
    attested: 7,
    share: 1,
  },
  {
    cyrillic: 'чихаад',
    classical: 'čiqaγad',
    kind: 'converb-perfective',
    harmony: 'masculine',
    attested: 4,
    share: 1,
  },
  {
    cyrillic: 'чихээд',
    classical: 'čiqeγed',
    kind: 'converb-perfective',
    harmony: 'feminine',
    attested: 3,
    share: 1,
  },

  // ─── Three more endings, each with a kind of its own, 2026-10-02 ────────
  // Each is what a held-out word failed on (амьдарсаар, бичье, ойлгоорой), and
  // each is as regular as anything above.
  //
  // **The durative converb -саар⁴** is the past participle plus the
  // instrumental, written as one word: `γsaγar`/`γseγer`, with the
  // participle's own linking vowel (явуулсаар `yabuγuluγsaγar`, гарсаар
  // `γaruγsaγar` — 7 of 8 consonant-final stems). The strays are nouns in the
  // instrumental (дансаар, бүсээр). -сөөр is attested twice and has no row.
  {
    cyrillic: 'саар',
    classical: 'γsaγar',
    kind: 'converb-durative',
    harmony: 'masculine',
    attested: 13,
    share: 0.87,
    linking: true,
  },
  {
    cyrillic: 'соор',
    classical: 'γsaγar',
    kind: 'converb-durative',
    harmony: 'masculine',
    attested: 3,
    share: 0.75,
    linking: true,
  },
  {
    cyrillic: 'сээр',
    classical: 'γseγer',
    kind: 'converb-durative',
    harmony: 'feminine',
    attested: 13,
    share: 0.93,
    linking: true,
  },

  // **The voluntative -я/-е** is `y-a`/`y-e`, chachlag included: байя
  // `baiy-a`, хийе `kiy-e`. Cyrillic spells it four ways by what precedes —
  // я/е after a vowel, ъя/ье where the stem's vowel has dropped — and the two
  // sign spellings are where a consonant-final stem shows its linking vowel:
  // оруулъя `oruγuluy-a`, авъя `abuy-a`, дэвшүүлье `debsiγülüy-e`, 7 of 8.
  // -ё is attested twice (болгоё, больё) and has no row.
  {
    cyrillic: 'я',
    classical: 'y-a',
    kind: 'voluntative',
    harmony: 'masculine',
    attested: 9,
    share: 1,
    linking: true,
  },
  {
    cyrillic: 'ъя',
    classical: 'y-a',
    kind: 'voluntative',
    harmony: 'masculine',
    attested: 7,
    share: 0.88,
    linking: true,
  },
  {
    cyrillic: 'е',
    classical: 'y-e',
    kind: 'voluntative',
    harmony: 'feminine',
    attested: 6,
    share: 1,
    linking: true,
  },
  {
    cyrillic: 'ье',
    classical: 'y-e',
    kind: 'voluntative',
    harmony: 'feminine',
    attested: 12,
    share: 1,
    linking: true,
  },

  // **The polite imperative -аарай⁴** is `γarai`/`γerei`. Spelled short for
  // the same reason as `ад`: the stem's final vowel merges into the long one,
  // so peeling `арай` leaves яваарай on ява-. Linking is 3 of 3 on the
  // masculine rows (анхаараарай `angqaruγarai`, болоорой `boluγarai`). The
  // feminine row has four attestations, all vowel-final, and carries the flag
  // anyway: it is the same suffix in its other harmony, not a separate claim.
  {
    cyrillic: 'арай',
    classical: 'γarai',
    kind: 'imperative',
    harmony: 'masculine',
    attested: 12,
    share: 1,
    linking: true,
  },
  {
    cyrillic: 'орой',
    classical: 'γarai',
    kind: 'imperative',
    harmony: 'masculine',
    attested: 6,
    share: 1,
    linking: true,
  },
  {
    cyrillic: 'эрэй',
    classical: 'γerei',
    kind: 'imperative',
    harmony: 'feminine',
    attested: 4,
    share: 1,
    linking: true,
  },
];

/** Verb suffix entries whose Cyrillic form ends `word`, longest first. */
export const verbSuffixesEndingIn = (word: string): VerbSuffixEntry[] =>
  verbSuffixes
    .filter((s) => word.endsWith(s.cyrillic))
    .sort((a, b) => b.cyrillic.length - a.cyrillic.length);
