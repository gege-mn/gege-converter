---
paths:
  - "src/data/suffixes.ts"
  - "src/data/lexicon.ts"
  - "src/data/verb-suffixes.ts"
  - "src/stem.ts"
  - "src/generate.ts"
  - "scripts/build-spotcheck.mjs"
  - "scripts/lib/brand.mjs"
---

# The review loop is the process

Terminal output **cannot** be used to judge bichig, so this is not optional
politeness — it is the only working review channel. After any change to the
suffix table, the guesser, or the lexicon: dump the corpus before and after, then

```sh
node scripts/build-spotcheck.mjs .tmp/spotcheck.html --changed <diff.json>
```

and send the HTML. That loop found the unstable vowel — worth +11pp top-1 — in a
single round of 24 words.

Ask for failures as **Cyrillic sentences with `*` on the wrong words**. Never ask
the reader to type bichig.

## Every verdict is a verdict at one font version

**Noto Sans Mongolian 3.002** — SIL OFL 1.1, `github.com/notofonts/mongolian`,
the modern UTN #57 contextual model. `scripts/lib/brand.mjs` inlines that exact
woff2 into every review page as a data URI and names the version in
`MONGOL_FONT`, so what the reader judges is what gege.mn renders — not whatever
Mongolian face their machine happens to have. The alternatives genuinely
disagree: Android ships none, Apple's has been broken, and both have been
Unicode-divergent.

⚠ Upstream Noto has changed Mongolian shaping between releases, so a ruling
recorded against 3.002 is **not automatically a ruling against 3.003**. If the
face is updated, re-render the corpus and diff the glyph sequences before
trusting the existing rulings — the pin is what keeps `test/rulings.test.ts`
meaning the same thing next year as on the day each row was confirmed.

If the sibling checkout is missing the page still builds, but says so in a
banner: a font-dependent verdict is worse than no verdict.

## The reader often declines an either/or

When asked which of two spellings is correct, the answer is frequently "both".
A corpus count then measures **house style, not correctness** — record the
measurement and the choice separately, never fold a preference into a field
documented as a count.
