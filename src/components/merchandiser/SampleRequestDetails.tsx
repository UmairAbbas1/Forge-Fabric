import React, { useState } from "react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import {
  X,
  ExternalLink,
  Check,
  Package,
  Calculator,
  Truck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  XCircle,
  ThumbsUp,
  Send,
} from "lucide-react";

interface SampleRequestDetailsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any;
  onClose: () => void;
  onUpdate: () => void;
}

// Maps the operational pipeline status shown in this panel to the REQ-04
// governance field (sample_status) enforced by the DB CHECK constraint and
// used as the hard gate before bulk PO conversion.
const SAMPLE_STATUS_BY_PIPELINE_STATUS: Record<string, string> = {
  submitted: "Sample_Requested",
  pending_review: "Sample_Requested",
  in_review: "Sample_Requested",
  factory_review: "Sample_Requested",
  cost_approval: "Sample_Requested",
  waiting_materials: "Sample_Requested",
  in_development: "In_Sample_Making",
  in_production: "In_Sample_Making",
  shipped: "Sample_Completed",
  received: "Sample_Completed",
  approved: "Sample_Approved",
  rejected: "Sample_Rejected",
  converted: "Converted_To_Bulk",
};

export function SampleRequestDetails({ request, onClose, onUpdate }: SampleRequestDetailsProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [masterSku, setMasterSku] = useState(request.master_product_sku || "");
  const [quoteNumber, setQuoteNumber] = useState(request.quote_number || "");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [isDeciding, setIsDeciding] = useState(false);
  const [convertResult, setConvertResult] = useState<{ order_id: string } | null>(null);

  const status = (request.status || "").toLowerCase();
  const isSampleApproved = status === "approved" || request.sample_status === "Sample_Approved";
  const isDecided = ["approved", "rejected", "converted"].includes(status);
  // A sample can only be approved (and therefore only become eligible for
  // Sample -> Bulk Order conversion on the customer's side) once it has
  // actually been produced, shipped, and confirmed received by the client —
  // "approved" must mean "the whole sample process is complete and the
  // client liked what they got," not "we skipped straight to yes." Rejection
  // stays available at any stage — a request can be turned down for cost or
  // feasibility reasons long before a physical sample ever gets made.
  const isSampleCompleted = status === "received";
  const canConvert = Boolean(masterSku.trim() && quoteNumber.trim());
  // Local-cache-only rows have no live DB row an RPC or DB write can act on.
  const isActionable = request.source_table !== "local_cache";

  // sample_requests rows have no contact_email/contact_name column directly
  // (unlike apply_submissions) — resolve via companies -> profiles at
  // decision time rather than guessing or leaving notifications unsent.
  const resolveContactEmail = async (): Promise<{ email: string | null; name: string | null }> => {
    if (request.contact_email) return { email: request.contact_email, name: request.contact_name || request.company_name };
    if (request.source_table === "sample_requests" && isRealSupabase) {
      try {
        const { data: sr } = await supabase.from("sample_requests").select("company_id").eq("id", request.id).maybeSingle();
        if (sr?.company_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("company_id", sr.company_id)
            .limit(1)
            .maybeSingle();
          if (profile?.email) return { email: profile.email, name: profile.full_name || request.company_name };
        }
      } catch (e) {
        console.warn("Could not resolve sample contact email:", e);
      }
    }
    return { email: null, name: request.contact_name || request.company_name };
  };

  const handleQuickApprove = async () => {
    setDecisionError("");
    setIsDeciding(true);
    try {
      await updateStatus("approved");
      const { email, name } = await resolveContactEmail();
      if (isRealSupabase && email) {
        await supabase.from("notification_logs").insert({
          recipient_email: email,
          notification_type: "sample_approved",
          subject: `Sample Approved — ${request.apply_reference_code || request.id}`,
          body: `Dear ${name || "Customer"},\n\nGreat news — your sample request (${request.apply_reference_code || request.id}) for ${request.sample_type || "your requested style"} has been approved. Our merchandising team is now finalizing the production setup to move this into manufacturing.\n\nWe'll notify you as soon as it enters active production.`,
          related_submission_id: request.source_table === "apply_submissions" ? request.id : null,
          sent_at: new Date().toISOString(),
          delivered: true,
          opened: false,
        });
      }
      if (isRealSupabase && request.apply_reference_code) {
        try {
          await supabase.from("notifications").insert({
            message: `[SAMPLE APPROVED] Your sample request ${request.apply_reference_code} has been approved.`,
            order_id: request.apply_reference_code,
            type: "approve",
            stage_id: 1,
            read: false,
          });
        } catch (e) {
          console.warn("Could not write customer-facing approval notification:", e);
        }
      }
    } catch (err: any) {
      setDecisionError(err.message || "Failed to approve sample request.");
    } finally {
      setIsDeciding(false);
    }
  };

  const handleQuickReject = async () => {
    setDecisionError("");
    const reason = rejectReason.trim();
    if (!reason) {
      setDecisionError("A rejection reason is required.");
      return;
    }
    setIsDeciding(true);
    try {
      await updateStatus("rejected", { rejection_reason: reason });
      const { email, name } = await resolveContactEmail();
      if (isRealSupabase && email) {
        await supabase.from("notification_logs").insert({
          recipient_email: email,
          notification_type: "submission_rejected",
          subject: `Update on your Sample Request (${request.apply_reference_code || request.id})`,
          body: `Dear ${name || "Customer"},\n\nThank you for your sample request. After review, we are unable to proceed with this sample at this time.\n\nReason: ${reason}\n\nPlease contact your merchandiser if you would like to discuss adjustments.`,
          related_submission_id: request.source_table === "apply_submissions" ? request.id : null,
          sent_at: new Date().toISOString(),
          delivered: true,
          opened: false,
        });
      }
      if (isRealSupabase && request.apply_reference_code) {
        try {
          await supabase.from("notifications").insert({
            message: `[SAMPLE REJECTED] Your sample request ${request.apply_reference_code} was not approved. Reason: ${reason}`,
            order_id: request.apply_reference_code,
            type: "reject",
            stage_id: 1,
            read: false,
          });
        } catch (e) {
          console.warn("Could not write customer-facing rejection notification:", e);
        }
      }
      setShowRejectBox(false);
      setRejectReason("");
    } catch (err: any) {
      setDecisionError(err.message || "Failed to reject sample request.");
    } finally {
      setIsDeciding(false);
    }
  };

  const updateStatus = async (newStatus: string, extraFields: Record<string, any> = {}) => {
    // REQ-04 hard gate: bulk conversion is blocked until Sample_Approved AND
    // Merchandiser/Admin has locked in the official Master SKU + Quote Number.
    if (newStatus === "converted" && !canConvert) {
      setErrorMsg("Assign the Master Product SKU and Official Quote Number before converting to a Bulk Production Order.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const sampleStatus = SAMPLE_STATUS_BY_PIPELINE_STATUS[newStatus] || undefined;
      const payload: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(sampleStatus ? { sample_status: sampleStatus } : {}),
        ...extraFields,
      };

      if (isRealSupabase) {
        if (!isActionable) {
          throw new Error("This request only exists in the local offline cache — connect to the live database to update it.");
        }

        // request.source_table is authoritative (set by SampleRequestsDashboard
        // when it fetched this row) — update that exact row by id rather than
        // guessing across both tables via an .or() reference-code match,
        // which silently errors out entirely when the target table doesn't
        // have an apply_reference_code column (sample_requests didn't, prior
        // to the migration adding it).
        const targetTable = request.source_table === "sample_requests" ? "sample_requests" : "apply_submissions";
        const { error } = await supabase
          .from(targetTable)
          .update(payload)
          .eq("id", request.id);

        if (error) {
          throw new Error(`Failed to update ${targetTable}: ${error.message}`);
        }
      }

      // Also update local storage cache if present
      try {
        const cachedStr = localStorage.getItem("forge_submissions_cache");
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          const updated = cached.map((c: any) =>
            c.id === request.id || (request.apply_reference_code && c.apply_reference_code === request.apply_reference_code)
              ? { ...c, ...payload }
              : c
          );
          localStorage.setItem("forge_submissions_cache", JSON.stringify(updated));
        }
      } catch (e) {
        console.warn("Could not update local storage cache:", e);
      }

      // Fire global event for instant UI update across components
      window.dispatchEvent(new CustomEvent("forge_submission_created", { detail: { id: request.id, ...payload } }));

      onUpdate();
    } catch (err: any) {
      console.error("Failed to update sample request status:", err);
      setErrorMsg(err.message || "Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!canConvert) return;
    if (!isActionable) {
      setDecisionError("This request only exists in the local offline cache — connect to the live database to convert it.");
      return;
    }
    setDecisionError("");
    setLoading(true);
    try {
      // Lock in Master SKU / Quote Number first (REQ-04 governance, unchanged).
      const { error: lockErr } = await supabase
        .from(request.source_table === "sample_requests" ? "sample_requests" : "apply_submissions")
        .update({ master_product_sku: masterSku.trim(), quote_number: quoteNumber.trim(), updated_at: new Date().toISOString() })
        .eq("id", request.id);
      if (lockErr) throw new Error(lockErr.message);

      // Real, atomic order creation — new RPC, does NOT touch
      // convert_submission_to_blanket_po (that one is bulk-specific and
      // only ever creates a blanket_pos row, never a real orders row).
      const { data: result, error: rpcErr } = await supabase.rpc("convert_sample_to_work_order", {
        p_sample_id: request.id,
        p_source_table: request.source_table === "sample_requests" ? "sample_requests" : "apply_submissions",
      });
      if (rpcErr) throw new Error(rpcErr.message);

      setConvertResult(result as { order_id: string });

      const { email, name } = await resolveContactEmail();
      if (isRealSupabase && email) {
        await supabase.from("notification_logs").insert({
          recipient_email: email,
          notification_type: "sample_approved",
          subject: `Your Sample Is Now In Production — ${result?.order_id}`,
          body: `Dear ${name || "Customer"},\n\nYour sample request has entered active production as order ${result?.order_id}. You can track live cutting, sewing, and wash progress on your Forge & Fabric dashboard.`,
          related_submission_id: request.source_table === "apply_submissions" ? request.id : null,
          sent_at: new Date().toISOString(),
          delivered: true,
          opened: false,
        });
        try {
          await supabase.from("notifications").insert({
            message: `[SAMPLE IN PRODUCTION] Your sample is now order ${result?.order_id}.`,
            order_id: result?.order_id,
            type: "stage_advance",
            stage_id: 1,
            read: false,
          });
        } catch (e) {
          console.warn("Could not write customer-facing production-start notification:", e);
        }
      }

      onUpdate();
    } catch (err: any) {
      setDecisionError(err.message || "Failed to convert sample to a production order.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
      case "pending_review":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800">Pending Review</span>;
      case "factory_review":
      case "in_review":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800">In Review</span>;
      case "waiting_materials":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-800">Waiting Materials</span>;
      case "cost_approval":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800">Cost Approval</span>;
      case "in_production":
      case "in_development":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800">In Development / Sampling</span>;
      case "shipped":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-cyan-100 text-cyan-800">Shipped</span>;
      case "received":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-800">Client Received</span>;
      case "approved":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">Sample Approved</span>;
      case "converted":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-600 text-white">Converted to Production</span>;
      case "rejected":
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800">Rejected</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-neutral-100 text-neutral-800 capitalize">{status.replace("_", " ")}</span>;
    }
  };

  const renderActionButtons = () => {
    const s = request.status?.toLowerCase() || "pending_review";
    switch (s) {
      case "submitted":
      case "pending_review":
        return (
          <div className="space-y-2">
            <button
              disabled={loading}
              onClick={() => updateStatus("in_review")}
              className="w-full py-2.5 bg-blue-600 text-white font-black text-xs rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 shadow-sm transition-all"
            >
              <Clock className="w-4 h-4" /> Move to Tech Pack Review
            </button>
            <button
              disabled={loading}
              onClick={() => updateStatus("in_development")}
              className="w-full py-2.5 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 flex justify-center items-center gap-2 shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4" /> Fast-Track Sample Development
            </button>
          </div>
        );
      case "in_review":
      case "factory_review":
        if (request.fabric_trim_source === "Brand Sourced") {
          return (
            <div className="space-y-2">
              <button
                disabled={loading}
                onClick={() => updateStatus("waiting_materials")}
                className="w-full py-2.5 bg-amber-600 text-white font-black text-xs rounded-xl hover:bg-amber-700 flex justify-center items-center gap-2 shadow-sm transition-all"
              >
                <Truck className="w-4 h-4" /> Move to Waiting Customer Materials
              </button>
              <button
                disabled={loading}
                onClick={() => updateStatus("in_development")}
                className="w-full py-2.5 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 flex justify-center items-center gap-2 shadow-sm transition-all"
              >
                <CheckCircle2 className="w-4 h-4" /> Materials Ready · Start Sampling
              </button>
            </div>
          );
        } else {
          return (
            <div className="space-y-2">
              <button
                disabled={loading}
                onClick={() => updateStatus("cost_approval")}
                className="w-full py-2.5 bg-purple-600 text-white font-black text-xs rounded-xl hover:bg-purple-700 flex justify-center items-center gap-2 shadow-sm transition-all"
              >
                <Calculator className="w-4 h-4" /> Request Client Cost Approval
              </button>
              <button
                disabled={loading}
                onClick={() => updateStatus("in_development")}
                className="w-full py-2.5 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 flex justify-center items-center gap-2 shadow-sm transition-all"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve Cost &amp; Start Sampling
              </button>
            </div>
          );
        }
      case "cost_approval":
      case "waiting_materials":
        return (
          <button
            disabled={loading}
            onClick={() => updateStatus("in_development")}
            className="w-full py-2.5 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 flex justify-center items-center gap-2 shadow-sm transition-all"
          >
            <Package className="w-4 h-4" /> Mark Materials/Cost Ready · Start Sampling
          </button>
        );
      case "in_production":
      case "in_development":
        return (
          <button
            disabled={loading}
            onClick={() => updateStatus("shipped")}
            className="w-full py-2.5 bg-cyan-600 text-white font-black text-xs rounded-xl hover:bg-cyan-700 flex justify-center items-center gap-2 shadow-sm transition-all"
          >
            <Truck className="w-4 h-4" /> Mark Sample Dispatched / Shipped
          </button>
        );
      case "shipped":
        return (
          <button
            disabled={loading}
            onClick={() => updateStatus("received")}
            className="w-full py-2.5 bg-neutral-900 text-white font-black text-xs rounded-xl hover:bg-black flex justify-center items-center gap-2 shadow-sm transition-all"
          >
            <Check className="w-4 h-4" /> Mark Client Received
          </button>
        );
      case "received":
        // Approve/Reject for a received sample happens via the "Approve or
        // Reject This Sample Request" section above — same action, always
        // available, not gated behind this lifecycle stage.
        return (
          <p className="text-[11px] text-muted-foreground italic">Use Approve / Reject above once the sample has been reviewed.</p>
        );
      case "approved":
        if (convertResult) {
          return (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-bold text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Now in production as order <span className="font-mono">{convertResult.order_id}</span>.
            </div>
          );
        }
        return (
          <button
            disabled={loading || !canConvert || !isActionable}
            onClick={handleConvert}
            title={!canConvert ? "Assign Master SKU & Quote Number above first" : undefined}
            className={`w-full py-2.5 font-black text-xs rounded-xl flex justify-center items-center gap-2 shadow-sm transition-all ${
              canConvert
                ? "bg-emerald-700 text-white hover:bg-emerald-800"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            <ArrowRight className="w-4 h-4" />
            {loading ? "Creating Production Order..." : canConvert ? "Convert to Sample Production Order" : "Locked — Assign Master SKU & Quote First"}
          </button>
        );
      default:
        return (
          <button
            disabled={loading}
            onClick={() => updateStatus("pending_review")}
            className="w-full py-2 bg-muted text-foreground font-bold text-xs rounded-xl hover:bg-muted/80"
          >
            Reset to Pending Review
          </button>
        );
    }
  };

  return (
    <div className="bg-card border rounded-2xl shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      {/* Header */}
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Sample Request Details</div>
          <h4 className="font-extrabold text-foreground text-sm">{request.company_name}</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5 text-xs">
        
        {/* Status Badge */}
        <div className="flex items-center justify-between p-3 bg-muted/20 border rounded-xl">
          <span className="font-bold text-muted-foreground text-[11px] uppercase tracking-wider">Current Pipeline Stage</span>
          {getStatusBadge(request.status)}
        </div>

        {/* Quick Approve / Reject. Reject is available at any pipeline
            stage; Approve is gated behind isSampleCompleted (status ===
            "received") — see its definition above — so a sample can only be
            marked Sample_Approved once it's actually been produced, shipped,
            and confirmed received by the client. Approve notifies the
            customer; the actual production order is created once Master
            SKU + Quote Number are locked in below (REQ-04 gate, unchanged). */}
        {!isDecided && (
          <div className="p-3.5 bg-muted/20 border rounded-xl space-y-2.5">
            <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Approve or Reject This Sample Request</div>
            {!isActionable && (
              <p className="text-[11px] text-amber-700 font-semibold">Local offline cache only — connect to the live database to approve or reject.</p>
            )}
            {decisionError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {decisionError}
              </div>
            )}
            {showRejectBox ? (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (required) — e.g. fabric unavailable, spec not feasible..."
                  className="w-full p-2.5 border rounded-lg bg-background text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isDeciding}
                    onClick={() => { setShowRejectBox(false); setRejectReason(""); setDecisionError(""); }}
                    className="flex-1 py-2 border rounded-lg font-bold text-xs hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeciding || !rejectReason.trim()}
                    onClick={handleQuickReject}
                    className="flex-1 py-2 bg-red-600 text-white font-bold text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> {isDeciding ? "Sending..." : "Confirm Reject"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isDeciding || !isActionable || !isSampleCompleted}
                    onClick={handleQuickApprove}
                    title={!isSampleCompleted ? "Available once the sample has been produced, shipped, and marked Client Received below" : undefined}
                    className="flex-1 py-2.5 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <ThumbsUp className="w-4 h-4" /> {isDeciding ? "Approving..." : "Approve Sample"}
                  </button>
                  <button
                    type="button"
                    disabled={isDeciding || !isActionable}
                    onClick={() => setShowRejectBox(true)}
                    className="flex-1 py-2.5 bg-red-600 text-white font-black text-xs rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
                {!isSampleCompleted && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Approve unlocks once the sample is marked Client Received in the lifecycle tracker below — a sample can't be approved before it's actually been made and delivered.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Brand & Reference */}
        <div className="space-y-2 bg-muted/20 p-3.5 rounded-xl border">
          <div className="flex items-center gap-2 text-foreground font-extrabold text-sm">
            <Building2 className="w-4 h-4 text-primary" />
            <span>{request.brand_name || request.company_name}</span>
          </div>
          <div className="text-muted-foreground font-mono text-[11px]">
            Ref: {request.apply_reference_code || request.id?.slice(0, 8)}
          </div>
          {request.contact_name && (
            <div className="flex items-center gap-1.5 text-muted-foreground pt-1 border-t border-border/50">
              <Mail className="w-3.5 h-3.5" />
              <span>{request.contact_name} ({request.contact_email})</span>
            </div>
          )}
          {request.contact_phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="w-3.5 h-3.5" />
              <span>{request.contact_phone}</span>
            </div>
          )}
        </div>

        {/* Specifications */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-muted/20 border rounded-xl">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Sample Type</div>
            <div className="font-extrabold text-foreground text-xs mt-0.5">{request.sample_type || "Fit / Proto"}</div>
          </div>
          <div className="p-3 bg-muted/20 border rounded-xl">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Sourcing Scope</div>
            <div className="font-extrabold text-foreground text-xs mt-0.5">{request.fabric_trim_source || "Factory Sourced"}</div>
          </div>
          <div className="p-3 bg-muted/20 border rounded-xl">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Requested Qty</div>
            <div className="font-extrabold text-foreground text-xs mt-0.5">{request.quantity || 1} pcs</div>
          </div>
          <div className="p-3 bg-muted/20 border rounded-xl">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Target Date</div>
            <div className="font-extrabold text-foreground text-xs mt-0.5">
              {request.turnaround_date ? new Date(request.turnaround_date).toLocaleDateString() : "Standard (14 Days)"}
            </div>
          </div>
        </div>

        {/* Size Breakdown */}
        {request.size_breakdown && Object.keys(request.size_breakdown).length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Size Distribution</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(request.size_breakdown).map(([sz, qty]) => (
                <span key={sz} className="px-2.5 py-1 bg-background border rounded-lg font-mono text-xs font-bold text-foreground">
                  {sz}: <span className="text-primary font-black">{String(qty)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes & Special Instructions */}
        {(request.client_notes || request.special_instructions) && (
          <div className="p-3 bg-muted/20 border rounded-xl space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Client Instructions</div>
            <p className="text-foreground text-xs leading-relaxed italic">
              "{request.client_notes || request.special_instructions}"
            </p>
          </div>
        )}

        {/* Client Reference SKU (customer-entered, read-only) */}
        {request.client_reference_sku && (
          <div className="p-3 bg-muted/20 border rounded-xl">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Client Reference SKU</div>
            <div className="font-mono font-extrabold text-foreground text-xs mt-0.5">{request.client_reference_sku}</div>
          </div>
        )}

        {/* Master SKU & Quote Number — merchandiser/admin locked, required before bulk conversion */}
        {isSampleApproved && (
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-emerald-900 font-black text-[11px] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Master SKU &amp; Quote Authority (Required to Convert)
            </div>
            <div>
              <label className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">Master Product SKU</label>
              <input
                type="text"
                value={masterSku}
                onChange={(e) => setMasterSku(e.target.value.toUpperCase())}
                placeholder="e.g. FF-2026-DNM-0089"
                className="w-full p-2 border border-emerald-300 rounded-lg bg-white text-xs font-mono font-bold text-emerald-950"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">Official Quote Number</label>
              <input
                type="text"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value.toUpperCase())}
                placeholder="e.g. QUO-2026-0814"
                className="w-full p-2 border border-emerald-300 rounded-lg bg-white text-xs font-mono font-bold text-emerald-950"
              />
            </div>
          </div>
        )}

        {/* Tech Pack URL */}
        {request.tech_pack_url && (
          <a
            href={request.tech_pack_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors font-bold text-xs"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" /> View Tech Pack Specs
            </span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t space-y-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-2">Stage Progression Actions</div>
          {renderActionButtons()}
        </div>

      </div>
    </div>
  );
}
