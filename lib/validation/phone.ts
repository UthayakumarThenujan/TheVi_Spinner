/**
 * Sri Lankan mobile number normalization.
 *
 * Accepts: 0771234567, 771234567, +94771234567, 94771234567, 0094771234567,
 * with any spaces, dashes, dots or brackets. Returns E.164: +94771234567.
 *
 * Valid mobile operator prefixes: 70, 71, 72, 74, 75, 76, 77, 78.
 */
const MOBILE_PREFIXES = new Set(["70", "71", "72", "74", "75", "76", "77", "78"]);

export function normalizeSriLankanMobile(input: string): string | null {
  if (typeof input !== "string") return null;
  let digits = input.trim().replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;
  digits = digits.replace(/^\+/, "");

  if (digits.startsWith("0094")) digits = digits.slice(4);
  else if (digits.startsWith("94") && digits.length === 11) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);

  if (!/^7\d{8}$/.test(digits)) return null;
  if (!MOBILE_PREFIXES.has(digits.slice(0, 2))) return null;
  return `+94${digits}`;
}

/** +94771234567 -> +94 77 123 4567 */
export function formatMobile(e164: string): string {
  const m = /^\+94(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+94 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** +94771234567 -> +94 77 *** 4567 (for anything shown outside the admin area) */
export function maskMobile(e164: string): string {
  const m = /^\+94(\d{2})\d{3}(\d{4})$/.exec(e164);
  return m ? `+94 ${m[1]} *** ${m[2]}` : "***";
}
