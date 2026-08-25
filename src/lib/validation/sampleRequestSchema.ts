import { z } from "zod";

// REQ-04 defaults — used until tenant_config's configurable values load, and
// as the fallback if that fetch fails. The live values (sample_min_turnaround_days,
// sample_max_quantity) are read from public.tenant_config (the app's Admin
// Settings singleton row) at runtime; see buildSampleRequestSchema() below,
// used by SampleRequestSubform.
export const SAMPLE_MAX_QUANTITY = 100;
export const SAMPLE_MIN_TURNAROUND_DAYS = 3;

/** Earliest allowed turnaround date, `minDays` from today. */
export function minSampleTurnaroundDate(minDays: number = SAMPLE_MIN_TURNAROUND_DAYS): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + minDays);
  return d;
}

/** Builds the sample request schema against configurable turnaround/cap limits. */
export function buildSampleRequestSchema(
  maxQuantity: number = SAMPLE_MAX_QUANTITY,
  minTurnaroundDays: number = SAMPLE_MIN_TURNAROUND_DAYS
) {
  return z.object({
    sample_type: z.enum(["Fit", "Proto", "Photo", "Pre-Production", "Counter"]),
    fabric_trim_source: z.enum(["Factory Sourced", "Brand Sourced"]),
    // Item 5: garment-definition detail, matching the Bulk flow's level of
    // detail at sample scale. style_name/colorway required so a sample
    // request isn't just an anonymous size grid; description stays optional.
    style_name: z.string().min(1, "Style name is required."),
    style_description: z.string().optional(),
    colorway: z.string().min(1, "Colorway is required."),
    fabric_type: z.enum(["Woven", "Knit", "Other"]),
    custom_fabric_type: z.string().optional(),
    quantity: z
      .number()
      .int()
      .min(1, "Quantity must be at least 1")
      .max(maxQuantity, `Sample limit exceeded: Orders over ${maxQuantity} pcs must be submitted as New Bulk Production Orders.`),
    size_breakdown: z.record(z.number().int().min(0)),
    tech_pack_url: z.string().optional(),
    reference_photos: z.array(z.string()).optional(),
    turnaround_date: z
      .string()
      .min(1, "Target turnaround date is required.")
      .refine((val) => {
        const requested = new Date(val);
        requested.setHours(0, 0, 0, 0);
        return requested.getTime() >= minSampleTurnaroundDate(minTurnaroundDays).getTime();
      }, {
        message: `Turnaround date must be at least ${minTurnaroundDays} business days from today.`,
      }),
    client_reference_sku: z.string().min(1, "Your reference SKU is required."),
    special_instructions: z.string().optional(),
    ship_to_address_id: z.string().optional(),
  }).refine((data) => {
    const sumBreakdown = Object.values(data.size_breakdown || {}).reduce((acc, val) => acc + (Number(val) || 0), 0);
    return sumBreakdown === data.quantity;
  }, {
    message: "Total Quantity must equal the sum of quantities in the Size Breakdown.",
    path: ["size_breakdown"],
  }).refine((data) => data.fabric_type !== "Other" || !!data.custom_fabric_type?.trim(), {
    message: "Please specify the custom fabric material.",
    path: ["custom_fabric_type"],
  });
}

export const sampleRequestSchema = buildSampleRequestSchema();

export type SampleRequestFormData = z.infer<typeof sampleRequestSchema>;
