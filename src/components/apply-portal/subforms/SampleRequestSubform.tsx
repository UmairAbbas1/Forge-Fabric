import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, CheckCircle2, Beaker, MapPin, Truck } from "lucide-react";
import { supabase, isRealSupabase } from "../../../lib/supabase";
import { useApplyWizard } from "../../../contexts/ApplyWizardContext";
import {
  buildSampleRequestSchema,
  SampleRequestFormData,
  SAMPLE_MAX_QUANTITY,
  SAMPLE_MIN_TURNAROUND_DAYS,
  minSampleTurnaroundDate,
} from "../../../lib/validation/sampleRequestSchema";
import { AddressSelector, AddressData } from "../../shared/AddressSelector";
import { useAuth } from "../../../hooks/useAuth";
import { persistCompanyAndAddress } from "../../../lib/applyPortalCompanySync";
import { FabricMaterialSelector } from "../FabricMaterialSelector";
import { SizeTemplateManager, STANDARD_SIZE_TEMPLATES } from "../SizeTemplateManager";
import { SizeMatrixGrid } from "../SizeMatrixGrid";

export const SampleRequestSubform: React.FC = () => {
  const { user } = useAuth();
  const { state } = useApplyWizard();
  const { companyInfo } = state;
  const [addressData, setAddressData] = useState<AddressData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedRef, setGeneratedRef] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // REQ-04: turnaround/cap are configurable via Admin Settings (tenant_branding);
  // start with the hardcoded defaults so the form is usable immediately, then
  // sync to the live settings row once fetched.
  const [sampleConfig, setSampleConfig] = useState({
    maxQuantity: SAMPLE_MAX_QUANTITY,
    minTurnaroundDays: SAMPLE_MIN_TURNAROUND_DAYS,
  });

  useEffect(() => {
    if (!isRealSupabase) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("tenant_config")
          .select("sample_min_turnaround_days, sample_max_quantity")
          .limit(1)
          .maybeSingle();
        if (data) {
          setSampleConfig({
            maxQuantity: Number(data.sample_max_quantity) || SAMPLE_MAX_QUANTITY,
            minTurnaroundDays: Number(data.sample_min_turnaround_days) || SAMPLE_MIN_TURNAROUND_DAYS,
          });
        }
      } catch (e) {
        console.warn("Could not load configurable sample limits, using defaults:", e);
      }
    })();
  }, []);

  const activeSchema = useMemo(
    () => buildSampleRequestSchema(sampleConfig.maxQuantity, sampleConfig.minTurnaroundDays),
    [sampleConfig.maxQuantity, sampleConfig.minTurnaroundDays]
  );
  // useForm's resolver is captured once at first render, so route validation
  // through a stable function that always re-reads the latest schema — this
  // way the configured limits take effect without needing to remount the form.
  const schemaRef = useRef(activeSchema);
  schemaRef.current = activeSchema;
  const dynamicResolver = useRef(async (values: any, context: any, options: any) =>
    zodResolver(schemaRef.current)(values, context, options)
  );

  const MIN_TURNAROUND_ISO = minSampleTurnaroundDate(sampleConfig.minTurnaroundDays).toISOString().slice(0, 10);

  // Item 6: active size columns now come from the same SizeTemplateManager
  // preset list StyleBlockEditor.tsx (Bulk flow) uses — inherits whatever
  // preset cleanup (e.g. XXL/3XL removal) was done there, instead of a
  // second, separately-maintained hardcoded size list.
  const [activeSizes, setActiveSizes] = useState<string[]>(STANDARD_SIZE_TEMPLATES[1].sizes);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SampleRequestFormData>({
    resolver: dynamicResolver.current,
    defaultValues: {
      sample_type: "Fit",
      fabric_trim_source: "Factory Sourced",
      style_name: "",
      style_description: "",
      colorway: "",
      fabric_type: "Woven",
      custom_fabric_type: "",
      quantity: 4,
      size_breakdown: { S: 1, M: 2, L: 1 },
      reference_photos: [],
    },
  });

  const watchQuantity = watch("quantity") || 0;
  const watchSizeBreakdown = watch("size_breakdown") || {};
  const watchFabricType = watch("fabric_type");
  const watchCustomFabricType = watch("custom_fabric_type");

  const sumSizeBreakdown = Object.values(watchSizeBreakdown).reduce(
    (acc, val) => acc + (Number(val) || 0),
    0
  );

  const isSumMatched = sumSizeBreakdown === watchQuantity;

  // Item 6: manual entry only — the customer sets each size's quantity by
  // hand via SizeMatrixGrid; no Auto-Distribute. Mismatch against the
  // stated total quantity is enforced by buildSampleRequestSchema's
  // .refine() (shows as errors.size_breakdown below), not a silent balance.
  const handleSizeMatrixChange = (matrix: Record<string, number>) => {
    setValue("size_breakdown", matrix, { shouldValidate: true, shouldDirty: true });
  };

  const handleSizeColumnsChange = (sizes: string[]) => {
    setActiveSizes(sizes);
    // Drop quantities for any size column that was removed; keep the rest.
    const current = watch("size_breakdown") || {};
    const trimmed: Record<string, number> = {};
    sizes.forEach((sz) => { trimmed[sz] = current[sz] || 0; });
    setValue("size_breakdown", trimmed, { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = async (data: SampleRequestFormData) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const companyName = companyInfo.company_name || companyInfo.brand_name || user?.customer_name || (user as any)?.company_name || "Brand Partner";
      const brandName = companyInfo.brand_name || companyInfo.company_name || user?.customer_name || companyName;
      const contactName = companyInfo.contact_name || user?.full_name || (user?.email ? user.email.split("@")[0] : "Brand Representative");
      const contactEmail = companyInfo.contact_email || user?.email || "contact@forgefabric.com";
      const contactPhone = companyInfo.contact_phone || user?.contact_phone || "+1 (555) 019-2831";
      const refCode = `SR-${Date.now().toString().slice(-6)}`;
      setGeneratedRef(refCode);

      // 1. Item 3: resolve/create the company, contact, and shipping
      // address via the same shared helper the Bulk Order flow uses — one
      // save mechanism, not two. Also links a brand-new company back to
      // this user's profile so their next order (either flow) prefills.
      let finalCompanyId = companyInfo.company_id || user?.company_id;
      if (isRealSupabase) {
        const syncResult = await persistCompanyAndAddress(
          { ...companyInfo, company_name: companyName, brand_name: brandName, contact_name: contactName, contact_email: contactEmail, contact_phone: contactPhone },
          addressData,
          user?.id,
          finalCompanyId
        );
        if (syncResult.companyId) finalCompanyId = syncResult.companyId;
      }

      // 2. Insert into apply_submissions table (Primary Intake Pipeline)
      let insertedSubmissionId = `sub-sr-${Date.now()}`;
      if (isRealSupabase) {
        try {
          const { data: subData, error: subErr } = await supabase
            .from("apply_submissions")
            .insert({
              company_name: companyName,
              brand_name: brandName,
              contact_name: contactName,
              contact_email: contactEmail,
              contact_phone: contactPhone,
              website: companyInfo.website || "",
              submission_type: "sample_request",
              source: "apply_portal",
              status: "pending_review",
              client_notes: data.special_instructions || "Sample request submitted via Customer Order Intake flow.",
              product_type: `${data.sample_type} Sample`,
              fabric_type: data.fabric_trim_source,
              apply_reference_code: refCode,
              estimated_quantity: data.quantity || 1,
              size_breakdown: data.size_breakdown || {},
              // Item 5: real garment-definition detail, stored the same
              // shape as the Bulk flow's style_blocks (a single entry here,
              // matching a sample's single-style scope) rather than a
              // second, divergent schema.
              style_blocks: [{
                style_name: data.style_name,
                style_description: data.style_description || "",
                colorway: data.colorway,
                fabric_type: data.fabric_type,
                custom_fabric_type: data.fabric_type === "Other" ? data.custom_fabric_type : undefined,
                size_columns: activeSizes,
                size_matrix: data.size_breakdown || {},
                line_total: data.quantity,
              }],
              tech_pack_url: data.tech_pack_url || "",
              client_reference_sku: data.client_reference_sku || null,
              sample_status: "Sample_Requested",
              turnaround_date: data.turnaround_date || null,
              billing_street: addressData?.street_1 || companyInfo.billing_street,
              billing_city: addressData?.city || companyInfo.billing_city,
              billing_state: addressData?.state || companyInfo.billing_state,
              billing_zip: addressData?.postal_code || companyInfo.billing_zip,
              billing_country: addressData?.country || companyInfo.billing_country,
              shipping_street: addressData?.street_1 || companyInfo.shipping_street,
              shipping_city: addressData?.city || companyInfo.shipping_city,
              shipping_state: addressData?.state || companyInfo.shipping_state,
              shipping_zip: addressData?.postal_code || companyInfo.shipping_zip,
              shipping_country: addressData?.country || companyInfo.shipping_country,
            })
            .select("id, apply_reference_code")
            .single();

          if (!subErr && subData) {
            insertedSubmissionId = subData.id;
            if (subData.apply_reference_code) {
              setGeneratedRef(subData.apply_reference_code);
            }
          }
        } catch (subError) {
          console.warn("Direct apply_submissions insert encountered:", subError);
        }

        // 3. Insert into sample_requests table if company_id is resolved
        try {
          if (finalCompanyId) {
            const mappedSampleType = ["Fit", "Photo", "Pre-Production", "Counter"].includes(data.sample_type)
              ? data.sample_type
              : "Fit";

            await supabase.from("sample_requests").insert({
              company_id: finalCompanyId,
              sample_type: mappedSampleType,
              fabric_trim_source: data.fabric_trim_source || "Factory Sourced",
              style_name: data.style_name,
              style_description: data.style_description || null,
              colorway: data.colorway,
              fabric_type: data.fabric_type,
              custom_fabric_type: data.fabric_type === "Other" ? data.custom_fabric_type : null,
              quantity: data.quantity || 1,
              size_breakdown: data.size_breakdown || {},
              tech_pack_url: data.tech_pack_url || "",
              turnaround_date: data.turnaround_date || null,
              special_instructions: data.special_instructions || "",
              status: "submitted",
              sample_status: "Sample_Requested",
              client_reference_sku: data.client_reference_sku || null,
              reference_photos: data.reference_photos || [],
            });
          }
        } catch (srErr) {
          console.warn("Could not insert directly to sample_requests table:", srErr);
        }
      }

      // 4. Update Local Storage Cache
      const newRecord = {
        id: insertedSubmissionId,
        company_name: companyName,
        brand_name: brandName,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        website: companyInfo.website,
        submission_type: "sample_request",
        status: "pending_review",
        product_type: `${data.sample_type} Sample`,
        estimated_quantity: data.quantity,
        size_breakdown: data.size_breakdown,
        tech_pack_url: data.tech_pack_url,
        client_notes: data.special_instructions,
        apply_reference_code: refCode,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const cachedStr = localStorage.getItem("forge_submissions_cache");
        const cached = cachedStr ? JSON.parse(cachedStr) : [];
        localStorage.setItem("forge_submissions_cache", JSON.stringify([newRecord, ...cached]));
      } catch (e) {
        console.warn("Could not cache to localStorage:", e);
      }

      // 5. Broadcast Real-time Event for Instant Dashboard Reactivity
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("forge_submission_created", { detail: newRecord }));
      }

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
      <div className="p-8 mt-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center animate-in fade-in zoom-in">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-xl font-extrabold text-emerald-900 mb-1">Sample Request Submitted Successfully</h3>
        <p className="text-xs font-mono font-bold text-emerald-800 mb-2">
          Tracking Reference: <span className="bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-950">{generatedRef}</span>
        </p>
        <p className="text-emerald-700 text-xs max-w-md mx-auto">
          Your sample specifications have been securely routed to our development team and synced to the Submissions Pipeline.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            className="px-6 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-sm transition-all"
            onClick={() => window.location.reload()}
          >
            Start Another Request
          </button>
          <a
            href="/submissions"
            className="px-6 py-2.5 bg-neutral-900 text-white font-bold text-xs rounded-xl hover:bg-black shadow-sm transition-all inline-flex items-center gap-1.5"
          >
            View in Submissions Inbox <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <h3 className="font-extrabold text-neutral-900 text-base mb-5 flex items-center gap-2">
          <Beaker className="w-5 h-5 text-blue-600" />
          <span>Sample Specifications &amp; Requirements</span>
        </h3>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Sample Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register("sample_type")}
              className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Fit">Fit Sample</option>
              <option value="Proto">Proto / Development Sample</option>
              <option value="Photo">Photo / Lookbook Sample</option>
              <option value="Pre-Production">Pre-Production (PP) Sample</option>
              <option value="Counter">Counter / Wash Duplicate Sample</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Fabric &amp; Trim Sourcing <span className="text-red-500">*</span>
            </label>
            <select
              {...register("fabric_trim_source")}
              className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Factory Sourced">Factory Sourced (Forge &amp; Fabric Standard BOM)</option>
              <option value="Brand Sourced">Brand Sourced (Customer Supplying Cut Goods / Trims)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Style Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Vintage Wash 5-Pocket Jean"
              {...register("style_name")}
              className={`w-full h-11 px-3 rounded-xl border bg-white text-xs font-bold text-neutral-800 focus:ring-2 outline-none ${
                errors.style_name ? "border-red-400 bg-red-50/20 focus:ring-red-500" : "border-neutral-300 focus:ring-blue-500"
              }`}
            />
            {errors.style_name && (
              <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.style_name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Colorway <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Raw Indigo"
              {...register("colorway")}
              className={`w-full h-11 px-3 rounded-xl border bg-white text-xs font-bold text-neutral-800 focus:ring-2 outline-none ${
                errors.colorway ? "border-red-400 bg-red-50/20 focus:ring-red-500" : "border-neutral-300 focus:ring-blue-500"
              }`}
            />
            {errors.colorway && (
              <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.colorway.message}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Style Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 13.5oz raw selvedge, straight leg, mid-rise"
              {...register("style_description")}
              className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <FabricMaterialSelector
              fabricType={watchFabricType}
              customFabricType={watchCustomFabricType}
              onChange={(fabricType, customFabricType) => {
                setValue("fabric_type", fabricType, { shouldValidate: true });
                setValue("custom_fabric_type", customFabricType, { shouldValidate: true });
              }}
            />
            {errors.custom_fabric_type && (
              <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.custom_fabric_type.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Sample Quantity (Total Pieces) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={sampleConfig.maxQuantity}
              {...register("quantity", { valueAsNumber: true })}
              className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Max {sampleConfig.maxQuantity} pcs — larger runs must go through New Bulk Production Order.
            </p>
            {errors.quantity && (
              <p className="text-[10px] text-red-600 font-bold mt-1">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Target Turnaround Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              min={MIN_TURNAROUND_ISO}
              {...register("turnaround_date")}
              className={`w-full h-11 px-3 rounded-xl border bg-white text-xs font-bold text-neutral-800 focus:ring-2 outline-none ${
                errors.turnaround_date
                  ? "border-red-400 bg-red-50/20 focus:ring-red-500"
                  : "border-neutral-300 focus:ring-blue-500"
              }`}
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Minimum {sampleConfig.minTurnaroundDays}-business-day turnaround from today.
            </p>
            {errors.turnaround_date && (
              <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.turnaround_date.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Your Reference SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. WM-SS26-01"
              {...register("client_reference_sku")}
              className={`w-full h-11 px-3 rounded-xl border bg-white text-xs font-mono font-bold text-neutral-800 focus:ring-2 outline-none ${
                errors.client_reference_sku
                  ? "border-red-400 bg-red-50/20 focus:ring-red-500"
                  : "border-neutral-300 focus:ring-blue-500"
              }`}
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Your internal style code. Forge &amp; Fabric will assign the official Master SKU &amp; Quote Number.
            </p>
            {errors.client_reference_sku && (
              <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.client_reference_sku.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Tech Pack / Spec Sheet URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/... or Tech Pack cloud link"
              {...register("tech_pack_url")}
              className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
              Special Instructions / Wash Notes
            </label>
            <textarea
              rows={3}
              placeholder="Specify yarn counts, stitch density, wash resin treatments, hardware placements, or critical fit points..."
              {...register("special_instructions")}
              className="w-full p-3 rounded-xl border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Size Breakdown — item 6: shared SizeTemplateManager/SizeMatrixGrid
            (same components the Bulk flow uses), manual entry only, no
            Auto-Distribute. Mismatch against the stated quantity is a hard
            submission-blocking error via buildSampleRequestSchema's refine. */}
        <div className="mt-6 pt-5 border-t border-neutral-100 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
            Size Breakdown Distribution <span className="text-red-500">*</span>
          </label>

          <SizeTemplateManager
            currentSizes={activeSizes}
            onSizesChange={handleSizeColumnsChange}
          />

          <SizeMatrixGrid
            sizes={activeSizes}
            value={watchSizeBreakdown}
            onChange={handleSizeMatrixChange}
          />

          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition-colors ${
              isSumMatched
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            {isSumMatched ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>
              Size Breakdown Total: {sumSizeBreakdown} pcs / Order Quantity: {watchQuantity} pcs
              {!isSumMatched && ` — ${sumSizeBreakdown > watchQuantity ? "over" : "short"} by ${Math.abs(watchQuantity - sumSizeBreakdown)} pcs. Adjust size quantities to match exactly.`}
            </span>
          </div>

          {errors.size_breakdown && (
            <p className="text-red-600 text-xs mt-2 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {(errors.size_breakdown as { message?: string })?.message || `Size breakdown total (${sumSizeBreakdown}) doesn't match order quantity (${watchQuantity}) — please adjust.`}
            </p>
          )}
        </div>

        {/* Shipping Address */}
        <div className="mt-6 pt-5 border-t border-neutral-100">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-neutral-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Sample Delivery Shipping Destination
            </h4>
          </div>
          <AddressSelector
            value={addressData}
            onChange={(addr: AddressData) => setAddressData(addr)}
            companyId={companyInfo.company_id || user?.company_id}
          />
        </div>

        {/* Submit Action */}
        <div className="mt-8 pt-5 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-blue-600" />
            <span>Sample requests automatically route to Merchandiser Submissions inbox.</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(onSubmit)(e);
            }}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
          >
            {isSubmitting ? (
              <span>Submitting Sample Request...</span>
            ) : (
              <>
                <span>Submit Sample Request</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
