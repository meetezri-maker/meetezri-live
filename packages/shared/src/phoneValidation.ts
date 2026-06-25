export interface PhoneCountryRule {
  dialCode: string;
  /** Local subscriber number length (after country dial code). */
  localDigits: { min: number; max: number };
}

/**
 * Dial-code rules aligned with PhoneInput country list.
 * Empty phone is valid for optional fields; otherwise require +prefix and local length for that country.
 */
export const PHONE_COUNTRY_RULES: PhoneCountryRule[] = [
  { dialCode: '+1', localDigits: { min: 10, max: 10 } },
  { dialCode: '+44', localDigits: { min: 10, max: 10 } },
  { dialCode: '+91', localDigits: { min: 10, max: 10 } },
  { dialCode: '+61', localDigits: { min: 9, max: 9 } },
  { dialCode: '+81', localDigits: { min: 10, max: 10 } },
  { dialCode: '+49', localDigits: { min: 10, max: 11 } },
  { dialCode: '+33', localDigits: { min: 9, max: 9 } },
  { dialCode: '+86', localDigits: { min: 11, max: 11 } },
  { dialCode: '+55', localDigits: { min: 10, max: 11 } },
  { dialCode: '+7', localDigits: { min: 10, max: 10 } },
  { dialCode: '+39', localDigits: { min: 9, max: 10 } },
  { dialCode: '+971', localDigits: { min: 9, max: 9 } },
  { dialCode: '+966', localDigits: { min: 9, max: 9 } },
  { dialCode: '+92', localDigits: { min: 10, max: 10 } },
  { dialCode: '+65', localDigits: { min: 8, max: 8 } },
  { dialCode: '+60', localDigits: { min: 9, max: 10 } },
  { dialCode: '+62', localDigits: { min: 9, max: 11 } },
  { dialCode: '+63', localDigits: { min: 10, max: 10 } },
  { dialCode: '+64', localDigits: { min: 8, max: 10 } },
  { dialCode: '+27', localDigits: { min: 9, max: 9 } },
  { dialCode: '+20', localDigits: { min: 10, max: 10 } },
  { dialCode: '+90', localDigits: { min: 10, max: 10 } },
  { dialCode: '+82', localDigits: { min: 9, max: 10 } },
  { dialCode: '+34', localDigits: { min: 9, max: 9 } },
  { dialCode: '+31', localDigits: { min: 9, max: 9 } },
  { dialCode: '+41', localDigits: { min: 9, max: 9 } },
  { dialCode: '+46', localDigits: { min: 9, max: 9 } },
  { dialCode: '+47', localDigits: { min: 8, max: 8 } },
  { dialCode: '+48', localDigits: { min: 9, max: 9 } },
  { dialCode: '+32', localDigits: { min: 9, max: 9 } },
  { dialCode: '+43', localDigits: { min: 10, max: 11 } },
  { dialCode: '+30', localDigits: { min: 10, max: 10 } },
  { dialCode: '+351', localDigits: { min: 9, max: 9 } },
  { dialCode: '+353', localDigits: { min: 9, max: 9 } },
  { dialCode: '+420', localDigits: { min: 9, max: 9 } },
  { dialCode: '+36', localDigits: { min: 9, max: 9 } },
  { dialCode: '+40', localDigits: { min: 9, max: 9 } },
  { dialCode: '+380', localDigits: { min: 9, max: 9 } },
  { dialCode: '+972', localDigits: { min: 9, max: 9 } },
  { dialCode: '+98', localDigits: { min: 10, max: 10 } },
  { dialCode: '+964', localDigits: { min: 10, max: 10 } },
  { dialCode: '+234', localDigits: { min: 10, max: 10 } },
  { dialCode: '+254', localDigits: { min: 9, max: 9 } },
  { dialCode: '+233', localDigits: { min: 9, max: 9 } },
  { dialCode: '+52', localDigits: { min: 10, max: 10 } },
  { dialCode: '+54', localDigits: { min: 10, max: 10 } },
  { dialCode: '+56', localDigits: { min: 9, max: 9 } },
  { dialCode: '+57', localDigits: { min: 10, max: 10 } },
  { dialCode: '+51', localDigits: { min: 9, max: 9 } },
  { dialCode: '+45', localDigits: { min: 8, max: 8 } },
  { dialCode: '+358', localDigits: { min: 9, max: 10 } },
  { dialCode: '+852', localDigits: { min: 8, max: 8 } },
  { dialCode: '+974', localDigits: { min: 8, max: 8 } },
  { dialCode: '+965', localDigits: { min: 8, max: 8 } },
  { dialCode: '+961', localDigits: { min: 7, max: 8 } },
  { dialCode: '+256', localDigits: { min: 9, max: 9 } },
  { dialCode: '+880', localDigits: { min: 10, max: 10 } },
  { dialCode: '+94', localDigits: { min: 9, max: 9 } },
  { dialCode: '+66', localDigits: { min: 9, max: 9 } },
  { dialCode: '+58', localDigits: { min: 10, max: 10 } },
];

const rulesByLongestPrefix = [...PHONE_COUNTRY_RULES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length,
);

export function countPhoneDigits(value: string): number {
  return (value.match(/\d/g) || []).length;
}

export function matchPhoneCountryRule(phone: string): PhoneCountryRule | null {
  const trimmed = phone.trim();
  if (!trimmed.startsWith('+')) return null;
  return rulesByLongestPrefix.find((rule) => trimmed.startsWith(rule.dialCode)) ?? null;
}

export function getMaxLocalDigitsForDialCode(dialCode: string): number {
  const rule = PHONE_COUNTRY_RULES.find((entry) => entry.dialCode === dialCode);
  return rule?.localDigits.max ?? 10;
}

export function isValidOptionalAppPhone(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return true;
  if (!trimmed.startsWith('+')) return false;

  const rule = matchPhoneCountryRule(trimmed);
  if (!rule) return false;

  const localDigits = countPhoneDigits(trimmed) - countPhoneDigits(rule.dialCode);
  return localDigits >= rule.localDigits.min && localDigits <= rule.localDigits.max;
}

export function isValidRequiredAppPhone(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return false;
  return isValidOptionalAppPhone(trimmed);
}

export const OPTIONAL_PHONE_VALIDATION_MESSAGE =
  'Enter a valid phone number for the selected country';

export const REQUIRED_PHONE_VALIDATION_MESSAGE =
  'Enter a valid phone number with country code for the selected country';
