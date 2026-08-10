#!/usr/bin/env node
/**
 * Lint everything this converter can emit, using gege-linter's CLI.
 *
 * The converter's whole claim is Unicode-correct output, so that claim should
 * be checked by the tool that defines correctness — not by our own tests
 * asserting what we already believe. Run after `pnpm build`.
 *
 * Exits non-zero on any error or warning. Info is reported but tolerated:
 * `non-initial-o` fires on ᠭᠣᠣᠯ (γool), a genuine lexical exception with a
 * doubled short o, and on loanwords. It is NOT tolerated for ᠮᠣᠩᠭᠣᠯ — the
 * o/ö rule is categorical and монгол is `mongγul`, settled 2026-07-26. The
 * Poppe §33 reading in the orthography reference licenses non-initial o and
 * is not the rule taught in Mongolia; do not restore it.
 *
 *   GEGE_LINTER=/path/to/gege-linter/dist/cli.js node scripts/lint-output.mjs
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { suffixes } from '../dist/data/suffixes.js';
import { convert, lexicon, toScript } from '../dist/index.js';

const require = createRequire(import.meta.url);

/** Locate gege-linter's CLI: env override, then node_modules, then a sibling checkout. */
function resolveLinterCli() {
  if (process.env.GEGE_LINTER) return process.env.GEGE_LINTER;
  try {
    return require.resolve('@gege-mn/gege-linter/dist/cli.js');
  } catch {
    /* not installed — fall through */
  }
  const sibling = fileURLToPath(new URL('../../gege-linter/dist/cli.js', import.meta.url));
  return sibling;
}

// Every lexicon entry, plus every stem inflected with every suffix that can
// attach to it. This is far wider than the demo's 14 words — it is the whole
// surface the converter can currently produce.
const samples = new Map();
for (const entry of lexicon) {
  samples.set(toScript(entry.classical), entry.cyrillic);
}
for (const entry of lexicon) {
  for (const suffix of suffixes) {
    const inflected = entry.cyrillic + suffix.cyrillic;
    const out = convert(inflected);
    if (out !== inflected) samples.set(out, inflected);
  }
}

const forms = [...samples.keys()];
const dir = mkdtempSync(join(tmpdir(), 'gege-converter-lint-'));
const file = join(dir, 'output.txt');
writeFileSync(file, forms.join('\n'), 'utf8');

const cli = resolveLinterCli();
const result = spawnSync(process.execPath, [cli, '--json', file], { encoding: 'utf8' });

if (result.error || result.stdout === '') {
  console.error(`could not run gege-linter at ${cli}`);
  console.error('set GEGE_LINTER to its dist/cli.js, or `pnpm add -D @gege-mn/gege-linter`');
  process.exit(2);
}

const diagnostics = JSON.parse(result.stdout).files.flatMap((f) => f.diagnostics);
const counts = new Map();
for (const d of diagnostics) {
  const key = `${d.severity}:${d.rule}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

console.log(`linted ${forms.length} generated forms with ${cli}`);
if (counts.size === 0) console.log('  clean');
for (const [key, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key} ×${n}`);
}

// NNBSP must never appear: it is the legacy connector this package exists to
// avoid. Checked directly rather than via a rule, so it can never be silenced.
const nnbsp = forms.filter((f) => f.includes('\u202F'));
console.log(`  U+202F (NNBSP): ${nnbsp.length}`);

const blocking = diagnostics.filter((d) => d.severity === 'error' || d.severity === 'warning');
if (blocking.length > 0 || nnbsp.length > 0) {
  for (const d of blocking.slice(0, 20)) {
    console.error(`  ${d.severity} ${d.rule}: ${forms[d.line - 1]} — ${d.message}`);
  }
  process.exit(1);
}

for (const d of diagnostics.filter((d) => d.severity === 'info')) {
  console.log(`  info ${d.rule}: ${samples.get(forms[d.line - 1]) ?? '?'} → ${forms[d.line - 1]}`);
}
