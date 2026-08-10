/**
 * Particles that Cyrillic writes as a separate word and bichig attaches to the
 * word **before** them with MVS.
 *
 * This is `clitics.ts` run backwards. There, Cyrillic writes one word and
 * bichig two (мэдэхгүй → ᠮᠡᠳᠡᠬᠦ ᠦᠭᠡᠢ); here Cyrillic writes two and bichig
 * one (бодож ч → `boduǰu` + MVS + `ču`, one word). The same fact from opposite
 * sides: the two orthographies disagree about where words end, so a stage has
 * to fix the boundary before anything downstream can be right.
 *
 * ## Why this needed its own stage
 *
 * A bichig reader ruled ч on 2026-07-29 and again on 2026-08-03, and the
 * second answer is what unblocked it:
 *
 * > "this one must have MVS connecting the word and ču otherwise it will not
 * > look correct. if the word is masculin, it's ču, if it's feminine, it's чү"
 *
 * So the particle's **form is decided by the preceding word**, and until now
 * nothing in the pipeline carried harmony across a token boundary — which is
 * exactly why `docs/rulings.md` listed this as ruled-but-not-implemented. It
 * cannot be a suffix row either: `suffixes.ts` is keyed by Cyrillic surface
 * form, and the surface form here is a free-standing token, not an ending.
 * A row would also fire on words that genuinely end in ч (алсарч), which the
 * header of `verb-suffixes.ts` refuses to do for measured reasons.
 *
 * The reader's three examples, and what this produces for each:
 *
 *     нэг ч            nige  + MVS + čü     (feminine host)
 *     итгэж ч          itgeǰü + MVS + čü    (feminine host)
 *     бодож ч чадахгүй boduǰu + MVS + ču    (masculine host)
 *
 * ## What we emitted before, which was worse than a wrong letter
 *
 * A free-standing `či` — ᠴᠢ, which **is the pronoun чи, "you"**. So the old
 * output did not merely spell the particle wrong, it substituted a different
 * word into the sentence. Wiktionary and the reference converter both said
 * `ču` and were not believed until a reader confirmed it; that queue is in
 * `docs/rulings.md`.
 *
 * ## л is deliberately not here
 *
 * The 2026-07-29 note says "same for л → `le`". That was never asked of a
 * reader directly, and unlike ч there is no second source for it — `le` is
 * also not obviously harmony-invariant the way that note implies. One ruled
 * particle goes in; the other waits to be asked. CLAUDE.md's footgun about
 * generalising past what the ask covers is the whole reason for that split.
 */

import { harmonyOf } from './chars.js';
import { normalizeWord } from './normalize.js';
import { toScript } from './romanize.js';
import type { Candidate, Token } from './types.js';

/** U+180E, written as an escape and never as a literal — see CLAUDE.md. */
const MVS = '\u180E';

/**
 * Cyrillic surface → the two harmony readings. Masculine and feminine are the
 * reader's own words; a `neutral` host takes the front form, matching how
 * `guessStem` already treats neutral as front.
 */
const PARTICLES: ReadonlyMap<string, { masculine: string; feminine: string }> = new Map([
  ['ч', { masculine: 'ču', feminine: 'čü' }],
]);

/**
 * The word this particle attaches to, or `undefined` when there is none.
 *
 * A particle at the start of the input, or after punctuation, has no host — ч
 * is then whatever it is, but it is not this rule, and inventing a connector
 * to nothing would emit a leading MVS.
 */
function hostOf(tokens: readonly Token[], index: number): Token | undefined {
  const token = tokens[index];
  if (token === undefined || token.kind !== 'word') return undefined;
  if (!PARTICLES.has(normalizeWord(token.text))) return undefined;
  const gap = tokens[index - 1];
  if (gap === undefined || gap.kind !== 'space') return undefined;
  const host = tokens[index - 2];
  return host !== undefined && host.kind === 'word' ? host : undefined;
}

/**
 * The single reading of an attaching particle, or `undefined` if this token is
 * not one in this position.
 *
 * One candidate, not several: the reader gave a rule, not a preference, and
 * offering `či` alongside it would let the ranker reinstate the pronoun.
 */
export function particleCandidate(tokens: readonly Token[], index: number): Candidate | undefined {
  const host = hostOf(tokens, index);
  if (host === undefined) return undefined;
  const token = tokens[index] as Token;
  const forms = PARTICLES.get(normalizeWord(token.text)) as {
    masculine: string;
    feminine: string;
  };
  // Harmony is read off the host's Cyrillic, which is where it is legible;
  // `harmonyOf` returns neutral for words with no harmonic vowel, and neutral
  // takes the front form.
  const classical =
    harmonyOf(normalizeWord(host.text)) === 'masculine' ? forms.masculine : forms.feminine;
  return {
    classical,
    script: toScript(classical),
    prior: 1,
    confidence: 0,
    provenance: 'lexicon',
    segmentation: { stem: normalizeWord(token.text), suffixes: [] },
  };
}

/**
 * Rewrite the space before an attaching particle into an MVS.
 *
 * The token keeps `kind: 'space'` — it still occupies the gap between two
 * tokens and still has a zero-width job in the offset model — but its text is
 * now the connector, so `renderNonWord` emits MVS and the two words come out
 * as the one bichig word they are. The Cyrillic space it stood for is gone,
 * which is the point: `docs/rulings.md` records that ч attaches, and a space
 * here would be the wrong character exactly the way NNBSP is.
 */
export function attachParticles(tokens: readonly Token[]): Token[] {
  let changed = false;
  const out = tokens.map((token, index) => {
    if (token.kind !== 'space') return token;
    if (hostOf(tokens, index + 1) === undefined) return token;
    changed = true;
    return { ...token, text: MVS };
  });
  return changed ? out : [...tokens];
}
