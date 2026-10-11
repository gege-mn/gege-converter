import { describe, expect, it } from 'vitest';
import { analyze, assemble, buildCandidates, convert } from '../src/index.js';
import { styleOrdinal } from '../src/ordinal.js';
import { rankCandidates } from '../src/rank.js';
import { toScript } from '../src/romanize.js';
import { segment } from '../src/segment.js';

/**
 * Reader ruling, 2026-10-11. The comitative -тай³ and the ordinals -дугаар²,
 * -дахь² may be written joined to the stem with the suffix connector or
 * attached as one word. It is a stylistic choice, **but legal and formal
 * documents must attach** — so attached is the default and
 * `stylisticSuffixes: 'joined'` selects the other spelling.
 *
 * Every expectation is a romanization run through `toScript`, so the
 * comparison is in script and no connector is ever typed.
 */
const attached = (word: string): string => convert(word);
const joined = (word: string): string => convert(word, { stylisticSuffixes: 'joined' });

const MVS = '\u180E';
const connectors = (script: string): number => script.split(MVS).length - 1;

describe('stylisticSuffixes — the comitative -тай³', () => {
  it.each([
    ['гэртэй', 'gertei', 'ger-tei'],
    ['морьтой', 'moritai', 'mori-tai'],
    ['хүнтэй', 'kümüntei', 'kümün-tei'],
    ['найзтай', 'naiǰatai', 'naiǰa-tai'],
  ])('%s is %s attached and %s joined', (word, one, two) => {
    expect(attached(word)).toBe(toScript(one));
    expect(joined(word)).toBe(toScript(two));
  });

  it('attaches by default, and an explicit attached is the same thing', () => {
    expect(convert('гэртэй', { stylisticSuffixes: 'attached' })).toBe(attached('гэртэй'));
    expect(attached('гэртэй')).not.toContain(MVS);
  });

  it('writes the same letters either way — only connectors differ', () => {
    for (const word of ['гэртэй', 'ахтай', 'санаатай', 'ахтайгаа', 'аавуудтай']) {
      expect(attached(word).replaceAll(MVS, ''), word).toBe(joined(word).replaceAll(MVS, ''));
    }
  });

  it('never emits NNBSP under either style', () => {
    for (const word of ['гэртэй', 'ахтай', 'ахтайгаа']) {
      expect(attached(word)).not.toContain('\u202F');
      expect(joined(word)).not.toContain('\u202F');
    }
  });
});

/**
 * The trap. A separated final vowel is final only while nothing is written
 * after it: attach a suffix and it is an ordinary medial vowel, so the stem's
 * own connector has to go with it. Leaving it strands an MVS mid-word
 * (`aq-atai`), which gege-linter reports as `unknown-suffix`.
 */
describe('stylisticSuffixes — a stem ending in a separated vowel', () => {
  it.each([
    ['ахтай', 'aqatai', 'aq-a-tai'],
    ['хартай', 'qaratai', 'qar-a-tai'],
    ['санаатай', 'sanaγatai', 'sanaγ-a-tai'],
    ['үнэтэй', 'ünetei', 'ün-e-tei'],
  ])('%s is %s attached and %s joined', (word, one, two) => {
    expect(attached(word)).toBe(toScript(one));
    expect(joined(word)).toBe(toScript(two));
  });

  it('attached, carries no connector at all', () => {
    for (const word of ['ахтай', 'хартай', 'санаатай', 'үнэтэй']) {
      expect(connectors(attached(word)), word).toBe(0);
    }
  });

  it('joined, keeps the stem connector and adds the suffix one', () => {
    for (const word of ['ахтай', 'хартай', 'санаатай', 'үнэтэй']) {
      expect(connectors(joined(word)), word).toBe(2);
    }
  });

  it('never offers the stranded-connector shape as a candidate, under either style', () => {
    const stranded = toScript('aq-atai');
    for (const stylisticSuffixes of ['attached', 'joined'] as const) {
      const scripts = buildCandidates('ахтай', { stylisticSuffixes }).map((c) => c.script);
      expect(scripts).not.toContain(stranded);
    }
  });

  it('leaves the stem connector alone under a suffix that is not stylistic', () => {
    // харууд is `qar-a` + `nuγud`, two MVS, and that has not changed.
    expect(attached('харууд')).toBe(toScript('qar-a-nuγud'));
    expect(joined('харууд')).toBe(toScript('qar-a-nuγud'));
  });
});

describe('stylisticSuffixes — stacks', () => {
  it('moves only the join before -тай³; the reflexive after it keeps its connector', () => {
    expect(attached('ахтайгаа')).toBe(toScript('aqatai-ban'));
    expect(joined('ахтайгаа')).toBe(toScript('aq-a-tai-ban'));
    expect(attached('гэртэйгээ')).toBe(toScript('gertei-ben'));
    expect(joined('гэртэйгээ')).toBe(toScript('ger-tei-ben'));
  });

  it('keeps -тай³ joined after a connector-joined plural, under both styles', () => {
    // There is no word to attach to there, only another suffix: `nuγudtai` is
    // not a suffix the linter knows, and none of the 55 plural + -тай³ gold
    // rows attach.
    expect(attached('аавуудтай')).toBe(toScript('abu-nuγud-tai'));
    expect(joined('аавуудтай')).toBe(toScript('abu-nuγud-tai'));
  });

  it('does not let a lexicalised whole word be re-split by the joined style', () => {
    // жаргалтай is a harvested headword and stays one under both styles.
    expect(attached('жаргалтай')).toBe(toScript('ǰirγaltai'));
    expect(joined('жаргалтай')).toBe(toScript('ǰirγaltai'));
  });
});

describe('stylisticSuffixes — assemble', () => {
  const chain = (word: string, stem: string) => {
    const found = segment(word).find(
      (s) => s.stem === stem && s.suffixes[0]?.category === 'comitative',
    );
    if (found === undefined) throw new Error(`no comitative chain for ${word}`);
    return found;
  };

  it('defaults to attached, and fuses the chachlag only when attaching', () => {
    const ah = chain('ахтай', 'ах');
    expect(assemble('aq-a', ah)).toBe('aqatai');
    expect(assemble('aq-a', ah, 'attached')).toBe('aqatai');
    expect(assemble('aq-a', ah, 'joined')).toBe('aq-a-tai');
  });

  it('treats a stem that already ends in a joined suffix as nothing to attach to', () => {
    expect(assemble('abu-nuγud', chain('ахтай', 'ах'))).toBe('abu-nuγud-tai');
  });
});

/**
 * Ordinals have no suffix rows: they arrive as whole words, and the join is
 * set on the stem's Classical form when the host is a numeral (`ordinal.ts`).
 */
describe('stylisticSuffixes — the ordinals -дугаар² and -дахь²', () => {
  it.each([
    ['гуравдугаар', 'γurbaduγar', 'γurba-duγar'],
    ['хоёрдугаар', 'qoyaduγar', 'qoya-duγar'],
    ['нэгдүгээр', 'nigedüger', 'nige-düger'],
    ['аравдахь', 'arbadaqi', 'arba-daqi'],
  ])('%s is %s attached and %s joined', (word, one, two) => {
    expect(attached(word)).toBe(toScript(one));
    expect(joined(word)).toBe(toScript(two));
  });

  it('gives a numeral with a separated vowel its connector back when joining', () => {
    // долоо is `doluγ-a`; the memorised ordinal has it fused.
    expect(attached('долоодугаар')).toBe(toScript('doluγaduγar'));
    expect(joined('долоодугаар')).toBe(toScript('doluγ-a-duγar'));
  });

  it('moves only the ordinal join when a case suffix is stacked after it', () => {
    expect(attached('гуравдугаарт')).toBe(toScript('γurbaduγar-tu'));
    expect(joined('гуравдугаарт')).toBe(toScript('γurba-duγar-tu'));
  });

  it('offers the other spelling as a lower-ranked candidate', () => {
    const scripts = (analyze('гуравдугаар')[0]?.candidates ?? []).map((c) => c.script);
    expect(scripts[0]).toBe(toScript('γurbaduγar'));
    expect(scripts).toContain(toScript('γurba-duγar'));
  });

  it('is gated to numeral hosts — -дэх is also a verb ending and a locative + ki', () => {
    // нэгдэх "to unite", дэргэдэх "the one beside": neither is numeral + -дэх.
    for (const word of ['нэгдэх', 'дэргэдэх', 'мэдэх', 'эндэх']) {
      expect(joined(word), word).toBe(attached(word));
    }
    expect(styleOrdinal('дэргэдэх', 'dergedeqi', 'joined')).toBe('dergedeqi');
  });

  it('matches the ending in script, so the harvest spelling with γ still joins', () => {
    expect(styleOrdinal('нэгдүгээр', 'niγedüγer', 'joined')).toBe('niγe-düγer');
    expect(styleOrdinal('нэгдүгээр', 'niγe-düγer', 'attached')).toBe('niγedüγer');
  });
});

describe('stylisticSuffixes — digits are not touched', () => {
  it.each(['3-дугаар', '3 дугаар', '5-дахь', '2 дахь', '10-тай'])(
    '%s converts identically under both styles',
    (text) => {
      expect(joined(text)).toBe(attached(text));
    },
  );

  it('still passes the numeral and the hyphen through as written', () => {
    expect(attached('3-дугаар').startsWith('3-')).toBe(true);
    expect(attached('5-дахь')).toBe(`5-${toScript('daqi')}`);
  });
});

describe('same-script readings collapse after scoring, not before', () => {
  it('keeps the dictionary reading of ханатай rather than the guess that spells the same', () => {
    // хана + тай and a letter-by-letter guess both come out `qanatai`. The
    // guess has the larger prior and the lower score.
    const best = analyze('ханатай')[0]?.candidates[0];
    expect(best?.script).toBe(toScript('qanatai'));
    expect(best?.provenance).toBe('harvested');
  });

  it('never returns two candidates with one script', () => {
    for (const word of ['ханатай', 'хэрэгтэй', 'ахтай', 'гуравдугаар']) {
      const scripts = (analyze(word, { maxCandidates: 50 })[0]?.candidates ?? []).map(
        (c) => c.script,
      );
      expect(new Set(scripts).size, word).toBe(scripts.length);
    }
  });

  it('keeps the higher-scored of two same-script candidates', () => {
    const [weak, strong] = buildCandidates('хот')
      .slice(0, 1)
      .flatMap((c) => [
        { ...c, prior: 0.1 },
        { ...c, prior: 0.9 },
      ]);
    if (weak === undefined || strong === undefined) throw new Error('no candidate for хот');
    const ranked = rankCandidates(
      [weak, strong],
      { name: 'prior', score: (c) => c.prior },
      { tokens: [], index: 0 },
      5,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.prior).toBe(0.9);
  });
});
