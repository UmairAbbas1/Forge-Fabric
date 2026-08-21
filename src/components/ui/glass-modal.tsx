import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared glass modal/sheet primitive — Phase 0 of the design-system pass.
 * Most modals in this app are hand-rolled `fixed inset-0` divs rather than
 * the Radix Dialog in ui/dialog.tsx, so this matches that existing pattern
 * (rather than the underused Radix one) to be an actual drop-in replacement
 * as later phases touch each screen. Scale+fade entrance from the trigger,
 * Escape-to-close, backdrop-click-to-close, focus-visible on the close
 * button — see the `modal-escape` / `modal-motion` guidelines this follows.
 */
export interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;   
  className?: string;
  /** Set false for a step in an unsaved multi-step flow where accidental backdrop-dismiss would lose data. */
  closeOnBackdropClick?: boolean;
}

export function GlassModal({
  open,
  onClose,
  children,
  className,
  closeOnBackdropClick = true,
}: GlassModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "glass-modal rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-up",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function GlassModalHeader({
  title,
  description,
  onClose,
  icon,
  className,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 p-5 border-b border-border/60", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-h3 text-foreground">{title}</h3>
          {description && <p className="text-caption text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-apple-fast cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function GlassModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2.5 p-5 border-t border-border/60", className)}
      {...props}
    />
  );
}
