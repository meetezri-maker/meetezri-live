/**
 * Web adapter — re-exports shared hotline data and maps to SafetyResource.
 */
import type { SafetyResource } from '@/app/types/safety';
import {
  CRISIS_HOTLINES_BY_COUNTRY,
  DIAL_CODE_TO_COUNTRY,
  SUPPORTED_CRISIS_COUNTRY_CODES,
  buildCrisisResourcesForCountry,
  countryCodeFromPhoneValue,
  dialCodeToCountryCode,
  getCountryHotlineEntry,
  isSupportedCrisisCountry,
  type CountryHotlineEntry,
  type CrisisHotlineExtra,
} from '@meetezri/shared';

export type { CountryHotlineEntry, CrisisHotlineExtra };
export {
  CRISIS_HOTLINES_BY_COUNTRY,
  DIAL_CODE_TO_COUNTRY,
  SUPPORTED_CRISIS_COUNTRY_CODES,
  countryCodeFromPhoneValue,
  dialCodeToCountryCode,
  getCountryHotlineEntry,
  isSupportedCrisisCountry,
};

export function buildSafetyResourcesForCountry(countryCode: string): SafetyResource[] {
  return buildCrisisResourcesForCountry(countryCode) as SafetyResource[];
}
