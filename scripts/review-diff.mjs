#!/usr/bin/env node
/**
 * The review loop, in one command.
 *
 *   node scripts/review-diff.mjs [--base HEAD] [--n 14] [--open]
 *
 * ## Why this exists
 *
 * CLAUDE.md has mandated "dump the corpus before and after, then build the
 * spotcheck" since the loop found the unstable vowel, and nothing implemented
 * it. Doing it by hand on 2026-07-29 meant backing up source files, editing the
 * table back out, rebuilding, dumping, restoring, rebuilding, dumping — with
 * the working tree mutated throughout, which is a bad place to keep a half
 * hour of unsaved data-entry.
 *
 * So `before` comes from a **git worktree** at `--base` instead. The working
 * tree is never touched, the comparison is against a real commit rather than a
 * reconstruction, and an interrupted run leaves nothing to clean up by hand.
 *
 * ## The word list, and the trap in it
 *
 * The obvious corpus is `.tmp/cyrillic-words.txt`, and it is the wrong one: it
 * is a LEMMA list, so inflected forms are absent by construction. The first
 * hand-run of this loop diffed the perfective converb against it and found 12
 * changed words out of 41,220, none of them the ending under test. The aligned
 * sentence pairs and the gold sets are where inflected forms live, so all three
 * are unioned here.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = flag('--base', 'HEAD');
const PER_GROUP = flag('--n', '14');
const OPEN = args.includes('--open');

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const run = (cmd, a, cwd) =>
  execFileSync(cmd, a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// ------------------------------------------------------------- the word list

const words = new Set();
const addLines = (path) => {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) return 0;
  let n = 0;
  for (const line of readFileSync(full, 'utf8').split('\n')) {
    const w = line.trim();
    if (w) {
      words.add(w);
      n += 1;
    }
  }
  return n;
};
const addJsonl = (path, field) => {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) return 0;
  let n = 0;
  for (const line of readFileSync(full, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const w = JSON.parse(line)[field];
      if (w) {
        words.add(w);
        n += 1;
      }
    } catch {
      // torn line
    }
  }
  return n;
};
const addGold = (path) => {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) return 0;
  const entries = JSON.parse(readFileSync(full, 'utf8')).entries;
  for (const e of entries) words.add(e.cyrillic);
  return entries.length;
};

addLines('.tmp/cyrillic-words.txt');
addJsonl('.tmp/aligned-words.jsonl', 'cyrillic');
addGold('test/fixtures/harvested-inflected.json');
addGold('test/fixtures/verb-gold.json');

if (words.size === 0) {
  console.error('no words to diff — expected .tmp/cyrillic-words.txt or the gold fixtures');
  process.exit(1);
}
const wordList = [...words];
console.log(
  `word list: ${wordList.length} distinct (lemma corpus + aligned pairs + both gold sets)`,
);

// -------------------------------------------------------------- dump helpers

/** Convert every word with the build at `distDir`. */
async function dump(distDir) {
  const { convert } = await import(pathToFileURL(join(distDir, 'index.js')).href);
  const out = new Map();
  for (const w of wordList) {
    try {
      out.set(w, convert(w));
    } catch {
      out.set(w, null);
    }
  }
  return out;
}

// ------------------------------------------------------------------- `after`

if (!existsSync(resolve(ROOT, 'dist/index.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}
console.log('dumping AFTER  (working tree)…');
const after = await dump(resolve(ROOT, 'dist'));

// ------------------------------------------------------ `before`, in a worktree

const tmp = mkdtempSync(join(tmpdir(), 'gege-review-'));
const wt = join(tmp, 'base');

/**
 * Remove the worktree, whatever happened.
 *
 * `finally` alone is not enough, and the difference is not theoretical: the
 * `before` leg is a full tsc build plus 43k conversions, so Ctrl-C during it is
 * the likely way this ends. SIGINT terminates the process without unwinding, so
 * a `finally` never runs and the worktree survives — the exact thing the header
 * promises does not happen. Hence a signal handler as well.
 *
 * `worktree prune` runs last because removing the checkout by hand (or having
 * `remove` fail on a dirty tree) leaves the administrative copy in
 * `.git/worktrees`, and `git worktree list` keeps reporting it until pruned.
 * Idempotent, so calling it twice costs nothing.
 */
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  try {
    git('worktree', 'remove', '--force', wt);
  } catch {
    // The prune below is what actually guarantees a clean `worktree list`.
  }
  rmSync(tmp, { recursive: true, force: true });
  try {
    git('worktree', 'prune');
  } catch {
    // Nothing left to do; report it rather than masking the original failure.
    console.error(`could not prune worktrees — check \`git worktree list\` for ${wt}`);
  }
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    cleanup();
    process.exit(130);
  });
}

let before;
try {
  console.log(`dumping BEFORE (${BASE}) in a throwaway worktree…`);
  git('worktree', 'add', '--detach', wt, BASE);
  // The worktree needs its own build. node_modules is symlinked rather than
  // reinstalled: the dependency is first-party and pure data, and a full
  // install here would dominate the runtime of the whole loop.
  run('ln', ['-s', resolve(ROOT, 'node_modules'), join(wt, 'node_modules')], wt);
  run('npx', ['tsc', '-p', 'tsconfig.build.json'], wt);
  before = await dump(join(wt, 'dist'));
} catch (err) {
  // execFileSync throws an object whose default rendering is a page of buffers.
  // Say what failed and what git said, then stop — the finally still cleans up.
  cleanup();
  console.error(`\nBEFORE leg failed at ${BASE}: ${err?.message ?? err}`);
  const stderr = String(err?.stderr ?? '').trim();
  if (stderr) console.error(stderr);
  process.exit(1);
} finally {
  cleanup();
}

// --------------------------------------------------------------- the diff

const changed = [];
for (const [w, now] of after) {
  const was = before.get(w);
  if (was !== undefined && was !== now) changed.push({ w, from: was });
}

const outPath = resolve(ROOT, '.tmp/changed.json');
writeFileSync(outPath, JSON.stringify(changed));
console.log(`\nchanged: ${changed.length} of ${wordList.length}`);
if (changed.length === 0) {
  console.log('nothing to review — the change did not alter any output.');
  process.exit(0);
}
console.log(
  `sample: ${changed
    .slice(0, 12)
    .map((c) => c.w)
    .join(' ')}`,
);

// ------------------------------------------------------------- the spotcheck

const html = '.tmp/spotcheck.html';
run('node', ['scripts/build-spotcheck.mjs', html, '--changed', outPath, '--n', PER_GROUP], ROOT);
console.log(`\nwrote ${html}`);
if (OPEN) {
  try {
    run('open', [resolve(ROOT, html)], ROOT);
    console.log('opened in your browser.');
  } catch {
    console.log('(could not open automatically)');
  }
}
