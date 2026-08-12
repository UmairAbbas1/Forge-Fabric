import React, { useState } from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import type { CutSheetComponent } from '../../lib/types';
import { InfoTooltip } from '../shared/InfoTooltip';
import { 
  Scissors, 
  Plus, 
  Trash2, 
  Layers, 
  Sparkles, 
  Calculator, 
  AlertCircle 
} from 'lucide-react';

export const FactoryOneTemplate: React.FC = () => {
  const { state, updateCutSheet } = useApplyWizard();
  const { cutSheetData, sizeMatrix, styleBlocks = [] } = state;

  // Auto-sync real total units from Step 2 style blocks
  const step2TotalUnits = styleBlocks.reduce(
    (sum, sb) => sum + (Number(sb.line_total) || 0),
    0
  ) || state.blanketPo.contract_quantity || 0;

  const currentBlock = styleBlocks[0] || {
    id: 'default',
    product_type: 'Denim/Bottoms' as const,
    fabric_type: 'Woven' as const,
    size_columns: sizeMatrix.size_columns,
    size_matrix: sizeMatrix.fabrics[0]?.size_matrix || {},
    line_total: step2TotalUnits,
  };

  const rawComponents: CutSheetComponent[] = cutSheetData.sheet_data?.components || [
    {
      component_name: 'SELF',
      fabric_code: '',
      fabric_desc: '',
      lot_number: '',
      shade_number: '',
      roll_number: '',
      roll_width: '60"',
      number_of_spreads: 1,
      estimated_yield: 0,
      damage_percent: 0,
      short_percent: 0,
      plies: 1.0,
      size_columns: currentBlock.size_columns,
      size_matrix: currentBlock.size_matrix,
      color_lot: '',
      total_units: step2TotalUnits,
      ticket_yards: 0,
      yards_used: 0,
      yards_cut: 0,
      yards_damaged: 0,
      yards_short: 0,
      yards_balance: 0,
    },
  ];

  // Enforce synced total units on components
  const components = rawComponents.map((c) => ({
    ...c,
    total_units: step2TotalUnits > 0 ? step2TotalUnits : (c.total_units || 0),
  }));

  const updateComponents = (newComponents: CutSheetComponent[]) => {
    updateCutSheet('factory_one_production', {
      sheet_data: {
        ...cutSheetData.sheet_data,
        components: newComponents,
      },
    });
  };

  // Recalculate yields and balances reactive to inputs
  const handleComponentChange = (index: number, field: keyof CutSheetComponent, value: any) => {
    const updated = [...components];
    const comp = { ...updated[index], [field]: value };

    // Real-time formula computation:
    const totalUnits = Number(comp.total_units) || step2TotalUnits || 0;
    const estYield = Number(comp.estimated_yield) || 0;
    const yardsCut = Number(comp.yards_cut) || 0;

    // yards_used = estimated_yield * total_units
    const yardsUsed = Number((estYield * totalUnits).toFixed(2));
    comp.yards_used = yardsUsed;

    // yards_damaged = (damage_percent / 100) * yardsCut
    const damagePercent = Number(comp.damage_percent) || 0;
    const yardsDamaged = Number(((damagePercent / 100) * yardsCut).toFixed(2));
    comp.yards_damaged = yardsDamaged;

    // yards_short = (short_percent / 100) * yardsCut
    const shortPercent = Number(comp.short_percent) || 0;
    const yardsShort = Number(((shortPercent / 100) * yardsCut).toFixed(2));
    comp.yards_short = yardsShort;

    // yards_balance = yards_cut - yards_used - yards_damaged - yards_short
    const yardsBalance = Number((yardsCut - yardsUsed - yardsDamaged - yardsShort).toFixed(2));
    comp.yards_balance = yardsBalance;

    updated[index] = comp;
    updateComponents(updated);
  };

  const handleAddComponent = () => {
    const newComp: CutSheetComponent = {
      component_name: 'LINING',
      fabric_code: '',
      fabric_desc: '',
      lot_number: '',
      shade_number: '',
      roll_width: '58"',
      number_of_spreads: 1,
      estimated_yield: 0,
      damage_percent: 0,
      short_percent: 0,
      plies: 1.0,
      size_columns: sizeMatrix.size_columns,
      size_matrix: {},
      color_lot: '',
      total_units: step2TotalUnits,
      ticket_yards: 0,
      yards_used: 0,
      yards_cut: 0,
      yards_damaged: 0,
      yards_short: 0,
      yards_balance: 0,
    };
    updateComponents([...components, newComp]);
  };

  const handleRemoveComponent = (index: number) => {
    if (components.length <= 1) return;
    updateComponents(components.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-8">
      
      {/* Component Sections */}
      {components.map((comp, idx) => (
        <div key={idx} className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200 shadow-2xs space-y-5">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <span className="h-7 w-7 rounded-lg bg-amber-700 text-white font-bold text-xs flex items-center justify-center">
                #{idx + 1}
              </span>
              <div className="flex items-center gap-2">
                {/* Component Specification Dropdown */}
                <select
                  value={comp.component_name || "SELF"}
                  onChange={(e) => handleComponentChange(idx, 'component_name', e.target.value)}
                  className="font-bold text-xs text-neutral-900 bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="SELF">SELF (Primary Shell Fabric)</option>
                  <option value="LINING">LINING (Inner Garment Lining)</option>
                  <option value="POCKETING">POCKETING (Pocket Bag Fabric)</option>
                  <option value="FUSE">FUSE (Fusible Interlining)</option>
                  <option value="INTERLINING">INTERLINING (Structural Interlining)</option>
                  <option value="RIBBING">RIBBING (Rib Knit Cuffs &amp; Collar)</option>
                  <option value="CONTRAST">CONTRAST (Secondary Contrast Fabric)</option>
                  <option value="OTHER">OTHER (Custom Component)</option>
                </select>
                <span className="text-xs text-neutral-500 font-medium hidden sm:inline">(Component Specification)</span>
                <InfoTooltip
                  title="Component Specification"
                  description="The specific garment layer or fabric material component being spread and cut for this batch run."
                  source="Tech Pack specification sheet or pattern bill of materials (BOM)."
                />
              </div>
            </div>

            {components.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveComponent(idx)}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Component</span>
              </button>
            )}
          </div>

          {/* Grid: Fabric Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600 mb-1 flex items-center">
                Fabric Code
                <InfoTooltip
                  title="Fabric Code"
                  description="Unique mill identifier or fabric item code for raw material tracing."
                  source="Found on fabric bolt tag, mill invoice, or packing slip."
                  example="RR7276-SIOUX"
                />
              </label>
              <input
                type="text"
                placeholder="e.g. RR7276"
                value={comp.fabric_code || ''}
                onChange={(e) => handleComponentChange(idx, 'fabric_code', e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono font-bold uppercase"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600 mb-1 flex items-center">
                Lot Number
                <InfoTooltip
                  title="Lot Number"
                  description="Dye batch number from the textile mill ensuring color consistency across garment rolls."
                  source="Found on roll end-stamps, mill certificate of analysis, or packing list."
                  example="LOT-9402"
                />
              </label>
              <input
                type="text"
                placeholder="e.g. L-9402"
                value={comp.lot_number || ''}
                onChange={(e) => handleComponentChange(idx, 'lot_number', e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono uppercase"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600 mb-1 flex items-center">
                Shade / Tint
                <InfoTooltip
                  title="Shade / Tint"
                  description="Sub-shade variation (A, B, C or 1-5 scale) within the same dye lot to prevent panel shading in assembly."
                  source="Found on roll inspection tag or mill shade band test."
                  example="S-01 (Dark)"
                />
              </label>
              <input
                type="text"
                placeholder="e.g. S-01"
                value={comp.shade_number || ''}
                onChange={(e) => handleComponentChange(idx, 'shade_number', e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs uppercase"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600 mb-1 flex items-center">
                Roll Width
                <InfoTooltip
                  title="Roll Width"
                  description="Usable cuttable width of the fabric roll excluding selvages/edges."
                  source="Found on roll specification tag or measured across roll face."
                  example="60 inches"
                />
              </label>
              <input
                type="text"
                placeholder='e.g. 60"'
                value={comp.roll_width || ''}
                onChange={(e) => handleComponentChange(idx, 'roll_width', e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600 mb-1 flex items-center">
                No. Spreads
                <InfoTooltip
                  title="No. Spreads"
                  description="Number of fabric layers (plies) stacked on the cutting table for this batch marker."
                  source="Cutting room lay-plan or spreader log sheet."
                  example="40 plies"
                />
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 4"
                value={comp.number_of_spreads || ''}
                onChange={(e) => handleComponentChange(idx, 'number_of_spreads', parseInt(e.target.value) || 1)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono font-bold text-center"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600 mb-1 flex items-center">
                Est. Yield (Yds/pc)
                <InfoTooltip
                  title="Est. Yield (Yds/pc)"
                  description="Average yards of fabric consumed to produce one finished garment piece."
                  source="CAD marker software or marker yardage estimate."
                  formula="Total Yards Cut ÷ Total Units Produced"
                  example="1.65"
                />
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 1.65"
                value={comp.estimated_yield || ''}
                onChange={(e) => handleComponentChange(idx, 'estimated_yield', parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-2 rounded-lg border border-amber-300 bg-amber-50/50 text-xs font-mono font-bold text-amber-900 text-center"
              />
            </div>
          </div>

          {/* Real-time Formulas Yield & Balance Strip */}
          <div className="p-4 bg-white rounded-xl border border-neutral-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 flex items-center">
                Total Units
                <InfoTooltip
                  title="Total Units"
                  description="Total garment units to be cut across all sizes in this batch."
                  source="Auto-synced from Step 2 Order & Sizes matrix."
                />
              </span>
              <span className="font-mono text-sm font-black text-neutral-900">{comp.total_units} pcs</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 flex items-center">
                Yards Cut (Supplied)
                <InfoTooltip
                  title="Yards Cut (Supplied)"
                  description="Actual total linear yards of fabric spread and cut on the cutting table."
                  source="Cutting room log or physical yardage counter."
                  example="115.0"
                />
              </span>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 100"
                value={comp.yards_cut || ''}
                onChange={(e) => handleComponentChange(idx, 'yards_cut', parseFloat(e.target.value) || 0)}
                className="w-24 h-7 px-1.5 rounded border border-neutral-300 font-mono font-bold text-xs"
              />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 flex items-center">
                Yards Used
                <InfoTooltip
                  title="Yards Used (Calculated)"
                  description="Required theoretical yardage consumed for the garments."
                  source="Calculated automatically."
                  formula="Est. Yield (Yds/pc) × Total Units"
                />
              </span>
              <span className="font-mono text-sm font-bold text-sky-900">{comp.yards_used} yds</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 flex items-center">
                Damage % ({comp.yards_damaged} yds)
                <InfoTooltip
                  title="Damage %"
                  description="Percentage of unusable fabric lost to mill flaws, holes, or slubs."
                  source="Fabric roll inspection sheet or defect tag."
                  formula="(Damaged Yards ÷ Yards Cut) × 100"
                />
              </span>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 1.5"
                value={comp.damage_percent || ''}
                onChange={(e) => handleComponentChange(idx, 'damage_percent', parseFloat(e.target.value) || 0)}
                className="w-16 h-7 px-1.5 rounded border border-neutral-300 font-mono text-xs"
              />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 flex items-center">
                Short % ({comp.yards_short} yds)
                <InfoTooltip
                  title="Short %"
                  description="End-of-roll waste and marker fall-out scrap percentage."
                  source="Cutting table scrap log."
                  formula="(Shortage Yards ÷ Yards Cut) × 100"
                />
              </span>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 0.5"
                value={comp.short_percent || ''}
                onChange={(e) => handleComponentChange(idx, 'short_percent', parseFloat(e.target.value) || 0)}
                className="w-16 h-7 px-1.5 rounded border border-neutral-300 font-mono text-xs"
              />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 flex items-center">
                Balance Yardage
                <InfoTooltip
                  title="Balance Yardage"
                  description="Remaining unused fabric returned to raw inventory."
                  source="Calculated automatically."
                  formula="Yards Cut - (Yards Used + Damaged Yards + Shortage Yards)"
                />
              </span>
              <span
                className={`font-mono text-sm font-black ${
                  (comp.yards_balance || 0) < 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {comp.yards_balance} yds
              </span>
            </div>
          </div>

        </div>
      ))}

      {/* Add Component Button */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={handleAddComponent}
          className="h-9 px-4 rounded-xl border border-dashed border-neutral-400 hover:border-amber-700 text-neutral-700 hover:text-amber-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-white transition-all shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Secondary Component (e.g. Lining, Pocketing, Fuse)</span>
        </button>
      </div>

    </div>
  );
};
