/**
 * Score what the pipeline can DERIVE, not what it has memorised.
 *
 * The two gold fixtures are the silver's own answers for words
 * that are, many of them, common in running text — манай, билээ, эхний. The
 * `attested` tier stores whole words from that same source, so with the tier
 * live a gold form can be answered from memory and the fixture stops measuring
 * segment + resolve + generate, which is the only thing it exists to measure.
 *
 * Two ways out. Withholding every gold word from the tier keeps the fixture
 * honest and leaves ~700 common words converting wrongly for good. Emptying the
 * tier while the fixture is scored keeps the fixture exactly as honest and
 * costs the shipped package nothing. This is the second: the tier's index is a
 * live `Map`, so it is emptied in memory for the duration and put back.
 *
 * ⚠ Anything that scores a gold fixture must go through this, or its number
 * quietly becomes a memory test. Scores over running text, the reader's
 * rulings and `attested-heldout.json` must NOT — those measure the converter a
 * user gets, tier included.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Empty the attested tier; returns a function that puts every row back. */
export async function emptyAttested(root) {
  const { attestedIndex } = await import(
    pathToFileURL(resolve(root, 'dist/data/attested-forms.js')).href
  );
  const saved = [...attestedIndex];
  attestedIndex.clear();
  return () => {
    for (const [cyrillic, readings] of saved) attestedIndex.set(cyrillic, readings);
  };
}
