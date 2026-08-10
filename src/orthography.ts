/**
 * Normalise imported bichig into this project's orthography.
 *
 * gege-linter's `applyFixes` already handles the *encoding* layer: the two
 * repurposed Ali Gali letters (U+1889 feminine g, U+1888 feminine k), NNBSP
 * suffix connectors, and redundant FVS selectors on suffix heads. What remains
 * are three *orthographic* differences, where the input is internally
 * consistent but follows an older convention than the one this project uses.
 *
 * The first two were confirmed against a bichig reader on 2026-07-26, and
 * `dropGlideYa` was verified mechanically: applied to the harvested
 * байгууллага it produces byte-for-byte the form the reader supplied
 * independently. The third was ruled on 2026-07-27. See
 * `test/normalize-orthography.test.ts`.
 */

import { suffixes } from './data/suffixes.js';
import { toScript } from './romanize.js';

/** Hudum vowels A E I O U OE UE EE, contiguous at U+1820–U+1827. */
const isVowel = (cp: number | undefined): boolean =>
  cp !== undefined && cp >= 0x1820 && cp <= 0x1827;

const YA = 0x1836;
const I = 0x1822;
/** MVS and NNBSP: either can end a stem and begin a suffix. */
const CONNECTORS: ReadonlySet<number> = new Set([0x180e, 0x202f, 0x0020]);

/**
 * Drop the glide YA from a medial i-diphthong: `V + YA + I` becomes `V + I`.
 *
 * Tungaamal writes сайн as `sayin` (the older Classical V+y+i); this project
 * writes `sain`, the modern analysis UTN #57 prefers. The rewrite is confined
 * to the **stem** — the material before the first connector — because the
 * genitive and accusative suffixes ᠶᠢᠨ/ᠶᠢ legitimately begin YA+I and must not
 * be touched. Stripping those would turn ᠬᠣᠲᠠ\u180Eᠶᠢᠨ into ᠬᠣᠲᠠ\u180Eᠢᠨ, which is not a
 * word.
 */
export function dropGlideYa(script: string): string {
  const cps = [...script].map((c) => c.codePointAt(0) ?? 0);
  const out: number[] = [];
  for (let i = 0; i < cps.length; i += 1) {
    const cp = cps[i] as number;
    // Once a connector is seen, everything after it is suffix material.
    if (CONNECTORS.has(cp)) {
      out.push(...cps.slice(i));
      break;
    }
    const prev = out[out.length - 1];
    if (cp === YA && cps[i + 1] === I && isVowel(prev)) continue;
    out.push(cp);
  }
  return String.fromCodePoint(...out);
}

/** Hudum O and OE — written only in a word's first syllable. */
const O = 0x1823;
const OE = 0x1825;
/** Their non-initial counterparts U and UE. */
const U = 0x1824;
const UE = 0x1826;

/**
 * Rewrite O/Ö past the first syllable to U/Ü.
 *
 * The rule is categorical in Mongol bichig: after the first syllable a
 * masculine word takes u and a feminine one ü. Tungaamal applies it almost
 * everywhere (ᠪᠣᠭᠤᠨᠢ, ᠣᠷᠤᠢ) but exempts ᠮᠣᠩᠭᠣᠯ, which this project does not.
 *
 * Loanwords are left alone: they keep their o (ᠹᠣᠲᠣ, ᠻᠢᠨᠣ), and a word is
 * treated as foreign when it contains a galig letter — the U+1838–U+1842 range
 * covers WA, FA, KA, KHA, TSA, ZA, HAA, ZRA, LHA, ZHI, CHI, which native Hudum
 * words never use. Genuine native exceptions like ᠭᠣᠣᠯ (doubled short o) are
 * NOT detectable this way and must be excluded by lexicon, not by rule, which
 * is why this returns the rewrite and its caller decides whether to trust it.
 */
const isGalig = (cp: number): boolean => cp >= 0x1838 && cp <= 0x1842;

export function foldNonInitialO(script: string): string {
  const cps = [...script].map((c) => c.codePointAt(0) ?? 0);
  if (cps.some(isGalig)) return script;
  const out: number[] = [];
  let seenVowel = false;

  for (let i = 0; i < cps.length; i += 1) {
    const cp = cps[i] as number;
    if (!isVowel(cp)) {
      out.push(cp);
      continue;
    }

    // A run of the SAME vowel is one long vowel occupying one syllable, so it
    // folds or does not fold as a unit. Deciding per code point would split
    // ᠭᠣᠣᠯ (γool, "river") across the boundary and rewrite only its second o,
    // producing ᠭᠣᠤᠯ — a word that does not exist. That is the documented
    // doubled-short-o exception, and it survives simply by being treated as
    // the single first syllable it is.
    let run = 1;
    while (cps[i + run] === cp) run += 1;

    const fold = seenVowel && (cp === O || cp === OE);
    const emit = fold ? (cp === O ? U : UE) : cp;
    for (let k = 0; k < run; k += 1) out.push(emit);

    seenVowel = true;
    i += run - 1;
  }
  return String.fromCodePoint(...out);
}

/** MVS — the connector this project writes between a stem and a case suffix. */
const MVS = '\u180E';
/** FVS1–4. Redundant once a suffix is MVS-connected: the connector selects. */
const SELECTORS = /[\u180B-\u180D\u180F]/g;

/**
 * The case suffixes the registry writes MVS-connected, as bare script.
 *
 * Derived from `suffixes.ts` rather than hand-listed so the two cannot drift:
 * `separate: true` IS the statement "this suffix is MVS-connected, not fused".
 * `toScript` emits these selector-free, which is what an attached suffix looks
 * like — the isolate FVS below is exactly the thing being removed.
 */
const SEPARATE_SUFFIXES: ReadonlySet<string> = new Set(
  suffixes.filter((s) => s.separate).map((s) => toScript(s.classical)),
);

/**
 * Re-attach a case suffix written as a free-standing word.
 *
 * Classical orthography has a real tradition of writing the case particles
 * detached — genitive ᠤ/ᠦ, accusative ᠢ, ablative ᠠᠴᠠ, reflexive ᠪᠠᠨ — with a
 * space and an FVS1 on the head letter to select its isolate form. Tungaamal
 * follows it: 580 harvested rows write the genitive as `ᠬᠠᠭᠠᠨ<SPACE>ᠤ<FVS1>`
 * and **none** write it MVS-connected. This project writes MVS, which is what
 * `separate: true` in the suffix registry means and what the pipeline's own
 * curated path already produces for хааны (`ᠬᠠᠭᠠᠨ<MVS>ᠤ`).
 *
 * Ruled by a bichig reader on 2026-07-27, on three genitives in a converted
 * article (бидний, хэмжээний, үндэсний): "it's just mvs + у (or ү)". The
 * reflexive and ablative were already ruled the same way on 2026-07-26 —
 * `test/rulings.test.ts` has толгойгоо → `toluγai-ban` and ажлаас →
 * `aǰil-ača`, both MVS.
 *
 * The rewrite is mechanical and was checked against the whole detached set:
 * dropping the selector and swapping the space for MVS reproduces `toScript`'s
 * output exactly, for every one of them.
 *
 * Suffixes stack — `ᠥᠪᠡᠷᠰᠡᠳ ᠢ ᠪᠡᠨ` is stem + accusative + reflexive — so this
 * folds from the right until it meets something that is not a case particle.
 * That guard is what leaves genuine compounds alone: ᠦᠭᠡᠢ (619 rows), ᠤᠯᠤᠰ,
 * ᠬᠡᠯᠡ and ᠮᠣᠳᠤ are words, not suffixes, and are not in the registry.
 *
 * Not handled, deliberately: the dative written `ᠳ<FVS1>ᠦᠷ` (133 rows). It is
 * detached *and* carries an -r the registry's `dü` does not, so attaching it
 * would smuggle a second, unruled change into this one.
 */
export function attachDetachedSuffix(script: string): string {
  if (!script.includes(' ')) return script;
  const parts = script.split(' ');

  let attached = '';
  let i = parts.length - 1;
  while (i > 0) {
    const bare = (parts[i] as string).replace(SELECTORS, '');
    if (!SEPARATE_SUFFIXES.has(bare)) break;
    attached = MVS + bare + attached;
    i -= 1;
  }

  if (!attached) return script;
  return parts.slice(0, i + 1).join(' ') + attached;
}

const QA = 'ᠬ';
const GA = 'ᠭ';
/** SA, SHA, TA, DA — the finals the harvest devoices a following ГА after. */
const DEVOICING_FINALS: ReadonlySet<string> = new Set(['ᠰ', 'ᠱ', 'ᠲ', 'ᠳ']);

/**
 * Undo the harvest's devoicing of ГА to ХА after с/ш/т/д.
 *
 * The harvest writes асгах as `asqaqu` (ᠠᠰᠬᠠᠬᠤ) and батга as `badq-a`,
 * putting ХА where the Cyrillic plainly has г — but салгах as `salγaqu`, with
 * ГА, because л is not one of these finals. That inconsistency looked like a
 * real devoicing rule and was never ruled on. It is not one: asked as six words
 * on 2026-07-29, the reader answered ГА to every one, including салгах, and
 * including the after-a-vowel control.
 *
 * **Needs the Cyrillic**, which is why it is not part of `normalizeOrthography`
 * and cannot be. ХА after с IS legitimate where the Cyrillic really has х —
 * амсхий `amusqi`, зайлсхий `ǰailasqi`, гүдэсхэн `γüdüsqen` — and nothing in
 * the script distinguishes those from the devoiced ones. A script-only rule
 * fixes 221 rows and breaks 16.
 *
 * Deliberately conservative: fires only when the Cyrillic has a с/ш/т/д + г
 * cluster and **no** с/ш/т/д + х cluster anywhere in the word. A word carrying
 * both is left alone rather than half-repaired, because the position of the
 * Cyrillic cluster is not aligned to the position of the Classical letter and
 * guessing which is which is how a plausible-looking wrong class ships.
 */
export function repairDevoicedGa(cyrillic: string, script: string): string {
  if (!/[сшдт]г/.test(cyrillic)) return script;
  if (/[сшдт]х/.test(cyrillic)) return script;

  const cp = [...script];
  for (let i = 1; i < cp.length; i += 1) {
    if (cp[i] === QA && DEVOICING_FINALS.has(cp[i - 1] as string)) cp[i] = GA;
  }
  return cp.join('');
}

/**
 * Full orthographic normalisation of one imported word.
 *
 * Encoding repair (`applyFixes` from gege-linter) must run FIRST — this
 * operates on standard Unicode and would not recognise the Ali Gali letters.
 *
 * `attachDetachedSuffix` runs first of the three so the later rules see this
 * project's connector convention: `dropGlideYa` stops at the first connector
 * and treats the rest as suffix material, which is only correct once the
 * suffix is actually connected.
 *
 * `repairDevoicedGa` is NOT part of this, because it needs the Cyrillic — see
 * its own comment. Callers that have the Cyrillic should apply it as well.
 */
export function normalizeOrthography(script: string): string {
  return foldNonInitialO(dropGlideYa(attachDetachedSuffix(script)));
}
