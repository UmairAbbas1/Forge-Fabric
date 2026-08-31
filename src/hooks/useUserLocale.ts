import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "../lib/supabase";
import { getLocaleForCountry, getTimezoneForCountry, formatCalendarDate } from "../lib/geoData";

interface ResolvedLocation {
  country?: string;
  state?: string;
}

// Resolved once per company_id and reused by every component on the page —
// avoids every table/header re-running the same lookup for the same
// logged-in customer.
const companyLocationCache = new Map<string, ResolvedLocation>();

/**
 * Resolves the current viewer's own location for display formatting:
 * internal staff (admin/merchandiser/production/qc/warehouse/finance)
 * always format as the factory does (US format, Pacific time — both
 * facilities, San Leandro and Petaluma, are in California) regardless of
 * facility_scope. Customers get their own company's location: their
 * address_book entry (HQ, then Billing, then Shipping) if one exists, or —
 * since many accounts reach this stage before a formal address_book row is
 * ever created — the most recent apply_submissions billing/shipping
 * address on file for their company as a fallback. Falls back to the
 * viewer's own browser locale/time zone (undefined) only when truly
 * nothing is on file, never to a fabricated guess.
 */
const STAFF_LOCALE = "en-US";
const STAFF_TIMEZONE = "America/Los_Angeles"; // both facilities (San Leandro, Petaluma) are in California

export function useUserLocale() {
  const { user } = useAuth();
  const [location, setLocation] = useState<ResolvedLocation>({});
  const isStaff = !!user && user.role !== "customer";

  useEffect(() => {
    if (!user || isStaff) return;
    if (!user.company_id) {
      setLocation({});
      return;
    }
    const companyId = user.company_id;
    const cached = companyLocationCache.get(companyId);
    if (cached) {
      setLocation(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("address_book")
        .select("country, state, address_type")
        .eq("company_id", companyId);
      if (cancelled) return;

      const preferred =
        data && data.length
          ? data.find((a: { address_type: string }) => a.address_type === "HQ") ||
            data.find((a: { address_type: string }) => a.address_type === "Billing") ||
            data.find((a: { address_type: string }) => a.address_type === "Shipping") ||
            data[0]
          : null;

      if (preferred?.country) {
        const resolved = { country: preferred.country, state: preferred.state || undefined };
        companyLocationCache.set(companyId, resolved);
        setLocation(resolved);
        return;
      }

      // No formal address_book entry yet — fall back to this company's
      // most recent intake submission, which already captured a real
      // billing/shipping address at the time they applied.
      const companyName = (user.customer_name || "").trim();
      if (!companyName) {
        setLocation({});
        return;
      }
      const { data: subData } = await supabase
        .from("apply_submissions")
        .select("billing_country, billing_state, shipping_country, shipping_state")
        .ilike("company_name", companyName)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const sub = subData?.[0] as
        | { billing_country?: string; billing_state?: string; shipping_country?: string; shipping_state?: string }
        | undefined;
      const resolved: ResolvedLocation = sub
        ? {
            country: sub.billing_country || sub.shipping_country || undefined,
            state: sub.billing_state || sub.shipping_state || undefined,
          }
        : {};
      companyLocationCache.set(companyId, resolved);
      setLocation(resolved);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.company_id, user?.customer_name]);

  const locale = isStaff ? STAFF_LOCALE : getLocaleForCountry(location.country);
  const timeZone = isStaff ? STAFF_TIMEZONE : getTimezoneForCountry(location.country, location.state);

  return {
    country: isStaff ? "United States" : location.country,
    locale,
    timeZone,
    /** Format a pure calendar date (no meaningful time-of-day) in this viewer's own field order. */
    formatDate: (value: string | Date | null | undefined) => formatCalendarDate(value, locale),
  };
}
