import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { usePermission } from "../hooks/usePermission";
import { useSubmissions } from "../hooks/merchandiser/useSubmissions";
import { supabase, isRealSupabase } from "../lib/supabase";
import { 
  PackageOpen, Plus, Search, Filter, CheckCircle2, 
  AlertTriangle, ShieldCheck, Truck, ClipboardList, Layers, ArrowRight, X, Building2 
} from "lucide-react";

export const Route = createFileRoute("/materials")({
  head: () => ({
    meta: [
      { title: "Material Receiving & GRN Log · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Receive and log raw fabric rolls, trim stock, and accessories by PO Number and Lot Number for Quality Inspection." },
    ],
  }),
  component: MaterialReceivingPage,
});

export interface MaterialReceiptRecord {
  id: string;
  po_number: string;
  brand_name: string;
  item_code: string;
  item_name: string;
  category: "Fabric" | "Trim" | "Packaging" | "Chemical";
  lot_number: string;
  facility_name: string;
  qty_received: number;
  unit_of_measure: string;
  inspection_status: "Pending" | "Approved" | "Hold";
  received_date: string;
}

export function MaterialReceivingPage() {
  const { user } = useAuth();
  const { orders, materials, addMaterial, updateMaterialInspection, updateOrder } = useAppData();
  const { submissions } = useSubmissions();

  // Role Access: Admin, Merchandiser, and Production can log incoming goods
  const canManage = useMemo(() => {
    if (!user) return false;
    const role = user.role?.toLowerCase() || "";
    return (
      role === "admin" ||
      role === "super_admin" ||
      role === "merchandiser" ||
      role === "production" ||
      role === "production_manager" ||
      role === "warehouse"
    );
  }, [user]);

  // REQ-02: Only the designated facility Warehouse Manager (or Admin/Super Admin)
  // may sign off on Material Receiving approval. This must match the same gate
  // enforced in inventory.tsx — this GRN log writes to the same inspection_status
  // field that cutting.tsx trusts for the floor lockout, so an ungated approval
  // here would silently bypass that lockout.
  const canApproveReceiving = useMemo(() => {
    if (!user) return false;
    const role = user.role?.toLowerCase() || "";
    return role === "admin" || role === "super_admin" || role === "warehouse";
  }, [user]);

  const [receipts, setReceipts] = useState<MaterialReceiptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryTab, setCategoryTab] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // GRN Modal State
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [customPoNumber, setCustomPoNumber] = useState("");
  const [selectedLot, setSelectedLot] = useState("");
  const [customLotNumber, setCustomLotNumber] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<"Fabric" | "Trim" | "Packaging" | "Chemical">("Fabric");
  const [facilityName, setFacilityName] = useState("Main Sewing Facility");
  const [qtyReceived, setQtyReceived] = useState<string>("");
  const [uom, setUom] = useState("Yards");
  const [inspectionStatus, setInspectionStatus] = useState<"Pending" | "Approved" | "Hold">("Pending");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [backendPoList, setBackendPoList] = useState<{ po_number: string; brand: string; style: string }[]>([]);

  // Automatically query all active POs directly from Supabase tables on mount
  useEffect(() => {
    const fetchBackendPOs = async () => {
      try {
        const { data: pos } = await supabase.from("purchase_orders").select("po_number, notes");
        const { data: subs } = await supabase.from("apply_submissions").select("apply_reference_code, existing_order_reference, company_name, product_type");
        
        const list: { po_number: string; brand: string; style: string }[] = [];
        
        if (pos) {
          pos.forEach((p: any) => {
            if (p.po_number && !list.some((l) => l.po_number === p.po_number)) {
              list.push({ po_number: p.po_number, brand: "Purchase Order", style: "Bulk Order" });
            }
          });
        }
        
        if (subs) {
          subs.forEach((s: any) => {
            const ref = s.apply_reference_code || s.existing_order_reference;
            if (ref && !list.some((l) => l.po_number === ref)) {
              list.push({ po_number: ref, brand: s.company_name || "Intake Brand", style: s.product_type || "Custom Apparel" });
            }
          });
        }
        setBackendPoList(list);
      } catch (err) {
        console.warn("Could not fetch backend POs for materials:", err);
      }
    };

    fetchBackendPOs();
  }, []);

  // PO Options list dynamically compiled from backend POs, orders & submissions
  const poOptions = useMemo(() => {
    const list: { po_number: string; brand: string; style: string }[] = [...backendPoList];
    
    orders.forEach((o) => {
      if (o.PO_number && !list.some(l => l.po_number === o.PO_number)) {
        list.push({
          po_number: o.PO_number,
          brand: o.customer_name || "Partner Brand",
          style: o.style_no || "Denim Style",
        });
      }
    });

    if (submissions && submissions.length > 0) {
      submissions.forEach((s) => {
        const ref = s.apply_reference_code || s.existing_order_reference || `APP-${s.id.substring(0, 6)}`;
        if (!list.some(l => l.po_number === ref)) {
          list.push({
            po_number: ref,
            brand: s.company_name || "Intake Brand",
            style: s.product_type || "Custom Apparel",
          });
        }
      });
    }

    // Default sample fallback POs if list is empty
    if (list.length === 0) {
      list.push(
        { po_number: "PO-2026-6083", brand: "Levi Strauss & Co.", style: "501 Selvedge Raw Denim" },
        { po_number: "PO-2026-5089", brand: "H&M Group", style: "Fleece Heavyweight Hoodie" },
        { po_number: "PO-2026-6972", brand: "Uniqlo Global", style: "Organic Crewneck Tee" }
      );
    }

    return list;
  }, [backendPoList, orders, submissions]);

  // Selected PO object metadata
  const selectedPoObject = useMemo(() => {
    const activePo = poNumber === "__custom__" ? customPoNumber : poNumber;
    return poOptions.find(p => p.po_number === activePo);
  }, [poNumber, customPoNumber, poOptions]);

  // Auto-linked Lot Numbers based on selected PO Number
  const autoLinkedLotOptions = useMemo(() => {
    const activePo = poNumber === "__custom__" ? customPoNumber : poNumber;
    if (!activePo) return [];

    const cleanPo = activePo.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return [
      `LOT-${cleanPo}-01`,
      `LOT-${cleanPo}-02`,
      `LOT-${cleanPo}-03`,
      `LOT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    ];
  }, [poNumber, customPoNumber]);

  // Reset form inputs to blank default state
  const resetFormState = () => {
    setPoNumber("");
    setCustomPoNumber("");
    setSelectedLot("");
    setCustomLotNumber("");
    setItemCode("");
    setItemName("");
    setCategory("Fabric");
    setFacilityName("Main Sewing Facility");
    setQtyReceived("");
    setUom("Yards");
    setInspectionStatus("Pending");
    setFormError("");
  };

  const handleOpenGrnModal = () => {
    resetFormState();
    setShowGrnModal(true);
  };

  // Load Material Receipts from Supabase & app state
  const loadReceipts = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        const { data, error } = await supabase
          .from("materials")
          .select("*")
          .order("received_date", { ascending: false });

        if (!error && data) {
          const mapped: MaterialReceiptRecord[] = data.map((m: any) => ({
            id: m.material_id || m.id,
            po_number: m.order_id || "PO-GENERAL",
            brand_name: "Brand Partner",
            item_code: m.description ? m.description.split(" - ")[0] || "MAT-ITEM" : "MAT-ITEM",
            item_name: m.description || "Raw Material",
            category: (m.type || "Fabric") as any,
            lot_number: m.description && m.description.includes("(Lot: ") 
              ? m.description.split("(Lot: ")[1]?.replace(")", "") 
              : "LOT-2026-MAIN",
            facility_name: "Main Sewing Facility",
            qty_received: Number(m.qty_received || 0),
            unit_of_measure: "Yards",
            inspection_status: m.inspection_status || "Pending",
            received_date: m.received_date ? m.received_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          }));
          setReceipts(mapped);
        }
      } else {
        // Mock State Mapping
        const mapped: MaterialReceiptRecord[] = materials.map((m) => ({
          id: m.material_id,
          po_number: m.order_id,
          brand_name: "Brand Partner",
          item_code: m.description.split(" - ")[0] || "MAT-ITEM",
          item_name: m.description,
          category: (m.type || "Fabric") as any,
          lot_number: m.description.includes("Lot:") ? m.description.split("Lot:")[1]?.trim() : "LOT-2026-8801",
          facility_name: "Main Sewing Facility",
          qty_received: m.qty_received,
          unit_of_measure: "Yards",
          inspection_status: m.inspection_status,
          received_date: m.received_date,
        }));
        setReceipts(mapped);
      }
    } catch (err) {
      console.error("Failed to load material receipts", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();

    if (isRealSupabase) {
      const channel = supabase
        .channel("materials_realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "materials" },
          () => {
            loadReceipts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [materials]);

  // Submit Goods Receipt Note (GRN)
  const handleGrnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // REQ-02 defense-in-depth: the "Initial QC Status" select is disabled for
    // non-approvers, but clamp here too in case state was set before a role
    // change or via a non-UI path — new receipts from non-warehouse/admin
    // staff always land as Pending, never pre-approved.
    if (inspectionStatus === "Approved" && !canApproveReceiving) {
      setInspectionStatus("Pending");
      setFormError("Only the facility Warehouse Manager or Admin can log a receipt as pre-approved. Logged as Pending instead — please submit again.");
      return;
    }

    const activePo = poNumber === "__custom__" ? customPoNumber.trim().toUpperCase() : poNumber.trim();
    if (!activePo) {
      setFormError("Please select or enter a PO Number.");
      return;
    }

    const finalLot = selectedLot === "__custom__" || !selectedLot 
      ? customLotNumber.trim().toUpperCase() 
      : selectedLot.trim().toUpperCase();

    if (!finalLot) {
      setFormError("Please select or enter a Lot Number.");
      return;
    }

    if (!itemCode.trim()) {
      setFormError("Item Code is required.");
      return;
    }

    if (!itemName.trim()) {
      setFormError("Item Description is required.");
      return;
    }

    const numericQty = Number(qtyReceived);
    if (!numericQty || numericQty <= 0) {
      setFormError("Quantity received must be a positive number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const descriptionString = `${itemCode.trim().toUpperCase()} - ${itemName.trim()} (Lot: ${finalLot})`;
      const todayDate = new Date().toISOString().slice(0, 10);
      const newMaterialId = `mat-${Date.now()}`;

      if (isRealSupabase) {
        // 0. Auto-ensure parent order record exists so foreign key constraints are satisfied
        let resolvedOrderId = activePo;
        try {
          const { data: ord } = await supabase
            .from("orders")
            .select("order_id")
            .or(`order_id.eq.${activePo},po_number.eq.${activePo}`)
            .maybeSingle();

          if (ord?.order_id) {
            resolvedOrderId = ord.order_id;
          } else {
            await supabase.from("orders").upsert(
              {
                order_id: activePo,
                customer_name: selectedPoObject?.brand || "Brand Partner",
                po_number: activePo,
                tech_pack_ref: `TP-${activePo.replace(/[^a-zA-Z0-9]/g, "-").toUpperCase()}`,
                size_breakdown: "Standard Matrix",
                status: "Open",
                created_date: todayDate,
                current_stage: 3,
                qty: numericQty || 1000,
              },
              { onConflict: "order_id" }
            );
          }
        } catch (poCheckErr) {
          console.warn("Order check fallback:", poCheckErr);
        }

        // 1. Insert into Supabase `materials` table (real-time feeding Quality Control Stage 3)
        const { error: matErr } = await supabase.from("materials").insert({
          material_id: newMaterialId,
          order_id: resolvedOrderId,
          type: category === "Fabric" ? "Fabric" : (category === "Trim" ? "Trim" : "Accessory"),
          description: descriptionString,
          qty_received: numericQty,
          inspection_status: inspectionStatus,
          received_date: todayDate,
        });

        if (matErr) throw matErr;

        // 2. Insert into Supabase `inventory_lots` table (real-time feeding Inventory Hub)
        const { data: existingItem } = await supabase
          .from("inventory_items")
          .select("id")
          .eq("item_code", itemCode.trim().toUpperCase())
          .maybeSingle();

        let masterItemId = existingItem?.id;
        if (!masterItemId) {
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
          if (!itemErr && newItem) masterItemId = newItem.id;
        }

        if (masterItemId) {
          await supabase.from("inventory_lots").insert({
            item_id: masterItemId,
            lot_number: finalLot,
            quantity_on_hand: numericQty,
            allocated_qty: 0,
            inspection_status: inspectionStatus,
          });
        }
      }

      // Add to AppData state for real-time immediate reactivity across all tabs
      addMaterial({
        material_id: newMaterialId,
        order_id: activePo,
        type: category === "Fabric" ? "Fabric" : (category === "Trim" ? "Trim" : "Accessory"),
        description: descriptionString,
        qty_received: numericQty,
        inspection_status: inspectionStatus,
        received_date: todayDate,
      });

      setStatusMsg({
        type: "success",
        text: `Goods Receipt Note (GRN) for PO "${activePo}" / Lot "${finalLot}" logged successfully!`,
      });
      setShowGrnModal(false);
      resetFormState();
      loadReceipts();
    } catch (err: any) {
      setFormError(err.message || "Failed to log material receipt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update QC Inspection Status directly from table with cross-pipeline sync
  //
  // REQ-02: Only the facility Warehouse Manager (or Admin/Super Admin) may
  // release a lot to "Approved" — this must mirror the gate in inventory.tsx,
  // since cutting.tsx's fabric-lot lockout reads inspection_status from BOTH
  // this `materials` table and `inventory_lots`, so an ungated approval here
  // would silently unlock a quarantined roll for cutting.
  const handleUpdateInspectionStatus = async (
    receipt: MaterialReceiptRecord,
    newStatus: "Pending" | "Approved" | "Hold"
  ) => {
    if (newStatus === "Approved" && !canApproveReceiving) {
      setStatusMsg({
        type: "error",
        text: "Only the facility Warehouse Manager or Admin can approve & release material to production.",
      });
      return;
    }

    try {
      // 1. Optimistic UI update
      setReceipts((prev) =>
        prev.map((r) => (r.id === receipt.id ? { ...r, inspection_status: newStatus } : r))
      );

      // 2. Update via useAppData for local React Query cache
      updateMaterialInspection(receipt.id, newStatus);

      // 3. Backend persistence & cross-pipeline orchestration
      if (isRealSupabase) {
        // Update materials table
        try {
          await supabase
            .from("materials")
            .update({ inspection_status: newStatus })
            .or(`material_id.eq.${receipt.id},id.eq.${receipt.id}`);
        } catch (matErr) {
          console.warn("materials update error:", matErr);
        }

        // Update inventory_lots qc_status
        const lotStatus = newStatus === "Approved" ? "Approved" : newStatus === "Hold" ? "Quarantined" : "Pending";
        try {
          await supabase
            .from("inventory_lots")
            .update({ qc_status: lotStatus })
            .eq("lot_number", receipt.lot_number);
        } catch (lotErr) {
          console.warn("inventory_lots update error:", lotErr);
        }

        // Write to qc_records table for stage gate checks
        try {
          const qcRecordId = `QCR-MAT-${receipt.po_number}-${Date.now()}`;
          await supabase.from("qc_records").insert({
            qc_id: qcRecordId,
            order_id: receipt.po_number,
            stage_checkpoint: "Raw Material QC",
            result: newStatus === "Approved" ? "Pass" : newStatus === "Hold" ? "Reject" : "Hold",
            inspected_qty: receipt.qty_received,
            pass_qty: newStatus === "Approved" ? receipt.qty_received : 0,
            reject_qty: newStatus === "Hold" ? receipt.qty_received : 0,
            inspected_date: new Date().toISOString().slice(0, 10),
          });
        } catch (qcErr) {
          console.warn("qc_records write error:", qcErr);
        }

        // Advance order to Stage 4 (Approved for Production) if marked Approved
        if (newStatus === "Approved") {
          const matchedOrder = orders.find(
            (o) => o.order_id === receipt.po_number || o.PO_number === receipt.po_number
          );
          if (matchedOrder && matchedOrder.current_stage <= 3) {
            updateOrder(matchedOrder.order_id, { current_stage: 4 });
            try {
              await supabase
                .from("orders")
                .update({ current_stage: 4 })
                .eq("order_id", matchedOrder.order_id);
            } catch (ordErr) {
              console.warn("orders current_stage update error:", ordErr);
            }
          }
        }
      } else {
        // Mock mode: update linked order stage if approved
        if (newStatus === "Approved") {
          const matchedOrder = orders.find(
            (o) => o.order_id === receipt.po_number || o.PO_number === receipt.po_number
          );
          if (matchedOrder && matchedOrder.current_stage <= 3) {
            updateOrder(matchedOrder.order_id, { current_stage: 4 });
          }
        }
      }

      const outcomeMessage =
        newStatus === "Approved"
          ? `Lot "${receipt.lot_number}" (${receipt.po_number}) APPROVED! Ready for production cut table allocation. Linked order advanced to Stage 4 on Kanban.`
          : newStatus === "Hold"
          ? `Lot "${receipt.lot_number}" (${receipt.po_number}) placed ON HOLD / QUARANTINE. Production allocation is blocked pending supplier review.`
          : `Lot "${receipt.lot_number}" (${receipt.po_number}) set to Pending Inspection.`;

      setStatusMsg({
        type: newStatus === "Hold" ? "error" : "success",
        text: outcomeMessage,
      });
    } catch (err: any) {
      console.error("Error updating QC inspection status:", err);
      setStatusMsg({
        type: "error",
        text: `Failed to update QC status: ${err.message || "Unknown error"}`,
      });
    }
  };

  // Filtered Material Receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.po_number.toLowerCase().includes(q) ||
        r.item_code.toLowerCase().includes(q) ||
        r.item_name.toLowerCase().includes(q) ||
        r.lot_number.toLowerCase().includes(q);

      const matchCat = categoryTab === "All" || r.category === categoryTab;
      const matchStatus = statusFilter === "All" || r.inspection_status === statusFilter;

      return matchSearch && matchCat && matchStatus;
    });
  }, [receipts, searchQuery, categoryTab, statusFilter]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <PackageOpen className="h-7 w-7 text-primary" /> Material Receiving &amp; GRN Log
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Log incoming raw goods by PO &amp; Lot Number. Manage quality inspection approvals to release lots for production cutting.
            </p>
          </div>

          {canManage && (
            <button
              onClick={handleOpenGrnModal}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
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
            <button onClick={() => setStatusMsg(null)} className="cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card border-2 border-border p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Received Lots</span>
            <div className="text-2xl font-black font-mono text-foreground">{receipts.length} Lots</div>
            <p className="text-[11px] text-muted-foreground">Logged GRNs in database</p>
          </div>

          <div className="bg-card border-2 border-amber-200 bg-amber-50/30 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Pending QC Inspection</span>
            <div className="text-2xl font-black font-mono text-amber-700">
              {receipts.filter(r => r.inspection_status === "Pending").length} Lots
            </div>
            <p className="text-[11px] text-amber-800 font-medium">Awaiting Quality Audit</p>
          </div>

          <div className="bg-card border-2 border-emerald-200 bg-emerald-50/30 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Approved for Production</span>
            <div className="text-2xl font-black font-mono text-emerald-700">
              {receipts.filter(r => r.inspection_status === "Approved").length} Lots
            </div>
            <p className="text-[11px] text-emerald-800 font-medium">Ready for Cut Table Allocation</p>
          </div>

          <div className="bg-card border-2 border-red-200 bg-red-50/30 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-800">On Hold / Quarantined</span>
            <div className="text-2xl font-black font-mono text-red-700">
              {receipts.filter(r => r.inspection_status === "Hold").length} Lots
            </div>
            <p className="text-[11px] text-red-800 font-medium">Blocked from Production</p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="space-y-3">
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

          <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-2xl border">
            <div className="relative flex-1 w-full">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search PO Number, Item Code, Lot Number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-background border rounded-lg text-sm"
              />
            </div>

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
                <option value="Pending">Pending Inspection</option>
                <option value="Approved">Approved (Pass)</option>
                <option value="Hold">Hold / Quarantine</option>
              </select>
            </div>
          </div>
        </div>

        {/* Material Receipts Table */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="p-3">PO Number</th>
                  <th className="p-3">Item Details</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Lot Number</th>
                  <th className="p-3">Qty Received</th>
                  <th className="p-3">QC Inspection Status &amp; Action</th>
                  <th className="p-3">Received Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                      Loading material receipt logs...
                    </td>
                  </tr>
                ) : filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                      No material receipt records found. Click <strong>"Receive Material (GRN)"</strong> to log incoming goods.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-foreground">{r.po_number}</td>
                      <td className="p-3">
                        <div className="font-bold text-foreground">{r.item_name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{r.item_code}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-secondary text-secondary-foreground">
                          {r.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-primary">{r.lot_number}</td>
                      <td className="p-3 font-mono font-extrabold text-foreground">
                        {r.qty_received.toLocaleString()} {r.unit_of_measure}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={r.inspection_status}
                            onChange={(e) => handleUpdateInspectionStatus(r, e.target.value as any)}
                            disabled={!canManage}
                            className={`px-2.5 py-1 rounded-full font-black text-[10px] border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                              r.inspection_status === "Approved"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200"
                                : r.inspection_status === "Hold"
                                ? "bg-red-100 text-red-900 border-red-300 hover:bg-red-200"
                                : "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                            }`}
                          >
                            <option value="Pending">⏳ Pending Inspection</option>
                            <option value="Approved" disabled={!canApproveReceiving}>
                              {canApproveReceiving ? "✓ Approved (Pass to Production)" : "✓ Approved (Warehouse/Admin only)"}
                            </option>
                            <option value="Hold">✕ Hold / Rejected (Quarantine)</option>
                          </select>

                          {canManage && r.inspection_status === "Pending" && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleUpdateInspectionStatus(r, "Approved")}
                                disabled={!canApproveReceiving}
                                title={canApproveReceiving ? "Approve lot for production" : "Only the facility Warehouse Manager or Admin can approve"}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleUpdateInspectionStatus(r, "Hold")}
                                title="Reject lot / Place on Hold"
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                              >
                                <AlertTriangle className="h-3 w-3" /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">{r.received_date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Receive Material (GRN) Modal */}
        {showGrnModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-card border-2 border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6 animate-in fade-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <PackageOpen className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-black text-foreground">Receive Material (Goods Receipt Note)</h3>
                </div>
                <button onClick={() => setShowGrnModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleGrnSubmit} className="space-y-4">
                
                {/* 1. PO Number Selection (TOP Field) */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    PO Number <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={poNumber}
                    onChange={(e) => {
                      setPoNumber(e.target.value);
                      setSelectedLot("");
                    }}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                  >
                    <option value="">Select PO Number (e.g. PO-2026-6083 / APP-2026-8842)</option>
                    {poOptions.map((p) => (
                      <option key={p.po_number} value={p.po_number}>
                        {p.po_number} — {p.brand} ({p.style})
                      </option>
                    ))}
                    <option value="__custom__">+ Enter Custom PO Number...</option>
                  </select>

                  {poNumber === "__custom__" && (
                    <input
                      type="text"
                      required
                      placeholder="e.g. PO-2026-9901"
                      value={customPoNumber}
                      onChange={(e) => setCustomPoNumber(e.target.value.toUpperCase())}
                      className="w-full mt-2 p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                    />
                  )}
                </div>

                {/* 2. Auto-linked Lot Number Dropdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Lot Number <span className="text-red-500">*</span>
                    </label>
                    {autoLinkedLotOptions.length > 0 && poNumber !== "" ? (
                      <select
                        value={selectedLot}
                        onChange={(e) => setSelectedLot(e.target.value)}
                        className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                      >
                        <option value="">Select Auto-Linked Lot...</option>
                        {autoLinkedLotOptions.map((lot) => (
                          <option key={lot} value={lot}>{lot}</option>
                        ))}
                        <option value="__custom__">+ Enter New Custom Lot...</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. LOT-2026-1097"
                        value={customLotNumber}
                        onChange={(e) => setCustomLotNumber(e.target.value.toUpperCase())}
                        className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                      />
                    )}

                    {(selectedLot === "__custom__" && autoLinkedLotOptions.length > 0) && (
                      <input
                        type="text"
                        required
                        placeholder="e.g. LOT-2026-1097"
                        value={customLotNumber}
                        onChange={(e) => setCustomLotNumber(e.target.value.toUpperCase())}
                        className="w-full mt-2 p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                      />
                    )}
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

                {/* 3. Item Code & Item Description (Starts BLANK) */}
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
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
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
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-medium"
                    />
                  </div>
                </div>

                {/* 4. Quantity Received & Unit of Measure */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Quantity Received <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 1000"
                      value={qtyReceived}
                      onChange={(e) => setQtyReceived(e.target.value)}
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
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                    >
                      <option value="Yards">Yards</option>
                      <option value="Meters">Meters</option>
                      <option value="Pieces">Pieces</option>
                      <option value="Liters">Liters</option>
                      <option value="Kilograms">Kilograms</option>
                    </select>
                  </div>
                </div>

                {/* 5. Receiving Facility & Initial QC Inspection Status */}
                <div className="grid grid-cols-2 gap-4">
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

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Initial QC Status
                    </label>
                    <select
                      value={inspectionStatus}
                      onChange={(e) => setInspectionStatus(e.target.value as any)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                    >
                      <option value="Pending">Pending QC Inspection</option>
                      <option value="Approved" disabled={!canApproveReceiving}>
                        {canApproveReceiving ? "Approved (Pass)" : "Approved (Warehouse/Admin only)"}
                      </option>
                      <option value="Hold">Hold / Quarantine</option>
                    </select>
                    {!canApproveReceiving && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        New receipts log as Pending — only the Warehouse Manager or Admin can release material to production.
                      </p>
                    )}
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="pt-4 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGrnModal(false)}
                    className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isSubmitting ? "Logging GRN..." : "Confirm Goods Receipt (GRN)"}
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
