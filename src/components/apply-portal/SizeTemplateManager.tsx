import React, { useState } from "react";
import {
  List,
  Plus,
  Save,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Sparkles,
  HelpCircle,
  Tag,
} from "lucide-react";

export interface SizeTemplatePreset {
  id: string;
  name: string;
  category: string;
  sizes: string[];
}

export const STANDARD_SIZE_TEMPLATES: SizeTemplatePreset[] = [
  {
    id: "numeric_waist",
    name: "Numeric Waist (Bottoms)",
    category: "Bottoms",
    sizes: ["28", "29", "30", "31", "32", "33", "34", "36", "38", "40", "42"],
  },
  {
    id: "alpha_tops",
    name: "Alpha XS – 4XL (Tops / Hoodies)",
    category: "Tops",
    sizes: ["XS", "S", "M", "L", "XL", "4XL"],
  },
  {
    id: "kids_age",
    name: "Kids & Toddler (0-3m – 12)",
    category: "Kidswear",
    sizes: ["0-3m", "3-6m", "6-12m", "12-18m", "2T", "3T", "4T", "5T", "6", "8", "10", "12"],
  },
  {
    id: "shoe_eu",
    name: "Footwear (EU 36 – 46)",
    category: "Footwear",
    sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
  },
  {
    id: "one_size",
    name: "One-Size Fits All (OS)",
    category: "Accessories",
    sizes: ["OS"],
  },
];

export interface SizeTemplateManagerProps {
  currentSizes: string[];
  onSizesChange: (sizes: string[]) => void;
  onSaveTemplate?: (name: string, sizes: string[]) => void;
}

export const SizeTemplateManager: React.FC<SizeTemplateManagerProps> = ({
  currentSizes,
  onSizesChange,
  onSaveTemplate,
}) => {
  const [newSizeInput, setNewSizeInput] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [savedSuccessMsg, setSavedSuccessMsg] = useState("");

  const handleSelectTemplate = (templateId: string) => {
    const found = STANDARD_SIZE_TEMPLATES.find((t) => t.id === templateId);
    if (found) {
      onSizesChange(found.sizes);
    }
  };

  const handleAddCustomSize = () => {
    const val = newSizeInput.trim().toUpperCase();
    if (!val) return;
    if (currentSizes.includes(val)) {
      setNewSizeInput("");
      return;
    }
    const updated = [...currentSizes, val];
    onSizesChange(updated);
    setNewSizeInput("");
  };

  const handleRemoveSize = (sizeToRemove: string) => {
    if (currentSizes.length <= 1) return; // keep at least 1 size
    onSizesChange(currentSizes.filter((s) => s !== sizeToRemove));
  };

  const handleSaveTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateNameInput.trim()) return;

    if (onSaveTemplate) {
      onSaveTemplate(templateNameInput.trim(), currentSizes);
    }

    // Save to local storage custom templates
    try {
      const existing = localStorage.getItem("forge_custom_size_templates");
      const list = existing ? JSON.parse(existing) : [];
      list.push({
        id: `custom-${Date.now()}`,
        name: templateNameInput.trim(),
        category: "Custom User Template",
        sizes: currentSizes,
      });
      localStorage.setItem("forge_custom_size_templates", JSON.stringify(list));
    } catch (err) {
      console.error("Failed to save custom template", err);
    }

    setSavedSuccessMsg(`Template "${templateNameInput.trim()}" saved!`);
    setShowSaveModal(false);
    setTemplateNameInput("");
    setTimeout(() => setSavedSuccessMsg(""), 4000);
  };

  return (
    <div className="space-y-4 p-4 bg-neutral-50 border-2 border-neutral-200 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800">
          <List className="w-4 h-4 text-blue-600" />
          <span>Size Template &amp; Active Columns</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Select */}
          <select
            onChange={(e) => handleSelectTemplate(e.target.value)}
            defaultValue=""
            className="px-3 py-1.5 text-xs font-bold border border-neutral-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>
              -- Select Preset Size Template --
            </option>
            {STANDARD_SIZE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.sizes.length} sizes)
              </option>
            ))}
          </select>

          {/* Save Template Button */}
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl flex items-center gap-1.5 shadow-2xs text-neutral-700"
          >
            <Save className="w-3.5 h-3.5 text-emerald-600" />
            <span>Save Template</span>
          </button>
        </div>
      </div>

      {savedSuccessMsg && (
        <div className="p-2.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* Active Size Badges & Inline Adder */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        {currentSizes.map((sz) => (
          <span
            key={sz}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-neutral-300 rounded-xl text-xs font-mono font-bold text-neutral-900 shadow-2xs group"
          >
            <span>{sz}</span>
            <button
              type="button"
              onClick={() => handleRemoveSize(sz)}
              className="text-neutral-400 hover:text-red-500 transition-colors"
              title={`Remove size ${sz}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Inline Add Size Column */}
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="+ Add size (e.g. 4X, 42)"
            value={newSizeInput}
            onChange={(e) => setNewSizeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomSize();
              }
            }}
            className="w-36 px-2.5 py-1 text-xs border border-neutral-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <button
            type="button"
            onClick={handleAddCustomSize}
            className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Modal for saving template */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTemplateSubmit}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95"
          >
            <h3 className="font-extrabold text-base text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Save Size Template
            </h3>

            <p className="text-xs text-neutral-600">
              Save this set of <strong>{currentSizes.length} sizes</strong> (
              <span className="font-mono">{currentSizes.join(", ")}</span>) as a custom template for future orders.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase text-neutral-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Oversized Hoodie Extended Sizes"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
              >
                Save Custom Template
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
