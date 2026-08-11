import React, { useState, useEffect, useMemo } from 'react';
import { supabase, isRealSupabase } from '../../lib/supabase';
import { Calculator, Clipboard, AlertCircle } from 'lucide-react';

export interface SizeMatrixGridProps {
  sizes?: string[]; // Dynamic size array (e.g. ["28","30","32"] or ["XS","S","M","L","XL"])
  styleId?: string; // Optional style ID to auto-fetch assigned size range
  value?: Record<string, number>; // Current quantities map { "30": 100, "32": 250 }
  onChange?: (matrix: Record<string, number>, grandTotal: number) => void;
  readOnly?: boolean;
}

const DEFAULT_FALLBACK_SIZES = ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40'];

export const SizeMatrixGrid: React.FC<SizeMatrixGridProps> = ({
  sizes: providedSizes,
  styleId,
  value = {},
  onChange,
  readOnly = false,
}) => {
  const [activeSizes, setActiveSizes] = useState<string[]>(providedSizes || DEFAULT_FALLBACK_SIZES);
  const [quantities, setQuantities] = useState<Record<string, number>>(value);

  // Auto-fetch size range from styleId if provided and no explicit sizes array passed
  useEffect(() => {
    if (providedSizes && providedSizes.length > 0) {
      setActiveSizes(providedSizes);
      return;
    }

    if (styleId && isRealSupabase) {
      const fetchStyleSizeRange = async () => {
        const { data } = await supabase
          .from('styles')
          .select('size_ranges(sizes)')
          .eq('id', styleId)
          .single();

        if (data?.size_ranges?.sizes && Array.isArray(data.size_ranges.sizes)) {
          setActiveSizes(data.size_ranges.sizes);
        }
      };
      fetchStyleSizeRange();
    }
  }, [styleId, providedSizes]);

  // Sync internal quantities when controlled value prop changes
  useEffect(() => {
    setQuantities(value);
  }, [value]);

  // Calculate Grand Total
  const grandTotal = useMemo(() => {
    return activeSizes.reduce((sum, sz) => sum + (Number(quantities[sz]) || 0), 0);
  }, [activeSizes, quantities]);

  // Handle single cell change
  const handleCellChange = (sizeCode: string, rawVal: string) => {
    if (readOnly) return;
    const num = Math.max(0, parseInt(rawVal, 10) || 0);
    const updated = { ...quantities, [sizeCode]: num };
    setQuantities(updated);

    const newTotal = activeSizes.reduce((sum, sz) => sum + (Number(updated[sz]) || 0), 0);
    if (onChange) {
      onChange(updated, newTotal);
    }
  };

  // Handle Excel-like Paste (e.g. user copies row of numbers "10 20 50 100")
  const handlePaste = (e: React.ClipboardEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const tokens = text.split(/[\s,\t\n]+/).map((t) => parseInt(t, 10)).filter((n) => !isNaN(n));

    if (tokens.length === 0) return;

    const updated = { ...quantities };
    activeSizes.forEach((sz, idx) => {
      if (idx < tokens.length) {
        updated[sz] = Math.max(0, tokens[idx]);
      }
    });

    setQuantities(updated);
    const newTotal = activeSizes.reduce((sum, sz) => sum + (Number(updated[sz]) || 0), 0);
    if (onChange) {
      onChange(updated, newTotal);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
        <div className="flex items-center gap-1.5">
          <Calculator className="h-4 w-4 text-primary" />
          <span>Dynamic Size Matrix ({activeSizes.length} Size Columns)</span>
        </div>
        {!readOnly && (
          <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
            <Clipboard className="h-3 w-3" /> Supports Excel paste
          </span>
        )}
      </div>

      {!readOnly && !styleId && !providedSizes && (
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs text-neutral-600 font-bold">Size Format:</label>
          <select 
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'letter') setActiveSizes(["S", "M", "L", "XL", "XXL"]);
              else if (val === 'number') setActiveSizes(["28", "29", "30", "31", "32", "33", "34", "36", "38", "40"]);
              else if (val === 'baby') setActiveSizes(["0-3m", "3-6m", "6-12m", "12-18m", "18-24m", "2T", "3T", "4T"]);
            }}
            className="px-2 py-1.5 text-xs rounded-md border border-neutral-300 bg-white"
          >
            <option value="number">Numeric (28, 29, 30...)</option>
            <option value="letter">Letter (S, M, L...)</option>
            <option value="baby">Baby / Toddler</option>
          </select>
        </div>
      )}

      {/* Editable Grid */}
      <div className="overflow-x-auto border-2 border-border rounded-2xl bg-card shadow-xs">
        <table className="w-full text-center text-xs">
          <thead className="bg-muted/40 border-b">
            <tr>
              {activeSizes.map((sz) => (
                <th key={sz} className="px-3 py-2.5 font-mono font-bold text-foreground border-r border-border/50 last:border-r-0 min-w-[64px]">
                  {sz}
                </th>
              ))}
              <th className="px-4 py-2.5 font-bold uppercase text-primary bg-primary/5 min-w-[80px]">
                Total Pcs
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {activeSizes.map((sz) => (
                <td key={sz} className="p-1 border-r border-border/50 last:border-r-0">
                  <input
                    type="number"
                    min="0"
                    disabled={readOnly}
                    value={quantities[sz] !== undefined && quantities[sz] !== 0 ? quantities[sz] : ''}
                    onChange={(e) => handleCellChange(sz, e.target.value)}
                    onPaste={handlePaste}
                    placeholder="0"
                    className="w-full text-center py-2 px-1 font-mono font-extrabold text-foreground bg-background rounded-lg border border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted/30"
                  />
                </td>
              ))}
              <td className="p-3 font-mono font-black text-sm text-primary bg-primary/5">
                {grandTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
