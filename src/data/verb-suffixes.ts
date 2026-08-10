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
 * Three different measurements are stacked here, and the invocation that
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
  {
    cyrillic: 'даг',
    classical: 'daγ',
    kind: 'participle-habitual',
    harmony: 'masculine',
    attested: 4,
    share: 1,
  },
  {
    cyrillic: 'дог',
    classical: 'daγ',
    kind: 'participle-habitual',
    harmony: 'masculine',
    attested: 5,
    share: 1,
  },
  {
    cyrillic: 'дэг',
    classical: 'deγ',
    kind: 'participle-habitual',
    harmony: 'feminine',
    attested: 3,
    share: 0.67,
  },
  {
    cyrillic: 'дөг',
    classical: 'deγ',
    kind: 'participle-habitual',
    harmony: 'feminine',
    attested: 3,
    share: 0.67,
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
    attested: 3,
    share: 0.02,
  },
  {
    cyrillic: 'ж',
    classical: 'čü',
    kind: 'converb-imperfective',
    harmony: 'feminine',
    after: 'hard',
    attested: 2,
    share: 0.07,
  },
  {
    cyrillic: 'ч',
    classical: 'ču',
    kind: 'converb-imperfective',
    harmony: 'masculine',
    after: 'hard',
    attested: 9,
    share: 0.21,
  },
  {
    cyrillic: 'ч',
    classical: 'čü',
    kind: 'converb-imperfective',
    harmony: 'feminine',
    after: 'hard',
    attested: 7,
    share: 0.17,
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

  // Conditional converb.
  {
    cyrillic: 'вал',
    classical: 'bal',
    kind: 'converb-conditional',
    harmony: 'masculine',
    attested: 5,
    share: 1,
  },
  {
    cyrillic: 'вэл',
    classical: 'bel',
    kind: 'converb-conditional',
    harmony: 'feminine',
    attested: 1,
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
];

/** Verb suffix entries whose Cyrillic form ends `word`, longest first. */
export const verbSuffixesEndingIn = (word: string): VerbSuffixEntry[] =>
  verbSuffixes
    .filter((s) => word.endsWith(s.cyrillic))
    .sort((a, b) => b.cyrillic.length - a.cyrillic.length);
