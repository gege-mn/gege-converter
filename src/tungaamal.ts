/**
 * Tungaamal → Unicode: rewrite bichig typed in the Tungaamal convention into
 * the code points Unicode 16 / UTN #57 writes the same words with.
 *
 * **Self-contained on purpose.** This is bichig → bichig and has nothing to do
 * with the Cyrillic pipeline: it imports the shared script data and its own
 * table, and nothing from the eight stages. It is in this package because the
 * importers need it — `scripts/standardize-silver.mjs` is its one caller here —
 * and it can be lifted into a library of its own without touching anything
 * else.
 *
 * ## Why this is not a character map
 *
 * Tungaamal-convention text looks like Unicode with two odd letters. It is a different
 * convention all the way down — `data/tungaamal-rules.ts` has the model as
 * read out of the fonts — and three things follow that a letter-for-letter
 * swap gets wrong:
 *
 * 1. **Gender is typed, not shaped.** The writer chose ᠭ or its feminine twin
 *    by hand. Mapping both onto U+182D hands that choice to the font, which is
 *    right almost everywhere and wrong exactly where the word is mixed — a
 *    loanword or a compound name — so those places need a selector to keep the
 *    form the writer chose.
 * 2. **The one selector is a toggle.** `FVS1` after a letter means "the other
 *    form", and in six contexts the standard writes that other form with FVS2
 *    or FVS3. Leaving the selector alone silently changes the word's shape.
 * 3. **A suffix is marked by a selector, not by its connector.** The fonts do
 *    not shape after NNBSP, so `NNBSP + ᠤ + FVS1 + ᠨ` is how the genitive is
 *    made to look like one. After MVS the standard shapes it by itself and the
 *    selector has to go — and two times in three the suffix is not after an
 *    NNBSP at all but after a plain space, written as a word of its own.
 *
 * ## Two modes
 *
 * **Default — what the text means.** Letters, selectors and connectors are
 * rewritten so the standard draws the same forms; suffixes written as separate
 * words are joined with MVS and spelled the registry's way; and a slip the
 * Tungaamal fonts happen to show is *not* reproduced — a masculine ᠭ typed in
 * front of ᠡ is drawn masculine by those fonts, is a form Mongolian does not
 * have, and comes out as the plain letter the writer meant.
 *
 * **`faithful: true` — what the fonts drew.** Every form is kept exactly,
 * slips and font quirks included, and spaces stay spaces. This is the mode the
 * proof speaks about: over 9,686 real tokens it reproduces the Tungaamal convention
 * picture, written form for written form, on 9,662. Use it to convert an
 * archive without changing what any reader saw.
 *
 * ⚠ **Apply it once, to Tungaamal text.** It is not idempotent — the output
 * uses FVS1 in the standard's sense, which a second pass would read in
 * Tungaamal's — and correct Unicode run through it comes out damaged.
 * `detectTungaamal` says whether a text is in the convention at all.
 */

import { suffixes as registry, toScript } from '@gege-mn/mongol-bichig';
import {
  type LetterClass,
  type Place,
  type RunEdge,
  type Selector,
  shapingParticles,
  type TungaamalRule,
  tungaamalRules,
} from './data/tungaamal-rules.js';

const FVS1 = 0x180b;
const FVS2 = 0x180c;
const FVS3 = 0x180d;
const FVS4 = 0x180f;
const MVS = 0x180e;
const NNBSP = 0x202f;
const SPACE = 0x20;
const ZWJ = 0x200d;
const NIRUGU = 0x180a;
/** U+1806 TODO SOFT HYPHEN — Tungaamal's everyday hyphen, and how it hangs a suffix on a number. */
const SOFT_HYPHEN = 0x1806;
const I = 0x1822;
/** The two letters the Tungaamal convention adds, and the Hudum letter each one is. */
const FEMININE_K = 0x1888;
const FEMININE_G = 0x1889;
const QA = 0x182c;
const GA = 0x182d;

const isSelector = (c: number): boolean => c === FVS1 || c === FVS2 || c === FVS3 || c === FVS4;
const isLetter = (c: number): boolean => c >= 0x1820 && c <= 0x18aa;
/** ZWNJ is not here: it stops joining, so it ends a run like any other separator. */
const isJoiner = (c: number): boolean => c === ZWJ || c === NIRUGU;
const isDigit = (c: number): boolean => (c >= 0x1810 && c <= 0x1819) || (c >= 0x30 && c <= 0x39);
const hudum = (c: number): number => (c === FEMININE_K ? QA : c === FEMININE_G ? GA : c);
const isBlank = (c: number): boolean =>
  c === SPACE || c === NNBSP || c === MVS || c === 0x09 || c === 0x0a || c === 0x0d || c === 0xa0;
/** What a suffix written as its own word may lean on, besides a letter or a digit. */
const CLOSERS = new Set([
  0x29, 0x5d, 0x22, 0x27, 0x25, 0xbb, 0x2019, 0x201d, 0x203a, 0x3009, 0x300b,
]);

const MASCULINE = new Set([0x1820, 0x1823, 0x1824]);
const FEMININE = new Set([0x1821, 0x1825, 0x1826, 0x1827]);
const VOWELS = new Set([0x1820, 0x1821, 0x1822, 0x1823, 0x1824, 0x1825, 0x1826, 0x1827]);
const BOWED = new Set([0x182a, 0x182b, 0x1839, 0x183a, 0x183b]);
const isConsonant = (c: number): boolean =>
  (c >= 0x1828 && c <= 0x1842) || c === FEMININE_K || c === FEMININE_G;

const SELECTOR_NAME = new Map<number, Selector>([
  [FVS1, 'FVS1'],
  [FVS2, 'FVS2'],
  [FVS3, 'FVS3'],
]);
const SELECTOR_CP: Record<Selector, number | undefined> = {
  none: undefined,
  FVS1,
  FVS2,
  FVS3,
};

// ------------------------------------------------------------------- items

interface LetterItem {
  t: 'L';
  ch: number;
  /** Selectors typed after the letter. Tungaamal text has at most one, FVS1. */
  sel: number[];
  place: Place;
  prev: LetterItem | undefined;
  next: LetterItem | undefined;
  /** Position among the letters of its run. */
  index: number;
  run: LetterItem[];
  afterZwj: boolean;
  runAfter: RunEdge;
  runBefore: RunEdge;
  /** The letter after the MVS that follows the run. */
  afterMvsLetter: number | undefined;
  /** The table's `particle`: after a connector, and one of the shaping particles. */
  particle: boolean;
  /** Default mode: the run is a registry suffix or particle, spelled the registry's way. */
  suffix: boolean;
  /** On the first letter of such a run: the registry's spelling of the whole of it. */
  spelling?: number[];
}
interface OtherItem {
  t: 'S';
  ch: number;
  followedByLetter: boolean;
  /** Something stands right before it that a connector can attach to — not a blank, not the start. */
  attached: boolean;
  /** Default mode: what this separator is rewritten to, when not itself. */
  as?: number;
  /** Default mode: an MVS inside a suffix whose spelling is emitted whole. */
  drop?: boolean;
}
interface JoinerItem {
  t: 'J';
  ch: number;
}
type Item = LetterItem | OtherItem | JoinerItem;

const lettersOf = (script: string): string =>
  [...script].filter((c) => isLetter(c.codePointAt(0) ?? 0)).join('');

/** The shaping particles, as plain letter runs. */
const PARTICLES: ReadonlySet<string> = new Set(shapingParticles.map((p) => toScript(p)));

/**
 * Registry suffixes that are written after a connector, keyed by their letters.
 * The value is the canonical spelling — which for ᠯᠤᠭ⟨MVS⟩ᠠ carries an MVS of
 * its own, hence a string rather than "the key again".
 */
const CONNECTOR_SUFFIXES: ReadonlyMap<string, string> = new Map(
  registry.filter((s) => s.join === 'mvs').map((s) => [lettersOf(s.sequence), s.sequence]),
);
/** Registry words that take a plain space and must never be connector-joined. */
const SPACE_WORDS: ReadonlyMap<string, string> = new Map(
  registry.filter((s) => s.join === 'space').map((s) => [lettersOf(s.sequence), s.sequence]),
);
const codePoints = (text: string): number[] => [...text].map((c) => c.codePointAt(0) as number);

const runLetters = (run: readonly LetterItem[]): string =>
  String.fromCodePoint(...run.map((l) => hudum(l.ch)));

/**
 * Tungaamal text → items, with every fact a rule may ask about a letter.
 *
 * A run is a maximal sequence of letters and joiners; a space, NNBSP, MVS,
 * punctuation or the end of the text ends it. `place` is the letter's place in
 * its run, and a ZWJ or a nirugu beside a letter joins it on that side.
 */
function parse(text: string): Item[] {
  const items: Item[] = [];
  for (const char of text) {
    const c = char.codePointAt(0) as number;
    if (isSelector(c)) {
      const last = items[items.length - 1];
      if (last !== undefined && last.t === 'L') last.sel.push(c);
      else items.push({ t: 'S', ch: c, followedByLetter: false, attached: false });
      continue;
    }
    if (isLetter(c)) {
      items.push({
        t: 'L',
        ch: c,
        sel: [],
        place: 'isol',
        prev: undefined,
        next: undefined,
        index: 0,
        run: [],
        afterZwj: false,
        runAfter: 'start',
        runBefore: 'end',
        afterMvsLetter: undefined,
        particle: false,
        suffix: false,
      });
    } else if (isJoiner(c)) {
      items.push({ t: 'J', ch: c });
    } else {
      items.push({ t: 'S', ch: c, followedByLetter: false, attached: false });
    }
  }

  let run: (LetterItem | JoinerItem)[] = [];
  let before: RunEdge = 'start';
  const close = (after: RunEdge): void => {
    if (run.length === 0) return;
    const letters = run.filter((it): it is LetterItem => it.t === 'L');
    const particle = before === NNBSP && PARTICLES.has(runLetters(letters));
    const joins = (it: LetterItem | JoinerItem | undefined): boolean =>
      it !== undefined && (it.ch === ZWJ || it.ch === NIRUGU);
    letters.forEach((it, i) => {
      const at = run.indexOf(it);
      const left = i > 0 || joins(run[at - 1]);
      const right = i < letters.length - 1 || joins(run[at + 1]);
      it.place = left ? (right ? 'medi' : 'fina') : right ? 'init' : 'isol';
      it.prev = letters[i - 1];
      it.next = letters[i + 1];
      it.index = i;
      it.run = letters;
      it.afterZwj = i > 0 && run[at - 1]?.ch === ZWJ;
      it.runAfter = before;
      it.runBefore = after;
      it.particle = particle;
    });
    run = [];
  };
  items.forEach((it, i) => {
    if (it.t === 'S') {
      close(it.ch);
      before = it.ch;
      it.followedByLetter = items[i + 1]?.t === 'L';
      const prior = items[i - 1];
      it.attached = prior !== undefined && !(prior.t === 'S' && isBlank(prior.ch));
      return;
    }
    run.push(it);
  });
  close('end');

  // The letter that follows an MVS after a run — the separated a/e.
  items.forEach((it, i) => {
    if (it.t !== 'L' || it.runBefore !== MVS) return;
    let j = i;
    while (j < items.length && items[j]?.t !== 'S') j += 1;
    const after = items[j + 1];
    it.afterMvsLetter = after?.t === 'L' ? after.ch : undefined;
  });
  return items;
}

// -------------------------------------------------------------- conditions

const inClass = (c: number | undefined, name: LetterClass): boolean => {
  if (c === undefined) return name === 'end' || name === 'start';
  switch (name) {
    case 'start':
    case 'end':
      return false;
    case 'vowel':
      return VOWELS.has(c);
    case 'vowelNotI':
      return VOWELS.has(c) && c !== I;
    case 'masculineVowel':
      return MASCULINE.has(c);
    case 'feminineVowel':
      return FEMININE.has(c);
    case 'frontOrI':
      return FEMININE.has(c) || c === I;
    case 'bowed':
      return BOWED.has(c);
    case 'consonant':
      return isConsonant(c);
    default:
      return name === c;
  }
};
const anyOf = (c: number | undefined, list: readonly LetterClass[]): boolean =>
  list.some((name) => inClass(c, name));

const selectorOf = (it: LetterItem): Selector | 'other' => {
  if (it.sel.length === 0) return 'none';
  if (it.sel.length > 1) return 'other';
  return SELECTOR_NAME.get(it.sel[0] as number) ?? 'other';
};

/**
 * How the standard decides the gender of a q/gh that stands before a consonant
 * or at the end of a word — measured against Noto 3.002, not assumed. The
 * letter right before must be a vowel: a, o, u make it masculine; e, ö, ü, ē
 * feminine; i takes the gender of the nearest vowel before it that is not i,
 * and feminine when there is none. After a consonant, or first in the word, it
 * is feminine.
 */
function masculineBefore(it: LetterItem): boolean {
  const prev = it.run[it.index - 1]?.ch;
  if (prev === undefined) return false;
  if (MASCULINE.has(prev)) return true;
  if (prev !== I) return false;
  for (let i = it.index - 2; i >= 0; i -= 1) {
    const c = it.run[i]?.ch as number;
    if (MASCULINE.has(c)) return true;
    if (FEMININE.has(c)) return false;
  }
  return false;
}

/**
 * The Tungaamal convention draws the extra tooth of a medial ö/ü only right after one initial
 * consonant — not after ᠩ, and not after a y that carries FVS1.
 */
function tungaamalDrawsTooth(it: LetterItem): boolean {
  if (it.index !== 1 || it.prev === undefined) return false;
  const p = it.prev;
  if (!isConsonant(p.ch)) return false;
  if (p.ch === 0x1829) return false;
  if (p.ch === 0x1836 && p.sel.length > 0) return false;
  return true;
}

function holds(r: TungaamalRule, it: LetterItem): boolean {
  if (!r.letters.includes(it.ch)) return false;
  if (r.selector !== undefined && selectorOf(it) !== r.selector) return false;
  if (r.place !== undefined && !r.place.includes(it.place)) return false;
  if (r.next !== undefined && !anyOf(it.next?.ch, r.next)) return false;
  if (r.prev !== undefined && !anyOf(it.prev?.ch, r.prev)) return false;
  if (r.prevNot !== undefined && it.prev !== undefined && anyOf(it.prev.ch, r.prevNot)) {
    return false;
  }
  if (r.nextNot !== undefined && it.next !== undefined && anyOf(it.next.ch, r.nextNot)) {
    return false;
  }
  if (
    r.nextPlace !== undefined &&
    !(it.next !== undefined && r.nextPlace.includes(it.next.place))
  ) {
    return false;
  }
  if (
    r.prevPlace !== undefined &&
    !(it.prev !== undefined && r.prevPlace.includes(it.prev.place))
  ) {
    return false;
  }
  if (
    r.prevSelector !== undefined &&
    !(it.prev !== undefined && selectorOf(it.prev) === r.prevSelector)
  ) {
    return false;
  }
  if (
    r.nextSelector !== undefined &&
    !(it.next !== undefined && selectorOf(it.next) === r.nextSelector)
  ) {
    return false;
  }
  if (
    r.prevSelectorNotOn !== undefined &&
    it.prev !== undefined &&
    r.prevSelectorNotOn.includes(it.prev.ch) &&
    it.prev.sel.length > 0
  ) {
    return false;
  }
  if (r.prevPrev !== undefined && !anyOf(it.prev?.prev?.ch, r.prevPrev)) return false;
  if (r.sameAsNext === true && !(it.next !== undefined && it.next.ch === it.ch)) return false;
  if (r.afterZwj !== undefined && it.afterZwj !== r.afterZwj) return false;
  if (r.first !== undefined && (it.index === 0) !== r.first) return false;
  if (r.index !== undefined && it.index !== r.index) return false;
  if (r.minIndex !== undefined && it.index < r.minIndex) return false;
  if (r.runLength !== undefined && it.run.length !== r.runLength) return false;
  if (r.runAfter !== undefined && !r.runAfter.includes(it.runAfter)) return false;
  if (r.runAfterNot?.includes(it.runAfter) === true) return false;
  if (r.runBefore !== undefined && !r.runBefore.includes(it.runBefore)) return false;
  if (r.runBeforeNot?.includes(it.runBefore) === true) return false;
  if (
    r.afterMvsLetter !== undefined &&
    !(it.afterMvsLetter !== undefined && anyOf(it.afterMvsLetter, r.afterMvsLetter))
  ) {
    return false;
  }
  if (r.particle !== undefined && it.particle !== r.particle) return false;
  if (
    r.noVowelBefore !== undefined &&
    it.run.slice(0, it.index).some((x) => VOWELS.has(x.ch)) === r.noVowelBefore
  ) {
    return false;
  }
  if (r.tungaamalNoTooth !== undefined && tungaamalDrawsTooth(it) === r.tungaamalNoTooth) {
    return false;
  }
  if (r.masculineContext !== undefined && masculineBefore(it) !== r.masculineContext) return false;
  return true;
}

// --------------------------------------------------------- the default mode

/**
 * `tungaamal-defect` rows the default mode applies anyway, because what they
 * pin is the writer's choice and not a slip.
 *
 * **The feminine letter where the standard would draw the masculine form.**
 * Nobody types the feminine key by accident in front of ᠠ: these are loanwords
 * and compound names, where the bowl is the form the word is written with —
 * ᠫᠷᠣ + feminine g + ᠷᠠᠮᠮ (программ), the second half of a name like
 * Сайханбилэг. The silver's own output has the same shape and no
 * other: over 18,741 words it puts a feminine letter in a masculine place 21
 * times, every one a loanword or a compound.
 */
const CHOSEN_FEMININE: ReadonlySet<string> = new Set([
  'KE-1',
  'KE-2',
  'KE-3',
  'GE-1',
  'GE-2',
  'GE-3',
]);

/**
 * The mirror image: the masculine letter where the standard would draw the
 * feminine form because no masculine vowel stands right before it — ᠠᠩ + ᠭ +
 * ᠯᠢ (англи), the final ᠭ of агентлаг. Kept **only in a word that has a
 * masculine vowel before the letter**. In a word with none, a masculine ᠭ is a
 * slip — бичиг typed with the wrong key is the commonest error in real
 * Tungaamal text — and the plain letter is what was meant.
 */
const CHOSEN_MASCULINE: ReadonlySet<string> = new Set(['QA-2', 'GA-2', 'GA-3']);

const masculineVowelBefore = (it: LetterItem): boolean =>
  it.run.slice(0, it.index).some((x) => MASCULINE.has(x.ch));

/**
 * The one `encoding` row the default mode leaves out.
 *
 * ᠱ before ᠢ: the Tungaamal convention keeps the two dots, the standard leaves them out by
 * itself — `si` is already read [ʃi], which is the whole reason Classical
 * writes ᠰᠢ there — and it takes FVS2 to put them back. So the row is a true
 * equivalence, and applying it would be faithful. It is still not what the
 * text means: a bichig reader ruled the dotted letter "only for foreign, or
 * traditional spelt words" (docs/rulings.md, 2026-07-29), and Tungaamal text
 * types ᠱ for a Cyrillic ш whether the word is foreign or not. Pinning the dots
 * would turn every native жишээ into the spelling that ruling is against;
 * leaving the letter plain lets the standard do what it does. Faithful mode
 * keeps the dots, as it keeps everything.
 */
const FAITHFUL_ONLY: ReadonlySet<string> = new Set(['SHA-I']);

/** Does the default mode apply this row to this letter? */
function appliesByDefault(r: TungaamalRule, it: LetterItem): boolean {
  if (FAITHFUL_ONLY.has(r.id)) return false;
  if (r.kind !== 'tungaamal-defect') return true;
  if (CHOSEN_FEMININE.has(r.id)) return true;
  if (CHOSEN_MASCULINE.has(r.id)) return masculineVowelBefore(it);
  return false;
}

/**
 * Mark the suffixes: a registry suffix after NNBSP, after an MVS, or written as
 * a word of its own after a space. Sets `suffix` on the run's letters and `as`
 * on the separator before it.
 *
 * A suffix after a plain space is the Tungaamal convention norm, not an oddity — in real
 * pages a case particle follows U+0020 about twice as often as it follows an
 * NNBSP. To Unicode that is a second word; the suffix is written after MVS.
 *
 * The run has to BE the suffix, whole. ᠨᠡᠷ is the plural, and it is also the
 * first three letters of ᠨᠡᠷ⟨MVS⟩ᠡ "name", so a run that an MVS + a/e still
 * follows is a word with a detached vowel and is left alone — unless that is
 * exactly how the registry spells the suffix, as it does ᠯᠤᠭ⟨MVS⟩ᠠ.
 */
function markSuffixes(items: Item[]): void {
  // Right to left, because whether a run is a suffix can turn on the run after
  // it: in ᠭᠡᠷ ᠶᠢᠨ⟨MVS⟩ᠢᠶᠡᠨ the genitive is followed by an MVS that joins a
  // second suffix, not by its own detached vowel, and that is only known once
  // the reflexive has been recognised.
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const sep = items[i];
    if (sep === undefined || sep.t !== 'S') continue;
    // U+1806 is here for one construct: a suffix hung on a number or an
    // abbreviation (25 + U+1806 + ᠤ + FVS1, "25-ны"). Written as the word it
    // stands for would be, that is a suffix after MVS like any other — the
    // same reading `attached.ts` gives the Cyrillic hyphen. Between two words
    // the hyphen is a hyphen and is left alone, because what follows it there
    // is not a registry suffix.
    if (sep.ch !== NNBSP && sep.ch !== SPACE && sep.ch !== MVS && sep.ch !== SOFT_HYPHEN) {
      continue;
    }
    const first = items[i + 1];
    if (first === undefined || first.t !== 'L') continue;
    const before = items[i - 1];
    if (before === undefined) continue;
    // An NNBSP is a connector after anything it can lean on — a closing quote
    // and a digit as much as a letter. A space only after what a suffix
    // plausibly belongs to, and an MVS only inside a word.
    const leansOn =
      before.t === 'L' ||
      before.t === 'J' ||
      (before.t === 'S' &&
        sep.ch !== MVS &&
        (isDigit(before.ch) || CLOSERS.has(before.ch) || (sep.ch === NNBSP && sep.attached)));
    if (!leansOn) continue;

    const run = first.run;
    // A run with a joiner in it is an abbreviation or a stretched word, never
    // a suffix: ᠤ + ZWJ + ᠂ + ᠢ + ZWJ + ᠂ … is how УИХ is typed, and its first
    // letter alone spells the genitive. Left exactly as it is, separator and
    // all — "abbreviations are passed through" is a promise about these.
    let joined = false;
    for (let j = i + 1; items[j] !== undefined && items[j]?.t !== 'S'; j += 1) {
      if (items[j]?.t === 'J') joined = true;
    }
    if (joined) continue;
    let letters = runLetters(run);
    // The run is the whole word. False when an MVS and a detached vowel follow
    // that are not part of a registry spelling: ᠨᠡᠷ⟨MVS⟩ᠡ is "name".
    let whole = true;
    let tailSep: OtherItem | undefined;
    let tail: LetterItem | undefined;
    if (first.runBefore === MVS) {
      let j = i + 1;
      while (items[j] !== undefined && items[j]?.t !== 'S') j += 1;
      const mvs = items[j];
      const after = items[j + 1];
      const spelled =
        after?.t === 'L' && after.run.length === 1
          ? letters + String.fromCodePoint(hudum(after.ch))
          : undefined;
      if (spelled !== undefined && mvs?.t === 'S' && CONNECTOR_SUFFIXES.has(spelled)) {
        // The registry's own suffix typed with a detached vowel: luγ + MVS + a.
        letters = spelled;
        tailSep = mvs;
        tail = after as LetterItem;
      } else whole = false;
    }

    const word = whole ? SPACE_WORDS.get(letters) : undefined;
    if (word !== undefined) {
      // ᠤᠤ, ᠦᠭᠡᠢ and the rest are words: a space, never a connector. Marked so
      // they are spelled the registry's way too — the Tungaamal convention writes the
      // question particle with FVS1 on its first letter, like a suffix head.
      if (sep.ch === SOFT_HYPHEN) continue;
      if (sep.ch === NNBSP) sep.as = SPACE;
      if (sep.ch !== MVS) {
        for (const letter of run) letter.suffix = true;
        first.spelling = codePoints(word);
      }
      continue;
    }
    const canonical = whole ? CONNECTOR_SUFFIXES.get(letters) : undefined;
    if (canonical === undefined) {
      // NNBSP before something that is no suffix: still the legacy connector,
      // and MVS is what replaced it. A space or an MVS stays what it is.
      if (sep.ch === NNBSP) sep.as = MVS;
      continue;
    }
    // A source MVS already joins; a lone a/e after it is a chachlag, not a suffix.
    if (sep.ch === MVS && run.length === 1 && (run[0]?.ch === 0x1820 || run[0]?.ch === 0x1821)) {
      continue;
    }
    sep.as = MVS;
    for (const letter of run) letter.suffix = true;
    // The registry's spelling, whole — its own MVS included, so ᠯᠤᠭᠠ typed
    // joined and ᠯᠤᠭ⟨MVS⟩ᠠ typed apart both come out the one way.
    first.spelling = codePoints(canonical);
    if (tailSep !== undefined && tail !== undefined) {
      tailSep.drop = true;
      tail.suffix = true;
    }
    if (sep.ch === MVS && before.t === 'L') {
      // An MVS that was already joining a suffix. To the table, "the run is
      // followed by MVS" means a detached a/e comes next, and a stem-final
      // letter is drawn specially in front of one; in front of a suffix it is
      // an ordinary final, exactly as before the NNBSP this MVS stands in for.
      for (const letter of before.run) {
        letter.runBefore = NNBSP;
        letter.afterMvsLetter = undefined;
      }
    }
  }
}

/**
 * A selector typed twice is one selector. FVS1 is a toggle in the Tungaamal convention, but
 * its fonts do not toggle back on the second — they draw an error mark — so
 * ᠳ + FVS1 + FVS1 is a double keystroke, found on eight of the fourteen hosts
 * surveyed, and never a way of writing the plain letter.
 */
function collapseRepeatedSelectors(items: Item[]): void {
  for (const it of items) {
    if (it.t !== 'L' || it.sel.length < 2) continue;
    if (it.sel.every((c) => c === it.sel[0])) it.sel = [it.sel[0] as number];
  }
}

// ------------------------------------------------------------------ rewrite

export interface TungaamalOptions {
  /**
   * Keep every written form exactly as the Tungaamal fonts drew it, slips and
   * font quirks included, and leave spaces as spaces. Default `false`: write
   * what the text means. See the module comment.
   */
  faithful?: boolean;
}

export interface TungaamalRewrite {
  /** The text, in Unicode. */
  text: string;
  /**
   * The id of every table row that fired, in text order, plus `SEP-NNBSP`,
   * `SEP-ZWJ`, `JOIN-SUFFIX` (a suffix after a space joined with MVS),
   * `SUFFIX` (a connector-joined suffix spelled the registry's way) and
   * `UNRULED:…` for a selector no row speaks of, which is kept as typed.
   */
  applied: string[];
}

/**
 * Rewrite Tungaamal text and report which rules fired. The
 * reporting twin of `tungaamalToUnicode`.
 */
export function rewriteTungaamal(text: string, options: TungaamalOptions = {}): TungaamalRewrite {
  const faithful = options.faithful === true;
  const items = parse(text);
  if (!faithful) {
    collapseRepeatedSelectors(items);
    markSuffixes(items);
  }
  const applied: string[] = [];
  const out: number[] = [];

  items.forEach((it, i) => {
    if (it.t === 'S') {
      if (faithful) {
        // Wherever the table reads a run as "after NNBSP" the connector has to
        // become the MVS its rows assume — after a closing quote or a digit too.
        if (it.ch === NNBSP && it.followedByLetter && it.attached) {
          out.push(MVS);
          applied.push('SEP-NNBSP');
        } else out.push(it.ch);
        return;
      }
      if (it.drop === true) return;
      if (it.as === undefined) {
        // An NNBSP that joins nothing — at a line end, doubled — is not a
        // connector and has no MVS reading; left for a person.
        out.push(it.ch);
        return;
      }
      out.push(it.as);
      if (it.ch === NNBSP) applied.push('SEP-NNBSP');
      else if (it.ch === SPACE || it.ch === SOFT_HYPHEN) applied.push('JOIN-SUFFIX');
      return;
    }
    if (it.t === 'J') {
      const between = it.ch === ZWJ && items[i - 1]?.t === 'L' && items[i + 1]?.t === 'L';
      if (between) applied.push('SEP-ZWJ');
      else out.push(it.ch);
      return;
    }

    if (it.suffix) {
      // Spelled the registry's way, emitted whole at the first letter: plain
      // letters, no selector. After MVS the standard draws the suffix form by
      // itself, and a selector left inside a particle stops it from doing so.
      if (it.spelling !== undefined) {
        applied.push('SUFFIX');
        out.push(...it.spelling);
      }
      return;
    }

    const rule = tungaamalRules.find((r) => holds(r, it) && (faithful || appliesByDefault(r, it)));
    if (rule === undefined) {
      if (it.sel.length > 0) {
        applied.push(`UNRULED:U+${it.ch.toString(16).toUpperCase()}+${selectorOf(it)}@${it.place}`);
      }
      // A letter outside every rule is still one of the two extra letters
      // sometimes — with a selector the table has no row for.
      out.push(hudum(it.ch), ...it.sel);
      return;
    }
    applied.push(rule.id);
    if (rule.out.delete === true) return;
    out.push(rule.out.letter ?? it.ch);
    const selector = SELECTOR_CP[rule.out.selector ?? 'none'];
    if (selector !== undefined) out.push(selector);
  });

  // In pieces: one spread over a long page's code points overflows the stack.
  let rewritten = '';
  for (let at = 0; at < out.length; at += 8192) {
    rewritten += String.fromCodePoint(...out.slice(at, at + 8192));
  }
  return { text: rewritten, applied };
}

/**
 * Tungaamal-convention bichig → Unicode. Everything that is not Mongolian
 * script passes through untouched.
 */
export function tungaamalToUnicode(text: string, options: TungaamalOptions = {}): string {
  return rewriteTungaamal(text, options).text;
}

export interface TungaamalDetection {
  /** Hudum letters in the text. */
  letters: number;
  /** U+1888 and U+1889 — the convention's own two letters, and its fingerprint. */
  feminineLetters: number;
  /** A suffix head marked with FVS1 after a space or an NNBSP. */
  markedSuffixes: number;
  /** NNBSP between two Mongolian letters. */
  legacyConnectors: number;
  /** FVS2 or FVS3 — which Tungaamal fonts draw as an error mark, so evidence AGAINST. */
  otherSelectors: number;
  /** Whether the text reads as Tungaamal-convention. */
  likely: boolean;
}

/**
 * Is this text in the Tungaamal convention? Counted, not guessed.
 *
 * The fingerprint is the two extra letters: they are Ali Gali code points that
 * ordinary Hudum text never contains, and Tungaamal text carries about forty
 * per thousand letters. The marked suffix is the second sign and is enough on
 * its own in a short text with no feminine k or g at all. FVS2 and FVS3 are evidence
 * the other way: the Tungaamal fonts draw them as an error mark, so text that
 * uses them was not typed for those fonts.
 *
 * A page can mix conventions — a site's chrome typed one way and its articles
 * another — so ask this of a paragraph, not of a document.
 */
const MARKED_SUFFIX_ALONE_BELOW = 200;

export function detectTungaamal(text: string): TungaamalDetection {
  const cps = [...text].map((c) => c.codePointAt(0) as number);
  const evidence: TungaamalDetection = {
    letters: 0,
    feminineLetters: 0,
    markedSuffixes: 0,
    legacyConnectors: 0,
    otherSelectors: 0,
    likely: false,
  };
  const HEADS = new Set([0x1820, 0x1822, 0x1824, 0x1826, 0x1833, 0x1836]);
  cps.forEach((c, i) => {
    if (c === FEMININE_K || c === FEMININE_G) evidence.feminineLetters += 1;
    if (c >= 0x1820 && c <= 0x1842) evidence.letters += 1;
    if (c === FVS2 || c === FVS3) evidence.otherSelectors += 1;
    const next = cps[i + 1];
    const prev = cps[i - 1];
    if (c === NNBSP && prev !== undefined && next !== undefined) {
      if ((isLetter(prev) || isSelector(prev)) && isLetter(next)) evidence.legacyConnectors += 1;
    }
    if ((c === NNBSP || c === SPACE) && next !== undefined && HEADS.has(next)) {
      if (cps[i + 2] === FVS1) evidence.markedSuffixes += 1;
    }
  });
  const total = evidence.letters + evidence.feminineLetters;
  // The marked suffix decides only a short text. Past a couple of hundred
  // letters, Tungaamal text with not one feminine k or g does not happen —
  // forty per thousand are expected — and what does look like that is this
  // module's own faithful output, which keeps a space-written suffix as typed.
  evidence.likely =
    total > 0 &&
    evidence.otherSelectors * 4 <= evidence.feminineLetters + evidence.markedSuffixes &&
    (evidence.feminineLetters * 1000 >= total ||
      (evidence.markedSuffixes * 200 >= total && total < MARKED_SUFFIX_ALONE_BELOW));
  return evidence;
}

/**
 * Is this text typed in the Tungaamal convention? The yes-or-no of
 * `detectTungaamal`, for the one decision most callers have to make: whether
 * to run `tungaamalToUnicode` on a text at all.
 */
export const isTungaamal = (text: string): boolean => detectTungaamal(text).likely;
