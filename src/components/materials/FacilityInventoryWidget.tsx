import React from "react";
import { 
  Building2, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Sparkles, 
  Droplets, 
  Scissors 
} from "lucide-react";
import type { RawMaterialsIntake } from "../../lib/types";

interface FacilityInventoryWidgetProps {
  intakes: RawMaterialsIntake[];
  selectedFacility?: string;
  onSelectFacility?: (facility: "All" | "Sewing Facility" | "Laundry Facility") => void;
}

export const FacilityInventoryWidget: React.FC<FacilityInventoryWidgetProps> = ({
  intakes = [],
  selectedFacility = "All",
  onSelectFacility,
}) => {
  const totalItems = intakes.length;
  const totalReceivedUnits = intakes.reduce((sum, item) => sum + (item.quantity_received || 0), 0);
  const totalAcceptedUnits = intakes.reduce((sum, item) => sum + (item.quantity_accepted || 0), 0);
  const totalDamagedUnits = intakes.reduce((sum, item) => sum + (item.quantity_damaged || 0), 0);

  const sewingItems = intakes.filter((item) => item.facility === "Sewing Facility");
  const laundryItems = intakes.filter((item) => item.facility === "Laundry Facility");

  const pendingQC = intakes.filter((item) => item.status === "Received" || item.status === "In QC").length;
  const approvedCount = intakes.filter((item) => item.status === "Approved").length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. All Facilities Overview */}
      <div 
        onClick={() => onSelectFacility?.("All")}
        className={`p-5 rounded-2xl border transition-all cursor-pointer ${
          selectedFacility === "All"
            ? "bg-white border-neutral-900 shadow-md ring-1 ring-neutral-900/10"
            : "bg-white border-neutral-200/90 hover:border-neutral-300 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Total Material Inbound
          </span>
          <div className="p-2 bg-neutral-100 text-neutral-800 rounded-xl">
            <Package className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black font-mono text-neutral-900">
            {totalReceivedUnits.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500 font-medium">
            <span>{totalItems} Intake Shipments</span>
            <span className="text-emerald-600 font-semibold">{totalAcceptedUnits.toLocaleString()} Accepted</span>
          </div>
        </div>
      </div>

      {/* 2. Sewing Facility */}
      <div 
        onClick={() => onSelectFacility?.("Sewing Facility")}
        className={`p-5 rounded-2xl border transition-all cursor-pointer ${
          selectedFacility === "Sewing Facility"
            ? "bg-white border-blue-600 shadow-md ring-1 ring-blue-600/15"
            : "bg-white border-neutral-200/90 hover:border-neutral-300 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            Sewing Facility (CMT)
          </span>
          <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
            <Scissors className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black font-mono text-neutral-900">
            {sewingItems.reduce((acc, i) => acc + (i.quantity_accepted || 0), 0).toLocaleString()}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500 font-medium">
            <span>{sewingItems.length} SKUs (Fabrics & Trims)</span>
            <span className="text-blue-600 font-bold">Facility A</span>
          </div>
        </div>
      </div>

      {/* 3. Laundry Facility */}
      <div 
        onClick={() => onSelectFacility?.("Laundry Facility")}
        className={`p-5 rounded-2xl border transition-all cursor-pointer ${
          selectedFacility === "Laundry Facility"
            ? "bg-white border-indigo-600 shadow-md ring-1 ring-indigo-600/15"
            : "bg-white border-neutral-200/90 hover:border-neutral-300 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
            Laundry / Wash House
          </span>
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
            <Droplets className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black font-mono text-neutral-900">
            {laundryItems.reduce((acc, i) => acc + (i.quantity_accepted || 0), 0).toLocaleString()}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500 font-medium">
            <span>{laundryItems.length} Batches (Chems & Stones)</span>
            <span className="text-indigo-600 font-bold">Facility B</span>
          </div>
        </div>
      </div>

      {/* 4. Inspection & Quality Status */}
      <div className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Quality Gate Clearance
          </span>
          <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black font-mono text-neutral-900">
            {approvedCount} <span className="text-sm font-sans font-bold text-neutral-400">/ {totalItems}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500 font-medium">
            <span className="text-amber-600 font-semibold">{pendingQC} Pending Inspection</span>
            {totalDamagedUnits > 0 && (
              <span className="text-rose-600 font-semibold">{totalDamagedUnits} Damaged</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
