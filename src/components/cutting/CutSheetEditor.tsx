import React, { useEffect, useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { 
  Plus, 
  Trash2, 
  Scissors, 
  Layers, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  FileSpreadsheet, 
  AlertCircle,
  Hash,
  Scale
} from "lucide-react";
import type { 
  ApplyCutSheet, 
  CutSheetComponent, 
  CutSheetData, 
  SizeMatrix 
} from "../../lib/types";

interface CutSheetEditorProps {
  initialData?: Partial<ApplyCutSheet>;
  onSave?: (data: Partial<ApplyCutSheet>) => Promise<any> | void;
  isLoading?: boolean;
  readOnly?: boolean;
}

interface FormValues {
  style_no: string;
  style_description: string;
  cut_no: string;
  cut_date: string;
  cutter_name: string;
  spreader_name: string;
  sewer_name: string;
  wash_dx_cd: string;
  laundry_self: "Laundry" | "Self";
  size_columns: string[];
  components: {
    component_name: string;
    fabric_code: string;
    fabric_desc: string;
    lot_number: string;
    shade_number: string;
    roll_number: string;
    roll_width: string;
    number_of_spreads: number;
    plies: number;
    estimated_yield: number;
    actual_yield: number;
    damage_percent: number;
    short_percent: number;
    ticket_yards: number;
    yards_cut: number;
    color_lot: string;
    total_units: number;
    size_matrix: Record<string, number>;
  }[];
}

const DEFAULT_SIZES = ["28", "30", "32", "34", "36", "38", "40"];

export const CutSheetEditor: React.FC<CutSheetEditorProps> = ({
  initialData,
  onSave,
  isLoading = false,
  readOnly = false,
}) => {
  const defaultComponents = initialData?.sheet_data?.components || [
    {
      component_name: "SELF",
      fabric_code: "FB-KURABO-135",
      fabric_desc: "13.5oz Indigo Raw Selvedge",
      lot_number: "LOT-882",
      shade_number: "SHD-A",
      roll_number: "R-01",
      roll_width: "58 in",
      number_of_spreads: 4,
      plies: 50,
      estimated_yield: 1.45,
      actual_yield: 1.42,
      damage_percent: 0.5,
      short_percent: 0.2,
      ticket_yards: 750,
      yards_cut: 740,
      color_lot: "Raw Indigo",
      total_units: 200,
      size_matrix: { "28": 20, "30": 40, "32": 60, "34": 50, "36": 20, "38": 10, "40": 0 },
    },
  ];

  const { register, control, handleSubmit, watch, setValue, reset, formState: { isDirty, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      style_no: initialData?.style_no || "STL-FORGE-2026",
      style_description: initialData?.style_description || "Slim Tapered Raw Selvedge Denim",
      cut_no: initialData?.cut_no || `CUT-${Math.floor(1000 + Math.random() * 9000)}`,
      cut_date: initialData?.cut_date || new Date().toISOString().slice(0, 10),
      cutter_name: initialData?.cutter_name || "Marcus Vance",
      spreader_name: initialData?.spreader_name || "D. Miller",
      sewer_name: initialData?.sewer_name || "Line 4 CMT Team",
      wash_dx_cd: initialData?.wash_dx_cd || "WASH-RAW-01",
      laundry_self: initialData?.laundry_self || "Laundry",
      size_columns: DEFAULT_SIZES,
      components: defaultComponents.map((c) => ({
        component_name: c.component_name || "SELF",
        fabric_code: c.fabric_code || "",
        fabric_desc: c.fabric_desc || "",
        lot_number: c.lot_number || "",
        shade_number: c.shade_number || "",
        roll_number: c.roll_number || "",
        roll_width: c.roll_width || "58 in",
        number_of_spreads: c.number_of_spreads || 1,
        plies: c.plies || 50,
        estimated_yield: c.estimated_yield || 1.5,
        actual_yield: c.actual_yield || 1.5,
        damage_percent: c.damage_percent || 0,
        short_percent: c.short_percent || 0,
        ticket_yards: c.ticket_yards || 0,
        yards_cut: c.yards_cut || 0,
        color_lot: c.color_lot || "",
        total_units: c.total_units || 0,
        size_matrix: (c.size_matrix as any) || {},
      })),
    },
  });

  // react-hook-form useFieldArray for dynamic fabric rows
  const { fields, append, remove } = useFieldArray({
    control,
    name: "components",
  });

  const watchedComponents = watch("components");
  const sizeColumns = watch("size_columns") || DEFAULT_SIZES;

  // Auto-calculated totals
  const totalUnits = useMemo(() => {
    return (watchedComponents || []).reduce((acc, comp) => {
      const rowSum = Object.values(comp.size_matrix || {}).reduce((s, val) => s + (Number(val) || 0), 0);
      return acc + rowSum;
    }, 0);
  }, [watchedComponents]);

  const totalYardsCut = useMemo(() => {
    return (watchedComponents || []).reduce((acc, comp) => acc + (Number(comp.yards_cut) || 0), 0);
  }, [watchedComponents]);

  const handleAddFabricRow = () => {
    append({
      component_name: fields.length === 0 ? "SELF" : fields.length === 1 ? "POCKETING" : "FUSE",
      fabric_code: `FB-LOT-${Math.floor(100 + Math.random() * 900)}`,
      fabric_desc: "100% Cotton Twill Pocketing / Interlining",
      lot_number: "LOT-NEW",
      shade_number: "SHD-1",
      roll_number: "R-01",
      roll_width: "58 in",
      number_of_spreads: 1,
      plies: 50,
      estimated_yield: 0.35,
      actual_yield: 0.35,
      damage_percent: 0,
      short_percent: 0,
      ticket_yards: 100,
      yards_cut: 100,
      color_lot: "Natural Ecru",
      total_units: 0,
      size_matrix: DEFAULT_SIZES.reduce((m, sz) => ({ ...m, [sz]: 0 }), {}),
    });
  };

  const onFormSubmit = async (values: FormValues) => {
    if (!onSave) return;
    const transformed: Partial<ApplyCutSheet> = {
      style_no: values.style_no,
      style_description: values.style_description,
      cut_no: values.cut_no,
      cut_date: values.cut_date,
      cutter_name: values.cutter_name,
      spreader_name: values.spreader_name,
      sewer_name: values.sewer_name,
      wash_dx_cd: values.wash_dx_cd,
      laundry_self: values.laundry_self,
      sheet_data: {
        components: values.components.map((c) => ({
          component_name: c.component_name,
          fabric_code: c.fabric_code,
          fabric_desc: c.fabric_desc,
          lot_number: c.lot_number,
          shade_number: c.shade_number,
          roll_number: c.roll_number,
          roll_width: c.roll_width,
          number_of_spreads: Number(c.number_of_spreads),
          plies: Number(c.plies),
          estimated_yield: Number(c.estimated_yield),
          actual_yield: Number(c.actual_yield),
          damage_percent: Number(c.damage_percent),
          short_percent: Number(c.short_percent),
          ticket_yards: Number(c.ticket_yards),
          yards_cut: Number(c.yards_cut),
          color_lot: c.color_lot,
          total_units: Object.values(c.size_matrix || {}).reduce((s, v) => s + (Number(v) || 0), 0),
          size_columns: sizeColumns,
          size_matrix: c.size_matrix as any,
        })),
        grand_total: totalUnits,
      },
    };

    await onSave(transformed);
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="p-6 bg-neutral-900 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-mono">
              Factory Cut Sheet Specification Editor
            </span>
            <h2 className="text-lg font-black font-display tracking-tight text-white">
              Cut Sheet Component & Fabric Allocation
            </h2>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-xs text-xs font-mono">
          <div>
            <span className="text-neutral-400 block text-[10px]">TOTAL UNITS</span>
            <span className="text-base font-black text-amber-300">{totalUnits.toLocaleString()}</span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div>
            <span className="text-neutral-400 block text-[10px]">TOTAL YARDS CUT</span>
            <span className="text-base font-black text-emerald-300">{totalYardsCut.toLocaleString()} yds</span>
          </div>
        </div>
      </div>

      {/* Editor Form */}
      <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
        
        {/* Style & Cut Ticket Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-neutral-50 rounded-2xl border border-neutral-200/80">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Style Number</label>
            <input
              type="text"
              {...register("style_no", { required: true })}
              className="w-full h-9 px-3 text-xs font-bold bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Cut Ticket #</label>
            <input
              type="text"
              {...register("cut_no", { required: true })}
              className="w-full h-9 px-3 text-xs font-mono font-bold bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Lead Cutter</label>
            <input
              type="text"
              {...register("cutter_name")}
              className="w-full h-9 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Cut Date</label>
            <input
              type="date"
              {...register("cut_date")}
              className="w-full h-9 px-3 text-xs bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
            />
          </div>
        </div>

        {/* Fabric Rows & Components Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-neutral-100 rounded-lg text-neutral-800">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900">
                Fabric Rows & Layer Components ({fields.length})
              </h3>
            </div>

            {/* ADD FABRIC ROW BUTTON */}
            {!readOnly && (
              <button
                type="button"
                id="btn-add-fabric-row"
                onClick={handleAddFabricRow}
                className="px-3.5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Fabric Row</span>
              </button>
            )}
          </div>

          {/* Rows List */}
          <div className="space-y-4">
            {fields.map((field, index) => {
              const comp = watchedComponents?.[index] || {};
              const rowUnits = Object.values(comp.size_matrix || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);

              return (
                <div 
                  key={field.id}
                  className="p-5 bg-white border border-neutral-200 rounded-2xl shadow-xs space-y-4 transition-all hover:border-neutral-300"
                >
                  {/* Row Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-neutral-900 text-white text-xs font-mono font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <select
                        {...register(`components.${index}.component_name`)}
                        className="h-8 px-2.5 text-xs font-bold bg-neutral-100 border border-neutral-200 rounded-lg focus:outline-none"
                      >
                        <option value="SELF">SELF (Main Denim)</option>
                        <option value="POCKETING">POCKETING</option>
                        <option value="FUSE">FUSE / INTERLINING</option>
                        <option value="LINING">LINING</option>
                        <option value="CONTRAST">CONTRAST</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-lg">
                        Row Total: <strong className="text-neutral-900 font-black">{rowUnits} pcs</strong>
                      </span>

                      {!readOnly && fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Remove Fabric Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fabric Specification Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-1">Fabric Code</label>
                      <input
                        type="text"
                        placeholder="e.g. FB-135"
                        {...register(`components.${index}.fabric_code`)}
                        className="w-full h-8 px-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-neutral-600 mb-1">Fabric Description</label>
                      <input
                        type="text"
                        placeholder="e.g. 13.5oz Raw Indigo Selvedge"
                        {...register(`components.${index}.fabric_desc`)}
                        className="w-full h-8 px-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-1">Lot Number</label>
                      <input
                        type="text"
                        placeholder="e.g. LOT-882"
                        {...register(`components.${index}.lot_number`)}
                        className="w-full h-8 px-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-1">Shade / Tint</label>
                      <input
                        type="text"
                        placeholder="e.g. Cast A"
                        {...register(`components.${index}.shade_number`)}
                        className="w-full h-8 px-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-1">Yards Cut</label>
                      <input
                        type="number"
                        min="0"
                        {...register(`components.${index}.yards_cut`, { valueAsNumber: true })}
                        className="w-full h-8 px-2 font-mono font-bold bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none text-right"
                      />
                    </div>
                  </div>

                  {/* Size Matrix Table for this Row */}
                  <div className="p-3 bg-neutral-50/80 rounded-xl border border-neutral-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-2">
                      Cut Size Breakdown (Units per size)
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {sizeColumns.map((sz) => (
                        <div key={sz} className="text-center">
                          <span className="text-[11px] font-bold text-neutral-700 block mb-1 font-mono">
                            {sz}
                          </span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            {...register(`components.${index}.size_matrix.${sz}`, { valueAsNumber: true })}
                            className="w-full h-8 text-center text-xs font-mono font-bold bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-900"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        {!readOnly && (
          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
            >
              Reset Changes
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="px-6 py-2.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? "Saving Cut Sheet..." : "Save Cut Sheet"}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
