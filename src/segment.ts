import { harmonyAgrees, harmonyOf, isCyrillicVowel } from './chars.js';
import { carriesStemN, suffixesEndingIn } from './data/suffixes.js';
import type { Segmentation, SuffixCategory, SuffixEntry } from './types.js';
import { verbEnding } from './verb.js';

/** Shortest stem we will peel down to; below this, matches are noise. */
const MIN_STEM_LENGTH = 2;

/** Longest suffix chain considered. Khalkha stacks about three in practice. */
const DEFAULT_MAX_DEPTH = 3;

/**
 * Where each category sits in the Khalkha suffix chain, counting outward from
 * the stem: **stem + plural + case + reflexive**.
 *
 * The order is not a preference, it is grammar — `references/suffixes.md` on
 * the reflexive: *"Stacks after case suffixes"*, and every registry-confirmed
 * fusion is case-then-reflexive (ᠳᠠᠭᠠᠨ = dative + reflexive, ᠠᠴᠠᠭᠠᠨ = ablative
 * + reflexive). The reverse never occurs.
 *
 * Without this, a word ending `-аад` was read as reflexive `аа` + dative `д`,
 * which is a chain Khalkha cannot form: it is the perfective converb, i.e.
 * verb morphology, which this package does not handle. 66% of `-аад` tokens in
 * running text were being converted that way and asserted at up to 70%
 * confidence. Refusing the impossible parse does not teach the converter verbs
 * — it stops it inventing a confident noun reading of one.
 */
const SLOT: Record<SuffixCategory, number> = {
  plural: 1,
  genitive: 2,
  accusative: 2,
  'dative-locative': 2,
  ablative: 2,
  instrumental: 2,
  comitative: 2,
  reflexive: 3,
  // A case fused with the reflexive is chain-final, exactly as the reflexive
  // is — nothing may follow it.
  'case-possessive': 3,
  particle: 4,
  // Word-forming, so it sits inside every inflection: загварлаг takes a case
  // suffix after the -лиг, never before it.
  derivational: 0,
};

/**
 * May `suffix` sit immediately inside the chain peeled so far?
 *
 * Suffixes are peeled outermost-first, so slots must not increase as we move
 * inward. Equal slots are allowed: stacked case suffixes are rare but this is
 * not the place to rule on them, and forbidding them would be a second change
 * hiding inside this one.
 */
const fitsOrder = (suffix: SuffixEntry, chain: readonly SuffixEntry[]): boolean => {
  const outer = chain[chain.length - 1];
  return outer === undefined || SLOT[suffix.category] <= SLOT[outer.category];
};

/**
 * Stems worth trying once `suffix` has been peeled off.
 *
 * Khalkha inserts a linking vowel between a consonant-final stem and a
 * consonant-initial suffix — хот + д surfaces as хотод, not хотд. Peeling
 * only the suffix leaves хото, which is not a word, so for consonant-initial
 * suffixes we also offer the stem with that epenthetic vowel removed and let
 * ranking pick. Both are returned because the vowel is not always epenthetic
 * (мод + д → модод, but note + д would be genuine).
 */
const stemForms = (peeled: string, suffix: SuffixEntry): string[] => {
  const forms = [peeled];
  const suffixHead = suffix.cyrillic[0];
  const stemTail = peeled[peeled.length - 1];
  // …but only when the consonant that triggered it is the SUFFIX's. On the
  // тогтворгүй-н genitives (-ны/-ний read as stem-н plus -ы/-ий) the leading н
  // is the stem's own letter, so there is no consonant cluster to break up and
  // nothing was elided: a stem that already ends in н takes -ы directly, as
  // ханы does. Dropping a vowel here invents one instead of restoring one —
  // бананы peeled to бана and then offered бан, which is a different word.
  if (carriesStemN(suffix)) return forms;
  if (
    suffixHead !== undefined &&
    stemTail !== undefined &&
    !isCyrillicVowel(suffixHead) &&
    isCyrillicVowel(stemTail)
  ) {
    forms.push(peeled.slice(0, -1));
  }
  return forms;
};

/**
 * Every way `word` can be read as stem + suffix chain, including the trivial
 * reading where the whole word is the stem (always first).
 *
 * Ambiguity is preserved rather than resolved — `rank.ts` decides. So `хотод`
 * yields both `хотод` (unknown stem) and `хот` + dative, and the lexicon hit
 * on `хот` is what makes the second win.
 *
 * Harmony is taken from the whole word, since suffix vowels harmonise with
 * the stem anyway. String slicing is UTF-16 here, which is safe because every
 * Mongolian Cyrillic letter is in the BMP.
 */
export function segment(word: string, maxDepth: number = DEFAULT_MAX_DEPTH): Segmentation[] {
  const harmony = harmonyOf(word);
  const out: Segmentation[] = [];

  // A case suffix may not be carved out of the habitual participle. ажилладаг
  // is -даг; peeling its final г as an accusative yields aǰilla-du-yi, which is
  // not a reading of anything. Only the outermost peel can collide, since the
  // ending sits at the end of the word.
  //
  // ONLY the habitual. The obvious generalisation — guard every verb ending —
  // was measured and is worse: it costs as much as it saves, because `-лаа/-лээ`
  // is usually not a past tense at all but an ordinary noun plus the reflexive
  // (сэтгэл + ээ, ажил + аа), and blocking that reading breaks words the rest
  // of the suite asserts. The habitual is the one shape whose final letter is a
  // case suffix that can never be one here.
  const detected = verbEnding(word);
  const ending = detected?.kind === 'participle-habitual' ? detected.ending : undefined;

  const walk = (rest: string, chain: readonly SuffixEntry[]): void => {
    out.push({ stem: rest, suffixes: [...chain].reverse() });
    if (chain.length >= maxDepth) return;
    for (const suffix of suffixesEndingIn(rest)) {
      if (!harmonyAgrees(harmony, suffix.harmony)) continue;
      if (!fitsOrder(suffix, chain)) continue;
      if (
        chain.length === 0 &&
        ending !== undefined &&
        suffix.cyrillic.length <= ending.length &&
        ending.endsWith(suffix.cyrillic)
      ) {
        continue;
      }
      const peeled = rest.slice(0, rest.length - suffix.cyrillic.length);
      for (const stem of stemForms(peeled, suffix)) {
        if (stem.length < MIN_STEM_LENGTH) continue;
        walk(stem, [...chain, suffix]);
      }
    }
  };

  walk(word, []);
  return out;
}
