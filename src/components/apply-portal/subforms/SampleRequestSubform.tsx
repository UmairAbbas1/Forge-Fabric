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
import { FabricMaterialSelector } from "../FabricMaterialSelector";
import { SizeTemplateManager, STANDARD_SIZE_TEMPLATES } from "../SizeTemplateManager";
import { SizeMatrixGrid } from "../SizeMatrixGrid";

export const SampleRequestSubform: React.FC = () => {
  const { user } = useAuth();
  const { state, updateStyleBlock, updateSampleDetails, updateCompanyInfo, setStep } = useApplyWizard();
  const { companyInfo } = state;
  const [addressData, setAddressData] = useState<AddressData | null>(
    companyInfo.shipping_street
      ? {
          id: companyInfo.shipping_address_id,
          address_type: "Sample Receiving",
          recipient_name: companyInfo.contact_name || "",
          street_1: companyInfo.shipping_street,
          city: companyInfo.shipping_city || "",
          state: companyInfo.shipping_state || "",
          postal_code: companyInfo.shipping_zip || "",
          country: companyInfo.shipping_country || "",
          phone: companyInfo.contact_phone,
        }
      : null
  );

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
  //
  // styleBlocks[0] always exists with non-empty size_columns/line_total —
  // INITIAL_WIZARD_STATE seeds it with the Bulk flow's own mens-jeans
  // defaults, since that slot is shared between both flows. Using
  // size_columns.length alone to decide "is there real sample data here to
  // hydrate from" would treat those untouched Bulk defaults as if this
  // sample form had already been filled in, seeding a numeric 28-40 grid
  // while size_breakdown's own hydration (below) correctly falls back to
  // {} — a genuine columns/values mismatch. style_name is only ever set by
  // this form's own onContinue, so it's the reliable "was this really
  // filled in as a sample before" signal.
  const existingBlock = state.styleBlocks?.[0];
  const hasExistingSampleData = Boolean(existingBlock?.style_name);
  const [activeSizes, setActiveSizes] = useState<string[]>(
    hasExistingSampleData && existingBlock?.size_columns?.length ? existingBlock.size_columns : STANDARD_SIZE_TEMPLATES[1].sizes
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SampleRequestFormData>({
    resolver: dynamicResolver.current,
    // Hydrated from wizard state (styleBlocks[0] / sampleDetails) so
    // navigating Back from Step 3/4/5 and returning here doesn't lose what
    // was already entered — mirrors how CompanyInfoForm/OrderDetailsForm
    // already persist across step navigation via the same shared context.
    defaultValues: {
      sample_type: state.sampleDetails?.sample_type || "Fit",
      fabric_trim_source: state.sampleDetails?.fabric_trim_source || "Factory Sourced",
      style_name: existingBlock?.style_name || "",
      style_description: existingBlock?.style_description || "",
      colorway: existingBlock?.colorway || "",
      fabric_type: existingBlock?.fabric_type || "Woven",
      custom_fabric_type: existingBlock?.custom_fabric_type || "",
      quantity: existingBlock?.line_total || 4,
      size_breakdown: existingBlock?.size_matrix && Object.keys(existingBlock.size_matrix).length > 0
        ? existingBlock.size_matrix
        : { S: 1, M: 2, L: 1 },
      turnaround_date: state.sampleDetails?.turnaround_date || "",
      client_reference_sku: state.sampleDetails?.client_reference_sku || "",
      tech_pack_url: state.sampleDetails?.tech_pack_url || "",
      special_instructions: state.sampleDetails?.special_instructions || "",
      reference_photos: state.sampleDetails?.reference_photos || [],
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

  // Item 5/6 superseded: this no longer submits directly. It writes Step 2's
  // sample specification data into the same shared wizard state slots the
  // Bulk flow's OrderDetailsForm already populates (styleBlocks[0] for
  // style/fabric/size data, sampleDetails for the sample-only fields, and
  // companyInfo.shipping_* for the address), then advances to Step 3 — the
  // real, shared CutSheetEditor. Actual submission now happens once, from
  // Step 5's ReviewSummary, via the same useSubmitApplication() hook the
  // Bulk flow uses (see useApplySubmission.ts's sample_request branch).
  const onContinue = (data: SampleRequestFormData) => {
    const blockId = state.styleBlocks?.[0]?.id || "sb-default-1";
    updateStyleBlock(blockId, {
      style_name: data.style_name,
      style_description: data.style_description || "",
      colorway: data.colorway,
      fabric_type: data.fabric_type,
      custom_fabric_type: data.fabric_type === "Other" ? data.custom_fabric_type : undefined,
      size_columns: activeSizes,
      size_matrix: data.size_breakdown || {},
      line_total: data.quantity,
    });

    updateSampleDetails({
      sample_type: data.sample_type,
      fabric_trim_source: data.fabric_trim_source,
      turnaround_date: data.turnaround_date,
      client_reference_sku: data.client_reference_sku,
      special_instructions: data.special_instructions || "",
      tech_pack_url: data.tech_pack_url || "",
      reference_photos: data.reference_photos || [],
    });

    if (addressData?.street_1) {
      updateCompanyInfo({
        shipping_address_id: addressData.id,
        shipping_street: addressData.street_1,
        shipping_city: addressData.city,
        shipping_state: addressData.state,
        shipping_zip: addressData.postal_code,
        shipping_country: addressData.country,
      });
    }

    // Jumps straight to Step 3 (Cut Sheet Ticket), not a plain nextStep().
    // This form actually renders inside wizard step 1 (conditionally, from
    // CompanyInfoForm.tsx) rather than a distinct step 2 of its own — the
    // real step 2 is OrderDetailsForm.tsx, a Bulk-only multi-style/Blanket
    // PO screen that was never meant for samples and stays untouched here.
    setStep(3);
  };

  return (
    <div className="mt-6 space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <h3 className="font-extrabold text-neutral-900 text-base mb-5 flex items-center gap-2">
          <Beaker className="w-5 h-5 text-blue-600" />
          <span>Sample Specifications &amp; Requirements</span>
        </h3>

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

        {/* Continue Action — advances to the shared Step 3 Cut Sheet Ticket,
            same as the Bulk flow. Submission itself happens once, at the
            end, from Step 5. */}
        <div className="mt-8 pt-5 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-blue-600" />
            <span>Next: production cut ticket, documents, and final review before this reaches the Merchandiser Submissions inbox.</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(onContinue)(e);
            }}
            className="w-full sm:w-auto h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
          >
            <span>Continue to Cut Sheet Ticket</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
