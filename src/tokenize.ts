import { isCyrillicLetter, isDigit, isLatinLetter, isSpace } from './chars.js';
import type { Token, TokenKind } from './types.js';

const kindOf = (ch: string): TokenKind => {
  if (isCyrillicLetter(ch)) return 'word';
  if (isDigit(ch)) return 'number';
  if (isLatinLetter(ch)) return 'latin';
  if (isSpace(ch)) return 'space';
  return 'punctuation';
};

/**
 * Split input into runs of one kind each. Offsets are code points, matching
 * gege-linter's diagnostic model — consumers must not `String.slice` with
 * them.
 */
export function tokenize(text: string): Token[] {
  const cps = [...text];
  const tokens: Token[] = [];
  let start = 0;
  while (start < cps.length) {
    const first = cps[start];
    if (first === undefined) break;
    const kind = kindOf(first);
    let end = start + 1;
    while (end < cps.length) {
      const next = cps[end];
      if (next === undefined || kindOf(next) !== kind) break;
      end += 1;
    }
    tokens.push({ kind, text: cps.slice(start, end).join(''), start, end });
    start = end;
  }
  return tokens;
}
