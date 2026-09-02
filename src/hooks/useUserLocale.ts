import { formatCalendarDate } from "../lib/geoData";

const resolved = Intl.DateTimeFormat().resolvedOptions();

/**
 * Formats dates/times in the *viewer's own device* locale and time zone —
 * whatever OS/browser setting they're actually sitting in front of right
 * now, not a location inferred from a saved company/facility address. A
 * Pakistan-based user sees Pakistan time, a US-based user sees US time,
 * automatically, with zero lookups.
 */
export function useUserLocale() {
  return {
    locale: resolved.locale,
    timeZone: resolved.timeZone,
    /** Format a pure calendar date (no meaningful time-of-day) in this viewer's own field order. */
    formatDate: (value: string | Date | null | undefined) => formatCalendarDate(value, resolved.locale),
  };
}
