/**
 * Word-align a Cyrillic sentence against its converted script, using the word
 * harvest as an alignment **constraint**.
 *
 * ## The problem this solves
 *
 * The reference converter does not preserve token count. It merges (миний л →
 * one token) and splits (аавгүй → two), a merge shifts every later token with
 * no error signal, and a merge plus a split in the same sentence leaves the
 * counts equal — so **token-count equality proves nothing and is not used as an
 * acceptance test anywhere in here**.
 *
 * The word harvest is an independent oracle for any token whose Cyrillic it
 * already contains, and it covers about 70% of the tokens in running text.
 * Those are fixed points. What is left is short spans between fixed points,
 * which is a tractable constrained-alignment problem rather than a guess.
 *
 * ## The three parts
 *
 * 1. `foldSuffixTokens` — the reference converter writes the genitive detached
 *    in *sentence* mode (stem SPACE suffix-with-FVS1) and MVS-connected in
 *    *word* mode, so the identical word is one token in the harvest and two in
 *    a sentence. `attachDetachedSuffix` (in `src/orthography.ts`, ruled on by a
 *    bichig reader 2026-07-27) folds them back; it has to be handed the pair,
 *    because it only looks inside one string. This alone moves 1,812 → 2,437
 *    of 4,000 sentences to equal token counts, and it is not a repair invented
 *    here — it makes the sentence agree with the harvest.
 * 2. `createAligner().align` — a DP over 1:1, merge, split and skip whose only
 *    reward is an oracle agreement. Merge and split are gated by closed classes
 *    derived from the canonical data (see below), never by a similarity score:
 *    a similarity score would have to be tuned, and a tuned aligner is one
 *    whose errors correlate with exactly the rare inflected forms this is meant
 *    to find.
 * 3. Forced extraction — forward and backward passes mark every transition that
 *    lies on *some* optimal path; a token is returned only when all of them
 *    agree. Where the anchors do not pin a span down, nothing is emitted. A
 *    merge or split we failed to model therefore costs recall, never precision.
 *
 * ## Grading is in script, never in romanization
 *
 * Every comparison in here is between normalised code-point strings. γ/g and
 * q/k are harmony-selected allographs of one letter, so comparing
 * romanizations invents disagreements (CLAUDE.md footgun 1).
 */

import { suffixRows, toScript } from '@gege-mn/mongol-bichig';

const ORTHOGRAPHY = new URL('../../dist/orthography.js', import.meta.url).href;
export const { attachDetachedSuffix, normalizeOrthography } = await import(ORTHOGRAPHY);

/**
 * Split on literal whitespace only. `\s` and `String.trim()` both match U+202F
 * NNBSP, which is the legacy suffix connector — using either here would rewrite
 * a connector into a word boundary and silently invent word pairs. See
 * `docs/harvest.md` trap 3.
 */
export const WS = /[ \n\r\t]+/;
export const trim = (s) => s.replace(/^[ \n\r\t]+|[ \n\r\t]+$/g, '');

/** Strip leading/trailing non-Cyrillic so punctuation does not enter the key. */
const CYRILLIC_EDGES = /^[^Ѐ-ӿ]+|[^Ѐ-ӿ]+$/g;
export const key = (word) => word.toLowerCase().replace(CYRILLIC_EDGES, '');

// --------------------------------------------------------------- op classes

/**
 * Cyrillic tokens that the previous word may swallow.
 *
 * The reference converter attaches enclitics and the plural to the head word
 * (юм даа → one token, миний л → one token), which is what the harvest does
 * too — it carries 5,395 multi-word Cyrillic keys. The set comes from
 * mongol-bichig's suffix registry rather than being written out here, so it
 * cannot drift from the canonical table. The three prefixes cover a registry
 * form carrying a further case suffix (нар → нарын, руу → руугаа); the
 * registry lists only the base.
 *
 * Only the categories that can stand as a **separate Cyrillic token after a
 * word** are taken. A case ending never can — nobody writes `ажил аас` — so
 * admitting the genitive/accusative/dative/ablative/instrumental/comitative
 * rows would let the aligner swallow a real word that happens to look like
 * one. `negation` is excluded for the sharper version of the same reason: үгүй
 * is a word, and `ügei` is the commonest member of the split-tail class below,
 * so a form the harvest writes as its own script token must stay its own
 * token. Without that filter the aligner produced `эсвэл үгүй` as one pair
 * reading `esebel`, which drops the negation entirely.
 *
 * `бүү` is dropped by hand and it is the only one: it is preverbal (бүү мартаарай),
 * so it heads its phrase and never follows.
 */
const MERGE_CATEGORIES = new Set([
  'particle',
  'question',
  'plural',
  'possession',
  'reflexive',
  'fused',
]);
const NEVER_MERGE = new Set(['бүү']);
const MERGEABLE = new Set();
for (const row of suffixRows) {
  if (!MERGE_CATEGORIES.has(row.category)) continue;
  for (const form of (row.cyrillic ?? '').split('/')) {
    const t = trim(form).replace(/^-/, '');
    if (t && !t.includes('?') && !NEVER_MERGE.has(t)) MERGEABLE.add(t);
  }
}
const MERGE_PREFIXES = ['нар', 'руу', 'рүү'];
const mergeable = (w) =>
  MERGEABLE.has(w) || MERGE_PREFIXES.some((p) => w.startsWith(p) && w.length <= p.length + 4);

/**
 * The script tokens that may follow a space *inside* one Cyrillic word,
 * derived from the harvest itself.
 *
 * Every token appearing after a space in the normalised script of a row whose
 * Cyrillic key is a single word is a case the harvest writes space-separated.
 * There are 65 of them across 32,070 rows and the tail is long, so only the
 * ones attested `min` times are kept — 20 at the default, headed by the
 * negation (`ügei`, 577 rows) and the collective (`kin`, 92).
 *
 * Deriving it from the harvest is the whole point. A pair emitted through a
 * split is space-joined exactly where the harvest space-joins it, so the two
 * sources cannot hand the model two spellings of one word. `kü` (энэхүү) is
 * *not* in the class, because the harvest does not write it detached — which
 * costs about 23 pairs and is the right trade.
 */
export function splitTailsFrom(harvestRows, min = 5) {
  const counts = new Map();
  for (const r of harvestRows) {
    if (!r.cyrillic || !r.unicode || r.cyrillic.includes(' ')) continue;
    const parts = normalizeOrthography(r.unicode).split(' ');
    for (let i = 1; i < parts.length; i += 1) {
      counts.set(parts[i], (counts.get(parts[i]) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, n]) => n >= min).map(([t]) => t));
}

// ------------------------------------------------------------- tokenisation

/**
 * Fold a detached case suffix back onto its stem across the token boundary.
 * Two tokens in, one out, iff the second is a bare registry suffix.
 */
export function foldSuffixTokens(tokens) {
  const out = [];
  for (const tok of tokens) {
    if (out.length > 0) {
      const merged = attachDetachedSuffix(`${out[out.length - 1]} ${tok}`);
      if (!merged.includes(' ')) {
        out[out.length - 1] = merged;
        continue;
      }
    }
    out.push(tok);
  }
  return out;
}

const MVS = '\u180E';
const DUMMY_STEM = toScript('bai');

/**
 * Is this script token a **stacked** detached suffix — a case particle written
 * free-standing that itself carries further material (accusative + reflexive,
 * genitive + the -х collective, accusative + the enclitic ла)?
 *
 * `foldSuffixTokens` folds a *bare* detached suffix back onto its stem, which
 * is the reader's 2026-07-27 ruling. It deliberately leaves the stacked ones
 * alone, exactly as `attachDetachedSuffix` leaves the detached dative alone:
 * extending the ruling to a form it was not asked about is the mistake
 * CLAUDE.md's fourth footgun is about. There are 178 of these in 37,519
 * sentence tokens.
 *
 * So they are not repaired — they are **quarantined**. A token like this means
 * the word before it is missing its own suffix, and any pair drawn from either
 * position is wrong in a way that looks right: it produced `илэрхийлж` (a verb)
 * paired with a bare reflexive. The test is a probe rather than a copy of the
 * suffix set: hand `attachDetachedSuffix` a dummy stem and the head of this
 * token, and see whether it merges.
 */
function stackedDetachedSuffix(tok) {
  const cut = tok.indexOf(MVS);
  if (cut <= 0) return false;
  return !attachDetachedSuffix(`${DUMMY_STEM} ${tok.slice(0, cut)}`).includes(' ');
}

/** One sentence row → `{ cyr, scr, keys }`, everything normalised. */
export function tokenise(row) {
  const cyr = trim(row.cyrillic ?? '')
    .split(WS)
    .filter(Boolean);
  const scr = foldSuffixTokens(
    trim(row.unicode ?? '')
      .split(WS)
      .filter(Boolean),
  ).map(normalizeOrthography);
  return { cyr, scr, keys: cyr.map(key) };
}

// ----------------------------------------------------------------- the DP

export const KIND = { MATCH: 0, MERGE: 1, SPLIT: 2, SKIP_C: 3, SKIP_S: 4 };

/**
 * Costs. Only an oracle *agreement* is rewarded; an oracle disagreement costs
 * nothing extra, because the reference converter genuinely renders some words
 * differently in context (вэ is one thing in a sentence and another alone) and
 * penalising that would push the search into inventing a merge to dodge it.
 * The DP therefore maximises confirmed anchors and, at equal anchor count,
 * prefers the fewest merges and splits — and a skip, which emits nothing, is
 * dearer than either.
 */
const ANCHOR = -10;
const SKIP = 4;

/**
 * A merge or a split is **free**, and that is the load-bearing choice here.
 *
 * Charging even 1 for them makes plain 1:1 the cheapest way through a span
 * whose token counts happen to balance — and a merge *plus* a split in one
 * span is exactly the case where the counts balance while every token in
 * between is shifted. Measured on `харсан ч хараагүй` → `qaraγsan-ču | qaraγ-a
 * | üγei`: with a cost of 1 the aligner reads it as three 1:1 pairs, two of
 * which are wrong, and reports them as forced because that path is uniquely
 * cheapest.
 *
 * At zero the two readings tie, the tie propagates into the forced-extraction
 * pass as a conflict, and the span produces nothing at all unless an anchor
 * breaks the tie. Ambiguity the oracle cannot resolve should look like
 * ambiguity, not like a preference. It cost 1.3% of the pairs and removed a
 * third of the leave-one-out errors.
 */
const OP = 0;

export function createAligner({ splittable, opCost = OP, skipCost = SKIP }) {
  /**
   * Every transition out of (i, j) as `[kind, cyrTaken, scrTaken, cost]`.
   * `seen(k)` is the oracle lookup, passed per-call so leave-one-out can hide
   * one anchor without rebuilding anything.
   */
  function moves(scr, keys, n, m, i, j, seen) {
    const out = [];
    const reward = (k, target) => (k && seen(k) === target ? ANCHOR : 0);
    if (i < n && j < m) out.push([KIND.MATCH, 1, 1, reward(keys[i], scr[j])]);
    if (i + 1 < n && j < m && mergeable(keys[i + 1])) {
      out.push([KIND.MERGE, 2, 1, opCost + reward(`${keys[i]} ${keys[i + 1]}`, scr[j])]);
    }
    if (i < n && j + 1 < m && splittable.has(scr[j + 1])) {
      out.push([KIND.SPLIT, 1, 2, opCost + reward(keys[i], `${scr[j]} ${scr[j + 1]}`)]);
    }
    if (i < n) out.push([KIND.SKIP_C, 1, 0, skipCost]);
    if (j < m) out.push([KIND.SKIP_S, 0, 1, skipCost]);
    return out;
  }

  /**
   * Align one sentence. Returns, per Cyrillic token index, the transition every
   * optimal path agrees on — or `undefined` where they do not agree, or where
   * the only agreement is that the token is skipped.
   */
  function align({ scr, keys }, seen) {
    const n = keys.length;
    const m = scr.length;
    const at = (i, j) => i * (m + 1) + j;

    const fwd = new Float64Array((n + 1) * (m + 1)).fill(Number.POSITIVE_INFINITY);
    fwd[at(0, 0)] = 0;
    for (let i = 0; i <= n; i += 1) {
      for (let j = 0; j <= m; j += 1) {
        const here = fwd[at(i, j)];
        if (!Number.isFinite(here)) continue;
        for (const [, dc, ds, cost] of moves(scr, keys, n, m, i, j, seen)) {
          const t = at(i + dc, j + ds);
          if (here + cost < fwd[t]) fwd[t] = here + cost;
        }
      }
    }

    const bwd = new Float64Array((n + 1) * (m + 1)).fill(Number.POSITIVE_INFINITY);
    bwd[at(n, m)] = 0;
    for (let i = n; i >= 0; i -= 1) {
      for (let j = m; j >= 0; j -= 1) {
        if (i === n && j === m) continue;
        let best = Number.POSITIVE_INFINITY;
        for (const [, dc, ds, cost] of moves(scr, keys, n, m, i, j, seen)) {
          const to = bwd[at(i + dc, j + ds)] + cost;
          if (to < best) best = to;
        }
        bwd[at(i, j)] = best;
      }
    }

    const optimum = fwd[at(n, m)];
    const assigned = new Array(n).fill(undefined);
    if (!Number.isFinite(optimum)) return assigned;

    // A transition lies on some optimal path iff it closes the optimum. Record
    // it against every Cyrillic token it covers; a token whose records are not
    // all identical is a token the anchors do not pin down.
    const conflict = new Array(n).fill(false);
    const label = new Array(n).fill(undefined);
    for (let i = 0; i <= n; i += 1) {
      for (let j = 0; j <= m; j += 1) {
        const here = fwd[at(i, j)];
        if (!Number.isFinite(here)) continue;
        for (const [kind, dc, ds, cost] of moves(scr, keys, n, m, i, j, seen)) {
          if (here + cost + bwd[at(i + dc, j + ds)] !== optimum) continue;
          const tag = kind === KIND.SKIP_C || kind === KIND.SKIP_S ? '-' : `${kind}|${i}|${j}`;
          for (let t = i; t < i + dc; t += 1) {
            if (conflict[t]) continue;
            if (label[t] === undefined) {
              label[t] = tag;
              assigned[t] = tag === '-' ? undefined : { kind, i, j, dc, ds };
            } else if (label[t] !== tag) {
              conflict[t] = true;
            }
          }
        }
      }
    }
    for (let t = 0; t < n; t += 1) if (conflict[t]) assigned[t] = undefined;

    // Quarantine, not repair: a stacked detached suffix means the word before
    // it is missing its own ending, so neither position can be read off.
    // Taking it as the tail of a split is the one case that is complete.
    for (let t = 0; t < n; t += 1) {
      const a = assigned[t];
      if (!a) continue;
      const startsOnSuffix = stackedDetachedSuffix(scr[a.j]);
      const next = a.j + a.ds;
      const strandedBefore = a.ds === 1 && next < m && stackedDetachedSuffix(scr[next]);
      if (startsOnSuffix || strandedBefore) assigned[t] = undefined;
    }
    return assigned;
  }

  return { align };
}

/** The Cyrillic key and script block a forced transition stands for. */
export function pairOf({ scr, keys }, a) {
  if (!a) return null;
  const ck = a.dc === 2 ? `${keys[a.i]} ${keys[a.i + 1]}` : keys[a.i];
  const tgt = a.ds === 2 ? `${scr[a.j]} ${scr[a.j + 1]}` : scr[a.j];
  if (!ck || !tgt) return null;
  return { cyrillic: ck, script: tgt, kind: a.kind };
}

/**
 * Length of the run of consecutive Cyrillic tokens around `t` that the oracle
 * does not know — the condition an emitted pair is actually in. Leave-one-out
 * hides a single anchor and therefore measures a token whose neighbours are
 * still anchors; bucketing by this makes the comparison honest.
 */
export function unknownRun(keys, t, seen) {
  let len = 1;
  for (let i = t - 1; i >= 0 && keys[i] && seen(keys[i]) === undefined; i -= 1) len += 1;
  for (let i = t + 1; i < keys.length && keys[i] && seen(keys[i]) === undefined; i += 1) len += 1;
  return len;
}
