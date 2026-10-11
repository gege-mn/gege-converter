import { allomorphFits } from './allomorph.js';
import { carriesStemN } from './data/suffixes.js';
import { normalizeWord } from './normalize.js';
import { CHACHLAG, fuseChachlag, styleOrdinal } from './ordinal.js';
import { toScript } from './romanize.js';
import { segment } from './segment.js';
import {
  HARVESTED_PRIOR,
  RESTORED_DISCOUNT,
  resolveStem,
  type StemMatch,
  withUnstableN,
} from './stem.js';
import type { Candidate, ConvertOptions, Segmentation, StylisticSuffixes } from './types.js';
import { parseVerb } from './verb-stem.js';

// `allomorphFits` moved to ./allomorph.ts so the verb side can share it without
// closing an import cycle. Re-exported here because this was its published home.
export { allomorphFits };

/**
 * Is the last thing written in `classical` a connector-joined suffix?
 *
 * A trailing `-a`/`-e` is a chachlag and part of the stem, so `aq-a` is not.
 */
const endsInJoinedSuffix = (classical: string): boolean =>
  classical.includes('-') && !CHACHLAG.test(classical);

/**
 * Join a stem and its suffixes into one Classical romanized form, or return
 * `undefined` when the chain is ill-formed for this stem — that is, when a
 * suffix's allomorph does not match what the stem ends in.
 *
 * Detached suffixes get a `-`, which `toScript` renders as MVS (U+180E) —
 * the Unicode 16.0 suffix connector. NNBSP (U+202F) is never emitted; that is
 * the whole point of this package existing.
 *
 * A chachlag stem keeps its connector under a detached suffix, which adds its
 * own, so харууд is `qar-a` + `nuγud` — two MVS in one word, which is correct.
 * An earlier version stripped the chachlag to avoid an MVS appearing mid-word;
 * that was papering over a missing allomorph condition. The real guard is
 * `after`: `ud` is restricted to consonant-final stems, so a chachlag stem
 * simply never selects it.
 *
 * ## `stylistic` rows, ruled 2026-10-11
 *
 * The comitative -тай³ may be written joined or attached; the reader's ruling
 * makes attached the default and `stylisticSuffixes` the switch. Two things
 * follow from attaching, and both are about what the ending lands on:
 *
 * - **A chachlag stem gives up its connector.** The separated vowel is final
 *   only while nothing is written after it, so ах + тай is `aqatai`, never
 *   `aq-atai` — that shape strands an MVS mid-word and is what gege-linter
 *   reports as `unknown-suffix`.
 * - **After a connector-joined suffix the ending stays joined**, under both
 *   styles: аавуудтай is `abu-nuγud-tai`. There is no word there to attach to,
 *   only another suffix, and `nuγudtai` is not one the linter or the gold knows
 *   (0 of the 55 plural + -тай³ gold rows attach).
 *
 * Only this one join moves. Whatever follows the ending keeps its own
 * `separate`: ахтайгаа is `aqatai-ban`.
 */
export function assemble(
  stemClassical: string,
  segmentation: Segmentation,
  stylisticSuffixes: StylisticSuffixes = 'attached',
): string | undefined {
  let out = stemClassical;
  for (const suffix of segmentation.suffixes) {
    if (!allomorphFits(suffix.after, out)) return undefined;
    if (suffix.stylistic !== true) {
      out += (suffix.separate ? '-' : '') + suffix.classical;
    } else if (stylisticSuffixes === 'joined' || endsInJoinedSuffix(out)) {
      out += `-${suffix.classical}`;
    } else {
      out = fuseChachlag(out) + suffix.classical;
    }
  }
  return out;
}

/**
 * Classical forms of a resolved stem to try against this segmentation.
 *
 * Normally one — the row as written. A **тогтворгүй н** row gets a second: the
 * same stem with its final NA brought back (нүд `nidü` → `nidün`), which is
 * what makes нүдний assemble as `nidün-ü` instead of falling to the guesser.
 *
 * Offered only where the suffix row says the н on the surface is the **stem's**
 * (`carriesStemN`) — нүдний spells it, нүдээр does not. That restriction is the
 * whole safety of this: an unconditional restoration would also offer
 * `nidün-iyer` for нүдээр beside the correct `nidü-ber`, two readings the ranker
 * has no way to choose between. The rulebook names the тогтворгүй н as a
 * condition on the genitive and the dative only (Хавсралт 2.1.1 rows 1–2), and
 * both of those are the cases whose Cyrillic writes the н out.
 *
 * Only the **innermost** suffix is consulted, because that is the one touching
 * the stem. `segment` returns the chain stem-outward, so it is index 0.
 */
function stemReadings(match: StemMatch, segmentation: Segmentation): string[] {
  if (match.hiddenN !== true) return [match.classical];
  const innermost = segmentation.suffixes[0];
  if (innermost === undefined || !carriesStemN(innermost)) return [match.classical];
  const restored = withUnstableN(match.classical);
  return restored === match.classical ? [restored] : [match.classical, restored];
}

/**
 * How much of this chain's weight survives the readings it had to choose
 * between — the product of its rows' `share`, and 1 for a chain of rows that
 * had no competitor.
 *
 * It lives here rather than in `rank.ts` for the same reason `verb.suffix.share`
 * does: `Ranker` is a **replaceable seam**, and a swapped-in ranker must not
 * silently drop a measurement the data table is carrying. `prior` is the
 * candidate's evidence, and how common this reading of an ambiguous suffix is
 * in running text is evidence, not policy.
 */
const chainShare = (segmentation: Segmentation): number =>
  segmentation.suffixes.reduce((product, suffix) => product * (suffix.share ?? 1), 1);

/**
 * Applied to the spelling of a stylistic ending that the caller did **not**
 * ask for. Both spellings are correct Mongolian — a reader said so twice — so
 * the other one stays a candidate a UI can offer; it just must not win.
 *
 * ## Why this is not a `share`
 *
 * `SuffixEntry.share` is documented as a count over running text, "not a
 * judgement", and it must stay that way — the -тай³ shares record a real
 * measurement (залгаж 72.4% against дагуулж 27.6% over 791 paired tokens of
 * running text) and that measurement is still true. This is the separate
 * thing: a **choice** about what we emit, which the measurement does not make
 * for us. Folding the choice into the share would falsify the data to get a
 * ranking, and the next person to read that field would believe the corpus
 * says something it does not.
 *
 * ## The rulings
 *
 * 2026-08-10 (T1/T2), asked whether -тай⁴ is joined or detached: *"both
 * correct, and it's simply a choice. we chose to detach, but we can also
 * attach."* 2026-10-11, the same reader: still a stylistic choice, **but legal
 * and formal documents must attach** — so attached became the default and the
 * choice became `ConvertOptions.stylisticSuffixes`. The ordinals -дугаар² and
 * -дахь² were ruled the same way that day; see `ordinal.ts`.
 */
const OFF_CONVENTION = 0.25;

const otherStyle = (style: StylisticSuffixes): StylisticSuffixes =>
  style === 'attached' ? 'joined' : 'attached';

/**
 * Is this chain built on the twin row of a -тай³ surface?
 *
 * Each surface has two rows, and since the ruling they no longer differ in
 * spelling — so they are used as the two spellings' carriers. The comitative
 * row (`separate: true`) is written the way the caller asked; its twin is
 * written the other way, at `OFF_CONVENTION`.
 *
 * That split is what keeps every weight where it was. Spelling both rows the
 * same way would let the twin's 0.72 share stand in for the comitative's 0.28
 * on every bare stem and re-rank -тай³ against unrelated readings — measured
 * over 48,214 corpus and gold words, 297 winners change for reasons that have
 * nothing to do with the join (таатай `taγatai` loses to та + тай). The ruling
 * moved a connector; it did not re-weigh anything.
 */
const onTwinRow = (segmentation: Segmentation): boolean =>
  segmentation.suffixes.some((suffix) => suffix.stylistic === true && !suffix.separate);

/**
 * The spellings of one stem + chain: the one `style` asks for at full weight
 * and the other at `OFF_CONVENTION`, wherever the word has a stylistic join.
 */
function spellings(
  stemClassical: string,
  segmentation: Segmentation,
  style: StylisticSuffixes,
): { classical: string; weight: number }[] {
  const spell = (s: StylisticSuffixes): string | undefined =>
    assemble(styleOrdinal(segmentation.stem, stemClassical, s), segmentation, s);
  const other = spell(otherStyle(style));
  if (onTwinRow(segmentation)) {
    return other === undefined ? [] : [{ classical: other, weight: OFF_CONVENTION }];
  }
  const preferred = spell(style);
  if (preferred === undefined) return [];
  return other === undefined || other === preferred
    ? [{ classical: preferred, weight: 1 }]
    : [
        { classical: preferred, weight: 1 },
        { classical: other, weight: OFF_CONVENTION },
      ];
}

/**
 * Every plausible traditional-script reading of one Cyrillic word, unranked.
 * Candidates that fail to romanize are dropped rather than emitted broken.
 *
 * Two readings may reach the same script — хана + тай and a letter-by-letter
 * guess are both `qanatai`. They are left in, because which one is the
 * stronger claim is the ranker's call; `rankCandidates` collapses them.
 */
export function buildCandidates(
  word: string,
  options: Pick<ConvertOptions, 'stylisticSuffixes'> = {},
): Candidate[] {
  const style = options.stylisticSuffixes ?? 'attached';
  const normalized = normalizeWord(word);
  const found: Candidate[] = [];

  for (const segmentation of segment(normalized)) {
    for (const match of resolveStem(segmentation.stem, segmentation.suffixes[0])) {
      for (const stemClassical of stemReadings(match, segmentation)) {
        for (const { classical, weight } of spellings(stemClassical, segmentation, style)) {
          let script: string;
          try {
            script = toScript(classical);
          } catch {
            continue;
          }
          found.push({
            classical,
            script,
            prior: match.prior * chainShare(segmentation) * weight,
            confidence: 0,
            gloss: match.gloss,
            provenance: match.provenance,
            segmentation,
          });
        }
      }
    }
  }

  // Verb morphology, last. Only a word that no noun reading resolved reaches
  // here, so a memorised inflected form (байсан, гэдэг) keeps its attested
  // spelling instead of being re-derived, and a genuine noun is never
  // reinterpreted as a verb. The prior is the stem's tier discounted by how
  // dominant the mined suffix pairing was, so a thinly-attested ending stays
  // visibly less certain than a curated noun reading.
  //
  // ⚠ A `toli` noun reading does NOT hold this gate shut, and that exception
  // is the difference between ахиад reading `aqiγad` and `aqiyad`. The gate
  // exists to stop an *attested* noun reading being re-derived as a verb; the
  // toli tier is the weakest one here and lists whole inflected words as
  // headwords, so letting it veto verb morphology suppresses the better answer
  // before it is ever built. ахиад is ахь + аад — the reader's ruling, and a
  // verb reading off a curated stem — while the toli offers the rarer `aqiyad`
  // ("small, tiny") as a bare headword. Below, the two compete on score and
  // the curated stem wins; with the toli in this gate, only the toli existed.
  if (!found.some((c) => c.provenance === 'lexicon' || c.provenance === 'harvested')) {
    const verb = parseVerb(normalized);
    if (verb !== undefined) {
      try {
        found.push({
          classical: verb.classical,
          script: toScript(verb.classical),
          prior:
            (verb.stem.provenance === 'lexicon' ? 1 : HARVESTED_PRIOR) *
            verb.suffix.share *
            (verb.restored ? RESTORED_DISCOUNT : 1),
          confidence: 0,
          provenance: verb.stem.provenance,
          segmentation: { stem: verb.stem.cyrillic, suffixes: [] },
        });
      } catch {
        // Unromanizable, same as any other candidate that cannot be written.
      }
    }
  }

  return found;
}
