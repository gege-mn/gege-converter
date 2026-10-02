/**
 * Read one silver row's script, normalised the way its repair needs.
 *
 * `.tmp/harvest-harvest.jsonl` and `.tmp/harvest-sentences.jsonl` hold
 * `{cyrillic, unicode}` rows, and `unicode` has had its ENCODING repaired but
 * not its orthography. There have been two repairs, and they leave a medial
 * `V + YA + I` meaning different things:
 *
 * - **the old one** (gege-linter's mechanical fixes) swapped the two the silver
 *   letters and the connector and nothing else, so `V + YA + I` is still the
 *   diphthong and `normalizeOrthography` has to drop the YA;
 * - **`tungaamalToUnicode`** resolves the diphthong itself, and what it leaves
 *   as `V + YA + I` is the consonantal y — хаяг `qayiγ` — which
 *   `normalizeOrthography` would wrongly collapse.
 *
 * A row says which it is: `repair: 'tungaamal'` for the second, nothing for the
 * first. Every script that reads a silver row goes through here, so an
 * old-format file on another machine keeps meaning what it meant.
 */

const ORTHOGRAPHY = new URL('../../dist/orthography.js', import.meta.url).href;
const { normalizeConverted, normalizeOrthography } = await import(ORTHOGRAPHY);

/** The normaliser for a row's `unicode`, chosen by how the row was repaired. */
export const normalizerFor = (row) =>
  row?.repair === 'tungaamal' ? normalizeConverted : normalizeOrthography;

/** A silver row's script in this project's orthography. */
export const scriptOf = (row) => normalizerFor(row)(row.unicode ?? '');
