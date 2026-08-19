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
import { STAGES } from "../lib/mockData";
import { cn, formatSizeBreakdown } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { 
  ClipboardList, ArrowLeft, Calendar, FileText, CheckCircle, 
  Play, Circle, Save, ShieldAlert, Award, FileEdit, AlertTriangle, Plus, X
} from "lucide-react";
import {
  validateQCCheckpointEligibility,
  validateQCQuantities,
  QC_PIPELINE_STAGES,
  type QCGateCheckpoint,
} from "../lib/qcGateValidation";

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
    workOrders,
    createWorkOrder,
    updateOrder,
    advanceOrderStage,
    addMaterial,
    addCuttingRecord,
    addSewingBundle,
    addWashBatch,
    addQCRecord,
    addCarton,
    addWIPLog,
    isOrderOnHold
  } = useAppData();

  const canEdit = user?.role !== "customer";

  const [noteText, setNoteText] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal active state
  const [activeModal, setActiveModal] = useState<"material" | "cutting" | "sewing" | "wash" | "qc" | "carton" | "wip" | null>(null);

  // File Upload Simulation States
  const [isUploadingPo, setIsUploadingPo] = useState(false);
  const [poFile, setPoFile] = useState<File | null>(null);
  const [isUploadingCutSheet, setIsUploadingCutSheet] = useState(false);
  const [cutSheetFile, setCutSheetFile] = useState<File | null>(null);

  const simulateUpload = (type: "po" | "cutSheet", file: File) => {
    if (type === "po") {
      setIsUploadingPo(true);
      setTimeout(() => {
        setIsUploadingPo(false);
        setPoFile(file);
      }, 1000);
    } else {
      setIsUploadingCutSheet(true);
      setTimeout(() => {
        setIsUploadingCutSheet(false);
        setCutSheetFile(file);
      }, 1000);
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

  // Retrieve matching order
  const order = orders.find((o) => o.order_id === orderId);

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

  if (!order) {
    return (
      <AppShell>
        <div className="text-center py-12 space-y-4">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold">Order Not Found</h2>
          <p className="text-sm text-muted-foreground">The requested order ID does not exist or you do not have permission to view it.</p>
          <button 
            onClick={() => {
              try { navigate({ to: "/orders" }); }
              catch (err) { window.location.href = "/orders"; }
            }}
            className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1 mx-auto"
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
  const orderWorkOrders = (workOrders || []).filter((wo) => wo.blanket_po_id === order.order_id);

  // Calculate open balance for the Master PO
  const allocatedQty = orderWorkOrders.reduce((sum, wo) => sum + wo.target_qty, 0);
  const openBalance = order.qty - allocatedQty;

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

  const { logs: stageJumpLogs, recordJump } = useStageJumpLogs(orderId);

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
    });

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


  const nextStage = order.current_stage + 1;
  const isFinalStage = order.current_stage >= 13;
  const advanceCheck = !isFinalStage ? checkStageAdvancement(nextStage, order.order_id, {
    materials,
    cutting,
    sewing,
    qc: qcRecords,
    wash,
    cartons,
  }) : { allowed: false, message: "Order is already at final stage." };

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

              {/* Split PO Button (Admin/Merch only) */}
              {!isCustomer && ["admin", "merchandiser", "production"].includes(user?.role || "") && order.status !== "Shipped" && (
                <button
                  type="button"
                  onClick={() => setIsSplitterOpen(true)}
                  className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-300 text-indigo-900 hover:bg-indigo-100 transition-all flex items-center gap-1 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 text-indigo-700" /> Split into Batch
                </button>
              )}

              {/* Header Advance Stage Button */}
              {!isCustomer && !["merchandiser"].includes(user?.role || "") && !isFinalStage && (
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
              <div className="mt-1 font-bold text-secondary text-xs">{order.style_no || "N/A"}</div>
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
            <ProgressBar value={stageProgress} colorClass="bg-navy" />
          </div>
        </div>

        {/* Work Orders (Split Batches) */}
        {orderWorkOrders.length > 0 && (
          <SectionCard title={`Active Work Orders (${orderWorkOrders.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/30 border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">WO Number</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Flavor Route</th>
                    <th className="px-4 py-3 font-semibold text-right">Target Qty</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orderWorkOrders.map((wo) => {
                    const stageObj = STAGES.find(s => s.id === wo.current_stage_id);
                    return (
                      <tr key={wo.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-bold font-mono-data text-primary">{wo.wo_number}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                              Stage {wo.current_stage_id}
                            </span>
                            <span className="text-xs text-muted-foreground">{stageObj?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold">{wo.wash_process_type || "Standard"}</td>
                        <td className="px-4 py-3 text-right font-mono-data">{wo.target_qty.toLocaleString()} pcs</td>
                        <td className="px-4 py-3"><StatusBadge status={wo.status || "Pending"} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {openBalance > 0 && (
              <div className="mt-4 flex items-center justify-between p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <p className="text-xs text-indigo-900 font-medium">
                  This Master PO has an open balance of <strong>{openBalance.toLocaleString()} pcs</strong> awaiting batch scheduling.
                </p>
                {!isCustomer && ["admin", "merchandiser", "production"].includes(user?.role || "") && (
                  <button onClick={() => setIsSplitterOpen(true)} className="text-xs font-bold px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                    Split Next Batch
                  </button>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* C.1 Drag-and-Drop Documents Section */}
        <SectionCard title="Documents & Files (Cut Sheets & POs)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Master PO Upload Box */}
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden group">
              <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => { if (e.target.files && e.target.files[0]) simulateUpload("po", e.target.files[0]); }} />
              {isUploadingPo ? (
                <div className="flex flex-col items-center animate-pulse">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
                  <p className="text-xs font-semibold text-primary">Uploading secure document...</p>
                </div>
              ) : poFile ? (
                <div className="flex flex-col items-center text-success">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mb-3">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold truncate max-w-[200px]">{poFile.name}</h3>
                  <p className="text-xs font-semibold mt-1">Ready for fulfillment</p>
                </div>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold">Master PO (PDF)</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">Drag & drop the customer purchase order here</p>
                  <button className="text-xs font-semibold px-4 py-1.5 bg-background border rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">Browse Files</button>
                </>
              )}
            </div>
            
            {/* Cut Sheet Upload Box */}
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden group">
              <input type="file" accept=".pdf,.png,.jpg" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => { if (e.target.files && e.target.files[0]) simulateUpload("cutSheet", e.target.files[0]); }} />
              {isUploadingCutSheet ? (
                <div className="flex flex-col items-center animate-pulse">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
                  <p className="text-xs font-semibold text-primary">Uploading blueprint...</p>
                </div>
              ) : cutSheetFile ? (
                <div className="flex flex-col items-center text-success">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mb-3">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold truncate max-w-[200px]">{cutSheetFile.name}</h3>
                  <p className="text-xs font-semibold mt-1">Attached to Order</p>
                </div>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold">Factory Cut Sheet</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">Drag & drop the cutting blueprint (.pdf, .png)</p>
                  <button className="text-xs font-semibold px-4 py-1.5 bg-background border rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">Browse Files</button>
                </>
              )}
            </div>

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

                  return (
                    <div
                      key={stg.id}
                      className={cn(
                        "relative flex items-start gap-4 p-3.5 rounded-xl border transition-all duration-200",
                        isCurrent
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
                          isCurrent
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
                              isCurrent ? "text-foreground font-bold" : isDone ? "text-foreground/90" : "text-muted-foreground"
                            )}
                          >
                            {stg.id}. {stg.name}
                          </h4>
                          {isCurrent && (
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
                          {isDone && (
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
                              </div>
                            )}
                            {stg.id === 7 && orderSewing.length > 0 && (
                              <div>
                                <span className="font-semibold text-foreground">Sewing Progress:</span>{" "}
                                {orderSewing.reduce((a, b) => a + (b.qty || (b as any).sewn_qty || 0), 0).toLocaleString()} sewn across {orderSewing.length} bundles
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

                            {/* Inline "Quick Add" Actions for the Current Stage Card Only */}
                            {isCurrent && !isCustomer && (
                              <div className="mt-3 pt-2.5 border-t border-border/40">
                                {stg.id === 2 && (
                                  <button
                                    onClick={() => { setMatType("Fabric"); setActiveModal("material"); }}
                                    className="text-xs font-bold text-secondary hover:text-black flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Material Receipt
                                  </button>
                                )}
                                {stg.id === 3 && (
                                  <button
                                    onClick={() => { setMatType("Trim"); setActiveModal("material"); }}
                                    className="text-xs font-bold text-secondary hover:text-black flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Trim/Accessory Receipt
                                  </button>
                                )}
                                {stg.id === 5 && (
                                  <button
                                    onClick={() => setActiveModal("cutting")}
                                    className="text-xs font-bold text-secondary hover:text-black flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Cutting Job
                                  </button>
                                )}
                                {(stg.id === 6 || stg.id === 7) && (
                                  <button
                                    onClick={() => setActiveModal("sewing")}
                                    className="text-xs font-bold text-secondary hover:text-black flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Sewing Bundle
                                  </button>
                                )}
                                {(stg.id === 9 || stg.id === 10) && (
                                  <button
                                    onClick={() => setActiveModal("wash")}
                                    className="text-xs font-bold text-secondary hover:text-black flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log Wash / Finishing Batch
                                  </button>
                                )}
                                {stg.id === 11 && (
                                  <button
                                    onClick={() => setActiveModal("qc")}
                                    className="text-xs font-bold text-secondary hover:text-black flex items-center gap-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Log QC Inspection
                                  </button>
                                )}
                                {stg.id === 12 && (
                                  <button
                                    onClick={() => setActiveModal("carton")}
                                    className="text-xs font-bold text-secondary hover:text-black flex items-center gap-1"
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

            {/* Stage Jump Audit History */}
            <StageJumpHistory logs={stageJumpLogs} />
          </div>

          {/* Widgets Pane (Right 1 Column) */}
          <div className="space-y-6">
            {/* REQ-08: Universal Multi-Stage Outsourcing */}
            {!isCustomer && <StageOutsourcingPanel orderId={order.order_id} />}

            {/* QC Checkpoint Summary */}
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

            {/* Gated notes / Documents */}
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
          </div>
        </div>

        {/* WIP Movement Logs Card */}
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

        {/* Derived Order Activity Event Log */}
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
                <span className="shrink-0">⚠</span><span>{modalError}</span>
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
                <span className="shrink-0">⚠</span><span>{modalError}</span>
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
                <span className="shrink-0">⚠</span><span>{modalError}</span>
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
                <span className="shrink-0">⚠</span><span>{modalError}</span>
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
                <span className="shrink-0">⚠</span><span>{modalError}</span>
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
                <span className="shrink-0">⚠</span><span>{modalError}</span>
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

      {/* WO Splitter Modal */}
      {isSplitterOpen && (
        <WoSplitterModal
          po={{
            id: order.order_id, // we use order.order_id as the blanket_po_id since our frontend mock treats order_id as the master PO
            total_contract_qty: order.qty,
            open_balance: openBalance, 
            size_matrix: order.size_breakdown.split("-").reduce((acc: any, s: string) => { acc[s] = Math.floor(order.qty / 5); return acc; }, {}),
            style_name: order.style_no || "Standard Style"
          }}
          isOpen={isSplitterOpen}
          onClose={() => setIsSplitterOpen(false)}
          onSubmit={async (payload) => {
            const woNumber = `WO-${order.order_id}-${Math.floor(Math.random() * 100)}`;
            await createWorkOrder({
              blanket_po_id: payload.blanket_po_id,
              wo_number: woNumber,
              order_type: "Bulk",
              priority: "Normal",
              style_name: payload.style_name || order.style_no || "Standard Style",
              colorway: order.color || "Indigo",
              wash_process_type: payload.flavor_route,
              target_qty: payload.target_qty,
              size_breakdown: payload.size_matrix,
              current_stage_id: payload.starting_stage_id || 1,
              status: "Pending",
              apply_reference_code: order.PO_number || "",
            });
          }}
        />
      )}
    </AppShell>
  );
}
