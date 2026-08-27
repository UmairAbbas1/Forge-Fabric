import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { usePermission } from "../hooks/usePermission";
import { useAuth } from "../hooks/useAuth";
import { useActiveOutsourceRecord } from "../hooks/useOutsourcing";
import { StageOutsourcingPanel } from "../components/stage/StageOutsourcingPanel";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAppData } from "../hooks/useAppData";
import {
  Layers, Plus, Search, CheckCircle2, AlertTriangle,
  X, Scissors, PackageCheck
} from "lucide-react";

export const Route = createFileRoute("/sewing")({
  head: () => ({
    meta: [
      { title: "Sewing Ticket & Line Assembly · Forge & Fabric Industries, Inc. MES" },
      { name: "description", content: "Create sewing tickets from completed cut output, track line assembly, and complete tickets to unlock the Pre-Wash QC gate." },
    ],
  }),
  component: SewingShopFloorPage,
});

interface SewingTicketRecord {
  id: string;
  ticket_number: string;
  work_order_id: string;
  wo_number: string;
  cut_ticket_id: string | null;
  style_code: string;
  colorway: string;
  size_breakdown: Record<string, number>;
  total_planned_pcs: number;
  total_actual_pcs: number;
  line_number: number;
  operator_count: number;
  status: "In_Progress" | "Completed";
  created_at: string;
  /** True for a sewing_bundles row that predates ticket-based sewing (Phase B) and has no matching sewing_tickets row — shown read-only so pre-existing production data is never hidden. */
  isLegacy?: boolean;
}

interface CutOutputBundle {
  work_order_id: string;
  style_code: string;
  colorway: string;
  size_code: string;
  bundle_qty: number;
}

function SewingShopFloorPage() {
  const canManage = usePermission("shop_floor", "update");
  const { orders } = useAppData();
  const { user } = useAuth();
  const isCustomer = user?.role === "customer";
  const [outsourceOrderId, setOutsourceOrderId] = useState("");

  const [sewingTickets, setSewingTickets] = useState<SewingTicketRecord[]>([]);
  const [cutBundles, setCutBundles] = useState<CutOutputBundle[]>([]);
  const [approvedCutOrderIds, setApprovedCutOrderIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // Real status values only — SewingTicketRecord.status is only ever "In_Progress" or "Completed".
  const [statusFilter, setStatusFilter] = useState<"ALL" | "In_Progress" | "Completed">("ALL");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create Sewing Ticket Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWoId, setSelectedWoId] = useState("");
  // REQ-15 Section 7: Sewing is stage 7 — if it's currently routed to an
  // outside vendor for the selected order, the in-house ticket form is disabled.
  const sewingOutsourceRecord = useActiveOutsourceRecord(selectedWoId, [7]);
  const [lineNumber, setLineNumber] = useState(1);
  const [operatorCount, setOperatorCount] = useState(18);
  const [plannedSizes, setPlannedSizes] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (!isRealSupabase) {
        setSewingTickets([]);
        setCutBundles([]);
        setApprovedCutOrderIds(new Set());
        return;
      }

      // 1. Which orders actually have completed, approved cut output —
      // the same precondition checkStageAdvancement(toStage=6) requires.
      // A sewing ticket can never be created for an order that hasn't
      // cleared this gate.
      const { data: cutRecords } = await supabase
        .from("cutting_records")
        .select("order_id, status, first_cut_approval_status");
      const approvedIds = new Set<string>(
        (cutRecords || [])
          .filter((c: any) => c.status === "Completed" && c.first_cut_approval_status === "Approved")
          .map((c: any) => c.order_id)
      );
      setApprovedCutOrderIds(approvedIds);

      // 2. Real cut bundle output (written by cutting.tsx) — the only
      // source for planned sewing size breakdown. Never invented.
      const { data: bndData } = await supabase
        .from("bundles")
        .select("work_order_id, style_code, colorway, size_code, size, bundle_qty, quantity");
      const bundles: CutOutputBundle[] = (bndData || []).map((b: any) => ({
        work_order_id: b.work_order_id,
        style_code: b.style_code || "",
        colorway: b.colorway || "",
        size_code: b.size_code || b.size || "",
        bundle_qty: Number(b.bundle_qty || b.quantity || 0),
      }));
      setCutBundles(bundles);

      // 3. Real sewing tickets
      const { data: ticketData } = await supabase
        .from("sewing_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      const tickets: SewingTicketRecord[] = (ticketData || []).map((t: any) => ({
        id: t.id,
        ticket_number: t.ticket_number,
        work_order_id: t.work_order_id,
        wo_number: t.wo_number || t.work_order_id,
        cut_ticket_id: t.cut_ticket_id,
        style_code: t.style_code || "",
        colorway: t.colorway || "",
        size_breakdown: t.size_breakdown && typeof t.size_breakdown === "object" ? t.size_breakdown : {},
        total_planned_pcs: Number(t.total_planned_pcs || 0),
        total_actual_pcs: Number(t.total_actual_pcs || 0),
        line_number: Number(t.line_number || 1),
        operator_count: Number(t.operator_count || 0),
        status: t.status === "Completed" ? "Completed" : "In_Progress",
        created_at: t.created_at ? t.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      }));

      // 4. Legacy sewing_bundles rows with no matching ticket — from the
      // pre-Phase-B barcode-scan flow (or seed data). Never hidden: shown
      // read-only alongside real tickets so no existing production record
      // disappears from view.
      const { data: legacyRows } = await supabase.from("sewing_bundles").select("*");
      const ticketNumbers = new Set(tickets.map((t) => t.ticket_number));
      const legacyTickets: SewingTicketRecord[] = (legacyRows || [])
        .filter((r: any) => r.bundle_id && !ticketNumbers.has(r.bundle_id))
        .map((r: any) => ({
          id: `legacy-${r.bundle_id}`,
          ticket_number: r.bundle_id,
          work_order_id: r.order_id || "",
          wo_number: r.order_id || "",
          cut_ticket_id: null,
          style_code: "",
          colorway: "",
          size_breakdown: {},
          total_planned_pcs: Number(r.qty || 0),
          total_actual_pcs: r.status === "Completed" ? Number(r.qty || 0) : 0,
          line_number: Number(r.line_number || 1),
          operator_count: Number(r.operator_count || 0),
          status: r.status === "Completed" ? "Completed" : "In_Progress",
          created_at: "",
          isLegacy: true,
        }));

      setSewingTickets([...tickets, ...legacyTickets]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Orders eligible for a new sewing ticket: real, Approved cut output
  // exists (cutting_records) AND at least one real cut bundle was issued.
  const eligibleOrders = useMemo(() => {
    return orders.filter((o) => approvedCutOrderIds.has(o.order_id) && cutBundles.some((b) => b.work_order_id === o.order_id));
  }, [orders, approvedCutOrderIds, cutBundles]);

  useEffect(() => {
    if (eligibleOrders.length > 0 && (!selectedWoId || !eligibleOrders.some((o) => o.order_id === selectedWoId))) {
      setSelectedWoId(eligibleOrders[0].order_id);
    } else if (eligibleOrders.length === 0) {
      setSelectedWoId("");
    }
  }, [eligibleOrders, selectedWoId]);

  useEffect(() => {
    if (eligibleOrders.length > 0 && (!outsourceOrderId || !eligibleOrders.some((o) => o.order_id === outsourceOrderId))) {
      setOutsourceOrderId(eligibleOrders[0].order_id);
    } else if (eligibleOrders.length === 0) {
      setOutsourceOrderId("");
    }
  }, [eligibleOrders, outsourceOrderId]);

  // Planned size breakdown pre-filled from this order's REAL cut bundle
  // output — never invented. Sum of bundle_qty grouped by size_code.
  useEffect(() => {
    if (!selectedWoId) {
      setPlannedSizes({});
      return;
    }
    const relevant = cutBundles.filter((b) => b.work_order_id === selectedWoId);
    const grouped: Record<string, number> = {};
    relevant.forEach((b) => {
      if (!b.size_code) return;
      grouped[b.size_code] = (grouped[b.size_code] || 0) + b.bundle_qty;
    });
    setPlannedSizes(grouped);
  }, [selectedWoId, cutBundles]);

  const selectedOrder = useMemo(() => orders.find((o) => o.order_id === selectedWoId), [orders, selectedWoId]);
  const selectedOrderCutStyle = useMemo(() => cutBundles.find((b) => b.work_order_id === selectedWoId), [cutBundles, selectedWoId]);

  const filteredTickets = useMemo(() => {
    return sewingTickets.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        t.ticket_number.toLowerCase().includes(q) ||
        t.wo_number.toLowerCase().includes(q) ||
        t.style_code.toLowerCase().includes(q)
      );
    });
  }, [sewingTickets, searchQuery, statusFilter]);

  const handleCreateSewingTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedWoId) {
      setFormError("Please select a Work Order with completed cut output.");
      return;
    }
    if (sewingOutsourceRecord) {
      setFormError(`Sewing for this order is outsourced to ${sewingOutsourceRecord.vendor_name}. Log the return in the order's Stage Outsourcing panel before issuing an in-house sewing ticket.`);
      return;
    }
    const totalPlanned = Object.values(plannedSizes).reduce((a, b) => a + (Number(b) || 0), 0);
    if (totalPlanned <= 0) {
      setFormError("No cut output found for this order — cannot create a sewing ticket with zero planned pieces.");
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedTicketNo = `ST-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const woLabel = selectedOrder ? (selectedOrder.PO_number || selectedOrder.order_id) : selectedWoId;
      const styleCode = selectedOrder?.style_no || selectedOrderCutStyle?.style_code || "";
      const colorway = selectedOrder?.color || selectedOrderCutStyle?.colorway || "";

      const { error: ticketErr } = await supabase.from("sewing_tickets").insert({
        ticket_number: generatedTicketNo,
        work_order_id: selectedWoId,
        wo_number: woLabel,
        style_code: styleCode,
        colorway: colorway,
        size_breakdown: plannedSizes,
        total_planned_pcs: totalPlanned,
        total_actual_pcs: 0,
        line_number: lineNumber,
        operator_count: operatorCount,
        status: "In_Progress",
      });
      if (ticketErr) throw new Error(ticketErr.message);

      // Mirror into sewing_bundles — the existing table checkStageAdvancement
      // and the DB trigger read for the stage 7/8 gates.
      const { error: sbErr } = await supabase.from("sewing_bundles").upsert({
        bundle_id: generatedTicketNo,
        order_id: selectedWoId,
        line_number: lineNumber,
        operator_count: operatorCount,
        status: "Active",
        qty: totalPlanned,
      }, { onConflict: "bundle_id" });
      if (sbErr) console.warn("sewing_bundles mirror insert warning:", sbErr.message);

      // Advance the underlying cut bundles' stage marker so they read as
      // "in sewing" rather than still sitting at post-cut (mirrors cutting.tsx's
      // own current_stage_id bump on cut completion).
      const { error: bUpdErr } = await supabase
        .from("bundles")
        .update({ current_stage_id: 7 })
        .eq("work_order_id", selectedWoId);
      if (bUpdErr) console.warn("bundles stage marker update warning:", bUpdErr.message);

      setStatusMsg({ type: "success", text: `Sewing Ticket "${generatedTicketNo}" created for ${totalPlanned} pcs.` });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create sewing ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSewingTicket = async (ticket: SewingTicketRecord) => {
    try {
      const { error: ticketErr } = await supabase
        .from("sewing_tickets")
        .update({ status: "Completed", total_actual_pcs: ticket.total_planned_pcs, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      if (ticketErr) throw new Error(ticketErr.message);

      const { error: sbErr } = await supabase
        .from("sewing_bundles")
        .update({ status: "Completed" })
        .eq("bundle_id", ticket.ticket_number);
      if (sbErr) console.warn("sewing_bundles completion update warning:", sbErr.message);

      const { error: bUpdErr } = await supabase
        .from("bundles")
        .update({ current_stage_id: 8 })
        .eq("work_order_id", ticket.work_order_id);
      if (bUpdErr) console.warn("bundles stage marker update warning:", bUpdErr.message);

      setStatusMsg({ type: "success", text: `Sewing Ticket ${ticket.ticket_number} completed — Pre-Wash QC gate now checks this order's tickets.` });
      loadData();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to complete sewing ticket." });
    }
  };

  const handleCompleteLegacyBundle = async (ticket: SewingTicketRecord) => {
    try {
      const { error } = await supabase.from("sewing_bundles").update({ status: "Completed" }).eq("bundle_id", ticket.ticket_number);
      if (error) throw new Error(error.message);
      setStatusMsg({ type: "success", text: `Legacy bundle ${ticket.ticket_number} marked Completed.` });
      loadData();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to complete legacy bundle." });
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" /> Sewing Ticket &amp; Line Assembly
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Issue sewing tickets from completed cut output and complete them to unlock the Pre-Wash QC gate.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={eligibleOrders.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={eligibleOrders.length === 0 ? "No orders have completed cut output yet" : undefined}
            >
              <Plus className="h-4 w-4" /> Create Sewing Ticket
            </button>
          )}
        </div>

        {eligibleOrders.length === 0 && !isLoading && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold flex items-center gap-2">
            <Scissors className="h-4 w-4 shrink-0" /> No orders currently have completed, approved cut output. Complete a Cut Ticket in Cutting first.
          </div>
        )}

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

        {/* Search Bar */}
        <div className="space-y-3 bg-muted/30 p-3 rounded-2xl border">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ticket number, WO number, style code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-background border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Quick Status Filter Tabs — same pill pattern as the Sample
              Requests Pipeline (SampleRequestsDashboard.tsx). */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "ALL" as const, label: `All (${sewingTickets.length})` },
              { id: "In_Progress" as const, label: `In Progress (${sewingTickets.filter((t) => t.status === "In_Progress").length})` },
              { id: "Completed" as const, label: `Completed (${sewingTickets.filter((t) => t.status === "Completed").length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sewing Tickets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
              Loading sewing tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
              No sewing tickets yet.
            </div>
          ) : filteredTickets.map((ticket) => (
            <div key={ticket.id} className="bg-card border-2 border-border hover:border-primary/50 rounded-2xl p-6 shadow-sm space-y-4 transition-all">

              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <span className="font-mono font-extrabold text-primary text-sm">{ticket.ticket_number}</span>
                  <h3 className="font-bold text-foreground text-base mt-0.5">
                    {ticket.style_code || "Legacy Bundle"}{ticket.colorway ? ` (${ticket.colorway})` : ""}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">WO Ref: {ticket.wo_number}</p>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  ticket.status === "Completed" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}>
                  {ticket.status.replace("_", " ")}
                </span>
              </div>

              {ticket.isLegacy && (
                <div className="text-[10px] text-muted-foreground italic">
                  Pre-existing record from before ticket-based sewing — shown read-only.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-muted/40 rounded-xl border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Line / Operators</span>
                  <span className="font-mono font-bold text-foreground">Line {ticket.line_number} ({ticket.operator_count} ops)</span>
                </div>
                <div className="p-2.5 bg-muted/40 rounded-xl border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Planned / Actual Pcs</span>
                  <span className="font-mono font-bold text-foreground">{ticket.total_planned_pcs} / {ticket.total_actual_pcs}</span>
                </div>
              </div>

              {Object.keys(ticket.size_breakdown).length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Size Breakdown (from Cut Ticket)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ticket.size_breakdown).map(([sz, pcs]) => (
                      <span key={sz} className="px-2 py-1 bg-background border rounded-lg text-xs font-mono font-bold text-foreground">
                        {sz}: <span className="text-primary">{pcs} pcs</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {canManage && ticket.status !== "Completed" && (
                <div className="pt-3 border-t flex justify-end">
                  <button
                    onClick={() => ticket.isLegacy ? handleCompleteLegacyBundle(ticket) : handleCompleteSewingTicket(ticket)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <PackageCheck className="h-4 w-4" /> Complete Sewing &amp; Advance
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* REQ-08/15: Stage Outsourcing, reachable directly from this portal */}
        {!isCustomer && eligibleOrders.length > 0 && (
          <div className="space-y-2">
            <div className="max-w-xs">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Outsourcing — Order</label>
              <select
                value={outsourceOrderId}
                onChange={(e) => setOutsourceOrderId(e.target.value)}
                className="w-full p-2 border rounded-lg bg-background text-sm font-semibold"
              >
                {eligibleOrders.map((o) => (
                  <option key={o.order_id} value={o.order_id}>[{o.order_id}] {o.customer_name} — {o.style_no || "N/A"}</option>
                ))}
              </select>
            </div>
            {outsourceOrderId && <StageOutsourcingPanel orderId={outsourceOrderId} filterStageNumbers={[7]} />}
          </div>
        )}

        {/* CREATE SEWING TICKET MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">

              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" /> Create Sewing Ticket
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Only orders with completed, approved cut output are eligible.
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

              <form onSubmit={handleCreateSewingTicket} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Select Work Order (Cut Output Available) <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedWoId}
                    onChange={(e) => setSelectedWoId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {eligibleOrders.length === 0 ? (
                      <option value="" disabled>No orders with completed cut output</option>
                    ) : (
                      eligibleOrders.map((o) => (
                        <option key={o.order_id} value={o.order_id}>
                          [{o.order_id}] {o.customer_name} — {o.style_no || "N/A"} ({o.qty} pcs)
                        </option>
                      ))
                    )}
                  </select>
                  {sewingOutsourceRecord && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Outsourced to {sewingOutsourceRecord.vendor_name} — in-house sewing ticket disabled until the return is logged.
                      </div>
                      <div className="text-[10px] font-medium space-y-0.5">
                        <div>
                          Qty dispatched: <span className="font-bold">{sewingOutsourceRecord.quantity_dispatched.toLocaleString()} pcs</span>
                          {sewingOutsourceRecord.dispatched_by_name && <> &bull; Dispatched by <span className="font-bold">{sewingOutsourceRecord.dispatched_by_name}</span></>}
                        </div>
                        <div>
                          Dispatched {new Date(sewingOutsourceRecord.dispatched_at).toLocaleDateString()}
                          {sewingOutsourceRecord.expected_return_at && <> &bull; Expected return {new Date(sewingOutsourceRecord.expected_return_at).toLocaleDateString()}</>}
                        </div>
                        {(sewingOutsourceRecord.vendor_status === "Returned_Partial" || sewingOutsourceRecord.vendor_status === "Returned_Complete") && (
                          <div>
                            Returned {sewingOutsourceRecord.quantity_received.toLocaleString()}/{sewingOutsourceRecord.quantity_dispatched.toLocaleString()} pcs &bull; Return QC: <span className="font-bold">{sewingOutsourceRecord.return_qc_status.replace(/_/g, " ")}</span>
                          </div>
                        )}
                      </div>
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: selectedWoId }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:underline"
                      >
                        {sewingOutsourceRecord.vendor_status === "Dispatched" || sewingOutsourceRecord.vendor_status === "In_Process"
                          ? "Log Return"
                          : "Manage Outsourcing"} &rarr;
                      </Link>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Sewing Line Number
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={lineNumber}
                      onChange={(e) => setLineNumber(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Operator Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={operatorCount}
                      onChange={(e) => setOperatorCount(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Planned Size Breakdown — read-only, pre-filled from real cut bundle data */}
                <div className="p-3 bg-muted/40 rounded-2xl border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Planned Sewing Size Breakdown ({Object.values(plannedSizes).reduce((a, b) => a + (Number(b) || 0), 0)} Total Pcs)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      From Cut Ticket Output
                    </span>
                  </div>
                  {Object.keys(plannedSizes).length === 0 ? (
                    <p className="text-[11px] text-amber-700 font-semibold">No cut bundle data found for this order.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Object.entries(plannedSizes).map(([sz, pcs]) => (
                        <div key={sz} className="p-2 bg-background rounded-xl border text-center">
                          <span className="text-[11px] font-bold text-muted-foreground block">Size {sz}</span>
                          <span className="font-mono font-bold text-foreground text-sm">{pcs}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
                    disabled={isSubmitting || !!sewingOutsourceRecord || eligibleOrders.length === 0}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    Confirm Sewing Ticket
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
