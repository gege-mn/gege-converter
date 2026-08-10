/**
 * Cyrillic-side normalisation, run before lookup so that casing and
 * homoglyphs don't cause spurious lexicon misses.
 */

/** Latin letters that look identical to Cyrillic ones, as typed by real users. */
const HOMOGLYPHS: ReadonlyMap<string, string> = new Map([
  ['a', 'а'],
  ['c', 'с'],
  ['e', 'е'],
  ['o', 'о'],
  ['p', 'р'],
  ['x', 'х'],
  ['y', 'у'],
  ['A', 'А'],
  ['B', 'В'],
  ['C', 'С'],
  ['E', 'Е'],
  ['H', 'Н'],
  ['K', 'К'],
  ['M', 'М'],
  ['O', 'О'],
  ['P', 'Р'],
  ['T', 'Т'],
  ['X', 'Х'],
  ['Y', 'У'],
]);

/**
 * Fold a word to its lookup key: NFC, lowercase, and Latin homoglyphs mapped
 * back to Cyrillic. Deliberately does *not* touch ь/ъ or е/ё — those are
 * meaningful distinctions in Mongolian Cyrillic, not noise.
 */
export function normalizeWord(word: string): string {
  const nfc = word.normalize('NFC');
  let out = '';
  for (const ch of nfc) out += HOMOGLYPHS.get(ch) ?? ch;
  return out.toLowerCase();
}

/** Whether normalisation changed anything — useful for reporting input problems. */
export const needsNormalization = (word: string): boolean => normalizeWord(word) !== word;
