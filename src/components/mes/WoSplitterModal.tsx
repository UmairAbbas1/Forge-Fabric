import React, { useMemo, useState } from "react";
import { X, SplitSquareHorizontal, Calculator, Plus, Trash2, AlertTriangle } from "lucide-react";
import { FlavorSelector, type FlavorRoute } from "./FlavorSelector";
import { sortedSizeKeys } from "../../lib/utils";

interface SizeMatrix {
  [key: string]: number;
}

interface ParentOrderData {
  order_id: string;
  qty: number;
  openBalance: number;
  /** Real parsed { size: qty } map from the parent's size_breakdown, or null if
   *  the parent order has no genuine per-size data (a range label or placeholder
   *  instead of "28:100, 30:250" pairs) — in that case sizes must be entered
   *  manually rather than fabricated. */
  sizeBreakdownMap: SizeMatrix | null;
  style_name: string;
}

export interface WoSplitterSubmitPayload {
  target_qty: number;
  size_breakdown_map: SizeMatrix;
  flavor_route: FlavorRoute;
  starting_stage_id: number;
  assigned_facility: string;
}

interface WoSplitterModalProps {
  parentOrder: ParentOrderData;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: WoSplitterSubmitPayload) => Promise<void>;
}

export function WoSplitterModal({ parentOrder, isOpen, onClose, onSubmit }: WoSplitterModalProps) {
  const [targetQty, setTargetQty] = useState<number>(
    parentOrder.openBalance > 0 ? parentOrder.openBalance : parentOrder.qty
  );
  const [flavor, setFlavor] = useState<FlavorRoute>("Full CMT");
  const [startingStage, setStartingStage] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Manual size entry state — only used when the parent has no real per-size data
  const [manualSizes, setManualSizes] = useState<{ size: string; qty: number }[]>([{ size: "", qty: 0 }]);

  // Proportional split from genuine parent size:qty data — never fabricated.
  // Must run before the `!isOpen` early return below (Rules of Hooks: every
  // hook call has to happen unconditionally, in the same order, every render).
  const calculatedMatrix: SizeMatrix = useMemo(() => {
    if (!parentOrder.sizeBreakdownMap) return {};
    const splitRatio = parentOrder.qty > 0 ? targetQty / parentOrder.qty : 0;
    const matrix: SizeMatrix = {};
    sortedSizeKeys(parentOrder.sizeBreakdownMap).forEach((size) => {
      matrix[size] = Math.round(parentOrder.sizeBreakdownMap![size] * splitRatio);
    });
    const sum = Object.values(matrix).reduce((a, b) => a + b, 0);
    const diff = targetQty - sum;
    const keys = Object.keys(matrix);
    if (diff !== 0 && keys.length > 0) matrix[keys[0]] += diff;
    return matrix;
  }, [parentOrder.sizeBreakdownMap, parentOrder.qty, targetQty]);

  if (!isOpen) return null;

  const hasRealSizeData = !!parentOrder.sizeBreakdownMap;

  const manualSizeSum = manualSizes.reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
  const manualSizesValid =
    manualSizes.length > 0 &&
    manualSizes.every((s) => s.size.trim().length > 0 && Number(s.qty) > 0) &&
    manualSizeSum === targetQty;

  const finalMatrix: SizeMatrix = hasRealSizeData
    ? calculatedMatrix
    : manualSizes.reduce((acc, s) => {
        if (s.size.trim()) acc[s.size.trim()] = Number(s.qty) || 0;
        return acc;
      }, {} as SizeMatrix);

  const canSubmit =
    targetQty > 0 &&
    targetQty <= parentOrder.openBalance &&
    (hasRealSizeData ? Object.keys(finalMatrix).length > 0 : manualSizesValid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (targetQty <= 0) {
      setSubmitError("Batch quantity must be greater than 0.");
      return;
    }
    if (targetQty > parentOrder.openBalance) {
      setSubmitError(`Cannot exceed open balance of ${parentOrder.openBalance}.`);
      return;
    }
    if (!hasRealSizeData && !manualSizesValid) {
      setSubmitError(`Manually entered sizes must sum to exactly ${targetQty} pcs.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        target_qty: targetQty,
        size_breakdown_map: finalMatrix,
        flavor_route: flavor,
        starting_stage_id: startingStage,
        assigned_facility: flavor.toLowerCase().includes("wash") ? "Laundry Facility" : "Sewing Facility",
      });
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to create batch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl border shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <SplitSquareHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Split Work Order (Batch Creation)</h2>
              <p className="text-sm text-muted-foreground">Open Balance: <strong className="text-foreground">{parentOrder.openBalance.toLocaleString()}</strong> available to schedule</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">

          {submitError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {submitError}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Batch Quantity (Target)
            </label>
            <div className="relative">
              <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="number"
                min="1"
                max={parentOrder.openBalance}
                value={targetQty || ""}
                onChange={(e) => setTargetQty(parseInt(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-xl text-lg font-bold"
                required
              />
            </div>
            {targetQty > parentOrder.openBalance && (
              <p className="text-xs text-destructive font-medium">Cannot exceed open balance ({parentOrder.openBalance.toLocaleString()}).</p>
            )}
          </div>

          <FlavorSelector
            value={flavor}
            onChange={(f, stage) => {
              setFlavor(f);
              setStartingStage(stage);
            }}
          />

          <div className="space-y-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {hasRealSizeData ? "Proportional Size Breakdown" : "Size Breakdown (Manual Entry Required)"}
            </label>

            {hasRealSizeData ? (
              <>
                <div className="border rounded-xl overflow-hidden bg-muted/20">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] divide-x text-center border-b bg-muted/40">
                    {Object.keys(calculatedMatrix).map((size) => (
                      <div key={size} className="py-2 text-[11px] font-bold text-muted-foreground">{size}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] divide-x text-center">
                    {Object.values(calculatedMatrix).map((qty, i) => (
                      <div key={i} className="py-3 text-sm font-bold">{qty}</div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground text-right">* Sizes auto-distributed proportionally from the parent order's real size breakdown.</p>
              </>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                  This order doesn't have a genuine per-size breakdown on file (only a range label or placeholder), so sizes can't be auto-split. Enter the real size breakdown for this batch — it must sum to exactly the batch quantity.
                </div>
                <div className="space-y-2">
                  {manualSizes.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Size (e.g. 32, M)"
                        value={row.size}
                        onChange={(e) => {
                          const next = [...manualSizes];
                          next[i] = { ...next[i], size: e.target.value };
                          setManualSizes(next);
                        }}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background"
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={row.qty || ""}
                        onChange={(e) => {
                          const next = [...manualSizes];
                          next[i] = { ...next[i], qty: parseInt(e.target.value) || 0 };
                          setManualSizes(next);
                        }}
                        className="w-28 px-3 py-2 border rounded-lg text-sm bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => setManualSizes(manualSizes.filter((_, idx) => idx !== i))}
                        disabled={manualSizes.length === 1}
                        className="p-2 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setManualSizes([...manualSizes, { size: "", qty: 0 }])}
                    className="text-xs font-bold text-primary flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Size
                  </button>
                </div>
                <p className={`text-[11px] font-semibold text-right ${manualSizeSum === targetQty ? "text-success" : "text-destructive"}`}>
                  Sum: {manualSizeSum.toLocaleString()} / {targetQty.toLocaleString()} pcs
                </p>
              </>
            )}
          </div>

        </form>

        {/* Footer */}
        <div className="p-5 border-t bg-muted/20 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg font-semibold border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="px-5 py-2 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? "Generating..." : "Generate Work Order Batch"}
          </button>
        </div>

      </div>
    </div>
  );
}
