---
paths:
  - "src/data/**"
  - "src/orthography.ts"
  - "src/stem.ts"
---

# Writing data rows

Classical forms are written in **romanization** (`qar-a`, `mongγol`) in every
data file, never as bichig literals — romanization is auditable by eye and diffs
readably. `romanize.ts` is the single place that turns them into script, and
`test/data.test.ts` runs `toScript()` over every row, so a typo fails the build
instead of shipping malformed Unicode.

## o/ö appear only in the first syllable

Categorical. монгол is `mongγul`, not `mongγol`. Genuine exceptions are lexical
— loanwords, and one doubled short o. More in `docs/rulings.md`.

## Never derive a rule from foreign words

Reader, 2026-07-29: *"foreign words most of the time are written exactly like the
cyrillic one unless we know of a traditional spelling… don't derive rules from
foreign words."*

They are the largest tempting source of apparent regularity here — 133 lexicon
stems end in a bare үл дэвсгэр consonant, a bigger class than most real rules
cover — and the one class from which nothing generalises. That same day one
reader-supplied loanword (массаж = `massaǰi`) was read as proof all 133 were
malformed; they are simply exempt, and целлюлоз = `cēllyü1lüz` ends bare.
**Exclude loanwords before counting**, or you will find the transliteration
convention and mistake it for Mongolian.

Loanwords whose Classical form ends in a vowel also need `hiddenN: false` — the
тогтворгүй н is a fact about native stems, and the default would write
`bananan-u`.

## An ask page answers about *words*; it cannot tell you a rule's scope

Six reader answers on 2026-07-29 became `repairDevoicedGa` over 224 words, and
rulebook §2.1.2.3 says the 224 were wrong — including тосгон and сэтгэл, the
rulebook's own examples. The tell was visible in the answers alone and nobody
looked: the rule being implicitly asked about is silent on the two words the
reader agreed with (салгах ends in л, агаар in a vowel) and contradicts all three
it covers.

**Before generalising an ask, check whether the batch discriminates the rule** —
and prefer a lexical row to a rule when the evidence is a list of words.

## The harvest's `unicode` field is only *encoding*-repaired

gege-linter fixes the encoding; `normalizeOrthography` is a **separate pass**
that must also be applied before harvested rows are used for anything. Skipping
it in the training export (2026-07-27) trained a model that reproduced three
reader rulings wrongly — 7/7 монгол rows and 35/35 сай rows carried the old
convention. Aggregate accuracy did not catch it; it looked like it worked.
