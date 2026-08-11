import React, { useState } from "react";
import type { ProductType, FabricType } from "../../contexts/ApplyWizardContext";
import {
  Layers,
  Shirt,
  Sparkles,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Tag,
  Package,
} from "lucide-react";

export interface ProductTypePreset {
  id: ProductType;
  label: string;
  categoryDesc: string;
  defaultFabric: FabricType;
  suggestedSizes: string[];
  icon: React.ElementType;
}

export const PRODUCT_TYPE_PRESETS: ProductTypePreset[] = [
  {
    id: "Denim/Bottoms",
    label: "Denim & Bottoms",
    categoryDesc: "Jeans, Twill Pants, Chinos, Dungarees",
    defaultFabric: "Woven",
    suggestedSizes: ["28", "29", "30", "31", "32", "33", "34", "36", "38", "40"],
    icon: Scissors,
  },
  {
    id: "Hoodie/Sweatshirt",
    label: "Hoodie & Sweatshirt",
    categoryDesc: "Pullovers, Zip Hoodies, French Terry Fleece",
    defaultFabric: "Knit",
    suggestedSizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
    icon: Shirt,
  },
  {
    id: "T-Shirt",
    label: "T-Shirt & Tops",
    categoryDesc: "Crewnecks, V-Necks, Tanks, Long Sleeves",
    defaultFabric: "Knit",
    suggestedSizes: ["XS", "S", "M", "L", "XL", "XXL"],
    icon: Shirt,
  },
  {
    id: "Jacket",
    label: "Jacket & Outerwear",
    categoryDesc: "Trucker Jackets, Bombers, Parkas, Vests",
    defaultFabric: "Woven",
    suggestedSizes: ["S", "M", "L", "XL", "XXL"],
    icon: Layers,
  },
  {
    id: "Shorts",
    label: "Shorts & Swim",
    categoryDesc: "Cargo Shorts, Athletic Shorts, Swim Trunks",
    defaultFabric: "Woven",
    suggestedSizes: ["28", "30", "32", "34", "36", "38"],
    icon: Scissors,
  },
  {
    id: "Dress",
    label: "Dress & Skirt",
    categoryDesc: "One-Piece Dresses, Skirts, Jumpsuits",
    defaultFabric: "Woven",
    suggestedSizes: ["0", "2", "4", "6", "8", "10", "12", "14"],
    icon: Tag,
  },
  {
    id: "Kidswear",
    label: "Kidswear & Infant",
    categoryDesc: "Infant Onesies, Toddler Wear, Youth Sizes",
    defaultFabric: "Knit",
    suggestedSizes: ["0-3m", "3-6m", "6-12m", "12-18m", "2T", "3T", "4T", "5T", "6", "8"],
    icon: Sparkles,
  },
  {
    id: "Custom/Other",
    label: "Custom / Accessories",
    categoryDesc: "Bags, Hats, Footwear, Custom Specs",
    defaultFabric: "Woven",
    suggestedSizes: ["One Size"],
    icon: Package,
  },
];

export interface ProductTypeSelectorProps {
  value: ProductType;
  onChange: (type: ProductType, suggestedSizes: string[], suggestedFabric: FabricType) => void;
  hasEnteredData?: boolean;
}

export const ProductTypeSelector: React.FC<ProductTypeSelectorProps> = ({
  value,
  onChange,
  hasEnteredData = false,
}) => {
  const [pendingType, setPendingType] = useState<ProductTypePreset | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleSelect = (preset: ProductTypePreset) => {
    if (preset.id === value) return;

    if (hasEnteredData) {
      setPendingType(preset);
      setShowConfirmModal(true);
    } else {
      onChange(preset.id, preset.suggestedSizes, preset.defaultFabric);
    }
  };

  const confirmSwitch = (resetData: boolean) => {
    if (pendingType) {
      onChange(pendingType.id, pendingType.suggestedSizes, pendingType.defaultFabric);
    }
    setShowConfirmModal(false);
    setPendingType(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
          Garment / Product Type <span className="text-red-500">*</span>
        </label>
        <span className="text-[11px] text-neutral-500 font-medium flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
          Drives size template, BOM trims, &amp; cut defaults
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PRODUCT_TYPE_PRESETS.map((preset) => {
          const isSelected = value === preset.id;
          const IconComp = preset.icon;

          return (
            <button
              type="button"
              key={preset.id}
              onClick={() => handleSelect(preset)}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-2.5 relative group ${
                isSelected
                  ? "border-blue-600 bg-blue-50/60 shadow-sm ring-2 ring-blue-500/20"
                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isSelected ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200"
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
              </div>

              <div>
                <div className={`font-bold text-xs ${isSelected ? "text-blue-950" : "text-neutral-900"}`}>
                  {preset.label}
                </div>
                <div className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5 font-normal">
                  {preset.categoryDesc}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase text-neutral-400">
                <span>{preset.defaultFabric}</span>
                <span>•</span>
                <span>{preset.suggestedSizes.length} Sizes</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirmation Modal when data exists */}
      {showConfirmModal && pendingType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-neutral-900">
                Switch Product Type to {pendingType.label}?
              </h3>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              You already have entered size quantities or trim BOM entries for this style. Switching product types will update the size template to <strong>{pendingType.suggestedSizes.join(", ")}</strong>.
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
              <strong>Data Protection:</strong> Sizes matching the new template will be retained; any non-matching size columns will be safely preserved as custom columns.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmSwitch(false)}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md"
              >
                Apply New Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
