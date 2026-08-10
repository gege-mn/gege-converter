/**
 * Khalkha Cyrillic suffix → Classical Mongolian suffix.
 *
 * Derived from the curated Hudum suffix knowledge base (2026-07-25), re-keyed
 * by Cyrillic surface form and annotated with the harmony class each allomorph
 * attaches to. That knowledge base is now canonical in
 * `@gege-mn/mongol-bichig` — the Classical forms below should come from there;
 * see the pending-migration note in CLAUDE.md.
 *
 * ⚠ PROVISIONAL. The Classical forms come from the linter's dictionary and
 * are sound; the *Cyrillic* pairings and the `separate` flags are this
 * package's own work and have not been reviewed by a Mongolian linguist.
 * Treat mismatches as bugs in this file, not in the pipeline.
 *
 * `after` records the condition from the "Use after" column of
 * `references/suffixes.md` in the mongol-bichig skill. It is checked against the **Classical**
 * stem (in `generate.ts`), never the Cyrillic one: Cyrillic хот is
 * consonant-final but Classical `qota` is not, so хотын is `qota-yin`. Each
 * allomorph set covers every possible stem ending, so no stem is left with
 * no reading at all.
 *
 * Known v0 gaps, deliberately left out because they over-match and would
 * shred ordinary words:
 * - bare genitive `-н` and accusative `-г`
 * - the modern directive `-руу/-рүү`, which has no clean Classical form
 * - verb morphology entirely (only the `-х` infinitive is handled, via the
 *   lexicon)
 */

import type { SuffixEntry } from '../types.js';

export const suffixes: readonly SuffixEntry[] = [
  // ─── -лиг, the adjectival, ruled 2026-07-30 ────────────────────────────
  // Four Cyrillic surfaces, **one** Classical form — the same asymmetry as
  // the directive, and the second one found in a week:
  //
  //   > "in cyrillic, it's загвар + лаг, exactly same logic as style + ish
  //   > => stylish. in similar suffixes, it's always 'лиг' ending, e.g.,
  //   > оюунлаг = оюун + лаг = ойунлиг"
  //
  // Written attached, no connector: загварлаг is `zaγburlig`, one word.
  // Confirmed by the official rules table (Нэр үгийн хувилал) the reader
  // supplied the same day. Before this, загварлаг came out `zaγbarla-yi` —
  // the final г read as an accusative.
  { cyrillic: 'лаг', classical: 'lig', category: 'derivational', separate: false },
  { cyrillic: 'лэг', classical: 'lig', category: 'derivational', separate: false },
  { cyrillic: 'лог', classical: 'lig', category: 'derivational', separate: false },
  { cyrillic: 'лөг', classical: 'lig', category: 'derivational', separate: false },

  // ─── The -нх- possessive stack, ruled 2026-07-30 ───────────────────────
  // The Cyrillic х has no Classical counterpart at all: it is simply the
  // genitive followed by the reflexive.
  //
  //   > "анги + ийн + аа = ᠠᠩᠭᠢ<MVS>ᠶᠢᠨ<MVS>ᠢᠶᠠᠨ"   (connectors written out)
  //
  // `docs/roadmap.md` guessed `ang-un-iyan` for this word and was wrong on
  // both halves — the stem is `angγi`, not `ang`, and a vowel-final stem
  // takes `yin`, not `un`. The reflexive is `iyan`/`iyen` throughout because
  // what it attaches to is the genitive's final n, a consonant.
  //
  // Listed as one unit in the official table (Тийн ялгалтай хамаатуулах
  // нөхцөл: Харьяалах -ынхаа²/-нийхээ³) and written here as one row for the
  // same reason: peeling it as two would need the segmenter to know that a
  // Cyrillic х can vanish.
  // Eight Cyrillic surfaces, because two things vary independently: the
  // genitive is written -ын/-ийн after a consonant but collapses to -йн after
  // a vowel (анги + йнхаа = ангийнхаа), and the reflexive harmonises four
  // ways. The Classical side has only the two genitive allomorphs — the
  // reflexive is `iyan`/`iyen` throughout, because it attaches to the
  // genitive's final n.
  ...(
    [
      // Cyrillic          Classical      harmony        stem ending
      ['ынхаа', 'un-iyan', 'masculine', 'consonant-not-n'],
      ['ынхоо', 'un-iyan', 'masculine', 'consonant-not-n'],
      ['ийнхээ', 'ün-iyen', 'feminine', 'consonant-not-n'],
      ['ийнхөө', 'ün-iyen', 'feminine', 'consonant-not-n'],
      // The -ийн-after-г/ш/ь/й/и exception, same as the plain genitive below.
      ['ийнхаа', 'un-iyan', 'masculine', 'consonant-not-n'],
      ['ийнхоо', 'un-iyan', 'masculine', 'consonant-not-n'],
      // Vowel-final stems: the genitive's own и merges into the stem.
      ['йнхаа', 'yin-iyan', 'masculine', 'vowel'],
      ['йнхоо', 'yin-iyan', 'masculine', 'vowel'],
      ['йнхээ', 'yin-iyen', 'feminine', 'vowel'],
      ['йнхөө', 'yin-iyen', 'feminine', 'vowel'],
      // An н-final Classical stem takes the short genitive u/ü, and the
      // reflexive after that vowel is ban/ben, not iyan/iyen. Neither half is
      // new — this composes the two allomorph rules the registry already
      // owns, so that хааны + хаа is not left with no reading at all.
      ['ынхаа', 'u-ban', 'masculine', 'n'],
      ['ынхоо', 'u-ban', 'masculine', 'n'],
      ['ийнхээ', 'ü-ben', 'feminine', 'n'],
      ['ийнхөө', 'ü-ben', 'feminine', 'n'],
      // …and the same four with the stem's н written out, which is what the
      // тогтворгүй н does here exactly as it does to the plain genitive below.
      // Хавсралт row 12 lists all four surfaces together — -ынхаа², -ийнхаа⁴,
      // **-ныхаа², -нийхаа³** — and says they split "by the same three genitive
      // conditions", so leaving these out was an incoherence rather than a
      // choice: усныхаа had no reading at all and came out `usniqu-ban`.
      ['ныхаа', 'u-ban', 'masculine', 'n'],
      ['ныхоо', 'u-ban', 'masculine', 'n'],
      ['нийхээ', 'ü-ben', 'feminine', 'n'],
      ['нийхөө', 'ü-ben', 'feminine', 'n'],
      // …and once more with the н left on the STEM side, because Cyrillic puts
      // it there whenever the stem is already spelled with one: хаан → хааны →
      // хааныхаа, тан → таныхаа. Same Classical, different place to cut.
      //
      // Which of the two a word takes is lexical, not predictable — тав `tabun`
      // is also n-final and writes тавынхаа, up in the block above. So all
      // three surfaces are offered and the stem lookup decides; without this
      // one, хааныхаа could only be cut as хаа + ныхаа, and a `qa` row turned
      // a khan into `qan-u-ban`.
      ['ыхаа', 'u-ban', 'masculine', 'n'],
      ['ыхоо', 'u-ban', 'masculine', 'n'],
      ['ийхээ', 'ü-ben', 'feminine', 'n'],
      ['ийхөө', 'ü-ben', 'feminine', 'n'],
    ] as const
  ).map(
    ([cyrillic, classical, harmony, after]): SuffixEntry => ({
      cyrillic,
      classical,
      category: 'case-possessive',
      harmony,
      after,
      separate: true,
    }),
  ),

  // Genitive — харьяалахын тийн ялгал.
  // yin after a vowel, un/ün after a consonant, u/ü after н (where the н
  // belongs to the Classical stem: ᠬᠠᠭᠠᠨ ᠤ = хааны).
  { cyrillic: 'ын', classical: 'yin', category: 'genitive', after: 'vowel', separate: true },
  { cyrillic: 'ийн', classical: 'yin', category: 'genitive', after: 'vowel', separate: true },
  {
    cyrillic: 'ын',
    classical: 'un',
    category: 'genitive',
    harmony: 'masculine',
    after: 'consonant-not-n',
    separate: true,
  },
  {
    cyrillic: 'ийн',
    classical: 'ün',
    category: 'genitive',
    harmony: 'feminine',
    after: 'consonant-not-n',
    separate: true,
  },
  // Cyrillic writes -ийн rather than -ын after г, ш, ь, й and и even in
  // back-vowel words, so a masculine stem can surface with either: цаг →
  // цагийн is Classical čaγ-un, not čaγ-ün and not čaγ-yin.
  {
    cyrillic: 'ийн',
    classical: 'un',
    category: 'genitive',
    harmony: 'masculine',
    after: 'consonant-not-n',
    separate: true,
  },
  {
    cyrillic: 'ы',
    classical: 'u',
    category: 'genitive',
    harmony: 'masculine',
    after: 'n',
    separate: true,
  },
  // Cyrillic -ы presupposes an н-final stem, and for a native word the
  // Classical stem ends in н too, so the row above covers it. A loanword can
  // break that correspondence: банан is `banana`, vowel-final, because the
  // word is spelled as the foreign word — so бананы needs the vowel-final
  // allomorph and had no way to assemble one. Ruled 2026-08-10.
  //
  // This is a missing *allomorph*, not a rule about loanwords: the condition
  // is read off the Classical stem, so it fires only where the Cyrillic says
  // н and the Classical says vowel. Nothing here generalises from the foreign
  // word — see the footgun in CLAUDE.md.
  { cyrillic: 'ы', classical: 'yin', category: 'genitive', after: 'vowel', separate: true },
  {
    cyrillic: 'ий',
    classical: 'ü',
    category: 'genitive',
    harmony: 'feminine',
    after: 'n',
    separate: true,
  },

  // Accusative — заахын тийн ялгал. One form per condition, no harmony pair.
  { cyrillic: 'ыг', classical: 'yi', category: 'accusative', after: 'vowel', separate: true },
  { cyrillic: 'ийг', classical: 'yi', category: 'accusative', after: 'vowel', separate: true },
  { cyrillic: 'ыг', classical: 'i', category: 'accusative', after: 'consonant', separate: true },
  { cyrillic: 'ийг', classical: 'i', category: 'accusative', after: 'consonant', separate: true },

  // Dative-locative — өгөх оршихын тийн ялгал.
  // d-forms after vowels and the soft finals н, м, л, нг; t-forms after the
  // hard finals б, г, р, с, д — so Cyrillic -д is not by itself a d-form:
  // улсад is ulus-tu, because Classical ulus ends in с.
  {
    cyrillic: 'д',
    classical: 'du',
    category: 'dative-locative',
    harmony: 'masculine',
    after: 'not-hard',
    separate: true,
  },
  {
    cyrillic: 'д',
    classical: 'dü',
    category: 'dative-locative',
    harmony: 'feminine',
    after: 'not-hard',
    separate: true,
  },
  {
    cyrillic: 'д',
    classical: 'tu',
    category: 'dative-locative',
    harmony: 'masculine',
    after: 'hard',
    separate: true,
  },
  {
    cyrillic: 'д',
    classical: 'tü',
    category: 'dative-locative',
    harmony: 'feminine',
    after: 'hard',
    separate: true,
  },
  // Cyrillic -т is written only after в, г, д, р, с, all of which are hard
  // finals in Classical too, so these need no condition of their own.
  {
    cyrillic: 'т',
    classical: 'tu',
    category: 'dative-locative',
    harmony: 'masculine',
    separate: true,
  },
  {
    cyrillic: 'т',
    classical: 'tü',
    category: 'dative-locative',
    harmony: 'feminine',
    separate: true,
  },

  // Ablative — гарахын тийн ялгал
  { cyrillic: 'аас', classical: 'ača', category: 'ablative', harmony: 'masculine', separate: true },
  { cyrillic: 'оос', classical: 'ača', category: 'ablative', harmony: 'masculine', separate: true },
  { cyrillic: 'ээс', classical: 'eče', category: 'ablative', harmony: 'feminine', separate: true },
  { cyrillic: 'өөс', classical: 'eče', category: 'ablative', harmony: 'feminine', separate: true },

  // Instrumental — үйлдэхийн тийн ялгал. bar/ber after a vowel, iyar/iyer
  // after a consonant.
  {
    cyrillic: 'аар',
    classical: 'iyar',
    category: 'instrumental',
    harmony: 'masculine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'оор',
    classical: 'iyar',
    category: 'instrumental',
    harmony: 'masculine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'ээр',
    classical: 'iyer',
    category: 'instrumental',
    harmony: 'feminine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'өөр',
    classical: 'iyer',
    category: 'instrumental',
    harmony: 'feminine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'аар',
    classical: 'bar',
    category: 'instrumental',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'оор',
    classical: 'bar',
    category: 'instrumental',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'ээр',
    classical: 'ber',
    category: 'instrumental',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'өөр',
    classical: 'ber',
    category: 'instrumental',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },

  // ─── -тай³ is TWO suffixes, and we used to offer only one ──────────────
  //
  // Rulebook §2.3.6: *"-тай³ as a case-like ending is дагуулж; as an
  // adjective-forming дагавар it is **always залгаж** (хэрэгтэй, ёстой,
  // санаатай)."* The Cyrillic surface is identical for both, so this is not a
  // rule the segmenter can apply — it is a second candidate the ranker weighs.
  //
  // Both blocks below are therefore real rows and neither replaces the other.
  // Emitting only the comitative scored **0.0% on all 234** adjectival forms in
  // the inflected gold; emitting only the adjectival would be the same mistake
  // pointing the other way, and it is a mistake this project has already made
  // once — see the `-лаа` correction in the `verb-suffixes.ts` header, where a
  // lemma dictionary's headwords were read as running-text frequency.
  //
  // ## The share, and how it was measured (2026-08-10)
  //
  // Counted over the 4,000 sentences of **running text** in
  // `.tmp/harvest-sentences.jsonl`, pairing each Cyrillic token ending -тай³
  // with its bichig form in sentences carrying exactly one of each, so the
  // pairing is forced and needs no alignment (n=791; the unpaired count over
  // all 980 bichig tokens agrees at 72.6/27.4):
  //
  //   залгаж, attached    573   72.4%
  //   дагуулж, detached   218   27.6%
  //
  // Three things say that split is the rulebook's distinction and not noise:
  // the rulebook's own three examples are 118/0 attached (хэрэгтэй 64, ёстой
  // 48, санаатай 6); pronoun and person-noun heads — the canonical comitative
  // environment — run 3 attached to 30 detached (надтай, хүнтэй, түүнтэй,
  // тантай all 0/n); and 71 of the gold's adjectival forms also occur in
  // running text, which writes them attached 363 times against 21.
  //
  // ⚠ The **lemma harvest** is not evidence here and was not used: a lemma list
  // carries -тай words as headwords only when they are adjectives, which is
  // exactly the selection bias that inverted `-лаа`. The measurement above is
  // running text, where the comitative is 27.6% — a large minority that has to
  // keep winning where it is right, which is what the losing row is for.
  //
  // Comitative — хамтрахын тийн ялгал. Дагуулж (§2.3.1).
  {
    cyrillic: 'тай',
    classical: 'tai',
    category: 'comitative',
    harmony: 'masculine',
    separate: true,
    share: 0.28,
  },
  {
    cyrillic: 'той',
    classical: 'tai',
    category: 'comitative',
    harmony: 'masculine',
    separate: true,
    share: 0.28,
  },
  {
    cyrillic: 'тэй',
    classical: 'tei',
    category: 'comitative',
    harmony: 'feminine',
    separate: true,
    share: 0.28,
  },
  {
    cyrillic: 'төй',
    classical: 'tei',
    category: 'comitative',
    harmony: 'feminine',
    separate: true,
    share: 0.28,
  },

  // Adjective-forming -тай³ — дагавар, залгаж (§2.3.6). Same Classical letters,
  // no connector: хэрэгтэй is `keregtei`, one word, where the comitative хүнтэй
  // is `qümün-tei`.
  //
  // `derivational` is not decoration. It puts these rows in SLOT 0, the
  // innermost slot, so the segmenter can only build this reading directly on a
  // bare stem — a дагавар is word-forming and sits inside every inflection. The
  // gold agrees without being asked to: **all 234** attached rows are bare stem
  // + тай with nothing else in the chain, while 55 of the 123 detached ones
  // carry a plural first (аавуудтай `abu-nuγud-tai`). So plural + тай keeps the
  // comitative reading uncontested, and that falls out of the category rather
  // than out of a special case.
  {
    cyrillic: 'тай',
    classical: 'tai',
    category: 'derivational',
    harmony: 'masculine',
    separate: false,
    share: 0.72,
  },
  {
    cyrillic: 'той',
    classical: 'tai',
    category: 'derivational',
    harmony: 'masculine',
    separate: false,
    share: 0.72,
  },
  {
    cyrillic: 'тэй',
    classical: 'tei',
    category: 'derivational',
    harmony: 'feminine',
    separate: false,
    share: 0.72,
  },
  {
    cyrillic: 'төй',
    classical: 'tei',
    category: 'derivational',
    harmony: 'feminine',
    separate: false,
    share: 0.72,
  },

  // Reflexive-possessive — хамаатуулах нөхцөл. ban/ben after a vowel,
  // iyan/iyen after a consonant. Stacks after a case suffix (задлаг хэлбэр),
  // where the condition reads the case suffix's own final letter.
  {
    cyrillic: 'аа',
    classical: 'ban',
    category: 'reflexive',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'оо',
    classical: 'ban',
    category: 'reflexive',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'ээ',
    classical: 'ben',
    category: 'reflexive',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'өө',
    classical: 'ben',
    category: 'reflexive',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'аа',
    classical: 'iyan',
    category: 'reflexive',
    harmony: 'masculine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'оо',
    classical: 'iyan',
    category: 'reflexive',
    harmony: 'masculine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'ээ',
    classical: 'iyen',
    category: 'reflexive',
    harmony: 'feminine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'өө',
    classical: 'iyen',
    category: 'reflexive',
    harmony: 'feminine',
    after: 'consonant',
    separate: true,
  },

  // Plural — олон тооны дагавар. Written DETACHED, after a connector, like
  // the case suffixes. The allomorph is chosen by the Classical stem: ud/üd
  // after a consonant, nuγud/nügüd after a vowel. That condition is what keeps
  // a chachlag stem well-formed — харууд is qar-a + nuγud (хар-а нугуд), never
  // qar-a + ud, which would strand the connector. Confirmed 2026-07-26.
  //
  // ⚠ **An NA-final condition was tried on 2026-08-10 and REVERTED. Do not
  // re-derive it from the gold set — the gold is wrong here, or at least it is
  // not what the reader writes.**
  //
  // The evidence for it looks overwhelming and is entirely Tungaamal's. Counted
  // over the whole inflected gold set by the Classical stem's final letter:
  //
  //   n-final          →  nuγud   37   ud/üd   0
  //   vowel-final      →  nuγud  176   ud/üd   0
  //   other consonant  →  nuγud   16   ud/üd 160
  //
  // 37/0 reads as categorical, and splitting `consonant` into
  // `consonant-not-n` + `n` duly fixed настангууд (`nasutan-ud` → the gold's
  // `nasutan-nuγud`) and simulated at about +1.5pp with no regression on the
  // gold set at all.
  //
  // It regressed a **reader-confirmed** ruling: мэргэжилтнүүд is
  // `merγeǰilten-üd`, reader-supplied on 2026-07-26 for a word Tungaamal has no
  // row for. That stem ends in NA and takes the bare `üd`.
  //
  // The two cannot be told apart. настан and мэргэжилтэн are the **same
  // morphology** — an agentive in -тан/-тэн — so no condition available here
  // separates them, and the only real difference is which source the answer
  // came from. `test/rulings.test.ts` outranks the gold by construction, so the
  // bare form stays. What this actually shows is that ~37 gold rows disagree
  // with the reader on the plural of an n-final stem, which is a question for
  // an ask page, not a condition for this table.
  {
    cyrillic: 'ууд',
    classical: 'ud',
    category: 'plural',
    harmony: 'masculine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'ууд',
    classical: 'nuγud',
    category: 'plural',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'үүд',
    classical: 'üd',
    category: 'plural',
    harmony: 'feminine',
    after: 'consonant',
    separate: true,
  },
  {
    cyrillic: 'үүд',
    classical: 'nügüd',
    category: 'plural',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'нууд',
    classical: 'nuγud',
    category: 'plural',
    harmony: 'masculine',
    separate: true,
  },
  {
    cyrillic: 'нүүд',
    classical: 'nügüd',
    category: 'plural',
    harmony: 'feminine',
    separate: true,
  },
  { cyrillic: 'нар', classical: 'nar', category: 'plural', harmony: 'masculine', separate: true },
  { cyrillic: 'нэр', classical: 'ner', category: 'plural', harmony: 'feminine', separate: true },

  // ---- Cyrillic surface after an и/й-final stem ---------------------------
  //
  // Cyrillic contracts a suffix's own leading vowel against a stem-final и/й
  // instead of writing both: анги + ийн surfaces as ангийн (not ангиийн),
  // анги + аар as ангиар, анги + ууд as ангиуд, морь + той + аа as морьтойгоо.
  // The CLASSICAL suffix is unchanged in every case — only the Cyrillic
  // spelling differs — so these are additional surface pairings for suffixes
  // already listed above, not new suffixes.
  //
  // All are pinned to `after: 'vowel'`, which `generate.ts` checks against the
  // resolved CLASSICAL stem. That is what keeps short forms like `ар` and `ас`
  // from shredding ordinary words: a consonant-final stem rejects them no
  // matter how the Cyrillic happens to end, and `MIN_STEM_LENGTH` drops the
  // rest (сар → с is too short to be a stem).
  //
  // Found by the held-out gold set on 2026-07-26: ~84% of the forms that were
  // unreachable even with a perfect stem were this one hole.
  { cyrillic: 'йн', classical: 'yin', category: 'genitive', after: 'vowel', separate: true },
  { cyrillic: 'йг', classical: 'yi', category: 'accusative', after: 'vowel', separate: true },
  {
    cyrillic: 'ар',
    classical: 'bar',
    category: 'instrumental',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'ор',
    classical: 'bar',
    category: 'instrumental',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'эр',
    classical: 'ber',
    category: 'instrumental',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'өр',
    classical: 'ber',
    category: 'instrumental',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'ас',
    classical: 'ača',
    category: 'ablative',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'ос',
    classical: 'ača',
    category: 'ablative',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'эс',
    classical: 'eče',
    category: 'ablative',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'өс',
    classical: 'eče',
    category: 'ablative',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'уд',
    classical: 'nuγud',
    category: 'plural',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'үд',
    classical: 'nügüd',
    category: 'plural',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  // Reflexive after a vowel-final form takes a linking г in Cyrillic —
  // морьтой + аа is морьтойгоо, never морьтойаа. Classical is the plain
  // ban/ben, the same allomorph the vowel condition already selects.
  {
    cyrillic: 'гаа',
    classical: 'ban',
    category: 'reflexive',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'гоо',
    classical: 'ban',
    category: 'reflexive',
    harmony: 'masculine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'гээ',
    classical: 'ben',
    category: 'reflexive',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  {
    cyrillic: 'гөө',
    classical: 'ben',
    category: 'reflexive',
    harmony: 'feminine',
    after: 'vowel',
    separate: true,
  },
  // Genitive -ны/-ний after a stem ending in м or н: ном → номны is nom-un,
  // баар → баарны is baγar-un. The Classical allomorph is the ordinary
  // consonant-stem one; only the Cyrillic surface is unlisted above.
  {
    cyrillic: 'ны',
    classical: 'un',
    category: 'genitive',
    harmony: 'masculine',
    after: 'consonant-not-n',
    separate: true,
  },
  {
    cyrillic: 'ний',
    classical: 'ün',
    category: 'genitive',
    harmony: 'feminine',
    after: 'consonant-not-n',
    separate: true,
  },
  // The same two Cyrillic surfaces read the other way: the **н is the stem's**,
  // not the suffix's, and what follows it is the after-н genitive -у/-ү. This is
  // the тогтворгүй н — Хавсралт 2.1.1 row 1(b) puts н-final stems and
  // тогтворгүй-н words under one condition, so зүрх `ǰirüken` needs nothing but
  // the row, while нүд `nidü` gets its NA back first (`stemReadings`).
  //
  // Both readings are offered for both surfaces and the `after` conditions keep
  // them apart: a stem is either n-final or it is not. зүрхний was the single
  // heaviest word in `check:orphans` — a correct lexicon stem thrown away and
  // the word rebuilt letter by letter — and it, анхны, насны, нарны and дууны
  // are all this one missing row.
  {
    cyrillic: 'ны',
    classical: 'u',
    category: 'genitive',
    harmony: 'masculine',
    after: 'n',
    separate: true,
  },
  {
    cyrillic: 'ний',
    classical: 'ü',
    category: 'genitive',
    harmony: 'feminine',
    after: 'n',
    separate: true,
  },

  { cyrillic: 'г', classical: 'yi', category: 'accusative', after: 'vowel', separate: true },
];

/** Suffix entries whose Cyrillic form matches the end of `word`, longest first. */
export const suffixesEndingIn = (word: string): SuffixEntry[] =>
  suffixes
    .filter((s) => word.endsWith(s.cyrillic))
    .sort((a, b) => b.cyrillic.length - a.cyrillic.length);

/**
 * Is the leading **н** of this row's Cyrillic form the *stem's* letter rather
 * than the suffix's — i.e. is this the тогтворгүй н written out?
 *
 * True for exactly the -ны/-ний genitives conditioned on an н-final stem, where
 * the row spells stem-н plus the after-н genitive -ы/-ий.
 *
 * ⚠ Being н-initial is **not** enough, and assuming it was is a bug this
 * function exists to prevent: the plurals -нар, -нэр, -нууд and -нүүд also
 * begin with н and that н is entirely their own (`nar`, `nuγud`). They carry no
 * `after` condition, so nothing else would have rejected a stem with an н glued
 * on — багшнар came out as a coin flip between `baγsi-nar` and `baγsin-nar`,
 * both at 0.47, until this was narrowed.
 *
 * Read by `segment.ts` (which must not offer an epenthetic stem here) and by
 * `generate.ts` (which must offer the н-restored one). Two call sites, one
 * predicate, so they cannot drift apart.
 */
export const carriesStemN = (suffix: SuffixEntry): boolean =>
  suffix.after === 'n' && suffix.cyrillic.startsWith('н');
