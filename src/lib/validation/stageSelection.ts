import { z } from "zod";
import { SELECTABLE_SERVICE_IDS, type ServiceId } from "../service-scope-constants";

// REQ-14: Selective Stage Pipeline validation.
// Two schemas: the customer's raw service picks (Step 2 of the intake
// wizard), and the resolved internal stage array that gets persisted to
// orders.selected_stages / work_orders.selected_stages / apply_submissions.
// requested_stages.

/** At least one real, selectable production service must be picked. */
export const selectedServiceIdsSchema = z
  .array(z.enum(SELECTABLE_SERVICE_IDS as [ServiceId, ...ServiceId[]]))
  .min(1, "Select at least one production service.");

/**
 * The resolved 1-13 stage array. Dependency rules are enforced as
 * refinements rather than baked into the type, so a validation failure can
 * carry a specific, actionable message instead of a generic type error.
 */
export const selectedStagesSchema = z
  .array(z.number().int().min(1).max(13))
  .min(1, "Order must include at least one production stage.")
  .refine((stages) => new Set(stages).size === stages.length, {
    message: "Duplicate stage numbers are not allowed in selected_stages.",
  })
  .refine((stages) => stages.every((s, i) => i === 0 || s > stages[i - 1]), {
    message: "selected_stages must be strictly ascending.",
  })
  .refine((stages) => stages.includes(13), {
    message: "Dispatch & Delivery (stage 13) is always required and must be included.",
  });

export type SelectedServiceIds = z.infer<typeof selectedServiceIdsSchema>;
export type SelectedStages = z.infer<typeof selectedStagesSchema>;
