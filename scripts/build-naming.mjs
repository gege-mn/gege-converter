#!/usr/bin/env node
/**
 * Build an elicitation page: what does a bichig reader CALL each shape?
 *
 * We want a *presentation-form* encoding — text as the sequence of shapes a
 * reader actually sees, not as the sequence of abstract Unicode letters. To a
 * reader, монгол is not "MA O ANG GA U LA"; it is crown, belly, tooth,
 * feminine-g, dotted-tooth, dotted-tooth, belly, final-L.
 *
 * The lower layer of that is already machine-readable, and this script derives
 * it: which letter takes which positional form falls straight out of the code
 * points. The upper layer — the *name* of each shape (титэм, шилбэ, гэдэс,
 * шүд, …) — exists in no file in this repository, in no file in
 * ~/Projects/mongol-bichig, and in nothing we vendor. The repository owner
 * reads bichig and is the only source available. This page is how we ask.
 *
 * It is therefore an ELICITATION, and the page must not put words in the
 * reader's mouth. Exactly one stroke name appears anywhere in our own files —
 * шилбэ, in `scripts/build-review.mjs`, quoting the owner — and it is the only
 * one seeded, flagged unverified. Nothing else here names a shape. The page
 * shows shapes and leaves the naming blank.
 *
 * The inventory is *measured*, not enumerated from a chart: every (letter,
 * position, variant) our own converter actually emits over real running text,
 * ordered by how much text it carries. A reader who answers twenty cards and
 * stops has answered the twenty that matter most.
 *
 * Two things the raw code points cannot carry, and how each is handled:
 *
 *   q/k and γ/g are one letter each (U+182C, U+182D) under two romanizations,
 *   so keying on the code point collapses them automatically — one card, both
 *   spellings listed. Asking twice would waste an answer.
 *
 *   The masculine/feminine forms of those same two letters are chosen by vowel
 *   harmony, not by the bytes, so the card is split by the harmony of the word
 *   it was found in and the feminine one is rendered with FVS2, which
 *   `references/variation-sequences.md` records as selecting the feminine G
 *   form in initial and medial position. Splitting a question is safe; merging
 *   two shapes into one question silently loses an answer.
 *
 * Everything else that shaping decides from context (the dotted vs undotted
 * tooth above all) is *asked about* in section 1 rather than guessed at here,
 * because a card whose glyph might show the other form is worse than no card.
 *
 *   node scripts/build-naming.mjs [out.html] [--n 3000]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const FLAGS_TAKING_A_VALUE = new Set(['--n']);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
/** First bare argument — one that is neither a flag nor a flag's value. */
const positional = args.find(
  (a, i) => !a.startsWith('--') && !FLAGS_TAKING_A_VALUE.has(args[i - 1] ?? ''),
);
const OUT = positional ?? '.tmp/naming.html';
const CORPUS_LINES = Number(flag('--n', 3000));

const DIST = resolve(ROOT, 'dist/index.js');
if (!existsSync(DIST)) {
  console.error('dist/ is missing — run `pnpm build` first.');
  process.exit(1);
}
const { analyze, lexicon } = await import(pathToFileURL(DIST).href);
const { toScript } = await import(pathToFileURL(resolve(ROOT, 'dist/romanize.js')).href);

// ------------------------------------------------------- Mongolian block bits

/** Never a literal: invisibles get mistranscribed by editors and clipboards. */
const ZWJ = '\u200D';
const MVS_CP = 0x180e;
const NNBSP_CP = 0x202f;
const NIRUGU_CP = 0x180a;
const FVS2 = '\u180C';
/** Free variation selector code point → its number. FVS4 is U+180F, not U+180E. */
const FVS = new Map([
  [0x180b, 1],
  [0x180c, 2],
  [0x180d, 3],
  [0x180f, 4],
]);
const FVS_CHAR = new Map([...FVS].map(([c, n]) => [n, String.fromCodePoint(c)]));

const isLetter = (c) => c >= 0x1820 && c <= 0x18aa;
/** Letter gender classes, UTN #57 Table 5 (via references/encoding-model.md). */
const BACK_VOWELS = new Set([0x1820, 0x1823, 0x1824]);
const FRONT_VOWELS = new Set([0x1821, 0x1825, 0x1826, 0x1827]);

const QA = 0x182c;
const GA = 0x182d;

/**
 * Letter labels. The romanizations are the ones `romanize.ts` maps to each code
 * point; the Cyrillic column is the everyday correspondence a reader would
 * expect, and is a *label aid only* — it says nothing about shapes.
 */
const LETTERS = new Map([
  [0x1820, { name: 'A', roman: ['a'], cyrillic: 'а' }],
  [0x1821, { name: 'E', roman: ['e'], cyrillic: 'э, е' }],
  [0x1822, { name: 'I', roman: ['i'], cyrillic: 'и, ий' }],
  [0x1823, { name: 'O', roman: ['o'], cyrillic: 'о' }],
  [0x1824, { name: 'U', roman: ['u'], cyrillic: 'у' }],
  [0x1825, { name: 'OE', roman: ['ö'], cyrillic: 'ө' }],
  [0x1826, { name: 'UE', roman: ['ü'], cyrillic: 'ү' }],
  [0x1827, { name: 'EE', roman: ['ē'], cyrillic: '— (loans)' }],
  [0x1828, { name: 'NA', roman: ['n'], cyrillic: 'н' }],
  [0x1829, { name: 'ANG', roman: ['ng'], cyrillic: 'н (нг)' }],
  [0x182a, { name: 'BA', roman: ['b'], cyrillic: 'б' }],
  [0x182b, { name: 'PA', roman: ['p'], cyrillic: 'п' }],
  [QA, { name: 'QA', roman: ['q', 'k'], cyrillic: 'х, к' }],
  [GA, { name: 'GA', roman: ['γ', 'g'], cyrillic: 'г' }],
  [0x182e, { name: 'MA', roman: ['m'], cyrillic: 'м' }],
  [0x182f, { name: 'LA', roman: ['l'], cyrillic: 'л' }],
  [0x1830, { name: 'SA', roman: ['s'], cyrillic: 'с' }],
  [0x1831, { name: 'SHA', roman: ['š', 'sh'], cyrillic: 'ш' }],
  [0x1832, { name: 'TA', roman: ['t'], cyrillic: 'т' }],
  [0x1833, { name: 'DA', roman: ['d'], cyrillic: 'д' }],
  [0x1834, { name: 'CHA', roman: ['č', 'ch'], cyrillic: 'ч' }],
  [0x1835, { name: 'JA', roman: ['ǰ', 'j'], cyrillic: 'ж' }],
  [0x1836, { name: 'YA', roman: ['y'], cyrillic: 'й' }],
  [0x1837, { name: 'RA', roman: ['r'], cyrillic: 'р' }],
  [0x1838, { name: 'WA', roman: ['w', 'v'], cyrillic: 'в' }],
  [0x1839, { name: 'FA', roman: ['f'], cyrillic: 'ф' }],
  [0x183c, { name: 'TSA', roman: ['c'], cyrillic: 'ц' }],
  [0x183d, { name: 'ZA', roman: ['z'], cyrillic: 'з' }],
]);

const POSITIONS = {
  isol: 'isolated',
  init: 'initial',
  medi: 'medial',
  fina: 'final',
};

const uplus = (c) => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
const cps = (s) => [...s].map((c) => uplus(c.codePointAt(0))).join(' ');
const ordinal = (n) => {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${tail}`;
};

// ------------------------------------------------------------------- the scan

/**
 * Every shape slot the converter emits, keyed so that two spellings of one
 * letter land on one card and two genuinely different shapes never do.
 *
 * `harmony` is set only for QA and GA in initial/medial position, where the
 * masculine/feminine allographs are picked by the surrounding vowels rather
 * than by the code points — see the header.
 */
const slots = new Map();

const scriptHarmony = (letterCps) => {
  for (const c of letterCps) {
    if (BACK_VOWELS.has(c)) return 'masculine';
    if (FRONT_VOWELS.has(c)) return 'feminine';
  }
  // All-neutral words behave as feminine — the same fallback `harmonyOf` uses.
  return 'feminine';
};

/** Record one converted word: split it into joining runs and read off each slot. */
function scan(script, cyrillic) {
  const chars = [...script];
  const codes = chars.map((c) => c.codePointAt(0));

  /** A joining run is letters + FVS + nirugu; anything else ends it. */
  const runs = [];
  let current = [];
  let afterConnector = false;
  for (let i = 0; i < codes.length; i += 1) {
    const c = codes[i];
    if (isLetter(c) || FVS.has(c) || c === NIRUGU_CP) {
      current.push(i);
      continue;
    }
    runs.push({ indices: current, afterConnector });
    current = [];
    // MVS and NNBSP still connect visually, but the letter after one takes a
    // word-start form, and a lone a/e after one is the chachlag. That context
    // is worth its own card, so carry it.
    afterConnector = c === MVS_CP || c === NNBSP_CP;
  }
  runs.push({ indices: current, afterConnector });

  // The example word is shown WHOLE, connector and all, so "the nth letter"
  // must be counted over the whole word too. Counting it inside the joining
  // run instead pointed at the wrong letter of every word carrying a suffix.
  const wordLetters = codes.map((c, i) => (isLetter(c) ? i : -1)).filter((i) => i >= 0);
  const nthInWord = new Map(wordLetters.map((i, n) => [i, n + 1]));

  for (const run of runs) {
    const letterIdx = run.indices.filter((i) => isLetter(codes[i]));
    if (letterIdx.length === 0) continue;
    const runHarmony = scriptHarmony(letterIdx.map((i) => codes[i]));
    letterIdx.forEach((i, k) => {
      const cp = codes[i];
      if (!LETTERS.has(cp)) return;
      const fvs = FVS.get(codes[i + 1]) ?? 0;
      const hasPrev = k > 0;
      const hasNext = k < letterIdx.length - 1;
      const position = hasPrev ? (hasNext ? 'medi' : 'fina') : hasNext ? 'init' : 'isol';
      const connector = run.afterConnector && k === 0;
      const splitByHarmony =
        (cp === QA || cp === GA) && fvs === 0 && (position === 'init' || position === 'medi');
      const harmony = splitByHarmony ? runHarmony : '';
      const key = [cp, position, fvs, connector ? 'mvs' : '', harmony].join('|');

      let slot = slots.get(key);
      if (slot === undefined) {
        slot = { key, cp, position, fvs, connector, harmony, count: 0, example: null };
        slots.set(key, slot);
      }
      slot.count += 1;
      // Prefer a short example: pointing at "the 3rd of 4 letters" is easier to
      // follow than the 9th of 12.
      const candidate = {
        cyrillic,
        script,
        index: nthInWord.get(i) ?? k + 1,
        total: wordLetters.length,
      };
      if (slot.example === null || candidate.total < slot.example.total) slot.example = candidate;
    });
  }
}

let sampledWords = 0;
let source = '';
const corpus = resolve(ROOT, '.tmp/harvest-sentences.jsonl');
if (existsSync(corpus)) {
  source = `${CORPUS_LINES} sentences of real running text, converted by us`;
  for (const line of readFileSync(corpus, 'utf8').split('\n').slice(0, CORPUS_LINES)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const text = row.cyrillic ?? row.text ?? '';
    if (!text) continue;
    for (const analyzed of analyze(text)) {
      const best = analyzed.candidates[0];
      if (best === undefined) continue;
      sampledWords += 1;
      scan(best.script, analyzed.token.text);
    }
  }
} else {
  // A clean checkout has no harvest. The curated lexicon is smaller and its
  // frequencies are type-frequencies rather than token-frequencies, so the
  // ordering is rougher — but the page still builds, and says which it used.
  source = 'the curated lexicon (no harvest present — ordering is by word type, not by token)';
  for (const entry of lexicon) {
    let script;
    try {
      script = toScript(entry.classical);
    } catch {
      continue;
    }
    sampledWords += 1;
    scan(script, entry.cyrillic);
  }
}

// ------------------------------------------------------------------ ordering

/** Letters ordered by how much text they carry; their forms likewise inside. */
const byLetter = new Map();
for (const slot of slots.values()) {
  const bucket = byLetter.get(slot.cp) ?? { cp: slot.cp, count: 0, forms: [] };
  bucket.count += slot.count;
  bucket.forms.push(slot);
  byLetter.set(slot.cp, bucket);
}
const letterOrder = [...byLetter.values()].sort((a, b) => b.count - a.count);
for (const bucket of letterOrder) bucket.forms.sort((a, b) => b.count - a.count);

const cards = [];
for (const bucket of letterOrder) for (const form of bucket.forms) cards.push(form);
const totalOccurrences = cards.reduce((sum, c) => sum + c.count, 0);

/**
 * Bands of roughly twenty, broken only between letters so a letter's forms stay
 * together. The banding is the whole point of the ordering: it tells a reader
 * where it is reasonable to stop.
 */
const BAND_SIZE = 20;
const bands = [];
let band = null;
for (const bucket of letterOrder) {
  if (band === null || band.cards.length >= BAND_SIZE) {
    band = { cards: [], from: 0, to: 0 };
    bands.push(band);
  }
  for (const form of bucket.forms) band.cards.push(form);
}
let rank = 0;
for (const b of bands) {
  b.from = rank + 1;
  rank += b.cards.length;
  b.to = rank;
}

// -------------------------------------------------------------- what we render

/**
 * The form on its own, in the right joining position.
 *
 * ZWJ is the documented way to pin a cursive position in isolation (core spec
 * / references/encoding-model.md: `<1820, 200D>` is the initial form). It
 * cannot express the connector contexts, so those cards fall back to showing
 * their example word whole — a real rendering always beats a scaffolded one
 * that might be lying.
 */
function isolatedForm(slot) {
  if (slot.connector) return null;
  const letter = String.fromCodePoint(slot.cp);
  let selector = slot.fvs === 0 ? '' : (FVS_CHAR.get(slot.fvs) ?? '');
  // references/variation-sequences.md: QA/GA + FVS2 selects the feminine G form
  // in initial and medial position. That is the only way to show the feminine
  // allograph without dragging a vowel into the picture.
  if (slot.harmony === 'feminine' && selector === '') selector = FVS2;
  const body = letter + selector;
  if (slot.position === 'isol') return body;
  if (slot.position === 'init') return body + ZWJ;
  if (slot.position === 'fina') return ZWJ + body;
  return ZWJ + body + ZWJ;
}

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const scriptBox = (label, script, caption, big) =>
  script === undefined || script === null || script === ''
    ? ''
    : `<figure class="sbox${big ? ' big' : ''}"><div class="mn">${esc(script)}</div>
       <figcaption><strong>${esc(label)}</strong>${caption ? `<br>${esc(caption)}` : ''}
       <code>${esc(cps(script))}</code></figcaption></figure>`;

/** The one-line description that also becomes the answer-block label. */
function describe(slot) {
  const letter = LETTERS.get(slot.cp);
  const bits = [
    `${uplus(slot.cp)} ${letter.name}`,
    POSITIONS[slot.position],
    letter.roman.join('/'),
    `Cyr ${letter.cyrillic}`,
  ];
  if (slot.fvs !== 0) bits.push(`FVS${slot.fvs}`);
  if (slot.harmony !== '') bits.push(slot.harmony);
  if (slot.connector) bits.push('after connector');
  return bits.join(' · ');
}

function cardBlock(slot, id, index) {
  const letter = LETTERS.get(slot.cp);
  const form = isolatedForm(slot);
  const example = slot.example;
  const share = ((slot.count / totalOccurrences) * 100).toFixed(2);

  const notes = [];
  if (slot.harmony === 'feminine') {
    notes.push(
      'The feminine allograph. Rendered with FVS2, which our reference records as ' +
        'selecting this form in initial and medial position — if the glyph below is not ' +
        'the feminine one, say so, that is a data bug worth knowing about.',
    );
  }
  if (slot.harmony === 'masculine') {
    notes.push('The masculine allograph — same code point, shape picked by vowel harmony.');
  }
  if (slot.fvs !== 0) {
    notes.push(`Variant form, selected explicitly by FVS${slot.fvs}.`);
  }
  if (slot.connector) {
    notes.push(
      'This one sits straight after the suffix connector (MVS), where the shape is not ' +
        'derivable from the letter alone — so there is no isolated rendering, only the ' +
        'real word.',
    );
  }
  if (letter.roman.length > 1) {
    notes.push(
      `${letter.roman.join(' and ')} are two spellings of one letter (${uplus(slot.cp)}), so ` +
        'this is asked once, not twice.',
    );
  }

  const exampleCaption =
    example === null
      ? ''
      : `${example.cyrillic} — ${ordinal(example.index)} of ${example.total} letters`;

  return `<div class="card">
  <p class="head"><span class="qid">${id}</span>
     <span class="cy">${esc(letter.name)}</span>
     <span class="pos">${esc(POSITIONS[slot.position])}</span>
     <code>${esc(uplus(slot.cp))}</code>
     <span class="dim">romanized <strong>${esc(letter.roman.join(' / '))}</strong> ·
     Cyrillic <strong>${esc(letter.cyrillic)}</strong></span></p>
  <p class="probe">#${index} by frequency · ${slot.count.toLocaleString('en-US')} occurrences
     (${share}% of all shapes seen)</p>
  ${notes.map((n) => `<p class="note-line">${esc(n)}</p>`).join('')}
  <div class="scripts">
    ${scriptBox('the form', form, 'on its own', true)}
    ${scriptBox('in a word', example?.script, exampleCaption, form === null)}
  </div>
  <label class="ask">Shapes it is built from, in order:
    <input class="ans" data-for="${id}" placeholder="one shape per step, separated by + — or just describe it in words">
  </label>
</div>`;
}

// ------------------------------------------------------------------- section 1

/**
 * The only stroke name recorded anywhere in our own files. Everything else on
 * this page is a shape with a blank next to it, deliberately.
 */
const RECORDED_NAMES = [
  {
    name: 'шилбэ',
    where: 'scripts/build-review.mjs',
    quote: 'this is the «two shilbe» you asked for',
    about: 'said of medial V+i, where the YA glide was removed',
  },
];

/**
 * The owner's own decomposition of монгол, quoted as given. These are English
 * working glosses, not Mongolian names — which is exactly the gap this page
 * exists to close, so each gets a blank.
 */
const MONGOL_GLOSSES = ['crown', 'belly', 'tooth', 'feminine-g', 'dotted-tooth', 'final-L'];
const MONGOL_SEQUENCE =
  'crown, belly, tooth, feminine-g, dotted-tooth, dotted-tooth, belly, final-L';

let mongolScript = '';
let mongolClassical = '';
{
  const [analyzed] = analyze('монгол');
  const best = analyzed?.candidates[0];
  if (best !== undefined) {
    mongolScript = best.script;
    mongolClassical = best.classical;
  }
}

const seededInventory = RECORDED_NAMES.map(
  (r) =>
    `${r.name}\t# found in ${r.where}, quoting you: "${r.quote}" (${r.about}). ` +
    'UNVERIFIED — correct or delete it.',
).join('\n');

const glossRows = MONGOL_GLOSSES.map(
  (g, i) => `<tr><td class="gloss">${esc(g)}</td>
    <td><input class="ans" data-for="G${i + 1}" placeholder="what do you call this?"></td></tr>`,
).join('\n');

// ------------------------------------------------------------------- render

const ids = [];
const labels = {};
let index = 0;
const bandHtml = bands
  .map((b) => {
    const blocks = b.cards.map((slot) => {
      index += 1;
      const id = `S${String(index).padStart(3, '0')}`;
      ids.push(id);
      labels[id] = describe(slot);
      return cardBlock(slot, id, index);
    });
    const covered = b.cards.reduce((sum, c) => sum + c.count, 0);
    return `<h3 class="band">Shapes ${b.from}–${b.to}
      <span class="dim">${((covered / totalOccurrences) * 100).toFixed(1)}% of all shapes in the
      sample${b.from === 1 ? ' — if you answer nothing else, answer these' : ''}</span></h3>
    ${blocks.join('')}`;
  })
  .join('');

for (const id of ['INVENTORY', 'MONGOL_SEQ', 'CONTEXT', 'IDENTICAL']) ids.push(id);
for (let i = 1; i <= MONGOL_GLOSSES.length; i += 1) {
  ids.push(`G${i}`);
  labels[`G${i}`] = `gloss "${MONGOL_GLOSSES[i - 1]}"`;
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Name the shapes</title>
<style>
 :root{--bg:#0d1017;--panel:#161a24;--fg:#e8ecf4;--dim:#94a0b8;--accent:#7aa2f7;
   --rule:#252b38;--ok:#7bd88f;--bad:#f7768e;--warn:#f0d68a}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--fg);padding:40px 22px 150px;
   font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
   max-width:1040px;margin-inline:auto}
 h1{font-size:1.7rem;margin:0 0 .2em}
 h2{font-size:1.15rem;margin:2.4em 0 .3em;border-bottom:1px solid var(--rule);padding-bottom:.3em}
 h3.band{font-size:.95rem;margin:2.2em 0 .8em;color:var(--accent);font-weight:700;
   letter-spacing:.02em;border-top:1px solid var(--rule);padding-top:1em}
 h3.band .dim{font-weight:400;letter-spacing:0}
 .sub{color:var(--dim);margin:0 0 1.6em;font-size:.94rem}
 .dim{color:var(--dim)}
 .card{background:var(--panel);border-radius:11px;padding:20px 22px;margin:14px 0}
 .card .head{margin:0 0 .2em;display:flex;flex-wrap:wrap;gap:10px;align-items:baseline}
 .qid{background:#243049;color:#9dbcf5;border-radius:6px;padding:2px 9px;
   font-size:.75rem;font-weight:700;letter-spacing:.05em}
 code{background:#0b0d12;padding:1px 6px;border-radius:4px;font-size:.85em;color:#b9c6e0}
 .cy{color:var(--warn);font-weight:600;font-size:1.1rem}
 .pos{color:var(--fg);font-size:.95rem;background:#1e2331;border-radius:6px;padding:1px 9px}
 .probe{color:var(--dim);font-size:.86rem;margin:.3em 0 .5em}
 .note-line{color:var(--dim);font-size:.85rem;margin:.25em 0;border-left:2px solid var(--rule);
   padding-left:10px}
 .scripts{display:flex;flex-wrap:wrap;gap:16px;margin:1.1em 0 1.1em}
 .sbox{margin:0;background:#0c0e14;border:1px solid var(--rule);border-radius:9px;
   padding:16px 14px;display:flex;flex-direction:column;align-items:center;gap:12px;min-width:150px}
 .sbox.big{border-color:#33405c}
 .mn{writing-mode:vertical-lr;text-orientation:mixed;
   font-family:"Noto Sans Mongolian","Mongolian Baiti","MN Baiti","Menksoft Qagan",serif;
   font-size:2.1rem;line-height:1.5;min-height:130px;color:#fff}
 .sbox.big .mn{font-size:3.4rem;min-height:170px}
 .sbox figcaption{font-size:.76rem;color:var(--dim);text-align:center;max-width:190px;
   line-height:1.45}
 .sbox figcaption code{font-size:.66rem;display:inline-block;margin-top:5px;word-break:break-all}
 label.ask{display:block;color:var(--dim);font-size:.85rem}
 .ans{width:100%;background:#0b0d12;border:1px solid var(--rule);border-radius:6px;
   color:var(--fg);padding:9px 11px;font-size:.95rem;font-family:inherit;margin-top:5px}
 .ans:focus{outline:none;border-color:var(--accent)}
 textarea.free{width:100%;background:#0b0d12;border:1px solid var(--rule);border-radius:7px;
   color:var(--fg);padding:11px 13px;font-size:.92rem;font-family:ui-monospace,SFMono-Regular,
   Menlo,monospace;line-height:1.6;min-height:150px;resize:vertical}
 textarea.free:focus{outline:none;border-color:var(--accent)}
 .flag{display:inline-block;background:#3a2f16;color:var(--warn);border-radius:6px;
   padding:2px 9px;font-size:.72rem;font-weight:700;letter-spacing:.04em}
 table.glosses{border-collapse:collapse;width:100%;margin:1em 0}
 table.glosses td{border-bottom:1px solid var(--rule);padding:7px 10px 7px 0;vertical-align:middle}
 table.glosses td.gloss{width:170px;color:var(--warn);font-weight:600;font-size:.95rem}
 .anchor{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;margin:1.2em 0}
 #out{position:fixed;left:0;right:0;bottom:0;background:#0a0c11;border-top:2px solid var(--accent);
   padding:12px 20px;box-shadow:0 -8px 28px rgba(0,0,0,.6)}
 #out .row{display:flex;gap:12px;align-items:center;max-width:1040px;margin:0 auto}
 #answers{flex:1;background:#0f1218;border:1px solid var(--rule);border-radius:7px;color:var(--fg);
   font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem;padding:9px 11px;
   height:80px;resize:vertical;white-space:pre;overflow:auto}
 button{background:var(--accent);color:#0a1020;border:0;border-radius:7px;padding:11px 18px;
   font-weight:700;cursor:pointer;font-size:.9rem;white-space:nowrap;font-family:inherit}
 button:hover{filter:brightness(1.1)}
 .count{color:var(--dim);font-size:.8rem;white-space:nowrap}
</style></head><body>

<h1>Name the shapes</h1>
<p class="sub">I want to write bichig down as the sequence of shapes you actually see, not as
abstract Unicode letters. The machine already knows which letter takes which form where — what it
has no idea about is what any of them are <em>called</em>. That part exists only in your head, and
in no file I can read. So: section 1 asks for your vocabulary, section 2 shows you every shape our
converter emits and asks you to spell each one out in that vocabulary.</p>
<p class="sub"><strong>Nothing here is pre-filled with a name I made up.</strong> Exactly one name
appears anywhere in this repository and it is seeded below, flagged. Everywhere else the blank is
blank on purpose — a wrong suggestion from me would be worse than an empty box.</p>
<p class="sub">Fill in what you can, skip what you cannot, then hit <strong>Copy</strong> at the
bottom and paste the block back to me. Partial is fine; the order is chosen so that stopping early
still leaves us with the most useful answers.</p>

<h2>1 · The vocabulary</h2>
<p class="sub">Every stroke name you use, one per line. A short gloss after a tab or a
<code>#</code> helps but is not needed. This is the list everything in section 2 gets spelled
in — so it comes first.</p>
<p><span class="flag">FOUND IN OUR DOCS — CORRECT ME IF WRONG</span></p>
<textarea class="free" id="INVENTORY" spellcheck="false">${esc(seededInventory)}
</textarea>

<h3 class="band">The anchor example</h3>
<p class="sub">You described монгол as: <strong>${esc(MONGOL_SEQUENCE)}</strong>. Those are English
working words I wrote down from you, not names you gave in Mongolian — so here is what we currently
emit for монгол, and a blank for the Mongolian name of each gloss. If my transcription of the
sequence is wrong, fix it in the box.</p>
<div class="anchor">
  ${scriptBox('монгол', mongolScript, mongolClassical, true)}
  <div style="flex:1;min-width:280px">
    <label class="ask">The sequence, corrected:
      <input class="ans" data-for="MONGOL_SEQ" value="${esc(MONGOL_SEQUENCE)}">
    </label>
    <table class="glosses">${glossRows}</table>
  </div>
</div>

<h3 class="band">Two things the bytes cannot tell me</h3>
<p class="sub">Some shapes are chosen by what surrounds a letter rather than by the letter itself —
the dotted versus undotted tooth is the one I am surest about and least able to derive. I have
deliberately <em>not</em> guessed at these in section 2, because a card showing the wrong glyph is
worse than no card. Which letters have more than one shape depending on context, what decides it,
and what is each one called?</p>
<textarea class="free" id="CONTEXT" spellcheck="false" placeholder="e.g. «letter X is shape A before a vowel and shape B otherwise»"></textarea>
<p class="sub" style="margin-top:1.4em">And the reverse: where two different letters end up as the
<em>same</em> shape, I want to know, because that is the whole point of a presentation-form
encoding. Section 2 asks about each letter separately, so if two cards deserve the same answer,
give them the same answer — and list the groups here so I do not miss it.</p>
<textarea class="free" id="IDENTICAL" spellcheck="false" placeholder="e.g. «S004, S011 and S023 are all the same shape»"></textarea>

<h2>2 · The shapes</h2>
<p class="sub">${cards.length} shapes, ordered by how much real text each one carries — commonest
letter first, and inside a letter its commonest form first. The big rendering is the form on its
own; the small one is a real word that contains it, with the position counted out, in case the
isolated rendering looks off in your font. Code points are under both.</p>
<p class="sub">Write the shapes in order, separated however you like. If a form <em>is</em> a single
named shape, just write that one name.</p>

${bandHtml}

<div id="out"><div class="row">
  <textarea id="answers" readonly placeholder="Answer something above…"></textarea>
  <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
    <button id="copy">Copy</button>
    <span class="count" id="count">0 answered</span>
  </div>
</div></div>

<script>
const IDS = ${JSON.stringify(ids)};
const LABEL = ${JSON.stringify(labels)};
const SEEDED = ${JSON.stringify(seededInventory)};
const MONGOL_DEFAULT = ${JSON.stringify(MONGOL_SEQUENCE)};

/**
 * Shape ids are exactly S plus three digits. Testing the first letter alone
 * swept the free-text box for same-shape groups into the decomposition list
 * under a missing label, because it too began with an S — hence the length
 * check, and hence that box is now called IDENTICAL rather than SAMESHAPE.
 */
function isShapeId(id) { return id.charAt(0) === 'S' && id.length === 4; }

function valueOf(id) {
  const free = document.getElementById(id);
  if (free) return free.value.trim();
  const input = document.querySelector('.ans[data-for="' + id + '"]');
  return input ? input.value.trim() : '';
}

function build() {
  const lines = [];
  let answered = 0;
  let shapesAnswered = 0;

  const inventory = valueOf('INVENTORY');
  if (inventory && inventory !== SEEDED.trim()) {
    lines.push('## INVENTORY — every stroke name');
    lines.push(inventory);
    lines.push('');
    answered++;
  }

  const seq = valueOf('MONGOL_SEQ');
  const glossLines = [];
  for (const id of IDS) {
    if (id.charAt(0) !== 'G' || id.length > 3) continue;
    const v = valueOf(id);
    if (v) glossLines.push(id + ' ' + LABEL[id] + ': ' + v);
  }
  if ((seq && seq !== MONGOL_DEFAULT) || glossLines.length) {
    lines.push('## МОНГОЛ — the anchor example');
    if (seq) lines.push('MONGOL_SEQ (sequence, as corrected): ' + seq);
    for (const l of glossLines) lines.push(l);
    lines.push('');
    answered += glossLines.length + (seq && seq !== MONGOL_DEFAULT ? 1 : 0);
  }

  const context = valueOf('CONTEXT');
  if (context) {
    lines.push('## CONTEXT-DRIVEN SHAPES (chosen by surroundings, not by the letter)');
    lines.push(context);
    lines.push('');
    answered++;
  }

  const same = valueOf('IDENTICAL');
  if (same) {
    lines.push('## SHAPES THAT ARE THE SAME AS EACH OTHER');
    lines.push(same);
    lines.push('');
    answered++;
  }

  const shapeLines = [];
  for (const id of IDS) {
    if (!isShapeId(id)) continue;
    const v = valueOf(id);
    if (!v) continue;
    shapesAnswered++;
    // Each line carries its own identity — id, letter, code point, position,
    // romanization, Cyrillic — so the block stays unambiguous once it is
    // pasted into a chat message with no page around it.
    shapeLines.push(id + '  ' + LABEL[id] + '  =  ' + v);
  }
  if (shapeLines.length) {
    lines.push('## DECOMPOSITIONS (id · code point · letter · position · romanization · Cyrillic)');
    for (const l of shapeLines) lines.push(l);
  }
  answered += shapesAnswered;

  const total = IDS.filter(isShapeId).length;
  const ta = document.getElementById('answers');
  ta.value = lines.length ? 'SHAPE NAMES — gege-converter\\n\\n' + lines.join('\\n') : '';
  document.getElementById('count').textContent =
    shapesAnswered + ' of ' + total + ' shapes' + (answered > shapesAnswered ? ' + notes' : '');
}

document.addEventListener('input', build);
document.addEventListener('change', build);
document.getElementById('copy').addEventListener('click', async () => {
  const ta = document.getElementById('answers');
  if (!ta.value) return;
  try { await navigator.clipboard.writeText(ta.value); }
  catch {
    ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy');
    ta.setAttribute('readonly', '');
  }
  const b = document.getElementById('copy');
  b.textContent = 'Copied';
  setTimeout(() => { b.textContent = 'Copy'; }, 1400);
});
build();
</script>
</body></html>
`;

writeFileSync(resolve(ROOT, OUT), html);
console.log(`wrote ${OUT}`);
console.log(`  shapes asked about : ${cards.length}`);
console.log(`  distinct letters   : ${letterOrder.length}`);
console.log(`  bands              : ${bands.length}`);
console.log(`  sampled from       : ${source}`);
console.log(`  words scanned      : ${sampledWords.toLocaleString('en-US')}`);
console.log(`  shape occurrences  : ${totalOccurrences.toLocaleString('en-US')}`);
console.log(`  names pre-filled   : ${RECORDED_NAMES.length} (all flagged unverified)`);
