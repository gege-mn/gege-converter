import { endsInVowel } from './allomorph.js';
import { harmonyOf, isCyrillicVowel } from './chars.js';
import { attestedIndex } from './data/attested-forms.js';
import { harvestedIndex, lexiconIndex } from './data/lexicon.js';
import { toliIndex } from './data/toli-lexicon.js';
import { isRomanizable, toScript } from './romanize.js';
import type { Harmony, LexiconEntry, Provenance, SuffixEntry } from './types.js';

export interface StemMatch {
  /** Classical form in romanization. */
  classical: string;
  gloss?: string;
  /** Relative weight among readings of the same Cyrillic stem. */
  prior: number;
  provenance: Provenance;
  /**
   * The row carries a тогтворгүй н — a final NA the citation form drops and an
   * oblique form brings back. `generate.ts` reads this; see `withUnstableN`.
   */
  hiddenN?: boolean;
}

/**
 * The Classical stem with its **тогтворгүй н** materialised — нүд `nidü` →
 * `nidün`, so that нүдний assembles as `nidün-ü`.
 *
 * The rulebook's Хавсралт 2.1.1 row 1(b) groups тогтворгүй-н words with
 * genuinely н-final stems under one genitive condition, which is why this
 * produces a form that satisfies the ordinary `after: 'n'` check rather than
 * needing a condition of its own.
 *
 * A chachlag is a word-**final** a/e written detached. Once an н follows it
 * inside the same orthographic word the vowel is no longer final, so the
 * connector goes with it: хэмжээ `qemǰiy-e` gives `qemǰiyen`, not `qemǰiy-en`.
 * Rows that already spell the н out are returned unchanged, so the two ways our
 * data records the same fact converge here instead of producing `narann`.
 */
export function withUnstableN(classical: string): string {
  if (classical.endsWith('n')) return classical;
  const base = /-[ae]$/.test(classical) ? classical.slice(0, -2) + classical.slice(-1) : classical;
  return `${base}n`;
}

/** Confidence multiplier applied to anything the guesser produced. */
export const GUESS_PRIOR = 0.15;

/**
 * Prior for a guess assembled from two attested words — see `guessCompound`.
 * Still a guess and still labelled one; a little above the letter-by-letter
 * guess so that ганболд read as ган + болд outranks the same letters read as
 * an unknown ганбол with a dative on it.
 */
export const COMPOUND_GUESS_PRIOR = 0.2;

/**
 * Prior for a harvested row. Sits between a curated entry and a guess:
 * far better than rule-based invention, but unreviewed, and the silver differs from
 * this project on documented points. A curated entry short-circuits the lookup
 * entirely, so this can never outrank one for the same word.
 */
export const HARVESTED_PRIOR = 0.5;

/**
 * Prior for an `attested` whole word. Above every reading the pipeline can
 * *derive* — a curated stem with one suffix peeled scores 0.7 at best — and
 * below a curated whole-word row, which short-circuits before this is asked.
 *
 * The height is the claim: this is the exact word, as written by the source
 * the `harvested` stems came from, and the importer stored it only because the
 * derivation disagreed. A row that merely repeats the derivation is never
 * stored, so there is nothing for this to outrank except the reading it was
 * kept to correct.
 */
export const ATTESTED_PRIOR = 0.9;

/**
 * Prior for an `attested` word pressed into service as a stem — see the
 * last-resort lookup in `resolveStem`. Between `toli` and `harvested`: the
 * spelling comes from the better source of the two, but nothing says the word
 * is a stem at all.
 *
 * Swept 2026-10-02 over the held-out words, which are the only fixture that
 * can see this number — a held-out word is never in the tier, so its stem
 * being there is exactly the case. On the 512 held out at the time: 0.35
 * scores 81.4%, 0.24 scores 80.9%, 0.18 scores 80.7%. Above `toli` is where it
 * earns its place. (The fixture has grown since; `scripts/eval-heldout.mjs`
 * prints today's figure, and this is the sweep, not the score.)
 */
export const ATTESTED_STEM_PRIOR = 0.35;

/**
 * Prior for a `toli` row — the bundled-dictionary tier. Below `harvested`,
 * well above a guess, and the gap on each side is doing work.
 *
 * ⚠ This number alone does not keep the tier in its place, and relying on it
 * to was the first thing tried. Merged into `harvested` at the harvested
 * prior, this source broke seven of the reader's confirmed rulings; given its
 * own prior but still consulted before the restoration paths, it broke six.
 * What fixes it is *where* `resolveStem` asks, not what it weighs the answer
 * at — see the comment at the lookup itself.
 */
export const TOLI_PRIOR = 0.25;

/**
 * Applied to a stem found only by restoring a dropped unstable vowel
 * (ажлаас → ажил). Still far above a guess — the restored form is an attested
 * dictionary entry — but below a stem the Cyrillic spelled out, so a literal
 * match wins whenever both are possible.
 */
export const RESTORED_DISCOUNT = 0.8;

/**
 * Cyrillic letter → Classical romanization, for the out-of-vocabulary
 * guesser. Two letters are harmony-dependent and handled separately: г is
 * γ/g and х is q/k. в is position-dependent and handled separately too.
 */
const LETTER_MAP: ReadonlyMap<string, string> = new Map([
  ['а', 'a'],
  ['б', 'b'],
  // в never reaches this map — see the position rule in `guessStem`. Left here
  // only so the map stays a complete inventory of the alphabet.
  ['в', 'b'],
  ['д', 'd'],
  ['е', 'e'],
  ['ё', 'yo'],
  ['ж', 'ǰ'],
  // ᠵ (ǰ), not ᠽ (z). ᠽ is the galig letter, used only in loanwords; a native з
  // is the same letter as ж. Of the 726 native rows containing з and no ж, 695
  // (96%) spell it `ǰ` — газар `γaǰar`, зүрх `ǰirüken`, зун `ǰun` — and **not
  // one** spells it `z`. The old `z` entry meant the guesser wrote зүрхний as
  // ᠽᠦᠷᠬᠨ, a word with a foreign letter in it. Loanwords with з are curated
  // rows and never reach this map.
  ['з', 'ǰ'],
  ['и', 'i'],
  // ᠢ (i), not ᠶ (y). Cyrillic й only ever occurs after a vowel, where it is
  // the second element of a diphthong — and this project writes those V+i, not
  // the older Classical V+y+i (UTN #57, ruled 2026-07-26). Word-finally 395 of
  // 400 native rows end in `i` and none in `y`; medially it is 831 of 848.
  // The 5% that show a `y` are the ай- root taking an epenthetic vowel
  // (айлга `ayulγ-a`), which is lexical and does not generalise.
  ['й', 'i'],
  // ᠻ (kh), not ᠬ (k). Cyrillic к occurs only in loanwords, and the letter
  // they are written with is the galig KHA: of 486 silver words containing
  // к, 479 (98.6%) carry ᠻ — клип `khlip`, компани `khompani`, техник
  // `tēqnikh` — and the curated кирилл is `khirill`. The old `k` here is the
  // native feminine QA, so an unknown loanword came out with a letter no
  // source writes it with (клип as `klip`). Measured 2026-10-02 over the
  // running-text silver set. This is the transliteration convention itself, not
  // a rule about Mongolian drawn from foreign words: nothing native has a к
  // for it to apply to.
  ['к', 'kh'],
  ['л', 'l'],
  ['м', 'm'],
  ['н', 'n'],
  ['о', 'o'],
  ['ө', 'ö'],
  ['п', 'p'],
  ['р', 'r'],
  ['с', 's'],
  ['т', 't'],
  ['у', 'u'],
  ['ү', 'ü'],
  ['ф', 'f'],
  // ᠴ (č), not ᠼ (c). ᠼ is the foreign-word letter; a native ц is the same
  // letter as ч. Of the 598 harvested native rows that contain a ц and no ч,
  // 581 (97%) spell it `č` — арц `arča`, авцалд `abčaldu`, алтанцэцэг
  // `altančečeγ` — and the 17 that spell it `c` are loanwords (амбиц, перц).
  // Loanwords with ц are curated rows and never reach this map.
  ['ц', 'č'],
  ['ч', 'č'],
  ['ш', 'š'],
  ['щ', 'šč'],
  ['ъ', ''],
  ['ы', 'i'],
  ['ь', 'i'],
  ['э', 'e'],
  ['ю', 'yu'],
  ['я', 'ya'],
]);

const VOWELS = 'аоуэөүиеёюя';

/**
 * Rule-based fallback for stems the lexicon doesn't have.
 *
 * Deliberately minimal. It collapses Cyrillic long vowels to a single vowel
 * and transliterates letter by letter, harmonising г and х. It does NOT try
 * to reverse the `V+γ/g+V` contraction that produced those long vowels
 * (улаан ← ulaγan), because getting that wrong invents a consonant, which is
 * a worse failure than omitting one. Widening this needs linguistic review;
 * until then everything it returns is marked `guess` and ranked far below any
 * lexicon hit.
 */
export function guessStem(cyrillic: string): string {
  const harmony: Harmony = harmonyOf(cyrillic);
  const front = harmony === 'feminine' || harmony === 'neutral';
  const chars = [...cyrillic.toLowerCase()];
  let out = '';
  let seenVowel = false;
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (ch === undefined) continue;
    // Collapse a doubled vowel: Cyrillic long vowels correspond to a single
    // Classical vowel plus a lost consonant we don't try to recover.
    if (VOWELS.includes(ch) && chars[i + 1] === ch) continue;
    // An iotated vowel already carries its vowel, so a following plain copy is
    // the same length mark and is absorbed: аюул is `ayul`, авъяас is `abiyas`
    // — never ayuul or abiyaas. Measured over the harvest: юу 4/4 and яа 32/37
    // render single, and NEITHER ever renders doubled, so emitting the doubled
    // form (which is what this did before) was wrong every time. ё is left
    // alone: ёо is genuinely mixed (ёотон is `yootang`).
    if ((ch === 'ю' && chars[i + 1] === 'у') || (ch === 'я' && chars[i + 1] === 'а')) {
      out += ch === 'ю' ? 'yu' : 'ya';
      seenVowel = true;
      i += 1;
      continue;
    }
    // н before г or х is ᠩ (ng), not ᠨ — хонгор is `qongγur`, анх is `angq-a`.
    // The scope of this is measured, not assumed: of the native rows with н+C,
    // нг is 249/253 (98%) and нх 93/97 (96%), while every other consonant sits
    // between 10% and 83% — нч is 22%, нд 14%. So the rule covers exactly the
    // two velars and nothing else, and даанч (`dangču`) stays a lexical row
    // rather than being swept in on a plausible-sounding generalisation.
    if (ch === 'н' && (chars[i + 1] === 'г' || chars[i + 1] === 'х')) out += 'ng';
    else if (ch === 'г') out += front ? 'g' : 'γ';
    else if (ch === 'х') out += front ? 'k' : 'q';
    // в is Classical b everywhere except word-initially, where it is w. Cyrillic
    // spelling merged the two: аав is `abu`, авах is `abaqu`, but ваар is
    // `waγar`. Measured over the harvest (loanword rows excluded): medially
    // b:w = 422:17, finally 25:2, but initially 1:15 — initial в is essentially
    // always a loanword. An earlier version emitted w unconditionally, which
    // was wrong for the ~98% of occurrences that are not word-initial.
    else if (ch === 'в') out += i === 0 ? 'w' : 'b';
    // o and ö are written only in the first syllable; after it, masculine
    // words take u and feminine ü. This is categorical in Mongol bichig, so
    // it is safe to apply even to a guess.
    else if (ch === 'о') out += seenVowel ? 'u' : 'o';
    else if (ch === 'ө') out += seenVowel ? 'ü' : 'ö';
    // ё carries an o inside it, so the same rule applies to that o: yo in the
    // first syllable, yu after it (ruled 2026-07-26). The flat LETTER_MAP entry
    // below cannot express this, which is why ё is intercepted here — соёлжилт
    // is `soyulǰilta`, not `soyolǰilta`. Known ё-words that behave differently
    // (хоёр is `qoyar`, ё → ya) are lexicon entries and never reach the guesser.
    else if (ch === 'ё') out += seenVowel ? 'yu' : 'yo';
    else out += LETTER_MAP.get(ch) ?? '';
    if (VOWELS.includes(ch)) seenVowel = true;
  }
  return closeOpenSyllable(out, chars[chars.length - 1], front);
}

/** The foreign-word letters, U+1838–U+1842: a word carrying one keeps its o. */
const hasGalig = (classical: string): boolean =>
  [...toScript(classical)].some((c) => {
    const cp = c.codePointAt(0) ?? 0;
    return cp >= 0x1838 && cp <= 0x1842;
  });

const COMPOUND_MIN_LENGTH = 7;
const COMPOUND_MIN_HEAD = 3;
const COMPOUND_MIN_TAIL = 4;

/**
 * A word no tier knows, read as two attested words written together —
 * ганболд is ган + болд, өмнөговь is өмнө + говь. `undefined` when it does
 * not split that way.
 *
 * This is how Mongolian builds personal and place names, and a name is exactly
 * the word no dictionary has. Letter by letter the guesser cannot know that
 * ган is `γang` or that бат is `batu`; the two rows already do.
 *
 * Measured 2026-10-02 over the words of the silver set that fall to the
 * guesser: 153 split this way, the join is what the silver wrote for 124 of
 * them, and the letter-by-letter guess was right for 13. One word the old
 * guess had right is lost.
 *
 * - **Curated and harvested rows only**, never `toli` — the usual reason: a
 *   weak tier asked early invents a segmentation.
 * - **The longest head wins**, and the tail is at least four letters. With a
 *   three-letter tail the split starts taking endings for words (бичиг + дэх,
 *   байдаг + сан) and loses six where the guess was right; at four it loses
 *   one.
 * - **The tail's o and ö fold to u and ü**, because inside the compound they
 *   are no longer in the first syllable: болд `bolud` gives `γangbulud`. A
 *   loanword tail keeps its o, as it does everywhere else.
 * - A chachlag head loses its connector, as it does before an н: the vowel is
 *   no longer word-final. The TAIL keeps its own — гантулга is `γangtulγ-a`.
 * - A selector on the tail's first letter is dropped. It picked that letter's
 *   word-initial form (дугаар `d1uγar`), and the letter is not initial here.
 *
 * ⚠ Still `guess`. Two real rows do not make the join real — эрдэм + тэд is
 * not how эрдэмтэд is built — and one row in five is wrong.
 */
function guessCompound(cyrillic: string): string | undefined {
  if (cyrillic.length < COMPOUND_MIN_LENGTH) return undefined;
  const known = (word: string): string | undefined =>
    lexiconIndex.get(word)?.[0]?.classical ?? harvestedIndex.get(word)?.[0]?.classical;
  for (let at = cyrillic.length - COMPOUND_MIN_TAIL; at >= COMPOUND_MIN_HEAD; at -= 1) {
    const head = known(cyrillic.slice(0, at));
    if (head === undefined) continue;
    const tail = known(cyrillic.slice(at));
    if (tail === undefined) continue;
    const folded = hasGalig(tail) ? tail : tail.replace(/o/g, 'u').replace(/ö/g, 'ü');
    return `${head.replace(/-/g, '')}${folded.replace(/^(\D)\d/, '$1')}`;
  }
  return undefined;
}

/**
 * Restore the vowel a word-final ч/ц/ж/ш/х carries in Classical but not in Cyrillic.
 *
 * Letter-by-letter transliteration ends these words on a bare ᠴ/ᠵ/ᠱ/ᠬ, and
 * **no native word is spelled that way**. Over the 2,460 harvested rows whose
 * Cyrillic ends in х/ц/ч/ж/ш, exactly 10 have a Classical form ending in a bare
 * q/k/č/ǰ/š/c, and all 10 are loanwords or letter names (амбиц, марш, перц,
 * польш, and the letters ж/х/ц/ш themselves). The guesser was emitting that
 * shape for 647 of the 41,220 corpus words — 1.6% of running text — including
 * every unknown verb in its dictionary form, since Cyrillic -х is the infinitive.
 *
 * Which vowel is not a guess either. Counting the same rows, minus the bare
 * ones:
 *
 *   -х  1751  qu 60%  qü 38%     → harmony picks u/ü; 98% together
 *   -ч   413  či 98%              → i
 *   -ц    98  ča 63%  če 32%      → harmony picks a/e; 95% together
 *   -ж   131  ǰi 73%  ǰu 18%      → i
 *   -ш    57  si 89%              → i, and the ᠱ becomes ᠰ (see below)
 *
 * ш is the odd one: Classical writes ᠰᠢ where Cyrillic writes ши, because `si`
 * is already read [ʃi], so the word ends `si` and not `ši`. Only the **final**
 * ш is repaired here. Medial ш looks like the same story — 570 of 710 native
 * rows with a ш spell it `s`, e.g. аашлах `aγasilaqu`, бишрэл `bisirel` — but
 * mapping ш → `si` throughout (absorbing a following и) was **tried and is
 * worse**: verb gold unchanged, the inflected set 1083 → 1082. The share is
 * real; what the naive rule misses is the epenthetic vowel that travels with it
 * (агшаа is `aγsiγ-a`, зөвшөөр is `ǰöbsiyere`), so it needs the contraction the
 * guesser deliberately does not attempt. Left as `š` until that is reviewed.
 *
 * This applies to a stem as readily as to a whole word: Classical stems end in
 * a vowel or in b/s/r/l/n/m/γ/g/d, never in one of these five.
 */
function closeOpenSyllable(out: string, lastCyrillic: string | undefined, front: boolean): string {
  switch (lastCyrillic) {
    case 'х':
      return `${out}${front ? 'ü' : 'u'}`;
    case 'ч':
    case 'ж':
      return `${out}i`;
    case 'ц':
      return `${out}${front ? 'e' : 'a'}`;
    case 'ш':
      return `${out.slice(0, -1)}si`;
    default:
      return out;
  }
}

/**
 * Cyrillic vowels that can be the "unstable" one, in rough order of how often
 * they turn up in that slot. Order only decides which reading is offered first
 * when a stem is ambiguous; ranking still picks.
 */
const UNSTABLE = [...'иоөуүаэы'];

/**
 * Stems to try when the peeled form ends in a consonant cluster.
 *
 * Cyrillic drops a stem's final unstable vowel before a vowel-initial suffix:
 * ажил + аас is written ажлаас, мэргэжил + ийн is мэргэжлийн, учир + аас is
 * учраас. Peeling the suffix therefore leaves ажл / мэргэжл / учр, which match
 * nothing, and the whole word falls through to the guesser — where it scores
 * about 2%. A bichig reader confirmed all eight sampled cases of this on
 * 2026-07-26, and it accounts for ~15% of the held-out gold set.
 *
 * The vowel is not predictable (ажил takes и, хамаг takes а, мөрөөдөл takes ө),
 * so this proposes every candidate and keeps only those the lexicon actually
 * knows. A restored form is never invented: if no insertion is attested, the
 * caller falls back to guessing on the cluster as written.
 */
function restoreUnstableVowel(cyrillic: string): string[] {
  if (cyrillic.length < 3) return [];
  const last = cyrillic[cyrillic.length - 1] as string;
  const prev = cyrillic[cyrillic.length - 2] as string;
  if (VOWELS.includes(last) || VOWELS.includes(prev)) return [];
  const head = cyrillic.slice(0, -1);
  return UNSTABLE.map((v) => `${head}${v}${last}`).filter(
    (candidate) =>
      lexiconIndex.has(candidate) || harvestedIndex.has(candidate) || toliIndex.has(candidate),
  );
}

/**
 * Stems to try when the peeled form ends in a linking **vowel + н** — жийрэг н.
 *
 * Cyrillic inserts an н the Classical stem does not have: хэл + д is written
 * хэлэнд, and the Classical is `kele-dü`, with no NA anywhere. Peeling only the
 * suffix leaves хэлэн, which matches nothing, so the word fell to the guesser
 * as `kelend` — reported by a bichig reader on 2026-07-27.
 *
 * The mirror case is real and must not be broken: for ус the Classical stem
 * genuinely ends in NA (`usun`), so усанд is `usun-du` and the н is not a
 * linking letter at all. Nothing in the Cyrillic distinguishes the two — it is
 * lexical. This is safe only because it runs **after both dictionaries have
 * missed**: усан is an attested row, so it is resolved long before reaching
 * here, while хэлэн is not. Placing the same rule in `segment.ts`, where no
 * dictionary is in scope, was measured on the same day and cost 1.2pp of top-1
 * by flattening exactly those attested forms.
 */
function dropLinkingN(cyrillic: string): string[] {
  if (cyrillic.length < 4) return [];
  if (cyrillic[cyrillic.length - 1] !== 'н') return [];
  const linkingVowel = cyrillic[cyrillic.length - 2] as string;
  if (!VOWELS.includes(linkingVowel)) return [];
  const stem = cyrillic.slice(0, -2);
  // Attested only. A stem this invents would be indistinguishable from a real
  // one downstream, which is the failure the whole propose-and-filter shape
  // exists to avoid.
  return lexiconIndex.has(stem) || harvestedIndex.has(stem) || toliIndex.has(stem) ? [stem] : [];
}

/**
 * Stems to try when the peeled form is an attested vowel-final word plus **г**
 * — the linking г, the third letter Cyrillic inserts that Classical does not
 * have.
 *
 * далай + аар is written далайгаар, and the Classical is `dalai-bar` with no
 * GA anywhere. The segmenter peels only `-аар`, leaving далайг, which matches
 * nothing — so the word instead took the reading далай + `-г` + `-аар`, reading
 * the linking letter as a **bare accusative** and emitting `dalai-yi-bar` with
 * a case suffix the word does not contain. Measured over the detached gold set
 * on 2026-08-10: 43 native forms, 2.67pp of top-1, the third-largest cluster
 * and the largest one needing neither the reader nor a wordlist.
 *
 * ⚠ This is safe only because it runs **after both dictionaries have missed**,
 * exactly as `dropLinkingN` is. A stem whose Classical genuinely ends in GA is
 * an attested row and is resolved long before reaching here; nothing in the
 * Cyrillic distinguishes the two, and it is lexical.
 *
 * Three conditions, each load-bearing:
 *   - the peeled suffix must be **vowel-initial**. The linking г exists to
 *     separate two vowels, so it cannot appear before a consonant-initial
 *     suffix, and requiring this keeps the rule away from every stem that
 *     simply ends in г (аймаг + `-д`).
 *   - the letter before the г must be a vowel, **й**, or **н**. й is not in
 *     `VOWELS` and н is not a vowel at all, so both are named separately here
 *     rather than folded into that string, where they would change every other
 *     rule in this file.
 *   - the restored stem must already be **attested**. A stem this invents
 *     would be indistinguishable from a real one downstream.
 *
 * ⚠ The н case covers two different underlying facts and needs no branch to
 * tell them apart, which is why it is folded in here rather than given its own
 * rule. For булан the Classical genuinely ends in NG — `bulung` — so булангийн
 * is the plain genitive on a stem whose Cyrillic simply spells that NG with a
 * г; for нян there is no NG at all (`niyan`) and the г is a linking letter like
 * the vowel case above. Both are right for the same reason the rest of this
 * function is: the restored key is looked up and its **attested** Classical is
 * used unchanged, so the data answers the question and no rule has to.
 * Reading the two as one rule is only safe because of that.
 */
function dropLinkingG(cyrillic: string, innermost: SuffixEntry | undefined): string[] {
  if (innermost === undefined) return [];
  const head = innermost.cyrillic[0];
  if (head === undefined || !isCyrillicVowel(head)) return [];
  if (cyrillic.length < 4) return [];
  if (cyrillic[cyrillic.length - 1] !== 'г') return [];
  const stem = cyrillic.slice(0, -1);
  const last = stem[stem.length - 1] as string;
  if (!VOWELS.includes(last) && last !== 'й' && last !== 'н') return [];
  return lexiconIndex.has(stem) ||
    attestedIndex.has(stem) ||
    harvestedIndex.has(stem) ||
    toliIndex.has(stem)
    ? [stem]
    : [];
}

/**
 * Stems to try when the peeled form is an attested vowel-final word plus **н**.
 *
 * The mirror image of `dropLinkingN`, and the case it cannot see. That function
 * strips a linking *vowel and* н, because it was written for хэл + э + н; a
 * stem that already ends in a vowel needs no linking vowel, so хэмжээнд peels
 * to хэмжээн and the two-letter strip overshoots to хэмжэ, which is nothing.
 * The word then fell to the guesser as `qemǰen`, where the reader gives
 * `qemǰiyen-dü` — one of the eleven defects in the 2026-08-06 batch.
 *
 * Restricted to rows that take the н, which is the claim being made: that the
 * letter is the stem's тогтворгүй н written out, and not a suffix's. Without
 * that filter this would quietly delete a final н from any attested-looking
 * prefix.
 */
function unstableNStems(cyrillic: string): string[] {
  // Stem of three letters or more. Two is where this stops being a reading and
  // starts being a coincidence: бананы peels to бана, the epenthesis rule below
  // offers бан, and a two-letter minimum let that resolve as ба + н, so a
  // banana became `ban-u` off two speculative steps stacked on each other.
  if (cyrillic.length < 4) return [];
  if (cyrillic[cyrillic.length - 1] !== 'н') return [];
  const stem = cyrillic.slice(0, -1);
  // ⚠ There was a `VOWELS.includes(last)` test on the **Cyrillic** stem here
  // until 2026-08-10, and it was the mistake `suffixes.ts` warns about in its
  // own header: the тогтворгүй н is a fact about the *Classical* form, and the
  // two sides disagree constantly. хувцас is Cyrillic consonant-final but
  // `qubčasu` is vowel-final and takes the н, so хувцаснаас was rejected here
  // and fell to the guesser as `qubčasn-ača` where the reader gives
  // `qubčasun-ača`. Same for хуудаснаас.
  //
  // The Classical-side test already exists and is strictly better:
  // `resolveStem` keeps only matches whose `hiddenN` is true, read off the
  // script via `takesUnstableN`.
  //
  // ⚠ One Cyrillic condition survives, and it is not the old one. A stem
  // ending in **й** is excluded, because Cyrillic й+н is the genitive of a
  // й-final stem and not a stem's н: without this, хоолойн resolves to the
  // whole-word `qoγulain`, which has no suffix and therefore beats the correct
  // хоолой + йн on the suffix penalty. Reader-ruled `qoγulai-yin` the same day
  // the rest of this function was widened, and хоолой ends in a vowel on the
  // Classical side too, so no `hiddenN` test can separate the two — only the
  // Cyrillic can say which н this is.
  if (stem.endsWith('й')) return [];
  return lexiconIndex.has(stem) || harvestedIndex.has(stem) || toliIndex.has(stem) ? [stem] : [];
}

/**
 * Stems to try when Cyrillic has absorbed the stem's soft sign into a suffix.
 *
 * A ь-final stem loses its ь in front of a vowel-initial suffix, and the vowel
 * that surfaces is и: сургууль + ийн is written сургуулийн, морь + ийн морийн,
 * дуурь + аас мориос. The segmenter peels only the suffix, leaving сургуул or
 * сургуули — neither of which is the lexicon key — so a stem we already hold,
 * and hold *correctly*, is thrown away and rebuilt by the guesser. Measured
 * 2026-08-07: guessed stems score 7.6% where lexicon ones score 83.7%, and the
 * perfect-stem oracle is 95.0% against 69.6% actual.
 *
 * Two shapes, because the и lands on either side of the peel:
 *   сургуулийн → peel `ийн` → сургуул  → append ь
 *   сургуулиас → peel `аас` → сургуули → the и *is* the ь, so replace it
 *
 * ⚠ **Attested only, and this is the whole design.** The first attempt at this
 * put both shapes in `segment.ts` as extra `stemForms`, unfiltered. Eval rose
 * 69.6% → 70.9% and the provenance diff showed 105 improvements and zero
 * regressions, so both gauges passed — and the change was still wrong. The
 * guesser romanizes a Cyrillic ь as `i`, so an invented `арслангь` becomes a
 * perfectly plausible `arslangγi`, and 485 corpus words changed *within* the
 * guess tier where no provenance check could see it: арслангийн went
 * `arslangγ-un` → `arslangγi-yin`, байшингийн `baišingγ-un` → `baišingγi-yin`,
 * which is further from the `baising-un` the tests already call right. An
 * aggregate can only see the rows that have a gold answer; these had none.
 */
function softSignStems(cyrillic: string, innermost: SuffixEntry | undefined): string[] {
  // ⚠ Only in front of a **vowel**-initial suffix, and this is load-bearing. The
  // ь survives a consonant-initial one — морь + д is морьд, сургууль + д
  // сургуульд — so nothing was absorbed and there is nothing to put back.
  // Without this gate the restoration fires on any peel at all, and хонь is a
  // real word: хоног parsed as хон + accusative г, resolved хон → хонь, and
  // gained a lexicon-tier `qoni-yi` that outranked the correct harvested
  // `qonuγ` (0.48 to 0.43). That version shipped, and the reader caught it on
  // the very next spot-check — хоногийн and хонгыг, both "Both wrong".
  // Attestation alone could not catch it: хонь IS attested. What is wrong is
  // the *environment*, which only the peeled suffix can tell us about.
  if (innermost === undefined) return [];
  const head = innermost.cyrillic[0];
  if (head === undefined) return [];
  if (cyrillic.length < MIN_SOFT_SIGN_STEM) return [];
  const last = cyrillic[cyrillic.length - 1] as string;

  // A stem-final **й** absorbed by a й-initial suffix. Cyrillic writes only one
  // й where the stem and the suffix would each contribute one, so хоолой + йн
  // is хоолойн and the peel leaves хооло, which is nothing. Reader-confirmed
  // three times over: хоолойн `qoγulai-yin` and заламгайн `ǰalmaγai-yin` in the
  // 2026-08-10 spot check, and the standing дэлхийн todo before them.
  //
  // Narrower than the soft-sign case below and safe for the same reason: it
  // fires only when the peeled suffix itself begins with й, appends exactly one
  // letter, and the result must already be attested. анги + йн is untouched,
  // because ангий is not a word.
  if (head === 'й') {
    if (!VOWELS.includes(last)) return [];
    return [`${cyrillic}й`].filter(
      (form) => lexiconIndex.has(form) || harvestedIndex.has(form) || toliIndex.has(form),
    );
  }

  if (!isCyrillicVowel(head)) return [];
  // Already soft, or already vowel-final — nothing was absorbed to restore.
  if (last === 'ь' || VOWELS.includes(last)) return [];
  // ⚠ Only the append. The mirror shape — a peel that *keeps* the и, so that
  // сургуулиас leaves сургуули and the и itself is the ь — was implemented and
  // reverted the same hour. It reads a final и as evidence of a soft sign, and
  // Mongolian verb stems end in и constantly: болиод is боль + the perfective
  // converb -иод, but the segmenter also offers боли + a dative, and once боли
  // resolves to the attested боль that noun reading acquires lexicon provenance
  // and beats the converb. It broke `болиод → boliγad`, a reader verdict in
  // test/rulings.test.ts. The two words it fixed (сургуулиас, мориос) do not buy
  // a rule that fires on every и-final verb stem in the language. Doing it
  // properly needs to know which suffix was peeled, which this stage cannot see.
  const proposals = [`${cyrillic}ь`, ...ABSORBED_FINAL_VOWELS.map((v) => `${cyrillic}${v}`)];
  return proposals.filter(
    (form) => lexiconIndex.has(form) || harvestedIndex.has(form) || toliIndex.has(form),
  );
}

/**
 * Shortest stem worth proposing a soft sign for. Below this the restoration is
 * a coincidence rather than a reading — the same reasoning as the three-letter
 * floor in `unstableNStems`.
 */
const MIN_SOFT_SIGN_STEM = 3;

/**
 * Stem-final vowels a vowel-initial suffix absorbs — **а and э only**.
 *
 * Not the full `UNSTABLE` set, and the restriction is the point. Every word
 * this recovers is a **chachlag** stem, where the Cyrillic final а/э is the
 * same letter as the Classical detached a/e: утга `udq-a`, хаалга `qaγalγ-a`,
 * найруулга `nairaγulγ-a`, орчуулга `orčiγulγ-a`. That is one class with one
 * spelling rule, not a general licence to append vowels.
 *
 * Widening it to all of `UNSTABLE` was tried and broke бананы → `banan-u`, a
 * standing regression guard: банан is not attested but банани is, so an и-append
 * manufactured a lexicon-tier reading of a word that never had one. и, ы, о, у
 * and their front pairs are ordinary stem vowels, and a consonant-final stem
 * followed by a vowel-initial suffix is the commonest shape in the language —
 * appending to it invents far more than it restores.
 */
const ABSORBED_FINAL_VOWELS = [...'аэ'];

/**
 * The base to try when the peeled form is a **ч-final noun plus the plural -д**.
 *
 * The plural of an agent or occupation noun is written -чид — сурагч, сурагчид;
 * судлаач, судлаачид — and before a case ending the и drops: сурагчдын,
 * төлөөлөгчдийн. In Classical the stem ends `či` and the plural is a bare `d`
 * fused onto it: `suruγčid`, `suruγčid-un`. Nothing here knew that. The whole
 * word read as the dative (`suruγči-du`, which сурагчид can also be), and the
 * oblique forms left сурагчд, which is nothing, so they went to the guesser as
 * `suraγčd-un`.
 *
 * Measured 2026-10-02 over 22,603 words of running text: 271 have this shape,
 * 258 on a base some tier attests, and where that base's Classical ends in
 * `či` the silver's form begins with base + `d` in 248. The pipeline had 37
 * of them right. One of the reader's standing todos is this rule and nothing
 * else — бүтээлчдээс `bütügelčid-eče`.
 *
 * Two conditions, both doing work:
 *   - the base must be **attested and end in `či`** in Classical. That is what
 *     says "a ч-final noun"; a guessed base would let this fire on anything.
 *   - the base must be **four letters or more**. Short ч-final nouns are not
 *     agents, and -ид on them is the dative: мөчид is `möče-dü`, "at the
 *     moment", and the one miss in the sample that is not a loanword.
 *
 * ⚠ сурагчид is genuinely two words — "the pupils" and "to the pupil" — and
 * this does not delete the second: the dative is still built by the ordinary
 * path and still ranked. This only makes the commoner reading exist.
 */
function agentPluralBase(cyrillic: string): string | undefined {
  const base = cyrillic.endsWith('чид')
    ? cyrillic.slice(0, -2)
    : cyrillic.endsWith('чд')
      ? cyrillic.slice(0, -1)
      : undefined;
  return base !== undefined && base.length >= MIN_AGENT_BASE ? base : undefined;
}

const MIN_AGENT_BASE = 4;

/**
 * Does this row carry a **тогтворгүй н** — an unstable final NA that the
 * citation form drops and an oblique form brings back?
 *
 * `hiddenN` on the row wins when it is set, either way. Only 13 rows set it and
 * none of the 30,000-odd harvested ones do, so what decides in practice is the
 * fallback: **a stem whose script form ends in a vowel takes the н.**
 *
 * That test is the reader's own working rule, given 2026-08-06 and described by
 * them as having exceptions but as always working day to day. It is a default,
 * not a law, which is why the explicit flag overrides in both directions — a
 * `hiddenN: false` row is how an exception gets recorded once one is confirmed.
 *
 * It has to be read off the **script**, not the romanization, and that is not a
 * formality here: `qemǰiy-e` ends in `e` after a chachlag connector and `daγu`
 * ends in a plain `u`, and only `finalLetter` treats those the same way.
 */
const takesUnstableN = (entry: LexiconEntry): boolean =>
  entry.hiddenN ?? endsInVowel(entry.classical);

/**
 * Classical readings of a Cyrillic stem: every lexicon entry for it, or a
 * single low-confidence guess when it isn't known.
 * Returns an empty array only when even the guess is unromanizable.
 */
/** The -тай³ + linking г + case rows of `suffixes.ts`: тайгаар, тэйгээ, тойг… */
const COMITATIVE_STACK = /^т[аоэө]йг/;

export function resolveStem(cyrillic: string, innermost?: SuffixEntry): StemMatch[] {
  // эмэгтэйгээ is эмэгтэй + г + ээ, not эмэг + тэйгээ; алтайг is the Altai in
  // the accusative, not ал with a comitative. Where the letters up to and
  // including -тай are a word some tier holds, that word is the stem and the
  // stacked row has no business with a shorter one — it would win on prior,
  // being a real stem with one suffix, and say something else entirely.
  if (innermost !== undefined && COMITATIVE_STACK.test(innermost.cyrillic)) {
    const word = cyrillic + innermost.cyrillic.slice(0, 3);
    if (lexiconIndex.has(word) || attestedIndex.has(word) || harvestedIndex.has(word)) return [];
  }
  const entries = lexiconIndex.get(cyrillic);
  if (entries !== undefined && entries.length > 0) {
    return entries.map((e) => ({
      classical: e.classical,
      gloss: e.gloss,
      prior: e.freq,
      provenance: 'lexicon' as const,
      hiddenN: takesUnstableN(e),
    }));
  }
  // The whole word as attested — asked here only when nothing was peeled, which
  // is what `innermost === undefined` means. An attested row is a statement
  // about one exact word, so it is not a stem at this height: `хэлэн` attested
  // would capture хэлэнд, the very failure that put `toli` last. It is asked
  // again as a stem at the bottom, after every real stem — see there.
  if (innermost === undefined) {
    const attested = attestedIndex.get(cyrillic);
    if (attested !== undefined && attested.length > 0) {
      return attested.map((classical, i) => ({
        classical,
        // A second reading is real (the source wrote both in running text) but
        // rarer; halving per rank keeps it visible without letting it win.
        prior: ATTESTED_PRIOR / 2 ** i,
        provenance: 'attested' as const,
      }));
    }
  }
  // Harvested rows are consulted only when the curated lexicon has nothing, so
  // a reviewed entry always wins outright rather than competing on prior.
  const harvested = harvestedIndex.get(cyrillic);
  if (harvested !== undefined && harvested.length > 0) {
    return harvested.map((e) => ({
      classical: e.classical,
      gloss: e.gloss,
      prior: HARVESTED_PRIOR,
      provenance: 'harvested' as const,
      hiddenN: takesUnstableN(e),
    }));
  }
  // Only now, with both dictionaries missed, consider that Cyrillic may have
  // dropped an unstable vowel. Restorations are attested forms by construction,
  // so they keep their own tier's provenance; the small discount records that
  // the surface did not say so outright.
  const lookupAttested = (form: string): StemMatch[] => {
    const curated = lexiconIndex.get(form);
    if (curated !== undefined && curated.length > 0) {
      return curated.map((e) => ({
        classical: e.classical,
        gloss: e.gloss,
        prior: e.freq * RESTORED_DISCOUNT,
        provenance: 'lexicon' as const,
        hiddenN: takesUnstableN(e),
      }));
    }
    const harvestedForm = harvestedIndex.get(form);
    if (harvestedForm !== undefined && harvestedForm.length > 0) {
      return harvestedForm.map((e) => ({
        classical: e.classical,
        gloss: e.gloss,
        prior: HARVESTED_PRIOR * RESTORED_DISCOUNT,
        provenance: 'harvested' as const,
        hiddenN: takesUnstableN(e),
      }));
    }
    return (toliIndex.get(form) ?? []).map((classical) => ({
      classical,
      prior: TOLI_PRIOR * RESTORED_DISCOUNT,
      provenance: 'toli' as const,
      hiddenN: takesUnstableN({ cyrillic: form, classical, freq: TOLI_PRIOR }),
    }));
  };

  const restored = restoreUnstableVowel(cyrillic).flatMap(lookupAttested);
  if (restored.length > 0) return restored;

  // The agent plural: an attested `či` stem with the plural `d` fused on. It
  // accounts for every letter of the Cyrillic, so like the н and г readings
  // below it short-circuits rather than being offered beside a guess. The н is
  // not this stem's to take — `suruγčid` ends in a consonant — hence the flag.
  const agentBase = agentPluralBase(cyrillic);
  if (agentBase !== undefined) {
    const plural = lookupAttested(agentBase)
      .filter((match) => /[cč]i$/.test(match.classical))
      .map((match) => ({ ...match, classical: `${match.classical}d`, hiddenN: false }));
    if (plural.length > 0) return plural;
  }

  // The stem's own soft sign, absorbed by a vowel-initial suffix. Ordered here
  // because it is the same kind of claim as the unstable vowel — a letter the
  // Cyrillic spelling moved rather than one either side invented — and, like
  // that path, it only ever returns forms the data already attests.
  //
  // ⚠ It does **not** return on its own. A restored stem is a different word
  // from the peel, so it may not take the suffix that was peeled: банан + ы is
  // `banan-u`, and банана is attested, but a chachlag stem cannot carry that
  // genitive — so returning банана alone left the segmentation with no
  // assembling candidate at all and the whole-word guess `banani` won at 1.00,
  // breaking a standing regression guard. Same lesson as `behindTheN` below,
  // which the file already records: a stem that assembles must not be hidden by
  // one that does not. So this joins the guess rather than replacing it, and
  // ranking decides between an attested-but-maybe-inapplicable stem and a
  // guessed-but-fitting one.
  const softened = softSignStems(cyrillic, innermost).flatMap(lookupAttested);

  // An attested vowel-final stem with its тогтворгүй н spelled out — хэмжээн.
  // This is the ONLY place the н is put back, and that is deliberate: here the
  // Cyrillic is fully accounted for, the stem is exactly what the word says
  // minus one letter, and the claim is only that the letter is the stem's.
  const spelledOut = unstableNStems(cyrillic)
    .flatMap(lookupAttested)
    .filter((match) => match.hiddenN === true)
    .map((match) => ({ ...match, classical: withUnstableN(match.classical) }));

  // Same shape, different Cyrillic insertion: a linking н rather than a dropped
  // vowel. Ordered after the unstable vowel because that case is far commoner.
  //
  // ⚠ The тогтворгүй н is **not** applied here, and adding it was tried and
  // reverted. This function's whole premise is that the н is a letter Cyrillic
  // inserted and Classical does not have, so putting one back contradicts the
  // reason it exists. It also fires on a two-letter strip, which is loose enough
  // to reach the wrong word: тахин became тахи + н, giving an n-final `taqan`
  // that the vowel-final reflexive of тахингаа cannot attach to, and биен
  // became би `bi` + н — the pronoun "I", handed an н it has never had.
  //
  // модонд and усанд still keep their н, which is the case this looked like it
  // was needed for; they get there without it.
  //
  // ⚠ Only under a peeled suffix. A linking н links a stem to something; on a
  // whole word there is nothing for it to link, and the final -ан/-эн is the
  // word's own — most often the modal converb. Asked there anyway, this gave
  // салан the bare noun сал `sal` at full harvested confidence, which also
  // held the verb gate shut on the converb `salun`. Found 2026-10-02 in the
  // held-out misses: өргөжүүлэн, хууран, салан, each written as its stem.
  const unlinked = innermost === undefined ? [] : dropLinkingN(cyrillic).flatMap(lookupAttested);

  // Both, not the first that hits. These are two readings of the same н and
  // they contradict each other, so this is the package's standing answer to
  // contradiction: offer both and let ranking decide.
  //
  // ⚠ An earlier version returned `spelledOut` alone when it matched, on the
  // reasoning that it is the narrower claim. That silently deleted the *other*
  // reading, and eight words regressed on the corpus diff: тахингаа had been
  // тах `taq-a` + the vowel-final reflexive, and intercepting тахи + н gave the
  // n-final `taqan`, which that reflexive cannot attach to — so the whole word
  // lost its reading and fell to the guesser. A stem that assembles must not be
  // hidden by one that does not.
  // The н readings still short-circuit: both of them fully account for the
  // Cyrillic, so a guess alongside them would only add noise. `softened` is the
  // one path that carries on to the guess, for the reason given where it is
  // built — the restored stem may not accept the suffix that was peeled.
  const behindTheN = [...spelledOut, ...unlinked];
  if (behindTheN.length > 0) return [...softened, ...behindTheN];

  // The linking г, same shape as the linking н above and the same placement
  // argument: after both dictionaries, before the guess. It fully accounts for
  // the Cyrillic, so like the н readings it short-circuits rather than being
  // offered alongside a guess.
  //
  // The one restoration that also asks the `attested` tier, and as a stem at
  // that. What stands before a linking г is a whole word by construction —
  // эмэгтэй in эмэгтэйгээ — which is exactly what an attested row is, so this
  // is its own claim and not the loose "maybe the rest is a suffix" of the
  // last-resort lookup below. Real stems first, then this, then `toli`.
  const unlinkedG = dropLinkingG(cyrillic, innermost).flatMap((stem): StemMatch[] => {
    const real = lookupAttested(stem);
    if (real.some((match) => match.provenance !== 'toli')) return real;
    const whole = (attestedIndex.get(stem) ?? []).map((classical, i) => ({
      classical,
      prior: (ATTESTED_STEM_PRIOR * RESTORED_DISCOUNT) / 2 ** i,
      provenance: 'attested' as const,
      hiddenN: false,
    }));
    return whole.length > 0 ? whole : real;
  });
  if (unlinkedG.length > 0) return [...softened, ...unlinkedG];

  // The bundled dictionary, asked LAST — after curated, after harvested, and
  // after every restoration rule above has had its say.
  //
  // ⚠ The placement is the whole design, not a detail. Asked where the
  // `harvested` lookup is, this returns early for any headword the source
  // happens to list and the restoration paths below it never run: the source
  // lists хэлэн as a headword, so хэлэнд resolved to `qeleng-dü` and never
  // reached `dropLinkingN`, which had been giving the reader's `kele-dü`. Two
  // of seven broken rulings were exactly that, and no prior can fix it,
  // because the competing reading was never constructed to be ranked.
  //
  // Down here the tier can only add readings where nothing else produced one,
  // which is the only claim this source is good enough to make.
  // An attested whole word used as a STEM — and only down here, after every
  // path that works from a real stem has had its say. The row was stored as a
  // word, so this is a weaker claim than the whole-word lookup at the top:
  // "the silver spells баттулга so, therefore баттулгад is that plus a
  // dative". It is asked before `toli` because a key held by both means the
  // silver disagreed with the dictionary about this very word, and the
  // whole-word answer has already gone the silver's way; the inflected
  // forms should not then go the other.
  //
  // ⚠ Same placement argument as `toli`, and the same failure if it moves up:
  // attested rows include inflected words (яваа, хэлэн), and one of those
  // consulted early would capture every longer word that starts with it.
  const attestedStem = innermost === undefined ? undefined : attestedIndex.get(cyrillic);
  if (attestedStem !== undefined && attestedStem.length > 0) {
    return [
      ...softened,
      ...attestedStem.map((classical, i) => ({
        classical,
        prior: ATTESTED_STEM_PRIOR / 2 ** i,
        provenance: 'attested' as const,
        hiddenN: takesUnstableN({ cyrillic, classical, freq: ATTESTED_STEM_PRIOR }),
      })),
    ];
  }

  const toli = toliIndex.get(cyrillic);
  if (toli !== undefined && toli.length > 0) {
    return [
      ...softened,
      ...toli.map((classical) => ({
        classical,
        prior: TOLI_PRIOR,
        provenance: 'toli' as const,
        hiddenN: takesUnstableN({ cyrillic, classical, freq: TOLI_PRIOR }),
      })),
    ];
  }

  // Two known words written as one, before the letter-by-letter guess: both
  // are guesses, and this is the better-informed of the two.
  const compound = guessCompound(cyrillic);
  if (compound !== undefined && isRomanizable(compound)) {
    return [
      ...softened,
      { classical: compound, prior: COMPOUND_GUESS_PRIOR, provenance: 'guess' as const },
    ];
  }

  const guess = guessStem(cyrillic);
  if (guess === '' || !isRomanizable(guess)) return softened;
  return [...softened, { classical: guess, prior: GUESS_PRIOR, provenance: 'guess' as const }];
}
