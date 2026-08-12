import React, { useState } from "react";
import type {
  StyleBlockItem,
  ProductType,
  FabricType,
  LaundryBatchItem,
  FinishingBatchItem,
} from "../../contexts/ApplyWizardContext";
import { ProductTypeSelector } from "./ProductTypeSelector";
import { SizeTemplateManager } from "./SizeTemplateManager";
import { SizeMatrixGrid } from "./SizeMatrixGrid";
import { RepeatableTrimsList } from "./RepeatableTrimsList";
import {
  Layers,
  Scissors,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Droplet,
  Package,
} from "lucide-react";

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

  // Laundry batch handlers
  const handleAddLaundryItem = () => {
    const current = block.laundry_items || [];
    const newItem: LaundryBatchItem = {
      id: `laundry-${Date.now()}`,
      product_name: "Garment / Item",
      quantity: 100,
      wash_recipe: block.wash_type || "Enzyme Stone Wash",
    };
    const updated = [...current, newItem];
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    onUpdate({ laundry_items: updated, line_total: newTotal });
  };

  const handleUpdateLaundryItem = (id: string, updates: Partial<LaundryBatchItem>) => {
    const current = block.laundry_items || [];
    const updated = current.map((item) => (item.id === id ? { ...item, ...updates } : item));
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    onUpdate({ laundry_items: updated, line_total: newTotal });
  };

  const handleRemoveLaundryItem = (id: string) => {
    const current = block.laundry_items || [];
    const updated = current.filter((item) => item.id !== id);
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    onUpdate({ laundry_items: updated, line_total: newTotal });
  };

  // Finishing batch handlers
  const handleAddFinishingItem = () => {
    const current = block.finishing_items || [];
    const newItem: FinishingBatchItem = {
      id: `finish-${Date.now()}`,
      product_name: "Garment / Item",
      quantity: 100,
      hangtag_type: "Standard Hangtag w/ Barcode",
      packaging_spec: "Individual Polybag",
      carton_spec: "Master Carton (25 pcs/box)",
    };
    const updated = [...current, newItem];
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    onUpdate({ finishing_items: updated, line_total: newTotal });
  };

  const handleUpdateFinishingItem = (id: string, updates: Partial<FinishingBatchItem>) => {
    const current = block.finishing_items || [];
    const updated = current.map((item) => (item.id === id ? { ...item, ...updates } : item));
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    onUpdate({ finishing_items: updated, line_total: newTotal });
  };

  const handleRemoveFinishingItem = (id: string) => {
    const current = block.finishing_items || [];
    const updated = current.filter((item) => item.id !== id);
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    onUpdate({ finishing_items: updated, line_total: newTotal });
  };

  const isWashStage = block.starting_stage === 7 || block.service_scope === "wash_only";
  const isFinishStage = block.starting_stage === 10 || block.service_scope === "finish_only";

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

          {/* 2. Fabric Type & Per-Style Production Start Stage */}
          <div className="p-5 bg-neutral-50/80 border border-neutral-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Fabric Material Behavior <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdate({ fabric_type: "Woven" })}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    block.fabric_type === "Woven"
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  Woven (Denim, Twill)
                </button>

                <button
                  type="button"
                  onClick={() => onUpdate({ fabric_type: "Knit" })}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    block.fabric_type === "Knit"
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  Knit (Fleece, Jersey)
                </button>

                <button
                  type="button"
                  onClick={() => onUpdate({ fabric_type: "Other" })}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    block.fabric_type === "Other"
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  Other / Custom
                </button>
              </div>

              {block.fabric_type === "Other" && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    placeholder="Specify Custom Material (e.g. Leather, Suede, Non-Woven, Vinyl, Fleece Blend)"
                    value={block.custom_fabric_type || ""}
                    onChange={(e) => onUpdate({ custom_fabric_type: e.target.value })}
                    className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Initial Production Start Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={block.starting_stage || 1}
                onChange={(e) => {
                  const stage = parseInt(e.target.value, 10);
                  const scope = stage === 1 ? "full_cmt" : stage === 4 ? "sew_only" : stage === 7 ? "wash_only" : "finish_only";
                  onUpdate({
                    starting_stage: stage,
                    service_scope: scope,
                  });
                }}
                className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>Full CMT (Stage 1: Fabric Inspection &amp; Cutting)</option>
                <option value={4}>Sewing Assembly Only (Stage 4: Panels Supplied)</option>
                <option value={7}>Wash &amp; Laundry Processing Only (Stage 7: Garments Sewn)</option>
                <option value={10}>Finishing, Tagging &amp; Packing Only (Stage 10)</option>
              </select>
            </div>
          </div>

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

          {/* 4. STAGE-CONDITIONAL LAYOUT */}
          {/* Wash & Laundry Only View */}
          {isWashStage && (
            <div className="space-y-4 pt-4 border-t border-neutral-100 bg-amber-50/60 p-5 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-amber-700" />
                    <span>Wash &amp; Laundry Batch Intake Items</span>
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Add product items, quantities, and wash formulations for industrial laundry processing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLaundryItem}
                  className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product Row</span>
                </button>
              </div>

              {(block.laundry_items || []).length === 0 ? (
                <div className="p-4 text-center text-xs text-amber-800 bg-white rounded-xl border border-amber-200">
                  No laundry items added yet. Click <strong>"+ Add Product Row"</strong> above to enter quantities.
                </div>
              ) : (
                <div className="space-y-3">
                  {(block.laundry_items || []).map((item, idx) => (
                    <div key={item.id} className="p-3.5 bg-white border border-amber-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">Product / Item Name</label>
                        <input
                          type="text"
                          value={item.product_name}
                          onChange={(e) => handleUpdateLaundryItem(item.id, { product_name: e.target.value })}
                          className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-bold"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">Quantity (Pcs)</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateLaundryItem(item.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                          className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg font-mono font-bold text-xs"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">Wash Recipe / Treatment</label>
                        <input
                          type="text"
                          value={item.wash_recipe}
                          onChange={(e) => handleUpdateLaundryItem(item.id, { wash_recipe: e.target.value })}
                          className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-medium"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveLaundryItem(item.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Finishing & Tagging Only View */}
          {isFinishStage && (
            <div className="space-y-4 pt-4 border-t border-neutral-100 bg-blue-50/60 p-5 rounded-2xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-blue-950 tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-700" />
                    <span>Finishing, Tagging &amp; Packing Batch Items</span>
                  </h4>
                  <p className="text-xs text-blue-800 mt-0.5">
                    Add product items, quantities, hangtag details, and export packing specifications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddFinishingItem}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product Row</span>
                </button>
              </div>

              {(block.finishing_items || []).length === 0 ? (
                <div className="p-4 text-center text-xs text-blue-800 bg-white rounded-xl border border-blue-200">
                  No finishing items added yet. Click <strong>"+ Add Product Row"</strong> above to enter quantities.
                </div>
              ) : (
                <div className="space-y-3">
                  {(block.finishing_items || []).map((item) => (
                    <div key={item.id} className="p-3.5 bg-white border border-blue-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">Product / Item</label>
                        <input
                          type="text"
                          value={item.product_name}
                          onChange={(e) => handleUpdateFinishingItem(item.id, { product_name: e.target.value })}
                          className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">Qty (Pcs)</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateFinishingItem(item.id, { quantity: parseInt(e.target.value, 10) || 0 })}
                          className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg font-mono font-bold text-xs"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">Hangtag / Label Spec</label>
                        <input
                          type="text"
                          value={item.hangtag_type || ""}
                          onChange={(e) => handleUpdateFinishingItem(item.id, { hangtag_type: e.target.value })}
                          className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-medium"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">Packaging &amp; Carton Spec</label>
                        <input
                          type="text"
                          value={item.packaging_spec || ""}
                          onChange={(e) => handleUpdateFinishingItem(item.id, { packaging_spec: e.target.value })}
                          className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-medium"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveFinishingItem(item.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Full CMT & Sewing Assembly View (Standard CAD Size Matrix) */}
          {!isWashStage && !isFinishStage && (
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
          )}

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
