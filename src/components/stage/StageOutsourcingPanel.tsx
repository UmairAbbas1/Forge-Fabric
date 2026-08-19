import { useEffect, useState } from "react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import { usePermission } from "../../hooks/usePermission";
import { SectionCard } from "../AppShell";
import { Factory, Plus, X, Truck, PackageCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

const STAGE_OPTIONS = [
  { id: 1, name: "Customer Order Intake" },
  { id: 2, name: "Raw Material Receiving" },
  { id: 3, name: "Fabric & Trim Inspection" },
  { id: 4, name: "Pre-Production Planning" },
  { id: 5, name: "Pattern / Marker / Cutting" },
  { id: 6, name: "Bundling & Line Feeding" },
  { id: 7, name: "Sewing Production" },
  { id: 8, name: "Pre-Wash QC" },
  { id: 9, name: "Laundry / Wash / Dry" },
  { id: 10, name: "Laser / Ozone / Spray / 3D Finish" },
  { id: 11, name: "Final Quality Inspection" },
  { id: 12, name: "Pressing / Tagging / Packing" },
  { id: 13, name: "Finished Goods Dispatch" },
];

interface OutsourcingRecord {
  id: string;
  stage_number: number;
  stage_name: string;
  vendor_name: string;
  vendor_facility_location?: string;
  outsource_po_number: string;
  quantity_dispatched: number;
  quantity_received: number;
  unit_cost_usd?: number;
  total_cost_usd?: number;
  expected_return_at?: string;
  received_at?: string;
  vendor_status: string;
  notes?: string;
}

interface StageOutsourcingPanelProps {
  orderId: string;
}

const VENDOR_STATUS_STYLES: Record<string, string> = {
  Dispatched: "bg-amber-50 text-amber-800 border-amber-200",
  In_Process: "bg-blue-50 text-blue-800 border-blue-200",
  Returned_Partial: "bg-orange-50 text-orange-800 border-orange-200",
  Returned_Complete: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Defect_Hold: "bg-red-50 text-red-800 border-red-200",
};

/** REQ-08: Universal Outsourcing Support for All 13 Production Stages. */
export function StageOutsourcingPanel({ orderId }: StageOutsourcingPanelProps) {
  const canManage = usePermission("production_planning", "update");
  const [records, setRecords] = useState<OutsourcingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [stageNumber, setStageNumber] = useState(5);
  const [vendorName, setVendorName] = useState("");
  const [vendorLocation, setVendorLocation] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [qtyDispatched, setQtyDispatched] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [expectedReturn, setExpectedReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        const { data } = await supabase
          .from("stage_outsourcing_records")
          .select("*")
          .eq("order_id", orderId)
          .order("dispatched_at", { ascending: false });
        setRecords((data as OutsourcingRecord[]) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!vendorName.trim() || !poNumber.trim()) {
      setFormError("Vendor name and outsource PO number are required.");
      return;
    }
    if (qtyDispatched <= 0) {
      setFormError("Dispatched quantity must be greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const stageInfo = STAGE_OPTIONS.find((s) => s.id === stageNumber)!;
      if (isRealSupabase) {
        const { error } = await supabase.from("stage_outsourcing_records").insert({
          order_id: orderId,
          stage_number: stageNumber,
          stage_name: stageInfo.name,
          vendor_name: vendorName.trim(),
          vendor_facility_location: vendorLocation.trim() || null,
          outsource_po_number: poNumber.trim(),
          quantity_dispatched: qtyDispatched,
          unit_cost_usd: unitCost,
          total_cost_usd: Math.round(unitCost * qtyDispatched * 100) / 100,
          expected_return_at: expectedReturn || null,
          vendor_status: "Dispatched",
          notes: notes.trim() || null,
        });
        if (error) throw error;
      }
      setStatusMsg({ type: "success", text: `Stage ${stageNumber} outsourced to ${vendorName.trim()} (${qtyDispatched} pcs).` });
      setShowModal(false);
      setVendorName(""); setVendorLocation(""); setPoNumber(""); setQtyDispatched(0); setUnitCost(0); setExpectedReturn(""); setNotes("");
      load();
    } catch (err: any) {
      setFormError(err.message || "Failed to log outsourcing record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (record: OutsourcingRecord, newStatus: string, qtyReceived?: number) => {
    try {
      const updates: Record<string, any> = { vendor_status: newStatus };
      if (qtyReceived !== undefined) {
        updates.quantity_received = qtyReceived;
        updates.received_at = new Date().toISOString();
      }
      if (isRealSupabase) {
        const { error } = await supabase.from("stage_outsourcing_records").update(updates).eq("id", record.id);
        if (error) throw error;
      }
      load();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to update outsourcing status." });
    }
  };

  return (
    <SectionCard title={`Stage Outsourcing (${records.length})`}>
      {statusMsg && (
        <div className={`mb-3 p-2.5 rounded-lg text-[11px] font-bold flex items-center gap-2 ${statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {statusMsg.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {canManage && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full mb-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
        >
          <Factory className="h-3.5 w-3.5" /> Route Stage to Outside Vendor
        </button>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Loading outsourcing records...</div>
      ) : records.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
          No stages outsourced for this order. All production is in-house.
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="p-3 bg-muted/20 border rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Stage {r.stage_number}: {r.stage_name}</span>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${VENDOR_STATUS_STYLES[r.vendor_status] || "bg-muted text-muted-foreground"}`}>
                  {r.vendor_status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-muted-foreground">
                {r.vendor_name}{r.vendor_facility_location ? ` · ${r.vendor_facility_location}` : ""}
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span>PO: {r.outsource_po_number}</span>
                <span>{r.quantity_received}/{r.quantity_dispatched} pcs returned</span>
              </div>
              {canManage && r.vendor_status !== "Returned_Complete" && (
                <div className="flex gap-1.5 pt-1.5 border-t">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(r, "In_Process")}
                    className="flex-1 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-md text-[10px] font-bold"
                  >
                    Mark In-Process
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(r, "Returned_Complete", r.quantity_dispatched)}
                    className="flex-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <PackageCheck className="h-3 w-3" /> Full Return
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Truck className="h-4 w-4 text-indigo-600" /> Route Stage to Outside Vendor
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            {formError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] font-bold text-red-800 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase text-muted-foreground block mb-1">Production Stage</label>
                <select value={stageNumber} onChange={(e) => setStageNumber(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-background font-semibold">
                  {STAGE_OPTIONS.map((s) => <option key={s.id} value={s.id}>Stage {s.id}: {s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Vendor Name *</label>
                  <input type="text" required value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="w-full p-2 border rounded-lg bg-background" />
                </div>
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Vendor Location</label>
                  <input type="text" value={vendorLocation} onChange={(e) => setVendorLocation(e.target.value)} className="w-full p-2 border rounded-lg bg-background" />
                </div>
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Outsource PO # *</label>
                  <input type="text" required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="w-full p-2 border rounded-lg bg-background font-mono font-bold" />
                </div>
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Expected Return</label>
                  <input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} className="w-full p-2 border rounded-lg bg-background" />
                </div>
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Qty Dispatched *</label>
                  <input type="number" min={1} required value={qtyDispatched} onChange={(e) => setQtyDispatched(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-background font-mono font-bold" />
                </div>
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Unit Cost (USD)</label>
                  <input type="number" step="0.01" min={0} value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-background font-mono font-bold" />
                </div>
              </div>
              <div>
                <label className="font-bold uppercase text-muted-foreground block mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 border rounded-lg bg-background" />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 border rounded-lg font-bold hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> {isSubmitting ? "Logging..." : "Log Outsourcing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
