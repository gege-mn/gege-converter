/**
 * Verb stems, recovered from the `-х` infinitives already in the dictionary.
 *
 * The dictionary is a *lemma* dictionary, so it holds нэрлэх but not нэрлэсэн.
 * That looked like a data gap and is not one: a Mongolian verb's citation form
 * IS its stem plus `-х`/`-qu`, so нэрлэх / `nereleqü` hands over нэрлэ- /
 * `nerele-` for free. 1,717 stems come out of the current dictionary this way,
 * with no new data at all.
 *
 * Deriving rather than storing also means the stems cannot drift from the
 * lexicon, and that a future import of infinitives grows the verb paradigm
 * automatically.
 *
 * This is the fallback path only. A word that already resolves as a noun — as a
 * whole entry or as stem + case suffix — never reaches here, so memorised
 * inflected forms (байсан, гэдэг) keep their attested spelling rather than
 * being re-derived.
 */

import { allomorphFits } from './allomorph.js';
import { harmonyAgrees, harmonyOf } from './chars.js';
import { harvestedLexicon } from './data/harvested-lexicon.js';
import { lexicon } from './data/lexicon.js';
import { verbSuffixesEndingIn } from './data/verb-suffixes.js';
import type { Provenance, VerbSuffixEntry } from './types.js';

/**
 * Classical infinitive endings. `-qu`/`-qü` are the back/front readings of one
 * letter and `-ku`/`-kü` their other romanization, so all four are the same
 * suffix — see the allograph note in CLAUDE.md.
 */
const INFINITIVE = /(qu|qü|ku|kü)$/;

/** Shortest stem worth keeping; below this a prefix match is noise. */
const MIN_STEM_LENGTH = 2;

export interface VerbStem {
  /** Cyrillic stem, without the `-х`. */
  cyrillic: string;
  /** Classical stem in romanization, without the infinitive ending. */
  classical: string;
  provenance: Provenance;
}

const index = new Map<string, VerbStem>();
for (const entry of [...harvestedLexicon, ...lexicon]) {
  if (!entry.cyrillic.endsWith('х') || !INFINITIVE.test(entry.classical)) continue;
  const cyrillic = entry.cyrillic.slice(0, -1);
  const classical = entry.classical.replace(INFINITIVE, '');
  if (cyrillic.length < MIN_STEM_LENGTH || classical.length < MIN_STEM_LENGTH) continue;
  // Curated entries are appended last so they overwrite a harvested row for
  // the same stem, matching `resolveStem`'s tier precedence.
  index.set(cyrillic, {
    cyrillic,
    classical,
    provenance: lexicon.includes(entry) ? 'lexicon' : 'harvested',
  });
}

/** Every verb stem derivable from the dictionary's infinitives. */
export const verbStems: ReadonlyMap<string, VerbStem> = index;

export interface VerbParse {
  stem: VerbStem;
  suffix: VerbSuffixEntry;
  /** Full Classical form in romanization. */
  classical: string;
  /** Set when the stem was found only by restoring a dropped final vowel. */
  restored?: boolean;
}

/**
 * Vowels a verb stem can end in, in rough order of how often they fill the
 * slot.
 *
 * The order **decides**, it does not merely propose: `parseVerb` returns one
 * parse, so the first attested completion is the only one the ranker ever sees.
 * That is survivable because the ambiguity is rare — over the two gold sets,
 * the aligned pool and the lemma corpus (28,645 words) exactly 7 heads have
 * more than one attested completion, all of them `о`/`и` or `а`/`и` (бол-,
 * сор-, ур-), and in none of them does the pick disagree with the word's own
 * harmony. Offering both would mean `parseVerb` returning a list; worth doing
 * only if that count grows.
 */
const STEM_VOWELS = [...'эаоөиуү'];

/**
 * Stems to try when the peeled head ends in a consonant.
 *
 * A verb stem's final vowel is dropped in Cyrillic before a consonant-initial
 * ending: хэлэ + нэ is written хэлнэ, үзэ + нэ is үзнэ, бичи + сэн is бичсэн.
 * Peeling the ending leaves хэл / үз / бичс, which match no infinitive, so the
 * whole word falls through to the guesser — хэлнэ scored `qelne` before this.
 *
 * This is the verb-side twin of `restoreUnstableVowel` in `stem.ts`, and
 * differs in one way that matters: the noun rule *inserts* into a cluster
 * (ажл → ажил) while this *appends* (хэл → хэлэ), because what was dropped is
 * the stem's own final vowel rather than one inside it.
 *
 * The vowel is not predictable from the consonant, so this proposes every
 * candidate and keeps only those that are attested infinitives. Nothing is
 * invented: a head with no attested completion simply does not parse.
 */
function restoreStemVowel(head: string): VerbStem[] {
  const last = head[head.length - 1];
  if (last === undefined || VOWELS.has(last)) return [];
  const out: VerbStem[] = [];
  for (const v of STEM_VOWELS) {
    const stem = index.get(`${head}${v}`);
    if (stem !== undefined) out.push(stem);
  }
  return out;
}

/** Cyrillic vowels, for deciding whether a head already ends in one. */
const VOWELS: ReadonlySet<string> = new Set([...'аэиоөуүяеёюы']);

/** Romanized Classical vowels, for the linking-vowel test in `joinVerb`. */
const CLASSICAL_VOWELS: ReadonlySet<string> = new Set([...'aeiouüö']);

/**
 * Join a Classical stem to a Classical suffix, inserting the linking vowel when
 * the suffix asks for one and the stem ends in a consonant: `ab` + `γad` is
 * `abuγad`, `dügür` + `γed` is `dügürüged`.
 *
 * The vowel harmonises with the **stem**, which for these rows is the same as
 * the suffix's own harmony because `parseVerb` only pairs a stem with a suffix
 * its harmony agrees with. Reading it off the suffix keeps the one source of
 * truth in the table rather than re-deriving harmony here.
 *
 * A vowel-final stem never takes it — 140 of 140 aligned attestations are
 * written flat — so this narrows on the consonant case rather than always
 * inserting and hoping the romanizer collapses it.
 */
function joinVerb(stem: string, suffix: VerbSuffixEntry): string {
  const last = stem[stem.length - 1];
  const links =
    suffix.linking === true &&
    last !== undefined &&
    !CLASSICAL_VOWELS.has(last) &&
    allomorphFits(suffix.linkingAfter, stem);
  if (!links) return `${stem}${suffix.classical}`;
  return `${stem}${suffix.harmony === 'feminine' ? 'ü' : 'u'}${suffix.classical}`;
}

/**
 * Read `word` as a known verb stem plus one attested verb suffix, or
 * `undefined`.
 *
 * The **longest** stem wins, which matters: ажилладаг must be ажилла- + `-даг`,
 * not ажил- with the rest swallowed. Only one suffix is peeled — verb chains
 * stack in Khalkha, but nothing in the mined table is attested in
 * combination, and inventing the ordering would be exactly the guess this
 * module exists to avoid.
 */
export function parseVerb(word: string): VerbParse | undefined {
  const harmony = harmonyOf(word);
  for (const suffix of verbSuffixesEndingIn(word)) {
    if (!harmonyAgrees(harmony, suffix.harmony)) continue;
    const head = word.slice(0, word.length - suffix.cyrillic.length);
    for (let i = head.length; i >= MIN_STEM_LENGTH; i--) {
      const stem = index.get(head.slice(0, i));
      if (stem === undefined) continue;
      // The stem must account for the whole head; a leftover means this is a
      // different, longer verb we do not know rather than a licence to drop
      // letters.
      if (i !== head.length) break;
      // A дэвсгэр-conditioned allomorph that does not fit this stem is not
      // this reading — try the next row, which is that suffix's other variant.
      if (!allomorphFits(suffix.after, stem.classical)) break;
      return { stem, suffix, classical: joinVerb(stem.classical, suffix) };
    }

    // Reached when the head matched no stem as written, and also when only a
    // *shorter* prefix did — that one is rejected above as a different verb, so
    // restoring on the full head is still the right next thing to try. Either
    // way a stem spelled out in full has already returned: it always outranks
    // one recovered by putting a vowel back.
    const [restored] = restoreStemVowel(head).filter((s) =>
      allomorphFits(suffix.after, s.classical),
    );
    if (restored !== undefined) {
      return {
        stem: restored,
        suffix,
        classical: joinVerb(restored.classical, suffix),
        restored: true,
      };
    }
  }
  return undefined;
}
