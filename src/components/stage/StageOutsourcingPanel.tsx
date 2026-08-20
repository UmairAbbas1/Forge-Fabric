import { useMemo, useState } from "react";
import { usePermission } from "../../hooks/usePermission";
import { useAuth } from "../../hooks/useAuth";
import { SectionCard } from "../AppShell";
import {
  useOutsourceRecordsByOrder,
  useDispatchOutsource,
  useReceiveOutsource,
  type OutsourceRecord,
} from "../../hooks/useOutsourcing";
import { getStageMaterialInfo, getStageFriendlyName, type MaterialType } from "../../lib/outsourcing-constants";
import { Factory, Plus, X, Truck, PackageCheck, AlertTriangle, CheckCircle2, ShieldQuestion, Undo2 } from "lucide-react";

interface StageOutsourcingPanelProps {
  orderId: string;
  /** REQ-14: when present, the Dispatch stage selector only offers stages this order actually selected. */
  selectedStages?: number[];
}

const VENDOR_STATUS_STYLES: Record<string, string> = {
  Dispatched: "bg-amber-50 text-amber-800 border-amber-200",
  In_Process: "bg-blue-50 text-blue-800 border-blue-200",
  Returned_Partial: "bg-orange-50 text-orange-800 border-orange-200",
  Returned_Complete: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Defect_Hold: "bg-red-50 text-red-800 border-red-200",
};

const RETURN_QC_STYLES: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-800 border-amber-200",
  Passed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Partial_Pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Failed: "bg-red-50 text-red-800 border-red-200",
  Rework: "bg-orange-50 text-orange-800 border-orange-200",
};

const MATERIAL_TYPE_OPTIONS: MaterialType[] = [
  "general", "fabric_rolls", "cut_panels", "stitched_garments", "washed_garments", "finished_garments", "packed_cartons",
];

/** REQ-15: Enhanced Outsourcing — Dispatch/Receive modes with material-type awareness, person tracking, and the mandatory QC return gate. */
export function StageOutsourcingPanel({ orderId, selectedStages }: StageOutsourcingPanelProps) {
  const canManage = usePermission("production_planning", "update");
  const { user } = useAuth();
  const { data: records = [], isLoading } = useOutsourceRecordsByOrder(orderId);
  const dispatchMutation = useDispatchOutsource();
  const receiveMutation = useReceiveOutsource();

  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [receivingRecord, setReceivingRecord] = useState<OutsourceRecord | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formError, setFormError] = useState("");

  const stageOptions = useMemo(() => {
    const stages = selectedStages && selectedStages.length > 0 ? selectedStages : Array.from({ length: 13 }, (_, i) => i + 1);
    return stages.map((id) => ({ id, name: getStageFriendlyName(id) }));
  }, [selectedStages]);

  // Dispatch form state
  const [stageNumber, setStageNumber] = useState(stageOptions[0]?.id ?? 5);
  const [materialType, setMaterialType] = useState<MaterialType>(getStageMaterialInfo(stageNumber).materialType);
  const [materialDescription, setMaterialDescription] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorLocation, setVendorLocation] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [qtyDispatched, setQtyDispatched] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [dispatchedBy, setDispatchedBy] = useState(user?.full_name || user?.email || "");
  const [transportMethod, setTransportMethod] = useState<"Factory Truck" | "Third-Party Courier" | "Customer Pickup">("Factory Truck");
  const [vehicleReference, setVehicleReference] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receive form state
  const [qtyReceived, setQtyReceived] = useState(0);
  const [isReceiving, setIsReceiving] = useState(false);

  const handleStageChange = (id: number) => {
    setStageNumber(id);
    setMaterialType(getStageMaterialInfo(id).materialType);
  };

  const resetDispatchForm = () => {
    setVendorName(""); setVendorLocation(""); setPoNumber(""); setQtyDispatched(0); setUnitCost(0);
    setTransportMethod("Factory Truck"); setVehicleReference(""); setExpectedReturn(""); setNotes("");
    setMaterialDescription(""); setDispatchedBy(user?.full_name || user?.email || "");
  };

  const handleDispatch = async (e: React.FormEvent) => {
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
      await dispatchMutation.mutateAsync({
        order_id: orderId,
        stage_number: stageNumber,
        stage_name: getStageFriendlyName(stageNumber),
        vendor_name: vendorName.trim(),
        vendor_facility_location: vendorLocation.trim() || undefined,
        outsource_po_number: poNumber.trim(),
        quantity_dispatched: qtyDispatched,
        unit_cost_usd: unitCost,
        expected_return_at: expectedReturn || undefined,
        notes: notes.trim() || undefined,
        material_type: materialType,
        material_description: materialDescription.trim() || undefined,
        transport_method: transportMethod,
        vehicle_reference: vehicleReference.trim() || undefined,
      });
      setStatusMsg({ type: "success", text: `Stage ${stageNumber} (${getStageFriendlyName(stageNumber)}) outsourced to ${vendorName.trim()} — ${qtyDispatched} pcs dispatched.` });
      setShowDispatchModal(false);
      resetDispatchForm();
    } catch (err: any) {
      setFormError(err.message || "Failed to log outsourcing record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReceiveModal = (record: OutsourceRecord) => {
    setReceivingRecord(record);
    setQtyReceived(record.quantity_dispatched);
    setFormError("");
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingRecord) return;
    setFormError("");
    if (qtyReceived <= 0) {
      setFormError("Quantity received must be greater than 0.");
      return;
    }
    setIsReceiving(true);
    try {
      await receiveMutation.mutateAsync({ record: receivingRecord, quantity_received: qtyReceived });
      const shortage = receivingRecord.quantity_dispatched - qtyReceived;
      setStatusMsg({
        type: "success",
        text: shortage > 0
          ? `Return logged — ${qtyReceived}/${receivingRecord.quantity_dispatched} pcs received (${shortage} short). Return QC inspection is now required before this stage can advance.`
          : `Return logged — all ${qtyReceived} pcs received. Return QC inspection is now required before this stage can advance.`,
      });
      setReceivingRecord(null);
    } catch (err: any) {
      setFormError(err.message || "Failed to log the return.");
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <SectionCard title={`Stage Outsourcing (${records.length})`}>
      {statusMsg && (
        <div className={`mb-3 p-2.5 rounded-lg text-[11px] font-bold flex items-center gap-2 ${statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {statusMsg.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {canManage && (
        <button
          type="button"
          onClick={() => setShowDispatchModal(true)}
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
              <div className="text-[10px] text-muted-foreground">
                {r.material_type.replace(/_/g, " ")}{r.material_description ? ` — ${r.material_description}` : ""}
              </div>
              {r.dispatched_by_name && (
                <div className="text-[10px] text-muted-foreground">
                  Dispatched by <span className="font-semibold text-foreground">{r.dispatched_by_name}</span>
                  {r.received_by_name && <> · Received by <span className="font-semibold text-foreground">{r.received_by_name}</span></>}
                </div>
              )}

              {/* Shortage badge */}
              {typeof r.quantity_short === "number" && r.quantity_short > 0 && (
                <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-black">
                  SHORT: -{r.quantity_short} pcs
                </div>
              )}

              {/* Return QC status — the mandatory gate (Section 4D) */}
              {(r.vendor_status === "Returned_Partial" || r.vendor_status === "Returned_Complete") && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold ${RETURN_QC_STYLES[r.return_qc_status] || "bg-muted text-muted-foreground"}`}>
                  <ShieldQuestion className="h-3 w-3 shrink-0" />
                  Return QC: {r.return_qc_status.replace(/_/g, " ")}
                  {r.return_qc_status === "Pending" && " — blocks stage advancement"}
                </div>
              )}

              {canManage && r.vendor_status !== "Returned_Complete" && (
                <div className="flex gap-1.5 pt-1.5 border-t">
                  <button
                    type="button"
                    onClick={() => openReceiveModal(r)}
                    className="flex-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <Undo2 className="h-3 w-3" /> Log Return
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dispatch Mode Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Truck className="h-4 w-4 text-indigo-600" /> Route Stage to Outside Vendor
              </h3>
              <button onClick={() => setShowDispatchModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            {formError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] font-bold text-red-800 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {formError}
              </div>
            )}

            <form onSubmit={handleDispatch} className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase text-muted-foreground block mb-1">Production Stage</label>
                <select value={stageNumber} onChange={(e) => handleStageChange(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-background font-semibold">
                  {stageOptions.map((s) => <option key={s.id} value={s.id}>Stage {s.id}: {s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Material Type</label>
                  <select value={materialType} onChange={(e) => setMaterialType(e.target.value as MaterialType)} className="w-full p-2 border rounded-lg bg-background font-semibold">
                    {MATERIAL_TYPE_OPTIONS.map((mt) => <option key={mt} value={mt}>{mt.replace(/_/g, " ")}</option>)}
                  </select>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Auto-filled from stage — override if needed</p>
                </div>
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Material Description</label>
                  <input type="text" value={materialDescription} onChange={(e) => setMaterialDescription(e.target.value)} placeholder="e.g. 5 rolls, lot #FL-2026-0042" className="w-full p-2 border rounded-lg bg-background" />
                </div>
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Dispatched By</label>
                  <input type="text" value={dispatchedBy} onChange={(e) => setDispatchedBy(e.target.value)} className="w-full p-2 border rounded-lg bg-background" />
                </div>
                <div>
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Transport Method</label>
                  <select value={transportMethod} onChange={(e) => setTransportMethod(e.target.value as any)} className="w-full p-2 border rounded-lg bg-background font-semibold">
                    <option value="Factory Truck">Factory Truck</option>
                    <option value="Third-Party Courier">Third-Party Courier</option>
                    <option value="Customer Pickup">Customer Pickup</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="font-bold uppercase text-muted-foreground block mb-1">Vehicle / Tracking Reference</label>
                  <input type="text" value={vehicleReference} onChange={(e) => setVehicleReference(e.target.value)} placeholder="License plate / tracking number" className="w-full p-2 border rounded-lg bg-background" />
                </div>
              </div>

              <div>
                <label className="font-bold uppercase text-muted-foreground block mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 border rounded-lg bg-background" />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button type="button" onClick={() => setShowDispatchModal(false)} className="px-3 py-1.5 border rounded-lg font-bold hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> {isSubmitting ? "Logging..." : "Log Outsourcing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Mode Modal */}
      {receivingRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-emerald-600" /> Log Return — Stage {receivingRecord.stage_number}
              </h3>
              <button onClick={() => setReceivingRecord(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            {formError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] font-bold text-red-800 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {formError}
              </div>
            )}

            <form onSubmit={handleReceive} className="space-y-3 text-xs">
              <div className="p-2.5 bg-muted/30 rounded-lg text-muted-foreground">
                {receivingRecord.vendor_name} · Dispatched {receivingRecord.quantity_dispatched} pcs
              </div>
              <div>
                <label className="font-bold uppercase text-muted-foreground block mb-1">Quantity Received *</label>
                <input
                  type="number"
                  min={1}
                  max={receivingRecord.quantity_dispatched}
                  required
                  value={qtyReceived}
                  onChange={(e) => setQtyReceived(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-background font-mono font-bold"
                />
              </div>
              {qtyReceived > 0 && qtyReceived < receivingRecord.quantity_dispatched && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold text-[11px]">
                  Shortage: {receivingRecord.quantity_dispatched - qtyReceived} pcs
                </div>
              )}
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                Logging this return will automatically open a mandatory Return QC inspection — the order cannot advance past this stage until that inspection passes.
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t">
                <button type="button" onClick={() => setReceivingRecord(null)} className="px-3 py-1.5 border rounded-lg font-bold hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isReceiving} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                  <Undo2 className="h-3.5 w-3.5" /> {isReceiving ? "Logging..." : "Log Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
