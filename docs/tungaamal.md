# Tungaamal → Unicode

<!-- Background doc. Not loaded into context automatically. -->

Read this before touching `src/tungaamal.ts`, `src/data/tungaamal-rules.ts`, or
anything that reads the silver's output. It records what the
Tungaamal convention *is* — measured, not assumed — and why the module is shaped
the way it is.

```ts
import { tungaamalToUnicode, rewriteTungaamal, isTungaamal, detectTungaamal } from '@gege-mn/gege-converter';

tungaamalToUnicode(text);                    // what the text means, in Unicode
tungaamalToUnicode(text, { faithful: true }); // what the Tungaamal fonts drew, exactly
rewriteTungaamal(text).applied;              // which rules fired, in order
isTungaamal(text);                        // is this Tungaamal text at all?
detectTungaamal(text);                    // …and the counts behind that answer
```

## What Tungaamal text is

Mongolia's dominant bichig keyboard and font family. Its text sits in the
standard Mongolian block with no PUA, which makes it look like Unicode with two
odd letters. It is a different convention all the way down. Read out of the
fonts' own GSUB tables (49 lookups, three faces, two of which shape identically
over 631,266 probe strings):

| | The Tungaamal convention | Unicode 16 / UTN #57 |
|---|---|---|
| gender of q / γ | **typed** — U+1888 is feminine k, U+1889 feminine g; U+182C/U+182D are always drawn masculine | **shaped** from the vowels around the letter |
| selectors | **one, a toggle** — FVS1 means "the other form here"; FVS2/FVS3 draw an error mark; U+180F has no glyph | an index into the letter's variant list, FVS1–FVS4 |
| suffix connector | none that shapes — NNBSP is a blank and what follows is a new word | MVS, which shapes the suffix |
| a suffix's form | from FVS1 on its first letter | from the connector |
| MVS | only before a detached final a/e | that, and every suffix |

Three earlier beliefs in this repo were wrong, and each cost something:

1. **"Standard Hudum plus exactly two substitutions."** True of the letters,
   false of everything else. The old import swapped the two letters and the
   connector and stopped, which left every FVS1 meaning what the Tungaamal convention means by
   it. In six contexts the standard writes that form with FVS2 or FVS3
   (академи's two-part d, the crownless ü, a ü right after an initial
   consonant), so those rows shipped a different shape from the one in the data.
2. **"Redundant FVS selectors on suffix heads."** They are load-bearing in
   The Tungaamal convention — it is the only thing that makes a suffix look like one — and
   they must go once the suffix is on an MVS. For `iyar`/`iyan` leaving one in
   is not harmless: it makes the standard hook the y.
3. **"`V + YA + I` is always the diphthong."** In the Tungaamal convention it is, *unless* the
   y carries FVS1, which is how хаяг `qayiγ` keeps a consonantal y. The old
   chain left that FVS1 in place, which in the standard selects the **un**hooked
   y — the diphthong's shape, the opposite of what was meant.

## What real Tungaamal text looks like

From 714 public pages on 14 hosts typed in the convention, 1.08M bichig
characters (the pages themselves are not in this repo; only counts are):

- U+1888 22,902 · U+1889 30,444 — about forty per thousand letters, the
  fingerprint `detectTungaamal` counts.
- **FVS1 49,400; FVS2 2; FVS3 3; FVS4 0.** Seventeen distinct letter + selector
  pairs exist at all.
- **A case particle follows a plain space twice as often as an NNBSP** (65.9%
  after U+0020). `ᠶ + FVS1 + ᠢᠨ` as a word of its own is the single commonest
  marked sequence, 11,156 times. A converter that only rewrites NNBSP leaves
  two suffixes in three as separate words.
- The diphthong is `V + YA + I` 12,087 times and `V + I + I` 17 times.
- **"Incorrect га/гэ" is real and one-sided.** A masculine U+182C/U+182D typed
  where the word is feminine: 3,244 occurrences. The reverse: 51.
- Things a converter never emits: ZWJ-built acronyms (1,185), U+1806 as the
  everyday hyphen (1,561), a selector typed twice (eight hosts), MVS used as a
  suffix connector on pages that mix conventions.

## The table, and what it is proven against

`src/data/tungaamal-rules.ts` — 111 rows, generated from the measurement, not
written by hand. For each letter the first row whose conditions hold applies.
Three kinds:

| kind | rows | meaning |
|---|---|---|
| `encoding` | 63 | the two conventions write the same written form with different (or the same) code points |
| `tungaamal-defect` | 37 | what the fonts drew is a typist's slip or a font quirk; the row reproduces the picture |
| `no-equivalent` | 11 | a form no standard sequence draws; the row is the nearest plain spelling |

**Method.** Shape the left side with a Tungaamal face and the right with Noto
Sans Mongolian, reduce both glyph runs to written forms (unit + position, in
Noto's glyph-name vocabulary), compare. Over 9,686 distinct tokens (180,138
occurrences) from the pages above:

| | tokens | occurrences |
|---|---|---|
| faithful mode draws what the Tungaamal convention drew | 9,662 | 179,614 (99.7%) |
| default mode draws what the Tungaamal convention drew | 9,379 | 174,246 (96.7%) |

(Against Noto 3.002. Against the hinted 3.100 build the faithful row is the
same to the token and the default row is 9,373 / 174,228.)

The default mode's missing 3% is on purpose — see the next section; every one of
those tokens is accounted for by the slip or quirk it declines to reproduce.

The shipped TypeScript is not the measuring instrument, so the two were diffed:
over 56,627 texts the faithful mode's output and its list of fired rules are
identical to the instrument's. `test/fixtures/tungaamal-rules.json` carries a
proven pair for 100 of the 111 rows and the suite reproduces all 100; the other
eleven rows never fired in a token the proof could shape, and stand on the GSUB
reading alone.

The table is generated, and its generator is not in this repo: it reads the
font measurements, which sit beside the fonts. Edit a row here by hand only to
fix it, and say so in the row.

Two independent reviews on the same day found eight defects in the engine
around the table (none in the table) — an NNBSP left in place before a word
ending in a detached vowel, a suffix missed when a second MVS-joined suffix
followed it, a suffix after a closing quote losing its FVS1 without gaining an
MVS, a long page overflowing the stack, an acronym's first letter read as a
genitive. Each is pinned in `test/tungaamal.test.ts`, and the old and new
engines were diffed over the 9,686 tokens: no output changed, so the proof
figures above stand.

⚠ **The fonts are proprietary and are not in this repo.** They were used as a
measuring instrument and nothing of them ships. The proof therefore cannot run
in CI; what CI holds is that the code applies the measured table exactly.

### The reference face, and a trap in the 3.100 release

Proven against **Noto Sans Mongolian 3.002** and against the **hinted 3.100**
build this project pins as its review face (`scripts/lib/brand.mjs`): the
faithful mode scores the identical 9,662 tokens / 179,614 occurrences on both.

⚠ **The 3.100 release ships four builds and two of them shape differently.**
`hinted` and `unhinted` draw plain U+182C/U+182D as 3.002 does. `full` and
`googlefonts` do not: they take gender from the vowel *before* the letter and
never from the one after, and have no dotted default for a medial γ.

| word | 3.002, 3.100 hinted / unhinted | 3.100 `full`, `googlefonts` |
|---|---|---|
| `qaγan` | γ dotted | γ **undotted** |
| `mongγul` | dotted γ | **feminine** g + o ligature |
| `bolqu` | masculine q, closed final u | **feminine** bowl, small o |
| `aqi` | feminine bowl before i | **masculine** q |

Reproduced with two HarfBuzz versions and three language settings. Over this
package's own lexicon, **2,503 of 9,133 words change written form** between the
`full` build and 3.002. монгол does not take a feminine g, so this is a fault in
those builds and not a change of model; the table compensates for nothing, and
the eight rows that would have (an explicit selector on every q/γ) were measured
and left out.

So the note in `brand.mjs` that the 3.002 → 3.100 move "kept every letterform"
is right **for the build it names**. Anyone who takes `full` — or lets a font
service serve `googlefonts` — gets the other behaviour, with nothing in the
version string to say so. The study's first pass picked `full` out of the
release archive and briefly concluded 3.100 was unusable as a reference; it is
recorded here so that conclusion is not reached twice.

## The two modes, and where the line between them is

**`faithful: true`** applies all three kinds and leaves spaces as spaces. It is
what the proof is about. Use it to convert an archive without changing what any
reader saw.

**The default** writes what the text means:

- every `encoding` row but one, and every `no-equivalent` row;
- a suffix or particle the registry knows, after NNBSP **or after a plain
  space**, is joined with MVS and spelled the registry's way — selectors gone,
  and `luγ-a` with the registry's own MVS however it was typed; the
  space-joined words (ᠤᠤ, ᠦᠭᠡᠢ, …) get a space instead of a connector. A
  suffix written after a **space** may lean on a letter, a digit or a closing
  quote or bracket; after a comma or at the start of a line it is a word and
  is left one. An NNBSP is a connector wherever anything stands before it,
  and so is U+1806 before a registry suffix — Tungaamal's way of hanging one
  on a number or an abbreviation (25 + U+1806 + ᠤ + FVS1). Between two words
  U+1806 is a hyphen and stays;
- a selector typed twice is read as typed once.

Of the 37 `tungaamal-defect` rows it applies exactly nine, and the distinction
is whether the form is the writer's **choice** or the writer's **slip**:

| rows | applied | why |
|---|---|---|
| KE-1/2/3, GE-1/2/3 — a feminine letter where the standard would draw masculine | always | nobody types the feminine key by accident before ᠠ. These are loanwords and compound names: программ, the -билэг of Сайханбилэг. The converter's own output has this shape 21 times in 18,741 words, every one such a word. |
| QA-2, GA-2, GA-3 — a masculine letter where the standard would draw feminine | only if a masculine vowel stands earlier in the word | англи, агентлаг: the word is masculine and the letter is meant. In a word with no masculine vowel it is бичиг typed with the wrong key. |
| QA-1, GA-1, GA-1i — a masculine letter directly before e, i, ö, ü | never | the form does not exist in Mongolian. This is the "incorrect га/гэ", about 2,500 occurrences in the sample, and the plain letter is what was meant. |
| the rest — particles typed without their FVS1, ᠲᠤ/ᠳᠤ as words, single-tooth `V + I`, font quirks on final ö/ü | never | the standard's own shaping is the orthography here |

And one `encoding` row is left out of the default: **SHA-I**. The Tungaamal convention keeps
the two dots of ᠱ before ᠢ; the standard drops them by itself, because `si` is
already read [ʃi]; FVS2 puts them back. Applying it would be faithful — and
would turn every native жишээ into the spelling a reader ruled against ("the
double dotted one is only for foreign, or traditional spelt words",
`docs/rulings.md`). The dots stay in faithful mode.

⚠ **Single-tooth `V + I` is the one place this costs something known.** Real
typists write `üile` with one I where the orthography wants two teeth, so the
default lets the standard draw two. The converter's own найм `naima` is the
exception — one tooth, deliberately — and it reaches the pipeline through its
curated row (`nay1ma`), not through this module.

## What it does not do

- **It is not idempotent, and it damages correct Unicode.** The output uses
  FVS1 in the standard's sense; a second pass would read it in Tungaamal's.
  Ask `detectTungaamal` first, and ask it of a paragraph: a page mixes
  conventions (site chrome one way, articles another). It will not take a
  long stretch of this module's own faithful output for the Tungaamal convention — no text of
  two hundred letters lacks both of the convention's letters — but a short
  line it cannot tell apart, so do not ask after converting.
- **It does not respell.** Non-initial o/ö → u/ü is this project's orthography
  and stays in `orthography.ts`. For converter output the right second pass is
  `normalizeConverted`, not `normalizeOrthography` — see that function for why
  the difference is `dropGlideYa`.
- **Abbreviations are passed through.** ZWJ-and-comma acronyms keep their
  joiners; nothing rewrites them, and a run with a joiner in it is never taken
  for a suffix — УИХ begins with ᠤ, which alone spells the genitive.
- **An NNBSP that joins nothing** (at a line end, doubled) is left as it is.
- **Eleven constructs have no standard equivalent**, the largest being a ü
  written alone *without* FVS1 (236 occurrences). The `no-equivalent` rows say
  what each is.

## Where it is used here

`scripts/standardize-silver.mjs` is the one caller: it turns raw silver
output into `.tmp/harvest-harvest.jsonl`, and every row it writes carries
`repair: 'tungaamal'`. `scripts/lib/silver.mjs` picks the normaliser by that
field. An old-format file on another machine (no `repair` field) keeps meaning
what it meant. Nothing in the eight pipeline stages imports this module.
