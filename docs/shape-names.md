# The shape names, as a bichig reader gave them

Elicited 2026-07-29 from the repository owner, a fluent reader, via
`scripts/build-naming.mjs`. **This vocabulary exists nowhere machine-readable.**
Searching both this repo and `~/Projects/mongol-bichig` for титэм, гэдэс, шүд,
нуруу or орхиц before asking turned up exactly one name — шилбэ, in a comment.
So this file is the only record, and it is primary source material: the reader's
own wording is quoted rather than paraphrased, and where they hedged, the hedge
is kept.

It is **incomplete**: 32 of 128 shape cards were answered before the reader
stopped, and the reason they stopped is itself the most important finding here
(see "Why the page was the wrong shape"). The inventory, however, looks
complete — the 32 answers use no name that the inventory does not list.

**Canonical home.** Script facts belong in `~/Projects/mongol-bichig`, per
CLAUDE.md. This lives here for now because it is raw and unverified; migrate it
once the composition rules below are confirmed and the gaps are filled.

## Why the page was the wrong shape

The page asked one question per (letter, position, variant) — 128 of them. The
reader's answers say that is the wrong axis, in two ways, and both were
predicted as risks when the page was built:

1. **Shapes are shared across letters.** `шүд` is the answer for A-medial,
   E-medial *and* NA-medial. Asking per letter asks the same question many
   times.
2. **Shapes are conditioned by context, not by position alone.** The reader,
   unprompted: *"sometimes the usage in word differs from the shown form."*
   NA-medial is `шүд`, but "becomes a dotted tooth when precedes a vowel". The
   card can only show one glyph, so the card cannot hold the answer.

The consequence is good news. The inventory is **13 names**, not 128 shapes,
and most of the 128 are *compositions* of those 13. The remaining work is to
derive the compositions and have the reader confirm them — verification, which
is cheap, instead of authorship, which is what exhausted them.

## The inventory — 13 names, in three classes

Reader's glosses quoted.

### Base strokes — stand alone, carry a shape

| name | the reader's gloss |
|---|---|
| `шүд` | tooth |
| `шилбэ` | — (the one name already recorded in this repo) |
| `гэдэс` | belly |
| `сүүл` | tail |
| `титэм` | crown |
| `орхиц` | "depending on use case, it's either separated, or stuck to the previous stroke" — **two variants, one name** |
| `одой сүүл` | "uncommon, a shorter version of the suul, but **doesn't have any letter/sound associated with it**. for example, you can find this at the end of word би (it doesn't use final и, it's б и and одой сүүл)" |
| `нум` | "general name for incomplete circles like final и or feminine х and г" — reader unsure whether it belongs in an encoding |

### Modifiers — never appear alone, attach to a base

| name | attaches | the reader's gloss |
|---|---|---|
| `дусал` | dot | "never used individually, it's дусалтай шүд, дусалтай сүүл" |
| `давхар дусал` | double dot | "two tooth with double-dot is letter г precedes a masculine vowel, also if you put double-dot on the left side of с it becomes ш" |
| `гэзэг` | left of a tooth | "a pony-tail looking thing written on the left side of a tooth to make letter м" |
| `эвэр` | left of a tooth | "horn (as in animal horn) looking thing written on the left side of a tooth to make letter л" |

### Structural — mostly not encoded

`нуруу` — "name of the vertical line, the spine, foundation of script, the ones
that connect strokes, but **it shouldn't be part of the encoding** unless for
very few special cases".

The special case, in full, because it is the one place a spine is contrastive:

> letter n / н is written as just tooth "шүд" if it's not precedes a vowel, but
> in foreign words, it always keeps the dot. and if you wanna write санни in
> mongolian, it'll be impossible to distinguish if it's a саги or санни, so we
> add нуруу between double dotted n (foreign word).

So `нуруу` is encoded only as a **disambiguator**, when omitting it would make
two different words identical. Everywhere else it is a rendering artifact.

## The composition rules the glosses imply

Derived from the reader's glosses, **not yet confirmed by them**. Every one of
these is a question to put back, not a fact to rely on:

- `м` = `гэзэг` + `шүд`
- `л` = `эвэр` + `шүд`
- `ш` = `с` + `давхар дусал` (on the left)
- `г` before a masculine vowel = `шүд` + `шүд` + `давхар дусал`
- `н` medial before a vowel = `дусалтай шүд`; elsewhere plain `шүд`
- `н` in foreign words = keeps the dot unconditionally

## МОНГОЛ — the anchor

The reader's own example, and the thing that showed the per-letter axis was
wrong: **six code points, eight shapes.**

> crown, belly, tooth, feminine-g, dotted-tooth, dotted-tooth, belly, final-L

Named: `титэм`, `гэдэс`, `шүд`, (feminine-g), `дусалтай шүд`, `дусалтай шүд`,
`гэдэс`, (final-L).

On the two dotted teeth the reader added: *"some may argue that it's two tooths
with one double-dot in this word's case, which is correct i'd say"* — i.e. the
same ink is describable as two `дусалтай шүд` or as one `давхар дусал` over two
`шүд`. **The encoding has to pick one and be consistent.** Unresolved.

## The 32 answered cards

Verbatim. `=` separates the card from the reader's answer; parentheses are the
reader's own asides.

| id | code point · position · romanization | answer |
|---|---|---|
| S001 | U+1820 A · medial | `шүд` |
| S002 | U+1820 A · final | `сүүл` |
| S003 | U+1820 A · isolated · after connector | `орхиц` (at the end) |
| S004 | U+1820 A · initial | `титэм шүд` |
| S005 | U+1820 A · initial · after connector | `титэм` — "а is crown plus tooth, but in this very specific connector, it's just a single crown with no tooth. exception i'd say" |
| S006 | U+1820 A · isolated | `титэм үсүл` |
| S007 | U+1821 E · medial | `шүд` |
| S008 | U+1821 E · final | `сүүл` |
| S009 | U+1821 E · initial | `титэм` |
| S010 | U+1821 E · isolated · after connector | `орхиц` |
| S011 | U+1821 E · initial · after connector | `титэм` |
| S012 | U+1821 E · isolated | `титэм орхиц` — "but it's not separated орхиц, so two versions of орхиц" |
| S013 | U+1822 I · medial | `шилбэ` |
| S014 | U+1822 I · final | `нум` |
| S015 | U+1822 I · initial · after connector | `шилбэ` |
| S016 | U+1822 I · initial | `титэм шилбэ` |
| S017 | U+1822 I · isolated · after connector | `нум` |
| S018 | U+1822 I · isolated | `титэм нум` |
| S019 | U+1828 NA · final | `сүүл` |
| S020 | U+1828 NA · medial | `шүд` — "becomes a dotted tooth when precedes a vowel" |
| S021 | U+1828 NA · initial | `дусалтай титэм` (crown, but with a dot) |
| S022 | U+1828 NA · initial · after connector | `дусалтай титэм` |
| S023 | U+1828 NA · final · FVS1 | `дусалтай сүүл` |
| S024 | U+1828 NA · medial · FVS1 | `дусалтай шүд` |
| S025 | U+1828 NA · isolated | `дусалтай титэм` |
| S026 | U+182D GA · medial · masculine | `нум` — "but not same as i, let's say it's a shape of feminine g" |
| S027 | U+182D GA · medial · feminine | `нум` — same aside |
| S028 | U+182D GA · final | "`шилбэ` attached `орхиц` when feminine, `шүд` + `богино сүүлтэй шүд` when masculine (let's record this combo as final g)" |
| S029 | U+182D GA · initial · feminine | `нум` — same aside |
| S030 | U+182D GA · initial · masculine | "let's just record it as masculine g. and it **loses the double-dot when not precedes a vowel**" |
| S031 | U+1824 U · medial | `гэдэс` |
| S039 | U+1826 UE · initial | `титэм гэдэс шилбэ` |

## Open questions, in the order they block things

1. **S026/S027/S029 all answer `нум` for GA** across masculine and feminine and
   across medial and initial, with the reader hedging "but not same as i". So
   `нум` is either being used loosely for a family of arcs, or these really are
   one shape. Until this resolves, `нум` cannot be an encoding atom.
2. **Two `дусалтай шүд` versus one `давхар дусал` over two `шүд`** — the монгол
   ambiguity above. Affects every `г` before a masculine vowel.
3. **`богино сүүлтэй шүд`** appears in S028 but not in the inventory. Is it
   `одой сүүл` under another name, or a fourteenth atom?
4. **`титэм үсүл`** (S006) — `үсүл` appears nowhere else and is not in the
   inventory. Probably a typo for `орхиц`, given S012, but **do not assume**;
   ask.
5. The remaining **96 cards** were not reached. Most should be derivable from
   the composition rules; the point of deriving them is to ask the reader to
   *check* a generated table rather than author one.
