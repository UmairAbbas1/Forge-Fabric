import React, { useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  X,
  ExternalLink,
  Check,
  Package,
  Calculator,
  Truck,
  FileText,
  CheckCircle2,
} from "lucide-react";

interface SampleRequestDetailsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function SampleRequestDetails({ request, onClose, onUpdate }: SampleRequestDetailsProps) {
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("sample_requests")
        .update({ status: newStatus })
        .eq("id", request.id);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const renderActionButtons = () => {
    switch (request.status) {
      case "submitted":
        if (request.fabric_trim_source === "Brand Sourced") {
          return (
            <button
              onClick={() => updateStatus("waiting_materials")}
              className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2"
            >
              <Truck className="w-4 h-4" /> Move to Waiting Materials
            </button>
          );
        } else {
          return (
            <button
              onClick={() => updateStatus("cost_approval")}
              className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex justify-center items-center gap-2"
            >
              <Calculator className="w-4 h-4" /> Request Cost Approval
            </button>
          );
        }
      case "cost_approval":
        return (
          <button
            onClick={() => updateStatus("in_production")}
            className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex justify-center items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Approve Cost &amp; Start
          </button>
        );
      case "waiting_materials":
        return (
          <button
            onClick={() => updateStatus("in_production")}
            className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex justify-center items-center gap-2"
          >
            <Package className="w-4 h-4" /> Mark Materials Received
          </button>
        );
      case "in_production":
        return (
          <button
            onClick={() => updateStatus("shipped")}
            className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2"
          >
            <Truck className="w-4 h-4" /> Mark as Shipped
          </button>
        );
      case "shipped":
        return (
          <button
            onClick={() => updateStatus("received")}
            className="w-full py-2 bg-neutral-800 text-white font-bold rounded-lg hover:bg-black flex justify-center items-center gap-2"
          >
            <Check className="w-4 h-4" /> Mark Client Received
          </button>
        );
      case "received":
        return (
          <div className="flex gap-2">
            <button
              onClick={() => updateStatus("approved")}
              className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700"
            >
              Approve Sample
            </button>
            <button
              onClick={() => updateStatus("rejected")}
              className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
            >
              Reject Sample
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)] sticky top-6 animate-in slide-in-from-right-4">
      <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50/80">
        <h3 className="font-bold text-neutral-900 flex items-center gap-2">Sample Details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-200 rounded-lg text-neutral-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div>
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-bold text-lg text-neutral-900">{request.companies?.name}</h4>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700">
              {request.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            Requested on {new Date(request.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
            <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
              Type
            </span>
            <span className="text-sm font-semibold text-neutral-800">{request.sample_type}</span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
            <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
              Sourcing
            </span>
            <span className="text-sm font-semibold text-neutral-800">
              {request.fabric_trim_source}
            </span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100 col-span-2">
            <span className="block text-[10px] font-bold uppercase text-neutral-500 mb-2">
              Sizes &amp; Quantity ({request.quantity} total)
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(request.size_breakdown || {}).map(([size, qty]) => (
                <div
                  key={size}
                  className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-bold shadow-sm"
                >
                  <span className="text-neutral-500 mr-1">{size}:</span>
                  <span className="text-neutral-900">{qty as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {request.tech_pack_url && (
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 border-b border-neutral-100 pb-2">
              Documents
            </h5>
            <a
              href={request.tech_pack_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-bold">Tech Pack</span>
              </div>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {request.special_instructions && (
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 border-b border-neutral-100 pb-2">
              Special Instructions
            </h5>
            <p className="text-sm text-neutral-700 bg-amber-50 border border-amber-100 p-3 rounded-lg">
              {request.special_instructions}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-neutral-200 bg-neutral-50">
        {loading ? (
          <div className="w-full py-2 bg-neutral-200 text-neutral-500 font-bold rounded-lg text-center animate-pulse">
            Updating...
          </div>
        ) : (
          renderActionButtons()
        )}
      </div>
    </div>
  );
}
