import React from "react";
import type { TrimComponent, ProductType } from "../../contexts/ApplyWizardContext";
import {
  Layers,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
  Scissors,
  CheckCircle2,
} from "lucide-react";

export interface RepeatableTrimsListProps {
  trims: TrimComponent[];
  onChange: (trims: TrimComponent[]) => void;
  productType?: ProductType;
}

export const TRIM_TYPES = [
  "Buttons",
  "Zippers",
  "Rivets & Burrs",
  "Drawstrings",
  "Ribbing",
  "Elastic",
  "Embroidery",
  "Screen Print",
  "Patches",
  "Labels / Tags",
  "Snaps",
  "Velcro",
  "Eyelets / Grommets",
  "Other",
] as const;

export const UOM_OPTIONS = [
  "pieces",
  "yards",
  "meters",
  "spools",
  "grams",
  "sets",
  "rolls",
] as const;

export const RepeatableTrimsList: React.FC<RepeatableTrimsListProps> = ({
  trims,
  onChange,
  productType = "Denim/Bottoms",
}) => {
  const handleAddTrim = () => {
    const newTrim: TrimComponent = {
      id: `t-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      trim_type: "Labels / Tags",
      specification: "",
      qty_per_garment: 1,
      uom: "pieces",
    };
    onChange([...trims, newTrim]);
  };

  const handleUpdateTrim = (id: string, updates: Partial<TrimComponent>) => {
    onChange(
      trims.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleRemoveTrim = (id: string) => {
    onChange(trims.filter((t) => t.id !== id));
  };

  const handleSuggestPresets = () => {
    let suggested: TrimComponent[] = [];
    if (productType === "Hoodie/Sweatshirt") {
      suggested = [
        { id: `t-${Date.now()}-1`, trim_type: "Drawstrings", specification: "100% Flat Cotton Drawstring w/ Metal Tips", qty_per_garment: 1.2, uom: "yards" },
        { id: `t-${Date.now()}-2`, trim_type: "Ribbing", specification: "2x2 Heavyweight Cotton Rib for Cuffs & Hem", qty_per_garment: 0.4, uom: "yards" },
        { id: `t-${Date.now()}-3`, trim_type: "Labels / Tags", specification: "Woven Main Neck Label + Care Tag", qty_per_garment: 1, uom: "pieces" },
      ];
    } else if (productType === "Denim/Bottoms" || productType === "Shorts") {
      suggested = [
        { id: `t-${Date.now()}-1`, trim_type: "Buttons", specification: "17mm Shank Donut Button (Antique Brass)", qty_per_garment: 5, uom: "pieces" },
        { id: `t-${Date.now()}-2`, trim_type: "Rivets & Burrs", specification: "9mm Copper Pocket Burrs", qty_per_garment: 6, uom: "pieces" },
        { id: `t-${Date.now()}-3`, trim_type: "Zippers", specification: "YKK #5 Antique Brass Zipper", qty_per_garment: 1, uom: "pieces" },
        { id: `t-${Date.now()}-4`, trim_type: "Labels / Tags", specification: "Real Leather Back Patch + Care Label", qty_per_garment: 1, uom: "pieces" },
      ];
    } else if (productType === "T-Shirt") {
      suggested = [
        { id: `t-${Date.now()}-1`, trim_type: "Ribbing", specification: "1x1 Rib Knit Collar Band", qty_per_garment: 0.15, uom: "yards" },
        { id: `t-${Date.now()}-2`, trim_type: "Labels / Tags", specification: "Printed Tear-Away Neck Tag", qty_per_garment: 1, uom: "pieces" },
      ];
    } else {
      suggested = [
        { id: `t-${Date.now()}-1`, trim_type: "Labels / Tags", specification: "Main Label + Care Instructions Tag", qty_per_garment: 1, uom: "pieces" },
      ];
    }
    onChange(suggested);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="font-extrabold text-xs text-neutral-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Trims &amp; Components BOM ({trims.length} Items)</span>
          </h4>
          <p className="text-[11px] text-neutral-500 font-normal mt-0.5">
            Add repeatable components (buttons, drawstrings, ribbing, embroidery, labels) with explicit quantities &amp; UOM.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSuggestPresets}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Auto-Suggest Trims for {productType}</span>
          </button>

          <button
            type="button"
            onClick={handleAddTrim}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Component Row</span>
          </button>
        </div>
      </div>

      {trims.length === 0 ? (
        <div className="p-6 text-center bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-2xl space-y-2">
          <p className="text-xs font-bold text-neutral-600">No Trims or Components Added</p>
          <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
            This style has no extra trims specified (ideal for basic tees or minimal garments). Click "Add Component Row" or use "Auto-Suggest".
          </p>
        </div>
      ) : (
        <div className="border-2 border-neutral-200 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100/80 border-b font-extrabold text-neutral-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5 w-1/4">Trim Type</th>
                  <th className="px-3.5 py-2.5 w-2/5">Specification / Detail</th>
                  <th className="px-3.5 py-2.5 w-1/6">Qty / Garment</th>
                  <th className="px-3.5 py-2.5 w-1/6">UOM</th>
                  <th className="px-3 py-2.5 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {trims.map((trim) => (
                  <tr key={trim.id} className="hover:bg-neutral-50/50 transition-colors">
                    {/* Trim Type Dropdown */}
                    <td className="p-2.5">
                      <select
                        value={trim.trim_type}
                        onChange={(e) =>
                          handleUpdateTrim(trim.id, {
                            trim_type: e.target.value as any,
                          })
                        }
                        className="w-full p-2 border border-neutral-300 rounded-xl text-xs bg-white font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500"
                      >
                        {TRIM_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Specification text */}
                    <td className="p-2.5">
                      <input
                        type="text"
                        placeholder="e.g. YKK #5 Antique Brass 24in or 100% Flat Cotton Drawstring"
                        value={trim.specification}
                        onChange={(e) =>
                          handleUpdateTrim(trim.id, {
                            specification: e.target.value,
                          })
                        }
                        className="w-full p-2 border border-neutral-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </td>

                    {/* Qty per Garment */}
                    <td className="p-2.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1.0"
                        value={trim.qty_per_garment || ""}
                        onChange={(e) =>
                          handleUpdateTrim(trim.id, {
                            qty_per_garment: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full p-2 border border-neutral-300 rounded-xl text-xs bg-white font-mono font-bold focus:ring-2 focus:ring-blue-500"
                      />
                    </td>

                    {/* UOM Selector */}
                    <td className="p-2.5">
                      <select
                        value={trim.uom}
                        onChange={(e) =>
                          handleUpdateTrim(trim.id, {
                            uom: e.target.value as any,
                          })
                        }
                        className="w-full p-2 border border-neutral-300 rounded-xl text-xs bg-white font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500"
                      >
                        {UOM_OPTIONS.map((uom) => (
                          <option key={uom} value={uom}>
                            {uom}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Delete button */}
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveTrim(trim.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete Trim Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
