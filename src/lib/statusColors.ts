/**
 * Fixed 5-token status palette, backed by the design tokens in styles.css
 * (--success, --warning, --destructive, --primary). Every status badge,
 * dropdown, and pill in the app should map to exactly one of these instead
 * of inventing its own purple/cyan/teal/indigo one-off.
 */
export type StatusTone = "success" | "warning" | "destructive" | "info" | "default";

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-primary/10 text-primary border-primary/20",
  default: "bg-muted text-muted-foreground border-border",
};

/** Solid (filled) variants for buttons/pills that need a stronger fill than the 10%-tint badge style. */
export const STATUS_TONE_SOLID_CLASSES: Record<StatusTone, string> = {
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  info: "bg-primary text-primary-foreground",
  default: "bg-muted text-muted-foreground",
};

/**
 * Maps a submission/application lifecycle status (apply_submissions.status,
 * used across the merchandiser inbox, sample requests, and status tracker)
 * to a tone. Centralized so "needs_info" isn't orange in one screen and
 * amber in another, and "rejected" doesn't get conflated with it.
 */
export function getSubmissionStatusTone(status?: string | null): StatusTone {
  switch ((status || "").toLowerCase()) {
    case "converted":
    case "approved":
    case "shipped":
    case "received":
      return "success";
    case "under_review":
    case "in_review":
    case "factory_review":
    case "cost_approval":
    case "in_development":
    case "in_production":
    case "in_sampling":
    case "pending_review":
      return "info";
    case "needs_info":
      return "warning";
    case "rejected":
      return "default";
    default:
      return "default";
  }
}

export function getSubmissionStatusLabel(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "converted":
      return "Converted";
    case "approved":
      return "Approved";
    case "under_review":
      return "Under Review";
    case "needs_info":
      return "Needs Info";
    case "rejected":
      return "Rejected";
    case "pending_review":
      return "Pending Review";
    default:
      return "Pending";
  }
}
