/**
 * Which allomorph of a suffix a given Classical stem selects.
 *
 * Split out of `generate.ts` on 2026-07-31 so `verb-stem.ts` can use it too:
 * `generate.ts` already imports `parseVerb`, so the verb side importing back
 * would close a cycle. Nothing else moved — `generate.ts` re-exports this so
 * the public entry point and the existing tests keep their import path.
 *
 * The conditions are the 2026 rulebook's own stem classes, section 2.1.2:
 * a suffix with consonant-initial variants is written in the variant agreeing
 * with the stem's дэвсгэр in хатуу/зөөлөн and дуутай/дуугүй.
 */

import { finalLetter } from './romanize.js';
import type { StemCondition } from './types.js';

/** Hudum vowels A E I O U OE UE EE, contiguous at U+1820–U+1827. */
const isVowelLetter = (cp: number): boolean => cp >= 0x1820 && cp <= 0x1827;

/** NA (U+1828) — its own stem class in school grammar. */
const NA = 0x1828;

/** BA (U+182A) — singled out by the rulebook for the -в past; see below. */
const BA = 0x182a;

/**
 * Хатуу дэвсгэр — the hard stem finals б, г, р, с, д. Rulebook 1(2), which
 * names the two classes outright: зөөлөн дэвсгэр is н, м, л, нг, й, в and
 * хатуу дэвсгэр is б, г, р, с, д.
 *
 * A stem ending in one of these takes the voiceless variant of whatever
 * follows — dative `-т` over `-д` (2.1.2.1), imperfective converb `-ч` over
 * `-ж` (2.2.2/16), unwitnessed past `-чээ` over `-жээ` (2.2.3/36–38).
 */
const HARD_FINALS: ReadonlySet<number> = new Set([
  0x182a, // BA — б
  0x182d, // GA — г / γ
  0x1830, // SA — с
  0x1833, // DA — д
  0x1837, // RA — р
]);

const CONDITIONS: Readonly<Record<StemCondition, (cp: number) => boolean>> = {
  vowel: isVowelLetter,
  consonant: (cp) => !isVowelLetter(cp),
  'consonant-not-n': (cp) => !isVowelLetter(cp) && cp !== NA,
  n: (cp) => cp === NA,
  hard: (cp) => HARD_FINALS.has(cp),
  'not-hard': (cp) => !HARD_FINALS.has(cp),
  b: (cp) => cp === BA,
};

/**
 * Whether an allomorph restricted to `condition` may attach to `stemClassical`.
 *
 * This is the Classical-side counterpart of `harmonyAgrees`: harmony is
 * readable off the Cyrillic and so is applied while segmenting, but the shape
 * of the *Classical* stem's last letter is only known once the stem has been
 * resolved, which is why the check lives here in stage 5.
 *
 * A stem whose ending cannot be determined satisfies every condition — losing
 * a reading is worse than keeping an unlikely one, and ranking sorts it out.
 */
export function allomorphFits(
  condition: StemCondition | undefined,
  stemClassical: string,
): boolean {
  if (condition === undefined) return true;
  const cp = finalLetter(stemClassical);
  if (cp === undefined) return true;
  return CONDITIONS[condition](cp);
}

/**
 * Does `stemClassical` end in a vowel letter — chachlag included, since a
 * chachlag *is* a final A or E?
 *
 * Deliberately not `allomorphFits('vowel', …)`. That answers *yes* for a stem
 * whose final letter cannot be determined, which is the right permissive
 * reading when choosing between allomorphs and the wrong one when classifying
 * a row: an unromanizable string must not be swept into a class.
 */
export function endsInVowel(stemClassical: string): boolean {
  const cp = finalLetter(stemClassical);
  return cp !== undefined && isVowelLetter(cp);
}
