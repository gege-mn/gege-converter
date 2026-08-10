/**
 * Punctuation and digits — what happens to the tokens that are not words.
 *
 * Romanization deliberately stops at the word boundary. `toScript` maps the
 * Hudum *alphabet* and nothing else, because three of its metacharacters are
 * ASCII characters that also occur in running text: `-` is MVS, `.` is a
 * letter boundary, and `1`–`4` select FVS1–FVS4. Feeding it a sentence is not
 * a missing feature, it is a category error — `toScript('1234')` returns four
 * variation selectors, silently and without complaint. So the alphabet stays
 * word-scoped and this stage handles everything around the words, keyed off
 * the token kinds `tokenize` already produces.
 *
 * ## Why the default is to change nothing
 *
 * There is no canonical answer to convert *to*. UTN #57 §2.2.3 defers every
 * number and punctuation specification to a future version, and Poppe §86
 * records that Classical punctuation was "used at random". The reference
 * charts note that the Mongolian digits U+1810–1819 are "less used now" and
 * that ASCII digits are common in modern Mongolian text. Emitting U+1810–1819
 * by default would be inventing a convention, so `'ascii'` is the default and
 * the Mongolian forms are opt-in.
 *
 * ## Why the choice is per-document, not per-character
 *
 * gege-linter flags `digit-consistency` — U+1810–1819 and ASCII digits mixed
 * in one document. A heuristic that converted some digits and not others would
 * produce text that fails that check, so the policy is a single option applied
 * uniformly rather than something decided per token.
 *
 * Only mappings the reference documents actually support appear below.
 * U+1804 COLON is omitted because it is documented nowhere; U+1800 BIRGA and
 * U+1805 FOUR DOTS are omitted because they mark the head of a text and the
 * end of a passage, which no ASCII character means.
 */

import type { ScriptStyle, Token } from './types.js';

/** ASCII `0`–`9` → MONGOLIAN DIGIT ZERO..NINE, contiguous at U+1810–1819. */
const MONGOLIAN_ZERO = 0x1810;

/**
 * ASCII punctuation → its traditional-script counterpart.
 *
 * The two question/exclamation marks are fullwidth CJK forms rather than
 * anything in the Mongolian block: UTN #57 Table 1 lists U+FF1F as the
 * required question mark, because the block never encoded one and the
 * fullwidth glyphs are the ones that sit upright in vertical text.
 */
const TO_MONGOLIAN: ReadonlyMap<string, string> = new Map([
  [',', '᠂'], // MONGOLIAN COMMA — ceg
  ['.', '᠃'], // MONGOLIAN FULL STOP — dabqur ceg, a double dot (not U+1809, Manchu)
  ['…', '᠁'], // HORIZONTAL ELLIPSIS → MONGOLIAN ELLIPSIS
  ['?', '？'], // FULLWIDTH QUESTION MARK — UTN #57 Table 1
  ['!', '！'], // FULLWIDTH EXCLAMATION MARK
]);

/** The inverse, for reading traditional-script input back to ASCII. */
const TO_ASCII: ReadonlyMap<string, string> = new Map(
  [...TO_MONGOLIAN].map(([ascii, mongolian]) => [mongolian, ascii]),
);

/** `...` is written as one ellipsis before the per-character pass sees it. */
const ASCII_ELLIPSIS = /\.\.\./g;

/**
 * Rewrite the digits in `text` to `style`, leaving everything else alone.
 * Digits already in the target style are left as they are, so this is
 * idempotent and safe on mixed input.
 */
export function renderDigits(text: string, style: ScriptStyle): string {
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? -1;
    if (style === 'mongolian' && c >= 0x30 && c <= 0x39) {
      out += String.fromCodePoint(MONGOLIAN_ZERO + (c - 0x30));
    } else if (style === 'ascii' && c >= MONGOLIAN_ZERO && c <= 0x1819) {
      out += String.fromCodePoint(0x30 + (c - MONGOLIAN_ZERO));
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Rewrite the punctuation in `text` to `style`. Characters with no counterpart
 * — parentheses, quotes, the hyphen, the semicolon — pass through unchanged
 * rather than being approximated, since picking a substitute for them would be
 * a guess this package has no source for.
 */
export function renderPunctuation(text: string, style: ScriptStyle): string {
  const table = style === 'mongolian' ? TO_MONGOLIAN : TO_ASCII;
  const src = style === 'mongolian' ? text.replace(ASCII_ELLIPSIS, '…') : text;
  let out = '';
  for (const ch of src) out += table.get(ch) ?? ch;
  return out;
}

/**
 * Render one non-word token under the given styles.
 *
 * Word tokens are not this stage's business and are returned verbatim; the
 * caller substitutes the winning candidate. Latin, space and `other` tokens
 * are always verbatim — a Latin acronym in Mongolian text stays Latin, and
 * inventing a transliteration for it is the single fastest way to make output
 * that a reader cannot trust.
 */
export function renderNonWord(token: Token, digits: ScriptStyle, punctuation: ScriptStyle): string {
  if (token.kind === 'number') return renderDigits(token.text, digits);
  if (token.kind === 'punctuation') return renderPunctuation(token.text, punctuation);
  return token.text;
}
