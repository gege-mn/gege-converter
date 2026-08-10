<!--
Converted to Markdown 2026-07-26 from converter-architecture.html, which was
generated 2026-07-25/26 and had been living in gege-linter's gitignored
.tmp/ — unversioned, while being cited by committed files. The HTML original
is not authoritative; this file is.
-->

# What are we actually building?

Companion to the landscape report · 2026-07-26

An *algorithm* with dictionaries.
Not a model.

Closer to a spell checker than to ChatGPT. Roughly 95% deterministic code + lookup tables, 5% counted numbers. There is no neural network anywhere in it, and nothing gets "trained."

## Concretely: what's inside the npm package

```
gege-convert/
├── src/                    ~2,000 lines of plain TypeScript
│   ├── tokenize.ts         pure functions
│   ├── segment.ts          pure functions
│   ├── generate.ts         pure functions
│   └── rank.ts             pure functions
├── data/
│   ├── lexicon.json        ~17,000 stem pairs      (facts)
│   ├── suffixes.json       ~200 suffix forms       (facts)
│   └── frequency.json      ~2,000 numbers          (counts)
└── package.json            zero dependencies

total: ~3 MB · runs in a browser · no network · no weights · no inference
```

You can open every file and read it. You can `git diff` a behaviour change. If a word converts wrong, you edit one row of one JSON file and ship — no retraining, no GPU, nothing to re-download.

## The two things it is not

|  | What we're building | What a "model" would be |
|---|---|---|
| Ships as | TypeScript + JSON | ONNX runtime + weight file |
| Size | ~3 MB | 50–500 MB |
| Same input twice | Always identical output | Usually identical |
| Fixing one wrong word | Edit a row, ship in 5 min | Retrain, hope nothing else broke |
| "Why did it output that?" | Trace 8 named stages | Nobody can say |
| When it's wrong, it looks | Flagged, low-confidence | Confident and plausible |
| Tests | Unit test per rule, per word | One aggregate accuracy score |
| Runs offline in a browser | Yes, trivially | Only with real effort |

That last-but-one row is the one that matters most for you. Your users mostly **cannot read bichig well enough to check the output** — that's why the product exists. A tool that fails confidently is worse for them than one that fails loudly.

## The pipeline, stage by stage

Each stage is tagged by what it's made of. Notice that exactly one stage out of eight involves anything statistical.

1**Tokenize**Split text into words, punctuation, numbers, Latin.code

2**Normalize Cyrillic**Case, е/ё, ь/ъ handling.code

3**Segment into stem + suffix chain**Peel suffixes off the end. Keeps *all* possible splits, not just one.code data

4**Look up the stem**Dictionary hit → the known Classical form. Miss → rule-based guess, marked low-confidence.data code

5**Generate the suffixes**Classical form of each suffix, correct vowel harmony, correct connector (MVS).code data

6**Assemble candidates**Combine stem options × suffix options. Usually 1, sometimes 2–3.code

7**Rank them**Which candidate is most likely? ← **the only statistical stage**numbers

8**Validate with gege-linter**Throw away any candidate that produces malformed Unicode.code

## So where do "statistics" come in? Stage 7, and it's tiny

This is the bit that confuses people, because "statistical model" sounds like a neural network. Here is literally what stage 7 is:

```
// data/frequency.json
{
  "хар": [
    { "classical": "qar-a", "gloss": "black",    "freq": 0.71 },
    { "classical": "qara",  "gloss": "to see",   "freq": 0.29 }
  ]
}
```

Illustrative numbers — the real ones get counted from a corpus.

**That's the whole "model".** A number next to each dictionary entry saying "this one is more common." Exactly what a paper dictionary does when it lists the most frequent meaning first.

Yes, technically that makes it a statistical model. No, it is not the thing you were worried about. It's a JSON file you can open and hand-edit.

Later you can make stage 7 smarter — score candidates against the surrounding words instead of just their overall frequency. That's still just counting, still just a JSON file, still zero dependencies. The published ceiling for this kind of context scoring on ambiguous Mongolian words is **87.66% correct**, and it was reached with a plain n-gram counter, not a neural net.

## "Or something in between?" — yes, but 95/5

You asked whether it's algorithm, model, or in-between. Honest answer: in-between, but so lopsided that calling it an algorithm is the right description.

**The seam is stage 7, and only stage 7.** It's an interface:

```
interface Ranker {
  score(candidate: Candidate, context: Token[]): number
}
```

Version 1 is a frequency lookup. Version 2 could be an n-gram counter. Version 3 could — if you ever want it — be a neural model or an LLM call, as an *optional plugin* that people install separately.

**Stages 1–6 and 8 never change.** They're the actual library, and they're pure code and facts.

That's why this isn't a decision you have to get right now. You're building the deterministic part, which is 95% of the work and 100% of the correctness guarantees. Whether stage 7 ever becomes fancy is a question for a year from now, and it changes one file.

## What the library hands back

The single most important API decision, and the reason ambiguity stops being scary:

```
convert("хар морь")
// → "ᠬᠠᠷ᠎ᠠ ᠮᠣᠷᠢ"          convenience: just take the top pick

analyze("хар морь")
// → [
//     { token: "хар",  candidates: [
//         { form: "qar-a", gloss: "black",  confidence: 0.71 },
//         { form: "qara",  gloss: "to see", confidence: 0.29 }
//       ] },
//     { token: "морь", candidates: [
//         { form: "mori", confidence: 0.98 }
//       ] }
//   ]
```

`analyze()` is the real function. `convert()` is a one-line wrapper over it. Ambiguity comes back as **data**, not as a wrong answer — so the editor UI can underline "хар" and offer both readings, exactly like gege-linter offers fixes today. Same mental model, same shape, reused.

## The one-paragraph version

You're building a **dictionary-and-rules engine**: pure TypeScript that peels Mongolian words apart, looks their pieces up in tables, reassembles them in Classical spelling with correct Unicode, and returns every plausible answer ranked by a frequency count. It's the same species of thing as a spell checker or a compiler — deterministic, inspectable, testable, offline, MIT. Nothing is trained. The only place a machine-learned model could ever live is one pluggable scoring function, and you don't need it to ship.

Design precedent: Inner Mongolia University patented this exact three-stage shape in 2014 (lexicon+rules → statistical fallback for unknown words → frequency ranking for ambiguity) and kept it after publishing their Transformer work in 2022. You'd be following the most experienced group in the field, not diverging from them.
