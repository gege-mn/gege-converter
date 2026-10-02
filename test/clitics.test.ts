/**
 * The directive written attached, and the words that must survive it.
 *
 * A bichig reader ruled on 2026-07-30 that -руу/-рүү/-луу/-лүү is always a
 * separate word in bichig and always `uruγu`, while Cyrillic accepts either
 * spelling. So the two spellings must converge on identical output — that is
 * the property worth testing, more than any particular string.
 *
 * The other half is what the split must NOT touch. Real words end in these
 * letters, and a rule keyed on the ending alone would shred all of them.
 */

import { describe, expect, it } from 'vitest';
import { analyze, convert, MVS, NNBSP, splitClitics, tokenize } from '../src/index.js';

describe('the attached directive', () => {
  // The reader's own examples, 2026-07-30. Both spellings are accepted
  // Cyrillic and both are one bichig phrase, so equality is the test.
  it.each([
    ['гэрлүү', 'гэр лүү'],
    ['айлруу', 'айл руу'],
    ['цэрэгрүү', 'цэрэг рүү'],
    ['нуурлуу', 'нуур луу'],
    ['монголруу', 'монгол руу'],
  ])('%s converges on %s', (attached, separated) => {
    expect(convert(attached)).toBe(convert(separated));
  });

  it('emits two bichig words joined by a plain space, not a connector', () => {
    const out = convert('монголруу');
    expect(out.split(' ')).toHaveLength(2);
    expect(out).not.toContain(MVS);
    expect(out).not.toContain(NNBSP);
  });

  it('does not harmonise — one Classical form for all four surfaces', () => {
    const directive = convert('монгол руу').split(' ')[1];
    for (const phrase of ['гэр лүү', 'айл руу', 'цэрэг рүү', 'нуур луу']) {
      expect(convert(phrase).split(' ')[1]).toBe(directive);
    }
  });

  // The л-forms attach only after р, the р-forms only otherwise. монголлуу is
  // not a spelling anyone writes, so it must not be read as монгол + directive.
  it('refuses the л-form after a host that does not end in р', () => {
    expect(splitClitics(tokenize('монголлуу'))).toHaveLength(1);
  });
});

describe('words the split must leave alone', () => {
  // Every one of these is an ordinary word that happens to end in the same
  // letters, and each is attested in the harvest with its own reading.
  it.each(['буруу', 'хуруу', 'нуруу', 'яруу', 'тогоруу', 'эрүү', 'бяруу'])(
    'leaves %s as one word',
    (word) => {
      expect(splitClitics(tokenize(word))).toHaveLength(1);
      expect(convert(word)).not.toContain(' ');
    },
  );

  // луу is the one directive surface with a lexical homograph — the dragon.
  // The postposition never inflects, so every suffixed form is the dragon,
  // and curating the directive alone at freq 1 broke 23 gold forms of it.
  it('leaves луу the dragon alone, bare and inflected', () => {
    expect(splitClitics(tokenize('лууг'))).toHaveLength(1);
    expect(convert('луунуудаараа')).not.toContain(' ');
    expect(convert('луу')).not.toBe(convert('монгол руу').split(' ')[1]);
  });
});

describe('token offsets after a split', () => {
  it('still tile the input contiguously', () => {
    const tokens = splitClitics(tokenize('монголруу'));
    expect(tokens).toHaveLength(3);
    expect(tokens.map((t) => [t.start, t.end])).toEqual([
      [0, 6],
      [6, 6],
      [6, 9],
    ]);
  });

  it('carries the space as an inserted character over an empty span', () => {
    const [, space] = splitClitics(tokenize('монголруу'));
    expect(space).toMatchObject({ kind: 'space', text: ' ', start: 6, end: 6 });
  });

  it('returns the stream untouched when nothing splits', () => {
    const tokens = tokenize('монгол бичиг');
    expect(splitClitics(tokens)).toEqual([...tokens]);
  });
});

describe('the negative, with a case after it', () => {
  it('splits the host off and leaves the ending on үгүй', () => {
    // төлбөргүйгээр is `tölbüri` + `ügei-ber`. Marked wrong by a reader on
    // 2026-10-02, when only a word-final -гүй was split.
    const words = (text: string) =>
      analyze(text)
        .filter((t) => t.token.kind === 'word')
        .map((t) => t.candidates[0]?.classical);
    expect(words('төлбөргүйгээр')[1]).toBe('üγei-ber');
    expect(words('болохгүйг')[1]).toBe('üγei-yi');
    expect(words('аюулгүйн')[1]).toBe('üγei-yin');
    expect(words('хэрэггүйгээ')[1]).toBe('üγei-ben');
  });

  it('leaves a lexicalised -гүй word whole under the same endings', () => {
    // бүсгүй is a woman, not "without a belt".
    expect(analyze('бүсгүйн').filter((t) => t.token.kind === 'word')).toHaveLength(1);
    expect(analyze('бүсгүйгээс').filter((t) => t.token.kind === 'word')).toHaveLength(1);
  });

  it('does not take a derivation for a case', () => {
    // -гүйдэл and -гүйчүүд form words; they are not endings on үгүй.
    expect(analyze('нойргүйдэл').filter((t) => t.token.kind === 'word')).toHaveLength(1);
  });
});
