import React, { useState } from "react";
import type {
  StyleBlockItem,
  ProductType,
  FabricType,
} from "../../contexts/ApplyWizardContext";
import { ProductTypeSelector } from "./ProductTypeSelector";
import { FabricMaterialSelector } from "./FabricMaterialSelector";
import { SizeTemplateManager } from "./SizeTemplateManager";
import { SizeMatrixGrid } from "./SizeMatrixGrid";
import { RepeatableTrimsList } from "./RepeatableTrimsList";
import { ServiceScopeSelector } from "./ServiceScopeSelector";
import type { ServiceId } from "../../lib/service-scope-constants";
import {
  Layers,
  Scissors,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";

// REQ-14 Section 3C: small presentational helpers for the per-service detail
// collection cards. Local to this file — not reused elsewhere.
const DETAIL_ACCENT_STYLES: Record<"blue" | "amber" | "neutral", { border: string; bg: string; title: string }> = {
  blue: { border: "border-blue-200", bg: "bg-blue-50/50", title: "text-blue-950" },
  amber: { border: "border-amber-200", bg: "bg-amber-50/50", title: "text-amber-950" },
  neutral: { border: "border-neutral-200", bg: "bg-neutral-50", title: "text-neutral-700" },
};

// Real, selectable wash types — no hardcoded single default. A sensible
// core list plus a free-text "Other" option (see the Wash Type select
// below), not an exhaustive catalog.
const WASH_TYPE_OPTIONS = [
  "Raw / Rigid",
  "Stone Wash",
  "Enzyme Wash",
  "Acid Wash",
  "Garment Dye",
  "Silicone Softener",
];

const ServiceDetailCard: React.FC<{
  title: string;
  accent: "blue" | "amber" | "neutral";
  note?: string;
  children: React.ReactNode;
}> = ({ title, accent, note, children }) => {
  const s = DETAIL_ACCENT_STYLES[accent];
  return (
    <div className={`p-5 rounded-2xl border ${s.border} ${s.bg} space-y-3`}>
      <div>
        <h4 className={`text-xs font-black uppercase tracking-wider ${s.title}`}>{title}</h4>
        {note && <p className="text-[10px] text-neutral-500 mt-0.5">{note}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
};

const DetailField: React.FC<{
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div>
    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">{label}</label>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const DetailSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

export interface StyleBlockEditorProps {
  block: StyleBlockItem;
  blockIndex: number;
  totalBlocks: number;
  onUpdate: (updates: Partial<StyleBlockItem>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

export const StyleBlockEditor: React.FC<StyleBlockEditorProps> = ({
  block,
  blockIndex,
  totalBlocks,
  onUpdate,
  onRemove,
  onDuplicate,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Helper for size matrix changes
  const handleMatrixChange = (
    updatedMatrix: Record<string, number>,
    newTotal: number
  ) => {
    onUpdate({
      size_matrix: updatedMatrix,
      line_total: newTotal,
    });
  };

  const selectedServices = (block.selected_services || []) as ServiceId[];
  const isWashStage = selectedServices.includes("washing_laundry");
  const isFinishStage = selectedServices.includes("pressing_tagging_packing");

  return (
    <div className="bg-white border-2 border-neutral-200/90 rounded-3xl overflow-hidden shadow-sm transition-all animate-in fade-in">
      {/* Style Block Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 bg-neutral-50/90 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-neutral-100/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
            #{blockIndex + 1}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-base text-neutral-900 tracking-tight">
                {block.style_name || `Style Block #${blockIndex + 1}`}
              </h3>
              {block.style_number && (
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {block.style_number}
                </span>
              )}
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800">
                {block.product_type}
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                {block.fabric_type === 'Other' ? (block.custom_fabric_type || 'Custom Material') : block.fabric_type}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 font-medium flex items-center gap-3">
              {block.colorway && <span>Colorway: <strong>{block.colorway}</strong></span>}
              {block.colorway && block.wash_type && <span>•</span>}
              {block.wash_type && <span>Wash: <strong>{block.wash_type}</strong></span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-neutral-400">Style Subtotal</div>
            <div className="text-sm font-black text-blue-700 font-mono">
              {block.line_total || 0} pcs
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-l pl-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              title="Duplicate Style Block"
            >
              <Copy className="w-4 h-4" />
            </button>

            {totalBlocks > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                title="Remove Style Block"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              className="p-2 text-neutral-400 hover:text-neutral-700 rounded-xl"
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Block Body */}
      {isExpanded && (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-150">
          {/* 1. Product Type Selector */}
          <ProductTypeSelector
            value={block.product_type}
            hasEnteredData={Object.values(block.size_matrix || {}).some((v) => v > 0)}
            onChange={(newType, suggestedSizes, suggestedFabric) => {
              onUpdate({
                product_type: newType,
                fabric_type: suggestedFabric,
                size_columns: suggestedSizes,
              });
            }}
          />

          {/* 2. Fabric Material Behavior */}
          <FabricMaterialSelector
            fabricType={block.fabric_type}
            customFabricType={block.custom_fabric_type}
            customFabricTags={block.custom_fabric_tags}
            onChange={(fabricType, customFabricType, customFabricTags) =>
              onUpdate({ fabric_type: fabricType, custom_fabric_type: customFabricType, custom_fabric_tags: customFabricTags })
            }
          />

          {/* 2b. REQ-14: Production Services Requested (replaces the old 4-option Product Process Request dropdown) */}
          <div className="p-5 bg-neutral-50/80 border border-neutral-200 rounded-2xl">
            <ServiceScopeSelector
              selectedServices={selectedServices}
              onChange={(services, stages) =>
                onUpdate({
                  selected_services: services,
                  selected_stages: stages,
                  starting_stage: stages[0],
                })
              }
            />
          </div>

          {/* 2c. REQ-14 Section 3C: dynamic per-service detail collection.
              Optional at intake — the merchandiser fills any blanks during
              submission review (Section 3E). fabric_type is intentionally
              NOT duplicated here even though Section 3C lists it under
              Cutting details — the block-level "Fabric Material Behavior"
              selector above already asks that exact question once. */}
          {selectedServices.includes("cutting_bundling") && (
            <ServiceDetailCard title="Cutting & Bundling Details" accent="blue">
              <DetailField
                label="Fabric Weight (GSM / oz)"
                value={block.cutting_details?.fabric_weight || ""}
                onChange={(v) => onUpdate({ cutting_details: { ...block.cutting_details, fabric_weight: v } })}
                placeholder="e.g. 14oz"
              />
              <DetailField
                label="Estimated Yardage"
                type="number"
                value={block.cutting_details?.estimated_yardage ?? ""}
                onChange={(v) => onUpdate({ cutting_details: { ...block.cutting_details, estimated_yardage: v === "" ? undefined : Number(v) } })}
                placeholder="e.g. 450"
              />
              <DetailField
                label="Marker Notes"
                value={block.cutting_details?.marker_notes || ""}
                onChange={(v) => onUpdate({ cutting_details: { ...block.cutting_details, marker_notes: v } })}
                placeholder="Layout / nesting notes"
              />
              <DetailField
                label="Special Cutting Instructions"
                value={block.cutting_details?.special_instructions || ""}
                onChange={(v) => onUpdate({ cutting_details: { ...block.cutting_details, special_instructions: v } })}
                placeholder="Optional"
              />
            </ServiceDetailCard>
          )}

          {selectedServices.includes("cutting_bundling") && (
            <ServiceDetailCard title="Fabric Receiving Details" accent="neutral" note="Included automatically with Cutting & Bundling">
              <DetailField
                label="Number of Fabric Rolls Expected"
                type="number"
                value={block.receiving_details?.fabric_roll_count ?? ""}
                onChange={(v) => onUpdate({ receiving_details: { ...block.receiving_details, fabric_roll_count: v === "" ? undefined : Number(v) } })}
                placeholder="e.g. 12"
              />
              <DetailField
                label="Supplier Name"
                value={block.receiving_details?.supplier_name || ""}
                onChange={(v) => onUpdate({ receiving_details: { ...block.receiving_details, supplier_name: v } })}
                placeholder="Fabric mill / supplier"
              />
              <DetailField
                label="Expected Delivery Date to Factory"
                type="date"
                value={block.receiving_details?.expected_delivery_date || ""}
                onChange={(v) => onUpdate({ receiving_details: { ...block.receiving_details, expected_delivery_date: v } })}
              />
              <DetailSelect
                label="Inspection Level"
                value={block.receiving_details?.inspection_level || ""}
                onChange={(v) => onUpdate({ receiving_details: { ...block.receiving_details, inspection_level: v as any } })}
                options={["Standard", "Premium"]}
              />
            </ServiceDetailCard>
          )}

          {selectedServices.includes("sewing_assembly") && (
            <ServiceDetailCard title="Sewing Assembly Details" accent="blue">
              <DetailField
                label="Thread Color Specs"
                value={block.sewing_details?.thread_color_specs || ""}
                onChange={(v) => onUpdate({ sewing_details: { ...block.sewing_details, thread_color_specs: v } })}
                placeholder="e.g. Tex 105 Golden Tan"
              />
              <DetailSelect
                label="Stitch Type"
                value={block.sewing_details?.stitch_type || ""}
                onChange={(v) => onUpdate({ sewing_details: { ...block.sewing_details, stitch_type: v as any } })}
                options={["Single Needle", "Double Needle", "Chain Stitch", "Other"]}
              />
              <DetailField
                label="Label Placement Notes"
                value={block.sewing_details?.label_placement_notes || ""}
                onChange={(v) => onUpdate({ sewing_details: { ...block.sewing_details, label_placement_notes: v } })}
                placeholder="Optional"
              />
            </ServiceDetailCard>
          )}

          {isWashStage && (
            <ServiceDetailCard title="Washing & Laundry Details" accent="amber">
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">
                  Wash Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={block.custom_wash_type !== undefined ? "Other" : block.wash_type}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "Other") {
                      // Preserve any custom text already typed rather than
                      // wiping it if the merchandiser/customer toggles back
                      // and forth between a preset and "Other".
                      onUpdate({ wash_type: block.custom_wash_type || "", custom_wash_type: block.custom_wash_type || "" });
                    } else {
                      onUpdate({ wash_type: v, custom_wash_type: undefined });
                    }
                  }}
                  className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {WASH_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                  <option value="Other">Other (specify)</option>
                </select>
              </div>
              {block.custom_wash_type !== undefined && (
                <DetailField
                  label="Custom Wash Type"
                  value={block.custom_wash_type}
                  onChange={(v) => onUpdate({ wash_type: v, custom_wash_type: v })}
                  placeholder="Describe the wash type"
                />
              )}
              <DetailField
                label="Target Color / Shade"
                value={block.wash_details?.target_shade || ""}
                onChange={(v) => onUpdate({ wash_details: { ...block.wash_details, target_shade: v } })}
                placeholder="e.g. Mid-Blue Vintage"
              />
              <DetailField
                label="Shrinkage Tolerance"
                value={block.wash_details?.shrinkage_tolerance || ""}
                onChange={(v) => onUpdate({ wash_details: { ...block.wash_details, shrinkage_tolerance: v } })}
                placeholder="e.g. ±3%"
              />
              <DetailField
                label="Hand-Feel Target"
                value={block.wash_details?.hand_feel_target || ""}
                onChange={(v) => onUpdate({ wash_details: { ...block.wash_details, hand_feel_target: v } })}
                placeholder="e.g. Soft, brushed"
              />
            </ServiceDetailCard>
          )}

          {selectedServices.includes("finishing_effects") && (
            <ServiceDetailCard title="Finishing & Effects Details" accent="blue">
              <DetailField
                label="Laser Pattern File Reference"
                value={block.finishing_details?.laser_pattern_ref || ""}
                onChange={(v) => onUpdate({ finishing_details: { ...block.finishing_details, laser_pattern_ref: v } })}
                placeholder="Optional file ref"
              />
              <DetailField
                label="Ozone Level"
                value={block.finishing_details?.ozone_level || ""}
                onChange={(v) => onUpdate({ finishing_details: { ...block.finishing_details, ozone_level: v } })}
                placeholder="e.g. Level 2"
              />
              <DetailField
                label="3D Crease Pattern"
                value={block.finishing_details?.crease_pattern_3d || ""}
                onChange={(v) => onUpdate({ finishing_details: { ...block.finishing_details, crease_pattern_3d: v } })}
                placeholder="Optional"
              />
              <DetailField
                label="Spray Details"
                value={block.finishing_details?.spray_details || ""}
                onChange={(v) => onUpdate({ finishing_details: { ...block.finishing_details, spray_details: v } })}
                placeholder="Optional"
              />
              <DetailSelect
                label="Distressing Level"
                value={block.finishing_details?.distressing_level || ""}
                onChange={(v) => onUpdate({ finishing_details: { ...block.finishing_details, distressing_level: v as any } })}
                options={["Light", "Medium", "Heavy"]}
              />
            </ServiceDetailCard>
          )}

          {isFinishStage && (
            <ServiceDetailCard title="Pressing, Tagging & Packing Details" accent="amber">
              <DetailField
                label="Hangtag Specs"
                value={block.packing_details?.hangtag_specs || ""}
                onChange={(v) => onUpdate({ packing_details: { ...block.packing_details, hangtag_specs: v } })}
                placeholder="e.g. Standard hangtag w/ barcode"
              />
              <DetailField
                label="Care Label Text"
                value={block.packing_details?.care_label_text || ""}
                onChange={(v) => onUpdate({ packing_details: { ...block.packing_details, care_label_text: v } })}
                placeholder="Optional"
              />
              <DetailSelect
                label="Folding Method"
                value={block.packing_details?.folding_method || ""}
                onChange={(v) => onUpdate({ packing_details: { ...block.packing_details, folding_method: v as any } })}
                options={["Flat Fold", "Hanger"]}
              />
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 mt-1">
                <input
                  type="checkbox"
                  checked={!!block.packing_details?.poly_bag_required}
                  onChange={(e) => onUpdate({ packing_details: { ...block.packing_details, poly_bag_required: e.target.checked } })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Individual poly bag required
              </label>
              <DetailField
                label="Carton Specs"
                value={block.packing_details?.carton_specs || ""}
                onChange={(v) => onUpdate({ packing_details: { ...block.packing_details, carton_specs: v } })}
                placeholder="e.g. Master carton, 25 pcs/box"
              />
            </ServiceDetailCard>
          )}

          {/* 3. Work Order Identity Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Style Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Paul Straight Leg Jean"
                value={block.style_name}
                onChange={(e) => onUpdate({ style_name: e.target.value })}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Style / SKU Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. SKU-2026-RAW"
                value={block.style_number}
                onChange={(e) => onUpdate({ style_number: e.target.value })}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-xl text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Colorway / Color Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Deep Indigo"
                value={block.colorway}
                onChange={(e) => onUpdate({ colorway: e.target.value })}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 3b. Reference cut-sheet audit fields: Gender/Fit Category, Inseam, Comment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Gender / Fit Category
              </label>
              <select
                value={block.gender_category || ''}
                onChange={(e) => onUpdate({ gender_category: (e.target.value || undefined) as any })}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="Mens">Mens</option>
                <option value="Womens">Womens</option>
                <option value="Unisex">Unisex</option>
                <option value="Kids">Kids</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Inseam
              </label>
              <input
                type="text"
                placeholder="e.g. 32in"
                value={block.inseam || ''}
                onChange={(e) => onUpdate({ inseam: e.target.value })}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Comment
              </label>
              <input
                type="text"
                placeholder="e.g. RUSH"
                value={block.comment || ''}
                onChange={(e) => onUpdate({ comment: e.target.value })}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Standard CAD Size Matrix */}
          <div className="space-y-4 pt-2 border-t border-neutral-100">
            <SizeTemplateManager
              currentSizes={block.size_columns}
              onSizesChange={(newSizes) => onUpdate({ size_columns: newSizes })}
            />

            <SizeMatrixGrid
              sizes={block.size_columns}
              value={block.size_matrix}
              onChange={handleMatrixChange}
            />
          </div>

          {/* 5. Repeatable Trims BOM */}
          <div className="pt-2 border-t border-neutral-100">
            <RepeatableTrimsList
              productType={block.product_type}
              trims={block.trims_bom || []}
              onChange={(newTrims) => onUpdate({ trims_bom: newTrims })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
