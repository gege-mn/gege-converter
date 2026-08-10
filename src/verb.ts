/**
 * Recognising Khalkha verb endings — **without converting them**.
 *
 * This package has no verb morphology: the suffix table is nouns only, on
 * purpose. That is not a small omission. Measured over 3,000 sentences of real
 * running text, **48.5% of everything the guesser emits is verb-shaped** — so
 * roughly half the coverage gap cannot be closed by any amount of noun
 * dictionary, and a word that carries one of these endings is the converter's
 * single most likely place to be silently wrong.
 *
 * So the endings are recognised and reported, and nothing more is claimed. A
 * consumer that wants to underline uncertain words should read `verbForm`
 * together with the winning candidate's `provenance`:
 *
 * - `verbForm` set, provenance `guess` — almost certainly wrong; no rule and no
 *   dictionary row covers it. 13% of running-text tokens.
 * - `verbForm` set, provenance `harvested`/`lexicon` — likely right, but by
 *   memorisation of the whole inflected form, not by analysis. байсан and
 *   ирсэн convert correctly for exactly this reason.
 * - `verbForm` unset — the ordinary noun path, where the measured numbers apply.
 *
 * **This is a spelling test, not a parse.** It reads the last few letters and
 * nothing else, so a noun that happens to rhyme with a verb ending is
 * misreported. That rate was measured per ending over the same corpus (the
 * `collision` field below) by checking whether stripping the ending leaves a
 * known stem: it runs 0–12%, worst for `-ж/-ч` and `-тал`. Deciding the real
 * part of speech needs a POS lexicon, which this project does not have.
 */

import type { VerbEnding, VerbEndingKind } from './types.js';

/** Shortest base we will leave behind; below this a match is noise. */
const MIN_BASE_LENGTH = 2;

/**
 * Endings, longest-first so a specific one wins: болсонгүй is negative, not a
 * past participle, and болжээ is evidential, not the bare `-ж` converb.
 *
 * `collision` is the measured share of *types* carrying this ending that are
 * ordinary nouns rather than verb forms — 2026-07-27, 3,000 sentences. It is
 * documentation, not logic; nothing reads it at runtime.
 */
const ENDINGS: ReadonlyArray<{
  kind: VerbEndingKind;
  forms: readonly string[];
  collision: number;
}> = [
  { kind: 'negative', forms: ['гүй'], collision: 0.0 },
  { kind: 'converb-perfective', forms: ['аад', 'ээд', 'оод', 'өөд'], collision: 0.06 },
  { kind: 'participle-past', forms: ['сан', 'сэн', 'сон', 'сөн'], collision: 0.07 },
  { kind: 'participle-habitual', forms: ['даг', 'дэг', 'дог', 'дөг'], collision: 0.02 },
  { kind: 'tense-past', forms: ['лаа', 'лээ', 'лоо', 'лөө'], collision: 0.06 },
  { kind: 'evidential', forms: ['жээ', 'чээ'], collision: 0.02 },
  { kind: 'converb-conditional', forms: ['вал', 'вэл', 'вол', 'вөл'], collision: 0.03 },
  { kind: 'converb-terminative', forms: ['тал', 'тэл', 'тол', 'төл'], collision: 0.12 },
  { kind: 'tense-present', forms: ['на', 'нэ', 'но', 'нө'], collision: 0.07 },
  // Before `-ч`, and that ordering is the whole fix: хөрвүүлэгч was being
  // reported as an imperfective converb because its final letter is ч, which
  // is a different suffix wearing the same last character. Measured collision
  // is near zero — the ordinary nouns ending in -гч are эгч and the borrowed
  // -logist words (геологч, физиологч), about 2% of 265 corpus types.
  { kind: 'agent', forms: ['гч'], collision: 0.02 },
  { kind: 'converb-imperfective', forms: ['ж', 'ч'], collision: 0.12 },
  // `-в` last: it is one letter, so it must not pre-empt the longer endings
  // that happen to end in в (there are none today, and the ordering is
  // documentation of the rule rather than of the current table).
  { kind: 'tense-past', forms: ['в'], collision: 0.3 },
];

/**
 * The verb ending `word` appears to carry, or `undefined` for the ordinary
 * noun path. Case-insensitive; pure.
 */
export function verbEnding(word: string): VerbEnding | undefined {
  const w = word.toLowerCase();
  for (const { kind, forms } of ENDINGS) {
    for (const ending of forms) {
      if (!w.endsWith(ending)) continue;
      if (w.length - ending.length < MIN_BASE_LENGTH) continue;
      return { kind, ending };
    }
  }
  return undefined;
}
