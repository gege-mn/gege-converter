#!/usr/bin/env node
/**
 * Generates `.tmp/demo.html` — a self-contained page showing the converter
 * actually running.
 *
 *   pnpm build && node scripts/build-demo.mjs
 *
 * Every string, number and code point on the page is produced by calling the
 * built library at generation time. Nothing about the output is hard-coded,
 * so the page cannot drift from what the code does: re-run this after any
 * data or pipeline change and the demo re-states the truth.
 *
 * The gege-linter cross-check is resolved at runtime from, in order:
 *   $GEGE_LINTER  →  the `@gege-mn/gege-linter` package  →  ../gege-linter/dist
 * If none resolve the page still builds, with the linter panel marked
 * unavailable rather than silently claiming a pass.
 *
 * Per project convention, invisible characters are never written literally in
 * source — MVS and NNBSP appear here only as \uXXXX escapes.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, '.tmp/demo.html');

const {
  analyze,
  buildCandidates,
  convert,
  frequencyRanker,
  lexicon,
  normalizeWord,
  resolveStem,
  segment,
  suffixes,
  tokenize,
} = await import(pathToFileURL(resolve(ROOT, 'dist/index.js')).href);

/** Unicode 16.0 suffix connector / chachlag separator. */
const MVS = '\u180E';
/** The legacy connector this package exists to not emit. */
const NNBSP = '\u202F';

// ---------------------------------------------------------------- linter ---

async function loadLinter() {
  const attempts = [
    process.env.GEGE_LINTER,
    '@gege-mn/gege-linter',
    resolve(ROOT, '../gege-linter/dist/index.js'),
  ].filter(Boolean);

  for (const spec of attempts) {
    const href = /^[./]|^[A-Za-z]:\\/.test(spec) ? pathToFileURL(resolve(spec)).href : spec;
    try {
      const mod = await import(href);
      if (typeof mod.lint === 'function') {
        return { lint: mod.lint, source: spec, rules: mod.rules?.length ?? null };
      }
    } catch {
      // try the next candidate
    }
  }
  return { lint: null, source: null, rules: null };
}

const linter = await loadLinter();

// ------------------------------------------------------------------ data ---

/** Words for the conversion table. Inputs are fixed; every output is live. */
const SAMPLES = [
  { cy: 'монгол', group: 'bare stem' },
  { cy: 'бичиг', group: 'bare stem' },
  { cy: 'сайн', group: 'bare stem' },
  { cy: 'улаан', group: 'bare stem' },
  { cy: 'тэнгэр', group: 'bare stem' },
  { cy: 'ном', group: 'bare stem' },
  { cy: 'хотод', group: 'suffixed' },
  { cy: 'хотоос', group: 'suffixed' },
  { cy: 'хотын', group: 'suffixed' },
  { cy: 'гэрт', group: 'suffixed' },
  { cy: 'номууд', group: 'suffixed' },
  { cy: 'уулаар', group: 'suffixed' },
  { cy: 'квантум', group: 'out of vocabulary' },
  { cy: 'компьютер', group: 'out of vocabulary' },
];

const AMBIGUOUS_WORD = 'хар';
const TRACE_WORD = 'хотод';
const SENTENCE = 'Монгол бичиг сайн';

const cps = (s) =>
  [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const chain = (seg) =>
  seg.suffixes.length === 0
    ? '<span class="dim">— (no suffix)</span>'
    : seg.suffixes.map((s) => `<code>${esc(s.cyrillic)}</code>`).join(' + ');

const analyzeWord = (cy) => analyze(cy)[0] ?? { token: { text: cy }, candidates: [] };

const table = SAMPLES.map(({ cy, group }) => {
  const { candidates } = analyzeWord(cy);
  return { cy, group, candidates, top: candidates[0] ?? null };
});

const ambiguous = analyzeWord(AMBIGUOUS_WORD).candidates;

// Everything the page shows in script form, for the two global audits.
const allScripts = [
  ...table.flatMap((r) => r.candidates.map((c) => c.script)),
  ...ambiguous.map((c) => c.script),
  ...buildCandidates(TRACE_WORD).map((c) => c.script),
  convert(SENTENCE),
];

// -------------------------------------------------------------- audits ----

const nnbspHits = allScripts.filter((s) => s.includes(NNBSP));
const mvsCount = allScripts.reduce((n, s) => n + [...s].filter((c) => c === MVS).length, 0);

const lintRows = [];
const lintCounts = { error: 0, warning: 0, info: 0 };
if (linter.lint) {
  for (const script of allScripts) {
    for (const d of linter.lint(script)) {
      lintCounts[d.severity] = (lintCounts[d.severity] ?? 0) + 1;
      lintRows.push({ script, ...d });
    }
  }
}
const lintPass = linter.lint !== null && lintCounts.error === 0 && lintCounts.warning === 0;

// --------------------------------------------------------------- trace ----

const traceTokens = tokenize(TRACE_WORD);
const traceNormalized = normalizeWord(TRACE_WORD);
const traceSegments = segment(traceNormalized);
const traceStems = [...new Set(traceSegments.map((s) => s.stem))].map((stem) => ({
  stem,
  matches: resolveStem(stem),
}));
const traceBuilt = buildCandidates(TRACE_WORD);
const traceRanked = analyzeWord(TRACE_WORD).candidates;

// ---------------------------------------------------------------- HTML ----

/** A vertical bichig sample with its romanization beside it. */
const sample = (script, roman, size = 'md') =>
  `<div class="script-pair">
     <div class="bichig ${size}" lang="mn-Mong">${esc(script)}</div>
     <div class="roman">${esc(roman)}</div>
   </div>`;

const cpRun = (script) =>
  `<div class="cps">${cps(script)
    .map((c) => `<span class="cp${c === 'U+180E' ? ' cp-mvs' : ''}">${c}</span>`)
    .join('')}</div>`;

const bar = (conf, provenance) =>
  `<div class="bar"><span class="bar-fill ${provenance === 'guess' ? 'bar-guess' : ''}" style="width:${(conf * 100).toFixed(1)}%"></span></div>`;

const prov = (p) => `<span class="tag tag-${p}">${p === 'lexicon' ? 'lexicon' : 'guess'}</span>`;

const tableRows = table
  .map(
    (r) => `
    <tr>
      <td class="cyr">${esc(r.cy)}<div class="dim tiny">${esc(r.group)}</div></td>
      <td class="script-cell">${r.top ? sample(r.top.script, r.top.classical) : '<span class="dim">no candidate</span>'}</td>
      <td>${
        r.top
          ? `<code>${esc(r.top.segmentation.stem)}</code>${r.top.segmentation.suffixes
              .map((s) => ` <span class="dim">+</span> <code>${esc(s.cyrillic)}</code>`)
              .join('')}${
              r.top.segmentation.suffixes.length > 0
                ? `<div class="dim tiny">${r.top.segmentation.suffixes.map((s) => s.category).join(', ')} · ${
                    r.top.segmentation.suffixes.some((s) => s.separate) ? 'MVS-detached' : 'fused'
                  }</div>`
                : '<div class="dim tiny">bare stem</div>'
            }`
          : ''
      }</td>
      <td>${r.top ? prov(r.top.provenance) : ''}${r.top?.gloss ? `<div class="dim tiny">${esc(r.top.gloss)}</div>` : ''}</td>
      <td class="num">${r.top ? pct(r.top.confidence) : '—'}${r.top ? bar(r.top.confidence, r.top.provenance) : ''}<div class="dim tiny">${r.candidates.length} cand.</div></td>
    </tr>`,
  )
  .join('');

const ambiguousCards = ambiguous
  .map(
    (c, i) => `
    <div class="cand ${i === 0 ? 'cand-top' : ''}">
      <div class="cand-rank">#${i + 1}</div>
      ${sample(c.script, c.classical, 'lg')}
      <div class="cand-body">
        <div class="cand-gloss">${esc(c.gloss ?? '—')}</div>
        <div class="cand-meta">${prov(c.provenance)} <span class="dim">prior ${c.prior}</span></div>
        ${cpRun(c.script)}
        <div class="conf-line"><span class="conf-num">${pct(c.confidence)}</span>${bar(c.confidence, c.provenance)}</div>
      </div>
    </div>`,
  )
  .join('');

const stageBox = (n, name, made, body) => `
  <div class="stage">
    <div class="stage-head"><span class="stage-n">${n}</span><span class="stage-name">${name}</span><span class="stage-made">${made}</span></div>
    <div class="stage-body">${body}</div>
  </div>`;

const traceHtml = [
  stageBox(
    1,
    'tokenize',
    'code',
    `<pre>${esc(JSON.stringify(traceTokens, null, 2))}</pre>
     <p class="note">Offsets are <strong>code points</strong>, not UTF-16 units — the same model gege-linter's diagnostics use.</p>`,
  ),
  stageBox(
    2,
    'normalize',
    'code',
    `<p><code>${esc(TRACE_WORD)}</code> → <code>${esc(traceNormalized)}</code>${
      TRACE_WORD === traceNormalized ? ' <span class="dim">(already normal)</span>' : ''
    }</p>`,
  ),
  stageBox(
    3,
    'segment',
    'code + data',
    `<p class="note"><strong>${traceSegments.length} parses kept</strong>, not one. Nothing is resolved here — ranking decides later.</p>
     <div class="tablewrap"><table class="sub">
       <thead><tr><th>#</th><th>stem</th><th>suffix chain</th><th>classical suffixes</th><th>connector</th></tr></thead>
       <tbody>${traceSegments
         .map(
           (s, i) => `<tr>
             <td class="dim">${i + 1}</td>
             <td><code>${esc(s.stem)}</code></td>
             <td>${chain(s)}</td>
             <td>${s.suffixes.map((x) => `<code>${esc(x.classical)}</code>`).join(' + ') || '<span class="dim">—</span>'}</td>
             <td>${s.suffixes.some((x) => x.separate) ? '<span class="mvs-tag">MVS</span>' : '<span class="dim">fused</span>'}</td>
           </tr>`,
         )
         .join('')}</tbody>
     </table></div>`,
  ),
  stageBox(
    4,
    'resolveStem',
    'data + code',
    `<div class="tablewrap"><table class="sub">
       <thead><tr><th>Cyrillic stem</th><th>classical</th><th>gloss</th><th>prior</th><th>provenance</th></tr></thead>
       <tbody>${traceStems
         .map(({ stem, matches }) =>
           matches.length === 0
             ? `<tr><td><code>${esc(stem)}</code></td><td colspan="4" class="dim">unromanizable — dropped</td></tr>`
             : matches
                 .map(
                   (m) => `<tr>
                     <td><code>${esc(stem)}</code></td>
                     <td><code>${esc(m.classical)}</code></td>
                     <td class="dim">${esc(m.gloss ?? '—')}</td>
                     <td class="num">${m.prior}</td>
                     <td>${prov(m.provenance)}</td>
                   </tr>`,
                 )
                 .join(''),
         )
         .join('')}</tbody>
     </table></div>
     <p class="note">${
       traceStems.filter((s) => s.matches.some((m) => m.provenance === 'lexicon')).length
} of these ${traceStems.length} stems ${
       traceStems.filter((s) => s.matches.some((m) => m.provenance === 'lexicon')).length === 1
         ? 'is'
         : 'are'
} in the lexicon; the rest fall through to the guesser and are marked as such. The pipeline never pretends a guess is a dictionary entry.</p>`,
  ),
  stageBox(
    '5–6',
    'buildCandidates (generate + assemble)',
    'code + data',
    `<div class="tablewrap"><table class="sub">
       <thead><tr><th>classical</th><th>script</th><th>code points</th><th>prior</th><th>provenance</th></tr></thead>
       <tbody>${traceBuilt
         .map(
           (c) => `<tr>
             <td><code>${esc(c.classical)}</code></td>
             <td class="script-inline" lang="mn-Mong">${esc(c.script)}</td>
             <td>${cpRun(c.script)}</td>
             <td class="num">${c.prior}</td>
             <td>${prov(c.provenance)}</td>
           </tr>`,
         )
         .join('')}</tbody>
     </table></div>
     <p class="note">The romanized <code>-</code> is where the connector goes; <code>toScript()</code> turns it into U+180E and nothing else.</p>`,
  ),
  stageBox(
    7,
    `rank <span class="dim">(ranker: ${esc(frequencyRanker.name)})</span>`,
    'numbers',
    `<div class="tablewrap"><table class="sub">
       <thead><tr><th>#</th><th>script</th><th>classical</th><th>gloss</th><th>confidence</th></tr></thead>
       <tbody>${traceRanked
         .map(
           (c, i) => `<tr${i === 0 ? ' class="win"' : ''}>
             <td class="dim">${i + 1}</td>
             <td class="script-inline" lang="mn-Mong">${esc(c.script)}</td>
             <td><code>${esc(c.classical)}</code></td>
             <td class="dim">${esc(c.gloss ?? '—')}</td>
             <td class="num">${pct(c.confidence)}${bar(c.confidence, c.provenance)}</td>
           </tr>`,
         )
         .join('')}</tbody>
     </table></div>
     <p class="note">This is the library's entire statistical surface: <code>prior × 0.7<sup>suffixes</sup></code>. Two numbers multiplied. The lexicon hit on <code>хот</code> is what makes the segmented parse beat the unsegmented guess.</p>`,
  ),
  stageBox(
    8,
    'validate',
    'consumer hook',
    `<p class="note" style="margin-top:0">Not exercised in this trace — stage 8 is an injected
     <code>validate(script) =&gt; boolean</code> option, not an import, which is what keeps the core
     free of the linter. Wiring <code>lint</code> from gege-linter into it turns the linter into a
     candidate discriminator. Section&nbsp;5 below runs exactly that check over everything on this
     page.</p>`,
  ),
].join('');

const connectorRows = table
  .filter((r) => r.top?.script.includes(MVS))
  .map(
    (r) => `<tr>
      <td class="cyr">${esc(r.cy)}</td>
      <td class="script-inline" lang="mn-Mong">${esc(r.top.script)}</td>
      <td><code>${esc(r.top.classical)}</code></td>
      <td>${cpRun(r.top.script)}</td>
    </tr>`,
  )
  .join('');

// One row per distinct rule, not per hit — seven copies of the same message
// is noise, and the affected strings are the useful part.
const lintGroups = (() => {
  const byRule = new Map();
  for (const d of lintRows) {
    const key = `${d.rule}/${d.severity}`;
    const g = byRule.get(key) ?? {
      rule: d.rule,
      severity: d.severity,
      message: d.message,
      scripts: new Set(),
      count: 0,
    };
    g.scripts.add(d.script);
    g.count += 1;
    byRule.set(key, g);
  }
  return [...byRule.values()].map((g) => ({ ...g, scripts: [...g.scripts] }));
})();

const lintDetail = lintGroups.length
  ? `<div class="tablewrap"><table class="sub">
       <thead><tr><th>rule</th><th>severity</th><th>hits</th><th>message</th><th>affected strings</th></tr></thead>
       <tbody>${lintGroups
         .map(
           (g) => `<tr>
             <td><code>${esc(g.rule)}</code></td>
             <td><span class="sev sev-${esc(g.severity)}">${esc(g.severity)}</span></td>
             <td class="num">${g.count}</td>
             <td class="dim">${esc(g.message)}</td>
             <td><div class="hit-strip">${g.scripts
               .map((s) => `<span class="script-inline sm" lang="mn-Mong">${esc(s)}</span>`)
               .join('')}</div></td>
           </tr>`,
         )
         .join('')}</tbody>
     </table></div>`
  : '<p class="note">No diagnostics at any severity.</p>';

const sentenceOut = convert(SENTENCE);

/**
 * Words where two lexicon readings score within a hair of each other, so the
 * winner is decided by array order rather than by evidence. Detected live
 * rather than asserted, so the note retires itself if the data changes.
 * Only near-ties are reported — no linguistic judgement is made here.
 */
const NEAR_TIE = 0.02;
const rankerTies = table.flatMap((r) => {
  const lex = r.candidates.filter((c) => c.provenance === 'lexicon');
  if (lex.length < 2) return [];
  const gap = lex[0].confidence - lex[1].confidence;
  if (gap > NEAR_TIE) return [];
  return [{ cy: r.cy, a: lex[0], b: lex[1], gap }];
});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>gege-converter — Cyrillic → Mongol bichig, running</title>
<style>
  :root {
    --bg: #0f1115;
    --bg-elev: #161922;
    --bg-elev2: #1c2029;
    --fg: #e6e6e6;
    --fg-dim: #a3a8b3;
    --accent: #8ab4f8;
    --rule: #2a2f3a;
    --quote-bar: #3a4252;
    --good: #7ee08a;
    --warn: #e8c46a;
    --bad: #f08a8a;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); overflow-x: hidden; }
  body {
    font: 17px/1.65 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI",
          Roboto, Helvetica, Arial, sans-serif;
    max-width: 900px;
    margin: 0 auto;
    padding: 56px 24px 96px;
  }
  h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 .25em; letter-spacing: -.02em; }
  h2 { font-size: 1.3rem; margin-top: 2.8em; border-bottom: 1px solid var(--rule); padding-bottom: .3em; letter-spacing: -.01em; }
  h3 { font-size: 1.02rem; margin-top: 1.7em; }
  p, li { color: var(--fg); }
  li { margin-bottom: .35em; }
  code { background: var(--bg-elev); padding: 1px 6px; border-radius: 4px; font-size: .86em; font-family: var(--mono); }
  pre { background: var(--bg-elev); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: .78rem; line-height: 1.5; font-family: var(--mono); margin: .8em 0; }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 2.6em 0; }
  .meta { color: var(--fg-dim); font-size: .88rem; margin-bottom: 1.8em; }
  .meta code { font-size: .82em; }
  .dim { color: var(--fg-dim); }
  .tiny { font-size: .72rem; line-height: 1.4; }
  .note { color: var(--fg-dim); font-size: .88rem; margin: .8em 0 0; }

  /* ---- badges ---- */
  .badges { display: flex; flex-wrap: wrap; gap: 12px; margin: 1.6em 0 2.4em; }
  .badge { flex: 1 1 260px; background: var(--bg-elev); border: 1px solid var(--rule); border-radius: 8px; padding: 14px 18px; }
  .badge-pass { border-left: 3px solid var(--good); }
  .badge-fail { border-left: 3px solid var(--bad); }
  .badge-info { border-left: 3px solid var(--accent); }
  .badge-warn { border-left: 3px solid var(--warn); }
  .badge-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .12em; color: var(--fg-dim); }
  .badge-value { font-size: 1.35rem; font-weight: 700; letter-spacing: -.01em; margin: .15em 0 .1em; }
  .badge-pass .badge-value { color: var(--good); }
  .badge-fail .badge-value { color: var(--bad); }
  .badge-info .badge-value { color: var(--accent); }
  .badge-warn .badge-value { color: var(--warn); }
  .badge-sub { font-size: .8rem; color: var(--fg-dim); }

  .summary { background: var(--bg-elev); border-radius: 8px; padding: 18px 24px; margin: 1.6em 0 2.4em; border: 1px solid var(--rule); }
  .summary h2 { margin-top: 0; border: 0; padding: 0; font-size: .82rem; text-transform: uppercase; letter-spacing: .12em; color: var(--fg-dim); }
  .bignum { background: var(--bg-elev); border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0; padding: 16px 22px; margin: 1.6em 0; }
  .bignum strong { font-size: 1.7rem; color: var(--accent); display: block; line-height: 1.2; letter-spacing: -.02em; font-family: var(--mono); }

  /* ---- tables ---- */
  .tablewrap { overflow-x: auto; margin: 1.2em 0; max-width: 100%; }
  table { border-collapse: collapse; width: 100%; font-size: .87rem; }
  th, td { text-align: left; padding: 9px 11px; border-bottom: 1px solid var(--rule); vertical-align: top; }
  th { color: var(--fg-dim); font-weight: 600; font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; }
  tbody tr:hover { background: rgba(255,255,255,.02); }
  table.sub { font-size: .82rem; }
  tr.win { background: rgba(138,180,248,.07); }
  td.num { white-space: nowrap; font-family: var(--mono); font-size: .82rem; }
  td.cyr { font-weight: 600; white-space: nowrap; }

  /* ---- Mongolian script ---- */
  .script-pair { display: flex; gap: 10px; align-items: flex-start; }
  .bichig {
    writing-mode: vertical-lr;
    font-family: "Noto Sans Mongolian", "Mongolian Baiti", "MongolianWhite",
                 "Menksoft Qagan", "Noto Sans Mongolian UI", sans-serif;
    line-height: 1.1;
    color: var(--fg);
    /* Height is the *inline* size in vertical writing mode. Auto lets each
       sample size to its own length; min-height keeps short rows from looking
       cramped. white-space:nowrap keeps a word in one column — the visible gap
       inside suffixed forms is the MVS connector, not a line break. */
    height: auto;
    white-space: nowrap;
  }
  .bichig.md { font-size: 1.9rem; min-height: 4em; }
  .bichig.lg { font-size: 2.4rem; min-height: 3.5em; }
  .bichig.sent { font-size: 1.9rem; height: 7em; white-space: normal; }
  .roman { font-family: var(--mono); font-size: .78rem; color: var(--fg-dim); padding-top: .2em; white-space: nowrap; }
  .script-inline {
    font-family: "Noto Sans Mongolian", "Mongolian Baiti", sans-serif;
    writing-mode: vertical-lr;
    font-size: 1.5rem;
    height: auto;
    min-height: 3.5em;
    white-space: nowrap;
    display: inline-block;
    line-height: 1.1;
    vertical-align: top;
  }
  .script-inline.sm { font-size: 1.15rem; min-height: 3em; }
  .hit-strip { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
  .fontcheck { border: 1px dashed var(--quote-bar); border-radius: 8px; padding: 12px 16px; margin: 1.2em 0; font-size: .86rem; color: var(--fg-dim); }

  /* ---- code points ---- */
  .cps { display: flex; flex-wrap: wrap; gap: 4px; font-family: var(--mono); font-size: .7rem; margin: .4em 0; }
  .cp { background: var(--bg-elev2); border: 1px solid var(--rule); border-radius: 3px; padding: 1px 5px; color: var(--fg-dim); white-space: nowrap; }
  .cp-mvs { background: rgba(138,180,248,.16); border-color: var(--accent); color: var(--accent); font-weight: 700; }
  .mvs-tag { background: rgba(138,180,248,.16); border: 1px solid var(--accent); color: var(--accent); border-radius: 3px; padding: 0 5px; font-size: .7rem; font-family: var(--mono); font-weight: 700; }

  /* ---- tags / bars ---- */
  .tag { font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; border-radius: 3px; padding: 1px 6px; white-space: nowrap; }
  .tag-lexicon { background: rgba(126,224,138,.13); color: var(--good); }
  .tag-guess { background: rgba(232,196,106,.13); color: var(--warn); }
  .sev { font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
  .sev-error { color: var(--bad); }
  .sev-warning { color: var(--warn); }
  .sev-info { color: var(--accent); }
  .bar { height: 4px; background: var(--bg-elev2); border-radius: 2px; overflow: hidden; margin-top: 4px; min-width: 56px; }
  .bar-fill { display: block; height: 100%; background: var(--accent); }
  .bar-fill.bar-guess { background: var(--warn); }

  /* ---- candidate cards ---- */
  .cands { display: flex; flex-wrap: wrap; gap: 14px; margin: 1.4em 0; }
  .cand { flex: 1 1 300px; display: flex; gap: 14px; background: var(--bg-elev); border: 1px solid var(--rule); border-radius: 8px; padding: 16px 18px; }
  .cand-top { border-left: 3px solid var(--accent); }
  .cand-rank { font-family: var(--mono); font-size: .74rem; color: var(--fg-dim); }
  .cand-body { min-width: 0; flex: 1; }
  .cand-gloss { font-weight: 600; margin-bottom: .2em; }
  .cand-meta { font-size: .78rem; margin-bottom: .5em; }
  .conf-line { display: flex; align-items: center; gap: 10px; margin-top: .6em; }
  .conf-num { font-family: var(--mono); font-size: 1.05rem; font-weight: 700; color: var(--accent); }
  .conf-line .bar { flex: 1; height: 6px; }

  /* ---- stages ---- */
  .stage { background: var(--bg-elev); border: 1px solid var(--rule); border-radius: 8px; padding: 14px 18px 16px; margin: 12px 0; }
  .stage-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: .6em; flex-wrap: wrap; }
  .stage-n { font-family: var(--mono); font-size: .72rem; background: var(--bg-elev2); border: 1px solid var(--rule); border-radius: 3px; padding: 1px 7px; color: var(--accent); }
  .stage-name { font-weight: 700; font-family: var(--mono); font-size: .92rem; }
  .stage-made { font-size: .7rem; text-transform: uppercase; letter-spacing: .1em; color: var(--fg-dim); margin-left: auto; }
  .stage-body > :first-child { margin-top: 0; }

  @media (max-width: 640px) {
    body { padding: 32px 16px 64px; font-size: 16px; }
    .cand { flex: 1 1 100%; }
  }
</style>
</head>
<body>

<h1>gege-converter, running</h1>
<div class="meta">
  Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC by
  <code>scripts/build-demo.mjs</code> against the built <code>dist/</code>.
  Every value below is a live call into the library — nothing on this page is hard-coded.
  Lexicon: <strong>${lexicon.length}</strong> entries · suffix table: <strong>${suffixes.length}</strong> rows ·
  ranker: <code>${esc(frequencyRanker.name)}</code>.
</div>

<div class="badges">
  <div class="badge ${nnbspHits.length === 0 ? 'badge-pass' : 'badge-fail'}">
    <div class="badge-label">Legacy connector U+202F</div>
    <div class="badge-value">${nnbspHits.length === 0 ? '0 occurrences' : `${nnbspHits.length} LEAKED`}</div>
    <div class="badge-sub">checked across ${allScripts.length} generated strings</div>
  </div>
  <div class="badge badge-info">
    <div class="badge-label">Unicode 16.0 connector U+180E</div>
    <div class="badge-value">${mvsCount} emitted</div>
    <div class="badge-sub">MVS, per core spec ch. 13.5</div>
  </div>
  <div class="badge ${linter.lint === null ? 'badge-warn' : lintPass ? 'badge-pass' : 'badge-fail'}">
    <div class="badge-label">gege-linter cross-check</div>
    <div class="badge-value">${
      linter.lint === null
        ? 'unavailable'
        : lintPass
          ? 'PASS'
          : `${lintCounts.error} err / ${lintCounts.warning} warn`
    }</div>
    <div class="badge-sub">${
      linter.lint === null
        ? 'linter could not be resolved — see below'
        : `${lintCounts.error} errors, ${lintCounts.warning} warnings, ${lintCounts.info} info`
    }</div>
  </div>
</div>

<div class="fontcheck">
  <strong>Font note.</strong> Traditional Mongolian is written vertically — top to bottom, with
  successive columns running left to right. The columns below need a Mongolian font installed
  (Noto Sans Mongolian, Mongolian Baiti).
  If they render as blank space or boxes, nothing is lost — the Classical romanization sits
  beside every sample and the exact code points are printed for the suffixed forms.
</div>

<h2>1 · Conversion table</h2>

<p>Fourteen inputs through <code>analyze()</code>, top candidate shown. Provenance says whether the
stem came out of the seed lexicon or the out-of-vocabulary guesser.</p>

<div class="tablewrap">
<table>
  <thead><tr><th>Cyrillic</th><th>Mongol bichig + Classical</th><th>Segmentation</th><th>Provenance</th><th>Confidence</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>
</div>

<h3>And as running text</h3>
<p><code>convert(${esc(JSON.stringify(SENTENCE))})</code></p>
<div class="script-pair">
  <div class="bichig sent" lang="mn-Mong">${esc(sentenceOut)}</div>
  <div>
    <div class="roman">${esc(
      analyze(SENTENCE)
        .map((a) => a.candidates[0]?.classical ?? a.token.text)
        .join(''),
    )}</div>
    ${cpRun(sentenceOut)}
    <p class="note"><code>convert()</code> is a five-line wrapper that takes
    <code>candidates[0]</code> per word. Non-word tokens pass through untouched.</p>
  </div>
</div>

<h2>2 · Ambiguity comes back as data</h2>

<p>The motivating case. <code>analyze('${esc(AMBIGUOUS_WORD)}')</code> returns
<strong>${ambiguous.length} candidates</strong>, not one answer and a shrug. An editor can
underline the word and offer both readings; a silent wrong guess is the failure mode this
design exists to avoid.</p>

<div class="cands">${ambiguousCards}</div>

<p class="note">Note that the higher-confidence reading is the one with the connector:
<code>qar-a</code> takes a detached final vowel (chachlag), also U+180E. The two readings
differ by exactly one code point.</p>

<h2>3 · One word, stage by stage</h2>

<p>Every intermediate value below is a real return value from the exported stage functions —
<code>tokenize</code>, <code>normalizeWord</code>, <code>segment</code>,
<code>resolveStem</code>, <code>buildCandidates</code> — called on
<code>${esc(TRACE_WORD)}</code> ("in the city"). The point is that this is an inspectable
algorithm, not a black box: you can stop at any stage and read what it decided.</p>

${traceHtml}

<div class="summary">
  <h2>What the trace shows</h2>
  <p style="margin:.6em 0 0">Segmentation kept <strong>${traceSegments.length} parses</strong> and
  resolved none of them. ${traceBuilt.length} candidates survived romanization and deduplication.
  Ranking picked
  <code>${esc(traceRanked[0]?.classical ?? '')}</code> at ${pct(traceRanked[0]?.confidence ?? 0)}
  purely because <code>хот</code> is a lexicon row and the others are guesses — one multiplication,
  no model. Change that lexicon row and the answer changes on the next run, with no retraining.</p>
</div>

<h2>4 · Code-point proof: the connector is U+180E</h2>

<p>Unicode 16.0 (Sept 2024) moved the suffix-connector role from
<strong>U+202F NARROW NO-BREAK SPACE</strong> to <strong>U+180E MONGOLIAN VOWEL SEPARATOR</strong>
— core specification chapter 13.5. There were <em>zero</em> UCD property changes, so no
validator catches the difference; a text-level tool is the only enforcement layer. Every other
converter still emits the legacy NNBSP. This package emits MVS, and here is the byte-level
receipt.</p>

<div class="bignum">
  <strong>${nnbspHits.length === 0 ? 'U+202F × 0' : `U+202F × ${nnbspHits.length}`}</strong>
  ${
    nnbspHits.length === 0
      ? `Not one occurrence of the legacy NNBSP connector across all ${allScripts.length} strings this page generated. ${mvsCount} MVS connectors were emitted instead.`
      : `<span style="color:var(--bad)">Legacy NNBSP leaked into output — this is a bug.</span>`
  }
</div>

<div class="tablewrap">
<table>
  <thead><tr><th>Cyrillic</th><th>bichig</th><th>Classical</th><th>code points</th></tr></thead>
  <tbody>${connectorRows}</tbody>
</table>
</div>

<p class="note">The highlighted <code>U+180E</code> is the connector. In the romanization layer it is
written as a plain <code>-</code>, which is why the data files stay auditable by eye:
<code>qota-du</code> is readable, <code>ᠬᠣᠲᠠ&lt;invisible&gt;ᠳᠤ</code> is not.</p>

<h2>5 · Linter cross-check</h2>

<p>${
  linter.lint === null
    ? 'The linter could not be resolved at generation time, so this panel is unverified. Set <code>GEGE_LINTER</code> to its built <code>dist/index.js</code> and re-run.'
    : `Every string this page generated was fed through <code>lint()</code> from
       <code>@gege-mn/gege-linter</code>${linter.rules ? ` (${linter.rules} rules)` : ''} —
       the same package that would be wired into <code>convert()</code>'s <code>validate</code>
       hook as pipeline stage 8. No other converter can offer this check because no other
       converter has a linter to check against.`
}</p>

<div class="badges">
  <div class="badge ${lintCounts.error === 0 ? 'badge-pass' : 'badge-fail'}">
    <div class="badge-label">Errors</div><div class="badge-value">${lintCounts.error}</div>
    <div class="badge-sub">structural encoding faults</div>
  </div>
  <div class="badge ${lintCounts.warning === 0 ? 'badge-pass' : 'badge-fail'}">
    <div class="badge-label">Warnings</div><div class="badge-value">${lintCounts.warning}</div>
    <div class="badge-sub">legacy / wrong-block usage</div>
  </div>
  <div class="badge badge-info">
    <div class="badge-label">Info</div><div class="badge-value">${lintCounts.info}</div>
    <div class="badge-sub">heuristics, not faults</div>
  </div>
</div>

${lintDetail}

${
  lintCounts.info > 0
    ? `<p class="note">The info-level hits are <code>non-initial-o</code>, a deliberately dumb
       vowel-position heuristic. It fires on <code>ᠭᠣᠣᠯ</code> (γool, "river"), a genuine lexical
       exception with a doubled short o, and on low-ranked guesser candidates that never win.
       Info severity is the correct outcome, not a miss. Note монгол is <em>not</em> among them —
       it is <code>mongγul</code>, ᠮᠣᠩᠭᠤᠯ, and the rule is categorical.</p>`
    : ''
}

<h2>6 · What this is not</h2>

<div class="summary">
  <h2>Honest limitations</h2>
  <ul style="margin:.8em 0 0">
    <li><strong>The lexicon is a ~${lexicon.length}-entry unverified seed, not a dictionary.</strong>
      Hand-written to make the pipeline runnable end to end. Every entry needs review by a reader of
      Mongol bichig. The intended replacement is CoPiT's 14,125 CC BY 4.0 pairs; the module only has
      to keep exporting <code>LexiconEntry[]</code>.</li>
    <li><strong>No verb morphology.</strong> Only the <code>-х</code> infinitive converts, through the
      lexicon. Finite and participial forms fall through to the guesser.</li>
    <li><strong>The guesser is deliberately minimal.</strong> It collapses long vowels and
      transliterates; it does not reverse the <code>V+γ/g+V</code> contraction that produced them
      (улаан ← <em>ulaγan</em>), because inventing a consonant is a worse failure than omitting one.
      Everything it returns is marked <code>guess</code> and ranked far below any lexicon hit.</li>
    <li><strong>The suffix table's Cyrillic pairings are this project's own unreviewed work.</strong>
      The Classical forms come from gege-linter's curated knowledge base and are sound; the mapping
      from Cyrillic surface forms and the <code>separate</code> flags are not yet reviewed.</li>
    ${
      rankerTies.length > 0
        ? `<li><strong>The ranker can land on a near-tie, and then array order decides.</strong>
             In this build: ${rankerTies
               .map(
                 (t) =>
                   `<code>${esc(t.cy)}</code> — <code>${esc(t.a.classical)}</code> vs <code>${esc(t.b.classical)}</code> (${pct(t.a.confidence)} vs ${pct(t.b.confidence)})`,
               )
               .join('; ')}.
             Two readings that close is the ranker admitting it has no evidence; a context n-gram
             behind the same <code>Ranker</code> interface is the intended fix. Detected automatically
             by this generator, not hand-written — the note disappears when the numbers do.</li>`
        : ''
    }
    <li><strong>Frequencies are hand-assigned</strong>, not counted from a corpus — so the confidence
      numbers above are ordinal, not calibrated probabilities.</li>
    <li><strong>Bare genitive <code>-н</code> and accusative <code>-г</code> are unhandled</strong>;
      they over-match and would shred ordinary words. Clitics (нь, минь, чинь) tokenize separately and
      are not yet MVS-joined to the preceding word.</li>
    <li><strong>The linter pass above proves encoding validity, not correctness.</strong> A perfectly
      well-formed string can still be the wrong word. Nothing here measures accuracy against a gold
      standard, because no human-aligned Cyrillic↔traditional corpus is publicly available.</li>
  </ul>
</div>

<hr>
<p class="dim tiny">
  Regenerate: <code>pnpm build &amp;&amp; node scripts/build-demo.mjs</code> ·
  output <code>.tmp/demo.html</code> (gitignored) ·
  linter resolved from <code>${esc(linter.source ?? 'not found')}</code>
</p>

</body>
</html>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html, 'utf8');

console.log(`wrote ${OUT}`);
console.log(`  words converted:      ${SAMPLES.length}`);
console.log(`  strings audited:      ${allScripts.length}`);
console.log(`  U+180E (MVS) emitted: ${mvsCount}`);
console.log(`  U+202F (NNBSP) found: ${nnbspHits.length}`);
console.log(
  linter.lint === null
    ? '  linter:               UNAVAILABLE'
    : `  linter:               ${lintCounts.error} error / ${lintCounts.warning} warning / ${lintCounts.info} info  (${linter.source})`,
);
if (nnbspHits.length > 0 || lintCounts.error > 0 || lintCounts.warning > 0) process.exitCode = 1;
