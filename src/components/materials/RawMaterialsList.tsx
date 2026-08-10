import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  Building2,
  Package,
  Layers,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  MoreVertical,
  Scissors,
  Droplets,
  ChevronDown,
  Trash2,
  Check,
  XCircle,
  Eye,
} from "lucide-react";
import type { 
  RawMaterialsIntake, 
  MaterialStatus, 
  Facility, 
  MaterialCategory 
} from "../../lib/types";

interface RawMaterialsListProps {
  intakes: RawMaterialsIntake[];
  onUpdateStatus: (params: { id: string; status: MaterialStatus }) => Promise<any>;
  onDeleteIntake: (id: string) => Promise<any>;
  selectedFacility: string;
  onSelectFacility: (fac: "All" | "Sewing Facility" | "Laundry Facility") => void;
  onOpenNewModal: () => void;
}

export const RawMaterialsList: React.FC<RawMaterialsListProps> = ({
  intakes = [],
  onUpdateStatus,
  onDeleteIntake,
  selectedFacility,
  onSelectFacility,
  onOpenNewModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [viewDetailItem, setViewDetailItem] = useState<RawMaterialsIntake | null>(null);

  // Filtered List
  const filteredList = useMemo(() => {
    return intakes.filter((item) => {
      // Facility filter
      if (selectedFacility !== "All" && item.facility !== selectedFacility) {
        return false;
      }

      // Status filter
      if (statusFilter !== "All" && item.status !== statusFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== "All" && item.category !== categoryFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.intake_number.toLowerCase().includes(q) ||
          item.item_name.toLowerCase().includes(q) ||
          (item.supplier && item.supplier.toLowerCase().includes(q)) ||
          (item.lot_number && item.lot_number.toLowerCase().includes(q)) ||
          (item.shade_lot && item.shade_lot.toLowerCase().includes(q)) ||
          (item.storage_location && item.storage_location.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [intakes, selectedFacility, statusFilter, categoryFilter, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Intake Number",
      "Facility",
      "Item Name",
      "Category",
      "Supplier",
      "Expected Qty",
      "Received Qty",
      "Damaged Qty",
      "Accepted Qty",
      "Unit",
      "Lot Number",
      "Shade Lot",
      "Storage Location",
      "Status",
      "Received Date",
      "Notes",
    ];

    const rows = filteredList.map((item) => [
      item.intake_number,
      `"${item.facility}"`,
      `"${item.item_name}"`,
      item.category,
      `"${item.supplier || ""}"`,
      item.quantity_expected,
      item.quantity_received,
      item.quantity_damaged,
      item.quantity_accepted,
      item.unit,
      `"${item.lot_number || ""}"`,
      `"${item.shade_lot || ""}"`,
      `"${item.storage_location || ""}"`,
      item.status,
      item.received_date,
      `"${(item.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Forge_Fabric_RawMaterials_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: MaterialStatus) => {
    switch (status) {
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case "In QC":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> In QC
          </span>
        );
      case "Received":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Package className="w-3 h-3" /> Received
          </span>
        );
      case "Partial":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <AlertCircle className="w-3 h-3" /> Partial
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm overflow-hidden space-y-0">
      {/* 1. Header Toolbar */}
      <div className="p-5 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50/40">
        
        {/* Facility Tab Filters */}
        <div className="flex items-center gap-1 bg-neutral-200/70 p-1 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => onSelectFacility("All")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedFacility === "All"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            All Facilities ({intakes.length})
          </button>
          <button
            type="button"
            onClick={() => onSelectFacility("Sewing Facility")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedFacility === "Sewing Facility"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-blue-600" />
            Sewing Facility ({intakes.filter((i) => i.facility === "Sewing Facility").length})
          </button>
          <button
            type="button"
            onClick={() => onSelectFacility("Laundry Facility")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedFacility === "Laundry Facility"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-indigo-600" />
            Laundry Facility ({intakes.filter((i) => i.facility === "Laundry Facility").length})
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewModal}
            className="px-4 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Log Material Intake</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="p-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 bg-white">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by Intake #, item name, lot, supplier, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Fabric">Fabric</option>
            <option value="Thread">Thread</option>
            <option value="Button">Button</option>
            <option value="Zipper">Zipper</option>
            <option value="Pocketing">Pocketing</option>
            <option value="Label">Label</option>
            <option value="Packaging">Packaging</option>
            <option value="Chemical">Chemical</option>
            <option value="Other">Other</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="In QC">In QC</option>
            <option value="Received">Received</option>
            <option value="Partial">Partial</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* 3. Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50/80 text-neutral-500 font-bold uppercase tracking-wider text-[10px] border-b border-neutral-100">
            <tr>
              <th className="px-5 py-3">Intake Ref & Date</th>
              <th className="px-4 py-3">Facility</th>
              <th className="px-4 py-3">Item & Category</th>
              <th className="px-4 py-3">Supplier & Lot</th>
              <th className="px-4 py-3 text-right">Received / Damaged</th>
              <th className="px-4 py-3 text-right">Net Accepted</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-neutral-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-neutral-700">No Raw Material Inbounds Found</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Try adjusting your filters or click "Log Material Intake" to register new arrivals.
                  </p>
                </td>
              </tr>
            ) : (
              filteredList.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/60 transition-colors group">
                  {/* Intake & Date */}
                  <td className="px-5 py-3.5">
                    <div className="font-mono font-bold text-neutral-900">
                      {item.intake_number}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {item.received_date}
                    </div>
                  </td>

                  {/* Facility */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        item.facility === "Sewing Facility"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      }`}
                    >
                      {item.facility === "Sewing Facility" ? (
                        <Scissors className="w-3 h-3" />
                      ) : (
                        <Droplets className="w-3 h-3" />
                      )}
                      {item.facility}
                    </span>
                  </td>

                  {/* Item & Category */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <div className="font-semibold text-neutral-900 truncate">
                      {item.item_name}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      <span className="font-medium bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 mr-1.5">
                        {item.category}
                      </span>
                      {item.storage_location && (
                        <span className="text-neutral-400">Loc: {item.storage_location}</span>
                      )}
                    </div>
                  </td>

                  {/* Supplier & Lot */}
                  <td className="px-4 py-3.5">
                    <div className="text-neutral-800 font-medium truncate">
                      {item.supplier || "Direct Mill"}
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      {item.lot_number ? `Lot: ${item.lot_number}` : "Lot: N/A"}
                      {item.shade_lot && ` • ${item.shade_lot}`}
                    </div>
                  </td>

                  {/* Received / Damaged */}
                  <td className="px-4 py-3.5 text-right font-mono">
                    <div className="font-bold text-neutral-900">
                      {item.quantity_received.toLocaleString()} <span className="text-neutral-400 font-sans text-[11px]">{item.unit}</span>
                    </div>
                    {item.quantity_damaged > 0 && (
                      <div className="text-[11px] text-rose-600 font-medium">
                        -{item.quantity_damaged} flawed
                      </div>
                    )}
                  </td>

                  {/* Net Accepted */}
                  <td className="px-4 py-3.5 text-right font-mono">
                    <div className="font-black text-emerald-700 text-sm">
                      {(item.quantity_accepted ?? 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-sans">
                      Usable Stock
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 text-center">
                    {getStatusBadge(item.status)}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.status !== "Approved" && (
                        <button
                          type="button"
                          title="Quick Approve"
                          onClick={() => onUpdateStatus({ id: item.id, status: "Approved" })}
                          className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {item.status !== "In QC" && (
                        <button
                          type="button"
                          title="Flag for QC Gate"
                          onClick={() => onUpdateStatus({ id: item.id, status: "In QC" })}
                          className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        title="View Full Inbound Details"
                        onClick={() => setViewDetailItem(item)}
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        title="Delete Record"
                        onClick={() => {
                          if (confirm(`Delete intake entry ${item.intake_number}?`)) {
                            onDeleteIntake(item.id);
                          }
                        }}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Detail Modal */}
      {viewDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                  {viewDetailItem.intake_number}
                </span>
                <h3 className="text-base font-bold text-neutral-900">
                  {viewDetailItem.item_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailItem(null)}
                className="p-2 text-neutral-400 hover:text-neutral-700 rounded-xl"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Facility</span>
                <span className="font-semibold text-neutral-900">{viewDetailItem.facility}</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Category</span>
                <span className="font-semibold text-neutral-900">{viewDetailItem.category}</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Supplier</span>
                <span className="font-semibold text-neutral-900">{viewDetailItem.supplier || "N/A"}</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Supplier PO</span>
                <span className="font-semibold text-neutral-900 font-mono">{viewDetailItem.supplier_po || "N/A"}</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Lot Number</span>
                <span className="font-semibold text-neutral-900 font-mono">{viewDetailItem.lot_number || "N/A"}</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold">Storage Location</span>
                <span className="font-semibold text-neutral-900">{viewDetailItem.storage_location || "N/A"}</span>
              </div>
            </div>

            {viewDetailItem.notes && (
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs">
                <span className="font-bold text-amber-900 block mb-1">Inspection Observations / Notes</span>
                <p className="text-neutral-700">{viewDetailItem.notes}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setViewDetailItem(null)}
                className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
