/** Character classes for Mongolian Cyrillic and the Mongolian block (U+1800–18AF). */

import type { Harmony } from './types.js';

/** Suffix connector / chachlag separator (Unicode 16.0 core spec ch. 13.5). */
export const MVS = '\u180E';
/** Legacy suffix connector, superseded by MVS in Unicode 16.0. Never emitted. */
export const NNBSP = '\u202F';

/** Back ("masculine") Cyrillic vowels. */
const BACK_VOWELS = 'аоуяёы';
/** Front ("feminine") Cyrillic vowels. */
const FRONT_VOWELS = 'эөүе';
/** Vowels that agree with either class. */
const NEUTRAL_VOWELS = 'ийю';

const CYRILLIC_VOWELS = BACK_VOWELS + FRONT_VOWELS + NEUTRAL_VOWELS;

export const isCyrillicVowel = (ch: string): boolean => CYRILLIC_VOWELS.includes(ch);

/** Mongolian Cyrillic letters, including the two Mongolian-only vowels ө and ү. */
const CYRILLIC_LETTERS = 'абвгдеёжзийклмнопрстуүфхцчшщъыьэюяө';

export const isCyrillicLetter = (ch: string): boolean =>
  CYRILLIC_LETTERS.includes(ch) || CYRILLIC_LETTERS.includes(ch.toLowerCase());

/**
 * Harmony class of a Cyrillic word: the class of its first non-neutral vowel.
 * Words whose only vowels are neutral (бичиг, ир-) take front suffixes, so
 * `neutral` is reported and callers fall back to feminine allomorphs.
 */
export const harmonyOf = (word: string): Harmony => {
  for (const ch of word.toLowerCase()) {
    if (BACK_VOWELS.includes(ch)) return 'masculine';
    if (FRONT_VOWELS.includes(ch)) return 'feminine';
  }
  return 'neutral';
};

/** Whether a suffix restricted to `required` may attach to a `stem`-class word. */
export const harmonyAgrees = (stem: Harmony, required: Harmony | undefined): boolean => {
  if (required === undefined) return true;
  if (stem === 'neutral') return required === 'feminine';
  return stem === required;
};

export const isLatinLetter = (ch: string): boolean => /[A-Za-z]/.test(ch);

/**
 * ASCII `0`–`9` or MONGOLIAN DIGIT ZERO..NINE (U+1810–1819). Both count, so a
 * document already written with traditional digits tokenizes as numbers rather
 * than falling through to `punctuation`.
 */
export const isDigit = (ch: string): boolean => /[0-9᠐-᠙]/.test(ch);

export const isSpace = (ch: string): boolean => /\s/.test(ch);
