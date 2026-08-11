import React, { useState } from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import type { CutSheetComponent, CutSheetTrims } from '../../lib/types';
import { 
  Scissors, 
  Plus, 
  Trash2, 
  Layers, 
  Sparkles, 
  Calculator, 
  AlertCircle 
} from 'lucide-react';

import { RepeatableTrimsList } from './RepeatableTrimsList';

export const FactoryOneTemplate: React.FC = () => {
  const { state, updateCutSheet, updateStyleBlock } = useApplyWizard();
  const { cutSheetData, sizeMatrix, styleBlocks = [] } = state;

  const currentBlock = styleBlocks[0] || {
    id: 'default',
    product_type: 'Denim/Bottoms' as const,
    fabric_type: 'Woven' as const,
    trims_bom: [],
    size_columns: sizeMatrix.size_columns,
    size_matrix: sizeMatrix.fabrics[0]?.size_matrix || {},
    line_total: sizeMatrix.grand_total,
  };

  const components: CutSheetComponent[] = cutSheetData.sheet_data?.components || [
    {
      component_name: 'SELF',
      fabric_code: currentBlock.fabric_type === 'Knit' ? 'KN-8840FLEECE' : 'RR7276SIOUX45',
      fabric_desc: currentBlock.fabric_type === 'Knit' ? '400gsm Heavyweight Fleece 100% Cotton' : '14oz Selvedge Denim 100% Cotton',
      lot_number: 'L-9402',
      shade_number: 'S-01',
      roll_number: 'R-108',
      roll_width: '60"',
      number_of_spreads: 4,
      estimated_yield: currentBlock.fabric_type === 'Knit' ? 1.4 : 1.6,
      damage_percent: 1.5,
      short_percent: 0.5,
      plies: 1.0,
      size_columns: currentBlock.size_columns,
      size_matrix: currentBlock.size_matrix,
      color_lot: 'COLOR-01',
      total_units: currentBlock.line_total || sizeMatrix.grand_total,
      ticket_yards: 424,
      yards_used: 424,
      yards_cut: 435,
      yards_damaged: 6.5,
      yards_short: 2.2,
      yards_balance: 2.3,
    },
  ];

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
    const totalUnits = Number(comp.total_units) || 0;
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
      fabric_code: 'POP-01',
      fabric_desc: 'Chambray Pocketing 100% Cotton',
      lot_number: 'L-102',
      shade_number: 'NATURAL',
      roll_width: '58"',
      number_of_spreads: 2,
      estimated_yield: 0.35,
      damage_percent: 1.0,
      short_percent: 0.0,
      plies: 1.0,
      size_columns: sizeMatrix.size_columns,
      size_matrix: {},
      color_lot: 'RAW-NAT',
      total_units: sizeMatrix.grand_total,
      ticket_yards: Number((0.35 * sizeMatrix.grand_total).toFixed(2)),
      yards_used: Number((0.35 * sizeMatrix.grand_total).toFixed(2)),
      yards_cut: Number((0.35 * sizeMatrix.grand_total * 1.05).toFixed(2)),
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
                {idx + 1}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={comp.component_name}
                  onChange={(e) => handleComponentChange(idx, 'component_name', e.target.value.toUpperCase())}
                  className="font-bold text-sm text-neutral-900 bg-white border border-neutral-300 rounded-lg px-2.5 py-1 w-28 uppercase"
                />
                <span className="text-xs text-neutral-500 font-medium">(Component Specification)</span>
              </div>
            </div>

            {components.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveComponent(idx)}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>

          {/* Grid: Fabric Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">Fabric Code</label>
              <input
                type="text"
                value={comp.fabric_code}
                onChange={(e) => handleComponentChange(idx, 'fabric_code', e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono font-bold uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">Lot Number</label>
              <input
                type="text"
                value={comp.lot_number || ''}
                onChange={(e) => handleComponentChange(idx, 'lot_number', e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">Shade / Tint</label>
              <input
                type="text"
                value={comp.shade_number || ''}
                onChange={(e) => handleComponentChange(idx, 'shade_number', e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">Roll Width</label>
              <input
                type="text"
                value={comp.roll_width || '60"'}
                onChange={(e) => handleComponentChange(idx, 'roll_width', e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">No. Spreads</label>
              <input
                type="number"
                min="1"
                value={comp.number_of_spreads}
                onChange={(e) => handleComponentChange(idx, 'number_of_spreads', parseInt(e.target.value) || 1)}
                className="w-full h-9 px-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono font-bold text-center"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">Est. Yield (Yds/pc)</label>
              <input
                type="number"
                step="0.01"
                value={comp.estimated_yield}
                onChange={(e) => handleComponentChange(idx, 'estimated_yield', parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-2 rounded-lg border border-amber-300 bg-amber-50/50 text-xs font-mono font-bold text-amber-900 text-center"
              />
            </div>
          </div>

          {/* Real-time Formulas Yield & Balance Strip */}
          <div className="p-4 bg-white rounded-xl border border-neutral-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 block">Total Units</span>
              <span className="font-mono text-sm font-bold text-neutral-900">{comp.total_units} pcs</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 block">Yards Cut (Supplied)</span>
              <input
                type="number"
                step="0.1"
                value={comp.yards_cut}
                onChange={(e) => handleComponentChange(idx, 'yards_cut', parseFloat(e.target.value) || 0)}
                className="w-24 h-7 px-1.5 rounded border border-neutral-300 font-mono font-bold text-xs"
              />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 block">Yards Used (Calculated)</span>
              <span className="font-mono text-sm font-bold text-sky-900">{comp.yards_used} yds</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 block">Damage % ({comp.yards_damaged} yds)</span>
              <input
                type="number"
                step="0.1"
                value={comp.damage_percent}
                onChange={(e) => handleComponentChange(idx, 'damage_percent', parseFloat(e.target.value) || 0)}
                className="w-16 h-7 px-1.5 rounded border border-neutral-300 font-mono text-xs"
              />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 block">Short % ({comp.yards_short} yds)</span>
              <input
                type="number"
                step="0.1"
                value={comp.short_percent}
                onChange={(e) => handleComponentChange(idx, 'short_percent', parseFloat(e.target.value) || 0)}
                className="w-16 h-7 px-1.5 rounded border border-neutral-300 font-mono text-xs"
              />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-neutral-500 block">Balance Yardage</span>
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
          className="h-9 px-4 rounded-xl border border-dashed border-neutral-400 hover:border-amber-700 text-neutral-700 hover:text-amber-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-white transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Secondary Component (e.g. Lining, Pocketing, Fuse)</span>
        </button>
      </div>

      {/* Repeatable Trims & Hardware BOM Section */}
      <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200">
        <RepeatableTrimsList
          productType={currentBlock.product_type}
          trims={currentBlock.trims_bom || []}
          onChange={(newTrims) => updateStyleBlock(currentBlock.id, { trims_bom: newTrims })}
        />
      </div>

    </div>
  );
};
