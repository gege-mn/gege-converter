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
  // Sits on a genitive and under a case, so it shares their slot; what keeps
  // it in place is `fitsOrder`, not the number.
  possession: 2,
  // Word-forming, so it sits inside every inflection: загварлаг takes a case
  // suffix after the -лиг, never before it.
  derivational: 0,
};

/** The slot every plain case suffix shares. */
const CASE_SLOT = SLOT.genitive;

/**
 * The two double cases Khalkha does form, written inner>outer: the genitive
 * taking a dative (аавынд `abu-yin-du`, "at father's") and the dative taking an
 * ablative (гэртээс `γer-tü-eče`, "from at home"). Thirteen gold forms are
 * these two shapes and nothing else, which is how the list was found — the
 * blanket refusal cost exactly those thirteen.
 */
const DOUBLE_CASE: ReadonlySet<string> = new Set([
  'genitive>dative-locative',
  'dative-locative>ablative',
]);

/**
 * May `suffix` sit immediately inside the chain peeled so far?
 *
 * Suffixes are peeled outermost-first, so slots must not increase as we move
 * inward. Equal slots are allowed in general — two particles, say — with one
 * exception: **a case suffix may not sit directly inside another case suffix**,
 * apart from the two pairings in `DOUBLE_CASE`.
 *
 * That exception was left open when the ordering rule landed ("stacked case
 * suffixes are rare but this is not the place to rule on them") and it is
 * measured now. Over the 18,743 commonest words of a 133M-token corpus, a
 * case-inside-case reading won 230 times and matched the silver
 * 9 times — and those 9 are not double cases either: тэмдэгтийн, хүснэгтийг and
 * the rest carry the adjective-forming -т, which happens to share its letters
 * with the dative. Not one genuine case + case form in that sample.
 *
 * What the reading was really doing is swallowing the plural: сурагчдын came
 * out сурагч + dative + genitive `suruγči-du-yin`, компаниудын as
 * `khompani-du-yin`, because the plural -д/-ууд and the dative look alike once
 * the epenthetic vowel is peeled. Refusing the stack lets the plural reading
 * win where it exists (50 of the 221 misses became right outright) and
 * otherwise falls to a shorter chain. The fused case + reflexive rows have
 * their own slot and are untouched.
 */
const fitsOrder = (suffix: SuffixEntry, chain: readonly SuffixEntry[]): boolean => {
  const outer = chain[chain.length - 1];
  // Possession is bound to a case: the only thing directly inside `qi`/`qin`
  // is a genitive. That is the whole of what stops a bare -х — the ending of
  // every infinitive — from being read as one.
  if (outer?.category === 'possession') return suffix.category === 'genitive';
  if (outer === undefined) return true;
  // …and outside itself it takes what a noun takes: a case, the reflexive.
  if (suffix.category === 'possession') return SLOT[outer.category] >= CASE_SLOT;
  if (SLOT[suffix.category] === CASE_SLOT && SLOT[outer.category] === CASE_SLOT) {
    return DOUBLE_CASE.has(`${suffix.category}>${outer.category}`);
  }
  return SLOT[suffix.category] <= SLOT[outer.category];
};

/** Vowels and the soft finals л м н — what a Cyrillic dative -д, not -т, follows. */
const SOFT_CYRILLIC = 'аэиоуөүыяеёюйлмн';

/** Does the Cyrillic stem left by the peel end the way this row requires? */
const fitsCyrillic = (suffix: SuffixEntry, peeled: string): boolean => {
  if (suffix.afterCyrillic === undefined) return true;
  // A soft sign is not the stem's last sound: лагерьт is р + т.
  const stem = peeled.endsWith('ь') ? peeled.slice(0, -1) : peeled;
  const last = stem[stem.length - 1];
  if (last === undefined) return false;
  const soft = SOFT_CYRILLIC.includes(last);
  return suffix.afterCyrillic === 'soft' ? soft : !soft;
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
    // A chain may not END, stem-side, on possession: it has to have found its
    // genitive. The walk goes on below to look for one.
    if (chain[chain.length - 1]?.category !== 'possession') {
      out.push({ stem: rest, suffixes: [...chain].reverse() });
    }
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
      if (!fitsCyrillic(suffix, peeled)) continue;
      for (const stem of stemForms(peeled, suffix)) {
        if (stem.length < MIN_STEM_LENGTH) continue;
        walk(stem, [...chain, suffix]);
      }
    }
  };

  walk(word, []);
  return out;
}
