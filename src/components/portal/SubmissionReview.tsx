import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  Package,
  Layers,
  Calendar,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  Send,
  ArrowLeft,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { useSubmissionDetail } from "../../hooks/merchandiser/useSubmissionDetail";
import { supabase } from "../../lib/supabase";
import { useAppData } from "../../hooks/useAppData";

interface SubmissionReviewProps {
  submissionId: string;
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">{label}</span>
      <span className="text-sm font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

export function SubmissionReview({ submissionId }: SubmissionReviewProps) {
  const navigate = useNavigate();
  const { setToast } = useAppData();
  const { submission, cutSheet, documents, isLoading, refetch } = useSubmissionDetail(submissionId);
  const [isDeciding, setIsDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState<{ action: "approve" | "reject"; po_number?: string } | null>(null);

  const callDecision = async (action: "approve" | "reject", reason?: string) => {
    setDecisionError("");
    setIsDeciding(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("submit-customer-review-decision", {
        body: { submission_id: submissionId, action, reason },
      });
      if (error) {
        // supabase.functions.invoke wraps a non-2xx response's JSON body in
        // error.context — surface the real server message when available
        // rather than a generic "Edge Function returned a non-2xx status code".
        let message = error.message;
        try {
          const body = await error.context?.json?.();
          if (body?.error) message = body.error;
        } catch {
          // ignore — fall back to error.message
        }
        throw new Error(message);
      }
      if (result?.error) throw new Error(result.error);

      setDecisionOutcome({ action, po_number: result?.po_number });
      setToast({ message: action === "approve" ? "Order approved and sent into production." : "Changes requested — your merchandiser has been notified.", type: "success" });
      refetch();
    } catch (err: any) {
      setDecisionError(err.message || `Failed to ${action} this submission.`);
    } finally {
      setIsDeciding(false);
    }
  };

  const handleReject = () => {
    const reason = rejectReason.trim();
    if (!reason) {
      setDecisionError("Please describe what needs to change before requesting revisions.");
      return;
    }
    callDecision("reject", reason);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-muted-foreground">
        <ClipboardCheck className="w-8 h-8 mx-auto mb-3 animate-pulse text-primary" />
        Loading order details...
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-600" />
        <h2 className="text-lg font-bold text-foreground">Order Not Found</h2>
        <p className="text-sm text-muted-foreground mt-1">This order review link is no longer valid.</p>
        <Link to="/orders" className="inline-flex items-center gap-1.5 mt-4 text-primary font-bold text-sm hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const isDecided = submission.status !== "pending_customer_review";
  const mainStyle = (Array.isArray(submission.style_blocks) && submission.style_blocks[0]) || {};
  const sizeMatrix: Record<string, number> =
    (mainStyle.size_matrix && Object.keys(mainStyle.size_matrix).length > 0 ? mainStyle.size_matrix : null) ||
    cutSheet?.sheet_data?.components?.[0]?.size_matrix ||
    {};
  const totalQty = Object.values(sizeMatrix).reduce((sum: number, v) => sum + (Number(v) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs font-bold">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>

      <div className="bg-card border rounded-3xl p-6 md:p-8 shadow-sm space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <ClipboardCheck className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-wider">Awaiting Your Approval</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
          Review Order {submission.apply_reference_code}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your merchandiser entered this order on your behalf. Please review everything below carefully before approving.
        </p>
      </div>

      {decisionOutcome ? (
        <div className={`rounded-3xl p-8 text-center border ${decisionOutcome.action === "approve" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          {decisionOutcome.action === "approve" ? (
            <>
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-600" />
              <h2 className="text-lg font-black text-emerald-900">Order Approved &amp; In Production</h2>
              <p className="text-sm text-emerald-800 mt-1">
                {decisionOutcome.po_number ? `Blanket PO ${decisionOutcome.po_number} has been created and ` : "This order has "}
                entered the production pipeline at Stage 1. You can track it from your dashboard.
              </p>
            </>
          ) : (
            <>
              <Send className="w-10 h-10 mx-auto mb-3 text-amber-600" />
              <h2 className="text-lg font-black text-amber-900">Changes Requested</h2>
              <p className="text-sm text-amber-800 mt-1">Your merchandiser has been notified and will follow up with a revised order.</p>
            </>
          )}
          <Link to="/orders" className="inline-flex items-center gap-1.5 mt-4 bg-white border font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-neutral-50">
            Return to Dashboard
          </Link>
        </div>
      ) : (
        <>
          {isDecided && (
            <div className="rounded-2xl p-4 border bg-muted/40 text-sm font-semibold text-muted-foreground">
              {submission.status === "customer_rejected"
                ? "You already requested changes on this order — your merchandiser has been notified."
                : `This order is no longer awaiting your review (status: ${submission.status.replace(/_/g, " ")}).`}
            </div>
          )}

          {/* Company & Contact */}
          <div className="bg-card border rounded-3xl p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-700 mb-4">
              <Building2 className="w-4 h-4 text-primary" /> Company &amp; Contact
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Company Name" value={submission.company_name} />
              <Field label="Brand Name" value={submission.brand_name} />
              <Field label="Contact Name" value={submission.contact_name} />
              <Field label="Contact Email" value={submission.contact_email} />
              <Field label="Contact Phone" value={submission.contact_phone} />
              <Field label="Website" value={submission.website} />
            </div>
          </div>

          {/* Shipping Address */}
          {(submission as any).shipping_street && (
            <div className="bg-card border rounded-3xl p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-700 mb-4">
                <Package className="w-4 h-4 text-primary" /> Shipping Address
              </h3>
              <p className="text-sm font-semibold text-neutral-900">
                {(submission as any).shipping_street}, {(submission as any).shipping_city}{" "}
                {(submission as any).shipping_state} {(submission as any).shipping_zip}, {(submission as any).shipping_country}
              </p>
            </div>
          )}

          {/* Order Classification */}
          <div className="bg-card border rounded-3xl p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-700 mb-4">
              <Layers className="w-4 h-4 text-primary" /> Order Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Order Type" value={submission.submission_type?.replace(/_/g, " ")} />
              <Field label="Product Type" value={submission.product_type} />
              <Field label="Fabric Type" value={submission.fabric_type} />
              <Field label="Priority" value={submission.priority} />
              <Field label="PO / Reference" value={submission.existing_order_reference} />
              <Field label="Total Quantity" value={totalQty > 0 ? `${totalQty} pcs` : undefined} />
            </div>
          </div>

          {/* Style / Cut Sheet Specs */}
          {(mainStyle.style_name || mainStyle.style_number || cutSheet) && (
            <div className="bg-card border rounded-3xl p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-700 mb-4">
                <FileText className="w-4 h-4 text-primary" /> Style &amp; Cut Sheet
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                <Field label="Style Name" value={mainStyle.style_name || cutSheet?.style_no} />
                <Field label="Style Number" value={mainStyle.style_number} />
                <Field label="Colorway" value={mainStyle.colorway || cutSheet?.colorway} />
                <Field label="Wash Type" value={mainStyle.wash_type || cutSheet?.wash_type} />
              </div>
              {Object.keys(sizeMatrix).length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1.5">Size Matrix</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(sizeMatrix).map(([size, qty]) => (
                      <span key={size} className="px-2.5 py-1 bg-neutral-100 rounded-lg text-xs font-mono font-bold text-neutral-800">
                        {size}: {String(qty)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Target Dates */}
          {((submission as any).planned_ship_date || (submission as any).due_date) && (
            <div className="bg-card border rounded-3xl p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-700 mb-4">
                <Calendar className="w-4 h-4 text-primary" /> Target Dates
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Target Ship Date" value={(submission as any).planned_ship_date || (submission as any).due_date} />
              </div>
            </div>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="bg-card border rounded-3xl p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-700 mb-4">
                <FileText className="w-4 h-4 text-primary" /> Documents
              </h3>
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border text-sm">
                    <span className="font-semibold text-neutral-800">{doc.file_name}</span>
                    <span className="text-xs text-muted-foreground uppercase font-bold">{doc.doc_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approve / Reject Actions */}
          {!isDecided && (
            <div className="bg-card border rounded-3xl p-6 shadow-sm space-y-3">
              {decisionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                  {decisionError}
                </div>
              )}

              {showRejectBox ? (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="What needs to change? (required)"
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowRejectBox(false); setRejectReason(""); setDecisionError(""); }}
                      className="px-4 py-2.5 border rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeciding || !rejectReason.trim()}
                      onClick={handleReject}
                      className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" /> {isDeciding ? "Sending..." : "Send Revision Request"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={isDeciding}
                    onClick={() => callDecision("approve")}
                    className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" /> {isDeciding ? "Processing..." : "Approve & Start Production"}
                  </button>
                  <button
                    type="button"
                    disabled={isDeciding}
                    onClick={() => setShowRejectBox(true)}
                    className="px-4 py-3 bg-white border border-destructive/30 text-destructive rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-destructive/5"
                  >
                    <XCircle className="w-4 h-4" /> Request Changes
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
