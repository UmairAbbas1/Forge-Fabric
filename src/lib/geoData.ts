import { Country, State, City } from 'country-state-city';
import { COUNTRY_OPTIONS } from '../components/shared/CountryPhoneInput';

// Item 4: Country -> City -> State reference data. Real dataset
// (country-state-city), not hand-rolled — resolves by country NAME since
// that's what this app already stores on companyInfo/address_book
// (billing_country / shipping_country / address_book.country), not ISO
// codes, so every existing record keeps working unchanged.

export interface CountryOption {
  name: string;
  isoCode: string;
  flag: string;
}

export interface CityOption {
  name: string;
  stateCode: string;
}

let countryCache: CountryOption[] | null = null;

export function getAllCountries(): CountryOption[] {
  if (countryCache) return countryCache;
  countryCache = Country.getAllCountries()
    .map((c) => ({ name: c.name, isoCode: c.isoCode, flag: c.flag }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countryCache;
}

function isoCodeForCountryName(countryName: string): string | null {
  const match = getAllCountries().find((c) => c.name.toLowerCase() === countryName.trim().toLowerCase());
  return match?.isoCode || null;
}

const cityCache = new Map<string, CityOption[]>();

/**
 * Real city list for a country. IMPORTANT: many cities share the same name
 * across different states/provinces (the US alone has four real "Austin"s —
 * Texas, Arkansas, Indiana, Minnesota). Deduplicating by name alone silently
 * picks an arbitrary one and can attach the wrong state to a real address,
 * so every distinct city+state pair is kept — callers must render the state
 * alongside the city name (CountryCityStateFields does) so the customer can
 * tell them apart, and only collapse literal duplicate city+state pairs.
 */
export function getCitiesForCountry(countryName: string): CityOption[] {
  const iso = isoCodeForCountryName(countryName);
  if (!iso) return [];
  if (cityCache.has(iso)) return cityCache.get(iso)!;

  const raw = City.getCitiesOfCountry(iso) || [];
  const seen = new Set<string>();
  const result: CityOption[] = [];
  for (const c of raw) {
    const key = `${c.name.toLowerCase()}|${c.stateCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name: c.name, stateCode: c.stateCode });
  }
  result.sort((a, b) => a.name.localeCompare(b.name) || a.stateCode.localeCompare(b.stateCode));
  cityCache.set(iso, result);
  return result;
}

/** Real state/province name for a given city's stateCode within a country. */
export function getStateNameForCity(countryName: string, stateCode: string): string {
  const iso = isoCodeForCountryName(countryName);
  if (!iso || !stateCode) return '';
  const state = State.getStateByCodeAndCountry(stateCode, iso);
  return state?.name || '';
}

// ------------------------------------------------------------------------
// Phone validation — reuses CountryPhoneInput's existing real mask data
// (digit-count per country), no new dataset needed.
// ------------------------------------------------------------------------
export function validatePhoneForCountry(rawPhone: string, countryName?: string): { valid: boolean; message?: string } {
  const digitsOnly = rawPhone.replace(/\D/g, '');
  if (!digitsOnly) return { valid: false, message: 'Phone number is required.' };

  const countryOpt = countryName
    ? COUNTRY_OPTIONS.find((c) => c.name.toLowerCase() === countryName.toLowerCase())
    : undefined;

  if (!countryOpt) {
    // No known mask for this country — fall back to a generic, honest
    // sanity check (real phone numbers are 7-15 digits per ITU E.164),
    // not a fabricated country-specific rule.
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return { valid: false, message: 'Please enter a valid phone number (7-15 digits).' };
    }
    return { valid: true };
  }

  const dialDigits = countryOpt.dialCode.replace(/\D/g, '');
  const localDigits = digitsOnly.startsWith(dialDigits) ? digitsOnly.slice(dialDigits.length) : digitsOnly;
  const expectedLength = (countryOpt.mask.match(/#/g) || []).length;

  if (localDigits.length !== expectedLength) {
    return {
      valid: false,
      message: `Please enter a valid ${countryOpt.name} phone number (${expectedLength} digits, e.g. ${countryOpt.dialCode} ${countryOpt.mask.replace(/#/g, '0')}).`,
    };
  }
  return { valid: true };
}

// ------------------------------------------------------------------------
// Zip/postal code validation — small, real per-country format table
// (well-documented postal formats), not guessed. Countries not listed fall
// back to an honest generic check (non-empty, 3-10 alphanumeric chars)
// rather than a fabricated country-specific pattern.
// ------------------------------------------------------------------------
const ZIP_PATTERNS: Record<string, RegExp> = {
  'United States': /^\d{5}(-\d{4})?$/,
  'Canada': /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  'United Kingdom': /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
  'Pakistan': /^\d{5}$/,
  'India': /^\d{6}$/,
  'Germany': /^\d{5}$/,
  'France': /^\d{5}$/,
  'Italy': /^\d{5}$/,
  'Spain': /^\d{5}$/,
  'Australia': /^\d{4}$/,
  'New Zealand': /^\d{4}$/,
  'Brazil': /^\d{5}-?\d{3}$/,
  'Mexico': /^\d{5}$/,
  'Japan': /^\d{3}-?\d{4}$/,
  'South Korea': /^\d{5}$/,
  'China': /^\d{6}$/,
  'Netherlands': /^\d{4}\s?[A-Za-z]{2}$/,
  'Switzerland': /^\d{4}$/,
  'Sweden': /^\d{3}\s?\d{2}$/,
  'Norway': /^\d{4}$/,
  'Denmark': /^\d{4}$/,
  'Poland': /^\d{2}-?\d{3}$/,
  'Portugal': /^\d{4}-?\d{3}$/,
  'Singapore': /^\d{6}$/,
  'Turkey': /^\d{5}$/,
};

export function validateZipForCountry(rawZip: string, countryName?: string): { valid: boolean; message?: string } {
  const trimmed = rawZip.trim();
  if (!trimmed) return { valid: false, message: 'Zip / postal code is required.' };

  const pattern = countryName ? ZIP_PATTERNS[countryName] : undefined;
  if (!pattern) {
    if (trimmed.length < 3 || trimmed.length > 10 || !/^[A-Za-z0-9\s-]+$/.test(trimmed)) {
      return { valid: false, message: 'Please enter a valid zip / postal code.' };
    }
    return { valid: true };
  }

  if (!pattern.test(trimmed)) {
    return { valid: false, message: `Please enter a valid ${countryName} zip / postal code.` };
  }
  return { valid: true };
}
