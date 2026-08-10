import React, { useState } from "react";
import { X, SplitSquareHorizontal, FileEdit, Calculator } from "lucide-react";
import { FlavorSelector, type FlavorRoute } from "./FlavorSelector";

interface SizeMatrix {
  [key: string]: number;
}

interface BlanketPoData {
  id: string;
  total_contract_qty: number;
  open_balance: number;
  size_matrix: SizeMatrix;
  style_name: string;
}

interface WoSplitterModalProps {
  po: BlanketPoData;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}

import { useAppData } from "../../hooks/useAppData";

export function WoSplitterModal({ po, isOpen, onClose, onSubmit }: WoSplitterModalProps) {
  const [targetQty, setTargetQty] = useState<number>(po.open_balance > 0 ? po.open_balance : po.total_contract_qty);
  const [flavor, setFlavor] = useState<FlavorRoute>("Full CMT");
  const [startingStage, setStartingStage] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setToast } = useAppData();

  if (!isOpen) return null;

  // Calculate proportional size matrix based on targetQty vs total_contract_qty
  const splitRatio = targetQty / po.total_contract_qty;
  const calculatedMatrix: SizeMatrix = {};
  
  if (po.size_matrix) {
    Object.entries(po.size_matrix).forEach(([size, qty]) => {
      calculatedMatrix[size] = Math.round(qty * splitRatio);
    });
  }

  // Handle rounding differences
  const sumCalculated = Object.values(calculatedMatrix).reduce((a, b) => a + b, 0);
  const diff = targetQty - sumCalculated;
  
  // Very basic remainder assignment (in real app, user might manually adjust cells)
  if (diff !== 0 && Object.keys(calculatedMatrix).length > 0) {
    const firstSize = Object.keys(calculatedMatrix)[0];
    calculatedMatrix[firstSize] += diff;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetQty <= 0) {
      setToast({ message: "Batch quantity must be greater than 0.", type: "error" });
      return;
    }
    if (targetQty > po.open_balance) {
      setToast({ message: `Cannot exceed open PO balance of ${po.open_balance}.`, type: "error" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        blanket_po_id: po.id,
        target_qty: targetQty,
        size_matrix: calculatedMatrix,
        flavor_route: flavor,
        starting_stage_id: startingStage,
        assigned_facility: flavor.toLowerCase().includes("wash") ? "Laundry Facility" : "Sewing Facility",
      });
      onClose();
    } catch (err) {
      console.error(err);
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
              <p className="text-sm text-muted-foreground">PO Open Balance: <strong className="text-foreground">{po.open_balance}</strong> available to schedule</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          
          <div className="space-y-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Batch Quantity (Target)
            </label>
            <div className="relative">
              <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input 
                type="number"
                min="1"
                max={po.open_balance}
                value={targetQty || ""}
                onChange={(e) => setTargetQty(parseInt(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-xl text-lg font-bold"
                required
              />
            </div>
            {targetQty > po.open_balance && (
              <p className="text-xs text-destructive font-medium">Cannot exceed open PO balance ({po.open_balance}).</p>
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
              Proportional Size Breakdown
            </label>
            <div className="border rounded-xl overflow-hidden bg-muted/20">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] divide-x text-center border-b bg-muted/40">
                {Object.keys(calculatedMatrix).map(size => (
                  <div key={size} className="py-2 text-[11px] font-bold text-muted-foreground">{size}</div>
                ))}
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] divide-x text-center">
                {Object.values(calculatedMatrix).map((qty, i) => (
                  <div key={i} className="py-3 text-sm font-bold">{qty}</div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-right">* Sizes auto-distributed based on split ratio.</p>
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
            disabled={isSubmitting || targetQty <= 0 || targetQty > po.open_balance}
            className="px-5 py-2 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? "Generating..." : "Generate Work Order Batch"}
          </button>
        </div>

      </div>
    </div>
  );
}
