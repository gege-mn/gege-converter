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
import { attestedIndex } from './data/attested-forms.js';
import { harvestedLexicon } from './data/harvested-lexicon.js';
import { lexicon } from './data/lexicon.js';
import { toliIndex } from './data/toli-lexicon.js';
import { verbSuffixesEndingIn } from './data/verb-suffixes.js';
import type { Harmony, Provenance, VerbSuffixEntry } from './types.js';

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
const addInfinitive = (cyrillicWord: string, classicalWord: string, provenance: Provenance) => {
  if (!cyrillicWord.endsWith('х') || !INFINITIVE.test(classicalWord)) return;
  const cyrillic = cyrillicWord.slice(0, -1);
  const classical = classicalWord.replace(INFINITIVE, '');
  if (cyrillic.length < MIN_STEM_LENGTH || classical.length < MIN_STEM_LENGTH) return;
  index.set(cyrillic, { cyrillic, classical, provenance });
};
// Weakest tier first, so each stronger one overwrites it for the same stem —
// matching `resolveStem`'s precedence. A `toli` infinitive with two readings
// keeps its first, the order the source lists them in.
for (const [cyrillic, readings] of toliIndex) {
  const first = readings[0];
  if (first !== undefined) addInfinitive(cyrillic, first, 'toli');
}
for (const entry of harvestedLexicon) addInfinitive(entry.cyrillic, entry.classical, 'harvested');
for (const entry of lexicon) addInfinitive(entry.cyrillic, entry.classical, 'lexicon');

/**
 * Every verb stem derivable from the dictionary's infinitives — curated,
 * harvested and `toli`. Stems from `attested` infinitives are not in this map;
 * `stemOf` reads those live.
 */
export const verbStems: ReadonlyMap<string, VerbStem> = index;

/**
 * The stem an **attested** infinitive hands over, read from the live tier.
 *
 * An attested infinitive is a whole-word row like any other, but an infinitive
 * IS its stem plus `-х`, so the row gives up a stem exactly as a harvested one
 * does: чадах `čidaqu` → чада- `čida-`.
 *
 * Looked up on demand rather than copied into `index` at load, and that is
 * deliberate. `scripts/import-attested.mjs` empties the tier in memory before
 * it asks what the pipeline derives, so that last run's rows cannot answer for
 * themselves; a copy made at load would survive that and leave the importer
 * judging words with the previous generation's stems.
 */
function attestedStem(cyrillic: string): VerbStem | undefined {
  // A two-word reading is not an infinitive, whatever letter it ends in.
  const classical = attestedIndex.get(`${cyrillic}х`)?.find((reading) => !reading.includes(' '));
  if (classical === undefined || !INFINITIVE.test(classical)) return undefined;
  const stem = classical.replace(INFINITIVE, '');
  if (cyrillic.length < MIN_STEM_LENGTH || stem.length < MIN_STEM_LENGTH) return undefined;
  return { cyrillic, classical: stem, provenance: 'attested' };
}

/**
 * The verb stem for a Cyrillic key, strongest tier first: curated, harvested,
 * attested, `toli`. Where the attested tier and the dictionary both list the
 * verb, the attested row exists *because* the silver disagreed with the
 * dictionary about it, so the two must not be read in the other order.
 */
function stemOf(cyrillic: string): VerbStem | undefined {
  const known = index.get(cyrillic);
  if (known !== undefined && known.provenance !== 'toli') return known;
  return attestedStem(cyrillic) ?? known;
}

export interface VerbParse {
  stem: VerbStem;
  suffix: VerbSuffixEntry;
  /** Full Classical form in romanization. */
  classical: string;
  /**
   * Set when the stem was not spelled out in the word and had to be recovered:
   * a dropped final vowel put back, the metathesis that moves it undone, or an
   * absorbed и restored (`restoreStemVowel`, `restoreMetathesis`,
   * `restoreAbsorbedI`).
   */
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
    const stem = stemOf(`${head}${v}`);
    if (stem !== undefined) out.push(stem);
  }
  // The better-attested stem first, and the vowel order only within a tier.
  // With stems from the curated and harvested tiers alone the vowel order never
  // had to arbitrate between tiers; once `toli` infinitives joined, ахад found
  // the dictionary's аха- before the harvested ахи- the reader ruled on
  // (`aqiγad`). `Array.prototype.sort` is stable, so equal tiers keep the
  // vowel order they were collected in.
  return out.sort((a, b) => TIER_RANK[a.provenance] - TIER_RANK[b.provenance]);
}

/**
 * The vowels Cyrillic writes into a cluster it cannot pronounce. Measured, not
 * assumed: `у`/`ү` never fill the slot. The heads that look as if they do are
 * long vowels (буур-, дуус-, үүс-), which the consonant test below already
 * turns away.
 */
const EPENTHETIC: ReadonlySet<string> = new Set([...'аэоөи']);

/**
 * The consonants the stem vowel is attested moving across — see the
 * measurement in `restoreMetathesis`. A whitelist, because the letters left
 * out are not merely unseen: each is where some *other* word ends up looking
 * like a metathesised verb.
 */
const METATHESIS_ACROSS: ReadonlySet<string> = new Set([...'лрсд']);

/**
 * Stems to try when the peeled head ends vowel + consonant and is no stem.
 *
 * A stem that ends consonant + consonant + vowel cannot simply drop its final
 * vowel before a consonant-initial ending, because three consonants would
 * meet. Cyrillic moves the vowel instead: нарийвчла + сан is written
 * нарийвчилсан, учра + на is учирна, эхлэ + ж is эхэлж, амьдра + даг is
 * амьдардаг. Peeling the ending leaves нарийвчил / учир / эхэл / амьдар, and
 * `restoreStemVowel` cannot help — it appends, and the stem here is not the
 * head plus a letter but the head with its last two letters *exchanged*.
 *
 * So: take the vowel out from before the final consonant, and propose every
 * stem vowel after it. As in `restoreStemVowel`, nothing is invented — a
 * proposal survives only if it is an attested infinitive. The vowel that comes
 * out and the vowel that goes back are not the same letter (нарийвчил → -чла,
 * учир → учра: и out, а in), which is why this proposes rather than moves.
 *
 * ## Measured 2026-10-02, before it was written
 *
 * `node scripts/mine-verb-suffixes.mjs --recovery`: every word of the silver set
 * that ends in one of the table's endings and whose head is no stem as
 * written, loanwords and the held-out sample excluded, each proposal judged by
 * whether the silver's script begins with the recovered stem.
 *
 * - **259 heads** resolve this way and by no other route, and the silver
 *   agrees on 242 of them (93%).
 * - **Where a vowel can simply be appended, that reading is the right one.**
 *   25 heads have both completions — тохир- is тохиро- and also тохро-, багас-
 *   is багаса- and багса- — and the appended stem matched the silver all 25
 *   times, the exchanged one 8. Hence the caller tries this only after
 *   `restoreStemVowel` has come back empty.
 * - **A long vowel is not an inserted one.** With a vowel before the slot
 *   (таар-, уриал-, хөөр-, буур-) the exchanged stem was right 0 times in 75.
 *   So the letter before the slot must be a consonant, which is also what the
 *   phonology says: the vowel is there to break up a cluster.
 * - **By the consonant crossed** it is 155 of 164 across л, 82 of 85 across р,
 *   3 of 3 across с and 1 of 1 across д — 241 of 253 on the four letters kept
 *   — and 0 of 4 across х, because a head in vowel + х is an infinitive:
 *   хэлэхэд is хэлэх plus the dative, not хэлхэ- plus a converb. The other
 *   letters fail the same way, on words with no silver answer to count them
 *   by: across г the passive (санагдаг), across т the terminative (ханатлаа,
 *   against one judged form that is right), across м and н the nouns in -мж
 *   and -нж (хэлэмж; халамж is the 0 of 1). ж, ш, ц and в look right by eye
 *   (үхэжсэн, давхацдаг) and have no judged attestation at all, so they wait.
 *   What is left wrong across л and р is mostly the stem's own spelling
 *   differing between two sources (амарсан: `amara` here, `amura` there).
 */
function restoreMetathesis(head: string): VerbStem[] {
  const last = head[head.length - 1];
  const inserted = head[head.length - 2];
  const before = head[head.length - 3];
  if (last === undefined || inserted === undefined || before === undefined) return [];
  if (!METATHESIS_ACROSS.has(last) || !EPENTHETIC.has(inserted) || VOWELS.has(before)) return [];
  const cluster = `${head.slice(0, -2)}${last}`;
  const out: VerbStem[] = [];
  for (const v of STEM_VOWELS) {
    const stem = stemOf(`${cluster}${v}`);
    if (stem !== undefined) out.push(stem);
  }
  return out.sort((a, b) => TIER_RANK[a.provenance] - TIER_RANK[b.provenance]);
}

/** The consonants after which Cyrillic will not write и before another vowel. */
const HUSHING: ReadonlySet<string> = new Set([...'жчш']);

/** The four vowels a long-vowel ending shows in place of an absorbed и. */
const ABSORBING: ReadonlySet<string> = new Set([...'аэоө']);

/**
 * The stem to try when the peeled head ends ж/ч/ш + vowel and is no stem.
 *
 * An и-final stem keeps its и before a vowel-initial ending — яри + аад is
 * яриад, and peeling `ад` leaves яри. After ж, ч and ш Cyrillic does not write
 * that и: бичи + ээд is бичээд, унши + аад is уншаад, очи + оод is очоод. The
 * head is then бичэ / унша / очо, which ends in a vowel, so neither
 * restoration above is even asked, and the word went to the guesser as a noun
 * in the dative (`biče-dü`).
 *
 * One proposal, the same letters with и back in the slot, and — as everywhere
 * here — only if that is an attested infinitive. Measured 2026-10-02 with
 * `scripts/mine-verb-suffixes.mjs --recovery`: 19 heads, and the silver is
 * built on the proposed stem in all 19.
 */
function restoreAbsorbedI(head: string): VerbStem[] {
  const last = head[head.length - 1];
  const before = head[head.length - 2];
  if (last === undefined || before === undefined) return [];
  if (!ABSORBING.has(last) || !HUSHING.has(before)) return [];
  const stem = stemOf(`${head.slice(0, -1)}и`);
  return stem === undefined ? [] : [stem];
}

/** Lower is stronger. Mirrors the order `resolveStem` consults the tiers in. */
const TIER_RANK: Record<Provenance, number> = {
  lexicon: 0,
  harvested: 1,
  attested: 2,
  toli: 3,
  guess: 4,
};

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
 * The harmony of a Classical stem, read off its last non-neutral vowel, or
 * `undefined` when it has none (`ki`, `biči`).
 *
 * `parseVerb` asks this instead of `harmonyOf(word)` for the endings Cyrillic
 * spells one way in both harmonies — -ж, -ч, -в, -гч, -н — because there the
 * word gives no second opinion and its first vowel is not always the stem's:
 * нүүрлэ- is `niγurla`, masculine in Classical under a feminine Cyrillic
 * spelling, and санхүүжүүлэ- is a compound whose first vowel is back and whose
 * verb is front. Measured 2026-10-02 over 2,705 silver forms on a known stem
 * whose suffix shows its harmony: the two readings disagree on 11, and the
 * stem's last vowel is the silver's on 9 of them (нүүрлэж `niγurlaǰu`,
 * заналхийлж `ǰanulqileǰü`), the word's first vowel on 2 (зайлсхийж).
 *
 * The *last* vowel and not the first, for the compounds: the suffix agrees
 * with the syllable it is attached to.
 */
function classicalHarmony(classical: string): Harmony | undefined {
  for (let i = classical.length - 1; i >= 0; i--) {
    const ch = classical[i];
    if (ch === undefined) continue;
    if ('aou'.includes(ch)) return 'masculine';
    if ('eöü'.includes(ch)) return 'feminine';
  }
  return undefined;
}

/**
 * Undo the soft sign Cyrillic writes for a stem-final и before a consonant.
 *
 * ярих is яри- + `-х`, and the same stem before a consonant-initial ending is
 * written with ь: ярьж, ярьсан, ярьдаг — тавих gives тавьж, тавьсан. The stem
 * the index holds is the one the infinitive spells (яри), so the peeled head
 * ярь matched nothing and every such form fell to the guesser: ярьж came out
 * `yariǰi` where the stem alone gives `yariǰu`.
 *
 * Spelling, not morphology: ь and и are the same stem vowel written two ways,
 * and which one appears is decided by the letter that follows. So this is a
 * rewrite of the key, and — like every other restoration here — the result
 * still has to be an attested infinitive stem before anything is built on it.
 */
const unsoften = (head: string): string => (head.endsWith('ь') ? `${head.slice(0, -1)}и` : head);

/**
 * The Cyrillic letters the ч-spelling of the converb and of the evidential
 * past is written after.
 *
 * Bare -ч is two suffixes — the converb гарч, and the agent noun эмч — and the
 * suffix table refused it a row for a long time because nothing told them
 * apart. The Cyrillic spelling does: the converb is written -ч only after в,
 * г, р, с and -ж everywhere else, so a ч after any other letter is not the
 * converb. Measured 2026-10-02 (`scripts/mine-verb-suffixes.mjs --ending ч
 * --hosts`), on words that parse as a known verb stem + ч: 97 forms after р,
 * с or в, 84 of them the converb; өгч after г; and 6 after л, м, н or a vowel,
 * none of them the converb (эмч, өмч, голч, илч).
 *
 * It lives here rather than on the rows because `VerbSuffixEntry.after` is a
 * condition on the **Classical** stem, and this one is on the Cyrillic head:
 * амьдарч and худалч both recover a vowel-final Classical stem (`amidura`,
 * `qudala`), and only the letter before the ч says which is a verb form.
 */
const CH_HOSTS: ReadonlySet<string> = new Set([...'вгрс']);

/** The rows `CH_HOSTS` governs — the ч-spelled twins of -ж and -жээ. */
const CH_SPELLED: ReadonlySet<string> = new Set(['ч', 'чээ']);

/**
 * The perfective converb's spellings with the г Cyrillic inserts after a long
 * vowel or a diphthong (байгаад, хийгээд, тогтоогоод). The г is there *because*
 * the head ends in a vowel, so after a consonant these letters are something
 * else — a stem that itself ends in г: хийлгээд is хийлгэ- + ээд, and reading
 * it хийл- + гээд found the wrong verb the first time these rows were tried
 * (хийлгээд, байлгаад, ширгээд — all three right before, wrong after).
 */
const G_SPELLED: ReadonlySet<string> = new Set(['гаад', 'гоод', 'гээд']);

/**
 * The voluntative written as a bare vowel letter. After a consonant Cyrillic
 * spells it with a sign (авъя, үзье), which are rows of their own, so a bare я
 * or е there is not this ending: over the words these two rows changed when
 * they were added, 14 of 14 with a silver answer were right after a vowel,
 * й or ь, and after a consonant it was де and не — the French particles —
 * and nothing else that could be judged.
 */
const BARE_VOLUNTATIVE: ReadonlySet<string> = new Set(['я', 'е']);

/**
 * Whether `suffix` may follow the head as Cyrillic actually wrote it.
 *
 * `VerbSuffixEntry.after` conditions a row on the Classical stem. A few rows
 * also need a condition on the Cyrillic surface, which the type has no field
 * for, so they are applied here by name — each one measured where it is
 * declared. They are the rows whose letters are far commoner as something
 * else, and in every case the letter in front is what tells the verb form
 * from the rest. -ч is `CH_HOSTS`, the г-spelled perfective `G_SPELLED`, the
 * bare voluntative `BARE_VOLUNTATIVE`, all above.
 *
 * **-н, the modal converb, follows a vowel and never й**: the stem's vowel is
 * always written before it (аван, болон, эхлэн), so
 * a consonant there is an abbreviation (мн, сн), and after й the ending is the
 * genitive nearly every time — жирийн, биржийн, зүйн, өнгийн. Measured on the
 * words the row changed when it was first added, judged against the
 * silver: after a vowel 164 right and 10 wrong, after й 2 right and 8
 * wrong, after a consonant 0 right and 1 wrong. The handful of real converbs
 * on an й-final stem (дуурайн, ухасхийн) are given up with it; they convert
 * as they did before.
 */
function surfaceFits(suffix: VerbSuffixEntry, head: string): boolean {
  const last = head[head.length - 1];
  if (last === undefined) return false;
  if (CH_SPELLED.has(suffix.cyrillic)) return CH_HOSTS.has(last);
  if (suffix.cyrillic === 'н') return VOWELS.has(last) && last !== 'й';
  if (G_SPELLED.has(suffix.cyrillic)) return VOWELS.has(last) || last === 'й';
  if (BARE_VOLUNTATIVE.has(suffix.cyrillic)) return VOWELS.has(last) || 'йь'.includes(last);
  return true;
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
  const rows = verbSuffixesEndingIn(word);
  // The first row that parses wins — unless it stands on a `toli` stem, the
  // weak tier, and a later row reads the word on a stem a real source spells
  // out in full. тэнсэн met -сэн first and a dictionary тэн-; the harvested
  // тэнсэ- + -н is the same word read on better evidence. A weak tier's damage
  // is the better path it stops from running, here as everywhere else.
  let weak: VerbParse | undefined;
  for (const suffix of rows) {
    const parse = parseWith(word, harmony, rows, suffix);
    if (parse === undefined) continue;
    if (parse.stem.provenance !== 'toli') {
      if (weak === undefined) return parse;
      if (parse.restored !== true) return parse;
      continue;
    }
    weak ??= parse;
  }
  return weak;
}

/** `word` read with this one suffix row, or `undefined`. */
function parseWith(
  word: string,
  harmony: ReturnType<typeof harmonyOf>,
  rows: readonly VerbSuffixEntry[],
  suffix: VerbSuffixEntry,
): VerbParse | undefined {
  {
    // An ending Cyrillic spells one way for both harmonies (-ж, -ч, -в, -гч,
    // -н) is chosen by the stem once it is known — see `classicalHarmony`.
    // Every other row is chosen here, by the word, because its Cyrillic
    // already shows which harmony the writer heard: -сэн has no masculine row
    // to fall back on, and refusing it over the stem would lose the parse.
    const twinned = rows.some(
      (r) => r.cyrillic === suffix.cyrillic && r.harmony !== suffix.harmony,
    );
    if (!twinned && !harmonyAgrees(harmony, suffix.harmony)) return undefined;
    const agrees = (stem: VerbStem): boolean =>
      !twinned || harmonyAgrees(classicalHarmony(stem.classical) ?? harmony, suffix.harmony);
    const written = word.slice(0, word.length - suffix.cyrillic.length);
    if (!surfaceFits(suffix, written)) return undefined;
    const head = unsoften(written);
    // A stem spelled out in full, but only on a weak tier's word for it — kept
    // while the restorations below are asked whether a REAL stem reads the
    // head. бичээд peels to бичэ, and the corpus has the misspelling бичэх;
    // the curated бичи-, one absorbed и away, is the verb.
    let weak: VerbParse | undefined;
    for (let i = head.length; i >= MIN_STEM_LENGTH; i--) {
      const stem = stemOf(head.slice(0, i));
      if (stem === undefined) continue;
      // The stem must account for the whole head; a leftover means this is a
      // different, longer verb we do not know rather than a licence to drop
      // letters.
      if (i !== head.length) break;
      // A дэвсгэр-conditioned allomorph that does not fit this stem is not
      // this reading — try the next row, which is that suffix's other variant.
      if (!allomorphFits(suffix.after, stem.classical) || !agrees(stem)) break;
      const parse = { stem, suffix, classical: joinVerb(stem.classical, suffix) };
      if (stem.provenance !== 'attested' && stem.provenance !== 'toli') return parse;
      weak = parse;
      break;
    }

    // Reached when the head matched no stem as written, and also when only a
    // *shorter* prefix did — that one is rejected above as a different verb, so
    // restoring on the full head is still the right next thing to try. Either
    // way a stem spelled out in full has already returned: it always outranks
    // one recovered by putting a vowel back.
    //
    // The metathesis is consulted only when appending found nothing at all —
    // not merely nothing that fits this row's `after`. A head with an appended
    // completion is that verb (measured in `restoreMetathesis`).
    //
    // And only the **strongest** proposal is asked whether it fits. Until
    // 2026-10-02 this filtered the whole list by `after` and took what was
    // left, so a row the best stem did not fit went looking for a weaker stem
    // that did: гарчээ met the `not-hard` row first, the harvested гара-
    // `γar` is хатуу, and the dictionary's гари- `γari` was taken in its place
    // — `γariǰei`, where the next row down is the same ending's хатуу variant
    // and gives `γarčei`. A дэвсгэр-conditioned ending comes as a pair of rows
    // that between them fit every stem, so declining here loses nothing: the
    // best stem meets its own row on the next turn of the loop.
    //
    // The two other restorations cannot both apply — one needs the head to
    // end in a consonant, the other in a vowel — and the absorbed и exists
    // only before an ending that itself begins with a vowel.
    const appended = restoreStemVowel(head);
    const absorbed = VOWELS.has(suffix.cyrillic[0] ?? '') ? restoreAbsorbedI(head) : [];
    //
    // "Found nothing" means nothing REAL. A weak tier's word can sit one
    // appended vowel away from any head — the corpus has учирах beside учрах —
    // and if that counted, the metathesis that finds the harvested учра- would
    // never be asked.
    const real = (stem: VerbStem): boolean =>
      stem.provenance === 'lexicon' || stem.provenance === 'harvested';
    const moved = appended.some(real) ? [] : [...restoreMetathesis(head), ...absorbed];
    const [restored] = moved.some(real) || appended.length === 0 ? moved : appended;
    if (
      restored !== undefined &&
      allomorphFits(suffix.after, restored.classical) &&
      agrees(restored) &&
      (weak === undefined ||
        restored.provenance === 'lexicon' ||
        restored.provenance === 'harvested')
    ) {
      return {
        stem: restored,
        suffix,
        classical: joinVerb(restored.classical, suffix),
        restored: true,
      };
    }
    if (weak !== undefined) return weak;
  }
  return undefined;
}
