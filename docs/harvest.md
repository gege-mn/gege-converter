# The harvested tier, its traps, and the scripts

<!-- Background doc. Not loaded into context automatically. -->

Read this before importing data, writing a script that talks to a silver
converter, or wondering why a lexicon row looks the way it does. Every trap
below was hit for real and fails **silently**.

## Seed word lists (input to the harvester, not shipped)

`scripts/build-wordlist.mjs` merges three sources into 41,220 unique Cyrillic
words. All are share-alike, so the **word lists are never vendored** — they only
decide which words get looked up; what ships is our own lexicon.

| Source | New words | Licence |
|---|---|---|
| kaikki.org (Wiktionary) | 5,358 | CC BY-SA 4.0 |
| MonWN `kbatsuren/monwn` | 21,286 | file header says CC BY 4.0, repo LICENSE says BY-SA — unresolved |
| UniMorph `unimorph/khk` | 14,576 | CC BY-SA 3.0 |

UniMorph also ships `khk.segmentations` (lemma, form, tag, **stem|suffix
boundary**) — an unused ready-made test set for stage 3.

Licensing position taken 2026-07-26: **keep MIT.** A list of Mongolian words is
facts, not creative expression (*Feist*); what BY-SA protects in these sources is
the glosses and synset structure, which we take none of. Caveats: the EU
*sui generis* database right has no US analogue, and the silver's own terms are a
separate question. Credit the seed sources regardless.

## The harvested tier

The 8,680 rows in `src/data/harvested-lexicon.ts` were read out of
silver data and repaired to correct Unicode. **Collection** is
finished — the scripts are gone, and the upstream service went down on
2026-07-26 — but see the correction below: what was collected had not been
fully *mined*. What matters now is the shape of what came in, because
`src/orthography.ts` and gege-linter's `applyFixes` still have to undo it for
any future import.

### Correction 2026-07-27: the seed list decided the shape of the hole

The seed word list is Wiktionary + MonWN + UniMorph **headwords** — three lemma
lists. A lemma list carries verbs only as `-х` infinitives, so the word harvest
has 1,941 infinitives and almost no inflected verb forms. **The verb hole is a
property of the seed list, not of the language**: there was never any verb
signal to learn from.

`.tmp/harvest-sentences.jsonl` is running text and does not have that shape. It
was collected for homograph detection and never mined for word pairs;
`scripts/align-sentences.mjs` now does, yielding **1,966 new pairs** including
194 `-ж/-ч` and 83 `-аад/-ээд` converbs — endings for which
`src/data/verb-suffixes.ts` records one and zero attestations respectively.
Alignment is anchor-verified at **95.3%** (leave-one-out) and a reader ruled a
28-form sample 28/28. Method and traps are in that script's header and in
`neural-model.md`.

**Trap 6, and the reason naive alignment fails:** the converter does not
preserve token count. It merges (миний л → one token) and splits (усны →
ᠤᠰᠤᠨ ᠤ᠋). A merge shifts every later token with no error, and a merge plus a
split in one sentence leaves the counts *equal*, so a length check does not
catch it. Naive positional alignment agrees with the word harvest only 83.4% of
the time. Align against the word harvest as an oracle and drop any sentence
where a single anchor disagrees.

72.6% of sentences are still dropped, most for a token-count mismatch a real
aligner could recover. This source is not exhausted.

> **Superseded 2026-08-10 — the real aligner was written and the prediction was
> right.** `scripts/lib/align.mjs` is a DP over 1:1 / merge / split / skip whose
> only reward is agreement with the word harvest, and the harvest changed role
> from a **check** (reject the sentence if any anchor disagrees) to a
> **constraint** (the anchors are fixed points; the short spans between them are
> what gets solved). Re-derive with
> `node scripts/align-sentences.mjs OUT.jsonl`:
>
> | | before | after |
> |---|---|---|
> | sentences contributing | 1,153 / 4,000 | **3,781 / 4,000** |
> | word pairs | 2,037 | **6,217** |
> | verb-shaped pairs | 675 | **1,671** |
> | leave-one-out precision | 95.3% | **96.3%** |
>
> Two things above are now wrong as *method*, not just as numbers. Trap 6's
> advice — "drop any sentence where a single anchor disagrees" — throws away
> three sentences in four; a disagreement is evidence about a *span*, not a
> verdict on the sentence. And **nothing in the new aligner tests token counts
> for equality**, because a merge plus a split in one sentence leaves them
> equal, so that test was never sound — it only happened to be conservative.
> Full write-up, including the merge/split cost variant that was measured and
> rejected, in `docs/neural-model.md`.
>
> ⚠ One prerequisite is easy to miss and silently halves the anchors:
> `attachDetachedSuffix` must be applied **across the token boundary** before
> aligning. The silver writes the genitive detached in sentence
> mode and MVS-connected in word mode, so the identical word is one token in
> the harvest and two in a sentence.

> ⚠ **Superseded 2026-10-02.** "Standard Hudum plus exactly two substitutions"
> is true of the letters and of nothing else — see `docs/tungaamal.md`, and
> `src/tungaamal.ts`, which is the repair now.

**The input encoding is not private** — it is standard Hudum plus exactly two
Ali Gali substitutions, and zero PUA:

| In | → Unicode | Encodes |
|---|---|---|
| U+1889 | U+182D GA | feminine g (masculine uses standard GA) |
| U+1888 | U+182C QA | feminine k (masculine uses standard QA) |

Verified harmony-conditioned: standard GA/QA appear in masculine words only
(39/39, 21/21); the Ali Gali letters in feminine + i-only words. That means
**the input carries one bit more than correct Unicode does** — the harmony
class Unicode leaves to shaping — which the harvest captured per row.

Otherwise it is the pre-Unicode-16 model: NNBSP for suffix connectors, MVS for
chachlag only, plus redundant FVS selectors on suffix heads. `applyFixes` from
gege-linter repairs all of that mechanically (156 → 21 diagnostics on the first
sample). Two *orthographic* differences remain and are handled by
`src/orthography.ts`, not by the linter.

### Traps that produce plausible-looking WRONG data

Every one of these was hit for real. They fail silently, which is why they are
recorded rather than left to be rediscovered:

1. **the silver silently drops lines mid-batch**, non-deterministically — the same
   word converts fine alone. A dropped line shifts every later row up by one
   with no error. Never align by position. Each line carries a **three-letter
   Latin key** and is matched back by key.
2. **Digits are NOT usable as keys**, even with `convert-numbers: false`. The silver
   converts them: `6` comes back as ᠤ, `10\n11` merges into `112`, and the
   mangling also collapses the whole response onto one line. Latin passes
   through untouched; converted output contains no Latin.
3. **JavaScript `\s` matches U+202F NNBSP** (but not MVS). `String.trim()`
   does too. Using either on harvested output silently rewrites the suffix
   connector into a plain space — destroying the thing being measured. Trim
   with an explicit `[ \n\r\t]` class only.
4. **A failed batch is not 250 dropped words.** Conflating them turns one
   network failure into 250 rapid solo retries aimed at a service that is
   already unwell. `convertBatch` returns `{reached, byIndex}` and the caller
   backs off; it circuit-breaks after 3 consecutive failures.
5. **A doubled vowel is one long syllable.** Folding non-initial o per code
   point rewrites ᠭᠣᠣᠯ (γool, "river") to ᠭᠣᠤᠯ, which is not a word. Fold
   vowel *runs* as units.

Scale notes: the limit is server-side processing time, not payload bytes
(~85ms/line). 500 lines worked, 750 timed out; chunk is 250 with a 2s gap.
The whole upstream stack — the converter and the dictionary site sharing its
infrastructure — went down on 2026-07-26 around 03:00 Ulaanbaatar, and was
user-confirmed as not caused by us.

### Scripts

| Script | Does |
|---|---|
| `build-wordlist.mjs` | merge seed lists → `.tmp/cyrillic-words.txt` |
| `the harvester` | words → `.tmp/harvest-harvest.jsonl`; resumable, keyed, circuit-broken |
| `harvest-sentences.mjs` | sentences → context-shift detection |
| `standardize-silver.mjs` | raw silver → `.tmp/harvest-harvest.jsonl` + `.tmp/harvest-sentences.jsonl`, through `tungaamalToUnicode`; prefers a word's in-context form |
| `import-harvest.mjs` | harvest → `src/data/harvested-lexicon.ts` + gold fixture + quarantine |
| `import-attested.mjs` | silver words → `src/data/attested-forms.ts` (the `attested` tier) + `test/fixtures/attested-heldout.json` |
| `eval-heldout.mjs` | score the converter on words withheld from the `attested` tier |
| `eval-sentences.mjs` | word-by-word agreement with the silver on held-out sentences |
| `import-toli.mjs` | bundled SQLite dictionary → `src/data/toli-lexicon.ts` (the `toli` tier; different filters — see `docs/data-and-accuracy.md`) |
| `eval.mjs` | score the pipeline against the held-out gold set |
| `build-spotcheck.mjs` | sample changed / suspicious / random words → review HTML |
| `build-encoding-report.mjs` | encoding decode → HTML |
| `build-homograph-page.mjs` | discovered homographs → HTML |
| `build-review-page.mjs` | open questions + spot checks → interactive HTML |

Import filters, in order: multiword → not-a-lemma → already-curated →
lint-dirty → round-trip-mismatch → **inflected → gold fixture**. Round-trip
means the romanization must regenerate identical code points, or we do not
understand the form well enough to store it.

The inflection test runs *last*, on the romanized form, because the silver's
output is the reliable signal: it wrote `abu-du` **with a connector**, and that
is a statement that аавд is stem + suffix. The older test guessed from the
Cyrillic and only fired when stripping an ending left an attested word — it
leaked 473 inflected forms into the lexicon as if they were stems. A trailing
single `a`/`e` is chachlag and not a suffix (`qar-a`); the genitive after н is
`-u`/`-ü`, so no real suffix is bare a/e.

Inflected rows are **not discarded** — they are the held-out gold set. Storing
one as a stem both inflates coverage and hides the fact that the pipeline could
never have derived it.

## A source we may test against but never ship (2026-07-29)

`toli.query.mn` publishes a volunteer digitisation of **Я. Цэвэл, "Монгол
хэлний товч тайлбар толь"** (1966) with a bichig column. 30,904 rows, 25,238
with script, and — unusually for this ecosystem — **genuine Unicode, zero
Menksoft PUA**. A 2015 dump of it sits in `~/Projects/unread-games`, where the
games' parser has been discarding both script columns all along.

**It is a test oracle. It is not an import.** The site's terms:

> …цааш нь тарааж, нэмж засварлан хэрэглэж болно, гэхдээ уг сайтыг дурдах,
> мөн **ашгийн бус** байх ёстой.

Redistributable on condition of attribution and non-commercial use — CC-BY-NC
in substance, which fails here twice. This package is installed and used
commercially by people who never agreed to an NC term, and the attribution
clause would put a service domain in the source, which "Naming the outside
world" in CLAUDE.md rules out. So the file lives in `.tmp/toli/` (gitignored,
with a `PROVENANCE.md` beside it) and nothing reproducing its rows reaches
`src/data/`.

**Keep the rulings, not the rows.** Their compilation — which 30,000 words, and
how each is defined — is theirs, and a converter has no use for it. That a
Cyrillic word is spelled a particular way in bichig is a fact with one right
answer, and a correction we make after being caught out is our own work. A
disagreement that teaches a rule becomes a line in `docs/rulings.md` and a test;
a disagreement merely copied becomes a licence problem. Drop `definition`
entirely — it is Цэвэл's prose and the highest-risk column in the file.

Two traps specific to this source:

1. **It has two provenances inside one file.** `word` and `definition` come
   from the 1966 book. `bichig` and `bichig_galig` cannot — a Cyrillic
   dictionary of that date has no bichig column. Volunteers added them
   c. 2009–2015, unreviewed and multi-contributor. Weigh the script columns as
   crowd data, not as a published dictionary's authority. The mess fits: 1,443
   plain spaces against 112 NNBSP, ~120 rows with Latin or Cyrillic sitting
   inside the script column, 6,884 rows with bichig but no galig.
2. **Its FVS data is the most valuable thing in it and the most likely to be
   wrong.** 511 selector uses, in a file dated 2015-04-26, under a convention
   that has since changed. The reader made exactly this point unprompted while
   judging another converter: "kinda right, just the incorrect shilbe due to we
   using the latest unicode standards." Check every triple against
   mongol-bichig's `variation-sequences.md` before believing any of it.

Their galig is documented at `/static/script` and is **lossier than their own
script column**: Ө=`oe`, Ү=`ue`, Х=`q`, Ш=`sh`, В=`w`, НГ=`ng`, and `h` is
never a letter — only the second element of `sh`/`ch`. Critically **Ж and З
both collapse to `j`, Ц and Ч both to `ch`**, so it cannot round-trip its own
bichig. Read the script column; treat the transliteration as a disagreement
detector and nothing more.
