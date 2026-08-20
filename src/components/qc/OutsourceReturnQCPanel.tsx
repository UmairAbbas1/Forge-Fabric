import { useState } from "react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import { usePendingReturnQCInspections, useSubmitReturnQC } from "../../hooks/useOutsourcing";
import { SectionCard } from "../AppShell";
import { ShieldQuestion, AlertTriangle, CheckCircle2, Camera, ChevronDown, ChevronUp } from "lucide-react";

// REQ-15 Section 4D: "Outsource Return QC" — pending inspections for work
// returned from an external vendor. Completing one here writes the result
// onto stage_outsourcing_records.return_qc_status, which is exactly what
// blocks (or unblocks) the order from leaving that stage.
export function OutsourceReturnQCPanel() {
  const { data: pending = [], isLoading } = usePendingReturnQCInspections();
  const submitMutation = useSubmitReturnQC();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [inspectedQty, setInspectedQty] = useState(0);
  const [passedQty, setPassedQty] = useState(0);
  const [failedQty, setFailedQty] = useState(0);
  const [reworkQty, setReworkQty] = useState(0);
  const [defectNotes, setDefectNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [result, setResult] = useState<"Passed" | "Failed" | "Rework" | "Partial_Pass">("Passed");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openInspection = (id: string, dispatchedQty: number) => {
    setActiveId(activeId === id ? null : id);
    setInspectedQty(dispatchedQty);
    setPassedQty(dispatchedQty);
    setFailedQty(0);
    setReworkQty(0);
    setDefectNotes("");
    setPhotoFiles([]);
    setResult("Passed");
    setFormError("");
  };

  const handleInspectedChange = (val: number) => {
    setInspectedQty(val);
    setFailedQty(Math.max(0, val - passedQty - reworkQty));
  };
  const handlePassedChange = (val: number) => {
    setPassedQty(val);
    setFailedQty(Math.max(0, inspectedQty - val - reworkQty));
  };
  const handleReworkChange = (val: number) => {
    setReworkQty(val);
    setFailedQty(Math.max(0, inspectedQty - passedQty - val));
  };

  const viewPhoto = async (path: string) => {
    if (!isRealSupabase) return;
    const { data, error } = await supabase.storage.from("order-documents").createSignedUrl(path, 300);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (e: React.FormEvent, item: { id: string; outsource_record_id: string; order_id: string }) => {
    e.preventDefault();
    setFormError("");
    if (inspectedQty <= 0) {
      setFormError("Inspected quantity must be greater than 0.");
      return;
    }
    if (passedQty + failedQty + reworkQty !== inspectedQty) {
      setFormError(`Passed + Failed + Rework (${passedQty + failedQty + reworkQty}) must equal Inspected Qty (${inspectedQty}).`);
      return;
    }
    setIsSubmitting(true);
    try {
      // Reuses the existing staff-writable 'order-documents' bucket
      // (order_documents_staff_all RLS policy — no new storage bucket
      // needed for this) under a dedicated outsource-qc/ path per order.
      const photoPaths: string[] = [];
      for (const file of photoFiles) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${item.order_id}/outsource-qc/${Date.now()}-${cleanName}`;
        const { error: uploadErr } = await supabase.storage.from("order-documents").upload(path, file, { cacheControl: "3600", upsert: true });
        if (uploadErr) throw uploadErr;
        photoPaths.push(path);
      }

      await submitMutation.mutateAsync({
        qc_id: item.id,
        outsource_record_id: item.outsource_record_id,
        order_id: item.order_id,
        inspected_qty: inspectedQty,
        passed_qty: passedQty,
        failed_qty: failedQty,
        rework_qty: reworkQty,
        defect_notes: defectNotes.trim() || undefined,
        photos: photoPaths.length > 0 ? photoPaths : undefined,
        result,
      });
      setStatusMsg({ type: "success", text: `Return QC result "${result.replace(/_/g, " ")}" logged for order ${item.order_id}.` });
      setActiveId(null);
    } catch (err: any) {
      setFormError(err.message || "Failed to log return QC inspection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SectionCard title={`Outsource Return QC (${pending.length} Pending)`}>
      {statusMsg && (
        <div className={`mb-3 p-2.5 rounded-lg text-[11px] font-bold flex items-center gap-2 ${statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {statusMsg.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Loading pending inspections...</div>
      ) : pending.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
          No outsourced work is awaiting return QC inspection.
        </div>
      ) : (
        <div className="space-y-2.5">
          {pending.map((item) => {
            const rec = item.outsource_record;
            const isOpen = activeId === item.id;
            return (
              <div key={item.id} className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => openInspection(item.id, rec?.quantity_received || 0)}
                  className="w-full p-3 bg-amber-50/60 flex items-center justify-between text-left text-xs"
                >
                  <div>
                    <span className="font-bold text-foreground">
                      Order {item.order_id} — Stage {item.stage_number} {rec ? `(${rec.stage_name})` : ""}
                    </span>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {rec ? `${rec.vendor_name} · ${rec.quantity_received} pcs returned` : "Vendor record unavailable"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                      <ShieldQuestion className="h-3 w-3" /> Pending
                    </span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <form onSubmit={(e) => handleSubmit(e, item)} className="p-4 space-y-3 text-xs border-t bg-card">
                    {formError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] font-bold text-red-800 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {formError}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="font-bold uppercase text-muted-foreground block mb-1">Inspected Qty</label>
                        <input type="number" min={1} value={inspectedQty} onChange={(e) => handleInspectedChange(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-background font-mono font-bold" />
                      </div>
                      <div>
                        <label className="font-bold uppercase text-emerald-700 block mb-1">Passed</label>
                        <input type="number" min={0} value={passedQty} onChange={(e) => handlePassedChange(Number(e.target.value))} className="w-full p-2 border border-emerald-200 rounded-lg bg-emerald-50/40 font-mono font-bold" />
                      </div>
                      <div>
                        <label className="font-bold uppercase text-orange-700 block mb-1">Rework</label>
                        <input type="number" min={0} value={reworkQty} onChange={(e) => handleReworkChange(Number(e.target.value))} className="w-full p-2 border border-orange-200 rounded-lg bg-orange-50/40 font-mono font-bold" />
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Failed (auto): <span className="font-bold text-red-700">{failedQty}</span>
                    </div>

                    <div>
                      <label className="font-bold uppercase text-muted-foreground block mb-1">Overall Result</label>
                      <select value={result} onChange={(e) => setResult(e.target.value as any)} className="w-full p-2 border rounded-lg bg-background font-semibold">
                        <option value="Passed">Passed</option>
                        <option value="Partial_Pass">Partial Pass</option>
                        <option value="Rework">Rework</option>
                        <option value="Failed">Failed</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold uppercase text-muted-foreground block mb-1">Defect Notes</label>
                      <textarea rows={2} value={defectNotes} onChange={(e) => setDefectNotes(e.target.value)} placeholder="Optional — describe any defects found" className="w-full p-2 border rounded-lg bg-background" />
                    </div>

                    <div>
                      <label className="font-bold uppercase text-muted-foreground mb-1 flex items-center gap-1"><Camera className="h-3 w-3" /> Defect Photos</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setPhotoFiles(e.target.files ? Array.from(e.target.files) : [])}
                        className="w-full text-[11px]"
                      />
                      {photoFiles.length > 0 && <p className="text-[10px] text-muted-foreground mt-1">{photoFiles.length} photo(s) selected</p>}
                    </div>

                    {rec?.notes && (
                      <div className="p-2 bg-muted/30 rounded-lg text-[11px] text-muted-foreground">
                        Dispatch notes: {rec.notes}
                      </div>
                    )}

                    <div className="pt-2 flex justify-end gap-2 border-t">
                      <button type="button" onClick={() => setActiveId(null)} className="px-3 py-1.5 border rounded-lg font-bold hover:bg-muted">Cancel</button>
                      <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {isSubmitting ? "Submitting..." : "Submit Return QC Result"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
