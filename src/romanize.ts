/**
 * Classical Mongolian romanization ↔ Unicode Mongolian script (Hudum).
 *
 * **This is a re-export.** The implementation is canonical in
 * `@gege-mn/mongol-bichig`, alongside the reference documents that define the
 * conventions, so this package and gege-linter cannot drift apart on what `-`
 * means or which code point a digit selects. Import from here anyway: every
 * other module in this package does, and keeping one internal path means the
 * canonical source can move without touching eight call sites.
 *
 * This file used to be a verbatim copy, and it drifted within a day — it grew
 * FVS digit support the package did not have. That is exactly the failure the
 * re-export prevents, and it is why the fix went upstream (mongol-bichig
 * 0.2.0) rather than being patched here.
 *
 * The conventions, in short — the normative version is the module's own doc
 * comment and `references/variation-sequences.md`:
 *
 * - `-` marks a chachlag / suffix connector and becomes MVS (U+180E).
 * - `.` forces a letter boundary, so `n.g` is NA+GA, not the ANG ligature.
 * - A digit `1`–`4` selects FVS1–FVS4 for the letter before it: `nay1ma` is
 *   NA A YA FVS1 MA A (найм).
 * - ASCII aliases: `gh`=γ, `ch`=č, `sh`=š, `j`=ǰ, `v`=w.
 * - q/k and γ/g are the back/front readings of U+182C and U+182D.
 * - Loan and Ali Gali letters are deliberately unmapped, so emitting one from
 *   native vocabulary throws instead of shipping a wrong-block error.
 */

export {
  finalLetter,
  fromScript,
  isRomanizable,
  RomanizationError,
  toScript,
} from '@gege-mn/mongol-bichig';
