import { attachedSuffixCandidate, attachSuffixes } from './attached.js';
import { splitClitics } from './clitics.js';
import { buildCandidates } from './generate.js';
import { attachParticles, particleCandidate } from './particles.js';
import { renderNonWord } from './punctuation.js';
import { frequencyRanker, rankCandidates } from './rank.js';
import { tokenize } from './tokenize.js';
import type { AnalyzedToken, ConvertOptions } from './types.js';
import { verbEnding } from './verb.js';

export { harmonyAgrees, harmonyOf, MVS, NNBSP } from './chars.js';
export { splitClitics } from './clitics.js';
export { lexicon, lexiconIndex } from './data/lexicon.js';
export { suffixes, suffixesEndingIn } from './data/suffixes.js';
export { verbSuffixes, verbSuffixesEndingIn } from './data/verb-suffixes.js';
export { allomorphFits, assemble, buildCandidates } from './generate.js';
export { normalizeWord } from './normalize.js';
export { attachParticles, particleCandidate } from './particles.js';
export { renderDigits, renderNonWord, renderPunctuation } from './punctuation.js';
export { frequencyRanker, rankCandidates } from './rank.js';
export {
  finalLetter,
  fromScript,
  isRomanizable,
  RomanizationError,
  scriptToWords,
  toScript,
  wordsToScript,
} from './romanize.js';
export { segment } from './segment.js';
export { GUESS_PRIOR, guessStem, resolveStem, type StemMatch } from './stem.js';
export { tokenize } from './tokenize.js';
export {
  detectTungaamal,
  isTungaamal,
  rewriteTungaamal,
  type TungaamalDetection,
  type TungaamalOptions,
  type TungaamalRewrite,
  tungaamalToUnicode,
} from './tungaamal.js';
export type * from './types.js';
export { verbEnding } from './verb.js';
export { parseVerb, type VerbParse, type VerbStem, verbStems } from './verb-stem.js';

const DEFAULT_MAX_CANDIDATES = 5;

/**
 * Convert Mongolian Cyrillic to traditional Mongolian script, keeping every
 * plausible reading.
 *
 * This is the real entry point. Word tokens carry candidates ranked
 * best-first with confidences that sum to 1; every other token kind carries
 * an empty list and should be passed through unchanged. Ambiguity comes back
 * as data, so a UI can offer the alternatives instead of silently guessing.
 */
export function analyze(text: string, options: ConvertOptions = {}): AnalyzedToken[] {
  // The three stages exist because Cyrillic and bichig disagree about where
  // words end, in both directions. `splitClitics` pulls мэдэхгүй and монголруу
  // apart; `attachParticles` glues "бодож ч" together with MVS; and
  // `attachSuffixes` does the same for an ending Cyrillic hangs on a hyphen
  // (2020-ны). Split first: it can create the word a particle then attaches to.
  const tokens = attachSuffixes(attachParticles(splitClitics(tokenize(text))));
  const ranker = options.ranker ?? frequencyRanker;
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const validate = options.validate;

  return tokens.map((token, index) => {
    if (token.kind !== 'word') return { token, candidates: [] };

    // A particle whose form depends on the word before it is the one place a
    // reading cannot be built from the token alone — see `particles.ts`.
    const particle = particleCandidate(tokens, index);
    if (particle !== undefined) return { token, candidates: [{ ...particle, confidence: 1 }] };

    // …and a suffix hung on a hyphen is the other: its form depends on the
    // number or abbreviation before it — see `attached.ts`.
    const attached = attachedSuffixCandidate(tokens, index);
    if (attached !== undefined) return { token, candidates: [{ ...attached, confidence: 1 }] };

    let candidates = buildCandidates(token.text);
    if (validate !== undefined) {
      const valid = candidates.filter((c) => validate(c.script));
      // Keep the invalid set when nothing survives: flagging a suspect
      // conversion beats dropping the word from the output entirely.
      if (valid.length > 0) candidates = valid;
    }

    const verbForm = verbEnding(token.text);
    return {
      token,
      candidates: rankCandidates(candidates, ranker, { tokens, index }, maxCandidates),
      ...(verbForm !== undefined && { verbForm }),
    };
  });
}

/**
 * Best-guess conversion as a single string — a thin wrapper over `analyze`.
 * Words with no candidate (unknown and unguessable) are passed through in
 * Cyrillic rather than dropped.
 *
 * Non-word tokens are rendered by `renderNonWord`, which by default changes
 * nothing: digits and punctuation stay ASCII unless `options.digits` or
 * `options.punctuation` asks for the traditional forms.
 */
export function convert(text: string, options: ConvertOptions = {}): string {
  const digits = options.digits ?? 'ascii';
  const punctuation = options.punctuation ?? 'ascii';
  return analyze(text, options)
    .map(
      (analyzed) =>
        analyzed.candidates[0]?.script ?? renderNonWord(analyzed.token, digits, punctuation),
    )
    .join('');
}
