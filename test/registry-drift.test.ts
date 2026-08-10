/**
 * The one remaining duplication guard.
 *
 * `src/data/suffixes.ts` keys suffixes by **Cyrillic surface form**; the
 * canonical registry in `@gege-mn/mongol-bichig` keys them by **Classical
 * form**. Neither is a superset of the other and merging them is not a
 * rename, so the tables stay separate — but the *Classical* column is the
 * canonical registry's to own, and this package must never invent or quietly
 * amend a Classical suffix form.
 *
 * `romanize.ts` used to be a copy too, and it drifted within a day of being
 * made. This test exists so the same thing cannot happen silently to the
 * suffix forms: a Classical form added here that the registry does not know
 * fails the build, and the fix is to correct the registry in mongol-bichig —
 * whose normative source is `references/suffixes.md` — and depend on the new
 * version, not to special-case it here.
 *
 * Compared in **script**, never in romanization: γ/g and q/k are
 * harmony-selected allographs of one letter, so `un` and `ün` differ but
 * `qan`/`kan` do not. See the footgun note in CLAUDE.md.
 */

import { suffixes as canonical } from '@gege-mn/mongol-bichig';
import { describe, expect, it } from 'vitest';
import { suffixes } from '../src/data/suffixes.js';
import { toScript } from '../src/romanize.js';

/** Canonical Classical forms, as script. */
const registry = new Map(canonical.map((row) => [toScript(row.translit), row.translit]));

/**
 * What the registry owns is the **atoms** of the case system. Two kinds of row
 * here are therefore checked differently, and neither is an escape hatch:
 *
 * - A **fused** form is a composition, not a new fact: `yin-iyan` is the
 *   genitive `yin` followed by the reflexive `iyan`, both registry rows, with
 *   the connector between them. Checking the concatenation against the
 *   registry would demand an entry for every pair that can chain, which is a
 *   combinatorial list the registry deliberately does not keep. So the parts
 *   are checked, which is where drift would actually show up.
 * - A **derivational** row is outside the registry's scope entirely. The
 *   registry is inflection — case, reflexive, plural, clitics — the same
 *   reason `verb-suffixes.ts` is a separate file with its own provenance
 *   rules. `-лиг` is ruled and mined here, and `references/suffixes.md`
 *   records it as this package's, not as the registry's.
 */
const INFLECTIONAL = suffixes.filter((entry) => entry.category !== 'derivational');
const ourForms = [...new Set(INFLECTIONAL.flatMap((entry) => entry.classical.split('-')))]
  .filter(Boolean)
  .sort();

describe('Classical suffix forms do not drift from the canonical registry', () => {
  it('has something to check', () => {
    expect(ourForms.length).toBeGreaterThan(20);
    expect(registry.size).toBeGreaterThan(20);
  });

  it.each(ourForms.map((form) => [form] as const))(
    '%s is a known Classical suffix',
    (classical) => {
      const script = toScript(classical);
      expect(
        registry.has(script),
        `Classical suffix "${classical}" is not in @gege-mn/mongol-bichig. ` +
          'Add or correct it there (references/suffixes.md is normative), bump the ' +
          'dependency, and only then use it here.',
      ).toBe(true);
    },
  );

  it('romanizes every Classical form to Hudum letters and MVS only', () => {
    // Cheap second guard: a typo that happens to collide with a registry entry
    // would slip past the check above, but not past toScript's alphabet.
    for (const form of ourForms) expect(() => toScript(form)).not.toThrow();
  });
});
