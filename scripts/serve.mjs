#!/usr/bin/env node
/**
 * A local playground: paste Cyrillic, see what the converter does with it.
 *
 *   pnpm build && pnpm dev        →  http://localhost:5173
 *
 * Conversion happens **server-side**, on the built library, and the page just
 * renders JSON. That is deliberate: importing `dist/` straight into the browser
 * would need an import map to resolve the bare `@gege-mn/mongol-bichig`
 * specifier, and would then be one pnpm symlink away from breaking. This way
 * the page is plain HTML and what it shows is exactly what `analyze()` returns.
 *
 * Re-run `pnpm build` after changing src or data, then reload. The server reads
 * `dist/` fresh on each request via a cache-busting import, so a rebuild shows
 * up without restarting.
 *
 * Bichig is rendered vertically in a real Mongolian font. Terminal output
 * cannot be used to judge it — wrong glyphs, no vertical layout — which is the
 * entire reason this exists.
 *
 * Per project convention invisible characters are never written literally in
 * source; MVS appears here only as a \uXXXX escape.
 */

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT ?? 5173);

/** MONGOLIAN VOWEL SEPARATOR — the suffix connector, invisible when rendered. */
const MVS = '\u180E';
/** NARROW NO-BREAK SPACE — the legacy connector. Should never appear in output. */
const NNBSP = '\u202F';

/**
 * Import the built library fresh, so a `bun run build` in another terminal is
 * picked up on reload rather than needing a server restart.
 */
async function loadLibrary() {
  const bust = `?t=${Date.now()}`;
  const url = pathToFileURL(resolve(ROOT, 'dist/index.js')).href;
  return import(url + bust);
}

/** `ᠮ` → `U+182E`, for byte-checking what the renderer will not show. */
const codePoints = (s) =>
  [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

async function analyzeRequest(body) {
  const {
    text = '',
    digits = 'ascii',
    punctuation = 'ascii',
    stylisticSuffixes = 'attached',
  } = body;
  const lib = await loadLibrary();
  const options = { digits, punctuation, stylisticSuffixes };

  const analyzed = lib.analyze(text, options);

  const tokens = analyzed.map((t) => ({
    kind: t.token.kind,
    text: t.token.text,
    verbForm: t.verbForm ?? null,
    rendered:
      t.token.kind === 'word'
        ? (t.candidates[0]?.script ?? t.token.text)
        : lib.renderNonWord(t.token, digits, punctuation),
    candidates: t.candidates.map((c) => ({
      classical: c.classical,
      script: c.script,
      gloss: c.gloss ?? null,
      confidence: c.confidence,
      provenance: c.provenance,
      suffixes: c.segmentation.suffixes.map((s) => s.cyrillic),
      stem: c.segmentation.stem,
      codePoints: codePoints(c.script),
    })),
  }));

  const words = tokens.filter((t) => t.kind === 'word');
  const counts = { lexicon: 0, harvested: 0, guess: 0, none: 0 };
  for (const w of words) counts[w.candidates[0]?.provenance ?? 'none'] += 1;

  // Rebuild from the per-token renderings rather than calling `convert()`, so
  // the string on screen is exactly the concatenation of the words shown below
  // it.
  const output = tokens.map((t) => t.rendered).join('');

  return {
    output,
    outputCodePoints: codePoints(output),
    tokens,
    stats: {
      words: words.length,
      ...counts,
      verbShaped: words.filter((w) => w.verbForm).length,
      // A guessed stem is right ~5% of the time, so any sentence containing one
      // is almost certainly wrong. Worth stating rather than leaving to be read
      // off the colours.
      clean: words.length > 0 && counts.guess === 0 && counts.none === 0,
      hasNnbsp: output.includes(NNBSP),
      hasMvs: output.includes(MVS),
    },
  };
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gege-converter playground</title>
<style>
 :root{--bg:#0f1115;--panel:#161922;--fg:#e6e6e6;--dim:#a3a8b3;--rule:#2a2f3a;
   --lex:#5bd68a;--harv:#8ab4f8;--guess:#f2b45e;--none:#e46f6f;--verb:#c58af9;}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,
   BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
 header{padding:14px 20px;border-bottom:1px solid var(--rule);display:flex;
   align-items:center;gap:18px;flex-wrap:wrap}
 h1{font-size:1rem;margin:0;font-weight:600;letter-spacing:.01em}
 .opts{display:flex;gap:14px;font-size:.85rem;color:var(--dim);flex-wrap:wrap}
 label{display:flex;align-items:center;gap:6px;cursor:pointer}
 main{display:grid;grid-template-columns:minmax(280px,1fr) minmax(280px,1fr);
   gap:1px;background:var(--rule);min-height:60vh}
 section{background:var(--bg);padding:16px 20px;min-width:0}
 h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.09em;color:var(--dim);
   margin:0 0 12px;font-weight:600}
 textarea{width:100%;min-height:180px;background:var(--panel);color:var(--fg);
   border:1px solid var(--rule);border-radius:8px;padding:12px 14px;font:inherit;
   resize:vertical}
 textarea:focus{outline:none;border-color:var(--harv)}
 .mn{writing-mode:vertical-lr;text-orientation:mixed;
   font-family:"Noto Sans Mongolian","Mongolian Baiti","MN Baiti",serif;
   font-size:30px;line-height:1.9;max-height:52vh;overflow-x:auto;overflow-y:hidden;
   background:var(--panel);border:1px solid var(--rule);border-radius:8px;padding:16px}
 .cp{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;
   color:var(--dim);word-break:break-all;margin-top:10px;line-height:1.5}
 .stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;font-size:.78rem}
 .pill{padding:3px 9px;border-radius:999px;background:var(--panel);
   border:1px solid var(--rule)}
 .pill b{font-weight:600}
 .lexicon{color:var(--lex)} .harvested{color:var(--harv)}
 .guess{color:var(--guess)} .none{color:var(--none)} .verb{color:var(--verb)}
 .tokens{display:flex;flex-wrap:wrap;gap:6px}
 .tok{border:1px solid var(--rule);border-radius:7px;padding:6px 9px;cursor:pointer;
   background:var(--panel);font-size:.88rem;border-left-width:3px}
 .tok:hover{border-color:var(--dim)}
 .tok.sel{border-color:var(--fg)}
 .tok.lexicon{border-left-color:var(--lex)} .tok.harvested{border-left-color:var(--harv)}
 .tok.guess{border-left-color:var(--guess)} .tok.none{border-left-color:var(--none)}
 .tok.skip{opacity:.4;border-left-color:transparent;cursor:default}
 select{background:var(--panel);color:var(--fg);border:1px solid var(--rule);
   border-radius:6px;padding:3px 7px;font:inherit;font-size:.85rem}
 .tok .vb{color:var(--verb);font-size:.7rem;margin-left:5px}
 .detail{margin-top:16px}
 .cand{border:1px solid var(--rule);border-radius:8px;padding:10px 12px;margin-bottom:8px;
   background:var(--panel)}
 .cand .top{display:flex;justify-content:space-between;gap:10px;align-items:baseline;
   flex-wrap:wrap}
 .cand code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86rem}
 .cand .meta{font-size:.75rem;color:var(--dim)}
 .cand .mn{font-size:26px;max-height:150px;margin-top:8px;padding:10px}
 .warn{color:var(--none);font-size:.8rem;margin-top:8px}
 .empty{color:var(--dim);font-size:.85rem}
 @media(max-width:820px){main{grid-template-columns:1fr}}
</style></head><body>
<header>
  <h1>gege-converter playground</h1>
  <div class="opts">
    <label><input type="checkbox" id="digits"> Mongolian digits</label>
    <label><input type="checkbox" id="punct"> Mongolian punctuation</label>
    <label><input type="checkbox" id="joined"> Connector-join -тай / ordinals</label>
  </div>
</header>
<main>
  <section>
    <h2>Cyrillic in</h2>
    <textarea id="in" placeholder="Монгол бичиг&#10;Хотод очлоо&#10;&#10;Paste anything."
      autofocus></textarea>
    <div class="detail" id="detail"></div>
  </section>
  <section>
    <h2>Bichig out</h2>
    <div class="stats" id="stats"></div>
    <div class="mn" id="out"></div>
    <div class="cp" id="cp"></div>
    <h2 style="margin-top:20px">Words <span style="text-transform:none;letter-spacing:0">— click one</span></h2>
    <div class="tokens" id="toks"></div>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let data = null, sel = -1;

const run = async () => {
  const text = $('in').value;
  if (!text.trim()) { data = null; sel = -1; render(); return; }
  const res = await fetch('/api/analyze', {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({
      text,
      digits: $('digits').checked ? 'mongolian' : 'ascii',
      punctuation: $('punct').checked ? 'mongolian' : 'ascii',
      stylisticSuffixes: $('joined').checked ? 'joined' : 'attached',
    }),
  });
  data = await res.json();
  render();
};

const pill = (label, n, cls) =>
  n > 0 ? '<span class="pill ' + cls + '"><b>' + n + '</b> ' + label + '</span>' : '';

function render() {
  if (!data) {
    $('out').textContent = ''; $('cp').textContent = '';
    $('stats').innerHTML = ''; $('toks').innerHTML = '';
    $('detail').innerHTML = '<p class="empty">Type or paste on the left.</p>';
    return;
  }
  const s = data.stats;
  $('out').textContent = data.output;
  $('cp').textContent = data.outputCodePoints;
  $('stats').innerHTML =
    pill('words', s.words, '') +
    pill('curated', s.lexicon, 'lexicon') +
    pill('harvested', s.harvested, 'harvested') +
    pill('guessed', s.guess, 'guess') +
    pill('no reading', s.none, 'none') +
    pill('verb-shaped', s.verbShaped, 'verb') +
    (s.hasNnbsp ? '<span class="pill none"><b>NNBSP</b> in output!</span>' : '') +
    (s.clean ? '<span class="pill lexicon">every stem from real data</span>' : '');

  $('toks').innerHTML = data.tokens.map((t, i) => {
    if (t.kind !== 'word') {
      return '<span class="tok skip">' + esc(t.text.trim() || '␣') + '</span>';
    }
    const p = t.candidates[0] ? t.candidates[0].provenance : 'none';
    return '<span class="tok ' + p + (i === sel ? ' sel' : '') + '" data-i="' + i + '">' +
      esc(t.text) + (t.verbForm ? '<span class="vb">' + t.verbForm.kind + '</span>' : '') + '</span>';
  }).join('');

  for (const el of $('toks').querySelectorAll('.tok[data-i]')) {
    el.onclick = () => { sel = Number(el.dataset.i); render(); };
  }
  renderDetail();
}

function renderDetail() {
  const t = sel >= 0 ? data.tokens[sel] : null;
  if (!t) { $('detail').innerHTML = '<p class="empty">Click a word to see its candidates.</p>'; return; }
  let html = '<h2>' + esc(t.text) + '</h2>';
  if (t.verbForm) {
    html += '<p class="warn">Carries a verb ending (' + esc(t.verbForm.kind) +
      ', -' + esc(t.verbForm.ending) + '). This package has no verb morphology' +
      (t.candidates[0] && t.candidates[0].provenance === 'guess'
        ? ' — combined with a guessed stem, this is very likely wrong.' : '.') + '</p>';
  }
  if (!t.candidates.length) html += '<p class="empty">No candidates.</p>';
  for (const c of t.candidates) {
    const chain = c.suffixes.length ? c.stem + ' + ' + c.suffixes.join(' + ') : c.stem;
    html += '<div class="cand"><div class="top"><code>' + esc(c.classical) + '</code>' +
      '<span class="meta ' + c.provenance + '">' + c.provenance + ' · ' +
      Math.round(c.confidence * 100) + '%</span></div>' +
      '<div class="meta">' + esc(chain) + (c.gloss ? ' · ' + esc(c.gloss) : '') + '</div>' +
      '<div class="mn">' + esc(c.script) + '</div>' +
      '<div class="cp">' + c.codePoints + '</div></div>';
  }
  $('detail').innerHTML = html;
}

const esc = (s) => s.replace(/[&<>"']/g, (c) =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let timer;
$('in').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
$('digits').addEventListener('change', run);
$('punct').addEventListener('change', run);
$('joined').addEventListener('change', run);
render();
</script></body></html>`;

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/analyze') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const result = await analyzeRequest(JSON.parse(body || '{}'));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(err?.stack ?? err) }));
    }
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});

server.listen(PORT, () => {
  console.log(`gege-converter playground  →  http://localhost:${PORT}`);
  console.log('rebuild with `pnpm build` and reload; no restart needed.');
});
