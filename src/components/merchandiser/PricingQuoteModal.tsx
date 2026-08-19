import { useMemo, useState } from "react";
import { X, Calculator, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import type { ApplySubmission } from "../../lib/types";

interface PricingQuoteModalProps {
  submission: ApplySubmission;
  isOpen: boolean;
  onClose: () => void;
  onIssued?: () => void;
}

/**
 * REQ-07: Merchandiser Unit Price Calculator & Quoting Workflow.
 * Final Unit Price = CMT Base Labor + Wash Surcharge + Trims/Packing Surcharge + Factory Margin.
 */
export function PricingQuoteModal({ submission, isOpen, onClose, onIssued }: PricingQuoteModalProps) {
  const [styleName, setStyleName] = useState(submission.product_type || "Style Pending");
  const [quantity, setQuantity] = useState<number>(500);
  const [cmtCost, setCmtCost] = useState<number>(8.5);
  const [washCost, setWashCost] = useState<number>(2.25);
  const [trimsCost, setTrimsCost] = useState<number>(1.75);
  const [marginPct, setMarginPct] = useState<number>(20);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ quoteNumber: string } | null>(null);

  const baseCost = cmtCost + washCost + trimsCost;
  const finalUnitPrice = useMemo(() => Math.round(baseCost * (1 + marginPct / 100) * 100) / 100, [baseCost, marginPct]);
  const totalContractValue = useMemo(() => Math.round(finalUnitPrice * quantity * 100) / 100, [finalUnitPrice, quantity]);

  if (!isOpen) return null;

  const handleIssueQuote = async () => {
    setError("");
    if (quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    setIssuing(true);
    try {
      const quoteNumber = `QUO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      if (isRealSupabase) {
        const { error: insertErr } = await supabase.from("price_quotes").insert({
          quote_number: quoteNumber,
          submission_id: submission.id,
          customer_name: submission.company_name,
          style_name: styleName,
          quantity,
          cmt_unit_cost: cmtCost,
          wash_unit_cost: washCost,
          trims_unit_cost: trimsCost,
          factory_margin_pct: marginPct,
          final_unit_price: finalUnitPrice,
          total_contract_value: totalContractValue,
          status: "Sent_To_Customer",
          issued_by: "Merchandiser",
        });
        if (insertErr) throw insertErr;

        await supabase
          .from("apply_submissions")
          .update({ pricing_status: "Pending_Pricing_Approval", updated_at: new Date().toISOString() })
          .eq("id", submission.id);
      }

      setIssued({ quoteNumber });
      onIssued?.();
    } catch (err: any) {
      setError(err.message || "Failed to issue price quote.");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-purple-600" /> Merchandiser Unit Cost Calculator
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {submission.company_name} · Ref: <span className="font-mono font-bold">{submission.apply_reference_code || submission.id}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {issued ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-neutral-900">Quote Sent to Customer</h3>
            <p className="text-xs text-neutral-500">
              Quote <span className="font-mono font-bold text-neutral-800">{issued.quoteNumber}</span> is now visible on the customer's public order status page for digital acceptance.
            </p>
            <button onClick={onClose} className="mt-2 px-5 py-2 bg-neutral-900 text-white rounded-lg font-semibold text-sm hover:bg-neutral-800">
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Style / Product</label>
                <input
                  type="text"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Factory Margin %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={marginPct}
                  onChange={(e) => setMarginPct(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">CMT Base Labor ($/pc)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={cmtCost}
                  onChange={(e) => setCmtCost(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Wash Surcharge ($/pc)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={washCost}
                  onChange={(e) => setWashCost(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Trims &amp; Packing Surcharge ($/pc)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={trimsCost}
                  onChange={(e) => setTrimsCost(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
              <div className="flex justify-between">
                <span className="text-purple-800 font-semibold">Base Cost (CMT + Wash + Trims)</span>
                <span className="font-mono font-bold text-purple-900">${baseCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-900 font-black">Final Unit Price</span>
                <span className="font-mono font-black text-purple-900">${finalUnitPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-purple-200">
                <span className="text-purple-800 font-semibold">Total Contract Value</span>
                <span className="font-mono font-black text-emerald-700">${totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-neutral-300 rounded-lg font-semibold hover:bg-neutral-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssueQuote}
                disabled={issuing}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> {issuing ? "Sending..." : "Send Quote to Customer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
