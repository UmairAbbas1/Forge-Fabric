import React, { useState } from "react";
import { Plus, X } from "lucide-react";

export type FabricMaterialType = "Woven" | "Knit" | "Other";

interface FabricMaterialSelectorProps {
  fabricType: FabricMaterialType;
  /** Comma-joined list of the currently SELECTED custom tags (kept as a
   * plain string for backward compatibility with every existing consumer —
   * StyleBlockEditor's header badge, the cut-sheet export, etc. — which all
   * already read/display this field as text). */
  customFabricType?: string;
  /** The full pool of custom tags ever added for this block — separate from
   * which of them are currently selected, so removing/deselecting a tag
   * doesn't lose the others. */
  customFabricTags?: string[];
  onChange: (fabricType: FabricMaterialType, customFabricType?: string, customFabricTags?: string[]) => void;
}

/**
 * The exact "Fabric Material Behavior" selector StyleBlockEditor.tsx
 * (Bulk Order flow) already used inline — extracted here unchanged so the
 * Sample Request flow (item 5) can reuse the identical component/pattern
 * instead of a second, divergent implementation. StyleBlockEditor.tsx's own
 * rendering/behavior is untouched — it now just delegates to this.
 *
 * "Other/Custom" materials are entered as removable, multi-selectable tags
 * (consistent with the Woven/Knit button pattern) instead of a single free
 * text note, so more than one custom material can be specified per block.
 */
export const FabricMaterialSelector: React.FC<FabricMaterialSelectorProps> = ({
  fabricType,
  customFabricType,
  customFabricTags,
  onChange,
}) => {
  const tags = customFabricTags || [];
  const selectedTags = new Set(
    (customFabricType || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  );
  const [newTagInput, setNewTagInput] = useState("");

  const emitSelection = (nextSelected: Set<string>, nextTags: string[]) => {
    const joined = Array.from(nextSelected).join(", ");
    onChange("Other", joined || undefined, nextTags);
  };

  const handleToggleTag = (tag: string) => {
    const next = new Set(selectedTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    emitSelection(next, tags);
  };

  const handleRemoveTag = (tag: string) => {
    const nextTags = tags.filter((t) => t !== tag);
    const nextSelected = new Set(selectedTags);
    nextSelected.delete(tag);
    emitSelection(nextSelected, nextTags);
  };

  const handleAddTag = () => {
    const val = newTagInput.trim();
    if (!val) return;
    const existing = tags.find((t) => t.toLowerCase() === val.toLowerCase());
    if (existing) {
      // Already exists — just select it rather than adding a duplicate.
      const next = new Set(selectedTags);
      next.add(existing);
      emitSelection(next, tags);
    } else {
      const nextTags = [...tags, val];
      const next = new Set(selectedTags);
      next.add(val);
      emitSelection(next, nextTags);
    }
    setNewTagInput("");
  };

  return (
    <div className="p-5 bg-neutral-50/80 border border-neutral-200 rounded-2xl">
      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
        Fabric Material Behavior <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-3 gap-2 max-w-lg">
        <button
          type="button"
          onClick={() => onChange("Woven", customFabricType, customFabricTags)}
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
          onClick={() => onChange("Knit", customFabricType, customFabricTags)}
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
          onClick={() => onChange("Other", customFabricType, customFabricTags)}
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
        <div className="mt-3 max-w-lg space-y-2.5">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = selectedTags.has(tag);
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className="cursor-pointer"
                      title={isSelected ? "Deselect" : "Select"}
                    >
                      {tag}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-neutral-400 hover:text-red-600 transition-colors"
                      title={`Remove "${tag}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Type a custom material (e.g. Bamboo Blend) and press Enter"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="flex-1 h-10 px-3 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="h-10 px-3 rounded-xl border-2 border-blue-600 bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 text-xs font-bold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {tags.length === 0 && (
            <p className="text-[11px] text-neutral-500">
              Add one or more custom materials above — each becomes a selectable tag, just like Woven/Knit.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
