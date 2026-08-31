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

  // A phone number's own dial code (e.g. the "+92" a contact typed via
  // CountryPhoneInput's country selector) always wins over the address
  // country passed in by the caller — a contact person's phone and the
  // shipment's destination are frequently different countries (an overseas
  // brand's office contact shipping to a US warehouse, for example), and
  // that's a perfectly valid, ordinary case, not a data error. Only fall
  // back to the passed-in address country when the number itself carries
  // no recognizable dial code (e.g. a bare 10-digit number typed with no
  // "+" prefix, as in AddressSelector's plain shipping-phone field).
  const trimmed = rawPhone.trim();
  const dialCodeMatch = trimmed.startsWith('+')
    ? [...COUNTRY_OPTIONS].sort((a, b) => b.dialCode.length - a.dialCode.length)
        .find((c) => trimmed.startsWith(c.dialCode))
    : undefined;

  const countryOpt = dialCodeMatch || (countryName
    ? COUNTRY_OPTIONS.find((c) => c.name.toLowerCase() === countryName.toLowerCase())
    : undefined);

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

// ------------------------------------------------------------------------
// Country -> IANA time zone, for rendering each portal user's header clock
// in their own location's local time rather than one shared time for
// everyone. One representative zone per country — real IANA identifiers,
// not guessed. This is the fallback used when no state/province override
// applies (see US_STATE_TIMEZONES below for the United States, which this
// app's address forms do reliably collect a state for). Remaining honest
// simplification for other multi-zone countries (Canada, Australia,
// Brazil, Russia): picking their single most common business zone rather
// than resolving further. Countries not listed fall back to the viewer's
// own browser/device time zone (see getTimezoneForCountry below), never to
// a fabricated guess.
// ------------------------------------------------------------------------
const TIMEZONE_BY_COUNTRY: Record<string, string> = {
  'United States': 'America/New_York',
  'Canada': 'America/Toronto',
  'United Kingdom': 'Europe/London',
  'Pakistan': 'Asia/Karachi',
  'India': 'Asia/Kolkata',
  'Bangladesh': 'Asia/Dhaka',
  'Turkey': 'Europe/Istanbul',
  'Germany': 'Europe/Berlin',
  'France': 'Europe/Paris',
  'Italy': 'Europe/Rome',
  'Spain': 'Europe/Madrid',
  'United Arab Emirates': 'Asia/Dubai',
  'Saudi Arabia': 'Asia/Riyadh',
  'China': 'Asia/Shanghai',
  'Japan': 'Asia/Tokyo',
  'South Korea': 'Asia/Seoul',
  'Australia': 'Australia/Sydney',
  'New Zealand': 'Pacific/Auckland',
  'Brazil': 'America/Sao_Paulo',
  'Mexico': 'America/Mexico_City',
  'Vietnam': 'Asia/Ho_Chi_Minh',
  'Indonesia': 'Asia/Jakarta',
  'Malaysia': 'Asia/Kuala_Lumpur',
  'Philippines': 'Asia/Manila',
  'Thailand': 'Asia/Bangkok',
  'Singapore': 'Asia/Singapore',
  'Netherlands': 'Europe/Amsterdam',
  'Switzerland': 'Europe/Zurich',
  'Sweden': 'Europe/Stockholm',
  'Norway': 'Europe/Oslo',
  'Denmark': 'Europe/Copenhagen',
  'Finland': 'Europe/Helsinki',
  'Poland': 'Europe/Warsaw',
  'Portugal': 'Europe/Lisbon',
  'Greece': 'Europe/Athens',
  'Ireland': 'Europe/Dublin',
  'Egypt': 'Africa/Cairo',
  'South Africa': 'Africa/Johannesburg',
  'Nigeria': 'Africa/Lagos',
  'Kenya': 'Africa/Nairobi',
  'Morocco': 'Africa/Casablanca',
  'Argentina': 'America/Argentina/Buenos_Aires',
  'Chile': 'America/Santiago',
  'Colombia': 'America/Bogota',
  'Peru': 'America/Lima',
  'Taiwan': 'Asia/Taipei',
  'Hong Kong': 'Asia/Hong_Kong',
};

// ------------------------------------------------------------------------
// US state -> IANA time zone. Real per-state assignments — the United
// States is the one multi-zone country this app's address forms reliably
// collect a full state name for (address_book.state, apply_submissions
// billing_state/shipping_state), so state-level accuracy is honest here in
// a way it isn't for country alone. A handful of states genuinely split
// across two zones (FL panhandle, MI Upper Peninsula, ID panhandle, western
// NE/KS/TX/ND/SD, OR's Malheur County) — each is assigned its more
// populous zone rather than resolved down to county, which no form here
// collects.
// ------------------------------------------------------------------------
const US_STATE_TIMEZONES: Record<string, string> = {
  'Alabama': 'America/Chicago', 'Alaska': 'America/Anchorage', 'Arizona': 'America/Phoenix',
  'Arkansas': 'America/Chicago', 'California': 'America/Los_Angeles', 'Colorado': 'America/Denver',
  'Connecticut': 'America/New_York', 'Delaware': 'America/New_York', 'District of Columbia': 'America/New_York',
  'Florida': 'America/New_York', 'Georgia': 'America/New_York', 'Hawaii': 'Pacific/Honolulu',
  'Idaho': 'America/Denver', 'Illinois': 'America/Chicago', 'Indiana': 'America/New_York',
  'Iowa': 'America/Chicago', 'Kansas': 'America/Chicago', 'Kentucky': 'America/New_York',
  'Louisiana': 'America/Chicago', 'Maine': 'America/New_York', 'Maryland': 'America/New_York',
  'Massachusetts': 'America/New_York', 'Michigan': 'America/New_York', 'Minnesota': 'America/Chicago',
  'Mississippi': 'America/Chicago', 'Missouri': 'America/Chicago', 'Montana': 'America/Denver',
  'Nebraska': 'America/Chicago', 'Nevada': 'America/Los_Angeles', 'New Hampshire': 'America/New_York',
  'New Jersey': 'America/New_York', 'New Mexico': 'America/Denver', 'New York': 'America/New_York',
  'North Carolina': 'America/New_York', 'North Dakota': 'America/Chicago', 'Ohio': 'America/New_York',
  'Oklahoma': 'America/Chicago', 'Oregon': 'America/Los_Angeles', 'Pennsylvania': 'America/New_York',
  'Rhode Island': 'America/New_York', 'South Carolina': 'America/New_York', 'South Dakota': 'America/Chicago',
  'Tennessee': 'America/Chicago', 'Texas': 'America/Chicago', 'Utah': 'America/Denver',
  'Vermont': 'America/New_York', 'Virginia': 'America/New_York', 'Washington': 'America/Los_Angeles',
  'West Virginia': 'America/New_York', 'Wisconsin': 'America/Chicago', 'Wyoming': 'America/Denver',
};

// Real USPS 2-letter codes -> the exact full names used as keys in
// US_STATE_TIMEZONES above. This app collects state as free text in more
// than one place (address_book.state, apply_submissions billing_state/
// shipping_state) rather than always through a validated dropdown, and
// real submitted data includes both forms — e.g. "NJ" on one order and
// "New York" (or "Newyork", a typo this table intentionally does NOT try
// to guess-correct) on another for the same company. Without this,
// "NJ" silently failed to match and fell back to the country-level
// default — which happens to also be America/New_York, masking the bug
// for East Coast states while it would have been visibly wrong for e.g.
// "CA" (which would have wrongly fallen back to Eastern instead of
// Pacific).
const US_STATE_ABBREVIATIONS: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

// Case-insensitive index of US_STATE_TIMEZONES, built once, so "california"
// or "CALIFORNIA" resolves the same as "California" without changing the
// canonical full-name keys used above.
const US_STATE_TIMEZONES_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_TIMEZONES).map(([name, zone]) => [name.toLowerCase(), zone])
);

/**
 * Real IANA zone for a country (optionally refined by a US state — full
 * name or 2-letter USPS abbreviation, either case), or undefined if
 * nothing matches (caller should fall back to the viewer's own device
 * zone).
 */
export function getTimezoneForCountry(countryName?: string | null, state?: string | null): string | undefined {
  if (!countryName) return undefined;
  const country = countryName.trim();
  if (country === 'United States' && state) {
    const trimmed = state.trim();
    const fullName = trimmed.length === 2 ? US_STATE_ABBREVIATIONS[trimmed.toUpperCase()] : trimmed;
    const stateZone = fullName ? US_STATE_TIMEZONES_LOWER[fullName.toLowerCase()] : undefined;
    if (stateZone) return stateZone;
  }
  return TIMEZONE_BY_COUNTRY[country];
}

// ------------------------------------------------------------------------
// Country -> BCP-47 locale, purely for date FIELD ORDER (US: M/D/Y,
// Pakistan/UK/India and most of the rest of the world: D/M/Y). Real CLDR
// locale tags, one representative per country. Countries not listed fall
// back to the viewer's own browser locale (undefined), never a guess.
// ------------------------------------------------------------------------
const LOCALE_BY_COUNTRY: Record<string, string> = {
  'United States': 'en-US',
  'Canada': 'en-CA',
  'United Kingdom': 'en-GB',
  'Pakistan': 'en-PK',
  'India': 'en-IN',
  'Bangladesh': 'en-BD',
  'Turkey': 'tr-TR',
  'Germany': 'de-DE',
  'France': 'fr-FR',
  'Italy': 'it-IT',
  'Spain': 'es-ES',
  'United Arab Emirates': 'en-AE',
  'Saudi Arabia': 'ar-SA',
  'China': 'zh-CN',
  'Japan': 'ja-JP',
  'South Korea': 'ko-KR',
  'Australia': 'en-AU',
  'New Zealand': 'en-NZ',
  'Brazil': 'pt-BR',
  'Mexico': 'es-MX',
  'Vietnam': 'vi-VN',
  'Indonesia': 'id-ID',
  'Malaysia': 'en-MY',
  'Philippines': 'en-PH',
  'Thailand': 'th-TH',
  'Singapore': 'en-SG',
  'Netherlands': 'nl-NL',
  'Switzerland': 'de-CH',
  'Sweden': 'sv-SE',
  'Norway': 'nb-NO',
  'Denmark': 'da-DK',
  'Finland': 'fi-FI',
  'Poland': 'pl-PL',
  'Portugal': 'pt-PT',
  'Greece': 'el-GR',
  'Ireland': 'en-IE',
  'Egypt': 'ar-EG',
  'South Africa': 'en-ZA',
  'Nigeria': 'en-NG',
  'Kenya': 'en-KE',
  'Morocco': 'ar-MA',
  'Argentina': 'es-AR',
  'Chile': 'es-CL',
  'Colombia': 'es-CO',
  'Peru': 'es-PE',
  'Taiwan': 'zh-TW',
  'Hong Kong': 'zh-HK',
};

/** Real CLDR locale tag for a country name, or undefined if not in the table (caller should fall back to the viewer's own browser locale). */
export function getLocaleForCountry(countryName?: string | null): string | undefined {
  if (!countryName) return undefined;
  return LOCALE_BY_COUNTRY[countryName.trim()];
}

/**
 * Formats a pure calendar date (an order/submission "created on" date with
 * no meaningful time-of-day) in a locale's field order, e.g. US M/D/Y vs.
 * Pakistan D/M/Y. Deliberately pins timeZone to UTC on both ends instead of
 * converting to the viewer's real time zone: a date-only value like
 * "2026-08-10" already means "August 10th" everywhere, and converting it
 * through a non-UTC time zone can roll it to the 9th or 11th depending on
 * which side of midnight UTC the viewer's offset lands on — a real date
 * would change, not just its formatting. Live timestamps that DO carry a
 * meaningful time-of-day (the header clock, notification times) should use
 * getTimezoneForCountry instead, not this function.
 */
export function formatCalendarDate(value: string | Date | null | undefined, locale?: string): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
}
