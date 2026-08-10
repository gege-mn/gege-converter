#!/usr/bin/env node

/**
 * Ask the reader a **small** batch of questions.
 *
 *   node scripts/build-ask.mjs .tmp/ask/chachlag.json [out.html] [--open]
 *
 * ## Why this exists, and why it is capped
 *
 * `build-spotcheck.mjs` samples 42 words across three groups, and
 * `build-naming.mjs` asked 128. Both are the right tool when the reader has an
 * hour. Neither is the right tool when they do not: on 2026-07-29 the naming
 * page got 32 answers of 128 and the reply was "i give up, it's a lot of
 * stuff… i don't have much energy."
 *
 * The answers given were excellent. The page was simply too big to finish, and
 * an unfinished page is not a smaller result — the reader also has to carry the
 * guilt of an unfinished page, which makes the next one less likely to be
 * opened at all.
 *
 * So this builds a page that is **finishable in one sitting**, and enforces it:
 * more than `MAX_QUESTIONS` is a hard error, not a warning. If a topic needs
 * more, it is more than one batch, and the batches go out as the reader has
 * energy for them. A question that is never asked costs nothing; a question
 * asked inside a page too long to finish costs the whole page.
 *
 * ## The batch format
 *
 * ```json
 * {
 *   "title": "Chachlag",
 *   "intro": "One rule settles ~800 rows.",
 *   "questions": [{
 *     "id": "C1",
 *     "cyrillic": "нэр",
 *     "prompt": "Does нэр take the chachlag?",
 *     "options": [
 *       { "label": "ner-e (with)", "classical": "ner-e" },
 *       { "label": "nere (without)", "classical": "nere" }
 *     ],
 *     "note": "we say nere; toli says ner-e"
 *   }]
 * }
 * ```
 *
 * `classical` is romanized and rendered through our own `toScript`, so the page
 * shows what we would actually emit rather than a hand-typed string — the same
 * discipline as the rest of the repo. Give `script` instead to render exact
 * code points that no romanization produces.
 *
 * Bichig renders vertically in a real Mongolian font because terminal output
 * cannot be used to judge it. Code points sit underneath for byte-checking.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { baseCss, fontWarning, footer, header } from './lib/brand.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MAX_QUESTIONS = 8;

const args = process.argv.slice(2);
const OPEN = args.includes('--open');
const positionals = args.filter((a) => !a.startsWith('--'));
const BATCH = positionals[0];
const OUT = positionals[1] ?? '.tmp/ask.html';

if (!BATCH) {
  console.error('usage: node scripts/build-ask.mjs <batch.json> [out.html] [--open]');
  process.exit(1);
}
if (!existsSync(resolve(ROOT, 'dist/romanize.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}

const { toScript } = await import(pathToFileURL(resolve(ROOT, 'dist/romanize.js')).href);

const batch = JSON.parse(readFileSync(resolve(ROOT, BATCH), 'utf8'));
const questions = batch.questions ?? [];

// The cap is the whole point of this script; a warning would be ignored.
if (questions.length > MAX_QUESTIONS) {
  console.error(
    `${questions.length} questions, but the cap is ${MAX_QUESTIONS}.\n` +
      'Split this into batches. A page too long to finish returns fewer answers\n' +
      'than two pages that each get finished.',
  );
  process.exit(1);
}
if (questions.length === 0) {
  console.error('no questions in the batch');
  process.exit(1);
}

// `id` groups the radios and keys the verdict block. A missing or repeated one
// silently merges two questions into one radio group — answering the second
// deselects the first — and the reader loses an answer without any sign of it.
const seenIds = new Set();
for (const q of questions) {
  if (typeof q.id !== 'string' || q.id.length === 0) {
    console.error(`every question needs a non-empty string id; got ${JSON.stringify(q.id)}`);
    process.exit(1);
  }
  if (seenIds.has(q.id)) {
    console.error(`duplicate question id ${JSON.stringify(q.id)}`);
    process.exit(1);
  }
  seenIds.add(q.id);
}

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const codepoints = (s) =>
  [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

/**
 * Render one option's bichig, preferring our own generator over a literal.
 *
 * A `toScript` throw is fatal rather than swallowed: an empty bichig box is
 * still selectable and still emits a verdict line, so a typo'd `classical`
 * would silently ask the reader to rule on nothing — the one thing this page
 * exists to do, failing without a sound.
 */
function renderScript(option) {
  if (option.script !== undefined) return option.script;
  if (option.classical === undefined) return '';
  try {
    return toScript(option.classical);
  } catch (err) {
    throw new Error(`cannot romanize option ${JSON.stringify(option.classical)}: ${err.message}`);
  }
}

function optionBox(option, qid, index) {
  const script = renderScript(option);
  const id = esc(`${qid}o${index}`);
  const caption = option.classical !== undefined ? `<code>${esc(option.classical)}</code>` : '';
  return `<label class="opt" for="${id}">
  <input type="radio" name="${esc(qid)}" id="${id}" value="${esc(option.label)}">
  <figure class="sbox">
    <div class="mn">${esc(script)}</div>
    <figcaption>${esc(option.label)}<br>${caption}
      <code class="cp">${esc(codepoints(script))}</code></figcaption>
  </figure>
</label>`;
}

function questionBlock(q) {
  const opts = (q.options ?? []).map((o, i) => optionBox(o, q.id, i)).join('');
  const note = q.note ? `<p class="probe">${esc(q.note)}</p>` : '';
  return `<section class="card">
  <p><span class="qid">${esc(q.id)}</span> <span class="cy">${esc(q.cyrillic ?? '')}</span></p>
  <p class="prompt">${esc(q.prompt ?? '')}</p>
  ${note}
  <div class="opts-row">${opts}</div>
  <label class="note-l"><input class="note" id="${esc(q.id)}n" placeholder="note (optional)"></label>
</section>`;
}

const blocks = questions.map(questionBlock).join('');
const ids = questions.map((q) => q.id);
const labels = Object.fromEntries(questions.map((q) => [q.id, q.cyrillic ?? '']));

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(batch.title ?? 'Quick question')}</title>
<style>
${baseCss()}
 :root{--ok:#1a7f4b}
 body{max-width:none}
 .sub{color:var(--dim);margin:0 0 1.4em;font-size:.94rem;line-height:1.6}
 .card{background:var(--panel);border:1px solid var(--rule);border-radius:12px;padding:18px 20px;margin:14px 0}
 .qid{background:color-mix(in srgb,var(--acc) 12%,transparent);color:var(--acc);border-radius:6px;
   padding:2px 9px;font-size:.75rem;font-weight:700;letter-spacing:.05em;font-family:var(--font-mark)}
 .cy{color:var(--ink);font-weight:700;font-size:1.15rem;margin-left:.4em}
 .prompt{margin:.5em 0 .2em;font-size:1rem}
 .probe{color:var(--dim);font-size:.87rem;margin:.2em 0 .8em;line-height:1.55}
 .opts-row{display:flex;flex-wrap:wrap;gap:14px;margin:.8em 0 .4em}
 .opt{display:block;cursor:pointer;border:2px solid transparent;border-radius:11px;padding:2px}
 .opt:hover{border-color:var(--rule)}
 .opt:has(input:checked){border-color:var(--acc)}
 .opt input{position:absolute;opacity:0;pointer-events:none}
 .sbox{margin:0;background:var(--paper);border:1px solid var(--rule);border-radius:9px;
   padding:14px 12px;display:flex;flex-direction:column;align-items:center;gap:10px;min-width:140px}
 .mn{writing-mode:vertical-lr;text-orientation:sideways;font-family:var(--font-mongol);
   font-size:2.1rem;line-height:1.5;min-height:130px;color:var(--ink)}
 .sbox figcaption{font-size:.76rem;color:var(--dim);text-align:center;max-width:170px;line-height:1.45}
 .cp{font-size:.62rem;display:inline-block;margin-top:5px;word-break:break-all}
 .note-l{display:block;margin-top:6px}
 .note{width:100%;background:var(--paper);border:1px solid var(--rule);border-radius:6px;
   color:var(--ink);padding:7px 10px;font-size:.88rem;font-family:inherit}
 .note:focus{outline:none;border-color:var(--acc)}
 #out{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:2px solid var(--acc);
   padding:12px 20px;box-shadow:0 -8px 28px rgba(20,17,13,.14)}
 #out .row{display:flex;gap:12px;align-items:center;max-width:940px;margin:0 auto}
 #answers{flex:1;background:var(--paper);border:1px solid var(--rule);border-radius:7px;color:var(--ink);
   font-family:var(--font-mono);font-size:.8rem;padding:9px 11px;
   height:70px;resize:vertical;white-space:pre;overflow:auto}
 button{background:var(--acc);color:#fff;border:0;border-radius:7px;padding:11px 18px;
   font-weight:700;cursor:pointer;font-size:.9rem;white-space:nowrap;font-family:var(--font-mark)}
 button:hover{filter:brightness(1.1)}
 .count{color:var(--dim);font-size:.8rem;white-space:nowrap}
</style></head><body><div class="wrap">
${header('a question for you')}
${fontWarning()}
<h1>${esc(batch.title ?? 'Quick question')}</h1>
<p class="sub">${esc(batch.intro ?? '')} <strong>${questions.length} question${
  questions.length === 1 ? '' : 's'
}</strong> — click a shape, then hit Copy and paste the block back to me. Skip
anything you are unsure about; a blank is more useful than a guess.</p>

${blocks}

<div id="out"><div class="row">
  <textarea id="answers" readonly placeholder="Pick an option above…"></textarea>
  <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
    <button id="copy">Copy</button><span class="count" id="count">0 of ${questions.length}</span>
  </div>
</div></div>

<script>
const IDS = ${JSON.stringify(ids)};
const LABEL = ${JSON.stringify(labels)};
const TITLE = ${JSON.stringify(batch.title ?? 'batch')};
function build(){
  const lines=[]; let n=0;
  for(const id of IDS){
    const sel=document.querySelector('input[name="'+id+'"]:checked');
    const note=document.getElementById(id+'n');
    const noteVal=note&&note.value.trim();
    if(!sel&&!noteVal) continue;
    n++;
    let line=id+' ('+LABEL[id]+'): '+(sel?sel.value:'(skipped)');
    if(noteVal) line+=' — NOTE: '+noteVal;
    lines.push(line);
  }
  document.getElementById('answers').value = lines.length ? TITLE.toUpperCase()+'\\n'+lines.join('\\n') : '';
  document.getElementById('count').textContent = n+' of '+IDS.length;
}
document.addEventListener('change',build);
document.addEventListener('input',build);
document.getElementById('copy').addEventListener('click',()=>{
  const ta=document.getElementById('answers');
  if(!ta.value) return;
  ta.select(); document.execCommand('copy');
  const b=document.getElementById('copy'); b.textContent='Copied'; setTimeout(()=>b.textContent='Copy',1200);
});
build();
</script>
${footer()}
</div></body></html>`;

const outPath = resolve(ROOT, OUT);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`wrote ${OUT} — ${questions.length} questions`);

if (OPEN) {
  try {
    execFileSync('open', [outPath]);
    console.log('opened in your browser.');
  } catch {
    console.log('(could not open automatically)');
  }
}
