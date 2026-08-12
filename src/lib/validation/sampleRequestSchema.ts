import { z } from "zod";

export const sampleRequestSchema = z.object({
  sample_type: z.enum(["Fit", "Photo", "Pre-Production", "Counter"]),
  fabric_trim_source: z.enum(["Factory Sourced", "Brand Sourced"]),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100, "Sample quantity cannot exceed 100 pcs"),
  size_breakdown: z.record(z.number().int().min(0)),
  tech_pack_url: z.string().min(1, "Tech Pack URL or document link is required for sample requests."),
  reference_photos: z.array(z.string()).optional(),
  turnaround_date: z.string().optional(),
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
