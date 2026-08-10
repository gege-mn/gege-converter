import { describe, expect, it } from 'vitest';
import { analyze, convert, parseVerb } from '../src/index.js';
import { toScript } from '../src/romanize.js';

/**
 * Conversions confirmed by a bichig reader, and the ones they rejected.
 *
 * This is the only test file whose expectations come from a human rather than
 * from Tungaamal or from our own reasoning, which makes it the highest-authority
 * fixture in the suite — Tungaamal is a strong signal but it is still another
 * converter, and on the points where this project deliberately differs from it
 * (Unicode 16 connectors, the o/ö rule, the V+i diphthong) Tungaamal is simply
 * wrong. A failure here means the converter regressed against ground truth.
 *
 * Compared in SCRIPT, because γ/g and q/k are harmony-selected allographs of a
 * single letter and the romanization is not unique. See `eval.mjs`.
 *
 * Reviewed 2026-07-26 via `scripts/build-spotcheck.mjs`.
 */

const same = (cyrillic: string, classical: string) =>
  expect(convert(cyrillic), `${cyrillic} should be ${classical}`).toBe(toScript(classical));

describe('confirmed by a bichig reader', () => {
  it('restores the unstable vowel Cyrillic drops before a suffix', () => {
    // ажил + аас is written ажлаас; peeling the suffix leaves ажл, which is not
    // a word. All four were previously guesser output and all four were ruled
    // wrong; Tungaamal's readings were ruled right and are what we now produce.
    same('ажлаас', 'aǰil-ača');
    same('мэргэжлийн', 'merγeǰil-ün');
    same('учраас', 'učir-ača');
    same('хамгийн', 'qamuγ-un');
  });

  it('handles the derived plural мэргэжилтнүүд', () => {
    // Reader-supplied form, not Tungaamal's — Tungaamal has no row for this word.
    same('мэргэжилтнүүд', 'merγeǰilten-üd');
  });

  it('absorbs a plain vowel after an iotated one', () => {
    // ю already carries its u, so юу is one long vowel, not two.
    same('жаргаюу', 'ǰarγayu');
    same('аюул', 'ayul');
    same('авъяас', 'abiyas');
  });

  it('contracts a suffix against an и/й-final stem', () => {
    same('толгойгоо', 'toluγai-ban');
    same('зорилгоор', 'ǰorilγ-a-bar');
    // `toγusγ-a-bar`, not `toγusq-a-bar`. This assertion carried ХА from
    // 2026-07-26 until the reader supplied ᠲᠣᠭᠤᠰᠭ<MVS>ᠠ directly on 2026-07-29 and
    // overruled it. Not re-litigated by inference — asked, and answered.
    //
    // The 2026-07-26 batch varied the *suffix contraction*, which is what its
    // title says, and held the stem constant. The letter was never the
    // question, so it was never the verdict. Same mechanism as шар.
    same('тоосгоор', 'toγusγ-a-bar');
    same('гэрээгээ', 'γer-e-ben');
  });

  it('stacks ablative + reflexive on a chachlag stem', () => {
    same('хойноосоо', 'qoin-a-ača-ban');
    same('гаднаасаа', 'γadan-a-ača-ban');
  });

  it('builds the past participle from a verb stem', () => {
    // Reader, 2026-07-27: "нэр = нэрэ (noun), нэрлэх = нэрэлэхү (verb),
    // сан/сон = гсан (past tense)". The stem comes from the нэрлэх infinitive
    // already in the dictionary; the -гсан pairing was mined independently and
    // agrees at 94-100% over 25 attestations.
    same('нэрлэсэн', 'nereleγsen');
  });

  it('drops the linking н Cyrillic inserts (жийрэг н)', () => {
    // Reader, 2026-07-27: "хэл + д (one of those cyrillic rules popped up a
    // жийрэг н out of nowhere)". The Classical has no NA at all.
    same('хэлэнд', 'kele-dü');
  });

  it('keeps the н when it belongs to the Classical stem', () => {
    // The mirror case, and the reason the rule lives in `stem.ts` behind a
    // dictionary check rather than in `segment.ts`. Nothing in the Cyrillic
    // distinguishes these from хэлэнд — it is lexical.
    same('усанд', 'usun-du');
    same('модонд', 'modun-du');
  });

  it('leaves these alone — confirmed correct as-is', () => {
    same('гүйцэх', 'γüičeqü');
    same('зохиомж', 'ǰoqiyamǰi');
    same('цахиур', 'čaqiγur');
    same('зорихоор', 'ǰoriqu-bar');
    same('тав', 'tabun');
  });

  /**
   * The 2026-08-07 ask batch, answered 2026-08-10.
   *
   * All four below were already what we emit, so nothing changed — and that is
   * the point of recording them. An unasked agreement is an assumption; an
   * asked one is a fixture, and these now fail loudly if a later change moves
   * them. **сургуулийн is the one worth noticing**: `docs/roadmap.md` opens on
   * a table of three words the stem layer could not inflect, and this is that
   * table's first row, now confirmed right by the reader rather than by us.
   */
  it('answers the 2026-08-07 batch — U1, S1, S2', () => {
    // U1: найм — YA + FVS1, the form we already emit.
    same('найм', 'nay1ma');
    // S1: сургуулийн — the stem keeps its full form under the genitive.
    same('сургууль', 'surγaγuli');
    same('сургуулийн', 'surγaγuli-yin');
    // S2: бие — YA, not a bare I diphthong.
    same('бие', 'bey-e');
  });

  /**
   * S4, хийн — the reader's answer is that there **is** no answer at the word
   * level: *"genuinely ambiguous, needs the sentence."*
   *
   * So the assertion is deliberately not `same()`. What must hold is that the
   * converter keeps more than one reading rather than committing to one, which
   * is the honest behaviour for a homograph and is what `Candidate[]` is for.
   * A future change that collapses this to a single confident reading is a
   * regression even if the reading it picks happens to be the commoner one.
   */
  it('keeps хийн ambiguous, because the reader says the word cannot decide it', () => {
    const readings = analyze('хийн')[0]?.candidates ?? [];
    expect(new Set(readings.map((c) => c.script)).size).toBeGreaterThan(1);
  });
});

/**
 * Ruled WRONG by the reader and still wrong. Each needs machinery this package
 * does not have yet, so they are recorded rather than asserted — the point is
 * that the correct answer is written down, from a human, before anyone tries to
 * fix it and has to guess what "right" was.
 *
 *   хэвтэрт      → kebteri-du   (also kebteri-dur). We emit an over-segmented
 *                  qeb-tü-ber-tü: хэвтэр is not in any dictionary, so a short
 *                  known stem plus three suffixes outscores the unknown whole
 *                  word. Lowering SUFFIX_PENALTY does not fix it — swept
 *                  0.7→0.3 on 2026-07-26 and 0.7 was already optimal.
 *   ангижрасан   → anγiǰraγsan. The -гсан past participle is verb morphology,
 *                  which the suffix table deliberately excludes entirely. We
 *                  emit anγiǰrasan — right but for the γ, and now labelled
 *                  `guess` + `participle-past` instead of asserted.
 *   хүлээгээд    → the reader gave küliyeged but flagged their own romanization
 *                  as uncertain, so the target is not yet trustworthy. We now
 *                  emit küleged, which is close; before the suffix-order rule
 *                  it was qüliy-e-ben-dü, reading the -ээд converb as reflexive
 *                  + dative.
 *
 * That reflexive-then-dative chain is not merely unattested, it is impossible —
 * the reflexive stacks *after* case in Khalkha. Refusing it (see
 * `suffix-order.test.ts`) does not teach the converter verbs; it stops the
 * converter inventing a confident noun reading of one. The remaining errors are
 * honest guesses now, which is the most that can be claimed without real verb
 * morphology.
 */
describe('particles do not inherit their neighbour’s harmony', () => {
  // Ruled 2026-07-27, from the first reader pass over converted running prose.
  // We emitted ᠶᠦᠮ mid-sentence, which looks like harmony picked up from the
  // preceding front-vowel word. A сул үг has its own vowel and never agrees.
  it('юм is invariantly masculine', () => {
    same('юм', 'yum');
  });

  // The same surface form is also an ordinary noun, which the old single
  // lexicon row conflated with the particle under the gloss "thing, is".
  it('keeps the noun reading of юм available', () => {
    const classicals = (analyze('юм')[0]?.candidates ?? []).map((c) => c.classical);
    expect(classicals).toContain('yaγum-a');
  });
});

/**
 * The first article converted end to end, 2026-07-28.
 *
 * A bichig reader ran a real article through the model-backed playground, then
 * corrected the output by hand and returned both versions with comments. That
 * makes these verdicts on *running text* rather than on sampled word lists —
 * the first time this project has had any. Every expectation below is the
 * reader's corrected form.
 */
describe('confirmed against a hand-corrected article', () => {
  it('reads өөр as "self" wherever it is inflected', () => {
    // The reader's first comment, and the error they called the main one:
    // "өөрсөд, өөрсдийгөө (өөр as in self, not different) — which is written
    // uber (өөр) and conjugated from there." We were building all of these on
    // `öger-e`, the homograph meaning "different".
    same('өөрийн', 'öber-ün');
    same('өөрсдийн', 'öbersed-ün');
    same('өөрсдийгөө', 'öbersed-i-ben');
    same('өөртөө', 'öber-tü-ben');
  });

  it('keeps өөр as "different" when it stands alone or derives', () => {
    // The homograph must not swing the other way: өөрчлөх is "to change".
    same('өөр', 'öger-e');
    same('өөрчлөх', 'ögerečileqü');
  });

  it('writes the imperfective converb -ж as ǰu/ǰü, not ǰi', () => {
    // Reader: "it mistook жу жү чу чү for жи чи for some reason."
    same('хийж', 'kiǰü');
    same('бодож', 'boduǰu');
    same('бичиж', 'bičiǰü');
  });

  it('writes the present-future -на/-нэ as n + MVS + the harmony vowel', () => {
    // зорино was coming out `ǰorin-iyan` from the model and `zorinu` from the
    // rules; both are the same missing row.
    same('зорино', 'ǰorin-a');
    same('хэлнэ', 'kelen-e');
    same('үзнэ', 'üǰen-e');
  });

  it('converts the lexical misses the article turned up', () => {
    same('зүгээр', 'ǰüger');
    same('цөөн', 'čögegen');
    same('үнэт', 'ünedü');
    same('цэн', 'čen-e');
    same('биз', 'biǰe');
    same('тэгээд', 'tegeged');
    same('хүртээмж', 'kürtegemǰi');
    same('бидний', 'biden-ü');
  });

  it('leaves энэхүү and a loanword alone', () => {
    // Two the reader let stand — kept so a later change cannot break them
    // silently. дижитал had picked up a spurious trailing MVS + a.
    same('энэхүү', 'enekü');
    same('дижитал', 'diǰital');
  });
});

describe('the perfective converb, spot-checked 2026-07-29', () => {
  // 13 of 14 in the "changed by this edit" group came back "New is right",
  // which is the ruling that promoted `-аад/-ээд` out of the do-not-guess list
  // and confirmed the linking vowel with it.
  it('takes the linking u/ü after a consonant-final Classical stem', () => {
    // ав → `ab`, so аваад is abuγad. This is the single verdict the change
    // turned on: without it the row alone scores 24% instead of 48%.
    same('аваад', 'abuγad');
    same('яваад', 'yabuγad');
    same('оруулаад', 'oruγuluγad');
    same('хүсээд', 'qüseγed');
  });

  it('leaves a vowel-final stem flat', () => {
    same('алдаад', 'aldaγad');
    same('дуулаад', 'daγulaγad');
    same('тоглоод', 'toγlaγad');
    same('зориглоод', 'ǰoriγlaγad');
  });

  it('handles the stems whose Cyrillic shape hides the stem vowel', () => {
    // Reader's notes: дуулаад is дуу + л + аад, and болиод is боль + оод —
    // the stem is not simply the word minus the ending in either case.
    same('болиод', 'boliγad');
    same('ахиад', 'aqiγad');
    same('уйлаад', 'uqilaγad');
    same('зууралдаад', 'ǰaγuralduγad');
  });
});

describe('known-wrong, awaiting verb morphology', () => {
  it.todo('хэвтэрт → kebteri-du');
  it.todo('ангижрасан → anγiǰraγsan');
  // Still a guess (`küleged`) even with the perfective row: the dictionary has
  // no хүлээх, so the row never fires. A missing stem, not a missing rule.
  it.todo('хүлээгээд → converb, romanization unconfirmed');
  // Reader, 2026-07-29: чад is not a verb stem and can never take -аад. The
  // verb чадах is чад in Cyrillic but `čida` in script, so the entry we carry
  // is wrong in a way no suffix rule can fix — and the harvested row for чад
  // alone is `čöγad`, wrong outright.
  it.todo('чадах → čidaqu, and чад alone must not take a verb ending');
  // From the 2026-07-27 reader pass. хийж was fixed on 2026-07-28 by the
  // imperfective converb row and now has a real test below; бэлгэшээсэн is
  // still a guess, and is a missing stem rather than a missing rule — the
  // dictionary has no бэлгэших.
  it.todo('бэлгэшээсэн → belgesiyegsen');
  // Both need a stem the dictionary does not carry (туурвих, бичигдэх), so the
  // suffix rows that would convert them never fire.
  it.todo('туурвиж → toγurbiǰu');
  it.todo('бичигдэнэ → bičiγden-e');

  it('no longer asserts an impossible chain for the -ээд converb', () => {
    // Not a claim that küleged is right — only that we stopped emitting a
    // parse the language cannot form, with lexicon-backed confidence.
    const [token] = analyze('хүлээгээд');
    expect(token?.verbForm?.kind).toBe('converb-perfective');
    for (const candidate of token?.candidates ?? []) {
      const chain = candidate.segmentation.suffixes.map((s) => s.category);
      const at = chain.indexOf('reflexive');
      expect(at === -1 || at === chain.length - 1, chain.join('+')).toBe(true);
    }
  });
});

/**
 * The reader's exact corrections from the 2026-07-29 spot check, none of which
 * the converter gets right yet. Recorded as `todo` rather than as a wishlist
 * elsewhere because this file is where ground truth lives — each one carries
 * the form the reader wrote, so implementing it needs no second consultation.
 */
describe('known-wrong, with the reader’s answer already in hand', () => {
  // The -нх- possessive stack, ruled twice and consistently: it is not a
  // morpheme at all. улсынхаа is the genitive `-un` followed by the reflexive
  // `-iyan`, and талынхаа the same over a chachlag stem. This is roadmap item
  // 4, and it now has ground truth instead of a description.
  it.todo('улсынхаа → ulus-un-iyan (stem улс)');
  it.todo('талынхаа → tal-a-yin-iyan');

  // Over-segmentation: we split бүтээлчи + дү + ээс, but -чид is the plural
  // agentive and takes the ablative whole.
  it.todo('бүтээлчдээс → bütügelčid-eče');

  // Wrong stem, each confirmed with the reader's own romanization.
  it.todo('биенийгээ → bei-e-yi-ben (stem бие, not би)');
  it.todo('зочилж → ǰočilaǰu (stem зочил, we carry зочи)');
  it.todo('энүүхнээр → enüken-iyer');
  it.todo('орчихдог → orčiqadaγ');
  it.todo('алдуурахаа → aldaγuraqu-ban');
  it.todo('дунгаар → stem дун, so дун + аар');
  it.todo('дуурийн → дуурь + ийн');
});

describe('гэдэс goes in only at an attached junction, ruled 2026-07-29', () => {
  // The reader's correction, in their words: "no gedes, it only apply when the
  // suffix is written with the word… -du is a suffix that uses MVS and is
  // visually separate from the word."
  //
  // So MVS-separation is a *necessary* condition for NOT inserting it, and the
  // dative can never take гэдэс no matter what the stem ends in. Our suffix
  // table already marks these `separate: true`, and the verb rows — the only
  // ones carrying `linking` — have no `separate` field at all because they are
  // all attached. The architecture happened to be right; now it has a reason.
  it('never inserts гэдэс before the MVS-separated dative', () => {
    same('улсад', 'ulus-tu');
    same('архивт', 'arqiw-tu');
  });

  // Attachment is necessary but NOT sufficient: судлаж is attached and takes
  // nothing, while авна is attached and takes it. That is why `linking` stays
  // a per-row flag rather than becoming a rule over junctions.
  it('still needs the per-suffix flag, because attachment alone does not decide', () => {
    same('судлаж', 'sudulǰu');
    same('авна', 'abun-a');
  });

  // The reader also gave массаж = ᠮᠠᠰᠰᠠᠵᠢ, which dissolves the question that
  // prompted all this. The vowel is not inserted at the junction — it belongs
  // to the STEM, because a үл дэвсгэр consonant cannot be word-final. The
  // harvest had `massaǰ`, ending in a bare ǰ, which is not a well-formed word.
  it('carries the vowel on the stem, not the junction, for a үл дэвсгэр final', () => {
    same('массаж', 'massaǰi');
    same('массажд', 'massaǰi-du');
  });

  // ...but only where a traditional spelling exists. целлюлоз has none, so it
  // is written as the Cyrillic is and ends BARE on ᠽ. Reader, 2026-07-29:
  // "foreign words most of the time are written exactly like the cyrillic one
  // unless we know of a traditional spelling… don't derive rules from foreign
  // words."
  //
  // This pair is the guard against a mistake already made once: массаж alone
  // was read as evidence that all 133 bare-final loanword stems were
  // malformed. They are not — they are exempt. Keeping both words asserted
  // side by side is what stops the inference being redrawn.
  it('leaves a foreign word with no traditional spelling bare', () => {
    same('целлюлоз', 'cēllyü1lüz');
  });
});

describe('the linking vowel on -на/-нэ and -сан/-сэн, ruled 2026-07-29', () => {
  // Asked rather than inferred. The evidence for these eight rows was almost
  // entirely the held-out gold set, so applying it from measurement alone
  // would have been fitting to the test set — the exact failure the miner had
  // just been guarded against. The reader ruled all six open words linked.
  it('inserts u/ü on the present-future after a consonant-final stem', () => {
    same('авна', 'abun-a');
    same('төрнө', 'törün-e');
    same('үнсэнэ', 'ünüsün-e');
  });

  it('inserts u/ü on the past participle after a consonant-final stem', () => {
    same('бэлдсэн', 'beledüγsen');
    same('төгссөн', 'teγüsüγsen');
    same('зориулсан', 'ǰoriγuluγsan');
  });

  // Control 1, and the reason this is a per-suffix flag rather than a blanket
  // rule: суд- ends in a consonant and -ж is consonant-initial, yet the
  // imperfective converb stays flat. Had the reader ruled the other way, every
  // consonant-initial suffix would have wanted the vowel.
  it('leaves the imperfective converb flat, consonant-final stem or not', () => {
    same('судлаж', 'sudulǰu');
  });

  // Control 2: the condition is the STEM ending in a consonant, not the
  // suffix being consonant-initial. ашигла- already ends in a vowel.
  //
  // Asserted through `parseVerb`, not `convert`, and the difference is a
  // finding rather than a convenience — see the todo below.
  it('inserts nothing after a vowel-final stem', () => {
    expect(toScript(parseVerb('ашиглаад')?.classical ?? '')).toBe(toScript('asiγlaγad'));
  });

  // The reader glossed ашиглаад "having used" — a verb — while our top-1 is
  // the dative `asiγla-du`, reading ашигла as a noun. Their verdict was
  // between two verb spellings, so it does NOT rule on which reading wins,
  // and promoting the verb here would be inventing a mandate they did not
  // give. Recorded so the next ranking pass has the evidence.
  it.todo('ашиглаад top-1 is the dative asiγla-du; the reader reads a verb');

  // The perfective converb was ruled first, on 2026-07-29, and is what put the
  // flag in the type at all. Pinned here so the three rulings stay consistent.
  it('agrees with the perfective converb ruled in the same session', () => {
    same('аваад', 'abuγad');
  });
});

describe('ᠰ against ᠱ, ruled 2026-07-29', () => {
  // Reader: "the double dotted one is only for foreign, or traditional spelt
  // words." So a native Mongolian word takes plain ᠰ even where Cyrillic
  // writes ш, and the double-dot ᠱ marks a loanword or a fixed old spelling.
  //
  // They gave a minimal pair, which is the sharpest possible statement of it:
  // the letter alone separates two words spelled identically in Cyrillic.
  it('separates шар the colour from шар the noise by the letter alone', () => {
    same('шар', 'sir-a');
    const readings = analyze('шар')[0]?.candidates.map((c) => c.classical) ?? [];
    expect(readings).toContain('sir-a'); // ᠰᠢᠷ<MVS>ᠠ — yellow
    expect(readings).toContain('šar'); // ᠱᠠᠷ — шар шар гэж дуугарах
  });

  // How this was caught, recorded because the mechanism will recur: шар was
  // changed an hour earlier on a chachlag ruling, and BOTH options shown to
  // the reader used ᠱ. They ruled on the final vowel; the letter rode along
  // unasked and shipped wrong. A question fixes what it varies and silently
  // asserts everything else it holds constant.
  it.todo('when a batch varies one thing, the constants are assumptions — not rulings');

  // Asked and answered 2026-08-04 — see the block below.
  it('settles the four rows this section left unswept', () => {
    same('багш', 'baγsi');
    same('шүд', 'sidü');
    same('маргааш', 'marγasi');
    same('шинэ', 'sin-e');
  });
});

describe('the four ᠱ rows, settled 2026-08-04', () => {
  // The batch this section asked for: options varying THE LETTER ALONE, with
  // every other difference split into its own question. шинэ differs from our
  // row in two ways (ᠱ→ᠰ and the chachlag) so it was asked twice; шүд carried
  // a final н, asked separately as N-class.
  //
  // All four moved to ᠰ. The reader also gave the scope, unprompted:
  //
  // > "š is mostly used for foreign words and traditionally spelt words like
  // > šar (this means a type of cow, but definitely not the color, as the
  // > color is sir-a)"
  //
  // which restates the 2026-07-29 rule and re-confirms the minimal pair.
  it('spells word-final ш with ᠰ', () => {
    same('багш', 'baγsi');
    same('маргааш', 'marγasi');
  });

  it('spells word-initial ш with ᠰ', () => {
    same('шинэ', 'sin-e');
    same('шүд', 'sidü');
  });

  // шүд is the one where the reader refused both options offered — "both
  // wrong, sidü" — rejecting the final н as well as the letter. Recorded
  // separately because a batch that only offers wrong answers is a failure of
  // the batch, and the escape hatch (a free-text note) is what saved it.
  it('drops the final н on шүд, which neither option offered', () => {
    same('шүд', 'sidü');
  });

  // NOT swept, again, and for the reason the toli itself demonstrates: over
  // 5,800 of its headwords containing ш, 4,360 take plain s and 1,462 take š.
  // ШИ- is unanimously si, but ША- splits — ШАА is `ša` while ШААГ is `siγaγ`.
  // So the letter is partly lexical and four answers do not license a sweep of
  // the 152 native-looking harvested rows.
  it.todo('the 152 harvested ᠱ rows — still unasked, and the toli splits on ША-');

  // ⚠ Methodological caveat, recorded because it affects how much these four
  // answers weigh. SA and SHA are reported to share the same glyph shapes in
  // all four positions (r12a.github.io/mongolian-variants), and the reader
  // said so themselves — "they look visually the same". So the ask page could
  // NOT have shown them the difference: they answered from the romanization
  // labels and from linguistic knowledge, not by sight. That is still a
  // reader verdict, but it is not the usual kind, and a spot-check cannot
  // confirm it the way it confirms a shape.
  it.todo('ᠰ/ᠱ cannot be judged by sight — these four rest on knowledge, not the page');
});

describe('the chachlag, ruled 2026-07-29', () => {
  // Asked as eight words with two controls, after our own curated lexicon was
  // found disagreeing with itself: it emitted `qar-a` for хар but `nere`,
  // `aqa`, `tala` for the rest, while CLAUDE.md and docs/harvest.md both cite
  // `qar-a` as *the* example of the convention. The reader ruled chachlag on
  // every one, and both controls behaved — which is the only reason to trust
  // the sweep rather than suspect the question was leading.
  it('separates the final vowel on the words the reader ruled', () => {
    same('нэр', 'ner-e');
    same('ах', 'aq-a');
    same('тал', 'tal-a');
    // `sir-a`, not `šir-a`. The chachlag ruling was about the final vowel, and
    // both options put to the reader used the double-dot ᠱ, so that letter
    // rode along unasked and shipped wrong. Corrected an hour later — see the
    // с/ш block below.
    same('шар', 'sir-a');
    same('бага', 'baγ-a');
  });

  // тал was in fact ruled twice. The -нх- possessive verdict above already
  // spelled талынхаа `tal-a-yin-iyan` over a chachlag stem, which nobody
  // noticed contradicted the `tala` we were shipping.
  it('agrees with the earlier -нх- ruling about the same stem', () => {
    expect(convert('тал')).toBe(toScript('tal-a'));
  });

  // Control 1: already correct before the batch, and the reader confirmed it
  // rather than being asked to change it. If this ever flips, the convention
  // has been misunderstood wholesale rather than in five rows.
  it('leaves хар alone — it already carried the chachlag', () => {
    same('хар', 'qar-a');
  });

  // Control 2: a word with no final vowel at all. Included so that a reader
  // answering "chachlag" to everything would be visible instead of silently
  // confirming the hypothesis. They answered "no final vowel".
  it('does not invent a final vowel on ном', () => {
    same('ном', 'nom');
  });

  // The ruling is lexical, NOT a rule over bare final a/e. Of the 28 curated
  // rows ending in a bare vowel, the independent 2015 source says *joined* for
  // twelve of them. Generalising would have broken all twelve.
  it('does not spread to words the ruling did not cover', () => {
    same('хот', 'qota');
    same('үг', 'üge');
    same('эх', 'eke');
  });

  // The reader's own caveat: "some words mean different things with
  // цацлаг/орхиц or сүүл". хар is exactly that pair, and both readings are
  // carried — `qar-a` black against the verb stem `qara` "to look". So a
  // future sweep must never rewrite every bare final vowel in place.
  it('keeps the verb stem qara distinct from qar-a', () => {
    const readings = analyze('хар')[0]?.candidates.map((c) => c.classical) ?? [];
    expect(readings).toContain('qar-a');
    expect(readings).toContain('qara');
  });
});

describe('чоно and the тогтворгүй н, ruled 2026-08-04', () => {
  // `činua` was a vowel straight after a vowel with no connector — malformed
  // rather than a spelling anyone chose. The toli independently writes
  // ᠴᠢᠨᠤ<MVS>ᠠ and the reader confirmed it.
  it('gives чоно its chachlag', () => {
    same('чоно', 'činu-a');
  });

  // The тогтворгүй н, asked on алт and тос. The reader picked the н-less
  // citation form BOTH times — but added, on алт: "i think both are correct,
  // one ending in 'n' is a traditional spelling, and also correct."
  //
  // So this is NOT a correction: `altan` is not wrong, it is the other valid
  // form. That makes it additive — offer both — rather than a replacement,
  // and it is why nothing was flipped on the strength of it.
  // ✅ CLOSED for алт on 2026-08-10 (S3). Asked again, directly, the reader
  // said: *"both are correct and both should be offered — alta would be more
  // closer modern one, so offer it at higher freq."* So `alta` keeps the
  // weight and `altan` becomes a second row rather than a replacement.
  it('offers both citation forms of алт, the modern one first', () => {
    const readings = analyze('алт')[0]?.candidates ?? [];
    const alta = readings.findIndex((c) => c.script === toScript('alta'));
    const altan = readings.findIndex((c) => c.script === toScript('altan'));
    expect(alta, 'alta must be offered').toBeGreaterThanOrEqual(0);
    expect(altan, 'altan must be offered').toBeGreaterThanOrEqual(0);
    expect(alta, 'alta ranks above altan').toBeLessThan(altan);
  });

  // ⚠ STILL OPEN for тос, deliberately. The reader's "both are correct" was
  // said about **алт** both times it was said, and S3 asked about алт alone.
  // Extending it to тос is the move CLAUDE.md warns about — an ask page answers
  // about *words* and cannot tell you a rule's scope — and it is how
  // `repairDevoicedGa` reached 224 wrong words. тос is one question away.
  it.todo('тос: is tosun a second valid citation form, as altan is for алт?');

  // ✅ CLOSED 2026-08-06, and it is the "do both at once" this asked for.
  //
  // The rows used to be inconsistent — шувуу `sibaγu`, загас `ǰiγasu` and мөнгө
  // `mönggü` н-less, алт `altan`, тос `tosun` and давс `dabusun` with the н
  // baked in — and the н-baked ones were the ones whose obliques worked, because
  // nothing read `hiddenN` and a н-less stem simply lost the letter. Flipping
  // алт alone would have traded a correct oblique for a correct citation form.
  //
  // Now the citation form is the reader's *and* the oblique keeps its н, which
  // is the pair of assertions below. All six rows spell the н-less stem.
  it('spells the citation form н-less and the oblique with the н', () => {
    same('алт', 'alta');
    same('алтны', 'altan-u');
    same('тос', 'tosu');
    same('тосны', 'tosun-u');
    same('давс', 'dabusu');
    same('давсны', 'dabusun-u');
    same('загасны', 'ǰiγasun-u');
  });
});

describe('the oblique pronoun stems, ruled 2026-08-04', () => {
  // Closes the ⚠ row opened in lexicon.ts the same day: чам- was the one stem
  // in the oblique paradigm that no tier held, so `čima` came from the
  // reference grammars rather than from our data. It stands — but only as the
  // suffixation stem, and two of the six forms turn out to be traditional
  // spellings the тийн ялгал does not predict. The reader flagged both as
  // such, unprompted, which is the only reason they are rows and not a rule.

  // Written SOLID, one word, no connector. `čima-yi` / `nama-yi` are what the
  // case rule gives, and the reader confirms those are *technically* correct —
  // the solid spelling is simply the traditional one, and it is what carried
  // over. These are the two heaviest Cyrillic tokens in the whole guess tier
  // (1,967 and 1,904) and both used to come out `čama-yi` / `nama-yi`, built
  // on a guessed stem that does not exist in any tier.
  it('writes the accusative pronouns solid', () => {
    same('чамайг', 'čimai');
    same('намайг', 'namai');
  });

  // The forms the reader says the word actually appears in — and they keep the
  // chachlag, corrected 2026-08-06 from the `čima-` these asserted for two
  // days. The reader wrote чамаас out as `čim-a-ača` with the note "for some
  // reason the chachlag got lost… чам = čim-a".
  //
  // The 2026-08-04 ask could not have caught this: its чамд question offered
  // `čima-du`, `čimad` and `čimada`, none of which carried a chachlag. The
  // answer was the best of three bad options, not a ruling on the chachlag.
  it('builds the oblique cases off čim-a, keeping the chachlag', () => {
    same('чамд', 'čim-a-du');
    same('чамаас', 'čim-a-ača');
  });

  it('takes a connector at both joins when a reflexive stacks', () => {
    same('чамдаа', 'čim-a-du-ban');
  });

  // Derived, not stored — the reflexive attaches to the solid accusative row
  // above. This is the assertion that proves that row works as a stem and not
  // merely as a whole-form shortcut.
  it('stacks the reflexive on the solid accusative', () => {
    same('чамайгаа', 'čimai-ban');
  });

  // ✅ CLOSED 2026-08-06. This was an `it.todo` saying чам needed a bare-form
  // key on `LexiconEntry`, because the bare word was `čim-a` and suffixation
  // apparently wanted `čima-`. There was never a conflict: the reader's later
  // `čim-a-ača` shows the chachlag is retained under suffixes too, which is what
  // хойноосоо and зорилгоор already say. One row spells both.
  //
  // Worth keeping as a note on method rather than deleting: the "two spellings,
  // one key" problem was inferred from an ask whose options could not express
  // the right answer. The inference was sound and the premise was manufactured
  // by the question. алт/тос remain genuinely blocked on `hiddenN`; this one
  // never was.
  it('spells bare чам and its suffixed forms from a single row', () => {
    same('чам', 'čim-a');
    same('чамаас', 'čim-a-ača');
  });
});

/**
 * The 2026-08-06 release spot-check, and the one diagnosis behind most of it.
 *
 * Twenty-one words went to a reader before publishing 0.3.0. Four confirmed
 * this release's changes; **none was a regression** — every rejected word was
 * already wrong in 0.2.1. What the batch bought was not a bug list but a
 * cause, visible only because the reader ruled on inflected forms while the
 * bare stems were already right:
 *
 *     хэмжээ    qemǰiy-e   ✓        хэмжээнд   qemǰen-dü    ✗  (qemǰiyen-dü)
 *     үнэ       ün-e       ✓        үнийг      ün-i         ✗  (ün-e-yi)
 *     байшин    baising    ✓        байшингийн baišingγ-un  ✗  (baising-un)
 *
 * The stem is in the dictionary and correct, and attaching a suffix throws it
 * away — the inflected form is being rebuilt by the guesser instead of from
 * the row. Two things ride on that: the **тогтворгүй н** the reader flagged
 * twice unprompted (хэмжээнд, гараанаас), which `LexiconEntry.hiddenN` already
 * records and no code reads, and the epenthetic vowel (гишгэгдэх, өнгөлүүл,
 * хомхой). Those are one piece of machinery, not eleven word fixes, which is
 * why almost everything below is a todo rather than a row.
 */
describe('the release spot-check, ruled 2026-08-06', () => {
  // Fixed here, as rows. Each is one word with an exact reader-supplied form,
  // which is the evidence CLAUDE.md says produces a row rather than a rule.
  it('writes the loanword дизайн with both variation selectors', () => {
    same('дизайн', 'd1izain1');
  });

  it('reads боловч as the concessive, not as a stem plus a verb ending', () => {
    same('боловч', 'bolbaču');
  });

  it('keeps the epenthetic vowel in хомхой', () => {
    same('хомхой', 'qomuqai');
  });

  // ── The machinery gap. All of these have a correct bare stem already. ──

  // ✅ CLOSED 2026-08-06. Reader: "тогтворгүй н btw", volunteered on both of
  // these without being asked about н at all — which is what put the flag on
  // the critical path. `hiddenN` is now read in three places (see `stem.ts`).
  //
  // хэмжээнд needed a second thing beyond the flag: `dropLinkingN` strips a
  // linking *vowel and* н, so хэмжээн overshot to хэмжэ and matched nothing.
  // A stem that already ends in a vowel takes no linking vowel.
  it('brings back the тогтворгүй н under a case suffix', () => {
    same('хэмжээнд', 'qemǰiyen-dü');
    same('гараанаас', 'γaruγan-ača');
    same('хэмжээний', 'qemǰiyen-ü');
  });

  // The stem is `ün-e` in the lexicon and the inflected form drops the -e.
  it.todo('үнийг is ün-e-yi — the suffix must not eat the stem vowel');

  // ✅ CLOSED 2026-08-10, and NOT by the ш rule this was filed under.
  //
  // The ш → ᠰ half was never the blocker: the bare row already spelt `baising`
  // and the reader re-confirmed it that day (S5, байшин → `baising`, ᠰ). What
  // failed was the **г**. Peeling `-ийн` left байшинг, which matches nothing,
  // so the word fell to the guesser. `dropLinkingG` in `stem.ts` restores the
  // attested байшин and the row's own Classical answers the rest.
  //
  // Still NOT generalised: the reader's standing rule is that ш is for foreign
  // and traditionally-spelt words, and the 152 harvested ᠱ rows stay unasked.
  it('reads байшингийн off the bare row, restoring the linking г', () => {
    same('байшин', 'baising');
    same('байшингийн', 'baising-un');
  });

  it.todo('гишгэгдэх is γisqiγdeqü and өнгөлүүл is öngγeleγül — epenthetic vowels');
  it.todo('ингэснээр is ingγiγsen-iyer');
  it.todo('хүүхэлдэйн is qeüqeldei-yin');
  it.todo('одоохондоо is oduqan-du-ban — currently mis-segmented as oduqund-iyan');

  // дуурийн `daγuri-yin` against our `dur-un`: the long vowel is a contracted
  // medial γ. This is the decontraction `stem.ts` deliberately does not do,
  // and the reader has now put a confirmed instance behind it.
  it.todo('дуурийн is daγuri-yin — the long-vowel ↔ medial γ contraction');
  it.todo('ингээд is ingγiγed — the epenthetic vowel again, on a converb');

  // ✅ CLOSED 2026-08-06, with алт/тос and for the same reason.
  //
  // Both halves at once is the point: the row now spells the reader's citation
  // form and the oblique still has its н. Written `ǰirüqe` here and `ǰirüken-ü`
  // there because that is how the reader wrote them — q and k are the same
  // letter ᠬ, chosen by harmony, so the pair is consistent in script even
  // though the two romanizations look like they disagree.
  it('gives зүрх its citation form without losing the oblique н', () => {
    same('зүрх', 'ǰirüqe');
    same('зүрхний', 'ǰirüken-ü');
  });

  // Two different words spelt alike: хий "gas" + genitive, and the converb of
  // хийх. We emit one reading for both, and it is neither of them. A homograph
  // needs two rows and a ranker that can choose, so it is not a row fix.
  it.todo('хийн is qei-yin (of gas) or qin (converb of хийх) — a homograph');
});

/**
 * The тогтворгүй н, and the rule that finds it.
 *
 * The reader gave a working rule on 2026-08-06: **if the script form ends in a
 * vowel, chachlag included, the word takes an unstable н** — described as
 * having exceptions but as always working day to day. `stem.ts` uses it as the
 * default behind `LexiconEntry.hiddenN`, which overrides it in both directions.
 *
 * It is a default rather than a law, so what is worth asserting is not only
 * that it fires but that a row can stop it: the whole suite turned up exactly
 * one word that needs `hiddenN: false`, and that word is here.
 */
describe('тогтворгүй н, the rule given 2026-08-06', () => {
  // -ны/-ний is not a suffix beginning with н. The н is the STEM's, and what
  // follows it is the after-н genitive -ы/-ий — Хавсралт 2.1.1 row 1(b), which
  // puts н-final stems and тогтворгүй-н words under one condition. Every one of
  // these was in the head of `pnpm check:orphans`: a correct dictionary stem
  // thrown away and the word rebuilt letter by letter.
  it('reads -ны/-ний as the stem’s н plus the after-н genitive', () => {
    same('насны', 'nasun-u');
    same('дууны', 'daγun-u');
    same('анхны', 'angqan-u');
    same('сарны', 'saran-u');
    same('борооны', 'boruγan-u');
    same('нүдний', 'nidün-ü');
    same('модны', 'modun-u');
    same('усны', 'usun-u');
  });

  // A stem whose Classical already spells the н needs no restoration, and must
  // not be given a second one. Both spellings of the same fact land here.
  it('leaves an already-н-final stem alone', () => {
    same('нарны', 'naran-u');
    same('усанд', 'usun-du');
  });

  // ⚠ The exception, and the reason the flag overrides the rule. `kele` ends in
  // a vowel, so the rule claims a тогтворгүй н — and хэлэнд is `kele-dü`, ruled
  // above, where the н is the жийрэг н Cyrillic inserts and Classical has not.
  // Nothing in the Cyrillic separates this from усанд; it is lexical.
  it('does not give хэл one — the row overrides the rule', () => {
    same('хэлэнд', 'kele-dü');
  });

  // Not every н-initial Cyrillic ending is this. нүдээр keeps its vowel-final
  // stem, because the restoration is offered only where the surface writes the
  // н — an unconditional one would put `nidün-iyer` beside `nidü-ber` with
  // nothing to choose between them.
  it('restores only where the Cyrillic writes the н', () => {
    same('нүдээр', 'nidü-ber');
  });

  // Two speculative steps must not stack. бананы peels to бана, the epenthesis
  // rule offered бан, and бан resolved as ба + н — so a banana came out `ban-u`.
  //
  // ⚠ The target was `banan-u` until 2026-08-10, and that was this project's
  // construction, not a verdict: the guard was written about the *mechanism*
  // and the expected string was filled in by assuming банан inflects like a
  // native н-final stem. The reader ruled the word itself: банан is `banana`,
  // spelled as the foreign word, so the genitive is `banana-yin`. "It's a
  // foreign word, so spelt exactly banana in bichig, and mongolian one would
  // be гадил."
  //
  // The guard still guards. банан is now a curated row, so the two-guess path
  // is not what answers this — but the row is `banana`, vowel-final, and only
  // the genitive allomorph added the same day lets it assemble at all.
  it('does not build a reading out of two guesses', () => {
    same('бананы', 'banana-yin');
  });

  // ⚠ Regression guard, from the 2026-08-06 audit. The plurals -нар/-нэр/-нууд
  // also begin with н, and that н is entirely their own (`nar`, `nuγud`). They
  // carry no `after` condition, so nothing else rejects a stem with an н glued
  // on: багшнар was a coin flip between these two at 0.47 each until the
  // trigger was narrowed to `carriesStemN`.
  it('does not read a plural’s own н as the stem’s', () => {
    same('багшнар', 'baγsi-nar');
    same('эмчнэр', 'emči-ner');
  });

  // ⚠ Regression guard, same audit. The н is put back only where the Cyrillic
  // is otherwise fully accounted for — never on `dropLinkingN`'s two-letter
  // strip, whose whole premise is that the н is a letter Classical does NOT
  // have. Doing it there reached the wrong word: тахин became тахи + н, and the
  // resulting n-final stem cannot take this vowel-final reflexive at all, so
  // the word lost every reading and fell to the guesser.
  it('leaves a linking н alone rather than restoring it', () => {
    same('тахингаа', 'taq-a-ban');
    same('өнгөлөнгөө', 'öngγele-ben');
  });
});

/**
 * The 2026-08-09 spot-check, answered in full.
 *
 * The batch that produced these was the review loop for the soft-sign stem fix,
 * and its most useful result was not a new rule. Nearly every stem the reader
 * corrected was **already in the data, spelled exactly as they gave it** —
 * утга `udq-a`, хаалга `qaγalγ-a`, найруулга `nairaγulγ-a`, орчуулга
 * `orčiγulγ-a`, дэлхий `delekei`, сүү `sün`, хоног `qonuγ`, минут `minü1t`.
 * What failed was reaching them: Cyrillic drops a stem's final а/э in front of
 * a vowel-initial suffix, so утгыг peels to утг and орчуулгын to орчуулг, and
 * a correct row went unfound. That is the roadmap's stem thesis restated by a
 * reader — the gap is resolution, not coverage.
 */
describe('spot-check answered 2026-08-09', () => {
  // The а/э the suffix absorbed, restored. All four were "Tungaamal is right",
  // i.e. we were wrong and their reading is the target.
  it('finds a chachlag stem through a vowel-initial suffix', () => {
    same('утгыг', 'udq-a-yi');
    same('хаалгаа', 'qaγalγ-a-ban');
    same('найруулгыг', 'nairaγulγ-a-yi');
    same('орчуулгын', 'orčiγulγ-a-yin');
  });

  // Approved unchanged from the "changed" group — these are what the soft-sign
  // restoration produced, and the reader took them as correct.
  it('keeps the ь-final stems the soft-sign restoration recovered', () => {
    same('байгалийн', 'baiγali-yin');
    same('торгуулийн', 'torγaγuli-yin');
    same('торгуулийг', 'torγaγuli-yi');
    same('медалийг', 'mēdal-i');
    same('тохийг', 'toqi-yi');
    same('урлагийн', 'uraliγ-un');
  });

  // ⚠ Regression guard. хоног was briefly `qoni-yi` — хон + accusative г, with
  // хон resolved to the attested хонь — because the first version of the
  // soft-sign rule fired regardless of which suffix had been peeled. The ь only
  // ever disappears in front of a *vowel*, so this is the shape that proves the
  // gate is still there.
  it('does not restore a soft sign before a consonant-initial suffix', () => {
    same('хоног', 'qonuγ');
    same('хоногийн', 'qonuγ-un');
  });

  // ⚠ филармонид was `filarmuni-du` here until 2026-08-10, and the u was ours,
  // not the reader's: the o/ö-only-in-the-first-syllable rule was applied to a
  // loanword, where it does not reach. Reader: "foreign word, can have o after
  // first syllable." Same shape as the two withdrawals recorded in CLAUDE.md —
  // our inference *from* a reader answer, not the answer.
  it('handles the rest of the batch the reader confirmed', () => {
    same('их', 'yeke');
    same('уншвал', 'ungsibal');
    same('филармонид', 'filarmoni-du');
    same('хос', 'qoos');
    same('зээлийн', 'ǰiγele-yin');
    same('сүлжээнд', 'sülǰiyen-dü');
    same('хэд', 'qedü');
  });

  // ─── Still open from the same batch ──────────────────────────────────────
  // Each has a reader-given target and a diagnosis; none is a mystery.

  // Reader: "kelen-ü, stem = хэл (kele), and unstable n comes in". ⚠ This sits
  // against the standing хэл ruling, where `hiddenN: false` was added because
  // хэлэнд is `kele-dü` with no н. Both can hold — Хавсралт 2.1.1 conditions
  // the genitive on н where the dative does not — but it means хэл needs a
  // per-case answer rather than one flag, so it is not a one-line change.
  it.todo('хэлний is kelen-ü while хэлэнд stays kele-dü');

  // Stems present and correct; the peel cannot reach them. сүү takes a linking
  // г (сүү+г+ээр), эр takes the derivational -чүүд.
  //
  // ⚠ дэлхийн left this list on 2026-08-10 — see the й restoration in the
  // 2026-08-10 block below. It was the same absorption as хоолойн and
  // заламгайн, which is only visible once three words show the shape.
  it.todo('сүүгээр is sün-iyer — the linking г belongs to neither side');
  it.todo('эрчүүд is erečüd — stem эр plus derivational -чүүд');

  // ⚠ энгийн and худалдааг were `it.todo`s here from 2026-07-30 to 2026-08-10.
  // Both are now `same()` assertions in the block below — see the note there
  // about why an `it.todo` was the wrong home for either of them.

  // Reader: "stem = хонго, хонггу-йи". We reach хоног `qonuγ` instead, which is
  // a different word; nothing currently distinguishes them from the Cyrillic.
  it.todo('хонгыг is qongγu-yi — stem хонго, not хоног');

  // minü1t is right; the genitive picks `un` where the reader gives `ün`. A
  // harmony question about a loanword stem, so it does not generalise.
  it.todo('минутын is minü1t-ün — the loanword takes the front genitive');
});

/**
 * The toli-release spot check, 2026-08-10.
 *
 * ⚠ Two of these had been `it.todo`s since 2026-07-30, and энгийн is a word the
 * reader reports correcting **six times**. That is the finding, not the word: a
 * verdict parked in an `it.todo` changes nothing, so the spot check keeps
 * sampling the same wrong output and the reader keeps paying to re-rule it. A
 * reader verdict with a known Classical form belongs in `lexicon.ts` the day it
 * arrives. `it.todo` is for a target we cannot yet *reach*, not one we have
 * simply not written down.
 */
describe('the toli-release spot check (2026-08-10)', () => {
  it('reads Cyrillic нг as ᠩ where the word is энг', () => {
    same('энгийн', 'eng-ün');
  });

  it('has худалдаа as a curated stem', () => {
    same('худалдааны', 'qudalduγan-u');
    same('худалдааг', 'qudalduγ-a-yi');
  });

  it('brings back the тогтворгүй н on сэргэ', () => {
    same('сэргэн', 'sergün');
  });

  it('gives a bare-consonant loanword the consonant-final genitive', () => {
    // токар ends on the р, so `-un`, not the `-yin` a vowel-final stem takes.
    same('токарын', 'toqar-un');
  });

  // The stem's own final й, absorbed by a й-initial suffix. Cyrillic writes one
  // й where stem and suffix each contribute one, so the peel leaves a form that
  // is nothing (хооло, заламга, дэлх) and all three fell to the guesser.
  //
  // дэлхийн had been an `it.todo` since 2026-07-30 and was diagnosed correctly
  // there — "the stem loses its final й to the suffix" — but as one word it read
  // as a one-off. Two more of the same shape in one spot check is what turned it
  // into a rule worth writing.
  it('restores a stem-final й the suffix absorbed', () => {
    same('хоолойн', 'qoγulai-yin');
    same('заламгайн', 'ǰalmaγai-yin');
    same('дэлхийн', 'deleqei-yin');
  });

  // Cyrillic нг again, the дэн counterpart of энг above.
  it('reads дэнг as ᠳ+ᠩ', () => {
    same('дэнгийн', 'd1ēng-ün');
  });

  // ⚠ Not a spelling correction — a key correction. See the row in lexicon.ts.
  it('has хүү as qüü, with köbegün on its own headword', () => {
    same('хүүг', 'qüü-yi');
    same('хөвгүүн', 'köbegün');
  });

  // The тогтворгүй н on a stem that is consonant-final in Cyrillic and
  // vowel-final in Classical. `unstableNStems` used to test the Cyrillic side
  // and so could not see these at all — see the comment there.
  it('brings back the н on a stem only Classical spells vowel-final', () => {
    same('хувцаснаас', 'qubčasun-ača');
    same('хуудаснаас', 'qaγudasun-ača');
  });

  // ⚠ Regression guard for the narrowing that fix needed. Both of these are
  // й-final in Cyrillic and vowel-final in Classical, so nothing on the
  // Classical side distinguishes their genitive from a stem's тогтворгүй н.
  it('does not read a genitive н as the stem’s after a й', () => {
    same('хоолойн', 'qoγulai-yin');
    same('заламгайн', 'ǰalmaγai-yin');
  });
});
