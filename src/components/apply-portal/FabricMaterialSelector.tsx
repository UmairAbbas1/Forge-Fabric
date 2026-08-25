import React from "react";

export type FabricMaterialType = "Woven" | "Knit" | "Other";

interface FabricMaterialSelectorProps {
  fabricType: FabricMaterialType;
  customFabricType?: string;
  onChange: (fabricType: FabricMaterialType, customFabricType?: string) => void;
}

/**
 * The exact "Fabric Material Behavior" selector StyleBlockEditor.tsx
 * (Bulk Order flow) already used inline — extracted here unchanged so the
 * Sample Request flow (item 5) can reuse the identical component/pattern
 * instead of a second, divergent implementation. StyleBlockEditor.tsx's own
 * rendering/behavior is untouched — it now just delegates to this.
 */
export const FabricMaterialSelector: React.FC<FabricMaterialSelectorProps> = ({
  fabricType,
  customFabricType,
  onChange,
}) => {
  return (
    <div className="p-5 bg-neutral-50/80 border border-neutral-200 rounded-2xl">
      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
        Fabric Material Behavior <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-3 gap-2 max-w-lg">
        <button
          type="button"
          onClick={() => onChange("Woven", customFabricType)}
          className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
            fabricType === "Woven"
              ? "border-blue-600 bg-blue-50 text-blue-900"
              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
          }`}
        >
          Woven (Denim, Twill)
        </button>

        <button
          type="button"
          onClick={() => onChange("Knit", customFabricType)}
          className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
            fabricType === "Knit"
              ? "border-blue-600 bg-blue-50 text-blue-900"
              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
          }`}
        >
          Knit (Fleece, Jersey)
        </button>

        <button
          type="button"
          onClick={() => onChange("Other", customFabricType)}
          className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
            fabricType === "Other"
              ? "border-blue-600 bg-blue-50 text-blue-900"
              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
          }`}
        >
          Other / Custom
        </button>
      </div>

      {fabricType === "Other" && (
        <div className="mt-2.5 max-w-lg">
          <input
            type="text"
            placeholder="Specify Custom Material (e.g. Leather, Suede, Non-Woven, Vinyl, Fleece Blend)"
            value={customFabricType || ""}
            onChange={(e) => onChange("Other", e.target.value)}
            className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
};
