---
paths:
  - "src/**"
  - "test/**"
  - "scripts/**"
---

# Never type an invisible character as a literal

MVS (U+180E), NNBSP (U+202F), FVS1–4, ZWJ/ZWNJ and **PUA** are always written as
`\uXXXX` escapes in `src/`, `test/` and `scripts/`. Visible bichig letters may
appear literally; the invisible ones may not.

Verify — it must print nothing:

```sh
grep -rlP '[\x{180E}\x{202F}\x{200C}\x{200D}\x{E000}-\x{F8FF}]' src test scripts
```

## Why each part of that rule exists

**PUA joined the class on 2026-08-06**, after a Menksoft PUA literal reached a
test file and a narrower guard passed it. PUA is precisely what this package
exists not to emit.

**Never paste bichig output into a comment.** The same day, an MVS rode into a
`suffixes.ts` comment inside pasted converter output. Write the romanization —
which is the convention for Classical forms in data files anyway.

**`scripts/` is in the list because of a real failure.** On 2026-07-31 a regex
character class in `scripts/benchmark.mjs` was written with the connectors typed
literally, an edit silently dropped U+202F, and the benchmark reported that two
reference converters agree 10% of the time when the true figure is 88%. A
plausible, quotable, completely wrong headline — from a file the guard was not
looking at.

## Offsets

Offsets are **code points**, not UTF-16 units — matching gege-linter's diagnostic
model and the gege.mn /type pad caret. Never `String.slice` with them.
