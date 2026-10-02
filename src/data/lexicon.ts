/**
 * Seed stem lexicon: Mongolian Cyrillic → Classical Mongolian.
 *
 * ⚠ THIS IS AN UNVERIFIED SEED, NOT A DICTIONARY. ~150 hand-written entries
 * chosen because their Classical forms are well attested in the standard
 * reference literature. It exists to make the pipeline runnable and testable
 * end to end, not to be correct at scale. Every entry needs review by a
 * reader of Mongol bichig before this package claims accuracy.
 *
 * Replacing this file is the project's main data task. The intended source is
 * CoPiT (arXiv 2607.05849, July 2026), which released 14,125 Cyrillic ↔
 * traditional word pairs under CC BY 4.0 — permissive and MIT-compatible.
 * Wiktionary via kaikki.org adds ~2,900 more under CC BY-SA. Both are
 * drop-in: this module only has to keep exporting `LexiconEntry[]`.
 *
 * Classical forms are written in the romanization defined by `romanize.ts`,
 * where `-` is a chachlag (MVS). `test/data.test.ts` asserts every entry here
 * converts to script without error, so typos fail the build rather than
 * silently producing malformed Unicode.
 *
 * `freq` matters only where one Cyrillic key has several readings; it is
 * hand-assigned, not counted from a corpus. Counting it is future work.
 *
 * Two orthographic rules were applied across this file on 2026-07-26, after
 * review by a bichig reader:
 *
 * 1. **o and ö are written only in the first syllable.** After it, masculine
 *    words take u and feminine ü — монгол is `mongγul`, богино is `boγuni`.
 *    This is categorical, not a tendency. It contradicts the Poppe §33
 *    reading recorded in the orthography reference, which licenses non-initial
 *    o after an initial o; the school rule taught in Mongolia does not, and
 *    the school rule is the one to follow — settled 2026-07-26 after
 *    The silver was found to apply it throughout its own output.
 *    `гол` → `γool` is a genuine lexical exception and is commented as such.
 * 2. **Medial i-diphthongs are written V+i, not V+y+i** — сайн is `sain`, per
 *    the modern analysis UTN #57 prefers over the older Classical spelling.
 */

import type { LexiconEntry } from '../types.js';
import { harvestedLexicon } from './harvested-lexicon.js';

export const lexicon: readonly LexiconEntry[] = [
  // ─── Ambiguous: the motivating case ────────────────────────────────────
  // хар is the standing example of a Cyrillic form with two Classical
  // readings. The verb stem only ever surfaces with a suffix, so ranking
  // should prefer the adjective for the bare word.
  { cyrillic: 'хар', classical: 'qar-a', gloss: 'black', freq: 0.8 },
  { cyrillic: 'хар', classical: 'qara', gloss: 'to look (stem)', freq: 0.2 },

  // ─── Core nouns ────────────────────────────────────────────────────────
  { cyrillic: 'монгол', classical: 'mongγul', gloss: 'Mongol', freq: 1 },
  // Both plurals are real and mean the same thing: -čud is the grammatical
  // form, -čuul a colloquial one (ruled 2026-07-26). Keeping both means
  // монголчууд round-trips whichever a writer used. The stem keeps `u` per the
  // o/ö rule even though the silver writes mongγol here — that ruling stands.
  { cyrillic: 'монголчууд', classical: 'mongγulčud', gloss: 'Mongols', freq: 0.7 },
  { cyrillic: 'монголчууд', classical: 'mongγulčuul', gloss: 'Mongols (colloquial)', freq: 0.3 },
  { cyrillic: 'бичиг', classical: 'bičig', gloss: 'writing, script', freq: 1 },
  { cyrillic: 'ном', classical: 'nom', gloss: 'book', freq: 1 },
  { cyrillic: 'үг', classical: 'üge', gloss: 'word', freq: 1 },
  { cyrillic: 'нэр', classical: 'ner-e', gloss: 'name', freq: 1 },
  // ⚠ `hiddenN: false` is load-bearing. `kele` ends in a vowel, so the default
  // rule in `stem.ts` would give it a тогтворгүй н — and хэлэнд is `kele-dü`,
  // reader-ruled, where the н is the жийрэг н Cyrillic inserts and Classical
  // does not have. This is one of the two exceptions the whole suite turned up.
  { cyrillic: 'хэл', classical: 'kele', gloss: 'language, tongue', freq: 1, hiddenN: false },
  { cyrillic: 'газар', classical: 'γaǰar', gloss: 'earth, place', freq: 1 },
  { cyrillic: 'хот', classical: 'qota', gloss: 'city', freq: 1 },
  { cyrillic: 'улс', classical: 'ulus', gloss: 'state, nation', freq: 1 },
  { cyrillic: 'гэр', classical: 'ger', gloss: 'ger, home', freq: 1 },
  { cyrillic: 'зам', classical: 'ǰam', gloss: 'road', freq: 1 },
  { cyrillic: 'ажил', classical: 'aǰil', gloss: 'work', freq: 1 },
  { cyrillic: 'сургууль', classical: 'surγaγuli', gloss: 'school', freq: 1 },
  { cyrillic: 'эрдэм', classical: 'erdem', gloss: 'knowledge', freq: 1 },
  { cyrillic: 'цаг', classical: 'čaγ', gloss: 'time', freq: 1 },
  { cyrillic: 'жил', classical: 'ǰil', gloss: 'year', freq: 1 },
  { cyrillic: 'сар', classical: 'sara', gloss: 'moon, month', freq: 1 },
  { cyrillic: 'өдөр', classical: 'edür', gloss: 'day', freq: 1 },
  { cyrillic: 'баяр', classical: 'bayar', gloss: 'joy, celebration', freq: 1 },

  // ─── People ────────────────────────────────────────────────────────────
  { cyrillic: 'хүн', classical: 'kümün', gloss: 'person', freq: 1 },
  { cyrillic: 'эх', classical: 'eke', gloss: 'mother', freq: 1 },
  { cyrillic: 'эцэг', classical: 'ečige', gloss: 'father', freq: 1 },
  { cyrillic: 'аав', classical: 'abu', gloss: 'father (familiar)', freq: 1 },
  { cyrillic: 'ах', classical: 'aq-a', gloss: 'elder brother', freq: 1 },
  // ⚠ This row said `köbegün` from the seed until 2026-08-10, and it was on the
  // wrong key. Reader: "köbegün = хөвгүүн (not хүү, but is a synonym)." So the
  // seed had not mistranslated anything — it had attached the Classical form of
  // one word to the Cyrillic of its synonym, which no gloss check could catch
  // because the gloss was right for both. The spot check reached it through
  // хүүг, where the reader gave `qüü-yi`.
  { cyrillic: 'хүү', classical: 'qüü', gloss: 'son, boy', freq: 1 },
  { cyrillic: 'хөвгүүн', classical: 'köbegün', gloss: 'son, boy (literary synonym)', freq: 1 },
  { cyrillic: 'охин', classical: 'ökin', gloss: 'daughter, girl', freq: 1 },
  { cyrillic: 'ард', classical: 'arad', gloss: 'the people', freq: 1 },
  { cyrillic: 'эмч', classical: 'emči', gloss: 'doctor', freq: 1 },
  // ᠰ, ruled 2026-08-04 — see "The four ᠱ rows, settled" in docs/rulings.md.
  { cyrillic: 'багш', classical: 'baγsi', gloss: 'teacher', freq: 1 },
  { cyrillic: 'сурагч', classical: 'suruγči', gloss: 'pupil', freq: 1 },
  { cyrillic: 'хаан', classical: 'qaγan', gloss: 'khan', freq: 1 },
  { cyrillic: 'хатан', classical: 'qatun', gloss: 'queen', freq: 1 },
  { cyrillic: 'баатар', classical: 'baγatur', gloss: 'hero', freq: 1 },
  { cyrillic: 'цэрэг', classical: 'čerig', gloss: 'soldier', freq: 1 },

  // ─── Body ──────────────────────────────────────────────────────────────
  { cyrillic: 'толгой', classical: 'toluγai', gloss: 'head', freq: 1 },
  { cyrillic: 'нүүр', classical: 'niγur', gloss: 'face', freq: 1 },
  { cyrillic: 'нүд', classical: 'nidü', gloss: 'eye', freq: 1, hiddenN: true },
  { cyrillic: 'чих', classical: 'čikin', gloss: 'ear', freq: 1 },
  { cyrillic: 'ам', classical: 'aman', gloss: 'mouth', freq: 1 },
  // Ruled 2026-08-04, and the reader rejected BOTH options offered: not the
  // letter alone but the final н too — "both wrong, sidü".
  { cyrillic: 'шүд', classical: 'sidü', gloss: 'tooth', freq: 1 },
  { cyrillic: 'гар', classical: 'γar', gloss: 'hand, arm', freq: 1 },
  { cyrillic: 'хөл', classical: 'köl', gloss: 'foot, leg', freq: 1 },
  // `ǰirüqe`, the reader's citation form (2026-08-06), not the `ǰirüken` this
  // row held. Flipping it was blocked on the machinery: with nothing reading
  // hiddenN, the bare form was right and every oblique lost the letter. Now the
  // н comes back under a suffix, so зүрхний stays `ǰirüken-ü` — q and k are one
  // letter ᠬ, so the two spellings are the same code points either way.
  { cyrillic: 'зүрх', classical: 'ǰirüqe', gloss: 'heart', freq: 1 },
  { cyrillic: 'үс', classical: 'üsün', gloss: 'hair', freq: 1 },
  { cyrillic: 'цус', classical: 'čisun', gloss: 'blood', freq: 1 },
  { cyrillic: 'яс', classical: 'yasun', gloss: 'bone', freq: 1 },

  // ─── Nature ────────────────────────────────────────────────────────────
  { cyrillic: 'уул', classical: 'aγula', gloss: 'mountain', freq: 1 },
  { cyrillic: 'ус', classical: 'usu', gloss: 'water', freq: 1, hiddenN: true },
  { cyrillic: 'гал', classical: 'γal', gloss: 'fire', freq: 1 },
  { cyrillic: 'нар', classical: 'naran', gloss: 'sun', freq: 1 },
  { cyrillic: 'од', classical: 'odu', gloss: 'star', freq: 1, hiddenN: true },
  { cyrillic: 'тэнгэр', classical: 'tngri', gloss: 'sky, heaven', freq: 1 },
  { cyrillic: 'дэлхий', classical: 'delekei', gloss: 'world', freq: 1 },
  { cyrillic: 'мод', classical: 'modu', gloss: 'tree, wood', freq: 1, hiddenN: true },
  { cyrillic: 'ой', classical: 'oi', gloss: 'forest', freq: 1 },
  // Doubled o is not a typo here. docs/orthography.md notes that doubled o
  // marks a *short* o in a handful of lexical items; гол is one of them —
  // confirmed as a traditional exception 2026-07-26. Do not "correct" to γoul.
  { cyrillic: 'гол', classical: 'γool', gloss: 'river', freq: 1 },
  { cyrillic: 'нуур', classical: 'naγur', gloss: 'lake', freq: 1 },
  { cyrillic: 'тэнгис', classical: 'tenggis', gloss: 'sea', freq: 1 },
  { cyrillic: 'тал', classical: 'tal-a', gloss: 'steppe, plain', freq: 1 },
  { cyrillic: 'цөл', classical: 'čöl', gloss: 'desert', freq: 1 },
  { cyrillic: 'хад', classical: 'qada', gloss: 'rock, cliff', freq: 1 },
  { cyrillic: 'элс', classical: 'elesü', gloss: 'sand', freq: 1 },
  { cyrillic: 'чулуу', classical: 'čilaγu', gloss: 'stone', freq: 1, hiddenN: true },
  { cyrillic: 'өвс', classical: 'ebesü', gloss: 'grass', freq: 1, hiddenN: true },
  { cyrillic: 'салхи', classical: 'salkin', gloss: 'wind', freq: 1 },
  { cyrillic: 'бороо', classical: 'boruγ-a', gloss: 'rain', freq: 1 },
  { cyrillic: 'цас', classical: 'času', gloss: 'snow', freq: 1, hiddenN: true },
  { cyrillic: 'үүл', classical: 'egüle', gloss: 'cloud', freq: 1 },

  // ─── Seasons and times ─────────────────────────────────────────────────
  { cyrillic: 'хавар', classical: 'qabur', gloss: 'spring', freq: 1 },
  { cyrillic: 'зун', classical: 'ǰun', gloss: 'summer', freq: 1 },
  { cyrillic: 'намар', classical: 'namur', gloss: 'autumn', freq: 1 },
  { cyrillic: 'өвөл', classical: 'ebül', gloss: 'winter', freq: 1 },
  { cyrillic: 'өглөө', classical: 'örlüge', gloss: 'morning', freq: 1 },
  { cyrillic: 'орой', classical: 'orui', gloss: 'evening', freq: 1 },
  { cyrillic: 'шөнө', classical: 'söni', gloss: 'night', freq: 1 },
  { cyrillic: 'маргааш', classical: 'marγasi', gloss: 'tomorrow', freq: 1 },

  // ─── Animals and livestock ─────────────────────────────────────────────
  { cyrillic: 'мал', classical: 'mal', gloss: 'livestock', freq: 1 },
  { cyrillic: 'морь', classical: 'mori', gloss: 'horse', freq: 1, hiddenN: true },
  { cyrillic: 'хонь', classical: 'qoni', gloss: 'sheep', freq: 1, hiddenN: true },
  { cyrillic: 'үхэр', classical: 'üker', gloss: 'cattle', freq: 1 },
  { cyrillic: 'тэмээ', classical: 'temege', gloss: 'camel', freq: 1, hiddenN: true },
  { cyrillic: 'нохой', classical: 'noqai', gloss: 'dog', freq: 1 },
  // Chachlag, ruled 2026-08-04. `činua` was a vowel straight after a vowel with
  // no connector — malformed rather than chosen.
  { cyrillic: 'чоно', classical: 'činu-a', gloss: 'wolf', freq: 1 },
  { cyrillic: 'үнэг', classical: 'ünegen', gloss: 'fox', freq: 1 },
  { cyrillic: 'туулай', classical: 'taulai', gloss: 'rabbit', freq: 1 },
  { cyrillic: 'шувуу', classical: 'sibaγu', gloss: 'bird', freq: 1, hiddenN: true },
  { cyrillic: 'загас', classical: 'ǰiγasu', gloss: 'fish', freq: 1, hiddenN: true },

  // ─── Substances ────────────────────────────────────────────────────────
  // алт/тос/давс: the citation forms, flipped 2026-08-06 together with the
  // machinery, exactly as `test/rulings.test.ts` said to do it. The reader
  // picked the н-less form for both алт and тос and added that `altan` is "a
  // traditional spelling, and also correct" — so this is a choice between two
  // valid forms, not a correction, and it was safe to defer until the oblique
  // forms could keep their н: алтны is still `altan-u`.
  // Two valid citation forms, ruled twice. The reader first said of алт "i
  // think both are correct, one ending in 'n' is a traditional spelling, and
  // also correct", and then on 2026-08-10 (S3): *"both are correct and both
  // should be offered — alta would be more closer modern one, so offer it at
  // higher freq."* Hence a pair of rows rather than a choice, with the modern
  // form carrying the weight. The oblique алтны is unaffected either way: it
  // reaches `altan-u` through `hiddenN` on the row below, not through this one.
  { cyrillic: 'алт', classical: 'alta', gloss: 'gold', freq: 0.8 },
  { cyrillic: 'алт', classical: 'altan', gloss: 'gold (traditional)', freq: 0.3 },
  { cyrillic: 'мөнгө', classical: 'mönggü', gloss: 'silver, money', freq: 1, hiddenN: true },
  { cyrillic: 'төмөр', classical: 'temür', gloss: 'iron', freq: 1 },
  { cyrillic: 'сүү', classical: 'sün', gloss: 'milk', freq: 1 },
  { cyrillic: 'мах', classical: 'miqan', gloss: 'meat', freq: 1 },
  { cyrillic: 'давс', classical: 'dabusu', gloss: 'salt', freq: 1 },
  { cyrillic: 'тос', classical: 'tosu', gloss: 'fat, oil', freq: 1 },
  { cyrillic: 'айраг', classical: 'airaγ', gloss: 'airag', freq: 1 },

  // ─── Colours and adjectives ────────────────────────────────────────────
  { cyrillic: 'улаан', classical: 'ulaγan', gloss: 'red', freq: 1 },
  { cyrillic: 'цагаан', classical: 'čaγan', gloss: 'white', freq: 1 },
  { cyrillic: 'хөх', classical: 'köke', gloss: 'blue', freq: 1 },
  // A minimal pair the reader supplied, 2026-07-29, and the letter is what
  // distinguishes them: ᠰᠢᠷ<MVS>ᠠ is the colour, ᠱᠠᠷ is the noise. The double-dot
  // ᠱ "is only for foreign, or traditional spelt words", so a native word
  // takes plain ᠰ. We shipped `šir-a` for the colour an hour earlier, off a
  // chachlag ruling whose two options both used the double dot — so the letter
  // rode along unasked. toli writes the colour ᠱᠢᠷ<MVS>ᠠ too, and is wrong.
  { cyrillic: 'шар', classical: 'sir-a', gloss: 'yellow', freq: 1 },
  // The reader has glossed this row twice and not identically: "a rasping
  // noise (шар шар гэж дуугарах)" on 2026-07-29, "a type of cow — don't know
  // the specifics" on 2026-08-04. Both are recorded rather than one being
  // picked, because the gloss is documentation and the *form* — which is what
  // converts — is `šar` under either reading, confirmed both times as the
  // minimal pair against the colour.
  { cyrillic: 'шар', classical: 'šar', gloss: 'a type of cow; also a rasping noise', freq: 0.3 },
  { cyrillic: 'ногоон', classical: 'noγuγan', gloss: 'green', freq: 1 },
  { cyrillic: 'сайн', classical: 'sain', gloss: 'good', freq: 1 },
  { cyrillic: 'сайхан', classical: 'saiqan', gloss: 'beautiful', freq: 1 },
  { cyrillic: 'муу', classical: 'maγu', gloss: 'bad', freq: 1 },
  { cyrillic: 'их', classical: 'yeke', gloss: 'great, much', freq: 1 },
  { cyrillic: 'бага', classical: 'baγ-a', gloss: 'small, little', freq: 1 },
  // Asked at last, 2026-08-04, and it moved on both axes: the letter (ᠱ → ᠰ)
  // and the chachlag, put as two separate questions so neither answer could be
  // read as settling the other.
  { cyrillic: 'шинэ', classical: 'sin-e', gloss: 'new', freq: 1 },
  // ᠰᠢ, and ruled directly: reader, 2026-07-31, "шүү = сиү".
  { cyrillic: 'шүү', classical: 'siü', gloss: 'emphatic particle', freq: 1 },
  { cyrillic: 'хуучин', classical: 'qaγučin', gloss: 'old', freq: 1 },
  { cyrillic: 'урт', classical: 'urtu', gloss: 'long', freq: 1 },
  { cyrillic: 'богино', classical: 'boγuni', gloss: 'short', freq: 1 },
  { cyrillic: 'өндөр', classical: 'öndür', gloss: 'tall, high', freq: 1 },
  { cyrillic: 'жижиг', classical: 'ǰiǰig', gloss: 'tiny', freq: 1 },
  { cyrillic: 'халуун', classical: 'qalaγun', gloss: 'hot', freq: 1 },
  // `küiten`, not `köiten` — "it's ү not ө" (reader, 2026-10-02).
  { cyrillic: 'хүйтэн', classical: 'küiten', gloss: 'cold', freq: 1 },
  { cyrillic: 'хурдан', classical: 'qurdun', gloss: 'fast', freq: 1 },
  { cyrillic: 'удаан', classical: 'udaγan', gloss: 'slow', freq: 1 },
  { cyrillic: 'баян', classical: 'bayan', gloss: 'rich', freq: 1 },
  { cyrillic: 'ядуу', classical: 'yadaγu', gloss: 'poor', freq: 1 },
  { cyrillic: 'энх', classical: 'engke', gloss: 'peace', freq: 1 },

  // Two reader-supplied loanwords, 2026-07-29, and they differ on purpose.
  //
  // массаж = ᠮᠠᠰᠰᠠᠵᠢ takes a final vowel because it has a *known traditional
  // spelling*; the harvest's `massaǰ` ends in a bare ǰ and is wrong.
  //
  // целлюлоз = ᠼᠧᠯᠯᠶᠦ᠋ᠯᠦᠽ does NOT, and ends bare on ᠽ. A foreign word with no
  // traditional spelling is written as the Cyrillic is, so the үл дэвсгэр rule
  // does not reach it. Do not read the first of these as licence to give the
  // other 132 bare-final loanwords a vowel — see docs/rulings.md.
  { cyrillic: 'массаж', classical: 'massaǰi', gloss: 'massage', freq: 1 },
  { cyrillic: 'целлюлоз', classical: 'cēllyü1lüz', gloss: 'cellulose', freq: 1 },
  { cyrillic: 'дайн', classical: 'dain', gloss: 'war', freq: 1 },

  // Three words a reader corrected in the 2026-08-06 release spot-check. Rows
  // rather than rules, because all three are the kind of evidence CLAUDE.md
  // says produces a row: one word each, and the shared shape between them —
  // a vowel we drop — is the тогтворгүй-н/epenthetic-vowel gap that needs
  // machinery, not a sweep. See `docs/rulings.md`.
  //
  // дизайн is a loanword and carries two FVS1s, on the ᠳ and the final ᠨ. It
  // is here only because the reader wrote the exact code points; nothing about
  // it generalises to the other loanwords, per the standing 2026-07-29 rule.
  { cyrillic: 'дизайн', classical: 'd1izain1', gloss: 'design', freq: 1 },
  // боловч was `bolubči` — the concessive converb -вч read as a stem plus a
  // verbal ending. Left as a row on purpose: the ending is productive, but one
  // word does not tell us its scope, and this one is common enough to be worth
  // fixing before that question is asked.
  { cyrillic: 'боловч', classical: 'bolbaču', gloss: 'although, but', freq: 1 },
  { cyrillic: 'хомхой', classical: 'qomuqai', gloss: 'greedy', freq: 1 },

  // гэрээ is two words. The contract is `ger-e`; гэр + the reflexive is
  // `ger-iyen` and is derived, not listed. "if it's contract, it's гэр-э, but if
  // it's home/yurt + аа/ээ → гэр-ийэн" (reader, 2026-10-02). The contract is
  // the commoner in running text — 47 sentences to 12 — so it is the row, and
  // the other stays a candidate.
  { cyrillic: 'гэрээ', classical: 'ger-e', gloss: 'contract, agreement', freq: 1 },
  // мөч "moment" is `möče`: "мөч as in time is written мөчэ" (reader,
  // 2026-10-02). The harvested row had `möči`.
  { cyrillic: 'мөч', classical: 'möče', gloss: 'moment', freq: 1 },

  // ─── Numbers ───────────────────────────────────────────────────────────
  // нэг is `nige`; `nigen` is нэгэн. Ruled 2026-10-02 — "nige is correct,
  // nigen = нэгэн" — after the row had said `nigen` since the start. It was the
  // largest single disagreement with running text: 123 of 1,834 differing
  // words in 2,000 sentences. зургаа (`ǰirγuγ-a`) and тав (`tabu`) followed the
  // same day, each asked by name. ⚠ гурав, дөрөв, мянга and the rest were NOT
  // asked and still carry their н; three bare numerals make a pattern, and a
  // pattern is a question for the reader, not a row edit.
  { cyrillic: 'нэг', classical: 'nige', gloss: 'one', freq: 1 },
  { cyrillic: 'хоёр', classical: 'qoyar', gloss: 'two', freq: 1 },
  { cyrillic: 'гурав', classical: 'γurban', gloss: 'three', freq: 1 },
  { cyrillic: 'дөрөв', classical: 'dörben', gloss: 'four', freq: 1 },
  // `tabu` — reversed 2026-10-02 ("табу"), from the `tabun` ruled on 2026-07.
  // `tabun` is таван. The н comes back under a suffix, as it does for any
  // тогтворгүй-н stem.
  { cyrillic: 'тав', classical: 'tabu', gloss: 'five', freq: 1, hiddenN: true },
  // "if it's just number six, it's ǰirγuγ-a" (reader, 2026-10-02) — bare, as
  // нэг is. The row had the н.
  { cyrillic: 'зургаа', classical: 'ǰirγuγ-a', gloss: 'six', freq: 1 },
  { cyrillic: 'долоо', classical: 'doluγ-a', gloss: 'seven', freq: 0.9 },
  // The verb долоох "to lick" is NOT the same stem with a dropped chachlag.
  // It is a different Classical word entirely: доло­ох = ᠳᠣᠯᠢᠶᠠᠬᠤ `doliyaqu`,
  // stem `doliya-` (confirmed by a bichig reader 2026-07-26). So долоо is a
  // true homograph of two unrelated forms, unlike хар/хара which do share a
  // stem — the analogy that produced the earlier wrong guess `doluγa`.
  // The imperative row below is INFERRED from the infinitive (Mongolian
  // imperative = bare stem) and is not itself confirmed; low prior so it
  // surfaces as an alternative in `analyze` without ever winning by default.
  { cyrillic: 'долоох', classical: 'doliyaqu', gloss: 'to lick (infinitive)', freq: 1 },
  { cyrillic: 'долоо', classical: 'doliya', gloss: 'lick! (imperative, unverified)', freq: 0.1 },
  { cyrillic: 'найм', classical: 'nay1ma', gloss: 'eight', freq: 1 },
  { cyrillic: 'ес', classical: 'yisün', gloss: 'nine', freq: 1 },
  { cyrillic: 'арав', classical: 'arban', gloss: 'ten', freq: 1 },
  { cyrillic: 'зуу', classical: 'ǰaγun', gloss: 'hundred', freq: 1 },
  { cyrillic: 'мянга', classical: 'mingγan', gloss: 'thousand', freq: 1 },
  { cyrillic: 'түмэн', classical: 'tümen', gloss: 'ten thousand', freq: 1 },

  // ─── Pronouns and function words ───────────────────────────────────────
  { cyrillic: 'би', classical: 'bi', gloss: 'I', freq: 1 },
  { cyrillic: 'чи', classical: 'či', gloss: 'you', freq: 1 },
  { cyrillic: 'та', classical: 'ta', gloss: 'you (polite)', freq: 1 },
  // `bide`, corrected 2026-08-06 from `bida` — the бидэн row below had been
  // saying so in prose ("`bide` is already above as the citation form") while
  // this row spelled an a, and nothing compared the two.
  //
  // The letter is what makes the тогтворгүй н regular here: `bide` + н is
  // `biden`, the reader-ruled oblique, so бидний needs no exception. Under the
  // old `bida` it came out `bidan-ü` and looked like an irregular restoration.
  { cyrillic: 'бид', classical: 'bide', gloss: 'we', freq: 1 },
  { cyrillic: 'энэ', classical: 'ene', gloss: 'this', freq: 1 },
  { cyrillic: 'тэр', classical: 'tere', gloss: 'that', freq: 1 },
  { cyrillic: 'юу', classical: 'yaγu', gloss: 'what', freq: 1 },
  { cyrillic: 'хэн', classical: 'ken', gloss: 'who', freq: 1 },
  { cyrillic: 'нь', classical: 'ni', gloss: 'his/her/its (clitic)', freq: 1 },
  { cyrillic: 'минь', classical: 'mini', gloss: 'my (clitic)', freq: 1 },
  { cyrillic: 'чинь', classical: 'čini', gloss: 'your (clitic)', freq: 1 },
  // Two different words, not two senses — the old single `yüm` row with the
  // gloss "thing, is" conflated them, and was wrong about the vowel besides.
  // Ruled by a bichig reader 2026-07-27; see docs/rulings.md.
  { cyrillic: 'юм', classical: 'yum', gloss: 'is (сул үг, particle)', freq: 0.8 },
  { cyrillic: 'юм', classical: 'yaγum-a', gloss: 'a thing', freq: 0.2 },

  // ─── Verbs, infinitive only ────────────────────────────────────────────
  // v0 has no verb morphology: only the citation `-х` form converts. Finite
  // and participial forms fall through to the guesser.
  { cyrillic: 'байх', classical: 'baiqu', gloss: 'to be', freq: 1 },
  { cyrillic: 'болох', classical: 'bolqu', gloss: 'to become', freq: 1 },
  { cyrillic: 'харах', classical: 'qaraqu', gloss: 'to look, to see', freq: 1 },
  { cyrillic: 'бичих', classical: 'bičikü', gloss: 'to write', freq: 1 },
  { cyrillic: 'явах', classical: 'yabuqu', gloss: 'to go', freq: 1 },
  { cyrillic: 'ирэх', classical: 'irekü', gloss: 'to come', freq: 1 },
  { cyrillic: 'идэх', classical: 'idekü', gloss: 'to eat', freq: 1 },
  // The stem is уу `uuγu`: "уу (uuγu) + х (qu)" (reader, 2026-10-02).
  { cyrillic: 'уух', classical: 'uuγuqu', gloss: 'to drink', freq: 1 },
  { cyrillic: 'өгөх', classical: 'ögkü', gloss: 'to give', freq: 1 },
  { cyrillic: 'авах', classical: 'abqu', gloss: 'to take', freq: 1 },
  { cyrillic: 'хийх', classical: 'kikü', gloss: 'to do, to make', freq: 1 },
  { cyrillic: 'мэдэх', classical: 'medekü', gloss: 'to know', freq: 1 },
  { cyrillic: 'хэлэх', classical: 'kelekü', gloss: 'to say', freq: 1 },

  // ─── From the first article converted end to end, 2026-07-28 ───────────
  // A bichig reader ran a real article through the converter and corrected the
  // output by hand. These are the lexical misses in it. Where the harvest
  // already held the right answer the row was simply never shipped — the
  // import keeps lemmas, and an inflected pronoun is not a lemma.
  // See docs/rulings.md.

  // өөр is TWO words. `öger-e` is "different, other"; `öber` is "self, own",
  // and it is the one that carries өөрийн, өөрсөд, өөртөө, өөрөө. The harvest
  // has them right (өөрийн `öber-ün`, өөрсдөө `öbersed-iyen`, өөртөө
  // `öber-tü-ben`) and the shipped tier had only the bare `öger-e`, so every
  // inflected form was built on the wrong stem: the reader's article said
  // ᠥᠭᠡᠷᠡᠰᠦᠳ where it should have said ᠥᠪᠡᠷᠰᠡᠳ. This was the reader's first
  // comment and the error they called the main one.
  //
  // Both readings are curated, the same way юм is, because a curated entry
  // short-circuits the harvested tier outright — leaving `öger-e` to the
  // harvest would not have made it compete, it would have removed it. Standing
  // alone, өөр is usually "different", so that keeps the higher freq; the self
  // reading wins where it should, through the inflected entries below.
  { cyrillic: 'өөр', classical: 'öger-e', gloss: 'different, other', freq: 0.6 },
  { cyrillic: 'өөр', classical: 'öber', gloss: 'self, own', freq: 0.4 },
  { cyrillic: 'өөрийн', classical: 'öber-ün', gloss: "one's own", freq: 1 },
  // The plural stem. Cyrillic drops its ө before a suffix (өөрсд-), which
  // `restoreUnstableVowel` puts back, so this one row also covers өөрсдийн,
  // өөрсдийгөө and өөрсдөө.
  { cyrillic: 'өөрсөд', classical: 'öbersed', gloss: 'selves', freq: 1 },
  // Needed as a whole form: freq ranks the two өөр readings against each
  // other for the bare word, but a case suffix does not change which reading
  // the stem lookup prefers, and өөртөө is "to oneself", never "to another".
  { cyrillic: 'өөртөө', classical: 'öber-tü-ben', gloss: 'to oneself', freq: 1 },
  // The fourth form the note above names — and the one it did not ship, so
  // өөрөө still came out `öger-e-ben`, "by another", exactly the error the rest
  // of this block fixes. Same failure and the same fix: freq gives the bare
  // word to `öger-e`, the segmenter builds the reflexive on it, and only a
  // whole-form row overrides that. `öber-iyen` is the harvest's own reading of
  // өөрөө, and it matches the shape of өөрсдөө `öbersed-iyen` above, which the
  // reader confirmed: a consonant-final stem takes `-iyen`, not `-ben`.
  { cyrillic: 'өөрөө', classical: 'öber-iyen', gloss: 'oneself', freq: 1 },

  // зүгээр is a word, not зүг + the instrumental -ээр. Attested `ǰüger` in the
  // harvest; the shipped tier had only the stem зүг and segmented it.
  { cyrillic: 'зүгээр', classical: 'ǰüger', gloss: 'just, merely; fine', freq: 1 },

  // Reader corrections that contradict the harvest. The harvest is another
  // converter's output and loses to a reader on sight.
  { cyrillic: 'цөөн', classical: 'čögegen', gloss: 'few', freq: 1 },
  // үнэт was `ünedü` here from the 2026-07 article pass. Reversed 2026-10-02:
  // shown the silver's `ünetü` beside 68 other adjectives in -т that all
  // take `t` (чөлөөт, гавьяат, нэрт), the owner judged the silver's "might
  // be better". The row stays so the word is curated rather than derived.
  { cyrillic: 'үнэт', classical: 'ünetü', gloss: 'valuable', freq: 1 },
  { cyrillic: 'цэн', classical: 'čen-e', gloss: 'value (in үнэ цэнэ)', freq: 1 },
  { cyrillic: 'биз', classical: 'biǰe', gloss: 'is it not (particle)', freq: 1 },
  { cyrillic: 'тэгээд', classical: 'tegeged', gloss: 'and then', freq: 1 },
  { cyrillic: 'хүртээмж', classical: 'kürtegemǰi', gloss: 'accessibility', freq: 1 },

  // The oblique stem of бид. Cyrillic бид/бидэн alternate; `bide` is already
  // above as the citation form and this is what the case suffixes attach to,
  // giving бидний `biden-ü`. Attested in the harvest as `biden`.
  { cyrillic: 'бидэн', classical: 'biden', gloss: 'we (oblique stem)', freq: 1 },

  // ─── The rest of the oblique pronoun stems, 2026-08-04 ─────────────────
  // Ranking the corpus guess tier by token weight put pronouns at the head of
  // it: чамайг alone occurs 1,967 times, намайг 1,904, and the oblique
  // families together carry ~10,000 of the 105,772 guess-tier tokens. They sit
  // there for a structural reason, not a coverage one — **the oblique stem is
  // suppletive**, so no amount of guessing reaches it from the citation form.
  // чи → чам-, би → над-, тэр → түүн-, энэ → үүн-. `бидэн` above was the same
  // fact found one word at a time; this is the paradigm it belongs to.
  //
  // One row per stem rather than per form, so the existing case machinery
  // builds чамд, чамаас, чамтай, чамдаа off a single entry.
  //
  // All but one are **read straight out of the harvest cache**, whose answers
  // were checked code point by code point against `toScript` rather than eyed:
  // над `nada` (надад = `nada-du`), түүн `tegün` (түүний), үүн `egün` (үүний),
  // тэдэн `teden` (тэдний), тан `tan` (таны).
  { cyrillic: 'над', classical: 'nada', gloss: 'me (oblique stem of би)', freq: 1 },
  { cyrillic: 'түүн', classical: 'tegün', gloss: 'him/her/it (oblique stem of тэр)', freq: 1 },
  { cyrillic: 'үүн', classical: 'egün', gloss: 'this (oblique stem of энэ)', freq: 1 },
  { cyrillic: 'тэдэн', classical: 'teden', gloss: 'them (oblique stem of тэд)', freq: 1 },
  { cyrillic: 'тан', classical: 'tan', gloss: 'you polite (oblique stem of та)', freq: 1 },
  // ⚠ was the one unconfirmed row in this block — **the reader answered
  // 2026-08-04** and `čima` stands, but explicitly as the *suffixation* stem:
  // чамд `čima-du`, чамаас `čima-ača`, чамдаа `čima-du-ban`, all three named by
  // the reader and all three already produced off this row.
  //
  // Standing alone the word is `čim-a`, **with the chachlag**. That is not
  // encodable today and is an `it.todo` in rulings.test.ts: `cyrillic` is the
  // only key a row has, so one row cannot spell the bare word one way and feed
  // suffixation another, and the reader's own note — it "will probably never be
  // alone in a 'you' context" — says which of the two to ship.
  //
  // Note what this makes чам: an **exception** to the 2026-07-29 chachlag
  // ruling, which the reader has twice confirmed *retains* the chachlag under a
  // case suffix (хойноосоо `qoin-a-ača-ban`, зорилгоор `ǰorilγ-a-bar`). One
  // word, lexical. Do not read it as a rule and do not touch `assemble`.
  // `čim-a`, WITH the chachlag, and it is retained under every suffix:
  // чамаас is `čim-a-ača`. Ruled 2026-08-06, overturning what shipped from the
  // 2026-08-04 ask two days earlier — the reader wrote the code points out and
  // added "for some reason the chachlag got lost… чам = čim-a".
  //
  // The earlier answer was not wrong so much as unaskable: the чамд question
  // offered `čima-du`, `čimad` and `čimada`, and **no option carried the
  // chachlag**, so the reader picked the best of three and could not have told
  // us this. An ask can only be answered inside the options it lists — the
  // same failure mode as the ГА batch, where the words offered could not
  // discriminate the rule.
  //
  // This closes the `it.todo` that said a bare-form key was needed. There is
  // no two-spelling problem: retention was the rule all along, exactly as
  // хойноосоо `qoin-a-ača-ban` and зорилгоор `ǰorilγ-a-bar` already asserted.
  { cyrillic: 'чам', classical: 'čim-a', gloss: 'you (oblique stem of чи)', freq: 1 },
  // Irregular whole forms: the genitive of би and чи is not stem + suffix.
  // Both attested in the cache written solid, with no connector.
  { cyrillic: 'миний', classical: 'minu', gloss: 'my', freq: 1 },
  { cyrillic: 'чиний', classical: 'činu', gloss: 'your', freq: 1 },
  // The accusatives are the same kind of exception, ruled 2026-08-04. The тийн
  // ялгал would give `čima-yi` / `nama-yi`, and the reader confirms those are
  // *technically* correct — but the solid one-word spelling is the traditional
  // one and is what carries over, so it is what a reader expects to see.
  //
  // Whole-form rows rather than an accusative allomorph, deliberately: the
  // accusative is regular everywhere else and must not learn this from two
  // pronouns. These are also the two heaviest tokens in the entire guess tier
  // (чамайг 1,967, намайг 1,904), and both were coming out wrong — `čama-yi`
  // and `nama-yi`, off a guessed `čama`/`nama` that is not even the stem.
  { cyrillic: 'чамайг', classical: 'čimai', gloss: 'you (accusative of чи)', freq: 1 },
  { cyrillic: 'намайг', classical: 'namai', gloss: 'me (accusative of би)', freq: 1 },

  // ─── The directive, ruled 2026-07-30 ───────────────────────────────────
  // чиглэхийн тийн ялгал. Four Cyrillic surface forms, **one** Classical
  // word: `uruγu`, whatever the stem's harmony. There is no feminine
  // `urugü`, and a converter that harmonises this the way it must harmonise
  // every other case emits a form that does not exist — which is exactly
  // what the harvest did, shipping рүү as `rüü`, a passthrough of the
  // Cyrillic rather than a conversion. Curated here because a curated row
  // short-circuits that harvested one outright.
  //
  // These rows cover the word written **separately** (монгол руу). Written
  // attached (монголруу), it is split back apart by `splitClitics` — see
  // `src/clitics.ts` for why this cannot be a suffix-table row.
  { cyrillic: 'руу', classical: 'uruγu', gloss: 'towards (directive)', freq: 1 },
  { cyrillic: 'рүү', classical: 'uruγu', gloss: 'towards (directive)', freq: 1 },
  { cyrillic: 'лүү', classical: 'uruγu', gloss: 'towards (directive)', freq: 1 },
  // ⚠ **луу is also "dragon"**, and the dragon is the lexical word: the
  // harvest carries it with 23 inflected forms in the gold set (лууг
  // `luu-yi`, луунуудаараа `luu-nuγud-iyar-iyan`). Curating the directive
  // alone at freq 1 short-circuited every one of them and cost 0.8pp on the
  // noun gold set — caught by `scripts/eval.mjs` within a minute of being
  // written, which is the entire reason that script runs before a commit.
  //
  // The postposition never inflects, so the dragon takes the bare word and
  // every suffixed form. What this still gets wrong is the directive written
  // **separately** after a noun (гэр луу): that needs the ranker to look at
  // the previous token, which `frequencyRanker` deliberately does not do.
  // Attached (гэрлүү) is fine — `splitClitics` handles it. руу/рүү/лүү have
  // no lexical homograph and are unaffected either way.
  { cyrillic: 'луу', classical: 'luu', gloss: 'dragon', freq: 0.7 },
  { cyrillic: 'луу', classical: 'uruγu', gloss: 'towards (directive)', freq: 0.3 },

  // сүүлчийн → `seγülči-yin` is attested in the aligned sentence pairs, and
  // the converter still scored it 0.0%: that pool has only ever been mined
  // for verb suffixes, never for stems. сүүл `seγül` was already harvested;
  // this is the -ч agent noun built on it.
  { cyrillic: 'сүүлч', classical: 'seγülči', gloss: 'the last one', freq: 1 },
  // Same story, found by the clitic split coming apart on it: яруу is in no
  // lexicon tier, so `я` + руу looked like a directive. Attested `iraγu`.
  { cyrillic: 'яруу', classical: 'iraγu', gloss: 'eloquent, melodious', freq: 1 },

  // авав, ruled 2026-07-30, as a whole form rather than a rule. The reader
  // confirmed `abuba` **and** `bolba` on the same day, so the linking vowel
  // before the -в past is not rule-governed: бол, төгс and сонс take none,
  // ав takes one — and ав is also the stem that takes it 14 times out of 14
  // on the perfective converb (`abuγad`). Until a batch settles whether that
  // is lexical, the ruling lives here, where it cannot generalise wrongly.
  //
  // The reader also gave the fact that governs every such vowel: "in cyrillic
  // it's ав + в, and cyrillic itself gets a linking 'а' vowel, but in
  // mongolian, it gets у because we only ever use у or ү as linking vowel."
  // So the Classical linking vowel never mirrors the Cyrillic one.
  { cyrillic: 'авав', classical: 'abuba', gloss: 'took (past)', freq: 1 },

  // The word that started the loan-letter work. кирилл takes KHA (U+183B),
  // ruled 2026-07-30 — the reader was shown the silver's ᠻирилл
  // and confirmed it. It could not be written here until mongol-bichig 0.2.2
  // gave loan letters a romanization (`kh`), because every row in this file
  // is romanized and `test/data.test.ts` converts all of them.
  //
  // Foreign, so it is exempt from the rules native words follow — see the
  // footgun about deriving anything from loanwords in CLAUDE.md. It is here
  // as a lexical fact, and it generalises to nothing.
  { cyrillic: 'кирилл', classical: 'khirill', gloss: 'Cyrillic', freq: 1 },

  // ─── Four stems the reader ruled on 2026-08-10 ─────────────────────────
  // Asked because a 52k-headword toli offered a different answer for each and
  // would have overridden the pipeline's. All four are rows, not rules: two
  // are loanwords, which generalise to nothing by standing policy, and the
  // other two are stems whose Cyrillic shape hides them.
  //
  // банан is `banana` — the foreign word spelled as the foreign word, keeping
  // the final a that Cyrillic dropped, so бананы is `banana-yin` and not the
  // `banan-u` this file used to assert. Reader: "it's a foreign word, so spelt
  // exactly banana in bichig, and mongolian one would be гадил."
  //
  // ⚠ `hiddenN: false` on both loanwords is load-bearing. Their Classical
  // forms end in a vowel, so the default in `stem.ts` would give them a
  // тогтворгүй н and write `bananan-u`, `filarmonin-du`. The н is a fact about
  // native Mongolian stems; a word spelled as the foreign word has no such
  // history to bring back.
  { cyrillic: 'банан', classical: 'banana', gloss: 'banana', freq: 1, hiddenN: false },
  // филармони keeps its non-initial o. The o/ö-only-in-the-first-syllable rule
  // is categorical for *native* words, and `filarmuni` was this project
  // applying it where it does not reach — our inference from a reader answer,
  // not the answer. Reader: "foreign word, can have o after first syllable."
  { cyrillic: 'филармони', classical: 'filarmoni', gloss: 'philharmonic', freq: 1, hiddenN: false },
  // уйл `uqil` — the harvest already had уйлаад right; this pins the stem so
  // it cannot be undercut by a bulk tier offering `uil`.
  { cyrillic: 'уйл', classical: 'uqil', gloss: 'to cry (stem)', freq: 1 },
  // ахиад is a genuine homograph and the ranking between the two readings is
  // the ruling. The common word is ахь + аад = `aqiγad`, "more, again"; the
  // rare one is `aqiyad`, "small, tiny". Curating the stem ахь makes the
  // common reading win outright instead of on a prior.
  { cyrillic: 'ахь', classical: 'aqi', gloss: 'more, again (stem)', freq: 1 },

  // ─── The toli-release spot check, ruled 2026-08-10 ─────────────────────
  // Four stems the reader gave with the release spot-check. Each was reaching
  // the guesser, and in every case the *word* was already understood — what
  // was missing was the citation row the inflected form needed.
  //
  // энг `eng` closes an `it.todo` the reader had corrected SIX times without it
  // ever becoming a row. That is the actual defect this row fixes, and the
  // reason it is worth the comment: Cyrillic нг is ambiguous between ᠩ alone
  // and ᠨ+ᠭ, `guessStem` emits both, and it is right for хонгор `qongγur` and
  // wrong here. It is lexical, so nothing but a row could ever have settled it,
  // and an `it.todo` is a note, not a fix — the word kept resurfacing in every
  // spot check because nothing changed between them.
  { cyrillic: 'энг', classical: 'eng', gloss: 'ordinary, plain (stem)', freq: 1 },
  // худалдаа — the second half of an `it.todo` from 2026-07-30, which asked for
  // exactly this and waited for the reader to confirm the Classical form.
  { cyrillic: 'худалдаа', classical: 'qudalduγ-a', gloss: 'trade, commerce', freq: 1 },
  // сэргэ `sergü`, so сэргэн is `sergün` — vowel-final, so the тогтворгүй н
  // comes back by the default rule rather than a flag. Reader: "stem сэргэ =
  // сэргү, and this would be written as сэргүн."
  { cyrillic: 'сэргэ', classical: 'sergü', gloss: 'to revive (stem)', freq: 1 },
  // токар is foreign and ends bare on the р, so the genitive is the
  // consonant-final `-un` and not the `-yin` we were giving it. Reader:
  // "токар (foreign word), and would have -un instead since it ends in r."
  // The bare final consonant is the standing loanword treatment — see целлюлоз
  // above, and the footgun in CLAUDE.md about the other 132 such stems.
  { cyrillic: 'токар', classical: 'toqar', gloss: 'lathe (turner)', freq: 1 },

  { cyrillic: 'дэнг', classical: 'd1ēng', gloss: 'lamp (stem)', freq: 1 },

  // ─── No FVS on native words, ruled 2026-07-30 ──────────────────────────
  // The harvest writes these particles with a variation selector — даа as
  // `d1a` (DA + FVS1 + A), дээ and дөө as `d1e` — and a reader caught the
  // output in the UI: "it must always be mvs + da / de (no fvs). fvs is
  // mostly used in foreign, or traditionally spelt words."
  //
  // These are as native as words get, so they take the plain letter.
  { cyrillic: 'даа', classical: 'da', gloss: 'emphatic particle', freq: 1 },
  { cyrillic: 'дээ', classical: 'de', gloss: 'emphatic particle', freq: 1 },
  { cyrillic: 'дөө', classical: 'de', gloss: 'emphatic particle', freq: 1 },

  // The same error on two words the canonical registry already answers:
  // `references/suffixes.md` lists ᠳᠠᠬᠢ daqi and ᠳᠡᠬᠢ deqi under fused
  // clitics, with no variation selector. The harvest had `d1aqi`/`d1eqi`.
  { cyrillic: 'дахь', classical: 'daqi', gloss: 'located at', freq: 1 },
  { cyrillic: 'дэх', classical: 'deqi', gloss: 'located at', freq: 1 },

  // тоосго — the one word standing against rule 2.1.2.3, and it is here as a
  // ROW rather than as a rule on purpose.
  //
  // 2.1.2.3 says a ГА never follows a д/с дэвсгэр; тоосго is тоос + го and so
  // should be `toγusq-a`, which is what the harvest and the 2015 Цэвэл both
  // write. On 2026-07-29 the reader overruled that source directly, supplying
  // ᠲᠣᠭᠤᠰᠭ<MVS>ᠠ as bichig for this exact word — not a general answer that happened
  // to cover it, and not an inference of ours.
  //
  // Until 2026-07-31 that verdict was carried by `repairDevoicedGa`, which
  // reached 224 words to satisfy one. The rulebook withdrew the rule; this row
  // keeps the evidence. A lexical exception is a data row you can delete in one
  // line if the reader says the rule governs after all — which is exactly the
  // question outstanding.
  { cyrillic: 'тоосго', classical: 'toγusγ-a', gloss: 'brick', freq: 1 },

  // ## Ruled from the 2026 rulebook appendices, 2026-07-31
  //
  // A reader went down the appendix entries where our output and the scan
  // disagreed and gave the correct form for each. These are the ones they
  // ruled on directly — nothing here is inferred from a neighbouring row, and
  // the entries they marked "no idea" are deliberately absent.
  //
  // Most of the гэ- forms were the same bug: the segmenter read a long-vowel
  // verb ending as a stem plus a *case* ending, so гэмээр became `γem-iyer`
  // (гэм + instrumental) instead of `gemer`. As the reader put it, these are
  // all the гэх root plus an ending — not nouns being declined.
  { cyrillic: 'гэгд', classical: 'gegde', gloss: 'be said (passive of гэх)', freq: 1 },
  { cyrillic: 'гэцгээ', classical: 'gečege', gloss: 'say (pluractional)', freq: 1 },
  { cyrillic: 'гэмээр', classical: 'gemer', gloss: 'wanting to say', freq: 1 },
  { cyrillic: 'гэжээ', classical: 'geǰei', gloss: 'said (unwitnessed past)', freq: 1 },
  { cyrillic: 'гэлээ', classical: 'gel-e', gloss: 'said (past)', freq: 1 },
  { cyrillic: 'гэмээ', classical: 'geme', gloss: 'saying (before нь)', freq: 1 },
  // Intensifier particles from Хавсралт 4.2, all of which we were reading as a
  // stem plus a dative or accusative that is not there.
  { cyrillic: 'бүлт', classical: 'bülte', gloss: 'intensifier (~ үсрэх)', freq: 1 },
  { cyrillic: 'пиг', classical: 'pig', gloss: 'intensifier (~ дүүрэх)', freq: 1 },
  { cyrillic: 'гуд', classical: 'gud', gloss: 'intensifier (~ татах)', freq: 1 },
  { cyrillic: 'бээр', classical: 'ber', gloss: 'particle', freq: 1 },
  // яах, "to do what" — reader: "йагахиху". We had `yaqu`, which is the wrong
  // verb entirely; the stem is яагахи-, not яа-.
  { cyrillic: 'яах', classical: 'yaγaqiqu', gloss: 'to do what', freq: 1 },
];

const buildIndex = (entries: readonly LexiconEntry[]): ReadonlyMap<string, LexiconEntry[]> => {
  const index = new Map<string, LexiconEntry[]>();
  for (const entry of entries) {
    const bucket = index.get(entry.cyrillic);
    if (bucket) bucket.push(entry);
    else index.set(entry.cyrillic, [entry]);
  }
  return index;
};

/** Cyrillic citation form → every Classical reading recorded for it. */
export const lexiconIndex: ReadonlyMap<string, readonly LexiconEntry[]> = buildIndex(lexicon);

/**
 * The same, for the generated the silver tier. Kept as a separate index rather than
 * merged so that a curated entry short-circuits the lookup — see `resolveStem`.
 */
export const harvestedIndex: ReadonlyMap<string, readonly LexiconEntry[]> =
  buildIndex(harvestedLexicon);
