/** Vowel-harmony class of a Mongolian word. */
export type Harmony = 'masculine' | 'feminine' | 'neutral';

export type TokenKind = 'word' | 'space' | 'punctuation' | 'number' | 'latin' | 'other';

/** How digits and punctuation are written in the output. See `punctuation.ts`. */
export type ScriptStyle = 'ascii' | 'mongolian';

/** One piece of the input, positioned in Unicode code points (not UTF-16 units). */
export interface Token {
  kind: TokenKind;
  text: string;
  /** Start offset into the input, counted in code points. */
  start: number;
  /** End offset (exclusive), counted in code points. */
  end: number;
}

export type SuffixCategory =
  | 'genitive'
  | 'accusative'
  | 'dative-locative'
  | 'ablative'
  | 'instrumental'
  | 'comitative'
  | 'reflexive'
  | 'plural'
  | 'particle'
  /**
   * A case and the reflexive fused into one Cyrillic surface — -ынхаа,
   * -даа⁴, -аасаа⁴. Its own category rather than `reflexive` because its
   * allomorph conditions are the *case's* (three-way for the genitive), not
   * the reflexive's two-way. Named after the official tables' own heading,
   * "Тийн ялгалтай хамаатуулах нөхцөл". Added 2026-07-30.
   */
  | 'case-possessive'
  /**
   * Case-bound possession — `qi` (-ынх, -ных: "the one of") and `qin` (-ынхан,
   * -ныхан: "the people of"). The registry's own category name. It exists only
   * directly outside a genitive (алба-ны-хан), and takes case and the
   * reflexive outside itself (морин-ы-х-од). Added 2026-10-02.
   */
  | 'possession'
  /**
   * Word-forming rather than inflectional — the `-лиг` adjectival, and the
   * place for `-лт`/`-мж` and the rest when they are measured. Added
   * 2026-07-30, alongside `agent` in `VerbEndingKind`, which is the same
   * widening on the verb side.
   */
  | 'derivational';

/**
 * What the **Classical** stem must end in for an allomorph to be well-formed.
 *
 * Several suffixes pick their allomorph from the shape of the stem's last
 * letter, which the Cyrillic surface form does not reveal: Cyrillic хот is
 * consonant-final but its Classical form `qota` is not, so хотын is
 * `qota-yin` and never `qota-un`. Conditions are therefore checked against
 * the resolved Classical stem in `generate.ts`, not at segmentation time.
 *
 * School grammar's four stem groups (эгшиг / н / м,л,нг / хатуу дэвсгэр
 * б,г,р,с,д) collapse into these; see `references/suffixes.md` in the mongol-bichig skill, column
 * "Use after". Each set of conditions used by one suffix covers every
 * possible ending, so a stem never loses all of its allomorphs.
 */
export type StemCondition =
  /** Ends in a vowel (A E I O U OE UE EE). */
  | 'vowel'
  /** Ends in anything that is not a vowel. */
  | 'consonant'
  /** Ends in a consonant other than NA — genitive `un`/`ün`. */
  | 'consonant-not-n'
  /** Ends in NA — genitive `u`/`ü`. */
  | 'n'
  /** Ends in one of the hard finals б г р с д (хатуу дэвсгэр) — dative t-forms. */
  | 'hard'
  /** Ends in anything else: a vowel, н, or a soft final м л нг — dative d-forms. */
  | 'not-hard'
  /**
   * Ends in б specifically. Narrower than `hard` and used only where the
   * rulebook singles this letter out: the `-в` past and the `-ваас⁴` conditional
   * take the linking vowel after a б-final stem and nowhere else
   * (2.2.3/39–40, 2.2.2/21) — авав `abuba` against болов `bolba`.
   */
  | 'b';

export interface SuffixEntry {
  /** Surface form in Mongolian Cyrillic, e.g. `ийн`. */
  cyrillic: string;
  /** Classical form in romanization, e.g. `yin`. See `romanize.ts` for the alphabet. */
  classical: string;
  category: SuffixCategory;
  /** Attaches only to stems of this harmony class; omitted means either. */
  harmony?: Harmony;
  /**
   * Attaches only to a Classical stem with this ending; omitted means any.
   * Checked against the stem *plus any suffixes already attached*, so a
   * chained suffix sees the preceding suffix's final letter.
   */
  after?: StemCondition;
  /**
   * What the **Cyrillic** stem must end in — the letter written right before
   * this suffix, a soft sign looked through. `hard` is a consonant other than
   * л, м, н; `soft` is a vowel or one of those three.
   *
   * The mirror of `after`, and rarer: set only where the Cyrillic spelling
   * itself says which suffix a surface is. Today that is Cyrillic -т alone.
   * The dative is written -т only after a hard final (салбарт) and -д
   * everywhere else, so a -т after a vowel or after л/м/н cannot be the dative
   * and is the adjective-forming -т (чөлөөт, эзэнт). Checked while segmenting,
   * where the Cyrillic stem is in hand.
   */
  afterCyrillic?: 'hard' | 'soft';
  /**
   * Written detached, after a suffix connector (MVS). True for the case
   * suffixes and clitics; false for suffixes fused into the stem word.
   */
  separate: boolean;
  /**
   * Share of this Cyrillic surface's occurrences in **running text** that took
   * this row's reading, 0-1. Omitted means 1 — the row is the only reading of
   * its surface and competes on the stem's weight alone.
   *
   * Set only where one Cyrillic string is genuinely two different suffixes and
   * nothing in the surface form tells them apart, so the choice has to be
   * weighed rather than derived. Today that is `-тай³` alone: rulebook §2.3.6
   * makes the adjective-forming дагавар залгаж and the case-like comitative
   * дагуулж, and both are common. The twin of `VerbSuffixEntry.share`, named
   * the same because it is the same quantity measured the same way — a count
   * over running text, not a judgement.
   *
   * ⚠ A share is **evidence about text**, not a licence to delete a reading.
   * The losing row still produces its candidate; this only orders them.
   */
  share?: number;
}

export interface LexiconEntry {
  /** Citation form in Mongolian Cyrillic. */
  cyrillic: string;
  /** Classical form in romanization; `-` marks a chachlag (MVS-detached vowel). */
  classical: string;
  /**
   * English gloss. Optional: hand-curated entries carry one, but `harvested`
   * rows are Cyrillic↔Classical pairs with no sense information attached,
   * and inventing a gloss for them would be fabrication.
   */
  gloss?: string;
  /**
   * Relative frequency among the entries sharing this `cyrillic` key.
   * Entries for a unique key use 1. Hand-assigned in v0 — see data/lexicon.ts.
   */
  freq: number;
  /**
   * **Тогтворгүй н** — the Classical stem carries a final NA that the citation
   * form drops and an oblique form brings back: мод `modu` → модны `modun-u`.
   *
   * Optional in both directions, and read as a **tri-state**. Left unset, the
   * default in `stem.ts` decides — a stem whose script form ends in a vowel
   * takes the н — which is what covers the ~30,000 harvested rows that could
   * never have been annotated by hand. Set, it wins: `true` for a row the
   * default would miss, `false` for an exception to it, as on хэл `kele`, where
   * the н of хэлэнд is the жийрэг н Cyrillic inserts and Classical has not.
   */
  hiddenN?: boolean;
}

/** How a word was split before conversion. */
export interface Segmentation {
  /** Cyrillic stem left after peeling suffixes. */
  stem: string;
  /** Suffixes peeled off, in the order they appear in the word. */
  suffixes: readonly SuffixEntry[];
}

/**
 * Where a candidate's Classical form came from, in descending trust:
 *
 * - `lexicon`   — hand-curated and reviewed by a bichig reader.
 * - `attested`  — the **whole word** as the silver wrote it, kept
 *                 only where that differs from what the tiers below would have
 *                 derived. Same source and same repairs as `harvested`, but a
 *                 different claim: a `harvested` row says "this is a stem",
 *                 an `attested` row says only "this exact word is spelled
 *                 so". It answers a whole word outright; as a stem it is
 *                 asked last, above only `toli` and a guess — see the two
 *                 lookups in `stem.ts`.
 * - `harvested` — read out of Tungaamal-encoded text, repaired to correct
 *                 Unicode by gege-linter and orthographically normalised by
 *                 `orthography.ts`. A large, useful, *unreviewed* tier:
 *                 The silver is real converter output, but it disagrees with this
 *                 project on documented points, so one of its rows must never
 *                 outrank a `lexicon` one for the same word.
 * - `toli`      — headwords from a bundled SQLite dictionary, romanized from
 *                 its galig column and normalised the same way. Larger than
 *                 `harvested` and less reviewed than either tier above it, so
 *                 it is consulted last: `stem.ts` reaches it only where every
 *                 other path has already missed. It answers where we would
 *                 otherwise guess, and nowhere else.
 * - `guess`     — produced by the rule-based fallback for unknown stems.
 *
 * Only `guess` means "we made this up" — everything above it is attested by
 * some real source. That is true and it is **not** a licence to write
 * `!== 'guess'`.
 *
 * ⚠ Anywhere the question is "do we already have a real reading, so stop
 * looking" — a gate, an early return, a filter that decides whether a better
 * path runs — `toli` must be excluded **by name**. `!== 'guess'` is the bug,
 * and it bit three separate places on 2026-08-10: `stem.ts` placement, the
 * verb gate in `generate.ts`, and the importer's own filter, which let the
 * tier judge itself and made the import non-idempotent. Seven reader rulings
 * broke, and in none of them was the toli row's data wrong. A weak tier's
 * damage is not the weight it carries, it is the better paths it stops from
 * running — no re-weighting can fix that, because the right candidate is never
 * built to be ranked.
 *
 * `!== 'guess'` remains correct for the other question — "is this word
 * attested at all" — as in reporting and coverage. Know which you are asking.
 */
export type Provenance = 'lexicon' | 'attested' | 'harvested' | 'toli' | 'guess';

/** One plausible traditional-script reading of a Cyrillic word. */
export interface Candidate {
  /** Full Classical form in romanization, connectors written as `-`. */
  classical: string;
  /** The same form as Unicode Mongolian script. */
  script: string;
  /**
   * Weight of this reading before ranking — the stem's lexicon frequency, or
   * `GUESS_PRIOR` when the stem was guessed. Rankers read it; consumers
   * should use `confidence`.
   */
  prior: number;
  /** Share of total likelihood among this word's candidates; sums to 1. */
  confidence: number;
  gloss?: string;
  provenance: Provenance;
  segmentation: Segmentation;
}

/**
 * A Khalkha verb ending, named by what it does. This package converts none of
 * them — see `verb.ts` for why they are reported anyway.
 */
export type VerbEndingKind =
  | 'converb-perfective'
  | 'converb-imperfective'
  | 'converb-conditional'
  | 'converb-terminative'
  /** The modal converb `-н` (аван, болон, эхлэн). Added 2026-10-02. */
  | 'converb-modal'
  /** The durative converb `-саар⁴` — the past participle plus the instrumental. Added 2026-10-02. */
  | 'converb-durative'
  | 'participle-past'
  | 'participle-habitual'
  | 'tense-present'
  | 'tense-past'
  | 'evidential'
  /** The voluntative `-я/-е/-ъя/-ье` (явъя, үзье). Added 2026-10-02. */
  | 'voluntative'
  /** The polite imperative `-аарай⁴`. Added 2026-10-02. */
  | 'imperative'
  | 'negative'
  /**
   * The `-гч` agent noun. Derivational, not an inflection — the odd one out
   * in this list, and named here because the table that carries it is keyed
   * by this type. Added 2026-07-30; see `data/verb-suffixes.ts`.
   */
  | 'agent';

export interface VerbEnding {
  kind: VerbEndingKind;
  /** The Cyrillic ending matched, e.g. `ээд`. */
  ending: string;
}

/**
 * A verb inflection. Unlike `SuffixEntry`, whose Classical column the canonical
 * registry owns, these were mined from attested pairs — hence the evidence
 * fields. See `data/verb-suffixes.ts` for the method and its limits.
 */
export interface VerbSuffixEntry {
  /** Surface form in Mongolian Cyrillic, appended to the verb stem. */
  cyrillic: string;
  /** Classical form in romanization; `-` marks an MVS, a leading space a real space. */
  classical: string;
  kind: VerbEndingKind;
  /** Attaches only to stems of this harmony class; omitted means either. */
  harmony?: Harmony;
  /**
   * Attaches only to a Classical stem with this ending; omitted means any.
   * The verb-side twin of `SuffixEntry.after`, added 2026-07-31 for the
   * imperfective converb, whose two Classical forms are selected by the stem's
   * дэвсгэр rather than by which letter the Cyrillic happens to show.
   */
  after?: StemCondition;
  /** Times this pairing was seen when mining the corpus. */
  attested: number;
  /** Share of that ending's occurrences that took this Classical form, 0-1. */
  share: number;
  /**
   * Set when a **consonant-final** Classical stem takes a linking `u`/`ü`
   * before this suffix: `ab` + `γad` is `abuγad`, not `abγad`. A vowel-final
   * stem never takes it, so this is a property of the pair, not of the suffix
   * alone — hence a flag here rather than a second Classical form.
   *
   * Per-suffix because the corpus does not license a blanket rule: the
   * perfective converb attests it 14 times out of 14, while the imperfective
   * has судлаж → `sudulǰu` written flat. Only mark a row the corpus attests.
   */
  linking?: boolean;
  /**
   * Narrows `linking` to stems with this ending. Without it, `linking` applies
   * to every consonant-final stem.
   *
   * Exists because the `-в` past takes the vowel after a **б**-final stem only
   * — авав `abuba` but болов `bolba`, төгсөв `teγüsbe`, сонсов `sonusba`.
   * Those four attestations were recorded on 2026-07-30 as an irreducible
   * lexical split ("do not reconcile these two by inference"); rulebook
   * 2.2.3/39–40 states the condition that predicts all four.
   */
  linkingAfter?: StemCondition;
}

export interface AnalyzedToken {
  token: Token;
  /** Ranked best-first. Empty for every token kind except `word`. */
  candidates: readonly Candidate[];
  /**
   * Set when the word carries a verb ending. The converter has **no verb
   * morphology**, so this marks the reading as structurally out of scope
   * rather than merely uncertain — read it with the winning candidate's
   * `provenance`, and see `verb.ts` for how the two combine.
   */
  verbForm?: VerbEnding;
}

export interface RankContext {
  /** Every token of the input, so a ranker can look at neighbours. */
  tokens: readonly Token[];
  /** Index into `tokens` of the word being ranked. */
  index: number;
}

/**
 * Scores a candidate. Higher wins; scores are normalised into `confidence`
 * afterwards, so any positive scale works.
 *
 * This is the library's one statistical seam. `frequencyRanker` is a lookup
 * over counted numbers; a context n-gram or a model could replace it without
 * touching any other stage.
 */
export interface Ranker {
  name: string;
  score(candidate: Candidate, context: RankContext): number;
}

export interface ConvertOptions {
  ranker?: Ranker;
  /**
   * Stage 8 — reject candidates whose script form is malformed. Injected
   * rather than imported so this package never depends on the linter; pass a wrapper
   * around `lint` from `@gege-mn/gege-linter`.
   */
  validate?: (script: string) => boolean;
  /** Cap on candidates kept per word after ranking. Default 5. */
  maxCandidates?: number;
  /**
   * How to write digits in the output. Default `'ascii'` — the silver
   * charts record U+1810–1819 as "less used now" and UTN #57 §2.2.3 defers
   * every numeral specification, so converting by default would be inventing
   * a convention. Applied uniformly across the document, because mixing the
   * two is what gege-linter's `digit-consistency` flags. See `punctuation.ts`.
   */
  digits?: ScriptStyle;
  /**
   * How to write punctuation in the output. Default `'ascii'`, for the same
   * reason as `digits`. Only `, . … ? !` have supported counterparts; every
   * other mark passes through untouched.
   */
  punctuation?: ScriptStyle;
}
