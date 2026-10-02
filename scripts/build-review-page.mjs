#!/usr/bin/env node
/**
 * Build an interactive review page: every open question that needs a human
 * ruling, plus a random-pick spot check of ten sophisticated words.
 *
 * Bichig is rendered with a real Mongolian font in vertical writing mode,
 * because the terminal shows wrong glyphs and no vertical layout — a reader
 * cannot judge correctness from terminal output.
 *
 * Selections are collected into one copy-pasteable answer block at the bottom.
 *
 *   node scripts/build-review-page.mjs [out.html]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] ?? '.tmp/review.html';

const { analyze } = await import(pathToFileURL(resolve(ROOT, 'dist/index.js')).href);

async function loadLinter() {
  for (const spec of [
    process.env.GEGE_LINTER,
    '@gege-mn/gege-linter',
    resolve(ROOT, '../gege-linter/dist/index.js'),
  ].filter(Boolean)) {
    const href = /^[./]|^[A-Za-z]:\\/.test(spec) ? pathToFileURL(resolve(spec)).href : spec;
    try {
      const mod = await import(href);
      if (typeof mod.lint === 'function') return mod;
    } catch {
      // next
    }
  }
  return null;
}
const linter = await loadLinter();

// ------------------------------------------------------------ harvested data

const silverAnswers = new Map();
// Later files win, so a targeted spot harvest overrides the bulk one.
for (const file of ['.tmp/harvest-harvest.jsonl', '.tmp/spot.jsonl']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      silverAnswers.set(r.cyrillic, r);
    } catch {
      // ignore a torn line
    }
  }
}

/**
 * Ten deliberately chosen words. Not sampled at random from the corpus: each
 * one stresses a specific thing that is currently unverified, so a wrong
 * answer is diagnostic rather than just wrong.
 */
const SPOT = [
  ['соёлжилт', 'Cyrillic ё — the guesser maps it to "yo" without applying the o/ö rule'],
  ['төлөөлөгч', 'three ө — the feminine half of the o/ö rule, agent suffix -гч'],
  ['боловсрол', 'three о — the masculine half of the same rule'],
  ['хөгжлийн', 'ө plus an ий genitive, and a stem that loses a vowel (хөгжил→хөгжл)'],
  ['байгууллага', 'long stem, ай diphthong, doubled уу'],
  ['шинжилгээ', 'ээ ending — does it take a chachlag?'],
  ['уламжлалт', 'the -т adjectival suffix: attached or connector-joined?'],
  ['хариуцлага', 'иу vowel sequence, which our romanizer has no rule for'],
  ['зохиогчийн', 'genitive after the agent suffix -гч'],
  ['оролцоо', 'non-initial о twice, plus an оо ending'],
];

const spotRows = SPOT.map(([word, probes]) => {
  let ours = null;
  let alts = [];
  try {
    const res = analyze(word);
    const cands = res[0]?.candidates ?? [];
    ours = cands[0] ?? null;
    alts = cands.slice(1, 3);
  } catch {
    ours = null;
  }
  const k = silverAnswers.get(word);
  return {
    word,
    probes,
    ours: ours?.script ?? null,
    oursClassical: ours?.classical ?? null,
    oursProvenance: ours?.provenance ?? null,
    alts: alts.map((c) => ({ script: c.script, classical: c.classical })),
    sourceRaw: k?.raw ?? null,
    sourceUnicode: k?.unicode ?? null,
    agree: ours && k ? ours.script === k.unicode : null,
  };
});

// ------------------------------------------------------------------ questions

const QUESTIONS = [
  {
    id: 'Q1',
    title: 'долоо — the verb reading',
    body: `долоо is "seven" (<code>doluγ-a</code>, ᠳᠣᠯᠤᠭ\u180Eᠠ) and also the imperative of долоох, "lick".
      By exact analogy with хар (ᠬᠠᠷ\u180Eᠠ qar-a "black" vs ᠬᠠᠷᠠ qara "look"), the verb should drop the
      chachlag. The silver returns the numeral in <em>every</em> context I tried, including
      <span class="cy">зайрмаг долоо</span> — so it has the same gap. I will not guess a second
      lexicon row without your ruling.`,
    script: [
      ['ᠳᠣᠯᠤᠭ\u180Eᠠ', 'doluγ-a — numeral "seven" (current single entry)'],
      ['ᠳᠣᠯᠤᠭᠠ', 'doluγa — proposed verb stem, no chachlag'],
    ],
    options: [
      'Correct — add ᠳᠣᠯᠤᠭᠠ (doluγa) as the verb reading',
      'Wrong form — the verb is spelled differently (say how)',
      'Do not add a verb entry at all',
    ],
  },
  {
    id: 'Q2',
    title: 'Cyrillic ё in the out-of-vocabulary guesser',
    body: `The guesser maps ё → <code>yo</code> via a flat letter table, so the o inside it never gets
      the o/ö rule applied. хоёр is safe (it is in the lexicon as <code>qoyar</code>), but any unknown
      ё-word past the first syllable comes out with a non-initial o. I do not know what ё should
      become — it corresponds to ya in хоёр, which suggests the letter table itself is wrong.`,
    script: [
      ['ᠬᠣᠶᠠᠷ', 'qoyar — хоёр, the lexicon entry (ё → ya)'],
      ['ᠰᠤᠶᠤᠯ', 'suyul — соёл if ё → yu after the first syllable'],
      ['ᠰᠤᠶᠣᠯ', 'suyol — соёл as the guesser currently produces it'],
    ],
    options: [
      'ё → ya always (match хоёр)',
      'ё → yo first syllable, yu after (apply the o/ö rule inside it)',
      'ё → yu always',
      'Other / it depends (say how)',
    ],
  },
  {
    id: 'Q3',
    title: 'монголчууд — which plural?',
    body: `the silver gives two different plurals for the same word depending on context: <code>-čuul</code>
      when the word is alone, <code>-čud</code> inside a sentence. Ours has no entry. Which is correct
      traditional spelling?`,
    script: [
      ['ᠮᠣᠩᠭᠣᠯᠴᠤᠤᠯ', 'mongγolčuul — the silver, word alone'],
      ['ᠮᠣᠩᠭᠣᠯᠴᠤᠳ', 'mongγolčud — the silver, in a sentence'],
    ],
    options: [
      'ᠮᠣᠩᠭᠣᠯᠴᠤᠤᠯ (-čuul) is correct',
      'ᠮᠣᠩᠭᠣᠯᠴᠤᠳ (-čud) is correct',
      'Both are valid in different senses (explain)',
      'Both wrong',
    ],
  },
  {
    id: 'Q4',
    title: 'сайн — do we stay with the modern form?',
    body: `You ruled earlier for the modern V+i spelling, and our tests assert it. The silver consistently
      writes the older V+y+i (<code>sayin</code>), and 5.8% of harvested rows use that pattern
      stem-internally. Before I import silver data, confirm we still overrule the silver here — this
      decides whether ~309 rows get rewritten or quarantined.`,
    script: [
      ['ᠰᠠᠢᠨ', 'sain — modern V+i, what we emit today'],
      ['ᠰᠠᠶᠢᠨ', 'sayin — older V+y+i, what the silver emits'],
    ],
    options: [
      'Stay modern — ᠰᠠᠢᠨ; rewrite silver rows to match',
      'Stay modern, but quarantine silver rows rather than rewriting',
      'Switch to ᠰᠠᠶᠢᠨ — the silver is right, our tests are wrong',
    ],
  },
  {
    id: 'Q5',
    title: 'найм — ours vs the silver',
    body: `You supplied ᠨᠠᠶ\u180Bᠮᠠ (NA A YA FVS1 MA A) from a screenshot and our converter matches it
      exactly. The silver writes ᠨᠠᠢᠮᠠ with a plain I and no YA — and that is inconsistent with the silver's
      сайн, which does use YA+I. One of them is wrong; I assume ours, but confirm.`,
    script: [
      ['ᠨᠠᠶ\u180Bᠮᠠ', 'nay(FVS1)ma — yours, and what we emit'],
      ['ᠨᠠᠢᠮᠠ', 'naima — the silver'],
    ],
    options: [
      'Ours is correct — the silver is wrong here',
      'the silver is correct — change ours',
      'Both acceptable variants',
    ],
  },
  {
    id: 'Q6',
    title: 'Case-suffix `separate` flags — still unverified',
    body: `Every case suffix carries a <code>separate</code> flag I set by hand and never had checked.
      The plural turned out to be wrong exactly this way, so I do not trust the rest. Below is what we
      currently emit for хот. Mark any that look wrong.`,
    script: [
      ['ᠬᠣᠲᠠ\u180Eᠶᠢᠨ', 'genitive — detached'],
      ['ᠬᠣᠲᠠ\u180Eᠳᠤ', 'dative — detached'],
      ['ᠬᠣᠲᠠ\u180Eᠠᠴᠠ', 'ablative — detached'],
      ['ᠬᠣᠲᠠ\u180Eᠪᠠᠷ', 'instrumental — detached'],
      ['ᠬᠣᠲᠠ\u180Eᠲᠠᠢ', 'comitative — detached'],
    ],
    options: [
      'All five correct',
      'Some are wrong (say which)',
      'All should be attached, not detached',
    ],
  },
];

// --------------------------------------------------------------------- render

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const cpsOf = (s) =>
  s === null
    ? '—'
    : [...s]
        .map((c) => {
          const p = c.codePointAt(0);
          if (p === 0x180e) return 'MVS';
          if (p === 0x202f) return 'NNBSP';
          if (p === 0x20) return 'SP';
          if (p >= 0x180b && p <= 0x180f) return `FVS${p - 0x180a}`;
          return `U+${p.toString(16).toUpperCase()}`;
        })
        .join(' ');

const scriptBox = (text, caption) => `
  <figure class="sbox">
    <div class="mn">${esc(text)}</div>
    <figcaption>${esc(caption)}<br><code>${esc(cpsOf(text))}</code></figcaption>
  </figure>`;

const qBlock = (q) => `
<section class="card" id="${q.id}">
  <h3><span class="qid">${q.id}</span> ${esc(q.title)}</h3>
  <p>${q.body}</p>
  <div class="scripts">${q.script.map(([t, c]) => scriptBox(t, c)).join('')}</div>
  <div class="opts">
    ${q.options
      .map(
        (o, i) => `<label><input type="radio" name="${q.id}" value="${esc(o)}"
        ${i === 0 ? '' : ''}> <span>${esc(o)}</span></label>`,
      )
      .join('')}
    <label class="note-l">Note <input type="text" class="note" data-for="${q.id}"
      placeholder="optional — corrections, the right spelling, anything"></label>
  </div>
</section>`;

const spotBlock = (r, i) => `
<section class="card spot" id="S${i + 1}">
  <h3><span class="qid">S${i + 1}</span> <span class="cy">${esc(r.word)}</span></h3>
  <p class="probe">${esc(r.probes)}</p>
  ${
    r.agree === true
      ? '<p class="agree ok">Ours and the silver agree.</p>'
      : r.ours && r.sourceUnicode
        ? '<p class="agree bad">Ours and the silver disagree.</p>'
        : '<p class="agree dim">No silver rendering for this word.</p>'
  }
  <div class="scripts">
    ${r.ours ? scriptBox(r.ours, `ours — ${r.oursClassical} (${r.oursProvenance})`) : '<figure class="sbox"><div class="mn dim">—</div><figcaption>ours: failed to convert</figcaption></figure>'}
    ${r.sourceUnicode ? scriptBox(r.sourceUnicode, 'Silver, repaired to Unicode 16') : ''}
    ${r.alts.map((a) => scriptBox(a.script, `ours, alt — ${a.classical}`)).join('')}
  </div>
  <div class="opts">
    ${['Ours is correct', 'the silver is correct', 'Both correct', 'Both wrong']
      .map(
        (o) =>
          `<label><input type="radio" name="S${i + 1}" value="${esc(o)}"> <span>${esc(o)}</span></label>`,
      )
      .join('')}
    <label class="note-l">Correct spelling <input type="text" class="note" data-for="S${i + 1}"
      placeholder="optional — paste the right bichig or a cyrillicised form"></label>
  </div>
</section>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gege — review &amp; spot check</title>
<style>
 :root{--bg:#0f1115;--panel:#171a23;--fg:#e9eaee;--dim:#98a0ae;--rule:#2a3040;
       --accent:#8ab4f8;--ok:#5ec27a;--bad:#e5665f;--warn:#e0b341}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--fg);
   font:16px/1.65 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;
   max-width:1080px;margin:0 auto;padding:44px 20px 140px}
 h1{font-size:1.85rem;margin:0 0 .15em;letter-spacing:-.01em}
 h2{font-size:1.2rem;margin:2.6em 0 .6em;padding-bottom:.3em;border-bottom:1px solid var(--rule)}
 h3{font-size:1.05rem;margin:0 0 .5em;display:flex;align-items:center;gap:.6em}
 .sub{color:var(--dim);margin:0 0 1.6em}
 .card{background:var(--panel);border-radius:11px;padding:20px 22px;margin:14px 0}
 .qid{background:#243049;color:#9dbcf5;border-radius:6px;padding:2px 9px;
   font-size:.75rem;font-weight:700;letter-spacing:.05em}
 code{background:#0b0d12;padding:1px 6px;border-radius:4px;font-size:.85em;color:#b9c6e0}
 .cy{color:#f0d68a;font-weight:600}
 .probe{color:var(--dim);font-size:.92rem;margin:.2em 0 1em}
 .agree{font-size:.85rem;font-weight:600;margin:.2em 0 1em}
 .agree.ok{color:var(--ok)} .agree.bad{color:var(--bad)} .agree.dim{color:var(--dim)}

 /* Bichig: real font, vertical, large. The terminal cannot do this. */
 .scripts{display:flex;flex-wrap:wrap;gap:16px;margin:1.1em 0 1.3em}
 .sbox{margin:0;background:#0c0e14;border:1px solid var(--rule);border-radius:9px;
   padding:16px 14px;display:flex;flex-direction:column;align-items:center;gap:12px;min-width:150px}
 .mn{writing-mode:vertical-lr;text-orientation:mixed;
   font-family:"Noto Sans Mongolian","Mongolian Baiti","MN Baiti","Menksoft Qagan",serif;
   font-size:2.1rem;line-height:1.5;min-height:150px;color:#fff}
 .mn.dim{color:var(--dim);font-size:1.2rem;min-height:40px}
 .sbox figcaption{font-size:.76rem;color:var(--dim);text-align:center;max-width:170px;line-height:1.45}
 .sbox figcaption code{font-size:.68rem;display:inline-block;margin-top:5px;word-break:break-all}

 .opts{display:flex;flex-direction:column;gap:7px;margin-top:.5em}
 .opts label{display:flex;align-items:center;gap:9px;cursor:pointer;padding:7px 11px;
   border-radius:7px;border:1px solid transparent;font-size:.93rem}
 .opts label:hover{background:#1e2331;border-color:var(--rule)}
 .opts input[type=radio]{accent-color:var(--accent);width:16px;height:16px;flex:none}
 .note-l{margin-top:4px;color:var(--dim);font-size:.85rem}
 .note{flex:1;background:#0b0d12;border:1px solid var(--rule);border-radius:6px;
   color:var(--fg);padding:7px 10px;font-size:.88rem;font-family:inherit;min-width:0}
 .note:focus{outline:none;border-color:var(--accent)}

 #out{position:fixed;left:0;right:0;bottom:0;background:#0a0c11;border-top:2px solid var(--accent);
   padding:12px 20px;box-shadow:0 -8px 28px rgba(0,0,0,.6)}
 #out .row{display:flex;gap:12px;align-items:center;max-width:1040px;margin:0 auto}
 #answers{flex:1;background:#0f1218;border:1px solid var(--rule);border-radius:7px;color:var(--fg);
   font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem;padding:9px 11px;
   height:74px;resize:vertical;white-space:pre;overflow:auto}
 button{background:var(--accent);color:#0a1020;border:0;border-radius:7px;padding:11px 18px;
   font-weight:700;cursor:pointer;font-size:.9rem;white-space:nowrap;font-family:inherit}
 button:hover{filter:brightness(1.1)}
 .count{color:var(--dim);font-size:.8rem;white-space:nowrap}
</style></head><body>

<h1>Review &amp; spot check</h1>
<p class="sub">Everything below needs your ruling. Pick an option on each, add a note where it helps,
then hit <strong>Copy</strong> at the bottom and paste the block back to me.<br>
Script is shown vertically in a real Mongolian font — judge the shapes, and the code points are under
each one if you want to check the bytes.</p>

<h2>Open questions</h2>
${QUESTIONS.map(qBlock).join('')}

<h2>Spot check — ten words</h2>
<p class="sub">Chosen to stress specific things I am unsure about, not sampled at random.
${
  linter
    ? 'Both columns lint clean unless noted.'
    : 'gege-linter was not loadable, so no cross-check was run.'
}</p>
${spotRows.map(spotBlock).join('')}

<div id="out"><div class="row">
  <textarea id="answers" readonly placeholder="Make a selection above…"></textarea>
  <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
    <button id="copy">Copy</button>
    <span class="count" id="count">0 answered</span>
  </div>
</div></div>

<script>
const IDS = ${JSON.stringify([...QUESTIONS.map((q) => q.id), ...spotRows.map((_, i) => `S${i + 1}`)])};
const LABEL = ${JSON.stringify(
  Object.fromEntries([
    ...QUESTIONS.map((q) => [q.id, q.title]),
    ...spotRows.map((r, i) => [`S${i + 1}`, r.word]),
  ]),
)};

function build() {
  const lines = [];
  let n = 0;
  for (const id of IDS) {
    const sel = document.querySelector('input[name="' + id + '"]:checked');
    const note = document.querySelector('.note[data-for="' + id + '"]');
    const noteVal = note && note.value.trim();
    if (!sel && !noteVal) continue;
    n++;
    let line = id + ' (' + LABEL[id] + '): ' + (sel ? sel.value : '(no option picked)');
    if (noteVal) line += ' — NOTE: ' + noteVal;
    lines.push(line);
  }
  const ta = document.getElementById('answers');
  ta.value = lines.length ? 'REVIEW ANSWERS\\n' + lines.join('\\n') : '';
  document.getElementById('count').textContent = n + ' of ' + IDS.length + ' answered';
}

document.addEventListener('change', build);
document.addEventListener('input', build);
document.getElementById('copy').addEventListener('click', async () => {
  const ta = document.getElementById('answers');
  if (!ta.value) return;
  try {
    await navigator.clipboard.writeText(ta.value);
  } catch {
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

writeFileSync(OUT, html);
console.log(`wrote ${OUT}`);
console.log(`  questions:  ${QUESTIONS.length}`);
console.log(`  spot words: ${spotRows.length}`);
console.log(`  ours vs the silver agree: ${spotRows.filter((r) => r.agree === true).length}`);
console.log(`  disagree:           ${spotRows.filter((r) => r.agree === false).length}`);
console.log(`  no silver data:       ${spotRows.filter((r) => r.agree === null).length}`);
