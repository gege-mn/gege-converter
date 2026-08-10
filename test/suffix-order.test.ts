/**
 * The Khalkha suffix chain is ordered: **stem + plural + case + reflexive**.
 *
 * `references/suffixes.md` on the reflexive-possessive: *"Stacks after case
 * suffixes"*, and every registry-confirmed fusion runs case-then-reflexive
 * (ᠳᠠᠭᠠᠨ = dative + reflexive, ᠠᠴᠠᠭᠠᠨ = ablative + reflexive). The reverse
 * order does not occur in the language, so the segmenter must not offer it.
 *
 * What this actually buys: a word ending `-аад` was being read as reflexive
 * `аа` + dative `д`, an impossible chain. It is the perfective converb — verb
 * morphology, which this package does not have — and 66% of `-аад` tokens in
 * running text were converted that way at up to 70% confidence. Confidently
 * wrong is the worst failure mode for a human-in-the-loop editor, so the parse
 * is refused and the word falls to an honestly-labelled guess instead.
 */

import { describe, expect, it } from 'vitest';
import { segment } from '../src/index.js';
import type { Segmentation } from '../src/types.js';

const categories = (s: Segmentation) => s.suffixes.map((x) => x.category);
const chains = (word: string) => segment(word).map(categories);

describe('reflexive is chain-final', () => {
  it('never offers a reflexive followed by a case suffix', () => {
    for (const word of ['алдаад', 'тэгээд', 'өгөөд', 'дуусаад', 'санагдаад']) {
      for (const chain of chains(word)) {
        const at = chain.indexOf('reflexive');
        expect(at === -1 || at === chain.length - 1, `${word}: ${chain.join('+')}`).toBe(true);
      }
    }
  });

  it('still allows case followed by reflexive — the grammatical order', () => {
    // Both are confirmed by a bichig reader in rulings.test.ts.
    expect(chains('хойноосоо')).toContainEqual(['ablative', 'reflexive']);
    expect(chains('гаднаасаа')).toContainEqual(['ablative', 'reflexive']);
  });

  it('leaves a bare reflexive alone', () => {
    // -лаа looks like a past tense but these are genuinely stem + reflexive:
    // сэтгэл + ээ, хэл + ээ. The rule must not touch them.
    expect(chains('сэтгэлээ')).toContainEqual(['reflexive']);
    expect(chains('хэлээ')).toContainEqual(['reflexive']);
  });

  it('keeps plural inside case', () => {
    for (const chain of chains('гэрүүдээс')) {
      const p = chain.indexOf('plural');
      const c = chain.indexOf('ablative');
      if (p !== -1 && c !== -1) expect(p).toBeLessThan(c);
    }
  });

  it('does not offer case inside plural', () => {
    for (const word of ['гэрүүдээс', 'номуудад', 'хотуудаас']) {
      for (const chain of chains(word)) {
        const p = chain.indexOf('plural');
        if (p === -1) continue;
        // Everything outside the plural must be case or reflexive, never
        // another plural, and nothing may sit inside it.
        expect(chain.slice(0, p), `${word}: ${chain.join('+')}`).not.toContain('plural');
      }
    }
  });
});
