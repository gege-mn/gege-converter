/**
 * Load the **parallel corpus**: sentences a bichig reader wrote themselves, in
 * both scripts.
 *
 * ## Why this is a different kind of data from everything else here
 *
 * Every other source of truth in this project is either another converter or a
 * lemma list, and both distort in known ways. The harvest is Tungaamal output —
 * a real converter that disagrees with this project on documented points. The
 * 1,884-form inflected gold is built from a **lemma dictionary**, and that bias
 * is measurable rather than theoretical: 273 of its rows are the attached
 * -тай³ class and score 0.0%, because the only -тай words a lemma list carries
 * as headwords are the adjectival ones. `docs/roadmap.md` carries a ⚠ about
 * trusting that fixture, and this is the thing that answers it.
 *
 * Reader-written running text has neither distortion. It is ground truth, it is
 * frequency-weighted the way real prose is, and — unlike the review loop, which
 * costs a human's attention every single round — it can be scored again every
 * time the converter changes, for free, forever.
 *
 * ## ⚠ The corpus is private; what this file produces is not
 *
 * The sentences are somebody's writing and are **not** released. The boundary
 * is one line: **words and rules cross it, sentences never do.** A lexicon row
 * (нас → `nasu`) is a fact about Mongolian; a sentence is an article. So the
 * corpus lives outside this repository, is read from a path given at run time,
 * and nothing derived from it may be committed here except word-level rows and
 * rules. See `docs/parallel-corpus.md`.
 *
 * This loader deliberately has no "write" half. Nothing it returns should reach
 * `src/data/`, or the eval stops measuring anything.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Mongolian block, U+1800–U+18AF. Everything the script side may contain. */
const isMongolian = (cp) => cp >= 0x1800 && cp <= 0x18af;
const isCyrillic = (cp) => (cp >= 0x0400 && cp <= 0x04ff) || cp === 0x04e8 || cp === 0x04af;

/**
 * Characters that must never appear in text from the editor, with the reason.
 * These are cheap code-point checks, not a lint: gege-linter is a *sibling*
 * project and stage 8 takes it as an injected hook rather than an import, so
 * pulling it in here to validate a data file would be the wrong dependency.
 */
const FORBIDDEN = new Map([
  [0x202f, 'NNBSP (U+202F) — the legacy suffix connector; this project emits MVS'],
  [0x200d, 'ZWJ (U+200D) — a shaping hack, not orthography'],
  [0x200c, 'ZWNJ (U+200C) — a shaping hack, not orthography'],
]);
const isPua = (cp) => cp >= 0xe000 && cp <= 0xf8ff;

/**
 * Where to look, in order: an explicit path, then `$GEGE_CORPUS`, then the
 * sibling checkout. The sibling default matches how mongol-bichig and
 * gege-linter are already found — `~/Projects/<name>` — so a normal setup needs
 * no configuration at all.
 */
export function corpusRoot(explicit) {
  const candidates = [
    explicit,
    process.env.GEGE_CORPUS,
    resolve(process.cwd(), '..', 'gege-corpus'),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

/**
 * Split a batch file into sentence pairs.
 *
 * Pairs are separated by blank lines, `#` starts a comment, and **which line is
 * which is decided by the script it is written in, not by its position.** That
 * is not politeness: a batch is produced by pasting out of an editor two lines
 * at a time, transposing a pair is the obvious mistake, and detecting the
 * scripts turns a silent corruption of the gold set into a parse error.
 */
export function parsePairs(text, file) {
  const problems = [];
  const pairs = [];
  let block = [];
  let blockStart = 0;

  const flush = () => {
    if (block.length === 0) return;
    const cyrillic = block.filter((l) => l.script === 'cyrillic');
    const script = block.filter((l) => l.script === 'mongolian');
    const where = `${file}:${blockStart}`;
    if (block.length !== 2 || cyrillic.length !== 1 || script.length !== 1) {
      problems.push(
        `${where}: expected one Cyrillic line and one bichig line, got ${cyrillic.length} and ${script.length}`,
      );
    } else {
      pairs.push({ cyrillic: cyrillic[0].text, script: script[0].text, where });
    }
    block = [];
  };

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith('#')) continue;
    const cps = [...line].map((c) => c.codePointAt(0));
    const mongolian = cps.filter(isMongolian).length;
    const cyr = cps.filter(isCyrillic).length;
    if (block.length === 0) blockStart = i + 1;
    block.push({ text: line, script: mongolian > cyr ? 'mongolian' : 'cyrillic', line: i + 1 });
  }
  flush();
  return { pairs, problems };
}

/**
 * Encoding problems in a pair. **Not** an orthography check, and that
 * distinction is the point: the author is the authority on spelling, so where
 * their text disagrees with our conventions the finding is about *us*. What is
 * checked here is only what no correct text can contain — PUA, NNBSP, ZWJ —
 * which would mean the text did not come from the editor it was supposed to.
 */
export function encodingProblems({ script, where }) {
  const found = new Set();
  for (const ch of script) {
    const cp = ch.codePointAt(0);
    if (isPua(cp)) found.add(`${where}: Menksoft PUA at U+${cp.toString(16).toUpperCase()}`);
    const forbidden = FORBIDDEN.get(cp);
    if (forbidden) found.add(`${where}: ${forbidden}`);
  }
  return [...found];
}

/**
 * Stable 0–99 bucket for a sentence, from its Cyrillic alone (FNV-1a).
 *
 * Deterministic so a sentence keeps its side of the holdout split no matter
 * what order the files are read in or which batch it arrives in. If mining rows
 * out of the corpus ever starts, the eval half has to stay untouched or it
 * stops measuring — and a split that moves between runs cannot guarantee that.
 */
export function bucketOf(cyrillic) {
  let h = 0x811c9dc5;
  for (const ch of cyrillic) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

/** Every `.txt` batch under `root`, recursively, sorted for reproducibility. */
function batchFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.txt')) out.push(full);
    }
  };
  walk(root);
  return out;
}

/**
 * Load and validate the whole corpus.
 *
 * Returns `{ pairs, problems, files }`. Pairs carry their bucket so a caller
 * can hold part of it out; nothing is dropped here, because a loader that
 * silently discards data is how a corpus quietly stops covering what you think
 * it covers.
 */
export function loadCorpus(explicit) {
  const root = corpusRoot(explicit);
  if (root === undefined) return { root: undefined, pairs: [], problems: [], files: [] };

  const files = batchFiles(root);
  const pairs = [];
  const problems = [];
  for (const file of files) {
    const parsed = parsePairs(readFileSync(file, 'utf8'), file.replace(`${root}/`, ''));
    problems.push(...parsed.problems);
    for (const pair of parsed.pairs) {
      problems.push(...encodingProblems(pair));
      pairs.push({ ...pair, bucket: bucketOf(pair.cyrillic) });
    }
  }
  return { root, pairs, problems, files };
}
