/**
 * Values saved without "+" (legacy/plain digits) get a leading "+" so PhoneInput
 * can match a country prefix and enforce digit limits consistently.
 */
export function normalizeStoredPhoneForInput(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (t.startsWith("+")) return t;
  const digits = t.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

export function countPhoneDigits(value: string): number {
  return (value.match(/\d/g) || []).length;
}

export const REQUIRED_PHONE_DIGITS = 12;

/** Empty is allowed; otherwise require +country code and exactly 12 digits total. */
export function isValidOptionalAppPhone(value: string | undefined | null): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  return t.startsWith("+") && countPhoneDigits(t) === REQUIRED_PHONE_DIGITS;
}
