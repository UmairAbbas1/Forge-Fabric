import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useApplyWizard } from "../../../contexts/ApplyWizardContext";
import {
  sampleRequestSchema,
  SampleRequestFormData,
} from "../../../lib/validation/sampleRequestSchema";
import { AddressSelector, AddressData } from "../../shared/AddressSelector";

export const SampleRequestSubform: React.FC = () => {
  const { state } = useApplyWizard();
  const { companyInfo } = state;
  const [addressData, setAddressData] = useState<AddressData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SampleRequestFormData>({
    resolver: zodResolver(sampleRequestSchema),
    defaultValues: {
      sample_type: "Fit",
      fabric_trim_source: "Factory Sourced",
      quantity: 1,
      size_breakdown: {},
      reference_photos: [],
    },
  });

  const onSubmit = async (data: SampleRequestFormData) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      // 1. Ensure we have a company ID. If not, create it.
      let finalCompanyId = companyInfo.company_id;
      if (!finalCompanyId) {
        if (!companyInfo.company_name) {
          throw new Error("Company name is missing from the previous step.");
        }
        const { data: newCompany, error: companyErr } = await supabase
          .from("companies")
          .insert({
            name: companyInfo.company_name,
            brand_name: companyInfo.brand_name || companyInfo.company_name,
            website: companyInfo.website,
            status: "Lead",
            company_type: "Brand",
          })
          .select("id")
          .single();

        if (companyErr) throw new Error("Failed to create company record: " + companyErr.message);
        finalCompanyId = newCompany.id;
      }

      // 2. Handle Address
      let finalAddressId = addressData?.id;
      if (!finalAddressId) {
        if (!addressData) throw new Error("Shipping address is required.");
        const { data: newAddress, error: addrErr } = await supabase
          .from("address_book")
          .insert({
            company_id: finalCompanyId,
            address_type: addressData.address_type || "Sample Receiving",
            recipient_name: addressData.recipient_name,
            company_name_override: addressData.company_name_override,
            street_1: addressData.street_1,
            street_2: addressData.street_2,
            city: addressData.city,
            state: addressData.state,
            postal_code: addressData.postal_code,
            country: addressData.country,
            phone: addressData.phone,
            delivery_instructions: addressData.delivery_instructions,
          })
          .select("id")
          .single();

        if (addrErr) throw new Error("Failed to save shipping address: " + addrErr.message);
        finalAddressId = newAddress.id;
      }

      // 3. Submit Sample Request via RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc("submit_sample_request", {
        p_company_id: finalCompanyId,
        p_sample_type: data.sample_type,
        p_fabric_trim_source: data.fabric_trim_source,
        p_quantity: data.quantity,
        p_size_breakdown: data.size_breakdown,
        p_tech_pack_url: data.tech_pack_url,
        p_ship_to_address_id: finalAddressId,
        p_turnaround_date: data.turnaround_date || null,
        p_special_instructions: data.special_instructions || null,
        p_reference_photos: data.reference_photos || [],
      });

      if (rpcErr) throw new Error("Failed to submit sample request: " + rpcErr.message);

      setSuccess(true);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg((err as Error).message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-8 mt-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center animate-in fade-in zoom-in">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-emerald-900 mb-2">Sample Request Submitted</h3>
        <p className="text-emerald-700">
          Your sample request has been securely routed to our development team.
        </p>
        <button
          className="mt-6 px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700"
          onClick={() => window.location.reload()}
        >
          Start New Intake
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-8 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
        <h3 className="font-bold text-lg mb-6">Sample Requirements</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Sample Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register("sample_type")}
              className="w-full h-11 px-3 rounded-lg border border-neutral-300"
            >
              <option value="Fit">Fit Sample</option>
              <option value="Photo">Photo Sample</option>
              <option value="Pre-Production">Pre-Production (PP) Sample</option>
              <option value="Counter">Counter Sample</option>
            </select>
            {errors.sample_type && (
              <p className="text-red-500 text-xs mt-1">{errors.sample_type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Fabric &amp; Trim Source <span className="text-red-500">*</span>
            </label>
            <select
              {...register("fabric_trim_source")}
              className="w-full h-11 px-3 rounded-lg border border-neutral-300"
            >
              <option value="Factory Sourced">Factory Sourced (Forge &amp; Fabric)</option>
              <option value="Brand Sourced">Brand Sourced (Inbound Materials)</option>
            </select>
            {errors.fabric_trim_source && (
              <p className="text-red-500 text-xs mt-1">{errors.fabric_trim_source.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Total Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              {...register("quantity", { valueAsNumber: true })}
              className="w-full h-11 px-3 rounded-lg border border-neutral-300"
            />
            {errors.quantity && (
              <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Turnaround Date (Optional)
            </label>
            <input
              type="date"
              {...register("turnaround_date")}
              className="w-full h-11 px-3 rounded-lg border border-neutral-300"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
            Size Breakdown <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-4 items-center">
            {/* Minimal size breakdown mock for now, storing in a JSON map */}
            <Controller
              control={control}
              name="size_breakdown"
              render={({ field }) => (
                <div className="flex gap-2">
                  {["S", "M", "L", "XL"].map((size) => (
                    <div key={size} className="flex flex-col items-center">
                      <span className="text-xs font-bold mb-1">{size}</span>
                      <input
                        type="number"
                        min="0"
                        className="w-16 h-10 px-2 text-center rounded-lg border border-neutral-300"
                        value={field.value?.[size] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          field.onChange({ ...field.value, [size]: val });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            />
          </div>
          {errors.size_breakdown && (
            <p className="text-red-500 text-xs mt-1">
              {(errors.size_breakdown as { message?: string })?.message || "Invalid sizes"}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
        <h3 className="font-bold text-lg mb-6">Documents &amp; Shipping</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                Tech Pack URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                {...register("tech_pack_url")}
                placeholder="https://..."
                className="w-full h-11 px-3 rounded-lg border border-neutral-300"
              />
              {errors.tech_pack_url && (
                <p className="text-red-500 text-xs mt-1">{errors.tech_pack_url.message}</p>
              )}
              <p className="text-xs text-neutral-500 mt-1">
                Provide a link to your Tech Pack (Google Drive, Dropbox, Corel, etc.)
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                Special Instructions
              </label>
              <textarea
                {...register("special_instructions")}
                rows={3}
                className="w-full p-3 rounded-lg border border-neutral-300 resize-none"
              />
            </div>
          </div>

          <div>
            <Controller
              control={control}
              name="ship_to_address_id"
              render={({ field }) => (
                <AddressSelector
                  companyId={companyInfo.company_id}
                  value={addressData}
                  onChange={(addr) => {
                    setAddressData(addr);
                    if (addr.id) field.onChange(addr.id);
                    else field.onChange("pending-new-address"); // bypass zod momentarily until submit
                  }}
                />
              )}
            />
            {errors.ship_to_address_id && (
              <p className="text-red-500 text-xs mt-1">{errors.ship_to_address_id.message}</p>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5" />
          {errorMsg}
        </div>
      )}

      <div className="pt-6 border-t border-neutral-100 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all"
        >
          {isSubmitting ? "Submitting..." : "Submit Sample Request"}
          {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
};
