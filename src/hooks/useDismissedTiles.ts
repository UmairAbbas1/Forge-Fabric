import { useCallback, useState } from "react";

const STORAGE_KEY = "ff_dismissed_tiles";

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Per-browser "hide this from my active list" preference for completed/
 * shipped order tiles across orders/cutting/sewing/wash/dashboard. This
 * never deletes or touches any database row — it only hides a card from
 * this browser's view (other viewers, and this same order's real record,
 * are unaffected). Eligibility (order must actually be shipped, not mid-
 * production) is enforced by the caller via isOrderFullyComplete — this
 * hook only remembers what was dismissed.
 */
export function useDismissedTiles() {
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // localStorage unavailable (private mode, quota) — dismiss still
        // works for this render via state, just won't persist a reload.
      }
      return next;
    });
  }, []);

  const isDismissed = useCallback((id: string) => dismissed.has(id), [dismissed]);

  return { isDismissed, dismiss };
}
