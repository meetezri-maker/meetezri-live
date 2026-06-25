import {
  countPhoneDigits,
  isValidOptionalAppPhone,
} from '@meetezri/shared';

export { countPhoneDigits, isValidOptionalAppPhone };

/**
 * Values saved without "+" (legacy/plain digits) get a leading "+" so PhoneInput
 * can match a country prefix and enforce digit limits consistently.
 */
export function normalizeStoredPhoneForInput(raw: string | undefined | null): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  if (t.startsWith('+')) return t;
  const digits = t.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`;
}
