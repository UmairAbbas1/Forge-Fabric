import React from "react";
import { CheckCircle2 } from "lucide-react";

export type OrderClassificationType =
  "new_order" | "sample_request" | "rush_order" | "update_existing";

interface OrderClassificationSelectorProps {
  value: OrderClassificationType;
  onChange: (type: OrderClassificationType) => void;
}

export const OrderClassificationSelector: React.FC<OrderClassificationSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* New Bulk Order */}
      <label
        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
          value === "new_order"
            ? "border-blue-600 bg-blue-50/40 shadow-xs"
            : "border-neutral-200 hover:border-neutral-300 bg-white"
        }`}
      >
        <input
          type="radio"
          name="order_type"
          value="new_order"
          checked={value === "new_order"}
          onChange={() => onChange("new_order")}
          className="sr-only"
        />
        <div>
          <h4 className="font-bold text-sm text-neutral-900">New Bulk Order</h4>
          <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
            Standard production run (Blanket PO, cut sheets &amp; size matrix).
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-bold text-blue-700">
          <span>Standard Flow</span>
          {value === "new_order" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
        </div>
      </label>

      {/* Sample Request */}
      <label
        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
          value === "sample_request"
            ? "border-blue-600 bg-blue-50/40 shadow-xs"
            : "border-neutral-200 hover:border-neutral-300 bg-white"
        }`}
      >
        <input
          type="radio"
          name="order_type"
          value="sample_request"
          checked={value === "sample_request"}
          onChange={() => onChange("sample_request")}
          className="sr-only"
        />
        <div>
          <h4 className="font-bold text-sm text-neutral-900">Sample Request</h4>
          <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
            Fit sample, photo sample, or pre-production counter sample.
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-bold text-blue-700">
          <span>Sample PO</span>
          {value === "sample_request" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
        </div>
      </label>

      {/* Rush Order */}
      <label
        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
          value === "rush_order"
            ? "border-blue-600 bg-blue-50/40 shadow-xs"
            : "border-neutral-200 hover:border-neutral-300 bg-white"
        }`}
      >
        <input
          type="radio"
          name="order_type"
          value="rush_order"
          checked={value === "rush_order"}
          onChange={() => onChange("rush_order")}
          className="sr-only"
        />
        <div>
          <h4 className="font-bold text-sm text-neutral-900">Rush Production</h4>
          <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
            Expedited cutting &amp; sewing (applies rush surcharge acknowledgment).
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-bold text-blue-700">
          <span>Fast Track</span>
          {value === "rush_order" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
        </div>
      </label>

      {/* Update Existing Order */}
      <label
        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
          value === "update_existing"
            ? "border-blue-600 bg-blue-50/40 shadow-xs"
            : "border-neutral-200 hover:border-neutral-300 bg-white"
        }`}
      >
        <input
          type="radio"
          name="order_type"
          value="update_existing"
          checked={value === "update_existing"}
          onChange={() => onChange("update_existing")}
          className="sr-only"
        />
        <div>
          <h4 className="font-bold text-sm text-neutral-900">Order Update</h4>
          <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
            Change size matrix, cut sheet spread, or tech pack on existing PO.
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-bold text-blue-700">
          <span>Revision Form</span>
          {value === "update_existing" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
        </div>
      </label>
    </div>
  );
};
