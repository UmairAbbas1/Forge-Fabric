import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { usePermission } from "../hooks/usePermission";
import { supabase, isRealSupabase } from "../lib/supabase";
import { 
  Package, Warehouse, Plus, Search, Filter, CheckCircle2, 
  AlertTriangle, ShieldCheck, Truck, ClipboardList, Layers, FileSpreadsheet, ArrowRight, X, Building2 
} from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Unified Facility Inventory & GRN · Forge & Fabric" },
      { name: "description", content: "Single inventory management hub for raw fabric lots, trim stock, GRN receipts, 4-point inspections, and issuances." },
    ],
  }),
  component: UnifiedInventoryPage,
});

interface InventoryLotRecord {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  category: "Fabric" | "Trim" | "Packaging" | "Chemical";
  lot_number: string;
  facility_id?: string;
  facility_name: string;
  supplier_id?: string;
  supplier_name: string;
  quantity_on_hand: number;
  allocated_qty: number;
  available_qty: number;
  unit_of_measure: string;
  inspection_status: "Pending" | "Approved" | "Hold";
  received_date: string;
  four_point_score?: number; // 4-point inspection defect score per 100 sq yds
}

interface SupplierOption {
  id: string;
  company_name: string;
}

const MOCK_INVENTORY_LOTS: InventoryLotRecord[] = [
  {
    id: "lot-1",
    item_id: "item-1",
    item_code: "FAB-SEL-14OZ",
    item_name: "14oz Raw Selvedge Indigo Denim",
    category: "Fabric",
    lot_number: "LOT-2026-8801",
    facility_name: "Main Sewing Facility",
    supplier_name: "Kurabo Mills Japan",
    quantity_on_hand: 5000,
    allocated_qty: 1200,
    available_qty: 3800,
    unit_of_measure: "Yards",
    inspection_status: "Approved",
    received_date: "2026-08-01",
    four_point_score: 12,
  },
  {
    id: "lot-2",
    item_id: "item-2",
    item_code: "FAB-CANVAS-12OZ",
    item_name: "12oz Organic Cotton Canvas",
    category: "Fabric",
    lot_number: "LOT-2026-8802",
    facility_name: "Main Sewing Facility",
    supplier_name: "Cone Denim LLC",
    quantity_on_hand: 2500,
    allocated_qty: 0,
    available_qty: 2500,
    unit_of_measure: "Yards",
    inspection_status: "Pending",
    received_date: "2026-08-08",
    four_point_score: 28,
  },
  {
    id: "lot-3",
    item_id: "item-3",
    item_code: "TRM-ZIP-YKK5",
    item_name: "#5 YKK Brass Zipper 7 inch",
    category: "Trim",
    lot_number: "LOT-2026-9014",
    facility_name: "Main Sewing Facility",
    supplier_name: "YKK Fastening Corp",
    quantity_on_hand: 10000,
    allocated_qty: 2000,
    available_qty: 8000,
    unit_of_measure: "Pieces",
    inspection_status: "Approved",
    received_date: "2026-07-25",
  },
  {
    id: "lot-4",
    item_id: "item-4",
    item_code: "CHEM-ENZYME-40",
    item_name: "Bio-Wash Cellulase Enzyme",
    category: "Chemical",
    lot_number: "LOT-2026-3310",
    facility_name: "Laundry & Finishing Unit",
    supplier_name: "Archroma Specialty Chemicals",
    quantity_on_hand: 850,
    allocated_qty: 150,
    available_qty: 700,
    unit_of_measure: "Liters",
    inspection_status: "Approved",
    received_date: "2026-08-04",
  },
];

function UnifiedInventoryPage() {
  const canManage = usePermission("inventory", "update");
  const [lots, setLots] = useState<InventoryLotRecord[]>([]);
  const [vendors, setVendors] = useState<SupplierOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryTab, setCategoryTab] = useState<string>("All");
  const [facilityFilter, setFacilityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Goods Receipt Note (GRN) Modal State
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [itemCode, setItemCode] = useState("FAB-SEL-14OZ");
  const [itemName, setItemName] = useState("14oz Selvedge Denim");
  const [category, setCategory] = useState<"Fabric" | "Trim" | "Packaging" | "Chemical">("Fabric");
  const [lotNumber, setLotNumber] = useState(`LOT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [facilityName, setFacilityName] = useState("Main Sewing Facility");
  const [supplierId, setSupplierId] = useState("");
  const [supplierNameInput, setSupplierNameInput] = useState("Kurabo Mills");
  const [qtyReceived, setQtyReceived] = useState(1000);
  const [uom, setUom] = useState("Yards");
  const [inspectionStatus, setInspectionStatus] = useState<"Pending" | "Approved" | "Hold">("Pending");
  const [fourPointScore, setFourPointScore] = useState(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        // Fetch inventory_lots joined with inventory_items and vendors
        const { data: lotData, error: lotErr } = await supabase
          .from("inventory_lots")
          .select(`
            *,
            inventory_items(item_code, item_name, category, unit_of_measure),
            companies(company_name)
          `)
          .order("created_at", { ascending: false });

        if (!lotErr && lotData) {
          const mapped = lotData.map((l: any) => ({
            id: l.id,
            item_id: l.item_id,
            item_code: l.inventory_items?.item_code || "MAT-001",
            item_name: l.inventory_items?.item_name || "Raw Material",
            category: (l.inventory_items?.category || "Fabric") as any,
            lot_number: l.lot_number,
            facility_name: l.facility_id ? "Main Sewing Facility" : "Main Sewing Facility",
            supplier_id: l.supplier_id,
            supplier_name: l.companies?.company_name || "Vendor Mill",
            quantity_on_hand: Number(l.quantity_on_hand || 0),
            allocated_qty: Number(l.allocated_qty || 0),
            available_qty: Number(l.quantity_on_hand || 0) - Number(l.allocated_qty || 0),
            unit_of_measure: l.inventory_items?.unit_of_measure || "Yards",
            inspection_status: l.inspection_status || "Pending",
            received_date: l.created_at ? l.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            four_point_score: l.four_point_score || 12,
          }));
          setLots(mapped);
        }

        // Fetch vendors from companies master
        const { data: vData } = await supabase
          .from("companies")
          .select("id, company_name")
          .eq("company_type", "Vendor")
          .order("company_name");

        if (vData) setVendors(vData);
      } else {
        setLots(MOCK_INVENTORY_LOTS);
        setVendors([
          { id: "v-1", company_name: "Kurabo Mills Japan" },
          { id: "v-2", company_name: "Cone Denim LLC" },
          { id: "v-3", company_name: "YKK Fastening Corp" },
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Inventory Lots
  const filteredLots = useMemo(() => {
    return lots.filter((l) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        l.item_code.toLowerCase().includes(q) ||
        l.item_name.toLowerCase().includes(q) ||
        l.lot_number.toLowerCase().includes(q) ||
        l.supplier_name.toLowerCase().includes(q);

      const matchCat = categoryTab === "All" || l.category === categoryTab;
      const matchFacility = facilityFilter === "All" || l.facility_name === facilityFilter;
      const matchStatus = statusFilter === "All" || l.inspection_status === statusFilter;

      return matchSearch && matchCat && matchFacility && matchStatus;
    });
  }, [lots, searchQuery, categoryTab, facilityFilter, statusFilter]);

  // Distinct facilities dynamically calculated
  const distinctFacilities = useMemo(() => {
    return Array.from(new Set(lots.map((l) => l.facility_name)));
  }, [lots]);

  // Total Available Stock KPI
  const totalOnHands = useMemo(() => {
    return filteredLots.reduce((sum, l) => sum + l.quantity_on_hand, 0);
  }, [filteredLots]);

  const totalAllocated = useMemo(() => {
    return filteredLots.reduce((sum, l) => sum + l.allocated_qty, 0);
  }, [filteredLots]);

  const totalAvailable = useMemo(() => {
    return filteredLots.reduce((sum, l) => sum + l.available_qty, 0);
  }, [filteredLots]);

  // Submit Goods Receipt Note (GRN)
  const handleGrnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!lotNumber.trim() || !itemName.trim()) {
      setFormError("Lot Number and Item Name are required.");
      return;
    }
    if (qtyReceived <= 0) {
      setFormError("Received quantity must be greater than zero.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRealSupabase) {
        // 1. Create or fetch inventory_item master
        let masterItemId = "";
        const { data: existingItem } = await supabase
          .from("inventory_items")
          .select("id")
          .eq("item_code", itemCode.trim().toUpperCase())
          .maybeSingle();

        if (existingItem) {
          masterItemId = existingItem.id;
        } else {
          const { data: newItem, error: itemErr } = await supabase
            .from("inventory_items")
            .insert({
              item_code: itemCode.trim().toUpperCase(),
              item_name: itemName.trim(),
              category: category,
              unit_of_measure: uom,
            })
            .select("id")
            .single();
          if (itemErr) throw itemErr;
          masterItemId = newItem.id;
        }

        // 2. Insert into inventory_lots
        const { error: lotErr } = await supabase.from("inventory_lots").insert({
          item_id: masterItemId,
          lot_number: lotNumber.trim().toUpperCase(),
          supplier_id: supplierId || null,
          quantity_on_hand: qtyReceived,
          allocated_qty: 0,
          inspection_status: inspectionStatus,
          four_point_score: category === "Fabric" ? fourPointScore : null,
        });

        if (lotErr) throw lotErr;
      } else {
        // Mock state insertion
        const matchedVendor = vendors.find((v) => v.id === supplierId);
        const newLot: InventoryLotRecord = {
          id: `lot-${Date.now()}`,
          item_id: `item-${Date.now()}`,
          item_code: itemCode.trim().toUpperCase(),
          item_name: itemName.trim(),
          category: category,
          lot_number: lotNumber.trim().toUpperCase(),
          facility_name: facilityName,
          supplier_id: supplierId,
          supplier_name: matchedVendor?.company_name || supplierNameInput || "Vendor Mill",
          quantity_on_hand: qtyReceived,
          allocated_qty: 0,
          available_qty: qtyReceived,
          unit_of_measure: uom,
          inspection_status: inspectionStatus,
          received_date: new Date().toISOString().slice(0, 10),
          four_point_score: category === "Fabric" ? fourPointScore : undefined,
        };
        setLots([newLot, ...lots]);
      }

      setStatusMsg({ type: "success", text: `Goods Receipt Note (GRN) Lot "${lotNumber}" logged successfully!` });
      setShowGrnModal(false);
      setLotNumber(`LOT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to process Goods Receipt Note.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Inspection Status Update
  const handleUpdateInspection = async (lotId: string, newStatus: "Pending" | "Approved" | "Hold") => {
    try {
      if (isRealSupabase) {
        const { error } = await supabase
          .from("inventory_lots")
          .update({ inspection_status: newStatus })
          .eq("id", lotId);
        if (error) throw error;
      }
      setLots(prev => prev.map(l => l.id === lotId ? { ...l, inspection_status: newStatus } : l));
      setStatusMsg({ type: "success", text: `Inspection status updated to "${newStatus}".` });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to update inspection status." });
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Package className="h-7 w-7 text-primary" /> Unified Facility Inventory &amp; GRN
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Bin/lot tracking, vendor receipt GRNs, 4-point inspection grading, and shop-floor issuances.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setShowGrnModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" /> Receive Material (GRN)
            </button>
          )}
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
            statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Accounting Principles KPI Bar (Blueprint Section 6.1) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border-2 border-border p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Physical On-Hand</span>
            <div className="text-2xl font-black font-mono text-foreground">{totalOnHands.toLocaleString()} units</div>
            <p className="text-[11px] text-muted-foreground">Gross physical quantity across all lots</p>
          </div>

          <div className="bg-card border-2 border-amber-200 bg-amber-50/30 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Allocated to Cut Tickets</span>
            <div className="text-2xl font-black font-mono text-amber-700">{totalAllocated.toLocaleString()} units</div>
            <p className="text-[11px] text-amber-800 font-medium">Reserved by active production Work Orders</p>
          </div>

          <div className="bg-card border-2 border-emerald-200 bg-emerald-50/30 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Net Available for Issue</span>
            <div className="text-2xl font-black font-mono text-emerald-700">{totalAvailable.toLocaleString()} units</div>
            <p className="text-[11px] text-emerald-800 font-medium">Formula: On Hand minus Allocated</p>
          </div>
        </div>

        {/* Category & Filter Navigation */}
        <div className="space-y-3">
          {/* Category Tabs */}
          <div className="flex items-center space-x-2 border-b border-border/60 pb-2 overflow-x-auto">
            {["All", "Fabric", "Trim", "Packaging", "Chemical"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryTab(cat)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  categoryTab === cat
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat} Category
              </button>
            ))}
          </div>

          {/* Search & Dynamic Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-2xl border">
            <div className="relative flex-1 w-full">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search item code, lot number, supplier name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-background border rounded-lg text-sm"
              />
            </div>

            {/* Dynamic Facility Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Facility:
              </label>
              <select
                value={facilityFilter}
                onChange={(e) => setFacilityFilter(e.target.value)}
                className="bg-background border rounded-lg px-3 py-1.5 text-xs font-bold text-foreground w-full sm:w-auto"
              >
                <option value="All">All Dynamic Facilities ({distinctFacilities.length})</option>
                {distinctFacilities.map((fac) => (
                  <option key={fac} value={fac}>{fac}</option>
                ))}
              </select>
            </div>

            {/* Inspection Status Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                QC Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-background border rounded-lg px-3 py-1.5 text-xs font-bold text-foreground w-full sm:w-auto"
              >
                <option value="All">All QC Statuses</option>
                <option value="Approved">Approved Only</option>
                <option value="Pending">Pending 4-Point Inspection</option>
                <option value="Hold">On Hold / Quarantine</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory Lots Table */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Lot Number &amp; Item</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Facility &amp; Vendor Mill</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Physical On-Hand</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Net Available</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">4-Point Inspection Status</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    Loading facility inventory lots...
                  </td>
                </tr>
              ) : filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No inventory lots found matching current category or status filters.
                  </td>
                </tr>
              ) : (
                filteredLots.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono font-extrabold text-primary">{l.lot_number}</div>
                      <div className="font-bold text-foreground">{l.item_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{l.item_code} • [{l.category}]</div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground flex items-center gap-1">
                        <Warehouse className="h-3.5 w-3.5 text-muted-foreground" /> {l.facility_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 text-muted-foreground" /> {l.supplier_name}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right font-mono font-bold text-foreground">
                      {l.quantity_on_hand.toLocaleString()} {l.unit_of_measure}
                    </td>

                    <td className="px-5 py-4 text-right font-mono font-black text-emerald-700">
                      {l.available_qty.toLocaleString()} {l.unit_of_measure}
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {l.inspection_status === "Approved" && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Approved
                          </span>
                        )}
                        {l.inspection_status === "Pending" && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> Inspection Pending
                          </span>
                        )}
                        {l.inspection_status === "Hold" && (
                          <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-800 border border-red-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> On Hold / Quarantine
                          </span>
                        )}

                        {l.category === "Fabric" && l.four_point_score !== undefined && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            4-Pt Defect Score: <strong>{l.four_point_score}</strong> / 100 sq yds
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      {canManage && (
                        <select
                          value={l.inspection_status}
                          onChange={(e) => handleUpdateInspection(l.id, e.target.value as any)}
                          className="bg-background border rounded-lg px-2 py-1 text-[11px] font-bold text-foreground"
                        >
                          <option value="Approved">Set Approved</option>
                          <option value="Pending">Set Pending</option>
                          <option value="Hold">Set Hold</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* GOODS RECEIPT NOTE (GRN) MODAL */}
        {showGrnModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
              
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" /> Goods Receipt Note (GRN) Intake
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Log material lot arrival from suppliers with 4-point inspection grading.
                  </p>
                </div>
                <button onClick={() => setShowGrnModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleGrnSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Lot Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LOT-2026-8801"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                    >
                      <option value="Fabric">Fabric Roll</option>
                      <option value="Trim">Trim &amp; Zipper</option>
                      <option value="Packaging">Packaging Carton</option>
                      <option value="Chemical">Laundry Chemical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Item Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. FAB-SEL-14OZ"
                      value={itemCode}
                      onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Item Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 14oz Raw Selvedge Indigo Denim"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Vendor Mill Supplier
                    </label>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                    >
                      <option value="">Select Vendor Company</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.company_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Receiving Facility
                    </label>
                    <select
                      value={facilityName}
                      onChange={(e) => setFacilityName(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                    >
                      <option value="Main Sewing Facility">Main Sewing Facility</option>
                      <option value="Laundry & Finishing Unit">Laundry &amp; Finishing Unit</option>
                      <option value="Central Warehouse">Central Warehouse</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Quantity Received <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={qtyReceived}
                      onChange={(e) => setQtyReceived(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Unit of Measure
                    </label>
                    <select
                      value={uom}
                      onChange={(e) => setUom(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm"
                    >
                      <option value="Yards">Yards</option>
                      <option value="Meters">Meters</option>
                      <option value="Pieces">Pieces</option>
                      <option value="Liters">Liters</option>
                      <option value="Kilograms">Kilograms</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      4-Point Inspection Result
                    </label>
                    <select
                      value={inspectionStatus}
                      onChange={(e) => setInspectionStatus(e.target.value as any)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                    >
                      <option value="Pending">Pending Inspection</option>
                      <option value="Approved">Approved (Pass)</option>
                      <option value="Hold">Hold / Quarantine</option>
                    </select>
                  </div>

                  {category === "Fabric" && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        4-Pt Defect Score / 100 yds
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={fourPointScore}
                        onChange={(e) => setFourPointScore(Number(e.target.value))}
                        className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGrnModal(false)}
                    className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    Confirm Goods Receipt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
