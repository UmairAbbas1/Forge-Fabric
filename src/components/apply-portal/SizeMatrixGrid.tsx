import React, { useState, useRef, useCallback } from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { useCutSheetParser } from '../../hooks/useCutSheetParser';
import type { WeissmadeFabricRow } from '../../lib/types';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertCircle, 
  Sparkles,
  Layers
} from 'lucide-react';

const PRESETS = {
  mens_jeans: {
    label: "Men's Jeans (28–40)",
    sizes: ['28', '29', '30', '31', '32', '33', '34', '35', '36', '38', '40'],
  },
  womens_jeans: {
    label: "Women's Jeans (24–34)",
    sizes: ['24', '25', '26', '27', '28', '29', '30', '31', '32', '34'],
  },
  mens_tops: {
    label: "Men's Tops (XS–3XL)",
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  womens_tops: {
    label: "Women's Tops (XXS–XL)",
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL'],
  },
  custom: {
    label: 'Custom Sizes',
    sizes: ['S', 'M', 'L'],
  },
};

export const SizeMatrixGrid: React.FC = () => {
  const { state, updateSizeMatrix } = useApplyWizard();
  const { sizeMatrix, workOrder } = state;
  const { parseExcelFile, exportSizeMatrixToExcel } = useCutSheetParser();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddFabricModal, setShowAddFabricModal] = useState(false);
  const [newFabricName, setNewFabricName] = useState('');
  const [newFabricColor, setNewFabricColor] = useState('INDIGO');
  const [newCustomSize, setNewCustomSize] = useState('');
  const [showImportPreviewModal, setShowImportPreviewModal] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    fabrics: WeissmadeFabricRow[];
    sizes: string[];
    total: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Recalculate totals
  const recalculate = useCallback((fabrics: WeissmadeFabricRow[], sizes: string[]) => {
    let grand = 0;
    const updated = fabrics.map((f) => {
      let lineTotal = 0;
      sizes.forEach((s) => {
        lineTotal += Number(f.size_matrix[s] || 0);
      });
      grand += lineTotal;
      return {
        ...f,
        size_columns: sizes,
        line_total: lineTotal,
      };
    });

    updateSizeMatrix({
      size_columns: sizes,
      fabrics: updated,
      grand_total: grand,
    });
  }, [updateSizeMatrix]);

  // Switch preset
  const handlePresetChange = (presetKey: keyof typeof PRESETS) => {
    const newSizes = PRESETS[presetKey].sizes;
    const updatedFabrics = sizeMatrix.fabrics.map((f) => ({
      ...f,
      size_columns: newSizes,
    }));
    updateSizeMatrix({ preset: presetKey });
    recalculate(updatedFabrics, newSizes);
  };

  // Add custom size column
  const handleAddSizeColumn = () => {
    if (!newCustomSize.trim()) return;
    const clean = newCustomSize.trim().toUpperCase();
    if (sizeMatrix.size_columns.includes(clean)) return;

    const newSizes = [...sizeMatrix.size_columns, clean];
    setNewCustomSize('');
    recalculate(sizeMatrix.fabrics, newSizes);
  };

  // Remove size column
  const handleRemoveSizeColumn = (sizeToRemove: string) => {
    if (sizeMatrix.size_columns.length <= 1) return;
    const newSizes = sizeMatrix.size_columns.filter((s) => s !== sizeToRemove);
    const updatedFabrics = sizeMatrix.fabrics.map((f) => {
      const copy = { ...f.size_matrix };
      delete copy[sizeToRemove];
      return { ...f, size_matrix: copy };
    });
    recalculate(updatedFabrics, newSizes);
  };

  // Add Fabric Row
  const handleAddFabricSubmit = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!newFabricName.trim()) return;

    const newRow: WeissmadeFabricRow = {
      fabric_name: newFabricName.trim().toUpperCase(),
      color: newFabricColor.trim().toUpperCase() || 'INDIGO',
      size_columns: sizeMatrix.size_columns,
      size_matrix: {},
      line_total: 0,
    };

    const updated = [...sizeMatrix.fabrics, newRow];
    setNewFabricName('');
    setNewFabricColor('INDIGO');
    setShowAddFabricModal(false);
    recalculate(updated, sizeMatrix.size_columns);
  };

  // Remove Fabric Row
  const handleRemoveFabric = (index: number) => {
    if (sizeMatrix.fabrics.length <= 1) return;
    const updated = sizeMatrix.fabrics.filter((_, idx) => idx !== index);
    recalculate(updated, sizeMatrix.size_columns);
  };

  // Edit cell value
  const handleCellChange = (fabricIndex: number, size: string, value: string) => {
    const numericVal = Math.max(0, parseInt(value, 10) || 0);
    const updated = [...sizeMatrix.fabrics];
    updated[fabricIndex] = {
      ...updated[fabricIndex],
      size_matrix: {
        ...updated[fabricIndex].size_matrix,
        [size]: numericVal,
      },
    };
    recalculate(updated, sizeMatrix.size_columns);
  };

  // Handle Excel File Upload & Import
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const parsed = await parseExcelFile(file);
      if (parsed.fabrics && parsed.fabrics.length > 0) {
        const detectedSizes = parsed.fabrics[0].size_columns || sizeMatrix.size_columns;
        setImportPreviewData({
          fabrics: parsed.fabrics,
          sizes: detectedSizes,
          total: parsed.totalQuantity,
        });
        setShowImportPreviewModal(true);
      }
    } catch (err: any) {
      alert(`Excel Parse Failed: ${err.message || 'Check spreadsheet layout.'}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirm Import
  const handleApplyImport = () => {
    if (!importPreviewData) return;
    updateSizeMatrix({
      preset: 'custom',
      size_columns: importPreviewData.sizes,
      fabrics: importPreviewData.fabrics,
      grand_total: importPreviewData.total,
    });
    setShowImportPreviewModal(false);
    setImportPreviewData(null);
  };

  // Excel TSV Paste Support (e.g. pasting copied numbers directly into matrix)
  const handlePaste = (e: React.ClipboardEvent, startFabricIdx: number, startSizeIdx: number) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData || !clipboardData.includes('\t') && !clipboardData.includes('\n')) return;

    e.preventDefault();
    const rows = clipboardData.split(/\r\n|\n|\r/).filter(Boolean);
    const updated = [...sizeMatrix.fabrics];

    rows.forEach((rowStr, rIdx) => {
      const targetFabricIdx = startFabricIdx + rIdx;
      if (targetFabricIdx >= updated.length) return;

      const cells = rowStr.split('\t');
      cells.forEach((cellVal, cIdx) => {
        const targetSizeIdx = startSizeIdx + cIdx;
        if (targetSizeIdx >= sizeMatrix.size_columns.length) return;

        const sizeKey = sizeMatrix.size_columns[targetSizeIdx];
        const num = Math.max(0, parseInt(cellVal.trim(), 10) || 0);
        updated[targetFabricIdx] = {
          ...updated[targetFabricIdx],
          size_matrix: {
            ...updated[targetFabricIdx].size_matrix,
            [sizeKey]: num,
          },
        };
      });
    });

    recalculate(updated, sizeMatrix.size_columns);
  };

  return (
    <div className="space-y-5">
      
      {/* Controls Topbar: Presets & Excel Tools */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
        
        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Size Preset:</span>
          <select
            value={sizeMatrix.preset}
            onChange={(e) => handlePresetChange(e.target.value as keyof typeof PRESETS)}
            className="h-9 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 shadow-2xs focus:ring-2 focus:ring-amber-500"
          >
            {Object.entries(PRESETS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons: Add Fabric, Excel Import, Excel Export */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddFabricModal(true)}
            className="h-9 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Fabric Row</span>
          </button>

          {/* Import Excel */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelected}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="h-9 px-3 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-500" />
            <span>{isImporting ? 'Parsing...' : 'Import Excel'}</span>
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={() => exportSizeMatrixToExcel(sizeMatrix, workOrder.style_name)}
            className="h-9 px-3 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline">Export XLSX</span>
          </button>
        </div>

      </div>

      {/* Dynamic Spreadsheet Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-300 bg-white shadow-2xs">
        <table className="w-full text-xs text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-neutral-900 text-white font-mono uppercase tracking-wider text-[11px]">
              {/* Sticky first column for mobile scrolling */}
              <th className="p-3 sticky left-0 z-20 bg-neutral-900 w-44 border-r border-neutral-800">
                Fabric Name
              </th>
              <th className="p-3 w-32 border-r border-neutral-800">Colorway</th>
              
              {/* Size Columns */}
              {sizeMatrix.size_columns.map((size) => (
                <th key={size} className="p-3 text-center min-w-[64px] border-r border-neutral-800 relative group">
                  <div className="flex items-center justify-center gap-1">
                    <span>{size}</span>
                    {sizeMatrix.size_columns.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSizeColumn(size)}
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-400 p-0.5 rounded cursor-pointer transition-opacity"
                        title={`Remove size ${size}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}

              <th className="p-3 text-center w-28 bg-neutral-950 font-bold border-r border-neutral-800">
                Line Total
              </th>
              <th className="p-3 text-center w-12 bg-neutral-950">Act</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-200 font-sans">
            {sizeMatrix.fabrics.map((fabric, fIdx) => (
              <tr key={fIdx} className="hover:bg-amber-50/30 transition-colors">
                
                {/* Fabric Name (Sticky Column) */}
                <td className="p-2.5 font-bold text-neutral-900 sticky left-0 z-10 bg-white group-hover:bg-amber-50/30 border-r border-neutral-200">
                  <input
                    type="text"
                    value={fabric.fabric_name}
                    onChange={(e) => {
                      const updated = [...sizeMatrix.fabrics];
                      updated[fIdx].fabric_name = e.target.value;
                      updateSizeMatrix({ fabrics: updated });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    className="w-full h-8 px-2 rounded border border-transparent hover:border-neutral-300 focus:border-amber-500 focus:bg-white font-bold text-xs uppercase"
                  />
                </td>

                {/* Color */}
                <td className="p-2.5 border-r border-neutral-200">
                  <input
                    type="text"
                    value={fabric.color}
                    onChange={(e) => {
                      const updated = [...sizeMatrix.fabrics];
                      updated[fIdx].color = e.target.value;
                      updateSizeMatrix({ fabrics: updated });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    className="w-full h-8 px-2 rounded border border-transparent hover:border-neutral-300 focus:border-amber-500 focus:bg-white text-xs uppercase text-neutral-600 font-medium"
                  />
                </td>

                {/* Size Matrix Cell Inputs with Clipboard Paste */}
                {sizeMatrix.size_columns.map((size, sIdx) => {
                  const val = fabric.size_matrix[size] ?? 0;
                  return (
                    <td key={size} className="p-2 text-center border-r border-neutral-200">
                      <input
                        type="number"
                        min="0"
                        value={val === 0 ? '' : val}
                        placeholder="0"
                        onChange={(e) => handleCellChange(fIdx, size, e.target.value)}
                        onPaste={(e) => handlePaste(e, fIdx, sIdx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.preventDefault();
                        }}
                        className={`w-full h-8 px-1 text-center font-mono text-xs rounded border transition-all ${
                          val > 0
                            ? 'font-bold text-neutral-900 bg-amber-50/50 border-amber-300'
                            : 'text-neutral-400 border-neutral-200 hover:border-neutral-300'
                        } focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white`}
                      />
                    </td>
                  );
                })}

                {/* Line Total */}
                <td className="p-2.5 text-center font-mono font-bold text-neutral-900 bg-neutral-50/80 border-r border-neutral-200">
                  {fabric.line_total}
                </td>

                {/* Delete Row Button */}
                <td className="p-2 text-center">
                  <button
                    type="button"
                    disabled={sizeMatrix.fabrics.length <= 1}
                    onClick={() => handleRemoveFabric(fIdx)}
                    className="p-1.5 text-neutral-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-neutral-400 cursor-pointer rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}

            {/* Column Sums Footer */}
            <tr className="bg-neutral-100 font-mono font-bold text-neutral-900 text-[11px] border-t-2 border-neutral-300">
              <td className="p-3 sticky left-0 z-10 bg-neutral-100 border-r border-neutral-300 uppercase">
                TOTAL UNITS
              </td>
              <td className="p-3 border-r border-neutral-300 text-neutral-500 font-normal">
                {sizeMatrix.fabrics.length} Fabrics
              </td>

              {sizeMatrix.size_columns.map((size) => {
                const colSum = sizeMatrix.fabrics.reduce((acc, f) => acc + (f.size_matrix[size] || 0), 0);
                return (
                  <td key={size} className="p-3 text-center border-r border-neutral-300">
                    {colSum}
                  </td>
                );
              })}

              <td className="p-3 text-center bg-amber-100 text-amber-950 text-xs border-r border-neutral-300 font-black">
                {sizeMatrix.grand_total}
              </td>
              <td className="p-3 bg-neutral-100"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add Custom Size Column Quick Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add Size (e.g. 42 or 4XL)"
            value={newCustomSize}
            onChange={(e) => setNewCustomSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSizeColumn();
              }
            }}
            className="h-8 px-3 rounded-lg border border-neutral-300 text-xs font-mono uppercase w-48 focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleAddSizeColumn}
            className="h-8 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold cursor-pointer"
          >
            + Add Size Column
          </button>
        </div>

        {/* Grand Total Callout */}
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
          <span className="text-xs font-bold text-neutral-700">Contract Total Units:</span>
          <span className="font-mono text-base font-black text-amber-900">
            {sizeMatrix.grand_total} pcs
          </span>
        </div>
      </div>

      {/* Modal: Add Fabric Row */}
      {showAddFabricModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h4 className="font-bold text-sm text-neutral-900">Add Fabric &amp; Colorway Row</h4>
              <button type="button" onClick={() => setShowAddFabricModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Fabric Name / Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 14oz RAW SELVEDGE or SIOUX"
                  value={newFabricName}
                  onChange={(e) => setNewFabricName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFabricSubmit(e);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-xs font-bold uppercase focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Colorway / Wash Shade
                </label>
                <input
                  type="text"
                  placeholder="e.g. DEEP INDIGO or BLEACH WASH"
                  value={newFabricColor}
                  onChange={(e) => setNewFabricColor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFabricSubmit(e);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-xs font-medium uppercase focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddFabricModal(false)}
                  className="flex-1 h-10 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddFabricSubmit()}
                  className="flex-1 h-10 rounded-lg bg-amber-700 hover:bg-amber-800 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  Add Row
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Excel Preview */}
      {showImportPreviewModal && importPreviewData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2 text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
                <h4 className="font-bold text-base text-neutral-900">Excel Size Matrix Parsed</h4>
              </div>
              <button onClick={() => setShowImportPreviewModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <p className="text-neutral-600">
                Successfully parsed <strong>{importPreviewData.fabrics.length} fabric row(s)</strong> with <strong>{importPreviewData.sizes.length} size columns</strong>:
              </p>
              
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 max-h-48 overflow-y-auto space-y-2">
                {importPreviewData.fabrics.map((f, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border border-neutral-200 text-xs">
                    <div>
                      <span className="font-bold text-neutral-900">{f.fabric_name}</span>
                      <span className="text-neutral-500 ml-2">({f.color})</span>
                    </div>
                    <span className="font-mono font-bold text-amber-900">{f.line_total} units</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center font-bold text-neutral-900 pt-2">
                <span>Total Imported Quantity:</span>
                <span className="font-mono text-sm text-emerald-700">{importPreviewData.total} units</span>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowImportPreviewModal(false)}
                className="flex-1 h-10 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyImport}
                className="flex-1 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Apply to Size Matrix</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
