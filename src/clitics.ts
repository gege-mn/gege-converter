/**
 * Split a Cyrillic clitic that bichig writes as a separate word.
 *
 * Two classes live here, and they are the same shape: Cyrillic writes them
 * attached, bichig writes them as their own word joined by a plain space.
 *
 * - the **directive** -руу/-рүү/-луу/-лүү (`uruγu`), ruled 2026-07-30;
 * - the **negative** -гүй (`üγei`), ruled 2026-08-03.
 *
 * ## Why this is a stage and not a suffix row
 *
 * `suffixes.ts` deliberately excluded the directive -руу/-рүү, on the grounds
 * that it "has no clean Classical form". A bichig reader settled it on
 * 2026-07-30, and the answer is that the form is perfectly clean — it is just
 * not a suffix:
 *
 * > "in bichig, always separate, but in cyrillic, either is accepted.
 * > (руу рүү луу лүү, but always urugu regardless of gender of previous word)"
 *
 * Two consequences, and each rules out the suffix table on its own:
 *
 * 1. **It is a whole word, joined by a plain space.** `assemble` concatenates
 *    a suffix onto the stem with `-`, which `toScript` renders as MVS; there
 *    is no way to spell a space, and `toScript(' ')` throws outright. A
 *    suffix row could only ever produce `mongγul<MVS>uruγu`, which is the
 *    wrong character.
 * 2. **It does not harmonise.** Every other row in the suffix table selects
 *    an allomorph by the stem's vowel class. This one has a single Classical
 *    form for all four Cyrillic surfaces, so encoding it as a suffix would
 *    invite exactly the harmonised `urugü` that does not exist.
 *
 * So the split happens on the token stream instead, before anything looks a
 * word up, and the two halves then convert as ordinary independent words —
 * which is what the reader says they are.
 *
 * ## The gate, and the words it protects
 *
 * Real words end in these letters: буруу, хуруу, нуруу, яруу, тогоруу, эрүү,
 * цэврүү. Splitting on the ending alone would shred all of them. So a split
 * needs both halves to agree that it is one:
 *
 * - the **whole** word must NOT be known (no curated or harvested reading) —
 *   буруу is harvested as `buruγu`, so it is never touched; and
 * - the **remainder** must be known — монгол is curated, so монголруу splits.
 *
 * A guessed remainder is deliberately not enough. It would let an unknown
 * noun that merely ends in -руу be torn in half, and an unknown word converts
 * badly either way, so there is nothing to win and a real word to lose.
 *
 * ## The inserted space, and the invariant it breaks
 *
 * The space token carries `text: ' '` over an **empty span**
 * (`start === end`) at the split point. Tokens still tile the input
 * contiguously, so code-point offsets stay usable as gege-linter diagnostics
 * and as the /type pad caret.
 *
 * What it does break is `tokenize`'s round-trip — the one `tokenize.test.ts`
 * asserts, that concatenating every `text` reproduces the input. That is
 * deliberate and is the whole content of the ruling: bichig has a word
 * boundary here that Cyrillic does not write, so a stage that reproduced the
 * input exactly would be a stage that did nothing. The invariant still holds
 * where the test makes it, over `tokenize` itself; it is this stage that is
 * allowed to add a character, and only this one.
 */

import { normalizeWord } from './normalize.js';
import { resolveStem } from './stem.js';
import type { Token } from './types.js';

/**
 * Cyrillic surface forms of the directive (чиглэхийн тийн ялгал). All four
 * are `uruγu` in Classical; the lexicon rows carry that, not this module.
 *
 * `afterR` is the second half of the reader's ruling, 2026-07-30: **the л-
 * forms are used only when the host word ends in р**, and the р-forms only
 * when it does not.
 *
 *     гэр лүү / гэрлүү        нуур луу / нуурлуу      (host ends in р)
 *     айл руу / айлруу        цэрэг рүү / цэрэгрүү    (host does not)
 *
 * Which of the pair within each group is a matter of vowel harmony, and it
 * does not reach the output — all four are one bichig word. So harmony is
 * not checked here; the р is, because it is what makes the split safe.
 */
const CLITICS: ReadonlyArray<{ form: string; afterR: boolean }> = [
  { form: 'руу', afterR: false },
  { form: 'рүү', afterR: false },
  { form: 'луу', afterR: true },
  { form: 'лүү', afterR: true },
];

/**
 * The negative, ruled by a bichig reader on 2026-08-03.
 *
 * Asked of five stems chosen to span the range from "obviously two ideas" to
 * "surely one word by now" — мэдэхгүй, хэрэггүй, дургүй, үнэгүй, болоогүй —
 * the answer was **space, all five**. It is a rule, not a list. §2.3.1 calls
 * -гүй дагуулж and §2.3.7 says non-lexicalised ones are separated; what was
 * open was whether the connector is a space or MVS, and it is a space.
 *
 * Note the Cyrillic loses a letter the bichig keeps: -гүй is `üγei`, so the
 * emitted second word is **үгүй**, not the three letters that were peeled.
 *
 * ## Only half the directive's gate, and the sweep is why
 *
 * The directive requires the remainder to be attested too. Here that is wrong,
 * and measurably so. Swept over all 641 single-word harvest rows ending in
 * -гүй — 578 of which the reference writes as two words, 18 of which it fuses:
 *
 *     gate                              splits  wrong  recall
 *     whole unattested + host attested     274      0   47.5%
 *     whole unattested                     577      2  100.0%
 *
 * The two "wrong" are rows where the reference produced garbage rather than a
 * fusion — авгалдайнуудгүй came out `abaγaldai-nuγud taγ-a`, which contains no
 * `ügei` at all — so there is no attested fusion the wide gate breaks. Requiring
 * an attested host would cost чадахгүй, болоогүй and half the class for
 * nothing, and the reader ruled the rule universal, not lexical.
 *
 * **The fused class is held by the FIRST half of the gate alone**, because
 * every member of it is an attested row in its own right:
 *
 * - **-нгүй is a different suffix**, a fused adjective-former: бишрэнгүй
 *   `bisirenggüi`, хичээнгүй `kičiyenggüi`, энэрэнгүй, өршөөнгүй, хүлцэнгүй,
 *   цөхрөнгүй, эвлэрэнгүй, гэмшингүй, нигүүлсэнгүй, түүртэнгүй — all ten
 *   attested, all ten therefore untouched. Meanwhile эзэнгүй `eǰen ügei`, which
 *   ends in the same three letters and is *not* a -нгүй derivation, splits.
 * - **lexicalised fusions** — бүсгүй (woman), аягүй, эзгүй, буддагүй.
 * - **гүй itself** (to run) is below `MIN_HOST_LENGTH` with nothing left over.
 *
 * ⚠ **The residual, stated rather than hidden.** That protection is a property
 * of our data, not of the rule: an **unattested** -нгүй word would split, and
 * -нгүй is productive, so one exists that we have no row for. The sweep cannot
 * price it — every -нгүй word the harvest holds is attested. Excluding a bare
 * final н was measured and is not the answer either: it costs эзэнгүй and saves
 * nothing on this data. This is the next thing to ask the reader about, and the
 * honest reason to prefer a lexicon row for any -нгүй word that turns up.
 */
const NEGATIVE = { ending: 'гүй', word: 'үгүй' } as const;

/**
 * Shortest host we will split off. A one-letter host is never a noun phrase
 * taking a postposition, and it is where the gate actually leaks: яруу is
 * absent from every lexicon tier — it appears in the aligned pool as `iraγu`
 * and that pool has never been imported — while `я` is harvested, so the word
 * came apart as я + руу. Swept over 26,876 single-word types, 41 of which end
 * in a directive surface, this and the л/р rule together produce **no**
 * splits that should not happen.
 */
const MIN_HOST_LENGTH = 2;

/** A reading from an actual dictionary row, as opposed to a rule-based guess. */
const isAttested = (word: string): boolean =>
  resolveStem(word).some((m) => m.provenance !== 'guess');

/**
 * Rewrite a token stream so an attached directive becomes its own word.
 *
 * Returns the input array unchanged when nothing splits, which is the
 * overwhelmingly common case.
 */
export function splitClitics(tokens: readonly Token[]): Token[] {
  let split = false;
  const out: Token[] = [];

  for (const token of tokens) {
    const parts = token.kind === 'word' ? splitOne(token) : undefined;
    if (parts === undefined) {
      out.push(token);
      continue;
    }
    split = true;
    out.push(...parts);
  }

  return split ? out : [...tokens];
}

/** The three tokens an attached clitic becomes, or undefined to leave it alone. */
function splitOne(token: Token): Token[] | undefined {
  const normalized = normalizeWord(token.text);
  if (isAttested(normalized)) return undefined;

  for (const { form, afterR } of CLITICS) {
    if (!normalized.endsWith(form)) continue;
    const stem = normalized.slice(0, normalized.length - form.length);
    if (stem.length < MIN_HOST_LENGTH || !isAttested(stem)) continue;
    // The л/р rule. Cheap, and it rules out a whole class of bad splits:
    // монголлуу is not a spelling anyone writes, so it must not be read as
    // монгол + the directive.
    if (stem.endsWith('р') !== afterR) continue;
    return splitAt(token, stem.length);
  }

  if (normalized.endsWith(NEGATIVE.ending)) {
    // No attestation test on the host — see the sweep in the NEGATIVE comment.
    // The fused words are all attested whole and were rejected above.
    const host = normalized.slice(0, normalized.length - NEGATIVE.ending.length);
    if (host.length >= MIN_HOST_LENGTH) return splitAt(token, host.length, NEGATIVE.word);
  }

  return undefined;
}

/**
 * Cut `token` into host + space + clitic at `hostLength` code points.
 *
 * The host is sliced from the ORIGINAL text rather than the normalised one, so
 * the tokens still carry what the user typed; the two are code-point arrays of
 * equal length, because normalisation maps homoglyphs one-for-one and
 * lowercases.
 *
 * `word` overrides the second token's text for the case where Cyrillic and
 * bichig do not agree on how many letters the clitic has: -гүй is `üγei`, so
 * the token has to say **үгүй** for the lexicon to find it. That makes its
 * text longer than its own span — the same deliberate break as the space
 * token's empty span above, and for the same reason. Offsets still tile the
 * input, so they remain usable as gege-linter diagnostics and as the /type pad
 * caret; what they no longer support is reconstructing the input by
 * concatenation, which this stage already gave up.
 */
function splitAt(token: Token, hostLength: number, word?: string): Token[] {
  const cps = [...token.text];
  const boundary = token.start + hostLength;
  return [
    { kind: 'word', text: cps.slice(0, hostLength).join(''), start: token.start, end: boundary },
    { kind: 'space', text: ' ', start: boundary, end: boundary },
    {
      kind: 'word',
      text: word ?? cps.slice(hostLength).join(''),
      start: boundary,
      end: token.end,
    },
  ];
}
