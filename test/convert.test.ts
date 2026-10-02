import { describe, expect, it } from 'vitest';
import { analyze, convert } from '../src/index.js';
import { toScript } from '../src/romanize.js';

describe('convert', () => {
  it('converts a known word', () => {
    expect(convert('монгол')).toBe(toScript('mongγul'));
    expect(convert('бичиг')).toBe(toScript('bičig'));
  });

  it('joins a detached suffix with MVS, not NNBSP', () => {
    expect(convert('хотод')).toBe(toScript('qota-du'));
    expect(convert('хотод')).toContain('\u180E');
    expect(convert('хотод')).not.toContain('\u202F');
  });

  it('prefers the more frequent reading of an ambiguous word', () => {
    // хар is both "black" (qar-a) and the stem of "to look" (qara).
    expect(convert('хар')).toBe(toScript('qar-a'));
  });

  it('passes through spaces, punctuation, numbers and Latin unchanged', () => {
    expect(convert('хот, 2026 ok')).toBe(`${toScript('qota')}, 2026 ok`);
  });

  it('preserves word order across a sentence', () => {
    expect(convert('сайн ном')).toBe(`${toScript('sain')} ${toScript('nom')}`);
  });

  it('handles empty input', () => {
    expect(convert('')).toBe('');
  });

  it('is case-insensitive on input', () => {
    expect(convert('Монгол')).toBe(convert('монгол'));
  });

  it('still emits something for unknown words, via the guesser', () => {
    const out = convert('компьютер');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toBe('компьютер');
  });
});

describe('analyze', () => {
  it('returns every reading of an ambiguous word, best first', () => {
    const [word] = analyze('хар');
    expect(word?.candidates).toHaveLength(2);
    expect(word?.candidates[0]?.classical).toBe('qar-a');
    expect(word?.candidates[0]?.gloss).toBe('black');
    expect(word?.candidates[1]?.classical).toBe('qara');
  });

  it('gives confidences that sum to 1', () => {
    const [word] = analyze('хар');
    const total = (word?.candidates ?? []).reduce((sum, c) => sum + c.confidence, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('ranks a lexicon hit above a guess', () => {
    const [word] = analyze('хотод');
    expect(word?.candidates[0]?.provenance).toBe('lexicon');
    expect(word?.candidates[0]?.segmentation.stem).toBe('хот');
  });

  it('reports the segmentation it used', () => {
    const [word] = analyze('хотод');
    expect(word?.candidates[0]?.segmentation.suffixes[0]?.category).toBe('dative-locative');
  });

  it('leaves non-word tokens without candidates', () => {
    const analyzed = analyze('хот 2026');
    expect(
      analyzed.filter((a) => a.token.kind !== 'word').every((a) => a.candidates.length === 0),
    ).toBe(true);
  });

  it('keeps token offsets in code points', () => {
    const analyzed = analyze('🐎 хот');
    expect(analyzed.find((a) => a.token.kind === 'word')?.token.start).toBe(2);
  });

  it('honours maxCandidates', () => {
    const [word] = analyze('хар', { maxCandidates: 1 });
    expect(word?.candidates).toHaveLength(1);
    expect(word?.candidates[0]?.confidence).toBe(1);
  });
});

/**
 * `-тай³` is two suffixes wearing one Cyrillic surface.
 *
 * Rulebook §2.3.6 makes the adjective-forming дагавар залгаж (хэрэгтэй, ёстой,
 * санаатай) and the case-like comitative дагуулж. Nothing in the surface form
 * tells them apart, so both readings are built and `data/suffixes.ts` carries
 * the measured running-text `share`.
 *
 * ⚠ **The rulebook does not settle which one we emit.** Reader, 2026-08-10
 * (T1/T2): *"both correct, and it's simply a choice. we chose to detach."* So
 * §2.3.6 describes two well-formed spellings rather than selecting one, and
 * the running-text 72/28 split is house style. The ordering is a documented
 * project convention — `OFF_CONVENTION` in `generate.ts` — not a share.
 *
 * These tests exist to stop the obvious wrong fix. Deleting the comitative row
 * would score 234 gold forms and read every хүнтэй in the language as an
 * adjective; that is the mistake `verb-suffixes.ts` records for `-лаа`, where a
 * lemma dictionary's headwords were mistaken for running-text frequency. **Both
 * readings must exist**, whichever one is currently winning.
 */
describe('-тай³ has two readings and keeps both', () => {
  const readings = (word: string) =>
    (analyze(word)[0]?.candidates ?? []).filter((c) => c.segmentation.suffixes.length > 0);

  /**
   * Is the word's final ТА + vowel + И written **after a connector**?
   *
   * Asked about the letter immediately before those three, not about the whole
   * word, because a **chachlag** stem legitimately carries an MVS of its own
   * mid-word: санаа is `sanaγ-a`, so its залгаж reading is `sanaγ-atai` and
   * contains an MVS that has nothing to do with the suffix. A plain
   * `includes(MVS)` would call that detached and be wrong.
   */
  const detachedSuffix = (script: string | undefined): boolean =>
    script !== undefined && /[\u180E\u202F ]...$/.test(script);

  it('offers the залгаж and the дагуулж reading of the same word', () => {
    const joins = new Set(readings('хүчтэй').map((c) => detachedSuffix(c.script)));
    expect(joins).toEqual(new Set([true, false]));
  });

  /**
   * ⚠ Reader ruling, 2026-08-10 (T1/T2). This test asserted the opposite for
   * a few hours: that the залгаж reading **wins** on the rulebook's own three
   * examples, because running text writes them attached 118 times to 0 and
   * §2.3.6 calls the adjectival -тай³ a дагавар.
   *
   * Asked directly, the reader declined to make it a rule: *"both correct, and
   * it's simply a choice. we chose to detach, but we can also attach. when
   * attaching, гэдэс жийрэглэх rule apply btw"*. So the 72/28 split is house
   * style, not correctness, and the standing choice here is дагуулж. The
   * залгаж reading must still be **offered** — the test above this one asserts
   * that, and the reader confirms it is correct Mongolian — it simply must not
   * be the answer while `гэдэс жийрэглэх` is unimplemented and our attached
   * output on a chachlag stem is malformed.
   */
  it('prefers the дагуулж reading, per the reader, while still offering both', () => {
    // The rulebook's own three examples for the adjectival reading.
    for (const word of ['хэрэгтэй', 'ёстой', 'санаатай']) {
      const best = readings(word)[0];
      expect(detachedSuffix(best?.script), word).toBe(true);
    }
  });

  /**
   * The залгаж reading survives as a candidate — asserted over **all**
   * candidates and by **script**, not by walking `segmentation`.
   *
   * ⚠ That distinction is the whole test and it is CLAUDE.md's first footgun
   * wearing a different hat. хэрэгтэй's залгаж reading assembles as `qereγtei`
   * and its rule-based guess as `keregtei`; q/k and γ/g are harmony-selected
   * allographs of one letter, so those two romanizations are **byte-identical
   * code points** and the candidate list holds one entry, not two. Filtering
   * for `suffixes.length > 0` therefore loses the reading for хэрэгтэй while
   * finding it for ёстой — the reading is there either way, and only the
   * romanization differs. Compare what is emitted.
   */
  it('still builds the залгаж reading, even where it dedupes with a guess', () => {
    for (const word of ['хэрэгтэй', 'ёстой', 'санаатай', 'хүчтэй']) {
      const scripts = (analyze(word)[0]?.candidates ?? []).map((c) => c.script);
      expect(
        scripts.some((s) => !detachedSuffix(s)),
        word,
      ).toBe(true);
    }
  });

  it('still offers the comitative reading, connector and all', () => {
    for (const word of ['хүнтэй', 'хаантай', 'морьтой']) {
      const comitative = readings(word).find((c) =>
        c.segmentation.suffixes.some((s) => s.category === 'comitative'),
      );
      expect(comitative, word).toBeDefined();
      expect(detachedSuffix(comitative?.script), word).toBe(true);
    }
  });

  it('leaves a plural + comitative chain to the comitative alone', () => {
    // A дагавар is word-forming, so it sits inside every inflection — SLOT 0 in
    // `segment.ts`. That is not a special case for -тай³: it is what makes
    // аавуудтай `abu-nuγud-tai` unreachable as an adjective, and all 234
    // attached gold rows are bare stem + тай with nothing else in the chain.
    const chains = readings('аавуудтай').map((c) => c.segmentation.suffixes.map((s) => s.category));
    expect(chains.some((c) => c.includes('plural') && c.includes('derivational'))).toBe(false);
  });

  it('never emits NNBSP for either reading', () => {
    for (const c of readings('хүчтэй')) expect(c.script).not.toContain('\u202F');
  });
});

describe('validate hook', () => {
  it('drops candidates the validator rejects', () => {
    // Reject the "black" reading; the verb-stem reading must survive.
    const [word] = analyze('хар', { validate: (s) => s !== toScript('qar-a') });
    expect(word?.candidates).toHaveLength(1);
    expect(word?.candidates[0]?.classical).toBe('qara');
  });

  it('keeps the unfiltered set when nothing passes, rather than dropping the word', () => {
    const [word] = analyze('хар', { validate: () => false });
    expect(word?.candidates.length).toBeGreaterThan(0);
  });
});

describe('custom ranker', () => {
  it('replaces the frequency prior without touching any other stage', () => {
    const [word] = analyze('хар', {
      ranker: { name: 'prefer-verb', score: (c) => (c.classical === 'qara' ? 10 : 1) },
    });
    expect(word?.candidates[0]?.classical).toBe('qara');
  });
});

describe('the plural of an agent noun', () => {
  // -чид on a `či` stem is the plural `d` fused on, not the dative: сурагчид is
  // `suruγčid`. Measured 2026-10-02 — 248 of 258 such words in running text.
  const top = (word: string) => analyze(word)[0]?.candidates[0]?.classical;

  it('reads -чид as the plural', () => {
    expect(top('сурагчид')).toBe('suruγčid');
    expect(top('судлаачид')).toBe('suduluγačid');
  });

  it('carries the plural into the oblique forms, where the и is dropped', () => {
    expect(top('сурагчдын')).toBe('suruγčid-un');
    expect(top('сурагчдад')).toBe('suruγčid-tu');
    expect(top('төлөөлөгчдийн')).toBe('tölüγeleγčid-ün');
  });

  it('still offers the dative, which the same letters also spell', () => {
    const readings = analyze('сурагчид')[0]?.candidates.map((c) => c.classical);
    expect(readings).toContain('suruγči-du');
  });

  it('leaves a short ч-final noun its dative', () => {
    // мөчид is "at the moment", `möče-dü` (the stem is `möče` — reader,
    // 2026-10-02). Three letters is not an agent noun.
    expect(top('мөчид')).toBe('möče-dü');
    expect(top('эмчид')).toBe('emči-dü');
  });

  it('does not touch a ч-final noun that takes no plural', () => {
    expect(top('сурагчийн')).toBe('suruγči-yin');
  });
});

describe('an unknown word that is two known words written together', () => {
  it('joins the two rows, and still calls it a guess', () => {
    // ган `γang` + болд `bolud`; the tail's o is no longer in the first
    // syllable, so it folds to u. Letter by letter this came out as an unknown
    // ганбол with a dative on it.
    const [token] = analyze('ганболд');
    expect(token?.candidates[0]?.classical).toBe('γangbulud');
    expect(token?.candidates[0]?.provenance).toBe('guess');
  });

  it('takes a case suffix like any other stem', () => {
    expect(analyze('ганболдын')[0]?.candidates[0]?.classical).toBe('γangbulud-un');
  });

  it('does not split a short word, or one with a three-letter tail', () => {
    // хал + дун and бичиг + дэх are how the rule goes wrong: at seven letters
    // and a four-letter tail it loses one word in the silver set, below that six.
    for (const word of ['халдун', 'бичигдэх']) {
      const top = analyze(word)[0]?.candidates[0];
      expect(top?.classical, word).not.toMatch(/^qala|^bičigdeqi/);
    }
  });
});

describe('-тай³ with a linking г and a case after it', () => {
  it('builds the instrumental, the reflexive and the accusative', () => {
    // Detached, as -тай³ is by house style — and well-formed after a plural,
    // which the attached spelling is not.
    expect(convert('амжилттайгаар')).toBe(toScript('amǰilta-tai-bar'));
    expect(convert('морьтойгоо')).toBe(toScript('mori-tai-ban'));
    expect(convert('хүүхдүүдтэйгээр')).toBe(toScript('qeüqed-üd-tei-ber'));
  });
});

describe('a suffix that attaches, on a stem that ends in a chachlag', () => {
  it('loses the connector: the vowel is no longer word-final', () => {
    // гавьяа is `γabiy-a`. Fused onto it, the adjective -т used to strand the
    // MVS mid-word (`γabiy-atu`), which is not a spelling of anything.
    expect(convert('гавьяат')).toBe(toScript('γabiyatu'));
    expect(convert('тоосголог')).toBe(toScript('toγusγalig'));
  });

  it('never attaches to a word that already ends in a detached suffix', () => {
    // өөрийн is the row `öber-ün`; a дагавар fused onto that genitive is not a
    // word, and no candidate may say it is.
    for (const candidate of analyze('өөрийнт')[0]?.candidates ?? []) {
      expect(candidate.classical).not.toMatch(/-[^-]{2,}(tü|tu|lig)$/);
    }
  });
});
