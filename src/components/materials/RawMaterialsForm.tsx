import React, { useState, useEffect } from "react";
import { 
  Plus, 
  X, 
  Package, 
  Building2, 
  Layers, 
  Calendar, 
  Hash, 
  Check, 
  AlertCircle,
  Truck,
  Sparkles,
  Info
} from "lucide-react";
import type { 
  RawMaterialsIntake, 
  Facility, 
  MaterialCategory, 
  MaterialUnit, 
  MaterialStatus 
} from "../../lib/types";

interface RawMaterialsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<RawMaterialsIntake, "id" | "intake_number" | "created_at">) => Promise<any>;
  initialFacility?: Facility;
}

const CATEGORIES: MaterialCategory[] = [
  "Fabric",
  "Thread",
  "Button",
  "Zipper",
  "Pocketing",
  "Label",
  "Packaging",
  "Chemical",
  "Other",
];

const UNITS: MaterialUnit[] = [
  "Yards",
  "Meters",
  "Kg",
  "Liters",
  "Pieces",
  "Rolls",
  "Boxes",
  "Cones",
];

const FACILITIES: Facility[] = ["Sewing Facility", "Laundry Facility"];

const STATUSES: MaterialStatus[] = [
  "Received",
  "In QC",
  "Approved",
  "Partial",
  "Rejected",
];

export const RawMaterialsForm: React.FC<RawMaterialsFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialFacility = "Sewing Facility",
}) => {
  const [facility, setFacility] = useState<Facility>(initialFacility);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<MaterialCategory>("Fabric");
  const [supplier, setSupplier] = useState("");
  const [supplierPo, setSupplierPo] = useState("");
  const [quantityExpected, setQuantityExpected] = useState<number>(1000);
  const [quantityReceived, setQuantityReceived] = useState<number>(1000);
  const [quantityDamaged, setQuantityDamaged] = useState<number>(0);
  const [unit, setUnit] = useState<MaterialUnit>("Yards");
  const [lotNumber, setLotNumber] = useState("");
  const [shadeLot, setShadeLot] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [status, setStatus] = useState<MaterialStatus>("Received");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Category to Facility and Unit Smart Default Auto-mapping
  useEffect(() => {
    if (category === "Chemical") {
      setFacility("Laundry Facility");
      if (unit === "Yards" || unit === "Pieces") setUnit("Kg");
    } else if (category === "Fabric" || category === "Pocketing") {
      setFacility("Sewing Facility");
      if (unit !== "Yards" && unit !== "Meters") setUnit("Yards");
    } else if (category === "Thread") {
      setFacility("Sewing Facility");
      if (unit !== "Rolls" && unit !== "Cones") setUnit("Rolls");
    } else if (category === "Button" || category === "Zipper" || category === "Label") {
      setFacility("Sewing Facility");
      if (unit !== "Pieces") setUnit("Pieces");
    }
  }, [category]);

  if (!isOpen) return null;

  const netAccepted = Math.max(0, (quantityReceived || 0) - (quantityDamaged || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!itemName.trim()) {
      setErrorMsg("Please enter the material/item name.");
      return;
    }

    if (quantityReceived <= 0) {
      setErrorMsg("Quantity received must be greater than 0.");
      return;
    }

    if (quantityDamaged > quantityReceived) {
      setErrorMsg("Damaged quantity cannot exceed the total received quantity.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        facility,
        item_name: itemName.trim(),
        category,
        supplier: supplier.trim() || undefined,
        supplier_po: supplierPo.trim() || undefined,
        quantity_expected: Number(quantityExpected) || Number(quantityReceived),
        quantity_received: Number(quantityReceived),
        quantity_damaged: Number(quantityDamaged) || 0,
        quantity_accepted: netAccepted,
        unit,
        lot_number: lotNumber.trim() || undefined,
        shade_lot: shadeLot.trim() || undefined,
        storage_location: storageLocation.trim() || undefined,
        status,
        received_date: receivedDate,
        expected_date: expectedDate || undefined,
        notes: notes.trim() || undefined,
      });

      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || "Failed to log material intake.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neutral-900 text-white rounded-2xl shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                Log Raw Materials Intake
              </h3>
              <p className="text-xs text-neutral-500">
                Register inbound fabric, trims, and laundry chemistry into facility inventory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Destination Facility & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Target Facility <span className="text-rose-500">*</span>
              </label>
              <select
                value={facility}
                onChange={(e) => setFacility(e.target.value as Facility)}
                className="w-full h-10 px-3 text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
              >
                {FACILITIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Material Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                className="w-full h-10 px-3 text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Description */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              Material / Item Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 13.5oz Kurabo Indigo Selvedge Raw Denim"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
            />
          </div>

          {/* Supplier & Supplier PO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Supplier / Mill Name
              </label>
              <input
                type="text"
                placeholder="e.g. Kurabo Mills / YKK Fasteners"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
              >
              </input>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Supplier PO / Invoice Ref
              </label>
              <input
                type="text"
                placeholder="e.g. PO-SUP-98124"
                value={supplierPo}
                onChange={(e) => setSupplierPo(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
              />
            </div>
          </div>

          {/* Quantities & Units */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800">
                Quantity Breakdown & Net Accepted
              </span>
              <span className="text-[11px] font-semibold text-neutral-500">
                Unit of Measure: <strong>{unit}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Expected
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantityExpected}
                  onChange={(e) => setQuantityExpected(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-xs font-mono font-bold bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Received <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantityReceived}
                  onChange={(e) => setQuantityReceived(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-xs font-mono font-bold bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-rose-600 mb-1">
                  Damaged / Flawed
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantityDamaged}
                  onChange={(e) => setQuantityDamaged(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-xs font-mono font-bold bg-white border border-rose-200 text-rose-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Unit
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as MaterialUnit)}
                  className="w-full h-9 px-2 text-xs font-semibold bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Net Accepted Banner */}
            <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Net Usable / Accepted Quantity:
              </span>
              <span className="font-mono font-black text-emerald-900 text-sm">
                {netAccepted.toLocaleString()} {unit}
              </span>
            </div>
          </div>

          {/* Lots & Storage Tracking */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Lot / Batch #
              </label>
              <input
                type="text"
                placeholder="e.g. LOT-2026-88"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Shade Lot / Color Cast
              </label>
              <input
                type="text"
                placeholder="e.g. Deep Indigo Blue"
                value={shadeLot}
                onChange={(e) => setShadeLot(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Warehouse / Bay Location
              </label>
              <input
                type="text"
                placeholder="e.g. Bay 04 - Shelf 2"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Date & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Received Date
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Initial Intake Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MaterialStatus)}
                className="w-full h-9 px-3 text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Inspection Notes / Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Inspection results, shrinkage test results, shade verification, mill certificate details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-all flex items-center gap-1.5 min-h-[44px] cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Saving Inbound..." : "Save Material Intake"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
