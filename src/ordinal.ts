/**
 * The ordinal endings -дугаар², -дахь², and how they are joined to a numeral.
 *
 * There are no suffix rows for these, on purpose. An ordinal reaches the
 * pipeline as a whole word — memorised (`γurbaduγar`) or guessed — so the join
 * is set on the **stem's Classical form** rather than by the segmenter, which
 * also covers a case stacked after it (гуравдугаарт) without a second path.
 *
 * Gated to numeral hosts because the endings are not otherwise safe to
 * recognise: -дэх collides with every front-vowel verb in -дэх (нэгдэх, "to
 * unite"), and дэргэдэх, тэндэх, дундах end in the same letters while being
 * a locative + `ki`, with the boundary one syllable further left.
 */

import { toScript } from './romanize.js';
import { resolveStem } from './stem.js';
import type { StylisticSuffixes } from './types.js';

const NUMERALS: ReadonlySet<string> = new Set([
  'нэг',
  'хоёр',
  'гурав',
  'дөрөв',
  'тав',
  'зургаа',
  'долоо',
  'найм',
  'ес',
  'арав',
  'хорь',
  'гуч',
  'дөч',
  'тавь',
  'жар',
  'дал',
  'ная',
  'ер',
  'зуу',
  'мянга',
  'сая',
  'хэд',
]);

const ENDINGS: readonly (readonly [cyrillic: string, classical: string])[] = [
  ['дугаар', 'duγar'],
  ['дүгээр', 'düger'],
  ['дахь', 'daqi'],
  ['дэх', 'deqi'],
];

/** A stem's separated final vowel: `aq-a`, `bey-e`. */
export const CHACHLAG = /-([ae])$/;

/**
 * Write a separated final vowel as the medial one it becomes once something is
 * attached after it: `aq-a` → `aqa`. Any other stem is returned unchanged.
 */
export const fuseChachlag = (classical: string): string => classical.replace(CHACHLAG, '$1');

const script = (classical: string): string | undefined => {
  try {
    return toScript(classical);
  } catch {
    return undefined;
  }
};

/**
 * The numeral's own stem, when it carries a separated vowel that a memorised
 * ordinal has already fused: долоо is `doluγ-a` and долоодугаар is stored
 * `doluγaduγar`, so the joined spelling is `doluγ-a-duγar`, not `doluγa-duγar`.
 */
function unfused(numeral: string, host: string): string {
  const hostScript = script(host);
  for (const match of resolveStem(numeral)) {
    if (match.provenance === 'toli' || match.provenance === 'guess') continue;
    if (!CHACHLAG.test(match.classical)) continue;
    if (script(fuseChachlag(match.classical)) === hostScript) return match.classical;
  }
  return host;
}

/**
 * `classical` with its ordinal ending joined the way `style` asks, or
 * unchanged when `cyrillic` is not a numeral carrying one.
 *
 * The ending is matched in script: γ/g and q/k are one letter each, and the
 * harvest spells нэгдүгээр `niγedüγer`.
 */
export function styleOrdinal(
  cyrillic: string,
  classical: string,
  style: StylisticSuffixes,
): string {
  for (const [ending, endingClassical] of ENDINGS) {
    if (!cyrillic.endsWith(ending)) continue;
    const numeral = cyrillic.slice(0, -ending.length);
    if (!NUMERALS.has(numeral)) continue;

    const tail = classical.slice(-endingClassical.length);
    if (script(tail) !== script(endingClassical)) continue;
    const host = classical.slice(0, -endingClassical.length).replace(/-$/, '');
    if (host === '') continue;

    return style === 'joined'
      ? `${unfused(numeral, host)}-${tail}`
      : `${fuseChachlag(host)}${tail}`;
  }
  return classical;
}
