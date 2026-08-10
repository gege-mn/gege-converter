import type { Candidate, RankContext, Ranker } from './types.js';

/**
 * Penalty per suffix peeled off. Below 1 so that the simplest parse wins ties
 * — a bare lexicon hit should beat an over-segmented reading of the same word.
 */
const SUFFIX_PENALTY = 0.7;

/**
 * Extra discount on a **guessed** reading that peeled nothing off.
 *
 * `SUFFIX_PENALTY` exists to stop an over-segmented reading beating a real
 * dictionary entry for the same word. That reasoning needs the whole-word
 * reading to be a dictionary entry. When it is itself a guess, the penalty
 * runs backwards: it protects the single weakest claim the pipeline can
 * make — "this unknown string is a stem, entire" — against a reading that at
 * least matched an attested suffix row.
 *
 * кириллээс is the case that exposed it. `kirilles` (guess, unsegmented,
 * 0.15) beat `kirill-eče` (guess stem + the real ablative row, 0.105), so a
 * wholly invented stem outranked a correctly analysed one.
 *
 * Set below `SUFFIX_PENALTY` so one suffix outranks no suffix, and above
 * `SUFFIX_PENALTY²` so two do not: peeling one attested suffix is evidence,
 * peeling two off a stem nothing has ever seen is speculation.
 */
const UNSEGMENTED_GUESS_PENALTY = 0.6;

/**
 * The Classical directive, and the one place this ranker reads context.
 *
 * луу is the only one of the four Cyrillic directive surfaces that is also an
 * ordinary word — the dragon — so it is the only one whose reading has to be
 * decided rather than looked up. A bichig reader gave the deciding rule on
 * 2026-07-30: **луу/лүү is used only after a host word ending in р.** That is
 * a statement about the previous token, which is exactly what `RankContext`
 * exists to carry ("every token of the input, so a ranker can look at
 * neighbours").
 *
 * So нуур луу is the directive and луу standing alone is the dragon, without
 * either reading being deleted from the lexicon. `splitClitics` applies the
 * same rule to the attached spelling нуурлуу, and the two agree because they
 * are the same rule read from the same ruling.
 */
const DIRECTIVE = 'uruγu';
const DIRECTIVE_AFTER_R_BOOST = 4;

/** The word token before `index`, skipping the space between them. */
function previousWord(context: RankContext): string | undefined {
  for (let i = context.index - 1; i >= 0; i -= 1) {
    const token = context.tokens[i];
    if (token === undefined) return undefined;
    if (token.kind === 'space') continue;
    return token.kind === 'word' ? token.text.toLowerCase() : undefined;
  }
  return undefined;
}

/**
 * The default ranker: stem frequency discounted by how much segmentation the
 * reading needed.
 *
 * This is the library's entire statistical surface. It reads two numbers off
 * the candidate and multiplies them — there is no model, nothing is trained,
 * and the inputs are hand-editable rows in `data/lexicon.ts`. Replace it with
 * a context n-gram (or anything else satisfying `Ranker`) without touching
 * another stage.
 */
export const frequencyRanker: Ranker = {
  name: 'frequency',
  score(candidate: Candidate, context: RankContext): number {
    const suffixes = candidate.segmentation.suffixes.length;
    const unsupported =
      candidate.provenance === 'guess' && suffixes === 0 ? UNSEGMENTED_GUESS_PENALTY : 1;
    const directive =
      candidate.classical === DIRECTIVE && previousWord(context)?.endsWith('р')
        ? DIRECTIVE_AFTER_R_BOOST
        : 1;
    return candidate.prior * SUFFIX_PENALTY ** suffixes * unsupported * directive;
  },
};

/**
 * Sort best-first, keep at most `maxCandidates`, and normalise the kept
 * scores into confidences summing to 1.
 */
export function rankCandidates(
  candidates: readonly Candidate[],
  ranker: Ranker,
  context: RankContext,
  maxCandidates: number,
): Candidate[] {
  const scored = candidates
    .map((candidate) => ({ candidate, score: Math.max(0, ranker.score(candidate, context)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);

  const total = scored.reduce((sum, s) => sum + s.score, 0);
  return scored.map(({ candidate, score }) => ({
    ...candidate,
    confidence: total > 0 ? score / total : 0,
  }));
}
