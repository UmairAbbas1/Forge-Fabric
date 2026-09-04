import React, { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { supabase } from "../../../lib/supabase";
import { useApplyWizard } from "../../../contexts/ApplyWizardContext";
import { isStageInPipeline } from "../../../lib/service-scope-constants";
import { useSubmitUpdateRequest } from "../../../hooks/useApplySubmission";
import {
  RefreshCw,
  CheckCircle2,
  Package,
  FileText,
  Clock,
  Layers,
  FileSpreadsheet,
  Calendar,
  AlertCircle,
  Search,
  ArrowRight,
  ShieldCheck,
  Lock,
} from "lucide-react";

export interface ActivePOItem {
  id: string;
  po_number: string;
  style_number?: string;
  tech_pack?: string;
  quantity?: number;
  status: string;
  workflow_stage?: string;
  created_at: string;
  delivery_due_date?: string;
  order_type?: string;
  // Real production progress, when this PO has actually entered
  // production (an `orders` row exists for it). null/undefined means the
  // request hasn't been converted into a production order yet, so every
  // revision type is still open.
  current_stage?: number | null;
  selected_stages?: number[] | null;
}

type RevisionType = "size_qty" | "cut_sheet" | "tech_pack" | "delivery_date";

// Real gating logic: a revision that would contradict work already done on
// the factory floor is disabled, not just hidden — the customer sees why.
function getRevisionAvailability(po: ActivePOItem): Record<RevisionType, { allowed: boolean; reason?: string }> {
  const stage = po.current_stage;
  if (stage === null || stage === undefined) {
    // Not yet in production — nothing has been cut, sewn, or shipped yet.
    return {
      size_qty: { allowed: true },
      cut_sheet: { allowed: true },
      tech_pack: { allowed: true },
      delivery_date: { allowed: true },
    };
  }

  const hasCutting = isStageInPipeline(5, po.selected_stages);
  const sewingStarted = stage >= 7;
  const cuttingStarted = stage >= 5;
  const dispatched = stage >= 13 || po.status === "Shipped" || po.status === "Completed";

  return {
    size_qty: hasCutting
      ? { allowed: !cuttingStarted, reason: cuttingStarted ? "Locked: cutting has already started for this order." : undefined }
      : { allowed: !sewingStarted, reason: sewingStarted ? "Locked: sewing has already started for this order." : undefined },
    cut_sheet: !hasCutting
      ? { allowed: false, reason: "This order has no Cutting stage in its pipeline." }
      : { allowed: !cuttingStarted, reason: cuttingStarted ? "Locked: cutting has already started for this order." : undefined },
    tech_pack: { allowed: !sewingStarted, reason: sewingStarted ? "Locked: sewing has already started for this order." : undefined },
    delivery_date: { allowed: !dispatched, reason: dispatched ? "Locked: this order has already dispatched." : undefined },
  };
}

const REVISION_TYPE_META: Array<{ key: RevisionType; icon: any; title: string; blurb: string }> = [
  { key: "size_qty", icon: FileSpreadsheet, title: "Size & Quantity Matrix", blurb: "Revise ratio or add batch quantity" },
  { key: "cut_sheet", icon: Layers, title: "Cut Sheet / Marker Spread", blurb: "Update roll plies or table markers" },
  { key: "tech_pack", icon: FileText, title: "Tech Pack / Specs", blurb: "Upload revised tech pack version" },
  { key: "delivery_date", icon: Calendar, title: "Delivery & Drops", blurb: "Update ship date or drop split" },
];

// Maps this form's revision types to the request_type vocabulary the
// merchandiser's Update Requests board (update_requests table) actually
// filters and displays by.
const REVISION_TYPE_TO_REQUEST_TYPE: Record<RevisionType, string> = {
  size_qty: "quantity_change",
  cut_sheet: "spec_change",
  tech_pack: "document_update",
  delivery_date: "delivery_change",
};

export const UpdateOrderSubform: React.FC = () => {
  const { user } = useAuth();
  const { state, updateCompanyInfo, updateWorkOrder } = useApplyWizard();
  const { companyInfo } = state;
  const submitUpdateRequest = useSubmitUpdateRequest();

  const [orders, setOrders] = useState<ActivePOItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>(
    companyInfo.existing_order_reference || ""
  );
  const [revisionType, setRevisionType] = useState<RevisionType>("size_qty");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [syncError, setSyncError] = useState("");

  const companyId = user?.company_id || companyInfo.company_id;

  // Real-time synchronization with Supabase. Declared unconditionally,
  // before any early return, so hook order never changes between renders
  // (an early return below hooks caused "Rendered fewer hooks than
  // expected" / React error #300 the moment isSuccess flipped to true).
  useEffect(() => {
    fetchLiveOrders();

    const channel = supabase
      .channel("intake_po_realtime_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchLiveOrders()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "apply_submissions" },
        () => fetchLiveOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const fetchLiveOrders = async () => {
    setLoading(true);
    setSyncError("");
    try {
      const uEmail = (user?.email || companyInfo.contact_email || "").toLowerCase().trim();
      const cNameLow = (user?.customer_name || companyInfo.company_name || "").toLowerCase().trim();

      // Strict account filter reused for every source below: only rows that
      // genuinely belong to this signed-in customer, matched by email or by
      // company name. No match on either field means the row is excluded —
      // never shown "just in case."
      const isMine = (email?: string | null, name?: string | null) => {
        const sEmail = (email || "").toLowerCase().trim();
        const sName = (name || "").toLowerCase().trim();
        if (uEmail && sEmail === uEmail) return true;
        if (cNameLow && sName && (sName.includes(cNameLow) || cNameLow.includes(sName))) return true;
        return false;
      };

      // 1. This customer's own intake submissions (bulk orders, samples,
      // and previously-filed update requests) — the real source of truth
      // for "what did this brand actually apply for."
      const { data: subData, error: subErr } = await supabase
        .from("apply_submissions")
        .select("id, apply_reference_code, company_name, contact_email, product_type, style_blocks, submission_type, status, created_at")
        .order("created_at", { ascending: false });

      if (subErr) {
        console.error("Failed to fetch apply_submissions for order revision list:", subErr.message);
        setSyncError("Could not load your orders right now. Please try Sync Live POs again in a moment.");
      }
      const matchedSubs = (!subErr && subData ? subData : []).filter((sub: any) =>
        isMine(sub.contact_email, sub.company_name)
      );

      // 2. Real production progress for whichever of those submissions have
      // actually been converted — the `orders` table is the single source
      // of truth for current_stage/selected_stages used everywhere else in
      // this app (Cutting, Sewing, the order detail page). RLS already
      // restricts this to the signed-in customer's own rows; the isMine()
      // check below is defense-in-depth, not the only gate.
      const refCodes = matchedSubs.map((s: any) => s.apply_reference_code).filter(Boolean);
      let ordersByRef = new Map<string, any>();
      if (refCodes.length > 0) {
        const { data: prodOrders, error: prodErr } = await supabase
          .from("orders")
          .select("order_id, po_number, apply_reference_code, customer_name, style_no, tech_pack_ref, qty, status, current_stage, selected_stages, created_date, planned_ship_date")
          .in("apply_reference_code", refCodes);

        if (prodErr) {
          console.error("Failed to fetch orders production progress for revision list:", prodErr.message);
        }
        if (!prodErr && prodOrders) {
          prodOrders
            .filter((o: any) => isMine(null, o.customer_name))
            .forEach((o: any) => ordersByRef.set(o.apply_reference_code, o));
        }
      }

      const liveList: ActivePOItem[] = matchedSubs.map((sub: any) => {
        const prod = sub.apply_reference_code ? ordersByRef.get(sub.apply_reference_code) : undefined;
        const blocks = Array.isArray(sub.style_blocks) ? sub.style_blocks : [];
        const mainBlock = blocks[0] || {};
        const realQty = blocks.reduce((sum: number, b: any) => sum + (Number(b.total_units) || 0), 0);
        const styleName = mainBlock.style_name || sub.product_type || undefined;

        return {
          id: sub.id,
          po_number: prod?.po_number || sub.apply_reference_code || sub.id,
          style_number: prod?.style_no || styleName,
          tech_pack: prod?.tech_pack_ref,
          quantity: prod?.qty ?? (realQty > 0 ? realQty : undefined),
          status: prod?.status || (sub.status === "converted" ? "Approved & Converted" : "Open"),
          workflow_stage: prod ? `Stage ${prod.current_stage}/13` : "Not yet in production",
          created_at: (prod?.created_date || sub.created_at || "").substring(0, 10),
          delivery_due_date: prod?.planned_ship_date ? String(prod.planned_ship_date).substring(0, 10) : undefined,
          order_type: sub.submission_type === "sample_request" ? "Sample Request" : "Intake Submission",
          current_stage: prod?.current_stage ?? null,
          selected_stages: prod?.selected_stages ?? null,
        };
      });

      setOrders(liveList);

      if (!selectedPoNumber && liveList.length > 0) {
        handleSelectPO(liveList[0]);
      }
    } catch (err) {
      console.error("Failed to sync backend POs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPO = (po: ActivePOItem) => {
    setSelectedPoNumber(po.po_number);
    updateCompanyInfo({
      existing_order_reference: po.po_number,
      is_existing_customer: true,
    });
    if (po.style_number) {
      updateWorkOrder({
        style_number: po.style_number,
      });
    }
    // If the revision type currently selected is no longer valid for this
    // PO (e.g. switching from a pre-production order to one already
    // cutting), fall back to the first still-available type.
    const availability = getRevisionAvailability(po);
    if (!availability[revisionType].allowed) {
      const firstAllowed = REVISION_TYPE_META.find((r) => availability[r.key].allowed);
      if (firstAllowed) setRevisionType(firstAllowed.key);
    }
  };

  const handleSubmitRevision = async () => {
    if (!selectedPoNumber) {
      alert("Please select the Purchase Order (PO) to revise.");
      return;
    }
    if (!revisionNotes.trim()) {
      alert("Please describe the revision request details in the notes section.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const meta = REVISION_TYPE_META.find((r) => r.key === revisionType)!;
      await submitUpdateRequest.mutateAsync({
        apply_reference_code: selectedPoNumber.startsWith("APP") ? selectedPoNumber : undefined,
        po_number: !selectedPoNumber.startsWith("APP") ? selectedPoNumber : undefined,
        request_type: REVISION_TYPE_TO_REQUEST_TYPE[revisionType],
        subject: `${meta.title} — PO ${selectedPoNumber}`,
        description: revisionNotes.trim(),
        priority: "normal",
        requested_by_name: companyInfo.contact_name || user?.full_name || "Client Contact",
        requested_by_email: companyInfo.contact_email || user?.email || "",
      });

      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to submit revision request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.style_number && o.style_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.tech_pack && o.tech_pack.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedPo = orders.find((o) => o.po_number === selectedPoNumber);
  const availability = selectedPo
    ? getRevisionAvailability(selectedPo)
    : { size_qty: { allowed: true }, cut_sheet: { allowed: true }, tech_pack: { allowed: true }, delivery_date: { allowed: true } };

  if (isSuccess) {
    return (
      <div className="p-8 mt-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center animate-in fade-in">
        <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto mb-3" />
        <h3 className="text-xl font-black text-emerald-950 mb-1">
          Order Revision Request Submitted!
        </h3>
        <p className="text-xs text-emerald-800 max-w-md mx-auto mb-6">
          Your revision request for PO <strong>{selectedPoNumber}</strong> has been recorded and sent to your merchandiser for review.
        </p>
        <button
          type="button"
          onClick={() => {
            setIsSuccess(false);
            setRevisionNotes("");
          }}
          className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
        >
          Submit Another Revision Request
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div>
          <h4 className="font-bold text-sm text-neutral-900">
            Your Active Orders
          </h4>
          <p className="text-neutral-500 mt-0.5">
            Select an active Purchase Order or intake submission to issue a revision, update cut sheets, or submit order modifications.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLiveOrders}
          disabled={loading}
          className="self-start md:self-auto px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search active PO #, style number, or tech pack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border-2 border-neutral-200 focus:border-blue-500 rounded-xl text-xs bg-white font-medium shadow-xs"
          />
        </div>
        <div className="text-xs font-bold text-neutral-500 shrink-0">
          Showing {filteredOrders.length} Active Orders
        </div>
      </div>

      {syncError && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Orders List / Cards Grid */}
      {loading && orders.length === 0 ? (
        <div className="p-8 text-center text-xs text-neutral-400">Loading your orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300">
          No active orders or intake submissions found for your account yet. Once you submit a Bulk Order or Sample Request, it will appear here for revisions.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto pr-1">
          {filteredOrders.map((po) => {
            const isSelected = selectedPoNumber === po.po_number;
            return (
              <div
                key={po.id}
                onClick={() => handleSelectPO(po)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20"
                    : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-neutral-900 font-mono">
                        {po.po_number}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {po.order_type}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          po.status.toLowerCase().includes("approved") || po.status.toLowerCase().includes("open")
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        Status: {po.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-600 flex-wrap">
                      <span>
                        Style: <strong className="text-neutral-800 font-mono">{po.style_number || "Not specified"}</strong>
                      </span>
                      <span>
                        Tech Pack: <strong className="text-neutral-800 font-mono">{po.tech_pack || "Not specified"}</strong>
                      </span>
                      <span>
                        Qty: <strong className="text-neutral-800">{po.quantity != null ? `${po.quantity} pcs` : "Not specified"}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto text-right text-xs shrink-0">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-neutral-400">
                      Workflow Stage
                    </div>
                    <div className="font-extrabold text-blue-700 font-mono">
                      {po.workflow_stage}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-xl">
                      Selected
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected PO Revision Options */}
      {selectedPoNumber && (
        <div className="p-5 bg-card border-2 border-blue-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h4 className="font-extrabold text-neutral-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Select Revision Type for {selectedPoNumber}</span>
            </h4>
            <span className="text-xs text-neutral-500 font-mono font-semibold">
              PO Ref: {selectedPoNumber}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {REVISION_TYPE_META.map(({ key, icon: Icon, title, blurb }) => {
              const avail = availability[key];
              const isActive = revisionType === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!avail.allowed}
                  onClick={() => avail.allowed && setRevisionType(key)}
                  title={avail.reason}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    !avail.allowed
                      ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                      : isActive
                      ? "border-blue-600 bg-blue-50 text-blue-900 font-bold"
                      : "border-neutral-200 bg-neutral-50/50 text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  {avail.allowed ? (
                    <Icon className="w-4 h-4 text-blue-600 mb-1" />
                  ) : (
                    <Lock className="w-4 h-4 text-neutral-400 mb-1" />
                  )}
                  <div className="text-xs font-extrabold">{title}</div>
                  <div className="text-[10px] font-normal mt-0.5 text-neutral-500">
                    {avail.allowed ? blurb : avail.reason}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Revision Notes Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Specific Revision Request Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Describe the exact changes required for this PO revision (e.g. increase size 32 from 50 to 80 pcs, update wash code to DX-90)..."
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              className="w-full p-3 border border-neutral-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSubmitRevision}
              disabled={isSubmitting || !selectedPoNumber || !revisionNotes.trim()}
              className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              <span>{isSubmitting ? "Submitting Revision..." : "Submit Revision Request to Merchandiser"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
