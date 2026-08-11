import { z } from "zod";

export const sampleRequestSchema = z.object({
  sample_type: z.enum(["Fit", "Photo", "Pre-Production", "Counter"]),
  fabric_trim_source: z.enum(["Factory Sourced", "Brand Sourced"]),
  quantity: z.number().int().min(1).max(10, "Sample quantity cannot exceed 10"),
  size_breakdown: z.record(z.number().int().min(0)).refine(
    (data) => {
      const total = Object.values(data).reduce((acc, val) => acc + val, 0);
      return total > 0 && total <= 10;
    },
    {
      message: "Total sample quantity across all sizes must be between 1 and 10.",
    },
  ),
  tech_pack_url: z.string().min(1, "Tech Pack is required for sample requests."),
  reference_photos: z.array(z.string()).optional(),
  turnaround_date: z.string().optional(),
  special_instructions: z.string().optional(),
  ship_to_address_id: z.string().uuid("Please select or enter a valid shipping address."),
});

export type SampleRequestFormData = z.infer<typeof sampleRequestSchema>;
