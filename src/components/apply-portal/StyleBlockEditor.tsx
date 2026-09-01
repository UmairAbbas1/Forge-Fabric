import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
import { getWashTreatmentsFor, OTHER_CUSTOM_OPTION } from "../../lib/wash-compatibility-matrix";
import { useStyleTemplates, useSaveStyleTemplate, type StyleTemplate } from "../../hooks/useStyleTemplates";
import { PrintLayout } from "./PrintLayout";
import {
  Layers,
  Scissors,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  BookmarkPlus,
  FolderOpen,
  Printer,
  X as XIcon,
} from "lucide-react";

// REQ-14 Section 3C: small presentational helpers for the per-service detail
// collection cards. Local to this file — not reused elsewhere.
const DETAIL_ACCENT_STYLES: Record<"blue" | "amber" | "neutral", { border: string; bg: string; title: string }> = {
  blue: { border: "border-blue-200", bg: "bg-blue-50/50", title: "text-blue-950" },
  amber: { border: "border-amber-200", bg: "bg-amber-50/50", title: "text-amber-950" },
  neutral: { border: "border-neutral-200", bg: "bg-neutral-50", title: "text-neutral-700" },
};

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
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const saveTemplate = useSaveStyleTemplate();
  const { data: templates, isLoading: templatesLoading } = useStyleTemplates();

  // Template printing (item 5): reuses the same PrintLayout/@media-print
  // mechanism CutSheetEditor.tsx already uses for a live order's cut sheet —
  // no separate print pathway. Only the currently-selected template's data
  // feeds PrintLayout; window.print() is deferred one tick so that data is
  // actually in the DOM (print-only content, so it's otherwise invisible)
  // before the browser's print dialog opens.
  const [printTemplate, setPrintTemplate] = useState<StyleTemplate | null>(null);
  useEffect(() => {
    if (!printTemplate) return;
    // Scoped to body.printing-style-template (see styles.css) so this
    // template's ticket prints alone, even when StyleBlockEditor is
    // mounted inside CutSheetEditor.tsx, which has its own .print-only
    // block for the live order's cut sheet in the same DOM tree.
    document.body.classList.add('printing-style-template');
    const cleanup = () => {
      document.body.classList.remove('printing-style-template');
      setPrintTemplate(null);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', cleanup);
    };
  }, [printTemplate]);

  const handleConfirmSaveTemplate = async () => {
    if (!templateNameInput.trim()) return;
    await saveTemplate.mutateAsync({ templateName: templateNameInput.trim(), styleBlock: block });
    setTemplateNameInput("");
    setShowSaveTemplateModal(false);
  };

  const handleLoadTemplate = (styleBlock: StyleBlockItem) => {
    // Pre-fill every field from the saved template except this block's own
    // identity (id) — the block being edited keeps its own id, everything
    // else about it becomes the template's configuration. Still editable
    // afterward like any other field on this form.
    const { id: _templateBlockId, ...rest } = styleBlock as any;
    onUpdate(rest);
    setShowLoadTemplateModal(false);
  };

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

  // If the fabric/product category changes after a preset wash type was
  // already selected, and that value is no longer a standard match for the
  // new category, clear it rather than silently leaving an invalid,
  // unflagged combination in place (e.g. "Acid Wash" surviving a switch
  // from Denim to Knit). A deliberate custom/"Other" entry is never cleared
  // by this — free text is valid across every category by design, so
  // there's nothing to invalidate there.
  useEffect(() => {
    if (!isWashStage) return;
    if (block.custom_wash_type !== undefined) return; // deliberate custom entry — never auto-cleared
    if (!block.wash_type) return;
    const validTreatments = getWashTreatmentsFor(block.fabric_type, block.product_type);
    if (!validTreatments.includes(block.wash_type)) {
      onUpdate({ wash_type: "", wash_type_is_default: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.fabric_type, block.product_type]);

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
                setShowLoadTemplateModal(true);
              }}
              className="p-2 text-neutral-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              title="Load from Template"
            >
              <FolderOpen className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTemplateNameInput(block.style_name || "");
                setShowSaveTemplateModal(true);
              }}
              className="p-2 text-neutral-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
              title="Save as Template"
            >
              <BookmarkPlus className="w-4 h-4" />
            </button>

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
                  value={block.custom_wash_type !== undefined ? OTHER_CUSTOM_OPTION : block.wash_type}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === OTHER_CUSTOM_OPTION) {
                      // Preserve any custom text already typed rather than
                      // wiping it if the merchandiser/customer toggles back
                      // and forth between a preset and "Other".
                      onUpdate({ wash_type: block.custom_wash_type || "", custom_wash_type: block.custom_wash_type || "", wash_type_is_default: false });
                    } else {
                      onUpdate({ wash_type: v, custom_wash_type: undefined, wash_type_is_default: false });
                    }
                  }}
                  className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {getWashTreatmentsFor(block.fabric_type, block.product_type).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                  <option value={OTHER_CUSTOM_OPTION}>Other (specify)</option>
                </select>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Options shown match this line's fabric ({block.fabric_type || "unspecified"}
                  {block.product_type === "Denim/Bottoms" ? " · Denim" : ""}).
                </p>
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

      {/* Save as Template modal */}
      {showSaveTemplateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowSaveTemplateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4 text-amber-600" /> Save as Template
              </h3>
              <button type="button" onClick={() => setShowSaveTemplateModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              This saves the fabric, wash, sizes, trims, and all service details of this style block as a reusable
              template you can load into any future order.
            </p>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">
                Template Name
              </label>
              <input
                type="text"
                autoFocus
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                placeholder="e.g. Classic Straight Leg — Indigo Rinse"
                className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {saveTemplate.isError && (
              <p className="text-xs font-medium text-red-600">{(saveTemplate.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!templateNameInput.trim() || saveTemplate.isPending}
                onClick={handleConfirmSaveTemplate}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveTemplate.isPending ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load from Template modal */}
      {showLoadTemplateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowLoadTemplateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-600" /> Load from Template
              </h3>
              <button type="button" onClick={() => setShowLoadTemplateModal(false)} className="text-neutral-400 hover:text-neutral-700">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 shrink-0">
              Loading a template overwrites this block's fabric, wash, sizes, trims, and service details below —
              everything stays editable afterward.
            </p>
            <div className="overflow-y-auto space-y-2 -mx-1 px-1">
              {templatesLoading && (
                <p className="text-xs text-neutral-400 py-4 text-center">Loading templates...</p>
              )}
              {!templatesLoading && (!templates || templates.length === 0) && (
                <p className="text-xs text-neutral-400 py-4 text-center">
                  No saved templates yet. Configure a style block and use "Save as Template" to create one.
                </p>
              )}
              {templates?.map((t) => (
                <div
                  key={t.id}
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-neutral-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate(t.style_block)}
                    className="flex-1 min-w-0 text-left"
                    title="Load this template into the current style block"
                  >
                    <div className="font-bold text-xs text-neutral-900">{t.template_name}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{t.style_block.product_type}</span>
                      {t.style_block.fabric_type && <span>• {t.style_block.fabric_type === 'Other' ? (t.style_block.custom_fabric_type || 'Custom') : t.style_block.fabric_type}</span>}
                      <span>• Saved {new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintTemplate(t)}
                    className="shrink-0 p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                    title="Print this template's cut ticket"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Template printing (item 5): same PrintLayout/@media-print mechanism
          CutSheetEditor.tsx uses for a live order's cut sheet — reused
          as-is against a single saved template's style_block. Portaled to
          document.body: StyleBlockEditor mounts at varying depths across
          its callers (OrderDetailsForm, orders.tsx, SubmissionDetailPanel,
          SampleRequestSubform), some of which have a .no-print ancestor
          somewhere above this component — a .print-only-template rendered
          in-place would inherit that ancestor's display:none during print
          (CSS can't override a hidden ancestor from a descendant), so it
          has to actually leave the tree, not just carry an overriding class. */}
      {printTemplate && createPortal(
        <div className="print-only-template">
          <PrintLayout
            companyName={`Template: ${printTemplate.template_name}`}
            styleBlocks={[printTemplate.style_block]}
            cutSheetData={printTemplate.style_block.cut_sheet_data || {}}
            referenceCode={null}
          />
        </div>,
        document.body
      )}
    </div>
  );
};
