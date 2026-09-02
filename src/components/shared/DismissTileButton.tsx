import { X } from "lucide-react";

/**
 * Shared "remove from active list" cross button for completed/shipped order
 * tiles (orders table, cutting/sewing tickets, wash batches, dashboard
 * Kanban cards). Disabled — and inert on click — whenever the order isn't
 * actually done, so a stray click can never hide a job still in production.
 * Caller supplies `eligible` from isOrderFullyComplete(order).
 */
export function DismissTileButton({
  eligible,
  onDismiss,
  className = "",
}: {
  eligible: boolean;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!eligible) return;
        if (window.confirm("Remove this from your active list? It stays in the system and can't be restored to this view — just hidden here.")) {
          onDismiss();
        }
      }}
      disabled={!eligible}
      title={eligible ? "Remove from active list" : "Still in production — can't remove until it's shipped"}
      aria-label="Remove from active list"
      className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors shrink-0 ${
        eligible
          ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-500 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer"
          : "text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50"
      } ${className}`}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
