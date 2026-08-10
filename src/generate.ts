import { allomorphFits } from './allomorph.js';
import { carriesStemN } from './data/suffixes.js';
import { normalizeWord } from './normalize.js';
import { toScript } from './romanize.js';
import { segment } from './segment.js';
import {
  HARVESTED_PRIOR,
  RESTORED_DISCOUNT,
  resolveStem,
  type StemMatch,
  withUnstableN,
} from './stem.js';
import type { Candidate, Segmentation } from './types.js';
import { parseVerb } from './verb-stem.js';

// `allomorphFits` moved to ./allomorph.ts so the verb side can share it without
// closing an import cycle. Re-exported here because this was its published home.
export { allomorphFits };

/**
 * Join a stem and its suffixes into one Classical romanized form, or return
 * `undefined` when the chain is ill-formed for this stem — that is, when a
 * suffix's allomorph does not match what the stem ends in.
 *
 * Detached suffixes get a `-`, which `toScript` renders as MVS (U+180E) —
 * the Unicode 16.0 suffix connector. NNBSP (U+202F) is never emitted; that is
 * the whole point of this package existing.
 *
 * The stem is never rewritten. A chachlag stem keeps its connector and the
 * suffix adds its own, so харууд is `qar-a` + `nuγud` — two MVS in one word,
 * which is correct. An earlier version stripped the chachlag to avoid an MVS
 * appearing mid-word; that was papering over a missing allomorph condition.
 * The real guard is `after`: `ud` is restricted to consonant-final stems, so a
 * chachlag stem simply never selects it.
 */
export function assemble(stemClassical: string, segmentation: Segmentation): string | undefined {
  let out = stemClassical;
  for (const suffix of segmentation.suffixes) {
    if (!allomorphFits(suffix.after, out)) return undefined;
    out += (suffix.separate ? '-' : '') + suffix.classical;
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
 * Applied to a reading that is **correct but not this project's convention**.
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
 * ## The ruling (bichig reader, 2026-08-10, questions T1/T2)
 *
 * Asked whether -тай⁴ is written joined or detached, on ашигтай and морьтой
 * so the answers would discriminate a stem-final condition, the reader
 * declined to pick and said something more useful than either option:
 *
 * > both correct, and it's simply a choice. we chose to detach, but we can
 * > also attach. when attaching, гэдэс жийрэглэх rule apply btw
 *
 * So §2.3.6's дагавар/тийн ялгал split does **not** decide the spelling here.
 * Both readings are well-formed Mongolian, the running-text majority is a
 * house style rather than a correctness fact, and this project's standing
 * choice — the one already shipped, and the one the reader says is ours — is
 * to detach. The залгаж reading stays a candidate, because the reader confirms
 * it is correct; it simply does not win by default.
 *
 * ## The second half of the ruling is a blocker, and it is measurable
 *
 * "when attaching, гэдэс жийрэглэх rule apply" names a rule we do not
 * implement. Our залгаж output on a chachlag stem strands the stem's MVS
 * mid-word — санаатай assembles as `sanaγ-atai` — which is precisely the
 * shape `pnpm lint:output` reports as `unknown-suffix`, 19 of them the day the
 * залгаж rows landed. So the attached reading is not merely non-preferred
 * today, it is **malformed on exactly the stems the rule is about**. Ranking
 * it below the detached reading keeps that output from being anyone's answer
 * while the reading itself stays available.
 *
 * Remove this factor when гэдэс жийрэглэх is implemented and those warnings
 * are gone — at that point the choice becomes a genuine preference again, and
 * it should be revisited with the reader rather than flipped on the corpus
 * number alone.
 */
const OFF_CONVENTION = 0.25;

/**
 * Does this chain spell a suffix залгаж where this project writes it дагуулж?
 *
 * Narrow on purpose: it asks for the one category the reader ruled on, not for
 * "any attached suffix". Every other залгаж suffix in the table is the only
 * reading of its surface and has no дагуулж twin to lose to.
 */
const offConvention = (segmentation: Segmentation): boolean =>
  segmentation.suffixes.some(
    (suffix) => suffix.category === 'derivational' && /^т[аоэө]й$/.test(suffix.cyrillic),
  );

/**
 * Every plausible traditional-script reading of one Cyrillic word, unranked.
 * Candidates that fail to romanize are dropped rather than emitted broken.
 */
export function buildCandidates(word: string): Candidate[] {
  const normalized = normalizeWord(word);
  const found: Candidate[] = [];

  for (const segmentation of segment(normalized)) {
    for (const match of resolveStem(segmentation.stem, segmentation.suffixes[0])) {
      for (const stemClassical of stemReadings(match, segmentation)) {
        const classical = assemble(stemClassical, segmentation);
        if (classical === undefined) continue;
        let script: string;
        try {
          script = toScript(classical);
        } catch {
          continue;
        }
        found.push({
          classical,
          script,
          prior:
            match.prior *
            chainShare(segmentation) *
            (offConvention(segmentation) ? OFF_CONVENTION : 1),
          confidence: 0,
          gloss: match.gloss,
          provenance: match.provenance,
          segmentation,
        });
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

  return dedupe(found);
}

/** Collapse candidates that reached the same script, keeping the strongest. */
function dedupe(candidates: readonly Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const seen = best.get(candidate.script);
    if (seen === undefined || isStronger(candidate, seen)) best.set(candidate.script, candidate);
  }
  return [...best.values()];
}

const isStronger = (a: Candidate, b: Candidate): boolean =>
  a.prior !== b.prior
    ? a.prior > b.prior
    : a.segmentation.suffixes.length < b.segmentation.suffixes.length;
