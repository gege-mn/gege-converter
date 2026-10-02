/**
 * A suffix Cyrillic hangs on a hyphen — after a number, an abbreviation, a
 * Latin word or a closing quote: 2020-ны, 13-нд, АНУ-ын, iPhone-ыг.
 *
 * The third place the two orthographies disagree about a word boundary, after
 * `clitics.ts` (one word that is two) and `particles.ts` (two that are one).
 * Here Cyrillic has a device bichig does not: the hyphen says "this ending
 * belongs to that thing, which I did not spell out". The tokenizer sees a
 * number, a hyphen and a WORD, and until 2026-10-02 the word went to the
 * guesser — `ni` for a genitive. 1.2% of running-text tokens.
 *
 * ## The rule, as given
 *
 * Asked how such a suffix should be written, the owner's answer was:
 *
 * > "let's just assume that we'd use the suffix as if the word was written.
 * > for example АНУ - ends with -un because we'd do ulus un"
 *
 * So two things follow, and both are that sentence applied:
 *
 * 1. **The allomorph is the one the spoken word would take.** A number is
 *    read — 13 ends in гурав, 1 in нэг — and the suffix agrees with that
 *    word's harmony and its last letter: 13-нд is `du`, 1-нд is `dü`.
 * 2. **The connector is the one a written word would have: MVS.** The hyphen
 *    is Cyrillic's way of attaching the ending and is not carried over, any
 *    more than a space before ч is.
 *
 * ⚠ The second is the weaker reading of the two. "Not sure" was the first
 * word of the answer, and what a suffix after a DIGIT looks like in correct
 * Unicode is an encoding question no reader has ruled on. It is what
 * `tungaamal.ts` already does with a number + NNBSP + suffix, so the package is
 * at least consistent with itself; `docs/roadmap.md` keeps the question open.
 *
 * ## What is not known, and what is assumed
 *
 * - **A number's last word is known**, so its suffix is derived, not guessed.
 *   The Cyrillic says which stem: an ending that begins with н (-ны, -нд,
 *   -наас) is written on the numeral's н-form (`tabun`), any other on the bare
 *   one (`tabu`) — which is how the silver writes the same numerals spelled
 *   out: гуравны `γurban-u`, тавын `tabu-yin`.
 * - **An abbreviation's last word is not.** АНУ is … улс, and nothing here
 *   knows that. The Cyrillic ending carries most of it anyway — -ын is what a
 *   consonant-final masculine word takes — so the stem is assumed to end in a
 *   consonant, with the harmony of the ending and, failing that, of the
 *   abbreviation's own letters. A bare -д after a word that ends in a hard
 *   consonant (АНУ-д, `ulus-tu`) will come out `du`.
 *
 * The suffix itself is never invented: every form comes from a row of
 * `suffixes.ts`, chosen by the same `after` conditions the pipeline uses.
 */

import { harmonyOf, MVS } from './chars.js';
import { assemble } from './generate.js';
import { normalizeWord } from './normalize.js';
import { toScript } from './romanize.js';
import { segment } from './segment.js';
import type { Candidate, Harmony, Token } from './types.js';

/** What a suffix needs to know about the word it would have followed. */
interface Host {
  /** A Classical stand-in with the right last letter; only its ending is read. */
  bare: string;
  /** The same word with its тогтворгүй н, for an ending Cyrillic writes н on. */
  withN: string;
  harmony: Harmony;
}

const numeral = (bare: string, withN: string, harmony: Harmony): Host => ({ bare, withN, harmony });

/** 1–9, as the last word of a number. Bare and н-form, as the silver writes both. */
const UNITS: readonly Host[] = [
  numeral('teg', 'teg', 'feminine'),
  numeral('nige', 'nigen', 'feminine'),
  numeral('qoyar', 'qoyar', 'masculine'),
  numeral('γurba', 'γurban', 'masculine'),
  numeral('dörbe', 'dörben', 'feminine'),
  numeral('tabu', 'tabun', 'masculine'),
  numeral('ǰirγuγ-a', 'ǰirγuγan', 'masculine'),
  numeral('doluγ-a', 'doluγan', 'masculine'),
  numeral('naima', 'naiman', 'masculine'),
  numeral('yisü', 'yisün', 'feminine'),
];

/** 10–90. */
const TENS: readonly Host[] = [
  numeral('teg', 'teg', 'feminine'),
  numeral('arba', 'arban', 'masculine'),
  numeral('qori', 'qorin', 'masculine'),
  numeral('γuči', 'γučin', 'masculine'),
  numeral('döči', 'döčin', 'feminine'),
  numeral('tabi', 'tabin', 'masculine'),
  numeral('ǰira', 'ǰiran', 'masculine'),
  numeral('dala', 'dalan', 'masculine'),
  numeral('naya', 'nayan', 'masculine'),
  numeral('yere', 'yeren', 'feminine'),
];

const HUNDRED = numeral('ǰaγu', 'ǰaγun', 'masculine');
const THOUSAND = numeral('mingγ-a', 'mingγan', 'masculine');
const MILLION = numeral('say-a', 'say-a', 'masculine');
const BILLION = numeral('terbum', 'terbum', 'feminine');

/**
 * The last word of a number as it is read aloud, which is the word a suffix
 * attaches to: 13 → гурав, 20 → хорь, 300 → зуу, 5000 → мянга.
 */
function lastWordOf(digits: string): Host {
  const ascii = [...digits].map((d) => {
    const cp = d.codePointAt(0) ?? 0;
    return cp >= 0x1810 && cp <= 0x1819 ? cp - 0x1810 : cp - 0x30;
  });
  let zeros = 0;
  while (zeros < ascii.length - 1 && ascii[ascii.length - 1 - zeros] === 0) zeros += 1;
  const digit = ascii[ascii.length - 1 - zeros] ?? 0;
  if (zeros === 0) return UNITS[digit] as Host;
  if (zeros === 1) return TENS[digit] as Host;
  if (zeros === 2) return HUNDRED;
  if (zeros < 6) return THOUSAND;
  return zeros < 9 ? MILLION : BILLION;
}

/** A stand-in for a word nobody spelled out: consonant-final, not н, not hard. */
const unknownHost = (harmony: Harmony): Host => ({ bare: 'al', withN: 'al', harmony });

/** Cyrillic capitals, two or more: АНУ, НҮБ, УИХ. Read off the text as typed. */
const ABBREVIATION = /^[А-ЯӨҮЁ]{2,}$/;
/**
 * The punctuation token before the suffix: a hyphen alone, or a closing quote
 * or bracket and then the hyphen («Эрдэнэт»-ийн — the tokenizer makes one
 * token of a run of punctuation). The hyphen may already be the MVS that
 * `attachSuffixes` turned it into.
 */
const JOINT = new RegExp(`^([»”"'’)\\]]*)[-${MVS}]$`);

/** What stands before the hyphen, if it is something a suffix can hang on. */
function hostOf(tokens: readonly Token[], index: number): Host | undefined {
  const joint = tokens[index - 1];
  if (joint === undefined || joint.kind !== 'punctuation') return undefined;
  const match = JOINT.exec(joint.text);
  if (match === null) return undefined;
  const before = tokens[index - 2];
  if (before === undefined) return undefined;
  // After a quote the host is whatever was quoted. Its last word says which
  // harmony the ending agrees with; what it ends in is left assumed.
  if (match[1] !== '') {
    return unknownHost(before.kind === 'word' ? harmonyOf(normalizeWord(before.text)) : 'neutral');
  }
  if (before.kind === 'number') return lastWordOf(before.text);
  if (before.kind === 'latin') return unknownHost('neutral');
  if (before.kind === 'word' && ABBREVIATION.test(before.text)) {
    return unknownHost(harmonyOf(normalizeWord(before.text)));
  }
  return undefined;
}

/**
 * Stand-in Cyrillic stems, one per harmony. The segmenter reads harmony off
 * the whole word, so the stand-in has to carry the vowel the real word would
 * have; it ends in a hard consonant, which is what a dative -т may follow.
 */
const STAND_IN: Record<'masculine' | 'feminine', string> = { masculine: 'заз', feminine: 'зэз' };

/**
 * The Classical suffix chain a Cyrillic ending spells on this host, or
 * `undefined` if the ending is not a suffix chain at all (5-р, АНУ-Монгол).
 *
 * The ending is segmented exactly as it would be on a real word — glued to a
 * stand-in stem, so the suffix table, its ordering rules and its allomorph
 * conditions all apply unchanged — and the first reading that assembles on the
 * host's Classical form is kept.
 */
function chainFor(ending: string, host: Host): string | undefined {
  // Which stem the ending is written on. As typed, on the bare word. With the
  // stem's own н in front (-ны, -нд, -наас), on the н-form, the н being the
  // stem's and not the suffix's. With a linking г in front (-гаас), on the
  // bare word, the г being nobody's. And last the н-form under the ending as
  // typed, for the stacks only an н-stem takes (5-ынхаа is `tabun` + `u-ban`).
  const forms: [string, string][] = [[ending, host.bare]];
  if (ending.length > 1 && ending.startsWith('н')) forms.push([ending.slice(1), host.withN]);
  if (ending.length > 1 && ending.startsWith('г')) forms.push([ending.slice(1), host.bare]);
  forms.push([ending, host.withN]);

  // The ending's own vowels say which harmony the writer heard; an ending
  // without one (-д, -т, -г) takes the host's, and an unknown host is tried
  // both ways.
  const own = harmonyOf(ending);
  const wanted = own !== 'neutral' ? own : host.harmony;
  // -ийн and -ийг are what a front word takes; a back word takes them only
  // after г, ж, ч, ш, so with nothing else to go on the front reading is first.
  const frontFirst = ending.startsWith('и');
  const harmonies =
    wanted !== 'neutral'
      ? [wanted]
      : frontFirst
        ? (['feminine', 'masculine'] as const)
        : (['masculine', 'feminine'] as const);

  // Fewest suffixes first. One Cyrillic ending can be cut more than one way —
  // -ынхаа is a single ruled row (genitive + reflexive) and also genitive +
  // `qi` + reflexive — and the shorter chain is the listed one.
  let best: { chain: string; length: number } | undefined;
  for (const harmony of harmonies) {
    const standIn = STAND_IN[harmony];
    for (const [surface, stem] of forms) {
      for (const segmentation of segment(standIn + surface)) {
        if (segmentation.stem !== standIn || segmentation.suffixes.length === 0) continue;
        // A suffix that fuses into its stem is word-forming; nothing forms a
        // word out of "13".
        if (segmentation.suffixes.some((suffix) => !suffix.separate)) continue;
        if (segmentation.suffixes.some((s) => s.harmony !== undefined && s.harmony !== harmony)) {
          continue;
        }
        if (best !== undefined && best.length <= segmentation.suffixes.length) continue;
        const whole = assemble(stem, segmentation);
        if (whole === undefined) continue;
        best = { chain: whole.slice(stem.length + 1), length: segmentation.suffixes.length };
      }
    }
    if (best !== undefined) return best.chain;
  }
  return undefined;
}

/**
 * The single reading of a suffix written after a hyphen, or `undefined` if
 * this token is not one in this position.
 */
export function attachedSuffixCandidate(
  tokens: readonly Token[],
  index: number,
): Candidate | undefined {
  const token = tokens[index];
  if (token === undefined || token.kind !== 'word') return undefined;
  const host = hostOf(tokens, index);
  if (host === undefined) return undefined;
  const ending = normalizeWord(token.text);
  const classical = chainFor(ending, host);
  if (classical === undefined) return undefined;
  let script: string;
  try {
    script = toScript(classical);
  } catch {
    return undefined;
  }
  return {
    classical,
    script,
    prior: 1,
    confidence: 0,
    provenance: 'lexicon',
    segmentation: { stem: '', suffixes: [] },
  };
}

/**
 * Rewrite the hyphen before an attached suffix into an MVS.
 *
 * Like the space before ч in `particles.ts`: the token keeps its kind and its
 * span, and its text becomes the connector.
 */
export function attachSuffixes(tokens: readonly Token[]): Token[] {
  let changed = false;
  const out = tokens.map((token, index) => {
    if (token.kind !== 'punctuation' || !token.text.endsWith('-')) return token;
    if (attachedSuffixCandidate(tokens, index + 1) === undefined) return token;
    changed = true;
    return { ...token, text: token.text.slice(0, -1) + MVS };
  });
  return changed ? out : [...tokens];
}
