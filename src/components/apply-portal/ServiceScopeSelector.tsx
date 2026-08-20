import React from "react";
import {
  SERVICE_GROUPS,
  SELECTABLE_SERVICE_IDS,
  PRESET_SCOPES,
  resolveSelectedStages,
  buildPipelinePreviewLabels,
  type ServiceId,
} from "../../lib/service-scope-constants";
import {
  Scissors,
  Cog,
  Droplets,
  Sparkles,
  Tag,
  CheckCircle2,
  ArrowRight,
  Info,
} from "lucide-react";

const SERVICE_ICONS: Record<ServiceId, React.ElementType> = {
  fabric_receiving: Info,
  pre_production_planning: Info,
  cutting_bundling: Scissors,
  sewing_assembly: Cog,
  pre_wash_qc: CheckCircle2,
  washing_laundry: Droplets,
  finishing_effects: Sparkles,
  final_qc: CheckCircle2,
  pressing_tagging_packing: Tag,
  dispatch_delivery: ArrowRight,
};

export interface ServiceScopeSelectorProps {
  selectedServices: ServiceId[];
  onChange: (selectedServices: ServiceId[], resolvedStages: number[]) => void;
}

export const ServiceScopeSelector: React.FC<ServiceScopeSelectorProps> = ({
  selectedServices,
  onChange,
}) => {
  const resolvedStages = resolveSelectedStages(selectedServices);

  const applyServices = (next: ServiceId[]) => {
    onChange(next, resolveSelectedStages(next));
  };

  const toggleService = (id: ServiceId) => {
    const next = selectedServices.includes(id)
      ? selectedServices.filter((s) => s !== id)
      : [...selectedServices, id];
    applyServices(next);
  };

  const applyPreset = (presetServices: ServiceId[]) => {
    applyServices(presetServices);
  };

  // Which preset (if any) exactly matches the current selection — drives the active-preset highlight.
  const activePresetId = PRESET_SCOPES.find(
    (p) =>
      p.id !== "custom" &&
      p.services.length === selectedServices.length &&
      p.services.every((s) => selectedServices.includes(s))
  )?.id ?? (selectedServices.length === 0 ? null : "custom");

  // Support stages auto-included by the current selection (Receiving, Planning, Pre-Wash QC, Final QC, Dispatch)
  const autoIncludedGroups = Object.values(SERVICE_GROUPS).filter(
    (g) => !g.selectable && g.stages.every((s) => resolvedStages.includes(s))
  );

  const previewLabels = buildPipelinePreviewLabels(resolvedStages);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
          Production Services Requested <span className="text-red-500">*</span>
        </label>
        <span className="text-[11px] text-neutral-500 font-medium">
          Pick what you need — we'll handle the rest automatically
        </span>
      </div>

      {/* Preset shortcuts */}
      <div className="flex flex-wrap gap-2">
        {PRESET_SCOPES.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              type="button"
              key={preset.id}
              title={preset.description}
              onClick={() => (preset.id === "custom" ? applyServices([]) : applyPreset(preset.services))}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all ${
                isActive
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Selectable service cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SELECTABLE_SERVICE_IDS.map((id) => {
          const group = SERVICE_GROUPS[id];
          const isSelected = selectedServices.includes(id);
          const Icon = SERVICE_ICONS[id];

          return (
            <button
              type="button"
              key={id}
              onClick={() => toggleService(id)}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 relative ${
                isSelected
                  ? "border-blue-600 bg-blue-50/60 shadow-sm ring-2 ring-blue-500/20"
                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isSelected ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
              </div>
              <div>
                <div className={`font-bold text-xs ${isSelected ? "text-blue-950" : "text-neutral-900"}`}>
                  {group.name}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5 leading-snug">{group.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Auto-included support stages */}
      {autoIncludedGroups.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
            Included automatically
          </div>
          <div className="flex flex-wrap gap-1.5">
            {autoIncludedGroups.map((g) => (
              <span
                key={g.id}
                title={g.autoIncludeNote}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-neutral-100 text-neutral-500 border border-neutral-200"
              >
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline preview strip */}
      {previewLabels.length > 0 && (
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
            Your order will pass through
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-neutral-700">
            {previewLabels.map((label, idx) => (
              <React.Fragment key={label}>
                {idx > 0 && <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />}
                <span className="px-2 py-0.5 rounded-md bg-white border border-neutral-200">{label}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {selectedServices.length === 0 && (
        <p className="text-[11px] text-amber-700 font-medium">
          Select at least one production service to continue.
        </p>
      )}
    </div>
  );
};
