import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, SectionCard, StatusBadge, ProgressBar } from "../components/AppShell";
import { useAppData, checkStageAdvancement } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { useStageJumpLogs } from "../hooks/useStageJumpLogs";
import { StageNavigator } from "../components/stage/StageNavigator";
import { StageJumpHistory } from "../components/stage/StageJumpHistory";
import { StageOutsourcingPanel } from "../components/stage/StageOutsourcingPanel";
import { WoSplitterModal } from "../components/mes/WoSplitterModal";
import { STAGES, type Order } from "../lib/mockData";
import { supabase, isRealSupabase } from "../lib/supabase";
import { cn, formatSizeBreakdown, parseSizeBreakdown, serializeSizeBreakdown, getNextSelectedStage } from "../lib/utils";
import { getStageFriendlyName } from "../lib/outsourcing-constants";
import { usePermission } from "../hooks/usePermission";
import { Badge } from "../components/ui/badge";
import {
  ClipboardList, ArrowLeft, Calendar, FileText, CheckCircle,
  Play, Circle, Save, ShieldAlert, Award, FileEdit, AlertTriangle, Plus, X,
  UploadCloud, Download, Lock
} from "lucide-react";
import {
  validateQCCheckpointEligibility,
  validateQCQuantities,
  QC_PIPELINE_STAGES,
  type QCGateCheckpoint,
} from "../lib/qcGateValidation";

// Maps an apply_submissions row into an Order-shaped object for display —
// mirrors the same preview mapping orders.tsx uses for its list rows, so a
// submission's own reference-code deep link (before it's converted into a
// real orders row, or if it never is) doesn't 404 on this detail page.
function mapSubmissionToOrder(sub: any): Order {
  const refCode = sub.apply_reference_code || `APP-${String(sub.id).substring(0, 6)}`;
  const blocks = Array.isArray(sub.style_blocks) ? sub.style_blocks : [];
  let computedQty = Number(sub.estimated_quantity) || 0;
  let breakdownList: string[] = [];

  if (sub.size_breakdown && typeof sub.size_breakdown === "object") {
    const entries = Object.entries(sub.size_breakdown).filter(([, q]) => Number(q) > 0);
    if (entries.length > 0) {
      breakdownList = entries.map(([s, q]) => `${s}:${q}`);
      if (computedQty === 0) computedQty = entries.reduce((acc, [, q]) => acc + Number(q), 0);
    }
  }

  if (blocks.length > 0) {
    let blockUnits = 0;
    blocks.forEach((b: any) => {
      let u = Number(b.total_units) || 0;
      if (b.size_quantities && typeof b.size_quantities === "object") {
        const entries = Object.entries(b.size_quantities).filter(([, q]) => Number(q) > 0);
        if (entries.length > 0) {
          breakdownList.push(...entries.map(([s, q]) => `${s}:${q}`));
          u = entries.reduce((acc, [, q]) => acc + Number(q), 0);
        }
      }
      blockUnits += u;
    });
    if (blockUnits > 0) computedQty = blockUnits;
  }

  if (computedQty === 0) {
    computedQty = Number(sub.total_units) || (sub.submission_type === "sample_request" ? 4 : 100);
  }

  const mainBlock = blocks[0] || {};
  const isSample =
    sub.submission_type === "sample_request" ||
    sub.order_type === "sample_request" ||
    sub.product_type?.toLowerCase().includes("sample");
  const styleName = isSample
    ? sub.client_reference_sku || sub.product_type || "Sample Development"
    : mainBlock.style_name || sub.product_type || "APPAREL-STYLE";

  const sizeSummary =
    breakdownList.length > 0
      ? breakdownList.join(" ")
      : mainBlock.size_template || (mainBlock.size_columns ? mainBlock.size_columns.join("-") : "Standard Matrix");

  let displayStatus: Order["status"] = "Open";
  let stageNum = 1;
  const sLow = (sub.status || "").toLowerCase();
  if (sLow === "approved" || sLow === "converted") {
    displayStatus = "In Production";
    stageNum = isSample ? 4 : 3;
  } else if (sLow === "in_development" || sLow === "in_production" || sLow === "in_sampling") {
    displayStatus = "In Production";
    stageNum = 4;
  } else if (sLow === "shipped" || sLow === "received") {
    displayStatus = "Shipped";
    stageNum = 13;
  } else if (sLow === "rejected" || sLow === "needs_info") {
    displayStatus = "On Hold";
    stageNum = 1;
  }

  return {
    order_id: refCode,
    customer_name: sub.company_name || sub.brand_name || "Brand Partner",
    PO_number: sub.existing_order_reference || refCode,
    style_no: styleName,
    tech_pack_ref:
      sub.tech_pack_filename ||
      (sub.tech_pack_url ? "TP-CLOUD-SPEC" : `TP-${styleName.replace(/[^a-zA-Z0-9]/g, "-").toUpperCase()}`),
    size_breakdown: sizeSummary,
    status: displayStatus,
    created_date: sub.submitted_at
      ? sub.submitted_at.substring(0, 10)
      : sub.created_at
      ? sub.created_at.substring(0, 10)
      : new Date().toISOString().substring(0, 10),
    current_stage: stageNum,
    qty: computedQty,
    notes: sub.client_notes || (isSample ? "Sample Request Intake" : "Submitted via Intake Portal"),
  } as Order;
}

const FINISHING_EQUIPMENT = [
  "Industrial Washer #3",
  "Jeanologia Laser",
  "Ozone Booth",
  "Spray Booth",
  "3D Wrinkle",
  "Steam Presser",
];

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order Details · Forge & Fabric Industries, Inc." },
    ],
  }),
  component: Page,
  errorComponent: ({ error }) => (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background, #0a0a0a)",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          background: "var(--card, #1a1a1a)",
          border: "1px solid var(--border, #333)",
          borderRadius: 16,
          padding: "2.5rem",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="rgb(239,68,68)" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground, #fff)", marginBottom: "0.5rem" }}>
          Failed to Load Order
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground, #888)", marginBottom: "0.5rem" }}>
          {(error as Error)?.message || "This order could not be loaded. It may not exist or you may not have permission to view it."}
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground, #666)", marginBottom: "1.5rem" }}>
          Order ID: <code style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.06)", padding: "0 4px", borderRadius: 4 }}>{window.location.pathname.split("/").pop()}</code>
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: 8,
              background: "var(--primary, #1a1a1a)",
              color: "#fff",
              border: "1px solid var(--border, #333)",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Retry
          </button>
          <a
            href="/orders"
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: 8,
              background: "transparent",
              color: "var(--foreground, #fff)",
              border: "1px solid var(--border, #333)",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Back to Orders
          </a>
        </div>
      </div>
    </div>
  ),
});

function Page() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSplitterOpen, setIsSplitterOpen] = useState(false);

  // Phase E: real cut/sewing ticket numbers for this order — the
  // cutting_records/sewing_bundles rollups below already show aggregate
  // qty, but not the actual ticket a floor supervisor would look up. Fetched
  // directly since cut_tickets/sewing_tickets aren't part of useAppData's
  // shared context.
  const [orderCutTickets, setOrderCutTickets] = useState<Array<{ ticket_number: string; status: string; lot_number?: string; marker_name?: string }>>([]);
  const [orderSewingTickets, setOrderSewingTickets] = useState<Array<{ ticket_number: string; status: string; line_number?: number }>>([]);
  useEffect(() => {
    if (!isRealSupabase || !orderId) return;
    supabase
      .from("cut_tickets")
      .select("ticket_number, status, lot_number, marker_name")
      .eq("work_order_id", orderId)
      .then(({ data }) => setOrderCutTickets((data as any) || []));
    supabase
      .from("sewing_tickets")
      .select("ticket_number, status, line_number")
      .eq("work_order_id", orderId)
      .then(({ data }) => setOrderSewingTickets((data as any) || []));
  }, [orderId]);
  const { 
    orders, 
    materials, 
    cutting, 
    sewing, 
    wash, 
    qc: qcRecords, 
    cartons, 
    wipLogs,
    equipment,
    createOrderBatch,
    updateOrder,
    advanceOrderStage,
    addMaterial,
    addCuttingRecord,
    addSewingBundle,
    addWashBatch,
    addQCRecord,
    addCarton,
    addWIPLog,
    isOrderOnHold,
    outsourceRecords
  } = useAppData();

  const canEdit = user?.role !== "customer";

  // Systematic RBAC gates driven by the central permission matrix
  // (src/lib/permissions.ts) — replaces the page's prior ad hoc, inconsistent
  // inline role-list checks (e.g. merchandiser could split batches per the old
  // code, but the matrix says merchandiser is read-only on production_planning).
  const canManageBatches = usePermission("production_planning", "create");
  const canControlStage = usePermission("production_planning", "update");
  const canLogMaterials = usePermission("inventory", "create");
  const canLogShopFloor = usePermission("shop_floor", "create");
  const canLogQC = usePermission("qc", "create");
  const canViewQC = usePermission("qc", "read");
  const canLogCartons = usePermission("shipping", "create");

  const [noteText, setNoteText] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal active state
  const [activeModal, setActiveModal] = useState<"material" | "cutting" | "sewing" | "wash" | "qc" | "carton" | "wip" | null>(null);

  // Real document upload state — persists to the private 'order-documents'
  // Supabase Storage bucket and orders.po_document_url / cut_sheet_document_url,
  // replacing a prior setTimeout-based upload simulation that never persisted
  // anything anywhere.
  const [isUploadingPo, setIsUploadingPo] = useState(false);
  const [poUploadError, setPoUploadError] = useState("");
  const [isUploadingCutSheet, setIsUploadingCutSheet] = useState(false);
  const [cutSheetUploadError, setCutSheetUploadError] = useState("");

  const uploadOrderDocument = async (kind: "po" | "cut-sheet", file: File) => {
    if (!isRealSupabase || !order) return;
    const setUploading = kind === "po" ? setIsUploadingPo : setIsUploadingCutSheet;
    const setError = kind === "po" ? setPoUploadError : setCutSheetUploadError;
    const field = kind === "po" ? "po_document_url" : "cut_sheet_document_url";

    setUploading(true);
    setError("");
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${order.order_id}/${kind}/${Date.now()}-${cleanFileName}`;
      const { error: uploadErr } = await supabase.storage.from("order-documents").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadErr) throw uploadErr;
      updateOrder(order.order_id, { [field]: path } as Partial<Order>);
    } catch (err: any) {
      setError(err.message || `Failed to upload ${kind === "po" ? "PO" : "cut sheet"} document.`);
    } finally {
      setUploading(false);
    }
  };

  const openOrderDocument = async (path: string) => {
    if (!isRealSupabase) return;
    const { data, error } = await supabase.storage.from("order-documents").createSignedUrl(path, 300);
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };


  // WIP Movement State
  const [wipStageId, setWipStageId] = useState(1);
  const [wipQtyIn, setWipQtyIn] = useState(0);
  const [wipQtyOut, setWipQtyOut] = useState(0);
  const [wipRework, setWipRework] = useState(0);
  const [wipReject, setWipReject] = useState(0);
  const [wipOperator, setWipOperator] = useState("");
  const [wipBatchLot, setWipBatchLot] = useState("");
  const [wipRemarks, setWipRemarks] = useState("");

  // Log Material receipt state
  const [matType, setMatType] = useState<"Fabric" | "Trim" | "Accessory">("Fabric");
  const [matDesc, setMatDesc] = useState("");
  const [matQty, setMatQty] = useState(100);

  // Log Cutting job state
  const [panelsCut, setPanelsCut] = useState(500);
  const [cutSize, setCutSize] = useState("M");
  const [cutColor, setCutColor] = useState("Indigo Blue");
  const [cutterUsed, setCutterUsed] = useState("");
  const [cutStatus, setCutStatus] = useState<"In Progress" | "Completed">("In Progress");

  // Log Sewing bundle state
  const [sewLine, setSewLine] = useState<number>(1);
  const [opsCount, setOpsCount] = useState(15);
  const [sewQty, setSewQty] = useState(250);
  const [sewQcResult, setSewQcResult] = useState<"Pass" | "Rework" | "Reject">("Pass");

  // Log Wash batch state
  const [washQty, setWashQty] = useState(500);
  const [washStage, setWashStage] = useState<"Wash" | "Dry" | "Finish" | "Approved">("Wash");
  const [washEquip, setWashEquip] = useState("");

  // Log QC audit state
  const [qcCheckpoint, setQcCheckpoint] = useState<
    | "Material Check"
    | "First Cut Approval"
    | "Inline Sewing QC"
    | "Wash-Finish Approval"
    | "Final AQL-Packing Audit"
  >("Inline Sewing QC");
  const [qcInspected, setQcInspected] = useState(100);
  const [qcPass, setQcPass] = useState(98);
  const [qcReject, setQcReject] = useState(2);
  const [qcResult, setQcResult] = useState<"Pass" | "Rework" | "Reject">("Pass");

  // Log Carton state
  const [cartonQty, setCartonQty] = useState(150);

  // Shared modal error state
  const [modalError, setModalError] = useState("");

  // Retrieve matching order with case-insensitive, URL-decoded, and PO-number fallbacks
  const cleanOrderId = decodeURIComponent(orderId || "").trim();
  const foundOrder = orders.find(
    (o) =>
      o.order_id === cleanOrderId ||
      o.order_id?.toLowerCase() === cleanOrderId.toLowerCase() ||
      o.PO_number === cleanOrderId ||
      o.PO_number?.toLowerCase() === cleanOrderId.toLowerCase()
  );

  const [directOrder, setDirectOrder] = useState<Order | null>(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);

  // Direct Supabase fallback lookup for deep links or newly created intake orders
  useEffect(() => {
    if (!foundOrder && isRealSupabase && cleanOrderId) {
      setIsDirectLoading(true);
      (async () => {
        const res = await supabase
          .from("orders")
          .select("*")
          .or(`order_id.eq.${cleanOrderId},po_number.eq.${cleanOrderId}`)
          .maybeSingle();

        if (!res.error && res.data) {
          setDirectOrder({
            ...res.data,
            PO_number: res.data.po_number || res.data.PO_number,
          });
          return;
        }

        // Not a real orders row — fall back to the intake submission itself
        // (covers a freshly submitted / not-yet-converted order's own
        // reference-code link, e.g. straight from the confirmation screen).
        const subRes = await supabase
          .from("apply_submissions")
          .select("*")
          .eq("apply_reference_code", cleanOrderId)
          .maybeSingle();

        if (!subRes.error && subRes.data) {
          setDirectOrder(mapSubmissionToOrder(subRes.data));
        }
      })().finally(() => setIsDirectLoading(false));
    }
  }, [foundOrder, cleanOrderId]);

  const order = foundOrder || directOrder;

  // Load notes and dynamic equipment lists
  useEffect(() => {
    if (order) {
      setNoteText(order.notes || "");
    }
  }, [order]);

  // Set default equipment values
  const activeCutters = equipment.filter(eq => eq.type === "Cutter" && eq.status === "Active");
  const activeSewing = equipment.filter(eq => eq.type === "Sewing Line" && eq.status === "Active");
  const activeWash = equipment.filter(eq => ["Washer", "Laser", "Laser/Ozone", "Spray", "Finishing"].includes(eq.type) && eq.status === "Active");

  useEffect(() => {
    if (activeCutters.length > 0 && !cutterUsed) setCutterUsed(activeCutters[0].name);
    if (activeSewing.length > 0) {
      const match = activeSewing[0].name.match(/\d+/);
      if (match) setSewLine(parseInt(match[0], 10));
    }
    if (activeWash.length > 0 && !washEquip) setWashEquip(activeWash[0].name);
  }, [equipment]);

  // Rules-of-Hooks fix: this hook must run on every render regardless of
  // loading state. It previously sat after the isDirectLoading/!order early
  // returns below, so a component instance that mounts while the order is
  // still loading (e.g. a freshly created order the client cache hasn't
  // picked up yet) called fewer hooks on its first render than once `order`
  // resolved, tripping React's "Rendered more hooks than during the
  // previous render" invariant and crashing to the error boundary.
  const { logs: stageJumpLogs, recordJump } = useStageJumpLogs(orderId);

  if (isDirectLoading) {
    return (
      <AppShell>
        <div className="text-center py-16 space-y-4">
          <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-muted-foreground">Loading order details for {cleanOrderId}...</p>
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell>
        <div className="text-center py-12 space-y-4">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold">Order Not Found</h2>
          <p className="text-sm text-muted-foreground">The requested order ID ({cleanOrderId}) does not exist or you do not have permission to view it.</p>
          <button 
            onClick={() => {
              try { navigate({ to: "/orders" }); }
              catch (err) { window.location.href = "/orders"; }
            }}
            className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1 mx-auto cursor-pointer"
          >
            <ArrowLeft className="h-4.5 w-4.5" /> Back to Orders
          </button>
        </div>
      </AppShell>
    );
  }

  // Filter items relating to this order
  const orderMaterials = materials.filter((m) => m.order_id === orderId);
  const orderCutting = cutting.filter((c) => c.order_id === orderId);
  const orderSewing = sewing.filter((s) => s.order_id === orderId);
  const orderWash = wash.filter((w) => w.order_id === orderId);
  const orderQc = qcRecords.filter((q) => q.order_id === orderId);
  const orderCartons = cartons.filter((c) => c.order_id === orderId);
  // Split batches are genuine child rows in public.orders (linked via
  // parent_order_id), not public.work_orders rows — see the migration header
  // comment in 20260824000000_order_batch_splitting_and_documents.sql for why.
  const orderBatches = orders.filter((o) => (o as any).parent_order_id === order.order_id);

  // Calculate open balance for the parent order
  const allocatedQty = orderBatches.reduce((sum, o) => sum + (o.qty || 0), 0);
  const openBalance = Math.max(0, order.qty - allocatedQty);

  // Real per-size quantity data, if the order actually has any (see
  // parseSizeBreakdown's doc comment — range labels and placeholders return null).
  const parentSizeMap = parseSizeBreakdown(order.size_breakdown);

  // Role permissions
  const isCustomer = user?.role === "customer";
  const canEditNotes = user && ["admin", "merchandiser", "production"].includes(user.role);

  // QC Checkpoint Calculations (Pass, Rework, Reject aggregates)
  const qcStats = orderQc.reduce(
    (acc, cur) => {
      acc.inspected += cur.inspected_qty;
      acc.pass += cur.pass_qty;
      acc.reject += cur.reject_qty;
      if (cur.result === "Rework") acc.rework += (cur.inspected_qty - cur.pass_qty - cur.reject_qty);
      return acc;
    },
    { inspected: 0, pass: 0, reject: 0, rework: 0 }
  );

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditNotes) return;
    updateOrder(orderId, { notes: noteText });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleAdvance = (toStage: number) => {
    setValidationError(null);
    setSuccessMsg(null);

    const check = checkStageAdvancement(toStage, order.order_id, {
      materials,
      cutting,
      sewing,
      qc: qcRecords,
      wash,
      cartons,
      outsourceRecords,
    }, (order as any).selected_stages, order.current_stage);

    if (!check.allowed) {
      setValidationError(check.message || "Stage advancement validation failed.");
    } else {
      const fromStage = order.current_stage;
      advanceOrderStage(order.order_id, toStage);
      recordJump({
        fromStage,
        toStage,
        reason: "Standard forward stage advance",
      });
      setSuccessMsg(`Stage advanced to Stage ${toStage} successfully!`);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const handleStageJump = async (toStage: number, reason?: string) => {
    setValidationError(null);
    setSuccessMsg(null);
    const fromStage = order.current_stage;

    // REQ-15 Section 4D: the same outsource QC gate handleAdvance enforces
    // must also apply here — this is the StageNavigator "Jump to Stage"
    // path (backward rollback + multi-stage skip), the only other route
    // besides the sequential Advance button that changes current_stage.
    // Without this, a jump silently bypassed the frontend gate (the DB
    // trigger enforce_order_stage_gates() would still catch it, but as a
    // raw exception instead of this clean, specific message).
    const check = checkStageAdvancement(toStage, order.order_id, {
      materials,
      cutting,
      sewing,
      qc: qcRecords,
      wash,
      cartons,
      outsourceRecords,
    }, (order as any).selected_stages, fromStage);

    if (!check.allowed) {
      setValidationError(check.message || "Stage transition validation failed.");
      return;
    }

    advanceOrderStage(order.order_id, toStage);
    await recordJump({
      fromStage,
      toStage,
      reason,
    });
    setSuccessMsg(`Stage successfully transitioned from Stage ${fromStage} to Stage ${toStage}!`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Timeline Progress percentage
  const totalStages = 13;
  const stageProgress = Math.round((order.current_stage / totalStages) * 100);


  // REQ-14: advance target comes from the order's selective pipeline, not a
  // blind +1 — getNextSelectedStage skips any stage the order never
  // actually selected (see src/lib/utils.ts, mirrors the DB's
  // get_next_selected_stage()). null means there is no further selected
  // stage, i.e. the order is at the end of its own pipeline.
  const resolvedNextStage = getNextSelectedStage(order.current_stage, (order as any).selected_stages);
  const isFinalStage = resolvedNextStage === null;
  const nextStage = resolvedNextStage ?? order.current_stage;
  const advanceCheck = !isFinalStage ? checkStageAdvancement(nextStage, order.order_id, {
    materials,
    cutting,
    sewing,
    qc: qcRecords,
    wash,
    cartons,
    outsourceRecords,
  }, (order as any).selected_stages, order.current_stage) : { allowed: false, message: "Order is already at final stage." };

  // Deriving the Activity Log (Reverse Chronological)
  const materialsLog = orderMaterials.map((m) => ({
    id: m.material_id,
    type: "Material",
    stageName: "Raw Material Sourcing",
    title: `Material Receipt Logged`,
    detail: `${m.type} - ${m.description} (${m.qty_received.toLocaleString()} units) received. Inspection: ${m.inspection_status}`,
    date: m.received_date,
  }));

  const cuttingLog = orderCutting.map((c) => ({
    id: c.cut_id,
    type: "Cutting",
    stageName: "Cutting Stage",
    title: `Cutting Job Logs`,
    detail: `${c.panels_cut.toLocaleString()} panels cut (size ${c.size}, color ${c.color}) on ${c.cutter_used}. Status: ${c.status}. Approval: ${c.first_cut_approval_status}`,
    date: order.created_date, // fallback
  }));

  const sewingLog = orderSewing.map((s) => ({
    id: s.bundle_id,
    type: "Sewing",
    stageName: "Sewing WIP",
    title: `Sewing Bundle Fed`,
    detail: `Line ${s.line_number} bundle (${s.qty.toLocaleString()} pcs, ${s.operator_count} operators). QC: ${s.inline_qc_result}. Status: ${s.status}`,
    date: order.created_date, // fallback
  }));

  const washLog = orderWash.map((w) => ({
    id: w.batch_id,
    type: "Wash",
    stageName: "Wash & Dry",
    title: `Finishing Batch Logs`,
    detail: `Batch ${w.batch_id} (${w.pcs_qty.toLocaleString()} pcs) at stage ${w.stage} on ${w.equipment_used}`,
    date: order.created_date, // fallback
  }));

  const qcLog = orderQc.map((q) => ({
    id: q.qc_id,
    type: "QC",
    stageName: "Quality Inspection",
    title: `QC Checkpoint Audit`,
    detail: `${q.stage_checkpoint} - Inspected: ${q.inspected_qty.toLocaleString()} pcs. Result: ${q.result} (Pass: ${q.pass_qty}, Reject: ${q.reject_qty})`,
    date: q.inspected_date,
  }));

  const cartonLog = orderCartons.map((c) => ({
    id: c.carton_id,
    type: "Carton",
    stageName: "Packing & Dispatch",
    title: `Carton Packaged`,
    detail: `Carton ${c.carton_id} (${c.packed_qty.toLocaleString()} pcs). Status: ${c.dispatch_status} ${c.pod_reference ? `(POD: ${c.pod_reference})` : ""}`,
    date: c.ship_date || order.created_date,
  }));

  const activityLog = [
    ...materialsLog,
    ...cuttingLog,
    ...sewingLog,
    ...washLog,
    ...qcLog,
    ...cartonLog,
  ].sort((a, b) => b.date.localeCompare(a.date));

  // Form submits
  const handleMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (!matDesc.trim()) {
      setModalError("Please enter a material description.");
      return;
    }
    if (matQty <= 0) {
      setModalError("Quantity received must be greater than zero.");
      return;
    }
    addMaterial({
      material_id: `MAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: orderId,
      type: matType,
      description: matDesc,
      qty_received: matQty,
      inspection_status: "Pending",
      received_date: new Date().toISOString().slice(0, 10),
    });
    setMatDesc("");
    setMatQty(100);
    setModalError("");
    setActiveModal(null);
  };

  const handleCuttingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (panelsCut <= 0) {
      setModalError("Panels cut must be greater than zero.");
      return;
    }
    if (!cutterUsed) {
      setModalError("Please select a cutter / cutting machine.");
      return;
    }
    addCuttingRecord({
      cut_id: `CUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: orderId,
      panels_cut: panelsCut,
      size: cutSize,
      color: cutColor,
      cutter_used: cutterUsed,
      status: cutStatus,
      first_cut_approval_status: "Pending",
    });
    setPanelsCut(500);
    setCutSize("M");
    setCutColor("Indigo");
    setModalError("");
    setActiveModal(null);
  };

  const handleSewingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (opsCount <= 0) {
      setModalError("Operator count must be at least 1.");
      return;
    }
    if (sewQty <= 0) {
      setModalError("Bundle quantity must be greater than zero.");
      return;
    }
    addSewingBundle({
      bundle_id: `BDL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: orderId,
      line_number: sewLine,
      operator_count: opsCount,
      qty: sewQty,
      status: "Active",
      inline_qc_result: sewQcResult,
    });
    setOpsCount(15);
    setSewQty(250);
    setSewQcResult("Pass");
    setModalError("");
    setActiveModal(null);
  };

  const handleWashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (washQty <= 0) {
      setModalError("Pieces quantity must be greater than zero.");
      return;
    }
    if (!washEquip) {
      setModalError("Please select the equipment used for this wash batch.");
      return;
    }
    addWashBatch({
      batch_id: `WSH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: orderId,
      pcs_qty: washQty,
      stage: washStage,
      equipment_used: washEquip,
    });
    setWashQty(500);
    setWashStage("Wash");
    setModalError("");
    setActiveModal(null);
  };

  const handleQcInspectedChange = (val: number) => {
    setQcInspected(val);
    if (qcPass > val) {
      setQcPass(val);
      setQcReject(0);
    } else {
      setQcReject(Math.max(0, val - qcPass));
    }
  };

  const handleQcPassChange = (val: number) => {
    setQcPass(val);
    setQcReject(Math.max(0, qcInspected - val));
  };

  const handleQcRejectChange = (val: number) => {
    setQcReject(val);
    setQcPass(Math.max(0, qcInspected - val));
  };

  const handleQcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (!order) return;

    // 1. Validate gate checkpoint eligibility
    const gateCheck = validateQCCheckpointEligibility(order, qcCheckpoint, qcRecords);
    if (!gateCheck.allowed) {
      setModalError(gateCheck.reason || "This checkpoint cannot be audited yet.");
      return;
    }

    // 2. Validate quantities
    const qtyCheck = validateQCQuantities(qcInspected, qcPass, qcReject, order.qty);
    if (!qtyCheck.valid) {
      setModalError(qtyCheck.error || "Invalid inspection quantities.");
      return;
    }

    addQCRecord({
      qc_id: `QA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: orderId,
      stage_checkpoint: qcCheckpoint,
      inspected_qty: qcInspected,
      pass_qty: qcPass,
      reject_qty: qcReject,
      result: qcResult,
      inspected_date: new Date().toISOString().slice(0, 10),
    });
    setQcInspected(100);
    setQcPass(98);
    setQcReject(2);
    setQcResult("Pass");
    setModalError("");
    setActiveModal(null);
  };

  const handleCartonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (cartonQty <= 0) {
      setModalError("Packed quantity must be greater than zero.");
      return;
    }
    addCarton({
      carton_id: `CTN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: orderId,
      packed_qty: cartonQty,
      dispatch_status: "Ready",
      pod_reference: "",
      ship_date: "",
    });
    setCartonQty(150);
    setModalError("");
    setActiveModal(null);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back Button */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => {
              try { navigate({ to: "/orders" }); }
              catch (err) { window.location.href = "/orders"; }
            }}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Orders
          </button>
        </div>

        {/* Order Header Card */}
        <div className="bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm">
          <div className="flex flex-wrap justify-between items-start gap-4 border-b border-border/60 pb-4 mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Order Ref</div>
              <h1 className="mt-1 text-2xl font-bold font-display">{order.order_id}</h1>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
              <span className="text-xs border px-2 py-0.5 rounded bg-muted/30 text-muted-foreground font-mono-data">
                Stage {order.current_stage}/13
              </span>
              
              {/* Customer / Client Request Order Update Button */}
              <button
                type="button"
                onClick={() => {
                  try { navigate({ to: "/apply/update" }); }
                  catch (err) { window.location.href = "/apply/update"; }
                }}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 transition-all flex items-center gap-1 shadow-xs"
              >
                <FileEdit className="h-3.5 w-3.5 text-amber-700" /> Request Change
              </button>

              {/* Split into Batch — production_planning:create (admin/super_admin/production_manager) */}
              {canManageBatches && order.status !== "Shipped" && (
                <button
                  type="button"
                  onClick={() => setIsSplitterOpen(true)}
                  className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-300 text-indigo-900 hover:bg-indigo-100 transition-all flex items-center gap-1 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 text-indigo-700" /> Split into Batch
                </button>
              )}

              {/* Header Advance Stage Button — production_planning:update (admin/super_admin/production_manager) */}
              {canControlStage && !isFinalStage && (
                <div className="relative group">
                  <button
                    disabled={!advanceCheck.allowed}
                    onClick={() => handleAdvance(nextStage)}
                    className={`text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-1 transition-all shadow-sm ${
                      advanceCheck.allowed
                        ? "bg-primary hover:bg-black text-white cursor-pointer"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                    }`}
                  >
                    <Play className="h-3 w-3 fill-current" /> Advance to Stage {nextStage}
                  </button>
                  {!advanceCheck.allowed && advanceCheck.message && (
                    <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-black/95 text-white text-[10px] p-2 rounded-lg w-56 z-50 shadow-lg pointer-events-none text-left">
                      {advanceCheck.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Customer</div>
              <div className="mt-1 font-semibold text-foreground">{order.customer_name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">PO Number</div>
              <div className="mt-1 font-semibold text-foreground">{order.PO_number}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Style No</div>
              <div className="mt-1 font-bold text-foreground text-xs">{order.style_no || "N/A"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Color</div>
              <div className="mt-1 font-semibold text-foreground text-xs">{order.color || "Indigo"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Tech Pack</div>
              <div className="mt-1 font-semibold text-foreground font-mono-data text-xs">{order.tech_pack_ref}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Size Breakdown</div>
              <div className="mt-1 font-semibold text-foreground">{formatSizeBreakdown(order.size_breakdown)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Target Qty</div>
              <div className="mt-1 font-semibold text-foreground">{order.qty.toLocaleString()} pcs</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Planned Ship</div>
              <div className="mt-1 font-semibold text-foreground flex items-center gap-1 text-xs">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {order.planned_ship_date || order.created_date}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border/60">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Overall Pipeline Progress</span>
              <span className="font-semibold text-foreground">{stageProgress}%</span>
            </div>
            <ProgressBar value={stageProgress} colorClass="bg-[#0071E3]" />
          </div>
        </div>

        {/* Split Batches — genuine child rows in public.orders (parent_order_id) */}
        {orderBatches.length > 0 && (
          <SectionCard title={`Split Batches (${orderBatches.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/30 border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Batch Order ID</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Flavor Route</th>
                    <th className="px-4 py-3 font-semibold text-right">Qty</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orderBatches.map((batch) => {
                    const stageObj = STAGES.find((s) => s.id === batch.current_stage);
                    return (
                      <tr
                        key={batch.order_id}
                        className="hover:bg-muted/10 transition-colors cursor-pointer"
                        onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: batch.order_id } })}
                      >
                        <td className="px-4 py-3 font-bold font-mono-data text-primary">{batch.order_id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20 font-bold">
                              Stage {batch.current_stage}
                            </span>
                            <span className="text-xs text-muted-foreground">{stageObj?.name || "Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold">{(batch as any).flavor_route || "Full CMT"}</td>
                        <td className="px-4 py-3 text-right font-mono-data">{batch.qty.toLocaleString()} pcs</td>
                        <td className="px-4 py-3"><StatusBadge status={batch.status || "Open"} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {openBalance > 0 && (
              <div className="mt-4 flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <p className="text-xs text-indigo-900 font-medium">
                  This order has an open balance of <strong>{openBalance.toLocaleString()} pcs</strong> awaiting batch scheduling.
                </p>
                {canManageBatches && (
                  <button onClick={() => setIsSplitterOpen(true)} className="text-xs font-bold px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                    Split Next Batch
                  </button>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Documents Section — real Supabase Storage uploads to the private
            order-documents bucket, persisted on the order row. */}
        <SectionCard title="Documents & Files (Cut Sheets & POs)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Master PO Upload Box — customer may upload their own PO */}
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden group">
              <input
                type="file"
                accept=".pdf"
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={(e) => { if (e.target.files && e.target.files[0]) uploadOrderDocument("po", e.target.files[0]); }}
              />
              {isUploadingPo ? (
                <div className="flex flex-col items-center animate-pulse">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
                  <p className="text-xs font-semibold text-primary">Uploading secure document...</p>
                </div>
              ) : order.po_document_url ? (
                <div className="flex flex-col items-center text-success">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mb-3">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold">PO Document On File</h3>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openOrderDocument(order.po_document_url!); }}
                    className="relative z-20 text-xs font-semibold mt-1.5 text-primary flex items-center gap-1 hover:underline"
                  >
                    <Download className="h-3 w-3" /> View Document
                  </button>
                  <p className="text-[10px] text-muted-foreground mt-2">Drop a new file to replace it</p>
                </div>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold">Master PO (PDF)</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">Drag & drop the customer purchase order here</p>
                  <button className="text-xs font-semibold px-4 py-1.5 bg-background border rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex items-center gap-1.5">
                    <UploadCloud className="h-3.5 w-3.5" /> Browse Files
                  </button>
                </>
              )}
              {poUploadError && <p className="relative z-20 text-[10px] text-destructive font-semibold mt-2">{poUploadError}</p>}
            </div>

            {/* Cut Sheet Upload Box — internal blueprint, staff only */}
            {isCustomer ? (
              <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center flex flex-col items-center justify-center min-h-[160px] bg-muted/20">
                <Lock className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Internal factory document — not shared with customers.</p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden group">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={(e) => { if (e.target.files && e.target.files[0]) uploadOrderDocument("cut-sheet", e.target.files[0]); }}
                />
                {isUploadingCutSheet ? (
                  <div className="flex flex-col items-center animate-pulse">
                    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
                    <p className="text-xs font-semibold text-primary">Uploading blueprint...</p>
                  </div>
                ) : order.cut_sheet_document_url ? (
                  <div className="flex flex-col items-center text-success">
                    <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mb-3">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold">Cut Sheet On File</h3>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openOrderDocument(order.cut_sheet_document_url!); }}
                      className="relative z-20 text-xs font-semibold mt-1.5 text-primary flex items-center gap-1 hover:underline"
                    >
                      <Download className="h-3 w-3" /> View Document
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-2">Drop a new file to replace it</p>
                  </div>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold">Factory Cut Sheet</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">Drag & drop the cutting blueprint (.pdf, .png)</p>
                    <button className="text-xs font-semibold px-4 py-1.5 bg-background border rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex items-center gap-1.5">
                      <UploadCloud className="h-3.5 w-3.5" /> Browse Files
                    </button>
                  </>
                )}
                {cutSheetUploadError && <p className="relative z-20 text-[10px] text-destructive font-semibold mt-2">{cutSheetUploadError}</p>}
              </div>
            )}

          </div>
        </SectionCard>

        {/* Direct Stage Navigator Control */}
        {!isCustomer && (
          <StageNavigator
            currentStage={order.current_stage}
            orderId={order.order_id}
            userRole={user?.role as any}
            userName={user?.full_name || (user as any)?.name}
            onJumpStage={handleStageJump}
          />
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Timeline View (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* REQ-14 Section 3F / 4E: customers see progress against their
                own selected services only — friendly names, no equipment/
                panel/bundle/carton internals, no outsource routing info.
                Consecutive internal stages that share one friendly name
                (e.g. 1-3 "Fabric Receiving & Inspection") collapse into a
                single step, so a partial-pipeline order genuinely reads as
                an N-step (not 13-step) progress list. */}
            {isCustomer && (() => {
              const orderSelectedStages = (((order as any).selected_stages as number[] | undefined) && (order as any).selected_stages.length > 0)
                ? (order as any).selected_stages as number[]
                : Array.from({ length: 13 }, (_, i) => i + 1);
              const steps: { name: string; minId: number; maxId: number }[] = [];
              orderSelectedStages.forEach((id) => {
                const name = getStageFriendlyName(id);
                const last = steps[steps.length - 1];
                if (last && last.name === name) {
                  last.maxId = id;
                } else {
                  steps.push({ name, minId: id, maxId: id });
                }
              });
              return (
                <SectionCard title={`Production Progress (${steps.length} Steps)`}>
                  <div className="space-y-2.5">
                    {steps.map((step, idx) => {
                      const isDone = order.current_stage > step.maxId;
                      const isCurrent = order.current_stage >= step.minId && order.current_stage <= step.maxId;
                      return (
                        <div
                          key={`${step.name}-${step.minId}`}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border transition-all",
                            isCurrent
                              ? "bg-primary/10 border-primary/40 shadow-sm"
                              : isDone
                              ? "bg-success/10 border-success/25"
                              : "bg-muted/20 border-border/25"
                          )}
                        >
                          <div
                            className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border",
                              isDone
                                ? "bg-success/20 text-success border-success/40"
                                : isCurrent
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border/40"
                            )}
                          >
                            {isDone ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                          </div>
                          <span
                            className={cn(
                              "flex-1 text-sm font-semibold",
                              isCurrent ? "text-foreground" : isDone ? "text-foreground/80" : "text-muted-foreground"
                            )}
                          >
                            {step.name}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                              isDone
                                ? "bg-success/15 text-success"
                                : isCurrent
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isDone ? "Complete" : isCurrent ? "In Progress" : "Upcoming"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              );
            })()}

            {!isCustomer && (
            <SectionCard title="13-Stage Production Timeline">
              {validationError && (
                <div className="mb-4 p-3 rounded-lg flex items-start gap-2.5 text-xs font-semibold bg-error-container text-on-error-container border border-error/25">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-error" />
                  <span>{validationError}</span>
                </div>
              )}
              {successMsg && (
                <div className="mb-4 p-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold bg-success/15 text-success border border-success/30">
                  <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
              <div className="relative pl-6 space-y-6">
                {/* Vertical Timeline Track Line */}
                <div className="absolute left-[35px] top-6 bottom-6 w-0.5 bg-border/60" />

                {STAGES.map((stg) => {
                  const isDone = stg.id < order.current_stage;
                  const isCurrent = stg.id === order.current_stage;
                  const isFuture = stg.id > order.current_stage;
                  const isBlocked = isOrderOnHold(order.order_id) && isCurrent;
                  // REQ-14: a stage this order's selective pipeline never
                  // included (e.g. Washing, when the customer supplied
                  // pre-washed garments). No selected_stages means the
                  // legacy/default full 13-stage pipeline — nothing is greyed out.
                  const orderSelectedStages = (order as any).selected_stages as number[] | undefined;
                  const isNotSelected = !!orderSelectedStages && !orderSelectedStages.includes(stg.id);

                  return (
                    <div
                      key={stg.id}
                      className={cn(
                        "relative flex items-start gap-4 p-3.5 rounded-xl border transition-all duration-200",
                        isNotSelected
                          ? "bg-muted/10 border-border/20 opacity-40 grayscale"
                          : isCurrent
                          ? isBlocked
                            ? "bg-amber-500/10 border-amber-500/40 shadow-sm"
                            : "bg-primary/10 border-primary/40 shadow-sm ring-1 ring-primary/20"
                          : isDone
                            ? "bg-card/60 border-border/40 hover:bg-card"
                            : "bg-muted/20 border-border/20 opacity-60"
                      )}
                    >
                      {/* Stage Number & Status Badge Indicator */}
                      <div
                        className={cn(
                          "relative z-10 flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0 border shadow-sm",
                          isNotSelected
                            ? "bg-muted text-muted-foreground/60 border-border/30"
                            : isCurrent
                            ? isBlocked
                              ? "bg-amber-500 text-white border-amber-600 animate-pulse"
                              : "bg-primary text-primary-foreground border-primary"
                            : isDone
                              ? "bg-success/20 text-success border-success/40"
                              : "bg-muted text-muted-foreground border-border/40"
                        )}
                      >
                        {isDone ? <CheckCircle className="h-4 w-4" /> : isBlocked ? <AlertTriangle className="h-4 w-4" /> : stg.id}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4
                            className={cn(
                              "font-semibold text-sm tracking-tight",
                              isNotSelected ? "text-muted-foreground/60" : isCurrent ? "text-foreground font-bold" : isDone ? "text-foreground/90" : "text-muted-foreground"
                            )}
                          >
                            {stg.id}. {stg.name}
                          </h4>
                          {isNotSelected && (
                            <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground/70 bg-muted/30 font-normal">
                              Not Included
                            </Badge>
                          )}
                          {!isNotSelected && isCurrent && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] font-semibold px-2 py-0.5",
                                isBlocked ? "border-amber-500/40 text-amber-600 bg-amber-500/10" : "border-primary/40 text-primary bg-primary/10"
                              )}
                            >
                              {isBlocked ? "On Hold" : "Active Stage"}
                            </Badge>
                          )}
                          {!isNotSelected && isDone && (
                            <Badge variant="outline" className="text-[10px] border-success/30 text-success bg-success/10 font-normal">
                              Completed
                            </Badge>
                          )}
                        </div>

                        {/* Inputs / Outputs description */}
                        <div className="grid sm:grid-cols-2 gap-1.5 mt-2 text-xs text-muted-foreground">
                          <div>
                            <span className="font-semibold text-foreground">Input:</span> {stg.input}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">Output:</span> {stg.output}
                          </div>
                        </div>

                        {/* Process Equipment Tag */}
                        {(stg as any).equipment && (
                          <div className="text-[11px] text-muted-foreground/80 mt-1">
                            <span className="font-semibold text-foreground">Equipment:</span> {(stg as any).equipment}
                          </div>
                        )}

                        {/* Stage specific activity preview */}
                        {(isDone || isCurrent) && (
                          <div className="mt-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/40">
                            {stg.id === 2 && orderMaterials.length > 0 && (
                              <div>
                                <span className="font-semibold text-foreground">Materials Registered:</span>{" "}
                                {orderMaterials.length} items logged ({orderMaterials.reduce((a, b) => a + b.qty_received, 0).toLocaleString()} units)
                              </div>
                            )}
                            {stg.id === 5 && orderCutting.length > 0 && (
                              <div>
                                <span className="font-semibold text-foreground">Cutting Progress:</span>{" "}
                                {orderCutting.reduce((a, b) => a + b.panels_cut, 0).toLocaleString()} panels cut
                                {orderCutTickets.length > 0 && (
                                  <span className="text-muted-foreground">
                                    {" "}&bull; Ticket{orderCutTickets.length > 1 ? "s" : ""}:{" "}
                                    {orderCutTickets.map((t) => `${t.ticket_number} (${t.status.replace("_", " ")})`).join(", ")}
                                  </span>
                                )}
                              </div>
                            )}
                            {stg.id === 7 && orderSewing.length > 0 && (
                              <div>
                                <span className="font-semibold text-foreground">Sewing Progress:</span>{" "}
                                {orderSewing.reduce((a, b) => a + (b.qty || (b as any).sewn_qty || 0), 0).toLocaleString()} sewn across {orderSewing.length} bundles
                                {orderSewingTickets.length > 0 && (
                                  <span className="text-muted-foreground">
                                    {" "}&bull; Ticket{orderSewingTickets.length > 1 ? "s" : ""}:{" "}
                                    {orderSewingTickets.map((t) => `${t.ticket_number} (${t.status.replace("_", " ")})`).join(", ")}
                                  </span>
                                )}
                              </div>
                            )}
                            {stg.id === 9 && orderWash.length > 0 && (
                              <div>
                                <span className="font-semibold text-foreground">Wash Output:</span>{" "}
                                {orderWash.reduce((a, b) => a + (b.pcs_qty || (b as any).qty_processed || 0), 0).toLocaleString()} pcs processed
                              </div>
                            )}
                            {stg.id === 11 && orderQc.length > 0 && (
                              <div>
                                <span className="font-semibold text-foreground">QC Pass Rate:</span>{" "}
                                {qcStats.inspected > 0 ? Math.round((qcStats.pass / qcStats.inspected) * 100) : 0}% ({qcStats.pass}/{qcStats.inspected} pass)
                              </div>
                            )}
                            {stg.id === 12 && orderCartons.length > 0 && (
                              <div>
                                <span className="font-semibold text-foreground">Packaged:</span>{" "}
                                {orderCartons.reduce((a, b) => a + b.packed_qty, 0).toLocaleString()} pcs across {orderCartons.length} cartons
                              </div>
                            )}

                            {/* Inline "Quick Add" Actions for the Current Stage Card Only —
                                each gated by the module that actually governs that action
                                per the permission matrix, not a blanket !isCustomer check. */}
                            {isCurrent && (canLogMaterials || canLogShopFloor || canLogQC || canLogCartons) && (
                              <div className="mt-3 pt-2.5 border-t border-border/40">
                                {stg.id === 2 && canLogMaterials && (
                                  <button
                                    onClick={() => { setMatType("Fabric"); setActiveModal("material"); }}
                                    className="text-xs font-bold text-[#0071E3] hover:text-[#005bb5] flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Material Receipt
                                  </button>
                                )}
                                {stg.id === 3 && canLogMaterials && (
                                  <button
                                    onClick={() => { setMatType("Trim"); setActiveModal("material"); }}
                                    className="text-xs font-bold text-[#0071E3] hover:text-[#005bb5] flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Trim/Accessory Receipt
                                  </button>
                                )}
                                {stg.id === 5 && canLogShopFloor && (
                                  <button
                                    onClick={() => setActiveModal("cutting")}
                                    className="text-xs font-bold text-[#0071E3] hover:text-[#005bb5] flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Cutting Job
                                  </button>
                                )}
                                {(stg.id === 6 || stg.id === 7) && canLogShopFloor && (
                                  <button
                                    onClick={() => setActiveModal("sewing")}
                                    className="text-xs font-bold text-[#0071E3] hover:text-[#005bb5] flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Sewing Bundle
                                  </button>
                                )}
                                {(stg.id === 9 || stg.id === 10) && canLogShopFloor && (
                                  <button
                                    onClick={() => setActiveModal("wash")}
                                    className="text-xs font-bold text-[#0071E3] hover:text-[#005bb5] flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Wash / Finishing Batch
                                  </button>
                                )}
                                {stg.id === 11 && canLogQC && (
                                  <button
                                    onClick={() => setActiveModal("qc")}
                                    className="text-xs font-bold text-[#0071E3] hover:text-[#005bb5] flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log QC Inspection
                                  </button>
                                )}
                                {stg.id === 12 && canLogCartons && (
                                  <button
                                    onClick={() => setActiveModal("carton")}
                                    className="text-xs font-bold text-[#0071E3] hover:text-[#005bb5] flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Create Carton
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
            )}

            {/* Stage Jump Audit History */}
            {!isCustomer && <StageJumpHistory logs={stageJumpLogs} />}
          </div>

          {/* Widgets Pane (Right 1 Column) */}
          <div className="space-y-6">
            {/* REQ-08: Universal Multi-Stage Outsourcing */}
            {!isCustomer && <StageOutsourcingPanel orderId={order.order_id} selectedStages={(order as any).selected_stages} />}

            {/* QC Checkpoint Summary — internal only (qc:read on the permission matrix) */}
            {canViewQC && (
            <SectionCard title="QC Checkpoints Summary">
              {orderQc.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground space-y-2">
                  <Award className="h-8 w-8 text-muted/60 mx-auto" />
                  <p>No QC checkpoint audits registered for this order yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-success/10 border border-success/30 p-2.5">
                      <div className="text-[10px] uppercase text-muted-foreground">Pass</div>
                      <div className="mt-1 text-lg font-bold text-success font-display">
                        {qcStats.pass.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-muted-foreground">pcs</div>
                    </div>
                    <div className="rounded-md bg-gold/10 border border-gold/30 p-2.5">
                      <div className="text-[10px] uppercase text-muted-foreground">Rework</div>
                      <div className="mt-1 text-lg font-bold text-warning-foreground font-display">
                        {qcStats.rework.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-muted-foreground">pcs</div>
                    </div>
                    <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2.5">
                      <div className="text-[10px] uppercase text-muted-foreground">Reject</div>
                      <div className="mt-1 text-lg font-bold text-destructive font-display">
                        {qcStats.reject.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-muted-foreground">pcs</div>
                    </div>
                  </div>

                  <div className="border-t border-border/60 pt-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">
                      Audited Checkpoints
                    </div>
                    <div className="space-y-2">
                      {orderQc.map((q) => (
                        <div key={q.qc_id} className="flex justify-between items-center text-xs border-b border-border/40 pb-1.5">
                          <div>
                            <span className="font-semibold text-foreground block">{q.stage_checkpoint}</span>
                            <span className="text-[10px] text-muted-foreground">Inspected: {q.inspected_qty} pcs</span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            q.result === "Pass" 
                              ? "bg-success/10 text-success border-success/20" 
                              : q.result === "Rework" 
                              ? "bg-gold/10 text-warning-foreground border-gold/20" 
                              : "bg-destructive/10 text-destructive border-destructive/20"
                          }`}>
                            {q.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
            )}

            {/* Order Notes — internal only. Previously the textarea rendered
                (read-only) for every role including customer despite its own
                label claiming "Only visible to admin, merchandiser, and
                production" — a real privacy leak, now actually enforced. */}
            {!isCustomer && (
            <SectionCard title="Order Notes &amp; Documents">
              <form onSubmit={handleSaveNotes} className="space-y-4">
                <div className="relative">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={canEditNotes ? "Add freeform specifications, notes, or technical comments..." : "No order notes logged."}
                    className="w-full h-36 border border-outline-variant bg-card text-xs p-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-secondary focus:border-secondary resize-none"
                    disabled={!canEditNotes}
                  />
                  {!canEditNotes && (
                    <div className="absolute top-2 right-2 bg-muted/80 text-muted-foreground border text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5 pointer-events-none">
                      Read Only
                    </div>
                  )}
                </div>

                {canEditNotes && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">
                      Only visible to admin, merchandiser, and production.
                    </span>
                    <button
                      type="submit"
                      className="bg-primary hover:bg-black text-white hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Save className="h-3.5 w-3.5" /> Save Notes
                    </button>
                  </div>
                )}

                {isSaved && (
                  <div className="text-xs text-success font-semibold text-right transition-all">
                    Notes updated successfully.
                  </div>
                )}
              </form>
            </SectionCard>
            )}
          </div>
        </div>

        {/* WIP Movement Logs Card — internal only: contains operator names and
            floor-execution detail (shop_floor:read is false for customer on
            the permission matrix). */}
        {!isCustomer && (
        <div className="mt-6">
          <SectionCard
            title="WIP Movement Log (Forge & Fabric Industries, Inc. Specification)"
            action={
              canEdit && (
                <button
                  onClick={() => {
                    setWipStageId(order.current_stage);
                    setWipQtyIn(order.qty);
                    setWipQtyOut(0);
                    setWipRework(0);
                    setWipReject(0);
                    setWipOperator("");
                    setWipBatchLot("");
                    setWipRemarks("");
                    setActiveModal("wip" as any);
                  }}
                  className="bg-secondary hover:bg-secondary/90 text-secondary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Log WIP Movement
                </button>
              )
            }
          >
            {wipLogs.filter((w) => w.order_id === orderId).length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No WIP movement logs recorded for this order yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Stage</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Qty IN</th>
                      <th className="py-2 pr-3">Qty OUT</th>
                      <th className="py-2 pr-3">Rework</th>
                      <th className="py-2 pr-3">Reject</th>
                      <th className="py-2 pr-3">Net WIP</th>
                      <th className="py-2 pr-3">QC Status</th>
                      <th className="py-2 pr-3">Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {wipLogs.filter((w) => w.order_id === orderId).map((w) => {
                      const stg = STAGES.find(s => s.id === w.stage_id)?.name || `Stage ${w.stage_id}`;
                      return (
                        <tr key={w.log_id} className="hover:bg-muted/30">
                          <td className="py-2.5 pr-3 font-mono-data">{w.log_date}</td>
                          <td className="py-2.5 pr-3 font-semibold">{stg}</td>
                          <td className="py-2.5 pr-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              w.movement_type === "IN" ? "bg-success/15 text-success border border-success/30" :
                              w.movement_type === "OUT" ? "bg-secondary/15 text-secondary border border-secondary/30" :
                              "bg-destructive/15 text-destructive border border-destructive/30"
                            }`}>
                              {w.movement_type}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">{w.qty_in.toLocaleString()}</td>
                          <td className="py-2.5 pr-3">{w.qty_out.toLocaleString()}</td>
                          <td className="py-2.5 pr-3 text-amber-600 font-semibold">{w.rework_qty}</td>
                          <td className="py-2.5 pr-3 text-destructive font-semibold">{w.reject_qty}</td>
                          <td className="py-2.5 pr-3 font-bold text-navy">{(w.qty_in - w.qty_out).toLocaleString()}</td>
                          <td className="py-2.5 pr-3 font-semibold">{w.qc_status}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{w.operator || "N/A"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
        )}

        {/* Order Activity & Event Log — internal operational feed (mixes
            inventory/shop_floor/qc/shipping domains, none of which customer
            has read access to per the permission matrix). */}
        {!isCustomer && (
        <div className="mt-6">
          <SectionCard title="Order Activity &amp; Event Log">
            {activityLog.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No activity logs recorded for this order yet.
              </div>
            ) : (
              <div className="relative border-l border-border ml-2 pl-4 space-y-4 py-2">
                {activityLog.map((act, i) => (
                  <div key={act.id + i} className="relative text-xs">
                    <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <span className="font-semibold text-foreground">{act.title}</span>
                        <span className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                          {act.stageName}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono-data">{act.date}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground text-[11px]">{act.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
        )}
      </div>

      {/* Material receipt Modal */}
      {activeModal === "material" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up text-left">
            <button onClick={() => { setActiveModal(null); setModalError(""); }} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log Material Receipt</h3>
            <p className="text-xs text-muted-foreground mb-4">Order: {order.order_id} ({order.customer_name})</p>
            {modalError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{modalError}</span>
              </div>
            )}
            <form onSubmit={handleMaterialSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Type</label>
                  <select value={matType} onChange={(e) => setMatType(e.target.value as any)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                    <option value="Fabric">Fabric</option>
                    <option value="Trim">Trim</option>
                    <option value="Accessory">Accessory</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Qty Received</label>
                  <input type="number" value={matQty} onChange={(e) => setMatQty(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={1} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Description</label>
                <input type="text" placeholder="e.g. Red Zip Fasteners 20cm" value={matDesc} onChange={(e) => setMatDesc(e.target.value)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors">Log Receipt</button>
            </form>
          </div>
        </div>
      )}

      {/* Cutting Job Modal */}
      {activeModal === "cutting" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up text-left">
            <button onClick={() => { setActiveModal(null); setModalError(""); }} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log Cutting Job</h3>
            <p className="text-xs text-muted-foreground mb-4">Order: {order.order_id} ({order.customer_name})</p>
            {modalError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{modalError}</span>
              </div>
            )}
            <form onSubmit={handleCuttingSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Panels Cut</label>
                  <input type="number" value={panelsCut} onChange={(e) => setPanelsCut(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={1} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Cutter Machine</label>
                  <select value={cutterUsed} onChange={(e) => setCutterUsed(e.target.value)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                    {activeCutters.map(eq => (
                      <option key={eq.id} value={eq.name}>{eq.name}</option>
                    ))}
                    {activeCutters.length === 0 && <option value="Manual Cutter 1">Manual Cutter 1</option>}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Size</label>
                  <input type="text" value={cutSize} onChange={(e) => setCutSize(e.target.value)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Color</label>
                  <input type="text" value={cutColor} onChange={(e) => setCutColor(e.target.value)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Status</label>
                <select value={cutStatus} onChange={(e) => setCutStatus(e.target.value as any)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors">Log Job</button>
            </form>
          </div>
        </div>
      )}

      {/* Sewing Bundle Modal */}
      {activeModal === "sewing" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up text-left">
            <button onClick={() => { setActiveModal(null); setModalError(""); }} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log Sewing Bundle</h3>
            <p className="text-xs text-muted-foreground mb-4">Order: {order.order_id} ({order.customer_name})</p>
            {modalError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{modalError}</span>
              </div>
            )}
            <form onSubmit={handleSewingSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Line #</label>
                  <select value={sewLine} onChange={(e) => setSewLine(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                    {activeSewing.map(eq => {
                      const m = eq.name.match(/\d+/);
                      return <option key={eq.id} value={m ? parseInt(m[0], 10) : 1}>{eq.name}</option>;
                    })}
                    {activeSewing.length === 0 && (
                      <>
                        <option value={1}>Line 1</option>
                        <option value={2}>Line 2</option>
                        <option value={3}>Line 3</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Operators</label>
                  <input type="number" value={opsCount} onChange={(e) => setOpsCount(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={1} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Qty</label>
                  <input type="number" value={sewQty} onChange={(e) => setSewQty(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={1} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">QC Result</label>
                  <select value={sewQcResult} onChange={(e) => setSewQcResult(e.target.value as any)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                    <option value="Pass">Pass</option>
                    <option value="Rework">Rework</option>
                    <option value="Reject">Reject</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors">Log Sewing</button>
            </form>
          </div>
        </div>
      )}

      {/* Wash Batch Modal */}
      {activeModal === "wash" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up text-left">
            <button onClick={() => { setActiveModal(null); setModalError(""); }} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log Wash Batch</h3>
            <p className="text-xs text-muted-foreground mb-4">Order: {order.order_id} ({order.customer_name})</p>
            {modalError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{modalError}</span>
              </div>
            )}
            <form onSubmit={handleWashSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Pcs Qty</label>
                  <input type="number" value={washQty} onChange={(e) => setWashQty(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={1} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Equipment</label>
                  <select value={washEquip} onChange={(e) => setWashEquip(e.target.value)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                    {activeWash.map(eq => (
                      <option key={eq.id} value={eq.name}>{eq.name}</option>
                    ))}
                    {activeWash.length === 0 && 
                      FINISHING_EQUIPMENT.map(eq => (
                        <option key={eq} value={eq}>{eq}</option>
                      ))
                    }
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Stage</label>
                <select value={washStage} onChange={(e) => setWashStage(e.target.value as any)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                  <option value="Wash">Wash</option>
                  <option value="Dry">Dry</option>
                  <option value="Finish">Finish</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors">Log Batch</button>
            </form>
          </div>
        </div>
      )}

      {/* QC Audit Modal */}
      {activeModal === "qc" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up text-left">
            <button onClick={() => { setActiveModal(null); setModalError(""); }} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log QC Audit</h3>
            <p className="text-xs text-muted-foreground mb-4">Order: {order.order_id} ({order.customer_name})</p>
            {modalError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{modalError}</span>
              </div>
            )}
            <form onSubmit={handleQcSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Checkpoint</label>
                <select value={qcCheckpoint} onChange={(e) => setQcCheckpoint(e.target.value as any)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                  {QC_PIPELINE_STAGES.map((gate: QCGateCheckpoint) => {
                    const check = validateQCCheckpointEligibility(order, gate.name, qcRecords);
                    const isLocked = !check.allowed;
                    return (
                      <option key={gate.name} value={gate.name} disabled={isLocked}>
                        {gate.name} {isLocked ? `(Locked — ${check.prereqName ? 'Requires ' + check.prereqName : 'Requires Stage ' + gate.minStage})` : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Order Total Qty: <strong className="text-foreground">{order.qty} pcs</strong> &bull; Current Stage: <strong className="text-foreground">{order.current_stage}</strong>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Inspected</label>
                  <input type="number" value={qcInspected} onChange={(e) => handleQcInspectedChange(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={1} max={order.qty} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary text-success">Pass</label>
                  <input type="number" value={qcPass} onChange={(e) => handleQcPassChange(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={0} max={qcInspected} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary text-destructive">Reject</label>
                  <input type="number" value={qcReject} onChange={(e) => handleQcRejectChange(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={0} max={qcInspected} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">AQL Result</label>
                <select value={qcResult} onChange={(e) => setQcResult(e.target.value as any)} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none">
                  <option value="Pass">Pass</option>
                  <option value="Rework">Rework</option>
                  <option value="Reject">Reject</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors">Log QC Audit</button>
            </form>
          </div>
        </div>
      )}

      {/* Create Carton Modal */}
      {activeModal === "carton" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up text-left">
            <button onClick={() => { setActiveModal(null); setModalError(""); }} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Create Carton</h3>
            <p className="text-xs text-muted-foreground mb-6">Order: {order.order_id} ({order.customer_name})</p>
            {modalError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{modalError}</span>
              </div>
            )}
            <form onSubmit={handleCartonSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Packed Qty (pcs)</label>
                <input type="number" value={cartonQty} onChange={(e) => setCartonQty(Number(e.target.value))} className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none" required min={1} />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors">Create Carton</button>
            </form>
          </div>
        </div>
      )}

      {/* Split Into Batch Modal — creates a genuine child row in public.orders
          (see createOrderBatch in useAppData.tsx), not a public.work_orders
          row. Real per-size data is passed through when the parent order has
          it (parseSizeBreakdown); otherwise the modal requires honest manual
          entry instead of fabricating a matrix from a range label. */}
      {isSplitterOpen && (
        <WoSplitterModal
          parentOrder={{
            order_id: order.order_id,
            qty: order.qty,
            openBalance,
            sizeBreakdownMap: parentSizeMap,
            style_name: order.style_no || "Standard Style",
          }}
          isOpen={isSplitterOpen}
          onClose={() => setIsSplitterOpen(false)}
          onSubmit={async (payload) => {
            await createOrderBatch({
              parent_order_id: order.order_id,
              target_qty: payload.target_qty,
              size_breakdown: serializeSizeBreakdown(payload.size_breakdown_map),
              flavor_route: payload.flavor_route,
              starting_stage_id: payload.starting_stage_id || 1,
              assigned_facility: payload.assigned_facility,
            });
          }}
        />
      )}
    </AppShell>
  );
}
