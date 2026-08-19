import { z } from "zod";

export const SAMPLE_MAX_QUANTITY = 100;
export const SAMPLE_MIN_TURNAROUND_DAYS = 3;

/** Earliest allowed turnaround date, exactly SAMPLE_MIN_TURNAROUND_DAYS from today. */
export function minSampleTurnaroundDate(minDays: number = SAMPLE_MIN_TURNAROUND_DAYS): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + minDays);
  return d;
}

export const sampleRequestSchema = z.object({
  sample_type: z.enum(["Fit", "Photo", "Pre-Production", "Counter"]),
  fabric_trim_source: z.enum(["Factory Sourced", "Brand Sourced"]),
  quantity: z
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(SAMPLE_MAX_QUANTITY, `Sample limit exceeded: Orders over ${SAMPLE_MAX_QUANTITY} pcs must be submitted as New Bulk Production Orders.`),
  size_breakdown: z.record(z.number().int().min(0)),
  tech_pack_url: z.string().min(1, "Tech Pack URL or document link is required for sample requests."),
  reference_photos: z.array(z.string()).optional(),
  turnaround_date: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const requested = new Date(val);
      requested.setHours(0, 0, 0, 0);
      return requested.getTime() >= minSampleTurnaroundDate().getTime();
    }, {
      message: `Turnaround date must be at least ${SAMPLE_MIN_TURNAROUND_DAYS} business days from today.`,
    }),
  client_reference_sku: z.string().optional(),
  special_instructions: z.string().optional(),
  ship_to_address_id: z.string().optional(),
}).refine((data) => {
  const sumBreakdown = Object.values(data.size_breakdown || {}).reduce((acc, val) => acc + (Number(val) || 0), 0);
  return sumBreakdown === data.quantity;
}, {
  message: "Total Quantity must equal the sum of quantities in the Size Breakdown.",
  path: ["size_breakdown"],
});

export type SampleRequestFormData = z.infer<typeof sampleRequestSchema>;
