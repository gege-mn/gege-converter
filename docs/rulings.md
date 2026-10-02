# Rulings and facts worth not re-deriving

<!-- Background doc. Not loaded into context automatically. -->

Read this before changing romanization, the guesser, the suffix table, or
anything about o/ö. Every item here overrode something this project had
wrong; several cost real time to learn.

## Facts worth not re-deriving

- **Grade in SCRIPT, never in romanization.** γ/g and q/k are allographs of one
  letter selected by vowel harmony, so `ger` and `γer` are the same word and the
  identical code points; `irekü` and `ireqü` likewise. String-comparing
  romanizations invents disagreements — it scored the curated lexicon at 56%
  when the real figure was 83%. Compare `toScript(a) === toScript(b)`. This is
  the romanization-layer twin of "looking right proves nothing".
- **The long-vowel origin is NOT derivable from Cyrillic — do not try again.**
  A Cyrillic long vowel usually descends from V+γ/g+V, but *which* first vowel
  is etymological, not phonological: `ажиллуул`=aǰilla**γu**l, `босуул`=bos**uγu**l,
  `гургуул`=γurγ**uu**l — same уу, same position, three origins. Mined all 1,191
  clean single-long-vowel stems, split by vowel identity, by initial-vs-later
  and by final-vs-internal: **no cell exceeds 54%**. `guessStem` therefore
  restores nothing, on purpose. Fixing this means dictionary coverage, not rules.
- **Cyrillic в is Classical `b` except word-initially, where it is `w`.**
  Measured over the harvest, loanwords excluded: medial b:w = 422:17, final
  25:2, initial 1:15 (initial в is essentially always a loanword — ваар=`waγar`,
  but аав=`abu`, авах=`abaqu`). An earlier `LETTER_MAP` emitted `w` everywhere.
- **Unicode 16.0 (Sept 2024) moved the suffix connector from NNBSP (U+202F)
  to MVS (U+180E)** — core spec ch. 13.5. Zero UCD property changes, so a
  text-level tool is the only enforcement layer. **No keyboard, IME, or
  converter has adopted it.** W3C MLREQ (July 2025) still documents NNBSP;
  its own editor's notes (June 2026) say MVS. This package emits MVS.
- Full research: `research/cyrillic-conversion-landscape.md` in
  ~/Projects/mongol-bichig (40 sources; the source of the 45.25%
  encoding-error figure that makes validation a prerequisite for conversion).
- The deep reference on the script itself lives in ~/Projects/mongol-bichig,
  installable as a skill: `npx skills add gege-mn/mongol-bichig`. Read it
  there rather than re-deriving script facts here.

## Punctuation and digits pass through as ASCII by default (2026-07-27)

**There is no canonical target to convert to.** UTN #57 §2.2.3 explicitly
defers every number and punctuation specification to a future version; the
charts record the Mongolian digits U+1810–1819 as "less used now" while ASCII
digits are common; and Poppe §86 observes that Classical punctuation was "used
at random". Converting by default would be inventing a convention, so
`convert` changes nothing unless asked: `{ digits: 'mongolian' }` and
`{ punctuation: 'mongolian' }` opt in. Both are document-wide rather than
per-character, because mixing the two digit sets in one document is exactly
what gege-linter's `digit-consistency` flags.

Only `, . … ? !` have supported counterparts. **U+1804 COLON is mapped from
nothing** — it is documented nowhere, absent from both the spec prose and the
chart annotations. U+1800 BIRGA (head of text) and U+1805 FOUR DOTS (end of
passage) mean things no ASCII character means, so they are never generated
either. The question and exclamation marks map to the *fullwidth* CJK forms
U+FF1F/U+FF01, per UTN #57 Table 1 — the Mongolian block never encoded them.

**Romanization is word-scoped, and this is why it stays that way.** Three of
its metacharacters are ASCII characters that also occur in running text: `-`
is MVS, `.` is a letter boundary that is silently dropped, and `1`–`4` select
FVS1–FVS4. `toScript('1234')` therefore returns four variation selectors with
no error at all. Digits and punctuation are handled in `punctuation.ts`, off
the token kinds `tokenize` already produces, and never reach the alphabet.
Full rationale in that module's header; consequences for training data in
`neural-model.md`.

## Rulings from a bichig reader (do not re-litigate)

`test/rulings.test.ts` encodes the 2026-07-26 spot-check verdicts as executable
tests — the highest-authority fixture in the suite, since the silver is only another
converter. It also records, in prose, the three the reader ruled WRONG that we
still get wrong, with their correct answers, so nobody has to guess what "right"
was when they come to fix them.


All confirmed 2026-07-26/27. Each overrode something this project had wrong.

- **o/ö only in the first syllable** — categorical. монгол is `mongγul`
  (ᠮᠣᠩᠭᠤᠯ), NOT the silver's ᠮᠣᠩᠭᠣᠯ. Applies inside ё too: соёлжилт is `soyulǰilt`.
  Genuine exceptions are lexical: ᠭᠣᠣᠯ (γool, doubled short o) and loanwords.
  This contradicts the Poppe §33 reading in the orthography reference — the
  school rule wins, and that reference now says so.
- **Medial i-diphthongs are V+i, not V+y+i** — сайн is `sain`. The silver writes
  `sayin`; `dropGlideYa` rewrites it. Verified mechanically: applying it to
  The silver's байгууллага reproduces the reader-supplied form byte for byte.
  **Re-checked against UTN #57 itself on 2026-08-07** — p.18 names ail, aimag
  and taulai as preferred and greys out the y-analysis, and p.15 gives the
  two-tooth medial form to U+1822 with сайн as its example. See the section at
  the end of this file; the silver's `sayin` is the Inner Mongolian convention,
  not an error.
- **найм is ᠨᠠᠶ᠋ᠮᠠ** (NA A YA FVS1 MA A) — ours is right, the silver's ᠨᠠᠢᠮᠠ is not.
  The reader notes this is the only form the latest Noto Sans Mongolian renders
  correctly.
- **долоо/долоох do NOT share a stem.** долоох is `doliyaqu`, stem `doliya-` —
  a different word from the numeral `doluγ-a`. The hypothesis that it worked
  like хар/хара (one stem, chachlag dropped) was wrong. The imperative row is
  inferred and marked unverified.
- **монголчууд takes both plurals** — `-čud` is the grammatical form, `-čuul`
  colloquial, same meaning. Both are kept.
- **Case suffixes are all detached** — confirmed correct, and extended:
  **always detach, even in the singular**, so аавтай is `abu` + connector +
  `tai`, never `abutai`. The silver attaches ~70% of comitatives and 75% of dative
  `-т`; we never do. Lexicalised forms (жаргалтай, хатагтай, төстэй) are
  single words, not productive comitatives, and stay whole.
- **ᠶᠤᠮ (yum) is invariantly masculine** (2026-07-27). It is a **сул үг** — a
  particle — and a particle does not take harmony from the word before it. We
  emitted ᠶᠦᠮ (`yüm`) in running prose, apparently inheriting the preceding
  word's front harmony; that is wrong in every context. This is the masculine
  twin of the `ügei` rule below, and the same corollary applies: **a particle's
  vowel is a property of the particle, never of its neighbour.**
  Separately, the surface form юм is **two different words**, which the old
  single lexicon row conflated under the gloss "thing, is": the particle
  `yum`, and the ordinary noun ᠶᠠᠭᠤᠮ᠎ᠠ (`yaγum-a`) "a thing". The harvest
  already had the noun's plural as `yaγumas`, so only the citation form was
  missing.
- **гэгээтэй may be written either way** (2026-07-27) — ᠭᠡᠭᠡ᠎ᠲᠡᠢ or ᠭᠡᠭᠡᠲᠡᠢ. A
  stylistic choice, not a correctness question, so neither output is a bug and
  there is nothing to fix. Recorded because it looks like a case-suffix
  detachment error and will otherwise be "fixed" by someone later.
- **ᠦᠭᠡᠢ (ügei) is invariantly feminine** and always space-separated. So
  ᠠᠪᠤ ᠦᠭᠡᠢ pairs a masculine stem with a feminine particle, correctly. Anything
  inferring harmony from letter choice must read the **stem only**.

## Rulings from the first full article (2026-07-28)

The reader converted a real article with the model-backed playground, corrected
the output by hand and returned both versions with four comments. This is the
first time the project has had verdicts on **running text** rather than on
sampled word lists, and it is a different instrument: it finds what is frequent,
not what is unusual. All of it is in `test/rulings.test.ts` under "confirmed
against a hand-corrected article".

- **өөр is two words, and we had only one.** `öger-e` is "different, other";
  `öber` is "self, own", and `öber` is what carries өөрийн, өөрсөд, өөртөө,
  өөрөө. The reader called this the main error. The harvest had it right all
  along (өөрийн `öber-ün`, өөрсдөө `öbersed-iyen`, өөртөө `öber-tü-ben`) —
  those rows are inflected pronouns, `import-harvest.mjs` ships lemmas, so the
  shipped tier had only the bare `öger-e` and every inflected form was built on
  the wrong stem. Both readings are now curated, because a curated entry
  short-circuits the harvested tier rather than competing with it.
- **The genitive after a stem-final н is MVS + `u`/`ü`,** never a free-standing
  ᠤ᠋/ᠦ᠋ with an isolate FVS. "It's just mvs + у (or ү)", on бидний, хэмжээний
  and үндэсний. 580 harvested rows write it detached and **none** write it
  attached, so this is a convention difference across the whole import, not
  stray damage — `attachDetachedSuffix` in `src/orthography.ts` now repairs it,
  along with the accusative, reflexive and ablative written the same way (2,271
  rows). The reflexive and ablative had already been ruled this way on
  2026-07-26 (толгойгоо `toluγai-ban`, ажлаас `aǰil-ača`), and the pipeline's
  own curated path already produced ᠬᠠᠭᠠᠨ᠎ᠤ for хааны. Everything agreed except
  the import.
- **The imperfective converb -ж is `ǰu`/`ǰü` by harmony, not `ǰi`.** "It mistook
  жу жү чу чү for жи чи." 210 aligned attestations, 98% masculine / 93%
  feminine. The 2% that surface as `ču`/`čü` (босож `bosču`, нисэж `nisčü`)
  voice against a stem-final с/д and are the same suffix.
- **The present-future -на/-нэ is `n` + MVS + the harmony vowel** — зорино is
  `ǰorin-a`. 108 of 117 aligned attestations, spread over all four Cyrillic
  spellings; the four rows' `attested`/`share` say so. It is **not** unanimous,
  and the earlier wording here claimed it was. Re-mining shows the runner-up on
  -нэ/-нө is `ün-e` — the same suffix after a **consonant-final** Classical stem
  (төрнө `törün-e`), the linking vowel described under the perfective converb,
  which these rows do not carry. See the note in `src/data/verb-suffixes.ts`.
- **-ч is NOT the mirror of -ж and must not be given a row.** It splits between
  the converb (алсарч `alusraǰu`) and the agentive noun-former (ажиллаач
  `aǰillaγači`); over 42 forms the readings run 33% `či` / 21% `ǰu` / 21% `ču` /
  17% `ǰü`. Nothing dominates because two suffixes are being counted as one.

### Open, from the same article

- **ч and л are clitics, not words.** Ruled but not implemented, because the
  form depends on the **preceding** word and nothing in the pipeline carries
  harmony across a token boundary yet. The reader's examples: нэг ч → `nige` +
  MVS + `čü`; итгэж ч → `itgeǰü` + MVS + `čü`; бодож ч чадахгүй → `boduǰu` +
  MVS + `ču` + space + `čidaqu ügei`. So ч attaches with MVS and takes its
  vowel from the word before it — which is the **opposite** of the юм/үгэй
  ruling above, where a particle keeps its own vowel. Both are true; they are
  different classes of particle, and that is exactly why this needs care rather
  than a quick row. We currently emit a free-standing `či`. Same for л → `le`.
- **The dative written `ᠳ᠋ᠦᠷ`** (133 harvested rows) is detached *and* carries
  an -r the registry's `dü` does not. `attachDetachedSuffix` deliberately skips
  it: attaching it would smuggle a second, unruled change into the first.
- **бидэнтэй.** The reader wrote ᠪᠢᠳᠠᠨ᠎ᠲᠡᠢ (`bidan-tei`) but ᠪᠢᠳᠡᠨ᠎ᠤ
  (`biden-ü`) for бидний. We use `biden` for both, which the harvest attests.
  The а/э alternation may be real or may be a slip; unresolved.
- **Missing verb stems, not missing rules.** туурвиж, бичигдэнэ and
  бэлгэшээсэн still guess, because туурвих, бичигдэх and бэлгэших are in no
  dictionary the project has. The suffix rows that would convert them are now
  present and fire the moment the stem exists.

## The chachlag, ruled 2026-07-29

**Asked because our own curated lexicon disagreed with itself.** It emitted
`qar-a` for хар while shipping `nere`, `aqa`, `tala`, `šira`, `baγa` — and both
CLAUDE.md and `docs/harvest.md` cite `qar-a` as *the* example of the
convention. Six of 178 curated rows carried the chachlag; 28 had a bare final
a/e. An independent 2015 source disagreed with us on exactly the ones we wrote
bare.

Eight words, two of them controls. **The reader ruled chachlag on all five
open words**, confirmed the control that already had it, and answered "no final
vowel" to the control that should have none:

| | was | now |
|---|---|---|
| нэр | `nere` | **`ner-e`** |
| ах | `aqa` | **`aq-a`** |
| тал | `tala` | **`tal-a`** |
| шар | `šira` | **`šir-a`** |
| бага | `baγa` | **`baγ-a`** |
| хар (black) | `qar-a` | unchanged — control |
| ном | `nom` | unchanged — control, no final vowel |

Curated-tier top-1 **67.8% → 72.2%**, all inflected forms 55.6% → 56.2%, from
five data rows. 299 of 43,186 corpus entries changed, every one a phrase
containing one of the five.

**тал was in fact ruled twice.** The -нх- verdict on 2026-07-28 already spelled
талынхаа `tal-a-yin-iyan` over a chachlag stem. Nobody noticed that it
contradicted the `tala` we were shipping, which is an argument for grepping old
rulings for a stem before writing a new row for it.

### It is lexical. Do not turn it into a rule.

The tempting generalisation — "a Classical stem ending in a bare a/e after a
consonant takes the chachlag" — is **wrong**, and would have broken twelve
rows. Of the 28 curated bare-vowel rows, the independent source says *joined*
for хот, үг, сар, эх, эцэг, үүл, өглөө, хөх, энх, энэ, тэр and биз. Nine more
(хэл, уул, хад, тэмээ, чоно, их, долоо, найм, бид) it has no opinion on and
they remain unasked.

The reader's own caveat, worth quoting because it is the reason a blanket sweep
is unsafe: *"they usually don't have alternate spelling that changes the
meaning (some words mean different things with цацлаг/орхиц or сүүл)."*

**хар is exactly that pair, and we carry both**: `qar-a` "black" against the
verb stem `qara` "to look". A sweep that rewrote every bare final vowel in
place would have destroyed the second one. `test/rulings.test.ts` now pins both
readings so it cannot happen silently.

### Not a bug: `nay1ma`

While auditing the bare-vowel rows, найм → `nay1ma` looks like a typo with a
stray digit. It is not. The `1` is the FVS1 marker in our romanization scheme:
`y1` is YA + FVS1, giving ᠨᠠᠶ᠋ᠮᠠ, where plain `nayima` gives ᠨᠠᠶᠢᠮᠠ. Check
`toScript` before correcting a romanization that looks malformed.

## The linking vowel on -на/-нэ and -сан/-сэн, ruled 2026-07-29

**Asked rather than inferred, deliberately.** The evidence for these eight rows
was almost entirely the held-out gold set — 4 of 4 consonant-final stems linked
on the present-future, 5 of 5 on the past participle, none flat either way.
Applying it from that measurement alone would have been fitting to the test
set, which is the failure `mine-verb-suffixes.mjs` had just been guarded
against in the same session. So the rows waited for a human.

Six open words, two controls. The reader ruled **linked on all six**:

| | was | now |
|---|---|---|
| авна | `abn-a` | **`abun-a`** |
| төрнө | `törn-e` | **`törün-e`** |
| үнсэнэ | `ünüsn-e` | **`ünüsün-e`** |
| бэлдсэн | `beledγsen` | **`beledüγsen`** |
| төгссөн | `teγüsγsen` | **`teγüsüγsen`** |
| зориулсан | `ǰoriγulγsan` | **`ǰoriγuluγsan`** |

Verb gold **42.6% → 47.2%**; participle-past 34.8% → 45.7%, present-future
44.4% → 59.3%, harvested tier 84.0% → 93.8%. 76 of 43,186 corpus entries
changed. Nothing outside the two groups moved.

### The controls are what make it a rule and not a habit

Both were included so a reader answering "linked" to everything would be
visible rather than silently confirming the hypothesis. Neither did:

- **судлаж stays flat** `sudulǰu`. суд- ends in a consonant and -ж is
  consonant-initial, so had this gone the other way the rule would have been
  "every consonant-initial suffix", and the imperfective converb rows would
  have needed the flag too. It is therefore **per-suffix**, which is why
  `linking` is a property of the row rather than logic in `joinVerb`.
- **ашиглаад inserts nothing.** The condition is the *stem* ending in a
  consonant, not the suffix beginning with one.

### What the second control also exposed

The reader glossed ашиглаад "having used" — a verb. Our top-1 is `asiγla-du`,
the dative of a noun ашигла. Their verdict was between two verb spellings, so
it does **not** rule on which reading should win, and promoting the verb on the
strength of it would be inventing a mandate they did not give.

Recorded as a todo in `test/rulings.test.ts`, and the assertion for that
control goes through `parseVerb` rather than `convert` so it tests the thing
that was actually ruled. A control that fails for an unrelated reason is still
telling you something; it is just not telling you what you asked.

## Дэвсгэр, and where the гэдэс actually goes (2026-07-29)

The reader supplied the generative rule behind two things this project had
only ever encoded as tables.

**Consonants split by whether they can end a word.** *Дэвсгэр* can be final and
can be followed by another consonant. *Үл дэвсгэр* always has a vowel after it.
Дэвсгэр splits again:

- **хатуу дэвсгэр** — б г р с д
- **зөөлөн дэвсгэр** — н м л нг
- **үл дэвсгэр** — everything else (в ж з п т ф ц ч ш …)

### The dative rule was already implemented, and is now confirmed

Хатуу takes the т-version (`tu`/`tür`), зөөлөн and vowels take the д-version.
`src/generate.ts` already carried this as `HARD_FINALS` and even used the term
"Хатуу дэвсгэр"; the reader's statement is independent confirmation rather than
news. Measured over the 178 dative forms in `harvested-inflected.json`:

| stem ends in | `-du-` | `-tu-` |
|---|---|---|
| зөөлөн (н м л нг) | **75** | 0 |
| хатуу (б г р с д) | 2 | **56** |
| vowel | **40** | 0 |

The two exceptions are ташуур and өхөөр, both ending in `р`, where the harvest
wrote a d-form. Our rule-based output disagrees with the harvest on both and
follows the rule. **Trust the rule; those two are harvest errors.**

### Гэдэс goes in only at an *attached* junction

The reader's correction, verbatim: *"no gedes, it only apply when the suffix is
written with the word… -du is a suffix that uses MVS and is visually separate
from the word."*

So the dative can never take гэдэс, whatever the stem ends in — it is
MVS-separated by definition. Our suffix table already marks those rows
`separate: true`, and the verb rows, the only ones carrying `linking`, have no
`separate` field because they are all attached. The architecture was right for
reasons nobody had written down.

**Attachment is necessary, not sufficient.** судлаж is attached and takes
nothing; авна is attached and takes it. Both stems end in a дэвсгэр consonant
(`l`, `b`). So `linking` stays a per-row flag and does not become a rule over
junctions.

### Foreign words are exempt, and must never be used to derive a rule

**Retracted the same day.** An earlier version of this section reported "133
malformed stems" — every stem in the two lexicons ending in a bare үл дэвсгэр
consonant — on the strength of the reader giving массаж = ᠮᠠᠰᠰᠠᠵᠢ, `massaǰi`.
That inference was wrong, and the reader corrected it within the hour.

The reader's rule, in full:

> Foreign words most of the time are written exactly like the cyrillic one
> unless we know of a traditional spelling. … all үл дэвсгэр takes a vowel
> after it, and again, **doesn't apply to foreign words**. … **don't derive
> rules from foreign words.**

So the үл дэвсгэр rule is real and general, and the 133 stems are outside it,
because every one of them is a loanword. They are not malformed. The two
reader-supplied forms differ precisely on this axis:

| | | why |
|---|---|---|
| массаж | **ᠮᠠᠰᠰᠠᠵᠢ** `massaǰi` | has a known traditional spelling, so the vowel appears |
| целлюлоз | **ᠼᠧᠯᠯᠶᠦ᠋ᠯᠦᠽ** `cēllyü1lüz` | no traditional spelling, written as the Cyrillic is — **ends bare on ᠽ** |

Both are now curated rows.

**The toli oracle was not "inconsistent" here — it was wrong.** Its
целлюлоз → `ceeluelo-ji` invents a final i by over-applying the rule to a
foreign word, while its агент → `ageent` and азот → `ajot`, which I had read as
suspicious, are simply correct. Reading a disagreement as evidence of a rule,
when the real explanation was a class exemption, is exactly the failure mode
that makes an unreviewed source dangerous.

**Method, not just fact.** Loanwords are the largest and most tempting source
of apparent regularity in this data — 133 stems is a bigger class than most
genuine rules cover — and they are the one class from which nothing may be
generalised. Any future rule derived by counting over the lexicons must exclude
them first, or it will discover the transliteration convention and mistake it
for Mongolian.

### Our целлюлоз was wrong in two further ways

Ours was `cēllü1loz` = ᠼᠧᠯᠯᠦ᠋ᠯᠣᠽ against the reader's ᠼᠧᠯᠯᠶᠦ᠋ᠯᠦᠽ. Beyond the
bare final, which we had right:

- **ю is ᠶᠦ (YA + UE), not bare ᠦ.** We dropped the й glide.
- **The second о is ᠦ (UE), not ᠣ (O).**

Both are transliteration-convention errors on a foreign word, so per the rule
above they are recorded as facts about these two words and **not** propagated
to the other loanwords by analogy.

## ᠰ against ᠱ (2026-07-29)

Reader: *"the double dotted one is only for foreign, or traditional spelt
words."* So a native Mongolian word takes plain **ᠰ** even where the Cyrillic
writes ш; the double-dot **ᠱ** marks a loanword or a fixed old spelling.

They gave a **minimal pair**, which is the sharpest possible form of the rule —
the letter alone separates two words that are identical in Cyrillic:

| Cyrillic | script | meaning |
|---|---|---|
| шар | **ᠰᠢᠷ᠎ᠠ** `sir-a` | the colour, yellow |
| шар | **ᠱᠠᠷ** `šar` | a noise (шар шар гэж дуугарах) |

Both are curated rows; the colour ranks first.

### How a wrong letter shipped, and the lesson that generalises

шар had been changed an hour earlier, correctly, on the chachlag ruling. But
**both options put to the reader used ᠱ** — the question varied the final
vowel and held the letter constant. The reader ruled on what varied. The
constant rode along unasked and shipped wrong.

**A question fixes what it varies and silently asserts everything else.** When
a batch is built, every part of the form that is identical across the options
is an assumption being smuggled past the reader, not something they confirmed.
Vary one thing, and *know* what the others are claiming.

### Not swept, on purpose

Four curated rows still use ᠱ — багш `baγši`, шүд `šidün`, маргааш `marγaši`,
шинэ `šine` — and they are **not** being changed on the general rule, because
it contains its own escape hatch in "or traditional spelt words".

The toli oracle splits on exactly this axis and cannot settle it: plain ᠰ for
маргааш, шинэ and шөнө, but double-dot ᠱ for багш, ширээ, шал and дарш. It also
writes the *colour* шар as ᠱᠢᠷ᠎ᠠ, which the reader's pair says is wrong — the
second time in one session that this source over-applied a rule.

Applying the general rule to those four would be the same inference that
produced the retracted "133 malformed stems" claim above. They stay unasked.

### Confirmed on a fifth word, 2026-07-31 — and the four still stay

Reader, reviewing the rulebook appendices: **"шүү = сиү"**. So шүү is `siü`,
ᠰᠢᠦ, not the harvest's `šü1`. That is a direct verdict on one word and it is
applied to that word.

It is **not** applied to anything else, and the temptation was concrete: 173
harvested rows spell a ш as ᠱ, 152 of them native-looking (агш `γša`, жишээ
`ǰišiy-e`, даашинз `dašinǰa`). Rewriting them on this one answer is precisely
the move that `repairDevoicedGa` made across 224 rows and had to retract. One
answer about one word does not tell you the scope of a rule, and this rule
carries an explicit escape hatch.

A pass at making the **guesser** map ш → `si` generally was measured and
reverted: the inflected set goes 1,083 → 1,082, and the words it changes are
the ones the escape hatch might cover. What is safe and already shipped is the
narrower word-final case in `closeOpenSyllable` — a word ending in ш is `si` in
89% of native rows, and a bare final ᠱ is not a possible spelling at all.

**Still open**, and wants a discriminating batch rather than another single
word: whether багш, шүд, маргааш, шинэ and the 152 harvested rows take ᠰ or ᠱ.
Build that batch so the options vary *the letter alone* — the 2026-07-29 lesson
in this very section is that everything held constant across the options is an
assumption smuggled past the reader.

**Our harvested tier is vindicated here**: it already wrote ширээ `sireγe`,
хөшүүн `qösiγün` and дарш `darusi` with plain ᠰ against the curated tier's ᠱ.
The 135-row с→ш disagreement class that prompted this batch mostly resolves in
harvested's favour, so no bulk change is needed there either.

## ᠬ against ᠭ after с/ш/т/д (2026-07-29)

The harvest wrote асгах as `asqaqu` and батга as `badq-a`, putting **ХА** where
the Cyrillic plainly has г — but салгах as `salγaqu`, with **ГА**, because л is
not one of those finals. That looked like a real devoicing rule and had never
been ruled on.

Asked as six words. **The reader answered ГА to every one**, including салгах
and including the after-a-vowel control. So the rule is not too narrow, it is
wrong.

`repairDevoicedGa` in `src/orthography.ts`, applied at import.
**224 harvested rows corrected**, 1,125 corpus entries changed.

### Why it cannot live in `normalizeOrthography`

It **needs the Cyrillic**. ХА after с is perfectly legitimate where the Cyrillic
really has х — амсхий `amusqi`, зайлсхий `ǰailasqi`, гүдэсхэн `γüdüsqen` — and
nothing in the script distinguishes those from the devoiced ones. A script-only
rule fixes 221 rows and breaks 16.

It is deliberately conservative: it fires only when the Cyrillic has a с/ш/т/д
+ г cluster and **no** с/ш/т/д + х cluster anywhere in the word. A word carrying
both is left whole rather than half-repaired, because the Cyrillic cluster's
position is not aligned to the Classical letter's.

### The older verdict was overruled — by the reader, not by inference

`test/rulings.test.ts` had carried **тоосгоор → `toγusq-a-bar`, with ХА**, from
2026-07-26. тоосго is the same context as асгах, so the new rule collided with
it, and it was pinned as a curated row rather than rewritten — a human verdict
is not overturned by inference about what the human meant.

Asked, and answered the same day: **ᠲᠣᠭᠤᠰᠭ᠎ᠠ**, `toγusγ-a`. The pin is removed
and the assertion updated.

The 2026-07-26 block is titled *"contracts a suffix against an и/й-final
stem"*, and it varied the suffix while holding the stem constant. The letter was
never the question, so it was never the verdict. Third time in one session that
a batch's constants were mistaken for its findings — see шар, and the note under
ᠰ against ᠱ.

### Why the harvest had ХА at all

The reader's explanation, and it is the useful part:

> usually when the letter is precedes a vowel, you get the double-dotted
> version. And I think the newer version of Unicode has recognized the use case
> and the font correctly doesn't show double dot.

So ГА **before a vowel** is drawn with the double dot and without it elsewhere —
one letter, two shapes, exactly as the shape-name elicitation had it
independently: *"masculin g … loses the double-dot when not precedes a vowel"*
(`docs/shape-names.md`, S030). Older encodings reached for ХА to obtain the
undotted shape. Current Unicode plus a correct font renders ГА properly in both
positions, so the workaround is not merely wrong now — it was a *rendering*
fix encoded as a *letter* choice.

That is the same class of error as the Menksoft PUA this project exists to
avoid, and it is worth recognising the shape of it: **a glyph problem solved by
picking a different character.** Anything in imported data that looks like a
spelling irregularity confined to one visual context deserves this suspicion
first.

### The verb gold is now stale in three places

Verb gold reads 47.2% → 46.2% after this change, and that is the fixture
ageing, not a regression. Three of its answers carry the harvest's unrepaired
form: гүйцэтгэсэн `γüičedqeγsen`, цутгаж `čidquǰu`, шалтгаалж `siltaγalaǰu`.
Our new output disagrees with all three and follows the reader's ruling.

`harvested-inflected.json` is regenerated by the importer and picked the repair
up automatically (8 answers changed); `verb-gold.json` is built by a different
script and did not. **Left alone deliberately** — hand-editing an eval set to
match current output is the contamination pattern guarded against earlier the
same day. It should be regenerated from a repaired harvest, not patched.

### ✅ CLOSED 2026-07-31 — the rulebook says the harvest was right; the repair is withdrawn

**Read the section below for the reasoning that produced the repair, then this
for how it ended.** The 2026 national rulebook — adopted, not draft — states the
opposite of what we shipped, at §2.1.2.3, with two of our six asked words as its
own examples:

> ᠳ (-д), ᠰ (-с) дэвсгэрийн дараа дуутай ᠭ (-г) гийгүүлэгч орохгүй, харин
> дуугүй шинжээр зохицон ᠬ (-х) гийгүүлэгч орно. Жишээ: баясгалан, өтгөн,
> **тосгон**, **сэтгэл**.

So the harvest's ХА was correct, `repairDevoicedGa` inverted a real rule across
224 rows, and the 2015 Цэвэл's 44 "disagreements" were 44 agreements with the
law. The call is withdrawn from `import-harvest.mjs` and
`export-training-data.mjs`; the function and its tests remain, unused, because
the *inverse* rule is worth enforcing on generated output later.

**Why six reader answers did not outvote it, stated plainly so the pattern is
reusable:** the rulebook is silent on exactly the two words the reader and it
agree about — салгах ends in л and агаар in a vowel, neither a д/с дэвсгэр — and
contradicts all three it covers (дасгал, босгох, батга). That is not six-to-one.
It is a rule that reaches half the batch and disagrees with all of that half,
which is what a leading question looks like from the outside: five of six pairs
offered ГА as the change, under a note reading "we emit ᠬ".

Measured effect of the revert: verb gold 46.2% → **47.2%**, harvested tier
91.5% → **93.9%**, and the harvest grew **8,680 → 9,048 rows**, because 368
repaired forms had been failing round-trip or lint and getting quarantined. The
repair was costing coverage as well as correctness.

**One word survives as a lexical exception.** тоосго stays `toγusγ-a`, now as an
explicit curated row in `src/data/lexicon.ts` rather than as a side effect of a
224-row rule. The reader supplied ᠲᠣᠭᠤᠰᠭ᠎ᠠ for that exact word on 2026-07-29,
overruling the 2015 source directly — that is the strongest kind of evidence we
hold, it is about one word, and a lexical exception is a row you delete in one
line. **Still open for the reader:** whether тоосго is genuinely exceptional or
whether the rule governs it too.

### The superseded case for the repair, kept for the reasoning

**Not a retraction — a question that has not been put to the reader.** The
ruling covered six words. `repairDevoicedGa` fired on 224.

**Not a retraction — a question that has not been put to the reader.** The
ruling covered six words. `repairDevoicedGa` fired on 224.

Graded in script against `.tmp/toli/` (the 2015 Цэвэл digitisation described in
`docs/harvest.md`), of the 221 changed rows it has an entry for 111:

| | rows |
|---|---|
| toli agrees — writes ГА | 61 |
| **toli disagrees — keeps ХА** | **44** |
| no с/ш/т/д + velar cluster in its form | 6 |

The four asked words toli covers — дасгал, босгох, батга, салгах — are all in
the agreeing 61, so the ruling itself is confirmed. The disagreement is entirely
about the *generalisation*, and it includes high-frequency stems: сэтгэл
`sedqil`, тосгон `tosqun`, урсгал `urusqal`, устгах `usadqaqu`, хувьсгал
`qubisqal`, хатгах `qadququ`.

**toli is not authoritative here and is known wrong at least once in this exact
class**: it writes тоосго with ХА, and the reader overruled it directly on
2026-07-29 (above). It also over-applied a rule twice elsewhere the same day
(целлюлоз, шар). So this is not evidence the repair is wrong.

It is also not internally rule-shaped: toli splits дасгал `dasgal` (ГА) against
урсгал `urusqal` (ХА), same -сгал ending — which is either a lexical split we
have not modelled or digitisation noise, and we cannot tell which.

**What to do:** ask, do not infer. A batch of six drawn from the disagreeing 44
— weighted to the high-frequency stems — settles whether the repair is a rule or
whether it has an exception class. Until then the 224 rows stand on the ruling
that produced them, in a tier labelled unreviewed. Do **not** revert them on
toli's word alone; that would be the retracted-inference pattern in reverse.

## The directive, ruled 2026-07-30

Asked after a UI test: `монголруу` came out `monγulru`, which is nothing. The
ruling, in the reader's words:

> "in bichig, always separate, but in cyrillic, either is accepted. (руу рүү
> луу лүү, but always urugu regardless of gender of previous word)"

and then, unprompted, the rule that made it safe to implement:

> "in cyrillic луу лүү only gets used when the host word ends in letter р
> specifically: гэр лүү / айл руу / цэрэг рүү / нуур луу"

Three facts, each doing separate work:

1. **One Classical form for four Cyrillic surfaces** — `uruγu`, no harmony.
   There is no feminine `urugü`. This is the one case in the table that does
   *not* harmonise, so the converter's normal reflex produces a form that does
   not exist. The harvest had already made that error in the other direction,
   shipping рүү as `rüü` — a passthrough of the Cyrillic, not a conversion.
2. **Always a separate word in bichig, joined by a plain space.** So it cannot
   be a suffix row: `assemble` joins with `-` (MVS) and `toScript(' ')` throws.
   It is a token-level split instead — `src/clitics.ts`.
3. **The л-forms only after a host ending in р**, the р-forms only otherwise.
   This is what makes the split safe rather than merely possible.

**The trap, and it cost 0.8pp before `eval.mjs` caught it: луу is also
"dragon".** Curating the directive at freq 1 short-circuited 23 inflected gold
forms of the animal (лууг `luu-yi`, луунуудаараа `luu-nuγud-iyar-iyan`). The
postposition never inflects, so the dragon takes the bare word and every
suffixed form, and the л/р rule decides the rest from context — which is why
`frequencyRanker` now reads the previous token for this one case. руу, рүү and
лүү have no lexical homograph and needed none of this.

Swept over 26,876 single-word types, 41 of which end in a directive surface:
**no splits that should not happen.** The one leak found in review was яруу,
absent from every lexicon tier while `я` is present, now fixed both ways
(a curated row, and a two-character minimum on the host).

## No FVS on native words (2026-07-30)

Also from the UI test:

> "there is this mvs + d1e / d1a outputs regarding даа дээ but it must always
> be mvs + da / de (no fvs). fvs is mostly used in foreign, or traditionally
> spelt words."

The harvest writes даа as `d1a` (DA + FVS1 + A) and дээ/дөө as `d1e`. Those are
as native as words get. Curated rows now override them, along with дахь and дэх,
where the canonical registry already said so — `references/suffixes.md` lists
ᠳᠠᠬᠢ `daqi` and ᠳᠡᠬᠢ `deqi` with no selector, and the harvest had `d1aqi`/`d1eqi`.

**Not generalised.** 467 harvested rows carry an FVS digit somewhere, and the
reader's own phrasing ("mostly") does not license a sweep. Some of those rows
are foreign words that should keep it — дата `d1at1a`, дани `d1ani`, дайжест
`d1aiǰēst` — and deriving a rule from that class is the mistake this project has
already made once. Asked as a batch instead (дал as the native case, дата as the
foreign control); until it comes back, only the five ruled words change.

## The -в past and the -гч agent (2026-07-30)

болов came out `bolub`. The reader confirmed `bolba`, and the corpus had the
answer all along — 60 of 70 forms on a known verb stem, split by harmony.

**No linking vowel on -в, and that is measured rather than assumed.**
Consonant-final stems run 3 flat (болов `bolba`, төгсөв `teγüsbe`, сонсов
`sonusba`) against 1 with the vowel (авав `abuba`) — and `ab` is the same stem
that takes it 14 times out of 14 on the perfective converb, so the odd one out
looks like a property of that stem. Sent to the reader to settle.

**`-гч` was excluded by an objection that was never about it.** `verb-suffixes.ts`
refused a row for `-ч` because two suffixes are counted as one there, which is
true and still stands for bare `-ч`. `-гч` is only ever the agentive: 162 forms
on a known verb stem, 162 reading `Vγči`, no competing reading, and the linking
vowel unanimous the other way (36 of 36). It was missing because nobody measured
the two endings apart.

## The aligned pool has never been mined for stems (2026-07-30)

Not a ruling — a gap the UI test exposed, recorded because it is the largest one
known. сүүлчийн is in `.tmp/aligned-words.jsonl` as `seγülči-yin`, attested, and
the converter scored it 0.0% anyway: that pool feeds `mine-verb-suffixes.mjs`
and nothing else. **2,031 of its 2,037 single-word types are in no lexicon
tier.** яруу `iraγu` was found the same way, by a bug rather than by looking.

Importing it is not mechanical — `verb-gold.json` is carved out of that same
pool, so a naive import trains on the held-out set, and the forms are inflected
rather than lemmas. But two of the five failures in a two-sentence test were
words whose right answer we already had on disk.

## Second round, 2026-07-30 — the ask page and a spot check

### Confirmed, now shipping

- **хөрвүүлэгч = `qörbeγülüγči`** — the `-гч` agent takes the linking vowel on a
  consonant-final stem. Corroborated independently by the spot check, where
  зорогч `ǰoruγči` was marked right.
- **сүүлчийн = `seγülči-yin`.**
- **дата keeps its FVS** (`d1at1a`). Foreign words are exactly where a variation
  selector belongs, which is the control that makes the даа/дээ ruling safe.

### The FVS ruling is narrower than it looked, and the trap was a homograph

U4 (дал) was skipped, and the note is worth more than an answer would have been:

> "d1al - дал (as in дал мод), dala - number 70, shoulder blade, palm, in case
> даа/дээ, it was a suffix, not a word. so the fvs1 version only refers to the
> tree that produces coconut"

So `d1al` was never an error: **дал is two words**, and the variation selector
is what tells them apart — the palm tree keeps it, the number 70 and the
shoulder blade do not. Sweeping FVS off the 467 harvested rows that carry one
would have destroyed a distinction, not fixed a bug. Refusing to generalise
without asking was the right call, and this is the second time in a week that
the reason was "the harvest is right and the word is ambiguous".

Still open: дал needs its second reading (`dala`), which we do not have.

### The linking vowel is u/ü, always — but *whether* is lexical

U2 came back `abuba`, with the general fact attached:

> "in cyrillic it's ав + в, and cyrillic itself gets a linking 'а' vowel, but in
> mongolian, it gets у because we only ever use у or ү as linking vowel"

That settles *which* vowel and says nothing about *whether* — which matters,
because the same reader confirmed `bolba` (flat) hours earlier. So on the -в
past: бол, төгс and сонс take none, ав takes one. авав is a curated whole form
rather than a rule, and the `linking` flag on the -в rows stays off.

**Do not reconcile these two by inference.** Both are reader-confirmed; the
disagreement is real and belongs to the stem.

### Three rules from the spot check

- **-лаг⁴ is always `lig`.** загварлаг = `ǰaγburlig`, оюунлаг = `oyunlig`,
  attached, no connector, no harmony. *"exactly same logic as style + ish =>
  stylish."* The second suffix this week whose four Cyrillic surfaces collapse
  to one bichig form, after the directive.
- **The -нх- stack is genitive + reflexive, and the Cyrillic х is nothing.**
  ангийнхаа = анги + ийн + аа = `angγi-yin-iyan`. `docs/roadmap.md` guessed
  `ang-un-iyan` and was wrong on both halves — the stem is `angγi`, not `ang`,
  and a vowel-final stem takes `yin`. Now a fused row under its own
  `case-possessive` category, because its allomorph conditions are the
  genitive's three-way set, not the reflexive's two-way one.
- **морийг: the stem is морь**, not мор.

### The genitive n on a vowel-final stem — NOT yet implemented

The largest rule in the batch, and the one behind most of the X-group
corrections (болзооны, ярилцлагын, судалгаанаас, хугацааны, хоолны, харааны):

> "when mongolian script words end with vowel, we have option to prepend
> ын/ийн… the first, and more common way of doing it is append n and -un, so
> for the хараа example, the word itself ends in -а ᠬᠠᠷᠠᠭ᠎ᠠ (хараг-а), and most
> people would decide to add n before appending -у, but it'd be also
> gramatically correct if we do хараг-а-йин"

So a chachlag stem takes **either** stem + n + `u`/`ü` (more common) **or**
stem + `-yin`. We currently emit only the second, and often on a wrong stem
besides. Both are grammatical, so this adds a candidate rather than replacing
one — which is the safe shape for a change this wide. Left for its own round
with its own measurement.

### Where the corrections actually land

Of the 20 spot-check items with a verdict, 14 were "The silver is right" or
"both wrong", and almost none of those were suffix-table errors: they were
**stem** errors (мор vs морь, тün vs tegün, körüng vs körüngge, qoln vs
qoγula). That is the same finding as the guess tier scoring 0.0%, arriving from
a different direction — the suffix machinery is in better shape than the
dictionary it runs on.

## ★ The 2026 rulebook, read end to end (2026-07-31)

`.tmp/20260730/Монгол бичгийн зөв бичих дүрэм.pdf`, 66 pages, delivered
2026-07-30 and unread for a day. Full transcription notes in
`.tmp/rulebook-notes.md`; the canonical extraction now lives in
**mongol-bichig `references/rulebook-2026.md`**, which is where script facts
belong.

**It is not a draft.** Pages 65–66 are the approving resolution — Хэлний
бодлогын үндэсний зөвлөл, 2026-02-11, дугаар 02, clause 2: "Үндэсний бичгийн
зөв бичих дүрмийг бүх нийтээр дагаж мөрдсүгэй." Both `docs/rulings.md` and the
session memory had called it "the official DRAFT prepared for the 2025 law".

### Precedence, now that a binding source exists

Where the rulebook speaks it outranks Poppe, the 2015 Цэвэл, and any single
reader answer it contradicts. Where it is silent — encoding, FVS, PUA, anything
about Unicode — it says nothing at all and the reader remains the only
authority. `test/rulings.test.ts` keeps its standing for everything outside the
rulebook's scope.

That is a narrower claim than "the book wins". Two of this session's four
withdrawals were of *inferences we made from reader answers*, not of the answers
themselves, and the rulebook's real value was settling what a small ask page
structurally cannot: whether an answer about six words is a rule.

### What it confirmed, unchanged

- The dative -д/-т split by хатуу/зөөлөн дэвсгэр (already implemented).
- `-сан⁴` → `γsan/gsen` (reader, 2026-07-27).
- The directive has **one** Classical form regardless of gender (2026-07-30).
- The `-гч` agent takes the linking vowel on a consonant-final stem (2026-07-30).
- The `-аад⁴` and `-на⁴` linking vowels (2026-07-29).
- The `-нх-` stack is genitive + reflexive (2026-07-30) — Хавсралт 2 rows 12–17
  give it as a four-way paradigm.

Six independent confirmations of reader verdicts is itself the finding: the ask
loop produces correct answers. What it cannot do is tell you how far one
generalises.

### What it changed

1. **`repairDevoicedGa` withdrawn** — see the section above.
2. **The imperfective converb is one ending with two variants.**
   §2.2.2/16: **-ж after a vowel or зөөлөн дэвсгэр, -ч after a хатуу дэвсгэр.**
   `src/data/verb-suffixes.ts` refused bare -ч because mining could not separate
   it from the agentive noun-former (33% `či` / 21% `ǰu` / 21% `ču` / 17% `ǰü`,
   no majority). That objection was about *evidence* and was correct; the
   rulebook separates them by *condition* — the converb -ч occurs only after a
   хатуу дэвсгэр and the agentive -аач⁴ only after a vowel.

   The Cyrillic letter does not decide. **босож is spelled with ж and is
   `bosču`**, because `bos` ends in с. We were emitting `bosǰu` and `nisčü` →
   `nisǰü`, both wrong — and the file's own comment had named `bosču`/`nisčü` as
   the attested forms while leaving them "to the generator", which never did it.
   авч, сурч and өгч did not parse at all.
3. **The -в past's linking vowel is a rule, not a lexical split.** §2.2.3/39–40:
   a **б-final** verb stem inserts у/ү. `ab` ends in б; `bol`, `teγüs`, `sonus`
   end in л/с/с. One condition predicts all four attestations. `docs/rulings.md`
   had recorded "Do not reconcile these two by inference. Both are
   reader-confirmed; the disagreement is real and belongs to the stem." Both
   answers were right; the inference that it was lexical was wrong. авав now
   converts `abuba` rather than `abba`.
4. **`hiddenN` has a name and a job.** The rulebook's **тогтворгүй н** is a
   first-class condition on the genitive *and* the dative (Хавсралт 2.1.1 rows
   1–2), not an annotation. `LexiconEntry.hiddenN` exists, is set on 13 curated
   rows and zero harvested ones, and is mechanically derivable. Now the highest
   -value unimplemented item.

### Still unimplemented, in rough value order

- **тогтворгүй н** on the genitive and dative (above).
- **The genitive n on a vowel-final stem**, ruled 2026-07-30 and still open —
  Хавсралт 2.1.1 gives `-yin` for vowel-final stems and `-u/-ü` for
  тогтворгүй-н words, which is the same two-way choice the reader described.
- **§2.1.2.4, н → нг before a г/х/н-initial suffix** — хан + гах = хангах.
  Categorical, mechanical, and we do not do it.
- **The causative -га⁴/-ха⁴ split** by д/с (Хавсралт 1.2.2 rows 2–3).
- **The passive -д/-т** and the pluractional **-цгаа⁴**, both by хатуу/зөөлөн.
- **Хавсралт 3–5**: 113 pronoun forms, 144 particles/conjunctions, and 59 forms
  of гэ-, as exact closed inventories. The single largest correct-data import
  available to us — гэ- alone is the commonest verb in running text. Blocked on
  a higher-resolution scan: the appendix bichig column is too small to
  transcribe by eye, and guessing at it would be exactly the fabrication the
  romanization discipline exists to prevent.

### ⚠ Four contradictions with the shared registry, unresolved

The rulebook splits suffixes cleanly — **нөхцөл are дагуулж, дагавар and verb
endings are залгаж** — and mongol-bichig's registry disagrees in four places.
Listed with citations in `references/rulebook-2026.md` §2.3. The consequential
one is the **directive**: we emit a plain U+0020 space, the rulebook classes
руу/рүү as the seventh тийн ялгал written дагуулж like the genitive, and MVS
versus space render as the same visible gap — so the 2026-07-30 reader ruling
("in bichig, always separate") does not discriminate between them. Not changed;
it needs the owner.

## ★ The appendix diff round, ruled 2026-07-31

The first reader pass over the rulebook appendices. The method mattered as much
as the answers: instead of asking "is our output right?", the page put the
**scan crop and our own rendering side by side**, both trimmed to ink and scaled
to the same width, ranked by how differently they measure. The reader is then
not judging bichig at all — only whether two pictures match. Entries verified as
matching score 0.00–0.07 on that measure; the worst offender scored 3.15.

### Applied — twelve forms, 36,422 corpus occurrences

Each of these was ruled on individually. Nothing below is inferred from a
neighbouring row.

| entry | was | is | occurrences |
|---|---|---|---|
| шүү | `šü1` | **`siü`** | 23,049 |
| гэлээ | `γel-iyen` | **`gel-e`** (chachlag) | 5,415 |
| яах | `yaqu` | **`yaγaqiqu`** | 4,389 |
| гэжээ | `γeǰü-ben` | **`geǰei`** | 2,610 |
| гэмээр | `γem-iyer` | **`gemer`** | 721 |
| бээр | `bui-ber` | **`ber`** | 169 |
| пиг | `pi-yi` | **`pig`** | 27 |
| гуд | `γu-du` | **`gud`** | 24 |
| гэгд | `γe-yi-dü` | **`gegde`** | 14 |
| бүлт | `büli-tü` | **`bülte`** | 3 |
| гэцгээ | `γeče-ben` | **`gečege`** | 1 |
| гэмээ (нь) | `γem-iyen` | **`geme`** | — |

One bug produced most of the гэ- rows: the segmenter read a long-vowel **verb**
ending as a stem plus a **case** ending, so гэмээр parsed as гэм + instrumental.
The reader's framing is the correction — "most of these words start with гэ …
sth related to saying, гэх (infinitive) root, and attaching". Neither gold set
moves; both are lemma-derived and cannot see function words.

### ⚠ Retracted: my own reading of the бид- paradigm was wrong

Before this round I read the scan as `bidan-` for the whole бид- series (бидний,
бидэнд, биднийг …) and wrote that into the review page as "I read the scan as".
The reader's verdict on бидэнд is that **ours is correct** — `biden-dü`. So the
reading was wrong, and had it gone in as data it would have shipped eight bad
rows silently.

This is the case *for* the picture-matching format rather than against it: the
render disagreeing with the scan is what surfaced it. **Do not import a form
transcribed from the scan by eye.** The transcription is a hypothesis to be
rendered and shown, never a fact.

### Confirmed correct, no change

бидэнд, яа, ямар, маны/манай, даа, маныг, таны, таныг, гэсэн аж. Several were
reported as "the screenshot is missing the suffix" — that was **a bug in the
crop tool, not the rulebook**: the routine stripping Хавсралт 5's `*` footnotes
also matched a detached case ending (ᠤ, ᠢ), which is small and follows a gap in
exactly the same way. Now restricted to the four entries that actually carry
asterisks. A separate, real truncation remains for multi-word entries — гэсэн аж
lost its аж — because the second word falls outside the detected column.

### Notes worth keeping

- **гэж has two readings.** `geǰü` is the common one and ours is right; the
  rarer `geǰi` is a different word, which is what its `***` footnote marks.
- **ямар has two spellings**, both correct: `yamar` and the traditional
  `yambar`. The appendix prints them side by side.
- **гэсэн** is written `gegsen` in the appendix; the reader's instruction is to
  keep our `gesen`.
- **шиг** is printed twice, and the difference is not romanizable: after a
  masculine word the final ᠭ takes the two-tooth form, after a feminine one the
  shilbe/chachlag form. Same letters, same romanization, different glyph — so
  this is an FVS question, and `docs/rulings.md` already records "no FVS on
  native words" (2026-07-30). Unresolved; do not act on it without asking.
- **гэмээ нь** — reader gave `гэмэ-ни` but flagged uncertainty over MVS vs
  space. We emit a space. Left alone.

### Still open — the reader said "no idea"

мөнөө (A3 88), хэлт (A42 31), сэт (A42 29), бүлт as the A3 105 totality word
(distinct from the A42 24 intensifier, which *was* ruled), хүү (A42 64 — ours is
`qöbeγün`, хөвгүүн, plainly a different word, but the right form was not given).

---

## ★ The parallel corpus round (2026-07-31)

A 79,071-line Cyrillic|bichig parallel corpus turned up (`tugstugi/mongolian-nlp`,
pure Unicode, zero PUA). It is **silver** — Inner Mongolia University's converter,
Inner Mongolian convention, pre-rulebook — so nothing here is a verdict. What it
provides is a *token-weighted* denominator, which no fixture in this repo had.
See `docs/data-and-accuracy.md` for the harness and the numbers.

### Three guesser fixes, each measured against attested data

Same evidence shape as the ц → `č` change: count how the native rows actually
spell the letter, exclude loanwords by galig range, and require the exception
rate to be near zero rather than merely small.

| change | native rows | agreeing | counterexamples |
|---|---|---|---|
| з → `ǰ` (ᠵ), never `z` (ᠽ) | 726 | 695 (96%) | **0** |
| й → `i` (ᠢ), never `y` (ᠶ) | 400 final / 848 medial | 395 / 831 (99% / 98%) | **0** final |
| н → `ng` (ᠩ) before г or х | 253 / 97 | 249 / 93 (98% / 96%) | see below |

ᠽ and a word-final ᠶ do not occur in a native word at all, so the two map
entries were producing forms that could not be Mongolian — зүрхний came out as
ᠽᠦᠷᠬᠨ᠎ᠦ, with a foreign letter in a native word.

**The н rule was scoped by measurement, not by plausibility.** Every following
consonant was counted separately, and only the two velars are clean: нг 98% and
нх 96%, while нш is 83%, нл 64%, нс 50%, нц 24%, нч 22%, нд 14%. So даанч
(`dangču`) is *not* swept in even though it looks like the same pattern — it
stays lexical. This is the check CLAUDE.md's ГА footgun asks for, applied
before the fact instead of after.

Effect: 3,693 of 43,257 words changed; 439 of them occur in the corpus, worth
7,466 tokens = **1.66% of running text**. Guess tier 14.1% → 17.3% token
accuracy. A test asserting `guessStem('газар') === 'γazar'` had to be updated —
its own comment said "the guesser cannot know that Cyrillic з corresponds to ǰ",
which was the thing the measurement disproved. That is the characterization-test
hazard in miniature: it had frozen a known gap as expected behaviour.

### ⚠ Retracted: §2.3.1 does not mean the pronoun forms are fused

Earlier the same day I read rulebook §2.3.1 — *"Жич: pronoun case forms (миний,
чиний, надад, намайг, чамайг) are written joined by convention"* — as saying we
should stop emitting these with an MVS, and put the figure at ~2.4% of running
text. **That is wrong**, and two independent things say so:

- The silver attests `nada-du` (надад), `biden-ü` (бидний), `tan-u` (таны) — all
  MVS-connected;
- the reader ruled on бидэнд on 2026-07-31 that **ours is correct**, `biden-dü`,
  which is the detached form.

A standing reader verdict outranks my reading of a Жич. "Joined" evidently does
not mean fused here. Nothing was changed on the strength of it.

What **is** genuinely wrong is the oblique stem: we emit ᠴᠠᠮ (`čam`) where the
attested stem is `čima`/`nama` — чамайг, чамд, чамдаа, чамайгаа, чамтай,
чамаас, чамтайгаа, намайгаа, чам together are ~6,100 corpus tokens. But that
paradigm is suppletive (`nada-` in the dative, `nama-` in the accusative) and
its authoritative bichig is in Хавсралт 5, which is deliberately untranscribed.
**Queued, not implemented.**

### Wiktionary is a second opinion, not a source

The kaikki.org extraction (6,623 headwords) was evaluated as an import and
rejected on measurement:

- as a lexicon tier it would add **31 words worth 351 corpus tokens (0.078%)**,
  and 17 of those are Wiktionary's *affix* headwords (-аа, -лт, -чин), which in
  a stem lexicon corrupt lookups;
- where it disagrees with the harvested tier, the third source sides with
  **harvested 37 times to Wiktionary's 18** — it is ~2:1 more often wrong than
  the data we already have.

It is kept as `scripts/crosscheck-wiktionary.mjs`, which reports **964
agreements** (independent confirmation of a harvested row) and **110 conflicts**
(the queue). Owner ruled 2026-07-31 that pairs may ship as facts under MIT if
ever wanted; the measurement is why they do not.

### Open, ranked by corpus tokens — the next asks

1. ~~**чам-/нам- oblique stems** (~6,100 tokens). Ours ᠴᠠᠮ, silver ᠴᠢᠮ᠎ᠠ.~~
   **Answered 2026-08-04** — see the section below. The silver's ᠴᠢᠮ᠎ᠠ was
   right about the bare word and would have been wrong for every suffixed one.
2. ~~**-гүй** (~3,000+ tokens). MVS or space is the question.~~
   **Answered 2026-08-03 — a space**, on five stems. Implemented in
   `src/clitics.ts`.
3. ~~**ч** (4,982 tokens). Ours ᠴᠢ; Wiktionary *and* the silver both say ᠴᠤ.~~
   **Answered 2026-08-03** — `ču`/`čü`, MVS-connected, harmonised with the word
   before it. Implemented in `src/particles.ts`. Our ᠴᠢ was the pronoun чи.
4. ~~**Verb + -лаа/-лээ past** (~1,200 tokens).~~ **Answered and implemented**
   2026-08-05; verb gold's `past-or-nominal` bucket 12.5% → 87.5%.

**The list is empty, and the 2026-08-06 spot-check below is what replaces it.**
Every ask on it was about a *word class we had no reading for*. What the
spot-check found is different in kind: the readings exist and are correct, and
the inflected form throws them away. The next asks should come from that.

## The oblique pronoun stems, ruled 2026-08-04

Closes open ask #1 above, the heaviest one on the list. Six forms were put to a
reader; five are now asserted in `test/rulings.test.ts` and the sixth is an
`it.todo` there for a reason given below.

| Cyrillic | Ruled | Was | Shape |
|---|---|---|---|
| чамайг | `čimai` | `čama-yi` | **solid, one word** |
| намайг | `namai` | `nama-yi` | **solid, one word** |
| чам | `čim-a` | `čima` | chachlag — **shipped 2026-08-06, see below** |
| чамд | `čim-a-du` | `čima-du` | chachlag, then `du` |
| чамдаа | `čim-a-du-ban` | `čima-du-ban` | chachlag, connector at both joins |
| чамайгаа | `čimai-ban` | `čamai-ban` | derived off the new чамайг row |

**The accusatives are a traditional spelling, not a rule.** `čima-yi` is what
чиглэхийн тийн ялгал gives and the reader confirms it is *technically* correct —
the solid one-word form is simply the one that carried over, and it is what a
reader expects to see. They are therefore **whole-form lexicon rows**, not an
accusative allomorph: the accusative is regular everywhere else and must not
learn an exception from two pronouns. This is the CLAUDE.md footgun — *prefer a
lexical row to a rule when the evidence is a list of words* — applied on
purpose, and the reader volunteered the "technically correct" caveat unprompted,
which is what makes the scope readable at all.

Both were previously built on a **guessed stem that exists in no tier** — `čama`,
`nama` — so this was not a near miss. чамайг alone is 1,967 corpus tokens and
намайг 1,904, the two heaviest Cyrillic tokens in the whole guess tier.

чамайгаа needed no row: the reflexive attaches to the new solid accusative and
falls out as `čimai-ban`. That is asserted, because it is what proves the row
functions as a stem rather than as a whole-form shortcut.

### ✅ CLOSED 2026-08-06 — there was no two-spelling problem

The reader settled чамаас as **ᠴᠢᠮ᠎ᠠ᠎ᠠᠴᠠ = `čim-a-ača`**, adding *"for some
reason the chachlag got lost… чам = čim-a"*. So the chachlag is retained under
suffixes exactly as it is everywhere else, and **one row spells every form**:
чам `čim-a`, чамд `čim-a-du`, чамаас `čim-a-ača`, чамдаа `čim-a-du-ban`. The
accusative rows чамайг `čimai` and чамайгаа `čimai-ban` are unaffected — those
are solid by a separate ruling.

**Why the ask could not have caught it, which is the part worth keeping.** The
чамд question offered three options — `čima-du`, `čimad`, `čimada` — and **none
of them carried a chachlag**. The reader picked the best of what was listed;
that pick was then read as a verdict on a chachlag they were never shown, and
two days of reasoning were built on it, including a claim in this file that a
bare-form key on `LexiconEntry` was needed and that retention would "trade a
correct rare form for a broken common one". All of it followed from a premise
the question had manufactured.

This is CLAUDE.md's ask-page footgun in a second costume. The recorded version
says *an ask answers about words, it cannot tell you a rule's scope*. Add to it:
**an ask cannot tell you about a form it does not offer**, and silence across
all options is not evidence. When every option shares a feature, that feature is
a constant the batch is holding fixed — the same shape as шүд, where the reader
rejected both offered spellings and corrected a letter the batch was not asking
about.

алт/тос stay blocked on `hiddenN` — that todo is real, and unrelated to this one.

## The release spot-check, ruled 2026-08-06

Two rounds of verdicts on the 0.3.0 diff, before publishing. The headline:
**no regressions.** Every word ruled wrong was already wrong in 0.2.1, and six
verdicts confirmed changes made in this release — мэдэхгүй splitting off its
`ügei`, шүү `siü`, байлаа `bail-a`, авлаа `abul-a`, хөгжсөн `qöγǰiγsen`,
парламентын `parlamēn1t-un`.

Three were fixed as rows, and are asserted in `test/rulings.test.ts`:

| Cyrillic | Ruled | Was |
|---|---|---|
| дизайн | `d1izain1` | `diǰain` — no FVS on either letter |
| боловч | `bolbaču` | `bolubči` — the concessive read as a verb ending |
| хомхой | `qomuqai` | `qomqui` |

A fourth correction, чамаас `čim-a-ača`, overturned this release's own pronoun
rows and is written up in the section above.

### The one diagnosis under almost all of the rest

The batch is worth more than its defect list, because the reader ruled on
**inflected** forms while the bare stems were already right:

| bare stem | | inflected | | reader |
|---|---|---|---|---|
| хэмжээ | `qemǰiy-e` ✓ | хэмжээнд | `qemǰen-dü` ✗ | `qemǰiyen-dü` |
| үнэ | `ün-e` ✓ | үнийг | `ün-i` ✗ | `ün-e-yi` |
| байшин | `baising` ✓ | байшингийн | `baišingγ-un` ✗ | `baising-un` |

**The stem is in the dictionary, correct, and attaching a suffix throws it
away.** The inflected form is rebuilt by the guesser rather than from the row
that already exists. That is one defect wearing eleven faces, and it is why
almost everything is an `it.todo` — rows would paper over the mechanism and
leave the next inflected form just as wrong.

Two things ride on it:

- **тогтворгүй н.** Volunteered by the reader three times without being asked —
  *"тогтворгүй н btw"* on хэмжээнд, on гараанаас (`γaruγan-ača`), and on зүрхний
  (`ǰirüken-ü`, from зүрх `ǰirüqe`). `LexiconEntry.hiddenN` records this and
  **no code reads it**. зүрх is deliberately *not* flipped to its citation form
  for the same reason алт/тос are not: until the machinery exists, the bare form
  regresses every oblique built on it.
- **The epenthetic vowel**: гишгэгдэх `γisqiγdeqü`, өнгөлүүл `öngγeleγül`,
  хомхой `qomuqai`, ингэснээр `ingγiγsen-iyer`, хүүхэлдэйн `qeüqeldei-yin`,
  ингээд `ingγiγed`.

### Two that are not that, and are worth their own work

- **дуурийн is `daγuri-yin`**, ours `dur-un`. The long vowel is a contracted
  medial γ — the decontraction `stem.ts` deliberately refuses to guess at,
  measured at 72.8% support across attested pairs and reaching 46.0% of
  guess-tier tokens. It now has ground truth behind it, not only a correlation.
- **хийн is a homograph and we emit neither reading.** The reader: *"there are
  two 'хийн' in cyrillic, first — 'of gas' = ᠬᠡᠢ᠎ᠶᠢᠨ so it's хий + н, and the
  second one is a conjugated version of хийх = хийн (as in 'while doing', same
  category as бодон)"* = ᠬᠢᠨ. So `qei-yin` and `qin`; we give `qi-yin` for both.
  Needs two rows *and* a ranker that can choose, which a static unigram cannot.

### Not swept, deliberately

байшингийн and гишгэгдэх both spell a Cyrillic ш as ᠰ, which looks like licence
to sweep the 152 harvested ᠱ rows. It is not. The reader's standing 2026-07-29
rule is that ш is for foreign and traditionally-spelt words — шар the cow being
their own example — and two more instances do not establish the boundary.

## Тогтворгүй н, and the rule that finds it — 2026-08-06

The rulebook has always named it (Хавсралт 2.1.1 row 1(b): the genitive is
`-u/-ü` "after н-final **and words with an unstable тогтворгүй н**"), the reader
volunteered it three times unprompted on 2026-08-06, and `LexiconEntry.hiddenN`
had recorded it since the beginning with **no code reading the field**. It was
the top item of `docs/roadmap.md` and the head of `pnpm check:orphans` was
nothing but this one defect. It is now implemented.

### The reader's rule, and why it is a default rather than data

> *"Here is an unconfirmed rule or a trick that I use for finding тогтворгүй н —
> most of the time, if the Mongolian Script version ends in a vowel (including
> chachlaga), we add unstable н… It has a really good success rate, but of
> course it has exceptions; from my day to day use it always works."*

`hiddenN` was set on **13 curated rows and zero harvested ones**, and neither
tier records inflected forms, so there was nothing in the data to derive it
from — насны, дууны, сарны, борооны all had a correct bare stem and no way to
know the н was there. The rule supplies the missing 30,000 answers at once.

Measured against the inflected gold set, it is worth **+19 forms on its own**
(1,097 → 1,116) and nothing regressed: the `chain wrong` and `no segmented
reading` buckets did not move, so it is purely additive.

It is applied as the **default behind the flag**, not as a replacement for it —
`entry.hiddenN ?? endsInVowel(entry.classical)`. The reader called it a trick
with exceptions, so the honest encoding is one an exception can override, and
`hiddenN: false` is how a confirmed exception gets written down.

**Read it off the script, not the romanization.** `qemǰiy-e` ends in `e` behind
a chachlag connector and `daγu` ends in a plain `u`; only `finalLetter` treats
those as the same question. This is the standing rule at the top of this file,
and here it is load-bearing rather than decorative.

### The one exception the whole suite turned up

**хэл `kele`.** Vowel-final, so the rule claims the н — and хэлэнд is `kele-dü`,
reader-ruled 2026-07-27, where the н is the **жийрэг н** Cyrillic inserts and
Classical does not have. Nothing in the Cyrillic separates it from усанд
`usun-du`; it is lexical, which is exactly what the flag is for.

That is one exception in 311 tests and a 2,316-word corpus diff, which is about
what "really good success rate" predicts. Expect more, and add them as rows.

### The two things that were wrong for a different reason

- **бид was `bida`, and is `bide`.** Caught by the reader mid-session. The бидэн
  row's own comment had been asserting `bide` in prose while the бид row spelled
  an a, and nothing ever compared the two. The letter matters here: `bide` + н
  is `biden`, the ruled oblique, so бидний needs no exception — under `bida` it
  came out `bidan-ü` and looked like an irregular restoration that needed one.
  **A wrong row can masquerade as a rule's exception.** Check the row first.
- **`dropLinkingN` strips a linking *vowel and* н** — it was written for
  хэл + э + н. A stem that already ends in a vowel takes no linking vowel, so
  хэмжээнд peeled to хэмжээн and overshot to хэмжэ, which is nothing, and the
  word fell to the guesser as `qemǰen`. The reader's `qemǰiyen-dü` needed both
  the flag and a second recovery path (`unstableNStems`).

### Where the н may be put back, and where it may not

`unstableNStems` only. Both recovery paths were given the restoration at first
and the audit took it back off `dropLinkingN`, on an argument that is about
correctness rather than score — **that function's premise is that the н is a
letter Cyrillic inserted and Classical does not have, so putting one back
contradicts the reason it exists.** It also strips two letters rather than one,
which is loose enough to land on a different word:

    тахингаа   тахин → тахи + н → the n-final `taqan`, which the vowel-final
               reflexive cannot attach to — the word lost EVERY reading
    биенд      биен → би + н — the pronoun "I", handed an н it has never had

Eight corpus words regressed that way and are now regression tests. The cases
it looked necessary for — модонд, усанд — reach their н without it.

The other half of the same lesson: the two recoveries are contradictory readings
of one letter, so `resolveStem` returns **both** and lets ranking choose, rather
than returning the first that matches. Returning only the narrower claim
silently deleted a stem that assembled in favour of one that did not.

### Two speculative steps must not stack

**бананы came out `ban-u`** — a banana read as the genitive of бан. The chain:
peel `-ны` → бана → the epenthesis rule offers бан → бан resolves as ба + н
through the new тогтворгүй-н path. Each step is individually reasonable and the
composition is nonsense. Two guards, both narrow:

- `unstableNStems` requires a **three-letter** stem. At two, the match is a
  coincidence.
- `stemForms` does **not** offer the vowel-dropped stem before -ны/-ний. The
  epenthetic vowel exists to break up a cluster between a consonant-final stem
  and a consonant-initial suffix; on these rows the leading н is the *stem's*
  own letter, so there is no cluster and nothing was elided. A stem ending in н
  takes -ы directly, as ханы does.

The general lesson is the one already in this file about the guesser inventing
consonants, in a new place: a propose-and-filter step is safe only while the
thing it proposes into is attested. Two of them in series filter against each
other's inventions.

### Two more the audit caught, both mine

- **A suffix beginning with н is not necessarily carrying the stem's н.** The
  plurals **-нар, -нэр, -нууд, -нүүд** also begin with one and it is entirely
  their own (`nar`, `nuγud`) — and they carry no `after` condition, so nothing
  else would reject a stem with an н glued on. багшнар became a coin flip
  between `baγsi-nar` and `baγsin-nar`, both at 0.47. The predicate is now
  `carriesStemN` in `data/suffixes.ts`, shared by the two call sites that need
  it so they cannot drift.
- **-ныхаа²/-нийхээ³ were missing**, though Хавсралт row 12 lists them beside
  -ынхаа²/-ийнхаа⁴ and says all four split "by the same three genitive
  conditions". усныхаа had no reading at all. Adding them exposed that a third
  surface was missing too — **-ыхаа/-ийхээ**, for a stem whose Cyrillic already
  writes the н (хаан → хааныхаа, тан → таныхаа), as against нас → насныхаа. All
  three now coexist and the stem lookup decides, because which one a word takes
  is lexical: тав `tabun` is also n-final and writes тавынхаа.

### What it closed

Four `it.todo`s in `test/rulings.test.ts`, all of which said in so many words
"blocked on hiddenN": хэмжээнд/гараанаас, хэмжээний, зүрх/зүрхний, and the
алт/тос citation-form flip. алт `alta`, тос `tosu`, давс `dabusu` and зүрх
`ǰirüqe` now spell the reader's citation form **and** keep the н in every
oblique — which is the "do both at once" that todo asked for.

## сайн is `sain`, verified against UTN #57 — 2026-08-07

Re-opened by the reader ("I'm starting to hesitate if sain is correct, or if we
should go with sayin"), and the answer is **`sain`, unchanged**. This time it is
checked against the primary source rather than asserted.

### What UTN #57 actually says

The claim in this file used to be "UTN #57 prefers the modern analyses
ail/aimag/taulai" with no citation. It is exactly right, and the sentence is on
**p.18** of `utn57-mong-4.pdf`:

> **Medial II in letter y and medial O in letter w.** […] the written form II of
> letter y in the examples **ayl** and **aymag**, and the written form O of
> letter w in the example **tawlay** are all differences derived from letter
> analysis. **Since ail, aimag and taulai are preferred, these written forms are
> marked in gray.**

"Marked in gray" is UTN #57's own notation for a written form it does not
endorse. And **p.15**, the entry for letter **i (U+1822)**, gives the two-tooth
medial form to *that* letter — with сайн as its worked example:

> `i  1822 … II.medi [D], AI.medi [R]: **sain**irögel`

So the two-tooth shape belongs to U+1822, and the document's own example of it
is our word. We emit `ail`, `aimag` and `taulai` verbatim.

### Why `sayin` is not a mistake either, and who makes it

The shape has been analysed three ways, and **the written form never changed** —
only the analysis did. Liang JinBao's survey (W3C i18n-mongolian list, 2015)
lists them with sources:

| analysis | сайн = | representative works |
|---|---|---|
| double coda of syllable | A + Y + L | 18th c., 1828, … 2009 (10 works) |
| **diphthong** | **A + I + L** | Lobsangwangdan 1951 → 2013 (17 works) |
| y + i, "no diphthongs" | A + Y + I + L | the 2012 Inner Mongolian dictionary |

> "the internal structure and the writing form of the word was not changed at
> all actually, but the recognition opinion of the linguists was changed in the
> different periods of time."

**The silver writing `sayin` is therefore not a bug in the silver** — it is the
third row, the Inner Mongolian line. `dropGlideYa` is not repairing an error; it
is converting between two live conventions, and this project is on the Mongolia
side of that split. Worth knowing before anyone "fixes" it back.

### The argument that actually decides it for *this* package

**The two-tooth form is produced by shaping, not by encoding.** Liang, on the
standardised theory: *"The two teeth form of ⟪i⟫ is used under vowel ⟪a⟫ ⟪e⟫
⟪o⟫ ⟪u⟫ and under ⟪ue⟫ in first syllable of the word."* A conforming font gives
you the two teeth from `A + I` alone.

So writing `A + YA + I` encodes **the glyph's appearance** rather than **the
word's letters** — which is the same category of error as Menksoft PUA, the
thing this package exists to not do. That is the reason to hold the line, and it
is stronger than a preference count.

⚠ Note also that this is an **encoding** question, not an orthography one, so
the 2026 rulebook is silent on it by construction — CLAUDE.md's own rule is that
where the rulebook does not speak, it says nothing. UTN #57 governs here.

### ⚠ One genuine conflict this turned up: найм

`test/rulings.test.ts` has найм as **ᠨᠠᠶ᠋ᠮᠠ** (`nay1ma`, YA + FVS1). UTN #57
p.15 lists найм under letter **i**, not y:

> `I.medi [L]: **naima**, NAIMA`

— the *single*-tooth medial I, which is also what r12a's Mongolian notes show
(ᠨᠠᠢ᠍ᠮᠠ). Our row's stated justification is that "this is the only form the
latest Noto Sans Mongolian renders correctly", which is a **font-driven** choice
— exactly the reasoning this project rejects everywhere else. It is a reader
ruling, so it stands until the reader revisits it, but it should be revisited.

## Unicode 17.0 changes nothing for Mongolian — checked, not assumed — 2026-08-07

Unicode 17.0 shipped 2025-09. The question was whether anything it changed
touches this package. **Nothing does.** Recorded here so the next person does
not have to repeat the check, and so that "we are on 16" never becomes a quiet
liability.

### What was compared

Not the release notes — those summarise, and a data-file edit can miss the
summary. Every UCD file was downloaded at both `16.0.0` and `17.0.0` and the
rows overlapping the Mongolian ranges (U+1800–U+18AF, U+11660–U+1167F) were
diffed directly:

| file | Mongolian rows | result |
|---|---|---|
| `UnicodeData.txt` | 171 | identical |
| `StandardizedVariants.txt` | 60 | identical |
| `NamesList.txt` (chart annotations) | — | identical |
| `LineBreak.txt` | 20 | identical |
| `Scripts.txt` | 19 | identical |
| `PropList.txt` | 13 | identical |
| `DerivedCoreProperties.txt` | 72 | identical |
| `DerivedAge.txt` | 9 | identical |
| `Blocks.txt` | 2 | identical |
| `ArabicShaping.txt` (joining types) | 135 | identical |
| `auxiliary/GraphemeBreakProperty` | 5 | identical |
| `auxiliary/WordBreakProperty` | 12 | identical |
| `auxiliary/SentenceBreakProperty` | 16 | identical |

Core spec chapter 13 is also unchanged in substance. It *appears* to differ, but
the whole diff is the 17.0 page rendering glyphs inline where 16.0 used images,
plus table numbers shifting 3→5, 4→6 … because chapter 13 gained a section for a
script added elsewhere in 17.0. No Mongolian prose changed.

**UTN #57 is still revision 4, dated 2024-08-14** — not revised for 17.0 either.
So the сайн ruling above rests on current sources, and nothing above it moved.

⚠ A range grep like `^18[0-9A-F]{2}` does **not** isolate Mongolian: it also
matches `18800..18AFF` (Tangut) and `18D00` (Tangut ideographs), both of which
*did* change in 17.0. The first pass of this check reported false Mongolian
differences for exactly that reason. Parse the code points and compare numerically.

### The one thing in 17.0 worth knowing

Chapter 13 carries a standing warning, still present in 17.0:

> **Warning**: The list of standardized variants in StandardizedVariants.txt for
> Mongolian has not yet been updated to synchronize with the requirements of
> current practice as stated in Unicode Technical Note #57 […] This defect will
> be addressed in a future version.

So **`StandardizedVariants.txt` cannot arbitrate an FVS question** — the standard
itself says that file is out of sync with UTN #57. This matters for найм above:
being registered there is not evidence of being right, and not being registered
would not be evidence of being wrong. UTN #57 is the authority; the registry is
acknowledged to lag it.

Also confirmed, and already what we do: NNBSP's role was taken over by MVS in
**16.0**, and U+202F keeps `Script_Extensions=Mong` only for backward
compatibility. U+180F is FVS4, not the "suffix connector" its 2017 proposal
called it.

### Our own FVS output is conformant

Only 8 curated rows carry an FVS at all, and every base+FVS pair we emit is a
registered sequence:

| word | sequence | status |
|---|---|---|
| найм | `1836 180B` (YA + FVS1) | registered — *initial medial* |
| дизайн | `1833 180B`, `1828 180B` | registered |
| целлюлоз | `1826 180B` | registered |

The curated lexicon is otherwise fully consistent with the `sain` analysis:
scanning for a vowel followed by coda YA returns **exactly one** row — найм. The
harvest is not, and does not need to be: `dropGlideYa` rewrites `V + YA + I` on
the way out. Note it only fires on that shape, so `bey-e` (бие) is untouched,
because there the YA sits between two vowels rather than before an I. Whether
that one should be `bei-e` is a reader question, not a mechanical one.

## The toli conflicts, ruled 2026-08-10

A 52k-headword SQLite dictionary was imported as the `toli` stem tier (see
`docs/data-and-accuracy.md` for what it bought). Four words were sent to the
reader first, because the source disagreed with this repo on each and would
have overridden the pipeline's answer. All four verdicts are now rows in
`lexicon.ts`, which outranks the tier outright.

**Two of the four were corrections to `rulings.test.ts`, and in both cases the
thing being corrected was ours, not the reader's.** That is the third and
fourth instance of the pattern CLAUDE.md already warns about — our inference
*from* a reader answer surviving as if it were the answer.

| word | was | is | why the old value was there |
|---|---|---|---|
| бананы | `banan-u` | `banana-yin` | our construction inside a regression guard |
| филармонид | `filarmuni-du` | `filarmoni-du` | our non-initial-o fold, applied to a loanword |
| уйлаад | `uqilaγad` | unchanged | stem уйл `uqil` now pinned |
| ахиад | `aqiγad` | unchanged | ранking between two real readings pinned |

### банан is `banana` — the foreign word, spelled as the foreign word

Reader: *"it's a foreign word, so spelt exactly banana in bichig, and mongolian
one would be гадил."* Cyrillic dropped the final a; bichig keeps it. So the
genitive is `banana-yin`, not the `banan-u` this repo asserted.

That could not assemble at all when it was tried, and the reason is a genuine
gap rather than a data problem: **Cyrillic -ы presupposes an н-final stem**, and
the suffix table only carried it with `after: 'n'`. For a native word that is
right — the Classical stem ends in н too. A loanword breaks the correspondence,
because `banana` is vowel-final while the Cyrillic surface says н. The
vowel-final allomorph was added the same day. It is a missing **allomorph**, not
a rule about loanwords: the condition is read off the Classical stem, so it
fires only where Cyrillic says н and Classical says vowel. `хааны` `qaγan-u` is
unaffected.

### филармони keeps its non-initial o

Reader: *"foreign word, can have o after first syllable."* The
o/ö-only-in-the-first-syllable rule is categorical for **native** words and does
not reach loanwords at all. `filarmuni` was this project applying it out of
scope.

`test/orthography.test.ts` asserts the rule holds across the whole lexicon with
a list of permitted exceptions, and филармони was added to that list rather than
the rule being widened — the count of *native* exceptions stays at one (гол).

### ахиад is a homograph, and the ruling is which reading wins

Reader: *"aqiγad means 'more/again', and is the more common word. aqiyad means
'small, tiny' and less frequently used. the common one is ахь + аад."*

Both readings are real, so neither is deleted. ахь `aqi` is curated, which makes
the common reading win outright instead of on a prior. The rare `aqiyad` remains
available from the toli tier.

⚠ This one exposed a defect that had nothing to do with the reader's answer.
`generate.ts` only ran verb morphology when no non-guess noun reading existed —
and a `toli` row counts as non-guess, so the tier's bare headword `aqiyad`
**suppressed the verb parse entirely** rather than competing with it. The gate
now names `lexicon` and `harvested` explicitly. Same shape as the placement bug
in `stem.ts`: a weak tier silently preventing a better path from being built,
where no amount of re-weighting could have helped, because the better candidate
never existed to be ranked.

### уйл is `uqil`

Confirmed as given. The harvest already had уйлаад right; the row exists so a
bulk tier offering `uil` cannot undercut it.


## The toli-release spot check, 2026-08-10 (second round)

45 words. The C group (changed by the toli tier) came back **12 of 14 right**,
which is the review that release needed. The R group (random) was 13/14. The X
group — where the converter is least confident — was **0 of 14**, and every one
of those was the reader siding with the silver against us.

### The finding is not the words, it is where they were stuck

In 11 of the 14 X failures **the stem was already in our data and already
correct**. хууль `qauli`, хувцас `qubčasu`, хоолой `qoγulai`, бие `bey-e`, барь
`bari`, дэн `d1ēng` — all harvested, all right, all reaching the guesser anyway
because the *segmenter* could not get from the inflected Cyrillic to them.
Adding wordlist rows would have fixed none of it.

⚠ **And `it.todo` is where three of these had been parked.** энгийн is a word
the reader reports correcting **six times**. The verdict was recorded, correctly
diagnosed, and never written as a row — so every spot check re-sampled the same
wrong output and cost the reader the same ruling again. Two more (дэлхийн,
худалдааг) had sat since 2026-07-30 and were both one row away.

**A reader verdict with a known Classical form belongs in `lexicon.ts` the day
it arrives.** `it.todo` is for a target the pipeline cannot yet *reach*, not one
nobody has written down.

### What each fix turned out to be

| word | fix | kind |
|---|---|---|
| энгийн, худалдаа, сэргэ, токар, дэнг | curated rows | data |
| хоолойн, заламгайн, дэлхийн | stem-final й absorbed by a й-initial suffix | `stem.ts` |
| хувцаснаас, хуудаснаас | `unstableNStems` tested the wrong side | `stem.ts` |
| хүү | `köbegün` was on the wrong headword | data |

### Two bugs worth remembering

**`unstableNStems` gated on the Cyrillic stem ending in a vowel.** The
тогтворгүй н is a fact about the **Classical** form, and `suffixes.ts` says so
in its own header — "checked against the Classical stem, never the Cyrillic
one". хувцас is Cyrillic consonant-final and `qubčasu` is vowel-final, so the
whole class was invisible. The Classical-side test already existed (`hiddenN`),
making the Cyrillic one redundant as well as wrong.

One Cyrillic condition had to be *added* when it was removed: a й-final stem is
excluded, because й+н is the genitive of a й-final stem rather than a stem's н,
and хоолой is vowel-final in Classical too — so nothing on the Classical side
can separate them. That is a real case where the Cyrillic carries information
the Classical does not.

**хүү was `köbegün`.** Reader: *"köbegün = хөвгүүн (not хүү, but is a
synonym)."* The seed had not mistranslated anything — it had put the Classical
form of one word on the Cyrillic key of its synonym, and the gloss was right for
both, so no gloss or round-trip check could ever have caught it. Only a reader
comparing the two scripts could. `köbegün` now sits on хөвгүүн and хүү is `qüü`.

### Still open, with reader targets

Six X items are unfixed, and they are six *different* mechanisms — none is a
row, and each needs its own measured round:

| word | target | what is missing |
|---|---|---|
| хуулиар | `qauli-bar` | ь absorbed by -иар; peel leaves хуули, not хуул |
| сүүгээр | `sün-iyer` | the linking г belongs to neither side (standing todo) |
| биеэ | `bey-e-ben` | no segmentation at all — reflexive -ээ after е |
| клубээс | `khlü1b-eče` | harmony rejects -ээс on a masculine loanword |
| барьсан | `bariγsan` | verb morphology: linking γ before -сан |
| голланд | The silver's | **blocked** — needs ᠾ (U+183E) romanized in mongol-bichig |

And one deferred by the reader: загварынхан, where they were unsure whether -хан
is a suffix or a word and asked to follow a prior ruling. There is no prior
ruling on -ынхан in this repo, so nothing was invented.

⚠ клубээс carries a second note — *"but fvs1 isn't necessary"* — so `khlü1b` is
itself wrong in the harvest, independent of the segmentation.


## The 2026-08-07 ask, answered 2026-08-10

Eight questions went out on 2026-08-07 (`.tmp/ask/unicode17-and-stems.json`);
seven came back on 2026-08-10. **Five of the seven confirmed what the converter
already emits.** That is a result rather than a null: each of the five was a
place where this repo could not tell its own answer apart from a plausible
alternative, and in four of them a competing reading was already sitting in the
harvest or the `toli` tier waiting to be promoted by anyone who assumed.

`node scripts/eval-rulings.mjs` after the answers were folded in:
**160/160 reader-confirmed assertions pass**, with 10 `it.todo` remaining (the
pipeline incidentally gets 1 of those). `test/rulings.test.ts` grew from 153
`same()` assertions at the last commit to 174 over the session.

| id | word | verdict | what changed |
|---|---|---|---|
| U1 | найм | `nay1ma` — YA + FVS1 | nothing; already emitted |
| S1 | сургуулийн | `surγaγuli-yin` | nothing; already correct |
| S2 | бие | `bey-e` — YA | nothing; already emitted |
| S3 | алт | both `alta` and `altan`, `alta` the more modern | two lexicon rows |
| S4 | хийн | genuinely ambiguous, needs the sentence | asserted as ">1 reading" |
| S5 | байшин | `baising` — SA, not SHA | nothing; already emitted |
| T1, T2 | ашигтай, морьтой | both spellings correct — a choice, not a rule | see below |

### U1 settles найм without a font argument

`rulings.test.ts` has carried найм as `nay1ma` since 2026-07-31 on a
justification the row itself admitted was weak — which form Noto Sans Mongolian
renders correctly — while UTN #57 p.15 lists найм under letter I as `naima`.
Both are valid Unicode; U+1836 U+180B is a registered variation sequence. The
reader's answer makes it a fact about the word rather than about a font, which
is the only kind of answer this repo is allowed to keep.

### S1 closes the first row of the roadmap's own failure table

сургуулийн is the example `docs/roadmap.md` leads with under "the stem is the
whole game": the bare word was right (`surγaγuli`) and the inflected form threw
the stem away and rebuilt `surγul-un`. The reader's answer is the form the stem
layer now produces, so that row is **confirmed fixed**, not merely changed. The
rest of the class — дуурь, морь, хонь — rides on the same restoration.

### S3: алт carries both readings, and тос was deliberately not touched

Reader: *"both are correct and both should be offered — alta would be more
closer modern one, so offer it at higher freq."* Two rows in `lexicon.ts`:
`alta` at 0.8, `altan` at 0.3.

The ask's own note proposed extending the same treatment to тос, давс and зүрх
if the answer came back "both". **It was not extended**, and the reason is the
footgun CLAUDE.md already records: an ask page answers about *words* and cannot
tell you a rule's scope. Six answers became `repairDevoicedGa` over 224 words
once, and the rulebook says all 224 were wrong. The evidence here is one word.
Each of the other three is its own question.

### S4 is recorded as ambiguity, not as an answer

Reader: *"genuinely ambiguous, needs the sentence."* The assertion written down
is therefore that хийн **keeps more than one candidate** — not which one wins.
Picking a default and pinning it would put our choice into the highest-authority
fixture in the suite wearing the reader's name.

### T1/T2: -тай³ is a house style, and §2.3.6 does not decide the spelling

Reader, on ашигтай and морьтой together:

> both correct, and it's simply a choice. we chose to detach, but we can also
> attach. when attaching, гэдэс жийрэглэх rule apply btw

Three things follow, and the third is a blocker rather than a finding.

**1. Rulebook §2.3.6 does not settle the orthography.** The reading this repo
had taken from it — that the adjective-forming `-тай³` is a дагавар and
therefore always залгаж, while the case-like comitative is дагуулж — is a
distinction in *morphology*. It does not license one spelling and forbid the
other. The roadmap's "234 of the 273 attached gold rows are the adjectival
-тай³, so this is a missing candidate" is **superseded 2026-08-10**: the
candidate is real, but it is an alternative, not the correct answer that had
been missing.

**2. The corpus split is house style, and the two *derived* corpora disagree
about which way.** Measured today over all three sources this repo has:

| source | n | attached | detached |
|---|---|---|---|
| word harvest, rows whose Cyrillic ends -тай/-тэй/-той | 2,407 | **69.8%** | 30.2% |
| sentence-aligned pairs, same ending | 142 | 38.7% | **61.3%** |
| **running text, forced pairing** | **791** | **72.4%** | 27.6% |

The first two reproduce with a `slice(-6).includes(MVS)` test over
`.tmp/harvest-harvest.jsonl` and `.tmp/aligned-words.jsonl`. **Their inversion
is the lemma-list selection bias the roadmap warned about, now measured** — a
lemma dictionary carries the adjectival `-тай³` as headwords, and
`aligned-words.jsonl` is built as the *complement* of that harvest, so it
carries the comitative. The same silver data spells the same suffix
oppositely in the two, because they are oppositely selected.

⚠ **Neither of those two is the measurement to quote, and reading the pair as
"the corpora disagree, so the number is unknowable" would be the wrong
conclusion.** Both are selected populations; a third source is not. The bottom
row takes `.tmp/harvest-sentences.jsonl` — running text — and keeps only
sentences carrying **exactly one** Cyrillic `-тай³` token and **exactly one**
bichig token ending ТА/ТЕ + И. The pairing is then forced, so it needs no
alignment and inherits no aligner bias, and it samples text rather than a
wordlist. It agrees with the word harvest and against the aligned pairs, which
says the aligned figure is the artefact.

None of the three is a correctness measurement, because the reader has just
said both spellings are correct. They measure what the silver
does. The forced-pairing row is simply the one that measures it on running
text instead of on a wordlist.

The standing choice stays **дагуулж (detached)**, which is what the reader
reports they chose.

**3. The second half of the answer is an unimplemented prerequisite.** гэдэс
жийрэглэх applies when attaching, and this converter does not implement it. Our
attached output on a chachlag stem strands the stem's MVS mid-word (санаатай
becomes `sanaγ-atai`), which is precisely the shape `pnpm lint:output` reports
as `unknown-suffix` — the same defect already recorded for `-лаг⁴`. Verified:
`pnpm lint:output` is at **19 `unknown-suffix` warnings** with the залгаж
reading off, which is where it stands.

> **Update 2026-10-02.** Implemented from the silver, not from the
> reader: an attached suffix on a chachlag stem takes the connector with it
> (`sanaγatai`, `γabiyatu`), which is what the silver writes 231 times out
> of 231. `pnpm lint:output` is at 0. The reader named the rule and has not
> seen these forms — `docs/roadmap.md`, question 5. The standing choice for
> `-тай³` is unchanged: дагуулж.

So the залгаж reading ships as an alternative candidate (`OFF_CONVENTION` in
`src/generate.ts`), never as the default. It is deliberately **not** expressed
as a `share`, because `SuffixEntry.share` is documented as a count over running
text and explicitly "not a judgement" — folding a house policy into it would
falsify the data in order to get a ranking out of it.

### ⚠ Still unasked: whether the harvest's FVS digits are noise

`docs/rulings.md` already records the reader saying of клубээс `khlü1b` that
*"fvs1 isn't necessary"*. That was treated as a note on one word. It may be a
property of the whole source.

Measured 2026-08-10 over the 1,611 detached gold forms: of the 423 that the
pipeline's top candidate gets wrong, **28 (1.74pp of 1,611) become exactly
correct once FVS1–4 are stripped from both sides** — абстрактууд, автокранаар,
пальтонд, гэрийгээ, хүнийхээ and the like. And the source contradicts *itself*
across the paradigm: автокран is `aü1t1okhran1` bare and `aü1t1okhran-iyar`
inflected, so the same word carries a different digit count depending on which
row you read.

This is one reader question, not a rule to derive, and CLAUDE.md's standing ban
on deriving rules from foreign words applies to every word in that list. Queue
it as an ask; do not act on the 1.74pp.

## The first review page from the running-text silver set (2026-10-02)

Answers given on `.tmp/spotcheck.html` and in the conversation around it, by
the owner. Verbatim where it matters.

**Ruled, and implemented the same day**

- **нэг is `nige`.** "nige is correct, nigen = нэгэн." The curated row had
  `nigen`. ⚠ Only нэг was asked: мянга, гурав, ам, нар still carry their н, and
  тав is `tabun` by an earlier ruling. Do not generalise from this one.
- **үнэт is `ünetü`** — a reversal. The 2026-07 article pass recorded `ünedü`.
  Shown the silver's `ünetü` and the 68 other -т adjectives it writes with
  `t`: "the silver's might be better". The later answer stands.
- **A suffix after a number or an abbreviation**: "not sure, but let's just
  assume that we'd use the suffix as if the word was written. for example АНУ
  — ends with -un because we'd do ulus un". So the allomorph is the spoken
  word's, and the connector is MVS. `src/attached.ts`. ⚠ An assumption by its
  own first two words; the connector after a digit is still a reader's to rule.
- **-гүйгээр is -гүй + -ээр.** The negative takes its case on үгүй:
  төлбөргүйгээр `tölbüri` + `ügei-ber`. `src/clitics.ts`.
- **юмуу is `yum uu`, улстөрийн is `ulus törü-yin`.** "there's no such word
  юмуу in mongolian, so maybe follow them"; "улс төр is usually separate". A
  word the silver cuts in two is stored as two.
- **-тай³ attached or detached: both correct**, said again on six cards. "Or
  stylistic choice for the converter is to have it separate." Unchanged — and
  the review page no longer counts a connector as a disagreement.

**Said, and not implemented**

- **Abbreviations are read by letter name.** ХХК is хязгаарлагдмал
  хариуцлагатай компани, "so it's correct to put sth like хи ха ко (not sure
  how we handle abbreviations)". The silver's forms for НҮБ and ТҮЦ were
  marked right. How the syllables are joined is open.
- **In a foreign word у, ү and ө always take the shilbe; о is the exception**
  (on паул `paü1l`). A guesser rule, waiting on a way to know a word is
  foreign.
- **A compound name's second word keeps its own о**: "баасандорж is a
  person's name, and consists of two words, баасан and дорж, so дорж doesn't
  have to follow the оө turns into уү after first syllable rule" — and "they
  look visually similar". We still fold it, as the normaliser does to the
  silver's answer; the two are drawn identically.

**Asked, and left open**: the plural after н ("not sure, gotta give me an
example"), and what гэдэс жийрэглэх does to the letters ("not sure").

## The disagreements page (2026-10-02, second sitting)

The 25 commonest words whose letters differed from the silver's, with the
settled and the already-asked left off. Sixteen went the silver's way and
are `same()` assertions in the last block of `test/rulings.test.ts`.

- **гэрээ is two words**: "if it's contract, it's гэр-э, but if it's home/yurt
  + аа/ээ → гэр-ийэн". The contract is the row; the other is still built.
  гэрээний is `ger-e-yin` — "this combination of suffixes (ээ + ийн) is not
  possible with stem гэр". ⚠ That is the silver's form inside the class
  the `chachlag-genitive` rule protects on the strength of хэмжээний
  `qemǰiyen-ü`. Both rulings stand; the н is lexical.
- **хүйтэн** is `küiten` ("it's ү not ө"); **зургаа** is `ǰirγuγ-a` ("if it's
  just number six"); **уух** is `uuγuqu` ("stem уу"); **мөч** is `möče`.
- **Converbs, not nouns**: яриад `yariγad`, өгөөд `öggüged` ("stem өг as in to
  give"), санагдаад `sanaγdaγad` ("stem сана, but you can also reasonably say
  it started from санагд, but definitely not санагдаа, not even a word").
- **Possession**: манайх `man-u-qi` ("stem not sure, but definitely isn't
  манайх"), манайхан, албаныхан, өөрийнх `öber-ün-qi` ("өөр as in self, not
  different").
- **дууг** is `daγuu-yi`.
- **нитх is an abbreviation** (нийслэлийн иргэдийн төлөөлөгчдийн хурал) —
  "both wrong". Same open question as ХХК.
- **луу**: the dragon is `luu`; the directive is `uruγu`. Both right, by word.
- **Not ruled**: аад and ээд ("not sure if it's a word, looks like a suffix"),
  даанч ("can't even find the correct Cyrillic version").
- **христийн, лхагва, буддын, шхаб**: the silver is right, and none can be
  stored — see the roadmap, question 8.

