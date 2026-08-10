import { describe, expect, it } from 'vitest';
import { bucketOf, encodingProblems, parsePairs } from '../scripts/lib/corpus.mjs';

/**
 * The parallel-corpus loader (`scripts/lib/corpus.mjs`).
 *
 * Tested because it is the gate on a **gold** set. Everything downstream treats
 * what comes out of here as ground truth, so a parse bug does not produce a
 * visible error — it produces a fixture that quietly measures the wrong thing,
 * which is the failure mode this project has been bitten by twice (the
 * romanization drift, and the training export that skipped normalisation).
 *
 * Written in `.mjs` rather than `.ts` so it imports the script under test
 * directly, the way the script itself is run.
 */

/** Bichig fixtures, built rather than typed, so no invisible character is ever a literal. */
const MVS = '\u180E';
const NNBSP = '\u202F';
const USUN = 'ᠤᠰᠤᠨ';
const U = 'ᠤ';

describe('parsePairs', () => {
  it('pairs a Cyrillic line with a bichig line', () => {
    const { pairs, problems } = parsePairs(`усны\n${USUN}${MVS}${U}\n`, 'b.txt');
    expect(problems).toEqual([]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].cyrillic).toBe('усны');
    expect(pairs[0].script).toBe(`${USUN}${MVS}${U}`);
  });

  // Which line is which is decided by the script it is written in, not by its
  // position. A batch is produced by pasting two lines at a time out of an
  // editor, so transposing a pair is *the* obvious mistake — and reading it
  // positionally would silently invert every expectation built from it.
  it('does not care which order the two lines come in', () => {
    const { pairs, problems } = parsePairs(`${USUN}${MVS}${U}\nусны\n`, 'b.txt');
    expect(problems).toEqual([]);
    expect(pairs[0].cyrillic).toBe('усны');
    expect(pairs[0].script).toBe(`${USUN}${MVS}${U}`);
  });

  it('splits blocks on blank lines and ignores comments', () => {
    const text = `# a batch\nусны\n${USUN}${MVS}${U}\n\n# another\nусны\n${USUN}${MVS}${U}\n`;
    expect(parsePairs(text, 'b.txt').pairs).toHaveLength(2);
  });

  // Reported with a line number rather than skipped. A loader that silently
  // drops malformed blocks is how a corpus stops covering what you think it does.
  it('reports a block that is not one line of each', () => {
    const { pairs, problems } = parsePairs('нэг мөр\nхоёр мөр\n', 'b.txt');
    expect(pairs).toEqual([]);
    expect(problems[0]).toContain('b.txt:1');
    expect(problems[0]).toContain('got 2 and 0');
  });

  it('keeps the file and line for every pair', () => {
    const { pairs } = parsePairs(`\n\nусны\n${USUN}${MVS}${U}\n`, 'batch/2026-08.txt');
    expect(pairs[0].where).toBe('batch/2026-08.txt:3');
  });
});

describe('encodingProblems', () => {
  // MVS is the whole point of this package existing; NNBSP is what the
  // incumbents emit. Text carrying one did not come from the editor it was
  // supposed to, so it is not evidence and must not be scored against us.
  it('rejects the legacy NNBSP connector', () => {
    const found = encodingProblems({ script: `${USUN}${NNBSP}${U}`, where: 'b.txt:1' });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('NNBSP');
  });

  it('rejects Menksoft PUA', () => {
    const found = encodingProblems({ script: '\uE234\uE100', where: 'b.txt:1' });
    expect(found[0]).toContain('PUA');
  });

  it('accepts correct MVS-connected text', () => {
    expect(encodingProblems({ script: `${USUN}${MVS}${U}`, where: 'b.txt:1' })).toEqual([]);
  });

  // An orthography disagreement is a finding about the CONVERTER, not a defect
  // in the corpus — the author is the authority on spelling. Only characters no
  // correct text can contain are errors here.
  it('says nothing about spelling', () => {
    expect(encodingProblems({ script: 'ᠵᠢᠷᠦᠬᠡ', where: 'b.txt:1' })).toEqual([]);
  });
});

describe('bucketOf', () => {
  // Stable across runs and across file order, so the holdout half stays held
  // out once rows start being mined from the other half.
  it('is deterministic and in range', () => {
    for (const s of ['усны', 'зүрхний', 'бид хоёр явлаа']) {
      expect(bucketOf(s)).toBe(bucketOf(s));
      expect(bucketOf(s)).toBeGreaterThanOrEqual(0);
      expect(bucketOf(s)).toBeLessThan(100);
    }
  });

  it('separates different sentences', () => {
    expect(bucketOf('усны')).not.toBe(bucketOf('зүрхний'));
  });
});
