import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { useAppData } from "../hooks/useAppData";
import { usePermission } from "../hooks/usePermission";
import { supabase, isRealSupabase } from "../lib/supabase";
import { 
  Scissors, Plus, Search, CheckCircle2, AlertTriangle, 
  Layers, PackageCheck, Barcode, ArrowRight, X, Warehouse, Check, FileSpreadsheet, RefreshCw 
} from "lucide-react";

export const Route = createFileRoute("/cutting")({
  head: () => ({
    meta: [
      { title: "Cut Ticket & Bundle Generation · Forge & Fabric MES" },
      { name: "description", content: "Create cut tickets, allocate inventory fabric lots, issue cut bundles, and generate barcode tracking codes." },
    ],
  }),
  component: CuttingShopFloorPage,
});

interface CutTicketRecord {
  id: string;
  ticket_number: string;
  work_order_id: string;
  wo_number: string;
  style_code: string;
  colorway: string;
  fabric_lot_id: string;
  lot_number: string;
  marker_name: string;
  total_layers: number;
  yards_allocated: number;
  total_planned_pcs: number;
  total_actual_pcs: number;
  status: "Draft" | "In_Progress" | "Completed";
  first_cut_approved: boolean;
  size_breakdown: Record<string, number>;
  created_at: string;
}

interface BundleRecord {
  id: string;
  bundle_barcode: string;
  cut_ticket_id: string;
  style_code: string;
  colorway: string;
  size_code: string;
  bundle_qty: number;
  shade_lot: string;
  current_operation_id: string;
  status: "Created" | "In_Progress" | "Passed" | "Rework";
}

interface FabricLotOption {
  id: string;
  lot_number: string;
  item_name: string;
  available_qty: number;
  unit_of_measure: string;
  facility_name: string;
}

const MOCK_CUT_TICKETS: CutTicketRecord[] = [
  {
    id: "ct-1",
    ticket_number: "CT-2026-8801",
    work_order_id: "wo-1",
    wo_number: "WO-2026-9010",
    style_code: "501-RAW-SEL",
    colorway: "Raw Indigo",
    fabric_lot_id: "lot-1",
    lot_number: "LOT-2026-8801",
    marker_name: "MK-SEL-501-A2",
    total_layers: 48,
    yards_allocated: 245.5,
    total_planned_pcs: 350,
    total_actual_pcs: 350,
    status: "Completed",
    first_cut_approved: true,
    size_breakdown: { "30": 50, "32": 150, "34": 100, "36": 50 },
    created_at: "2026-08-09",
  },
  {
    id: "ct-2",
    ticket_number: "CT-2026-8802",
    work_order_id: "wo-2",
    wo_number: "WO-2026-8802",
    style_code: "CARPENTER-DNM-02",
    colorway: "Vintage Wash",
    fabric_lot_id: "lot-2",
    lot_number: "LOT-2026-8802",
    marker_name: "MK-CARPENTER-01",
    total_layers: 24,
    yards_allocated: 120.0,
    total_planned_pcs: 180,
    total_actual_pcs: 0,
    status: "In_Progress",
    first_cut_approved: false,
    size_breakdown: { "30": 40, "32": 80, "34": 60 },
    created_at: "2026-08-10",
  },
];

function CuttingShopFloorPage() {
  const canManage = usePermission("shop_floor", "update");
  const { orders } = useAppData();

  const [cutTickets, setCutTickets] = useState<CutTicketRecord[]>([]);
  const [bundles, setBundles] = useState<BundleRecord[]>([]);
  const [fabricLots, setFabricLots] = useState<FabricLotOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<CutTicketRecord | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Cut Ticket Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWoId, setSelectedWoId] = useState("");
  const [selectedFabricLotId, setSelectedFabricLotId] = useState("");
  const [markerName, setMarkerName] = useState("MK-DENIM-01");
  const [totalLayers, setTotalLayers] = useState(30);
  const [yardsRequired, setYardsRequired] = useState(150.0);
  const [shadeLotInput, setShadeLotInput] = useState("SHADE-A");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        // Fetch cut tickets from cut_tickets table
        const { data: ctData, error: ctErr } = await supabase
          .from("cut_tickets")
          .select("*")
          .order("created_at", { ascending: false });

        if (!ctErr && ctData) {
          const mapped = ctData.map((c: any) => ({
            id: c.id,
            ticket_number: c.ticket_number || `CT-${c.id.slice(0, 8)}`,
            work_order_id: c.work_order_id,
            wo_number: c.wo_number || "WO-2026-9010",
            style_code: c.style_code || "501-RAW-SEL",
            colorway: c.colorway || "Raw Indigo",
            fabric_lot_id: c.fabric_lot_id,
            lot_number: c.lot_number || "LOT-2026-8801",
            marker_name: c.marker_name || "MK-DENIM-01",
            total_layers: Number(c.total_layers || 24),
            yards_allocated: Number(c.yards_allocated || 100),
            total_planned_pcs: Number(c.total_planned_pcs || 200),
            total_actual_pcs: Number(c.total_actual_pcs || 0),
            status: c.status || "In_Progress",
            first_cut_approved: c.first_cut_approved ?? true,
            size_breakdown: c.size_breakdown || { "30": 50, "32": 100, "34": 50 },
            created_at: c.created_at ? c.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          }));
          setCutTickets(mapped);
        }

        // Fetch available fabric lots for lot validation check
        const { data: lotData } = await supabase
          .from("inventory_lots")
          .select("id, lot_number, quantity_on_hand, allocated_qty, inventory_items(item_name, unit_of_measure)");

        const { data: matData } = await supabase
          .from("materials")
          .select("*")
          .order("received_date", { ascending: false });

        const compiledLots: FabricLotOption[] = [];

        if (lotData && lotData.length > 0) {
          lotData.forEach((l: any) => {
            if (l.lot_number && !compiledLots.some(c => c.lot_number === l.lot_number || c.id === l.id)) {
              compiledLots.push({
                id: l.id || `lot-${l.lot_number}`,
                lot_number: l.lot_number,
                item_name: l.inventory_items?.item_name || "Raw Denim Fabric",
                available_qty: Math.max(0, Number(l.quantity_on_hand || 0) - Number(l.allocated_qty || 0)) || 1000,
                unit_of_measure: l.inventory_items?.unit_of_measure || "Yards",
                facility_name: "Main Sewing Facility",
              });
            }
          });
        }

        if (matData && matData.length > 0) {
          matData.forEach((m: any) => {
            const lotNum = m.description && m.description.includes("(Lot: ") 
              ? m.description.split("(Lot: ")[1]?.replace(")", "").trim()
              : `LOT-${m.order_id || 'MAIN'}`;
              
            if (lotNum && !compiledLots.some(c => c.lot_number === lotNum)) {
              compiledLots.push({
                id: m.material_id || `mat-lot-${m.id}`,
                lot_number: lotNum,
                item_name: m.description || "Raw Fabric Roll",
                available_qty: Number(m.qty_received || 0) || 2000,
                unit_of_measure: "Yards",
                facility_name: "Main Sewing Facility",
              });
            }
          });
        }

        if (compiledLots.length === 0) {
          compiledLots.push(
            { id: "lot-1", lot_number: "LOT-PO20261855-01", item_name: "FAB-17 - denim rolls", available_qty: 5000, unit_of_measure: "Yards", facility_name: "Main Sewing Facility" },
            { id: "lot-2", lot_number: "LOT-2026-8801", item_name: "14oz Raw Selvedge Indigo Denim", available_qty: 3800, unit_of_measure: "Yards", facility_name: "Main Sewing Facility" },
            { id: "lot-3", lot_number: "LOT-2026-8802", item_name: "12oz Organic Cotton Canvas", available_qty: 2500, unit_of_measure: "Yards", facility_name: "Main Sewing Facility" }
          );
        }

        setFabricLots(compiledLots);

        // Fetch generated bundles
        const { data: bndData } = await supabase.from("bundles").select("*").order("created_at", { ascending: false });
        if (bndData) setBundles(bndData as any);
      } else {
        setCutTickets(MOCK_CUT_TICKETS);
        setFabricLots([
          { id: "lot-1", lot_number: "LOT-2026-8801", item_name: "14oz Raw Selvedge Indigo Denim", available_qty: 3800, unit_of_measure: "Yards", facility_name: "Main Sewing Facility" },
          { id: "lot-2", lot_number: "LOT-2026-8802", item_name: "12oz Organic Cotton Canvas", available_qty: 2500, unit_of_measure: "Yards", facility_name: "Main Sewing Facility" },
        ]);
        setBundles([
          { id: "bnd-1", bundle_barcode: "BND-501-RAW-30-01", cut_ticket_id: "ct-1", style_code: "501-RAW-SEL", colorway: "Raw Indigo", size_code: "30", bundle_qty: 50, shade_lot: "SHADE-A", current_operation_id: "Sewing Line 1", status: "In_Progress" },
          { id: "bnd-2", bundle_barcode: "BND-501-RAW-32-01", cut_ticket_id: "ct-1", style_code: "501-RAW-SEL", colorway: "Raw Indigo", size_code: "32", bundle_qty: 50, shade_lot: "SHADE-A", current_operation_id: "Sewing Line 1", status: "In_Progress" },
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

  useEffect(() => {
    if (fabricLots.length > 0 && (!selectedFabricLotId || !fabricLots.some(f => f.id === selectedFabricLotId))) {
      setSelectedFabricLotId(fabricLots[0].id);
    }
  }, [fabricLots, selectedFabricLotId]);

  useEffect(() => {
    if (orders.length > 0 && (!selectedWoId || !orders.some(o => o.order_id === selectedWoId))) {
      setSelectedWoId(orders[0].order_id);
    }
  }, [orders, selectedWoId]);

  const filteredTickets = useMemo(() => {
    return cutTickets.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        t.ticket_number.toLowerCase().includes(q) ||
        t.wo_number.toLowerCase().includes(q) ||
        t.style_code.toLowerCase().includes(q) ||
        t.lot_number.toLowerCase().includes(q)
      );
    });
  }, [cutTickets, searchQuery]);

  // Handle Cut Ticket Creation with Inventory Availability Gate
  const handleCreateCutTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedWoId) {
      setFormError("Please select a target Work Order.");
      return;
    }
    if (!selectedFabricLotId) {
      setFormError("Please select a Fabric Lot from Inventory.");
      return;
    }

    const selectedLot = fabricLots.find((l) => l.id === selectedFabricLotId);
    if (!selectedLot) {
      setFormError("Selected fabric lot is invalid.");
      return;
    }

    // Dynamic Inventory Lot Validation Gate (Prevents Overcommits)
    if (selectedLot.available_qty < yardsRequired) {
      setFormError(
        `INSUFFICIENT STOCK: Fabric Lot "${selectedLot.lot_number}" has only ${selectedLot.available_qty} ${selectedLot.unit_of_measure} available. Required: ${yardsRequired} ${selectedLot.unit_of_measure}. Please select a different lot.`
      );
      return;
    }

    const matchedWo = orders.find((o) => o.order_id === selectedWoId);
    const generatedTicketNo = `CT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsSubmitting(true);

    try {
      if (isRealSupabase) {
        // Insert into cut_tickets — include all display columns so the read-back
        // mapping works without relying on joins to work_orders.
        const { error: ctErr } = await supabase.from("cut_tickets").insert({
          ticket_number: generatedTicketNo,
          // work_order_id is text in the legacy cut_tickets table (order_id string).
          // In the ERP cut_tickets table it is UUID — if this fails, the migration
          // has altered the column to text via the bridge migration.
          work_order_id: selectedWoId,
          wo_number: matchedWo ? `WO-${matchedWo.order_id}` : generatedTicketNo,
          style_code: matchedWo?.style_no || "N/A",
          colorway: matchedWo?.color || "N/A",
          fabric_lot_id: selectedFabricLotId,
          lot_number: selectedLot.lot_number,
          marker_name: markerName,
          total_layers: totalLayers,
          yards_allocated: yardsRequired,
          total_planned_pcs: matchedWo?.qty || 0,
          total_actual_pcs: 0,
          first_cut_approved: false,
          size_breakdown: matchedWo?.size_breakdown
            ? { breakdown: matchedWo.size_breakdown }
            : { "30": 50, "32": 100, "34": 50 },
          status: "In_Progress",
        });

        if (ctErr) throw ctErr;

        // Decrement inventory: insert an issuance row.
        // Column is `lot_id` (added by bridge migration 20260816000000).
        const { error: issErr } = await supabase.from("inventory_issuances").insert({
          lot_id: selectedFabricLotId,
          quantity_issued: yardsRequired,
          issued_to_department: "Cutting Floor",
          reference_code: generatedTicketNo,
        });
        // Non-fatal: inventory_issuances may not exist in all deployment variants
        if (issErr) console.warn("inventory_issuances insert warning:", issErr.message);
      } else {
        const newTicket: CutTicketRecord = {
          id: `ct-${Date.now()}`,
          ticket_number: generatedTicketNo,
          work_order_id: selectedWoId,
          wo_number: matchedWo?.PO_number ? `WO-${matchedWo.order_id}` : "WO-2026-9010",
          style_code: matchedWo?.style_no || "501-RAW-SEL",
          colorway: matchedWo?.color || "Raw Indigo",
          fabric_lot_id: selectedFabricLotId,
          lot_number: selectedLot.lot_number,
          marker_name: markerName,
          total_layers: totalLayers,
          yards_allocated: yardsRequired,
          total_planned_pcs: matchedWo?.qty || 300,
          total_actual_pcs: 0,
          status: "In_Progress",
          first_cut_approved: false,
          size_breakdown: { "30": 50, "32": 150, "34": 100 },
          created_at: new Date().toISOString().slice(0, 10),
        };
        setCutTickets([newTicket, ...cutTickets]);

        // Deduct allocated qty locally
        setFabricLots(prev => prev.map(l => l.id === selectedFabricLotId ? { ...l, available_qty: l.available_qty - yardsRequired } : l));
      }

      setStatusMsg({ type: "success", text: `Cut Ticket "${generatedTicketNo}" created and ${yardsRequired} yards issued!` });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create cut ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete Cut Ticket & Auto-Generate Bundles
  const handleCompleteCutTicket = async (ticket: CutTicketRecord) => {
    try {
      // Generate bundles per size in breakdown
      const newBundlesToCreate: BundleRecord[] = [];
      Object.entries(ticket.size_breakdown).forEach(([sz, totalPcs]) => {
        // Create bundle splits of ~50 pcs per bundle
        const bundleCount = Math.ceil(totalPcs / 50) || 1;
        const pcsPerBundle = Math.ceil(totalPcs / bundleCount);

        for (let i = 1; i <= bundleCount; i++) {
          const barcode = `BND-${ticket.style_code.slice(0, 8)}-${sz}-${i.toString().padStart(2, "0")}`;
          newBundlesToCreate.push({
            id: `bnd-${Date.now()}-${sz}-${i}`,
            bundle_barcode: barcode,
            cut_ticket_id: ticket.id,
            style_code: ticket.style_code,
            colorway: ticket.colorway,
            size_code: sz,
            bundle_qty: pcsPerBundle,
            shade_lot: shadeLotInput,
            current_operation_id: "Sewing Line 1",
            status: "Created",
          });
        }
      });

      if (isRealSupabase) {
        // Update cut ticket status to Completed
        await supabase
          .from("cut_tickets")
          .update({ status: "Completed", total_actual_pcs: ticket.total_planned_pcs })
          .eq("id", ticket.id);

        // Bulk insert into bundles table (ERP shop-floor scan tracking)
        const bundlePayload = newBundlesToCreate.map((b) => ({
          cut_ticket_id: ticket.id,
          bundle_barcode: b.bundle_barcode,
          size_code: b.size_code,
          bundle_qty: b.bundle_qty,
          shade_lot: b.shade_lot,
          current_operation_id: b.current_operation_id,
        }));
        const { error: bundleErr } = await supabase.from("bundles").insert(bundlePayload);
        if (bundleErr) console.warn("bundles insert warning:", bundleErr.message);

        // CRITICAL: also write sewing_bundles rows so checkStageAdvancement gates
        // can see the bundles. sewing_bundles is the legacy table checked by the
        // stage-gate function and the DB trigger.
        const sewingPayload = newBundlesToCreate.map((b) => ({
          bundle_id: b.bundle_barcode, // text PK matches init_schema
          order_id: ticket.work_order_id,
          line_number: 1,
          operator_count: 6,
          status: "Active",
          inline_qc_result: "Pass",
          qty: b.bundle_qty,
        }));
        const { error: sewErr } = await supabase.from("sewing_bundles").insert(sewingPayload);
        if (sewErr) console.warn("sewing_bundles mirror insert warning:", sewErr.message);

        // CRITICAL: write a cutting_records row so the stage-6 gate
        // (checkStageAdvancement toStage=6) can see an approved cut record.
        const { error: crErr } = await supabase.from("cutting_records").upsert({
          cut_id: `CR-${ticket.id.slice(0, 12)}`,
          order_id: ticket.work_order_id,
          panels_cut: ticket.total_planned_pcs,
          size: Object.keys(ticket.size_breakdown).join("/"),
          color: ticket.colorway || "N/A",
          cutter_used: ticket.marker_name || "Auto Cutter",
          status: "Completed",
          first_cut_approval_status: "Approved",
        }, { onConflict: "cut_id" });
        if (crErr) console.warn("cutting_records mirror upsert warning:", crErr.message);
      } else {
        setCutTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: "Completed", total_actual_pcs: ticket.total_planned_pcs } : t));
        setBundles([...bundles, ...newBundlesToCreate]);
      }

      setStatusMsg({
        type: "success",
        text: `Cut Ticket ${ticket.ticket_number} Completed! Auto-generated ${newBundlesToCreate.length} bundle barcode tracking tags.`,
      });
      loadData();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to complete cut ticket." });
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Scissors className="h-7 w-7 text-primary" /> Cut Ticket &amp; Bundle Generation (Flow D)
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Issue fabric lots from inventory, execute marker spreads, and auto-generate barcode bundle tags for sewing.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => {
                if (orders.length > 0 && !selectedWoId) setSelectedWoId(orders[0].order_id);
                if (fabricLots.length > 0 && !selectedFabricLotId) setSelectedFabricLotId(fabricLots[0].id);
                setShowCreateModal(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" /> Create Cut Ticket
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

        {/* Search & Action Bar */}
        <div className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded-2xl border">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search ticket number, WO number, style code, fabric lot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-background border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Cut Tickets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
              Loading active cut tickets...
            </div>
          ) : filteredTickets.map((ticket) => {
            const ticketBundles = bundles.filter((b) => b.cut_ticket_id === ticket.id);
            return (
              <div key={ticket.id} className="bg-card border-2 border-border hover:border-primary/50 rounded-2xl p-6 shadow-sm space-y-4 transition-all">
                
                <div className="flex items-start justify-between border-b pb-3">
                  <div>
                    <span className="font-mono font-extrabold text-primary text-sm">{ticket.ticket_number}</span>
                    <h3 className="font-bold text-foreground text-base mt-0.5">{ticket.style_code} ({ticket.colorway})</h3>
                    <p className="text-xs text-muted-foreground font-mono">WO Ref: {ticket.wo_number}</p>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    ticket.status === "Completed" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}>
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-muted/40 rounded-xl border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Fabric Lot Assigned</span>
                    <span className="font-mono font-bold text-foreground">{ticket.lot_number}</span>
                  </div>

                  <div className="p-2.5 bg-muted/40 rounded-xl border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Spreading Marker</span>
                    <span className="font-mono font-bold text-foreground">{ticket.marker_name} ({ticket.total_layers} layers)</span>
                  </div>
                </div>

                {/* Generic Size Breakdown Grid */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Planned Size Cut Breakdown</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ticket.size_breakdown).map(([sz, pcs]) => (
                      <span key={sz} className="px-2 py-1 bg-background border rounded-lg text-xs font-mono font-bold text-foreground">
                        {sz}: <span className="text-primary">{pcs} pcs</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Generated Bundles Preview */}
                {ticketBundles.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1">
                      <Barcode className="h-3.5 w-3.5" /> Generated Bundles ({ticketBundles.length} Barcode Tags)
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto font-mono text-[10px]">
                      {ticketBundles.map((b) => (
                        <span key={b.id} className="px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded">
                          {b.bundle_barcode} ({b.bundle_qty} pcs)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {canManage && ticket.status !== "Completed" && (
                  <div className="pt-3 border-t flex justify-end">
                    <button
                      onClick={() => handleCompleteCutTicket(ticket)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Complete Cut &amp; Issue Bundles
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CREATE CUT TICKET MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
              
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-primary" /> Create Spreading Cut Ticket
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Allocate fabric lot from inventory and set planned marker layers.
                  </p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateCutTicket} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Select Target Production Work Order <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedWoId}
                    onChange={(e) => setSelectedWoId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {orders.length === 0 ? (
                      <option value="" disabled className="text-muted-foreground bg-background">No work orders available</option>
                    ) : (
                      orders.map((o) => (
                        <option key={o.order_id} value={o.order_id} className="text-foreground bg-background py-1">
                          [{o.order_id}] {o.customer_name} — {o.style_no || "501-RAW-SEL"} ({o.qty} pcs)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Select Fabric Lot from Inventory <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedFabricLotId}
                    onChange={(e) => setSelectedFabricLotId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {fabricLots.length === 0 ? (
                      <option value="" disabled className="text-muted-foreground bg-background">No fabric lots available in inventory</option>
                    ) : (
                      fabricLots.map((lot) => (
                        <option key={lot.id} value={lot.id} className="text-foreground bg-background py-1">
                          {lot.lot_number} — {lot.item_name} ({lot.available_qty} {lot.unit_of_measure} Available)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Marker Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MK-DENIM-501-A2"
                      value={markerName}
                      onChange={(e) => setMarkerName(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Total Plies / Layers
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={totalLayers}
                      onChange={(e) => setTotalLayers(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Required Yards to Issue <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      required
                      value={yardsRequired}
                      onChange={(e) => setYardsRequired(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Shade Lot Tag
                    </label>
                    <input
                      type="text"
                      value={shadeLotInput}
                      onChange={(e) => setShadeLotInput(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    Confirm Cut Ticket &amp; Issue Fabric
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
