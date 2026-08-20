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
  ShieldCheck
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

  const isSampleApproved = request.status?.toLowerCase() === "approved" || request.sample_status === "Sample_Approved";
  const canConvert = Boolean(masterSku.trim() && quoteNumber.trim());

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
        // Update apply_submissions
        try {
          await supabase
            .from("apply_submissions")
            .update(payload)
            .or(`id.eq.${request.id},apply_reference_code.eq.${request.apply_reference_code}`);
        } catch (e) {
          console.warn("Could not update apply_submissions:", e);
        }

        // Also update sample_requests
        try {
          await supabase
            .from("sample_requests")
            .update(payload)
            .or(`id.eq.${request.id},apply_reference_code.eq.${request.apply_reference_code}`);
        } catch (e) {
          console.warn("Could not update sample_requests:", e);
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

  const handleConvert = () => {
    updateStatus("converted", {
      master_product_sku: masterSku.trim(),
      quote_number: quoteNumber.trim(),
      approved_at: new Date().toISOString(),
    });
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
        return (
          <div className="flex gap-2">
            <button
              disabled={loading}
              onClick={() => updateStatus("approved")}
              className="flex-1 py-2.5 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 shadow-sm"
            >
              ✓ Approve Sample
            </button>
            <button
              disabled={loading}
              onClick={() => updateStatus("rejected")}
              className="flex-1 py-2.5 bg-red-600 text-white font-black text-xs rounded-xl hover:bg-red-700 shadow-sm"
            >
              ✕ Reject
            </button>
          </div>
        );
      case "approved":
        return (
          <button
            disabled={loading || !canConvert}
            onClick={handleConvert}
            title={!canConvert ? "Assign Master SKU & Quote Number above first" : undefined}
            className={`w-full py-2.5 font-black text-xs rounded-xl flex justify-center items-center gap-2 shadow-sm transition-all ${
              canConvert
                ? "bg-emerald-700 text-white hover:bg-emerald-800"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            <ArrowRight className="w-4 h-4" />
            {canConvert ? "Convert to Bulk Production Order" : "Locked — Assign Master SKU & Quote First"}
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
