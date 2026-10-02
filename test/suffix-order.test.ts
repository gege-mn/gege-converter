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

describe('a case suffix does not sit inside another case suffix', () => {
  const CASES = new Set([
    'genitive',
    'accusative',
    'dative-locative',
    'ablative',
    'instrumental',
    'comitative',
  ]);
  /** Every adjacent inner>outer pair of plain case suffixes in a chain. */
  const stacked = (chain: readonly string[]): string[] =>
    chain.flatMap((category, i) => {
      const outer = chain[i + 1];
      return outer !== undefined && CASES.has(category) && CASES.has(outer)
        ? [`${category}>${outer}`]
        : [];
    });

  it('refuses the stack that was swallowing the plural', () => {
    // сурагчдын was сурагч + dative + genitive, компаниудыг компани + dative +
    // accusative: 230 such readings won over the 18,743 commonest words of
    // running text and not one was a genuine double case.
    for (const word of ['сурагчдын', 'компаниудыг', 'гишүүдийн', 'хэдийгээр']) {
      for (const chain of chains(word)) {
        for (const pair of stacked(chain)) {
          expect(
            ['genitive>dative-locative', 'dative-locative>ablative'],
            `${word}: ${pair}`,
          ).toContain(pair);
        }
      }
    }
  });

  it('lets the plural reading through instead', () => {
    expect(chains('компаниудыг')).toContainEqual(['plural', 'accusative']);
  });

  it('keeps the two double cases Khalkha does form', () => {
    // аавынд "at father's" and гэртээс "from at home" — both in the gold set,
    // and both lost when the refusal was first written without exceptions.
    expect(chains('аавынд')).toContainEqual(['genitive', 'dative-locative']);
    expect(chains('гэртээс')).toContainEqual(['dative-locative', 'ablative']);
  });
});
