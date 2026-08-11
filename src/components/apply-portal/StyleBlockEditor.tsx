import React, { useState } from "react";
import type {
  StyleBlockItem,
  ProductType,
  FabricType,
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
  Tag,
  CheckCircle2,
  HelpCircle,
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
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {block.style_number || "NO-STYLE-NO"}
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800">
                {block.product_type}
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                {block.fabric_type}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 font-medium flex items-center gap-3">
              <span>Colorway: <strong>{block.colorway}</strong></span>
              <span>•</span>
              <span>Wash: <strong>{block.wash_type}</strong></span>
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdate({ fabric_type: "Woven" })}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    block.fabric_type === "Woven"
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  Woven (Denim, Twill, Canvas)
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
                  Knit (Fleece, Jersey, Rib)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Initial Production Start Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={block.starting_stage || 1}
                onChange={(e) =>
                  onUpdate({
                    starting_stage: parseInt(e.target.value, 10),
                    service_scope:
                      e.target.value === "1"
                        ? "full_cmt"
                        : e.target.value === "4"
                        ? "sew_only"
                        : e.target.value === "7"
                        ? "wash_only"
                        : "finish_only",
                  })
                }
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
                value={block.colorway}
                onChange={(e) => onUpdate({ colorway: e.target.value })}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 4. Size Template & Matrix */}
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
