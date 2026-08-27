import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { useAppData, checkStageAdvancement } from "../hooks/useAppData";
import { usePermission } from "../hooks/usePermission";
import { OutsourceReturnQCPanel } from "../components/qc/OutsourceReturnQCPanel";
import { supabase, isRealSupabase } from "../lib/supabase";
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Search,
  Layers, Barcode, RotateCcw, Filter, EyeOff, User, Settings, X, Plus,
  Clock, Lock
} from "lucide-react";

export const Route = createFileRoute("/qc")({
  head: () => ({
    meta: [
      { title: "Unified QC & Root Cause Analysis · Forge & Fabric Industries, Inc. MES" },
      { name: "description", content: "Garment quality inspection, defect taxonomy logging, rework routing, and customer privacy protection." },
    ],
  }),
  component: QcShopFloorPage,
});

interface QcInspectionRecord {
  id: string;
  bundle_barcode: string;
  style_code: string;
  colorway: string;
  size_code: string;
  inspected_qty: number;
  passed_qty: number;
  failed_qty: number;
  defect_code?: string;
  defect_category?: string;
  rework_action?: string;
  result: "Pass" | "Rework" | "Reject";
  inspector_id?: string;
  operator_name_internal?: string; // Private to internal staff
  supervisor_name?: string; // Supervisor name
  machine_id_internal?: string; // Private to internal staff
  inspected_at: string;
}

interface DefectCodeOption {
  id: string;
  code: string;
  description: string;
  category: "Stitching" | "Fabric" | "Wash" | "Measurement" | "Trim";
}

const DEFAULT_DEFECT_TAXONOMY: DefectCodeOption[] = [
  { id: "d-1", code: "ST-01", description: "Skipped Stitching on Inseam", category: "Stitching" },
  { id: "d-2", code: "ST-02", description: "Broken Thread / Tension Loose", category: "Stitching" },
  { id: "d-3", code: "FB-01", description: "Fabric Slub / Weave Flaw", category: "Fabric" },
  { id: "d-4", code: "WS-01", description: "Uneven Wash Abrasion / Streak", category: "Wash" },
  { id: "d-5", code: "TR-01", description: "Missing Rivet / Loose Button", category: "Trim" },
];

const MOCK_QC_INSPECTIONS: QcInspectionRecord[] = [
  {
    id: "qc-1",
    bundle_barcode: "BND-501-RAW-30-01",
    style_code: "501-RAW-SEL",
    colorway: "Raw Indigo",
    size_code: "30",
    inspected_qty: 50,
    passed_qty: 50,
    failed_qty: 0,
    result: "Pass",
    operator_name_internal: "Operator John Doe (Station #4)",
    supervisor_name: "Supervisor Mike Evans",
    machine_id_internal: "JUKI-DL-9000",
    inspected_at: "2026-08-11 11:30",
  },
  {
    id: "qc-2",
    bundle_barcode: "BND-501-RAW-32-01",
    style_code: "501-RAW-SEL",
    colorway: "Raw Indigo",
    size_code: "32",
    inspected_qty: 50,
    passed_qty: 46,
    failed_qty: 4,
    defect_code: "ST-01",
    defect_category: "Stitching",
    rework_action: "Send to Rework Bench #2 for Inseam Re-stitching",
    result: "Rework",
    operator_name_internal: "Operator Sarah Jenkins (Station #2)",
    supervisor_name: "Supervisor Robert Chen",
    machine_id_internal: "BROTHER-S-7300",
    inspected_at: "2026-08-11 10:45",
  },
];

function GateStatusIcon({ state }: { state: "done" | "pending" | "locked" }) {
  if (state === "done") return <CheckCircle2 className="inline h-3 w-3 text-emerald-600" />;
  if (state === "pending") return <Clock className="inline h-3 w-3 text-amber-600" />;
  return <Lock className="inline h-3 w-3 text-muted-foreground" />;
}

function QcShopFloorPage() {
  const { user } = useAuth();
  const canManage = usePermission("qc", "update");
  const isCustomer = user?.role === "customer";

  // Pull orders from context so we can link QC records to order IDs (gate checks require this).
  // materials/cutting/sewing/wash power the Phase D ticket-existence gate below —
  // QC must not be able to inspect a stage for which no real ticket/work record
  // has ever been created (the root cause of the reported "QC completes stages
  // that were never ticketed" bug).
  const { orders, addQCRecord, materials, cutting, cutTickets, sewing, sewingTickets, wash, qc: qcRecords, cartons, outsourceRecords } = useAppData();

  const [inspections, setInspections] = useState<QcInspectionRecord[]>([]);
  const [defectCodes, setDefectCodes] = useState<DefectCodeOption[]>(DEFAULT_DEFECT_TAXONOMY);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Pass" | "Rework_Queue">("All");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Inspection Form State
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [checkpointName, setCheckpointName] = useState<
    "Material Check" | "First Cut Approval" | "Inline Sewing QC" | "Wash-Finish Approval" | "Final AQL-Packing Audit"
  >("Inline Sewing QC");
  const [scanBarcode, setScanBarcode] = useState("");
  const [styleCode, setStyleCode] = useState("");
  const [colorway, setColorway] = useState("");
  const [sizeCode, setSizeCode] = useState("32");
  // No hardcoded default — starts at 0 (nothing selected yet) and is set
  // from the real record's own quantity once an order+checkpoint+barcode
  // are chosen (see the effect below), never a stale/unrelated placeholder.
  const [inspectedQty, setInspectedQty] = useState(0);
  const [failedQty, setFailedQty] = useState(0);
  const [selectedDefectCode, setSelectedDefectCode] = useState("ST-01");
  const [reworkAction, setReworkAction] = useState("Re-stitch inseam line");
  // REQ-13: Rework labor/scrap capture for Cost of Poor Quality (COPQ) tracking
  const [reworkStation, setReworkStation] = useState("Rework Bench #1");
  const [reworkLaborMinutes, setReworkLaborMinutes] = useState(15);
  const [reworkScrapYards, setReworkScrapYards] = useState(0);
  const [operatorInternal, setOperatorInternal] = useState("Operator #8");
  const [supervisorName, setSupervisorName] = useState("Supervisor Mike Evans");
  const [machineInternal, setMachineInternal] = useState("JUKI-9000-B");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-populate style/colorway from selected order
  const selectedOrder = useMemo(
    () => orders.find((o) => o.order_id === selectedOrderId),
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (selectedOrder) {
      setStyleCode(selectedOrder.style_no || selectedOrder.order_id);
      setColorway(selectedOrder.color || "N/A");
    }
  }, [selectedOrder]);

  // Sequential QC Stage Gate Enforcement Rule:
  // An order cannot jump checkpoints until it has satisfied the prerequisite stage.
  const gateValidation = useMemo(() => {
    if (!selectedOrderId || !selectedOrder) return { allowed: true };

    const currentStage = selectedOrder.current_stage || 1;

    if (checkpointName === "First Cut Approval" && currentStage < 3) {
      return {
        allowed: false,
        message: `SEQUENTIAL GATE LOCK: Order [${selectedOrderId}] is currently at Stage ${currentStage}. It must pass Stage 3 (Material Check) before First Cut Approval can be conducted.`,
        requiredPrereq: "Material Check (Stage 3)",
      };
    }

    if (checkpointName === "Inline Sewing QC" && currentStage < 5) {
      return {
        allowed: false,
        message: `SEQUENTIAL GATE LOCK: Order [${selectedOrderId}] is currently at Stage ${currentStage}. It must pass First Cut Approval (Stage 5) before Inline Sewing QC can be conducted.`,
        requiredPrereq: "First Cut Approval (Stage 5)",
      };
    }

    if (checkpointName === "Wash-Finish Approval" && currentStage < 7) {
      return {
        allowed: false,
        message: `SEQUENTIAL GATE LOCK: Order [${selectedOrderId}] is currently at Stage ${currentStage}. It must pass Inline Sewing QC (Stage 7→8) before Wash-Finish Approval can be conducted.`,
        requiredPrereq: "Inline Sewing QC (Stage 7→8)",
      };
    }

    if (checkpointName === "Final AQL-Packing Audit" && currentStage < 10) {
      return {
        allowed: false,
        message: `SEQUENTIAL GATE LOCK: Order [${selectedOrderId}] is currently at Stage ${currentStage}. It must pass Wash-Finish Approval (Stage 10→11) before Final AQL-Packing Audit can be conducted.`,
        requiredPrereq: "Wash-Finish Approval (Stage 10→11)",
      };
    }

    return { allowed: true };
  }, [selectedOrderId, selectedOrder, checkpointName]);

  // Single shared source of truth for "has this order really passed gate
  // X" — the exact same checkStageAdvancement() the Kanban board and the
  // order detail page call. Previously the pipeline step indicator below
  // inferred "done" purely from selectedOrder.current_stage >= threshold,
  // which can silently disagree with the real gate logic (that's exactly
  // how this order showed "Sewing QC ✓ passed" here while the Kanban
  // correctly refused to advance it — two different, disagreeing checks).
  // Now both read the same function against the same real data.
  const realGateData = useMemo(() => ({
    materials, cutting, sewing, sewingTickets, qc: qcRecords, wash, cartons, outsourceRecords,
  }), [materials, cutting, sewing, sewingTickets, qcRecords, wash, cartons, outsourceRecords]);

  const gateStatus = useMemo(() => {
    if (!selectedOrder) {
      return { stage4: false, stage6: false, stage8: false, stage11: false, stage13: false };
    }
    const selectedStages = (selectedOrder as any).selected_stages as number[] | undefined;
    return {
      stage4: checkStageAdvancement(4, selectedOrderId, realGateData, selectedStages).allowed,
      stage6: checkStageAdvancement(6, selectedOrderId, realGateData, selectedStages).allowed,
      stage8: checkStageAdvancement(8, selectedOrderId, realGateData, selectedStages).allowed,
      stage11: checkStageAdvancement(11, selectedOrderId, realGateData, selectedStages).allowed,
      stage13: checkStageAdvancement(13, selectedOrderId, realGateData, selectedStages).allowed,
    };
  }, [selectedOrder, selectedOrderId, realGateData]);

  // Phase D fix: which real barcode/ticket identifiers exist for the
  // selected order at the selected checkpoint. QC can only inspect what's
  // actually in this list — no free-text barcode, no inspecting a stage
  // that has no real ticket/work record behind it.
  //
  // "First Cut Approval" reads cutTickets (the real cut_tickets table
  // src/routes/cutting.tsx writes to directly) rather than `cutting`
  // (cutting_records) — cutting_records is a legacy mirror table that
  // cutting.tsx best-effort upserts into as a side effect AFTER the real
  // write; a silent failure of that side-effect write (network hiccup,
  // constraint conflict, future RLS change) desyncs `cutting` from reality
  // with only a console.warn, and QC would false-negative a ticket that
  // genuinely exists. Matching directly on cut_tickets.work_order_id is
  // plain string equality — prefix-agnostic, works identically for WO-/PO-
  // bulk orders and SMP- sample orders, since it's just whatever the order's
  // real order_id is, whatever that string looks like.
  const availableBarcodes = useMemo(() => {
    if (!selectedOrderId) return [];
    let raw: string[];
    switch (checkpointName) {
      case "Material Check":
        raw = materials.filter((m) => m.order_id === selectedOrderId).map((m) => m.material_id);
        break;
      case "First Cut Approval":
        raw = cutTickets.filter((c) => c.work_order_id === selectedOrderId).map((c) => c.ticket_number);
        break;
      case "Inline Sewing QC":
        // Real sewing_tickets rows (the authoritative table sewing.tsx
        // writes to) — not `sewing` (sewing_bundles), which can carry
        // orphaned "Active" mirror rows from the cutting stage that were
        // never part of the ticket-based flow and would otherwise show up
        // here as phantom, unselectable-looking entries.
        raw = sewingTickets.filter((t) => t.work_order_id === selectedOrderId).map((t) => t.ticket_number);
        break;
      case "Wash-Finish Approval":
      case "Final AQL-Packing Audit":
        raw = wash.filter((w) => w.order_id === selectedOrderId).map((w) => w.batch_id);
        break;
      default:
        raw = [];
    }
    // Defensive dedup — this dropdown must never show a duplicate entry
    // even if something upstream (a stray mirror write, a future bug)
    // produces one again.
    return Array.from(new Set(raw));
  }, [selectedOrderId, checkpointName, materials, cutTickets, sewingTickets, wash]);

  const ticketTypeLabel: Record<typeof checkpointName, string> = {
    "Material Check": "material record",
    "First Cut Approval": "cut ticket",
    "Inline Sewing QC": "sewing ticket",
    "Wash-Finish Approval": "wash batch",
    "Final AQL-Packing Audit": "wash batch",
  };

  // Where to send the user to actually create the missing record — a
  // genuine "nothing exists yet" state is correct blocking behavior, but
  // the message should say exactly what to do next, not just that it's
  // blocked. Same mapping regardless of bulk vs sample order.
  const ticketCorrectivePage: Record<typeof checkpointName, { to: string; action: string }> = {
    "Material Check": { to: "/materials", action: "log the material receipt (GRN)" },
    "First Cut Approval": { to: "/cutting", action: "generate the cutting ticket" },
    "Inline Sewing QC": { to: "/sewing", action: "create the sewing bundle" },
    "Wash-Finish Approval": { to: "/wash", action: "log the wash batch" },
    "Final AQL-Packing Audit": { to: "/wash", action: "log the wash batch" },
  };

  const ticketValidation = useMemo(() => {
    if (!selectedOrderId) return { allowed: true };
    if (availableBarcodes.length === 0) {
      const corrective = ticketCorrectivePage[checkpointName];
      return {
        allowed: false,
        message: `No ${ticketTypeLabel[checkpointName]} has been generated for order [${selectedOrderId}] yet — QC cannot inspect a stage that hasn't started.`,
        correctiveTo: corrective.to,
        correctiveAction: corrective.action,
      };
    }
    return { allowed: true };
  }, [selectedOrderId, checkpointName, availableBarcodes]);

  // Keep the selected barcode pinned to a real, currently-available ticket
  // for this order+checkpoint — never a stale or fabricated value.
  useEffect(() => {
    if (availableBarcodes.length > 0 && !availableBarcodes.includes(scanBarcode)) {
      setScanBarcode(availableBarcodes[0]);
    } else if (availableBarcodes.length === 0 && scanBarcode) {
      setScanBarcode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableBarcodes]);

  // The real, correct ceiling for "Total Inspected Quantity" — the specific
  // record actually being inspected (its real quantity), falling back to
  // the order's real total only when the checkpoint has no per-record
  // quantity of its own. Never a static default: an order with 4 real
  // pieces caps at 4, an order with 5,000 caps at 5,000.
  const realInspectableQty = useMemo(() => {
    if (!scanBarcode) return selectedOrder?.qty || 0;
    switch (checkpointName) {
      case "Material Check": {
        const rec = materials.find((m) => m.material_id === scanBarcode);
        return rec?.qty_received || selectedOrder?.qty || 0;
      }
      case "First Cut Approval": {
        const rec = cutTickets.find((c) => c.ticket_number === scanBarcode);
        return rec?.total_planned_pcs || selectedOrder?.qty || 0;
      }
      case "Inline Sewing QC": {
        const rec = sewingTickets.find((t) => t.ticket_number === scanBarcode);
        return rec?.total_planned_pcs || selectedOrder?.qty || 0;
      }
      case "Wash-Finish Approval":
      case "Final AQL-Packing Audit": {
        const rec = wash.find((w) => w.batch_id === scanBarcode);
        return rec?.pcs_qty || selectedOrder?.qty || 0;
      }
      default:
        return selectedOrder?.qty || 0;
    }
  }, [scanBarcode, checkpointName, materials, cutTickets, sewingTickets, wash, selectedOrder]);

  // Reset the inspected quantity to the real value whenever the selected
  // record changes — never carries over a stale number from a previously
  // inspected (differently-sized) record.
  useEffect(() => {
    setInspectedQty(realInspectableQty);
    setFailedQty(0);
  }, [realInspectableQty]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let remoteInspections: QcInspectionRecord[] = [];
      if (isRealSupabase) {
        const { data: qData, error: qErr } = await supabase
          .from("qc_inspections")
          .select("*")
          .order("created_at", { ascending: false });

        if (!qErr && qData && qData.length > 0) {
          remoteInspections = qData.map((q: any) => ({
            id: q.id,
            bundle_barcode: q.bundle_barcode || `BND-${q.id.slice(0, 6)}`,
            style_code: q.style_code || "",
            colorway: q.colorway || "",
            size_code: q.size_code || "",
            inspected_qty: Number(q.inspected_qty || 0),
            passed_qty: Number(q.passed_qty || 0),
            failed_qty: Number(q.failed_qty || 0),
            defect_code: q.defect_code,
            defect_category: q.defect_category,
            rework_action: q.rework_action,
            result: q.result || (q.failed_qty > 0 ? "Rework" : "Pass"),
            operator_name_internal: q.operator_name_internal || "Line Operator",
            supervisor_name: q.supervisor_name || "Supervisor Mike Evans",
            machine_id_internal: q.machine_id_internal || "JUKI-01",
            inspected_at: q.created_at ? q.created_at.slice(0, 16).replace("T", " ") : new Date().toISOString().slice(0, 16),
          }));
        }
      }

      // Check local cache
      let localInspections: QcInspectionRecord[] = [];
      try {
        const cached = localStorage.getItem("forge_qc_inspections_cache");
        if (cached) {
          localInspections = JSON.parse(cached);
        }
      } catch (cacheErr) {
        console.warn("QC cache read warning:", cacheErr);
      }

      // Merge and deduplicate by bundle_barcode or id
      const mergedMap = new Map<string, QcInspectionRecord>();
      remoteInspections.forEach((i) => mergedMap.set((i.bundle_barcode || i.id).trim(), i));
      localInspections.forEach((i) => {
        const key = (i.bundle_barcode || i.id).trim();
        if (!mergedMap.has(key)) {
          mergedMap.set(key, i);
        } else {
          // If remote inspection is missing defect/operator details, enrich it
          const existing = mergedMap.get(key)!;
          mergedMap.set(key, {
            ...existing,
            defect_code: existing.defect_code || i.defect_code,
            defect_category: existing.defect_category || i.defect_category,
            rework_action: existing.rework_action || i.rework_action,
            operator_name_internal: existing.operator_name_internal || i.operator_name_internal,
            supervisor_name: existing.supervisor_name || i.supervisor_name,
            machine_id_internal: existing.machine_id_internal || i.machine_id_internal,
          });
        }
      });

      const finalInspections = Array.from(mergedMap.values());
      setInspections(finalInspections.length > 0 ? finalInspections : MOCK_QC_INSPECTIONS);
    } catch (e) {
      console.error(e);
      setInspections(MOCK_QC_INSPECTIONS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 5. Real-time sync across Admin, QC, and Production accounts
    if (isRealSupabase) {
      const channel = supabase
        .channel("qc_realtime_sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "qc_inspections" }, () => {
          loadData();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "qc_records" }, () => {
          loadData();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
          loadData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  // Update QC Inspection Status directly from table with cross-pipeline sync
  const handleUpdateInspectionResult = async (
    inspection: QcInspectionRecord,
    newResult: "Pass" | "Rework" | "Reject"
  ) => {
    try {
      const updatedFailedQty = newResult === "Pass" ? 0 : (inspection.failed_qty > 0 ? inspection.failed_qty : 1);
      const updatedPassedQty = Math.max(0, inspection.inspected_qty - updatedFailedQty);

      const updatedRecord: QcInspectionRecord = {
        ...inspection,
        result: newResult,
        passed_qty: updatedPassedQty,
        failed_qty: updatedFailedQty,
      };

      // 1. Optimistic UI update
      setInspections((prev) =>
        prev.map((i) => (i.id === inspection.id || i.bundle_barcode === inspection.bundle_barcode ? updatedRecord : i))
      );

      // 2. Local cache persistence
      try {
        const cached: QcInspectionRecord[] = JSON.parse(localStorage.getItem("forge_qc_inspections_cache") || "[]");
        const updatedCache = cached.map((c) => 
          (c.id === inspection.id || c.bundle_barcode === inspection.bundle_barcode) ? updatedRecord : c
        );
        if (!updatedCache.some(c => c.bundle_barcode === inspection.bundle_barcode)) {
          updatedCache.unshift(updatedRecord);
        }
        localStorage.setItem("forge_qc_inspections_cache", JSON.stringify(updatedCache));
      } catch (cacheErr) {
        console.warn("QC cache notice:", cacheErr);
      }

      // 3. Supabase backend sync
      if (isRealSupabase) {
        try {
          await supabase
            .from("qc_inspections")
            .update({
              result: newResult,
              passed_qty: updatedPassedQty,
              failed_qty: updatedFailedQty,
            })
            .or(`id.eq.${inspection.id},bundle_barcode.eq.${inspection.bundle_barcode}`);
        } catch (dbErr) {
          console.warn("qc_inspections update notice:", dbErr);
        }

      }

      // Safely resolve targetOrderId from active orders
      const targetOrderId = orders.find(
        (o) => o.order_id === inspection.style_code || o.style_no === inspection.style_code || o.PO_number === inspection.style_code
      )?.order_id || orders[0]?.order_id || "ORD-001";

      // Write to qc_records (handles Supabase DB insert + React Query invalidation + local state)
      addQCRecord({
        qc_id: `QCR-${Date.now()}`,
        order_id: targetOrderId,
        stage_checkpoint: "Inline Sewing QC",
        result: newResult === "Rework" ? "Rework" : newResult === "Reject" ? "Reject" : "Pass",
        inspected_qty: inspection.inspected_qty,
        pass_qty: updatedPassedQty,
        reject_qty: updatedFailedQty,
        inspected_date: new Date().toISOString().slice(0, 10),
      });

      setStatusMsg({
        type: newResult === "Pass" ? "success" : "error",
        text: `QC Status for "${inspection.bundle_barcode}" updated to "${newResult}". Stage gate & pipeline synced!`,
      });
    } catch (err: any) {
      console.error("Failed to update QC result:", err);
      setStatusMsg({
        type: "error",
        text: `Failed to update QC status: ${err.message || "Unknown error"}`,
      });
    }
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        i.bundle_barcode.toLowerCase().includes(q) ||
        i.style_code.toLowerCase().includes(q) ||
        (i.defect_code && i.defect_code.toLowerCase().includes(q));

      const matchTab =
        activeTab === "All" ||
        (activeTab === "Pass" && i.result === "Pass") ||
        (activeTab === "Rework_Queue" && i.result === "Rework");

      return matchSearch && matchTab;
    });
  }, [inspections, searchQuery, activeTab]);

  // Submit Inspection Record
  const handleLogInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedOrderId) {
      setFormError("Please select a valid production order to link with this QC audit.");
      return;
    }

    // Enforce sequential stage gates
    if (!gateValidation.allowed) {
      setFormError(gateValidation.message || "Sequential Gate Enforcement: Prerequisite gate has not been passed.");
      return;
    }

    // Phase D: QC cannot inspect a stage with no real ticket/work record
    if (!ticketValidation.allowed) {
      setFormError(ticketValidation.message || "No ticket exists for this checkpoint.");
      return;
    }

    const cleanBarcode = scanBarcode.trim().toUpperCase();
    if (!cleanBarcode) {
      setFormError("Select a real bundle/ticket barcode for this order — none is currently available.");
      return;
    }

    if (inspectedQty <= 0) {
      setFormError("Inspected quantity must be greater than 0.");
      return;
    }

    if (realInspectableQty > 0 && inspectedQty > realInspectableQty) {
      setFormError(`Inspected quantity (${inspectedQty}) cannot exceed the real quantity for this record (${realInspectableQty} pcs).`);
      return;
    }

    if (failedQty < 0 || failedQty > inspectedQty) {
      setFormError("Failed quantity cannot exceed inspected quantity or be negative.");
      return;
    }

    setIsSubmitting(true);
    const passQty = Math.max(0, inspectedQty - failedQty);
    const overallResult: "Pass" | "Rework" | "Reject" = failedQty === 0 ? "Pass" : "Rework";
    const matchedDefect = defectCodes.find((d) => d.code === selectedDefectCode);

    const newRecord: QcInspectionRecord = {
      id: `qc-${Date.now()}`,
      bundle_barcode: cleanBarcode,
      style_code: styleCode || selectedOrder?.style_no || selectedOrderId,
      colorway: colorway || selectedOrder?.color || "N/A",
      size_code: sizeCode,
      inspected_qty: inspectedQty,
      passed_qty: passQty,
      failed_qty: failedQty,
      defect_code: failedQty > 0 ? selectedDefectCode : undefined,
      defect_category: failedQty > 0 ? matchedDefect?.category : undefined,
      rework_action: failedQty > 0 ? reworkAction : undefined,
      result: overallResult,
      operator_name_internal: operatorInternal,
      supervisor_name: supervisorName,
      machine_id_internal: machineInternal,
      inspected_at: new Date().toISOString().slice(0, 16).replace("T", " "),
    };

    try {
      if (isRealSupabase) {
        // 1. Write to qc_inspections (shop floor detail log)
        try {
          const { error: inspErr } = await supabase.from("qc_inspections").insert({
            bundle_barcode: cleanBarcode,
            style_code: styleCode || selectedOrder?.style_no || selectedOrderId,
            colorway: colorway || selectedOrder?.color || "N/A",
            size_code: sizeCode,
            inspected_qty: inspectedQty,
            passed_qty: passQty,
            failed_qty: failedQty,
            defect_code: failedQty > 0 ? selectedDefectCode : null,
            defect_category: failedQty > 0 ? matchedDefect?.category : null,
            rework_action: failedQty > 0 ? reworkAction : null,
            result: overallResult,
            stage_checkpoint: checkpointName,
            operator_name_internal: operatorInternal,
            supervisor_name: supervisorName,
            machine_id_internal: machineInternal,
          });
          if (inspErr) console.warn("qc_inspections schema notice:", inspErr.message);
        } catch (dbErr) {
          console.warn("qc_inspections fallback notice:", dbErr);
        }

        // REQ-13: Log rework labor/scrap for Cost of Poor Quality (COPQ) tracking
        if (overallResult === "Rework") {
          try {
            await supabase.from("rework_logs").insert({
              order_id: selectedOrderId,
              bundle_barcode: cleanBarcode,
              stage_number: selectedOrder?.current_stage || null,
              station_name: reworkStation,
              defect_type: matchedDefect?.description || selectedDefectCode,
              quantity_reworked: failedQty,
              operator_id: operatorInternal,
              labor_minutes_spent: reworkLaborMinutes,
              scrap_yards_consumed: reworkScrapYards,
              logged_by: supervisorName,
            });
          } catch (reworkErr) {
            console.warn("rework_logs insert notice:", reworkErr);
          }
        }

        // Phase D: QC inspects and passes/fails — it does NOT advance the
        // order's stage. A Pass here writes the qc_records row that
        // checkStageAdvancement() (and the DB trigger's ticket-existence
        // backstops) already require before admin/production can advance
        // the order via Kanban or the order detail page's StageNavigator.
        // Advancing directly from here bypassed every one of those gates.
      }

      // Always update UI state and local cache so user sees audit immediately
      setInspections((prev) => [newRecord, ...prev]);

      try {
        const existing = JSON.parse(localStorage.getItem("forge_qc_inspections_cache") || "[]");
        localStorage.setItem("forge_qc_inspections_cache", JSON.stringify([newRecord, ...existing]));
      } catch (cacheErr) {
        console.warn("QC cache write notice:", cacheErr);
      }

      // Also write to qc_records (local state via useAppData)
      addQCRecord({
        qc_id: `QCR-${Date.now()}`,
        order_id: selectedOrderId,
        stage_checkpoint: checkpointName,
        result: overallResult === "Rework" ? "Rework" : "Pass",
        inspected_qty: inspectedQty,
        pass_qty: passQty,
        reject_qty: failedQty,
        inspected_date: new Date().toISOString().slice(0, 10),
      });

      setStatusMsg({
        type: "success",
        text: `QC Inspection logged for "${cleanBarcode}" — Order ${selectedOrderId} / Checkpoint: ${checkpointName}. Result: ${overallResult} (${passQty}/${inspectedQty} Passed).${
          overallResult === "Pass" ? " Admin/Production can now advance this order's stage." : ""
        }`,
      });
      setScanBarcode("");
      setFailedQty(0);
      setReworkLaborMinutes(15);
      setReworkScrapYards(0);
    } catch (err: any) {
      setFormError(err.message || "Failed to log QC inspection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Unified Quality Control &amp; Inspection
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 font-medium">
              Garment quality checkpoints, defect root-cause logging, rework routing, and customer privacy protection.
            </p>
          </div>

          {/* Privacy Indicator Badge */}
          {isCustomer && (
            <div className="bg-sky-50 text-sky-800 border border-sky-200 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <EyeOff className="h-4 w-4 text-sky-600" /> Customer Shield Active (Operator Confidentiality)
            </div>
          )}
        </div>

        {/* QC KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card border-2 border-border p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Audited Bundles</span>
            <div className="text-2xl font-black font-mono text-foreground">{inspections.length} Bundles</div>
            <p className="text-[11px] text-muted-foreground">Logged inspection audits</p>
          </div>

          <div className="bg-card border-2 border-emerald-200 bg-emerald-50/30 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Passed / Approved</span>
            <div className="text-2xl font-black font-mono text-emerald-700">
              {inspections.filter(i => i.result === "Pass").length} Bundles
            </div>
            <p className="text-[11px] text-emerald-800 font-medium">Stage Gates Unlocked</p>
          </div>

          <div className="bg-card border-2 border-red-200 bg-red-50/30 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-800">Rework Queue</span>
            <div className="text-2xl font-black font-mono text-red-700">
              {inspections.filter(i => i.result === "Rework").length} Bundles
            </div>
            <p className="text-[11px] text-red-800 font-medium">Defects Routed for Repair</p>
          </div>

          <div className="bg-card border-2 border-sky-200 bg-sky-50/30 p-4 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-800">First-Pass Yield (FPY)</span>
            <div className="text-2xl font-black font-mono text-sky-700">
              {inspections.length > 0 
                ? `${Math.round((inspections.filter(i => i.result === "Pass").length / inspections.length) * 100)}%`
                : "100%"}
            </div>
            <p className="text-[11px] text-sky-800 font-medium">Quality Compliance Rate</p>
          </div>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
            statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* REQ-15 Section 4D: Outsource Return QC — mandatory inspection gate
            for work returned from an external vendor. RLS on outsource_return_qc
            already restricts this to is_internal_staff(), and !isCustomer here
            is belt-and-suspenders so the section never even mounts for a
            customer session. */}
        {!isCustomer && <OutsourceReturnQCPanel />}

        {/* LOG QC INSPECTION FORM (For Inspectors & Admins) */}
        {canManage && (
          <div className="bg-card border-2 border-primary/30 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Audit &amp; Log Garment QC Inspection
                </h3>
                <p className="text-xs text-muted-foreground">
                  Scan bundle tag, enter defect codes, and route to pass dock or rework queue.
                </p>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleLogInspection} className="space-y-4">
              {/* Order selector + Checkpoint selector — CRITICAL for stage gate writes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Linked Production Order <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  >
                    <option value="">— Select order —</option>
                    {orders
                      .filter((o) => o.status !== "Shipped")
                      .map((o) => (
                        <option key={o.order_id} value={o.order_id}>
                          [{o.order_id}] {o.customer_name} — Stage {o.current_stage}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    QC Checkpoint (Gate Unlock) <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={checkpointName}
                    onChange={(e) => setCheckpointName(e.target.value as typeof checkpointName)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  >
                    <option value="Material Check">Material Check (Stage 3)</option>
                    <option value="First Cut Approval">First Cut Approval (Stage 5)</option>
                    <option value="Inline Sewing QC">Inline Sewing QC (Stage 7→8 gate)</option>
                    <option value="Wash-Finish Approval">Wash-Finish Approval (Stage 11)</option>
                    <option value="Final AQL-Packing Audit">Final AQL-Packing Audit (Stage 12→13 gate)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Real Ticket / Bundle Barcode <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    disabled={availableBarcodes.length === 0}
                    value={scanBarcode}
                    onChange={(e) => setScanBarcode(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold disabled:opacity-50"
                  >
                    {availableBarcodes.length === 0 ? (
                      <option value="">No {ticketTypeLabel[checkpointName]} exists for this order</option>
                    ) : (
                      availableBarcodes.map((b) => <option key={b} value={b}>{b}</option>)
                    )}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Only real {ticketTypeLabel[checkpointName]}s for the selected order — no free-text entry.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Total Inspected Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={realInspectableQty > 0 ? realInspectableQty : undefined}
                    required
                    value={inspectedQty}
                    onChange={(e) => setInspectedQty(Number(e.target.value))}
                    className={`w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold ${
                      realInspectableQty > 0 && inspectedQty > realInspectableQty ? "border-red-400 focus:ring-red-400" : ""
                    }`}
                  />
                  {realInspectableQty > 0 && inspectedQty > realInspectableQty && (
                    <p className="text-[10px] text-red-600 font-bold mt-1">
                      Cannot exceed the real quantity for this record ({realInspectableQty} pcs).
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Failed Defect Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={inspectedQty}
                    value={failedQty}
                    onChange={(e) => setFailedQty(Number(e.target.value))}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold text-red-600"
                  />
                </div>

              </div>

              {failedQty > 0 && (
                <div className="p-4 bg-red-50/50 border border-red-200 rounded-2xl space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-red-900 block mb-1">
                        Defect Code Taxonomy (Admin Configurable)
                      </label>
                      <select
                        value={selectedDefectCode}
                        onChange={(e) => setSelectedDefectCode(e.target.value)}
                        className="w-full p-2.5 border rounded-xl bg-background text-xs font-bold text-foreground"
                      >
                        {defectCodes.map((d) => (
                          <option key={d.id} value={d.code}>
                            [{d.code}] {d.description} ({d.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-red-900 block mb-1">
                        Required Rework Action Instructions
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Re-stitch waistband tension line..."
                        value={reworkAction}
                        onChange={(e) => setReworkAction(e.target.value)}
                        className="w-full p-2.5 border rounded-xl bg-background text-xs"
                      />
                    </div>
                  </div>

                  {/* REQ-13: Rework Cost Capture (labor + scrap → COPQ) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-red-200">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-red-900 block mb-1">
                        Rework Station
                      </label>
                      <input
                        type="text"
                        value={reworkStation}
                        onChange={(e) => setReworkStation(e.target.value)}
                        className="w-full p-2.5 border rounded-xl bg-background text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-red-900 block mb-1">
                        Labor Minutes Spent
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={reworkLaborMinutes}
                        onChange={(e) => setReworkLaborMinutes(Number(e.target.value))}
                        className="w-full p-2.5 border rounded-xl bg-background text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-red-900 block mb-1">
                        Scrap Fabric Yards
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={reworkScrapYards}
                        onChange={(e) => setReworkScrapYards(Number(e.target.value))}
                        className="w-full p-2.5 border rounded-xl bg-background text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sequential Stage Gate Enforcement & Prerequisite Banner */}
              {selectedOrder && (
                <div className="p-4 bg-muted/40 border rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-muted-foreground">
                      Sequential QC Pipeline &amp; Stage Gates for [{selectedOrderId}]
                    </span>
                    <span className="font-mono font-bold text-primary">
                      Current Stage: {selectedOrder.current_stage} ({selectedOrder.customer_name})
                    </span>
                  </div>

                  {/* Visual Step Indicator — "done" now comes from the same
                      real checkStageAdvancement() call the Kanban board and
                      order detail page use (see gateStatus above), not just
                      current_stage. The "pending"/"locked" tiers still use
                      current_stage as a rough progress indicator, but a gate
                      can never show "done" here unless the real underlying
                      data actually supports it. */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-bold">
                    <div className={`p-2 rounded-xl border text-center ${
                      gateStatus.stage4
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-amber-50 text-amber-900 border-amber-300"
                    }`}>
                      <div>Stage 3 Gate</div>
                      <div className="text-[10px] opacity-80">Material Check <GateStatusIcon state={gateStatus.stage4 ? "done" : "pending"} /></div>
                    </div>

                    <div className={`p-2 rounded-xl border text-center ${
                      gateStatus.stage6
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : (selectedOrder.current_stage || 1) >= 4
                        ? "bg-amber-50 text-amber-900 border-amber-300"
                        : "bg-muted text-muted-foreground border-border opacity-60"
                    }`}>
                      <div>Stage 5 Gate</div>
                      <div className="text-[10px] opacity-80">First Cut <GateStatusIcon state={gateStatus.stage6 ? "done" : (selectedOrder.current_stage || 1) >= 4 ? "pending" : "locked"} /></div>
                    </div>

                    <div className={`p-2 rounded-xl border text-center ${
                      gateStatus.stage8
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : (selectedOrder.current_stage || 1) >= 6
                        ? "bg-amber-50 text-amber-900 border-amber-300"
                        : "bg-muted text-muted-foreground border-border opacity-60"
                    }`}>
                      <div>Stage 7→8 Gate</div>
                      <div className="text-[10px] opacity-80">Sewing QC <GateStatusIcon state={gateStatus.stage8 ? "done" : (selectedOrder.current_stage || 1) >= 6 ? "pending" : "locked"} /></div>
                    </div>

                    <div className={`p-2 rounded-xl border text-center ${
                      gateStatus.stage11
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : (selectedOrder.current_stage || 1) >= 8
                        ? "bg-amber-50 text-amber-900 border-amber-300"
                        : "bg-muted text-muted-foreground border-border opacity-60"
                    }`}>
                      <div>Stage 10→11 Gate</div>
                      <div className="text-[10px] opacity-80">Wash Approval <GateStatusIcon state={gateStatus.stage11 ? "done" : (selectedOrder.current_stage || 1) >= 8 ? "pending" : "locked"} /></div>
                    </div>

                    <div className={`p-2 rounded-xl border text-center ${
                      gateStatus.stage13
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : (selectedOrder.current_stage || 1) >= 11
                        ? "bg-amber-50 text-amber-900 border-amber-300"
                        : "bg-muted text-muted-foreground border-border opacity-60"
                    }`}>
                      <div>Stage 12→13 Gate</div>
                      <div className="text-[10px] opacity-80">Final AQL <GateStatusIcon state={gateStatus.stage13 ? "done" : (selectedOrder.current_stage || 1) >= 11 ? "pending" : "locked"} /></div>
                    </div>
                  </div>

                  {!gateValidation.allowed && (
                    <div className="p-3 bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                      <span>{gateValidation.message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Internal Operator & Supervisor Confidentiality Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Internal Operator Name
                  </label>
                  <input
                    type="text"
                    value={operatorInternal}
                    onChange={(e) => setOperatorInternal(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-background font-medium"
                    placeholder="Operator #4"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Supervisor Name <span className="text-primary font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-background font-semibold text-foreground"
                    placeholder="e.g. Supervisor Mike Evans"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Internal Sewing Machine ID
                  </label>
                  <input
                    type="text"
                    value={machineInternal}
                    onChange={(e) => setMachineInternal(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-background font-mono"
                    placeholder="JUKI-9000-B"
                  />
                </div>
              </div>

              {gateValidation.allowed && !ticketValidation.allowed && (
                <div className="p-3 bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                  <div className="space-y-1.5">
                    <span className="block">{ticketValidation.message}</span>
                    {ticketValidation.correctiveTo && (
                      <Link
                        to={ticketValidation.correctiveTo}
                        className="inline-flex items-center gap-1 text-amber-900 underline decoration-amber-500 hover:text-amber-700 font-extrabold"
                      >
                        Go {ticketValidation.correctiveAction} for this order first, then return here to inspect it →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !gateValidation.allowed || !ticketValidation.allowed || (realInspectableQty > 0 && inspectedQty > realInspectableQty)}
                  className={`px-6 py-3 font-extrabold rounded-2xl text-xs shadow-md transition-all ${
                    !gateValidation.allowed || !ticketValidation.allowed || (realInspectableQty > 0 && inspectedQty > realInspectableQty)
                      ? "bg-muted text-muted-foreground cursor-not-allowed border opacity-60"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  }`}
                >
                  {!gateValidation.allowed
                    ? `Locked (Must Pass ${gateValidation.requiredPrereq || "Previous Gate"})`
                    : !ticketValidation.allowed
                    ? `Locked (No ${ticketTypeLabel[checkpointName]} exists)`
                    : `Log QC Inspection Result (${Math.max(0, inspectedQty - failedQty)} Pass / ${failedQty} Fail)`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TABS & INSPECTIONS DIRECTORY */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("All")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "All" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                All Audits ({inspections.length})
              </button>
              <button
                onClick={() => setActiveTab("Pass")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "Pass" ? "bg-emerald-600 text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Passed Audits
              </button>
              <button
                onClick={() => setActiveTab("Rework_Queue")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "Rework_Queue" ? "bg-red-600 text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Rework Queue ({inspections.filter((i) => i.result === "Rework").length})
              </button>
            </div>

            <div className="relative w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search barcode, style..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-background border rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Bundle Barcode</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Style &amp; Size</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Pass / Fail Qty</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">QC Result</th>
                  {!isCustomer && (
                    <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Internal Operator Details</th>
                  )}
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Inspected At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                      Loading quality inspection logs...
                    </td>
                  </tr>
                ) : filteredInspections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No inspection records found for this view.
                    </td>
                  </tr>
                ) : (
                  filteredInspections.map((i) => (
                    <tr key={i.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-primary">{i.bundle_barcode}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground">{i.style_code}</div>
                        <div className="text-[10px] text-muted-foreground">{i.colorway} • Size: {i.size_code}</div>
                      </td>

                      <td className="px-5 py-4 text-right font-mono font-bold">
                        <span className="text-emerald-600">{i.passed_qty} Pass</span> /{" "}
                        <span className="text-red-600">{i.failed_qty} Fail</span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <select
                              value={i.result}
                              onChange={(e) => handleUpdateInspectionResult(i, e.target.value as any)}
                              disabled={!canManage}
                              className={`px-2.5 py-1 rounded-full font-black text-[10px] border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                                i.result === "Pass"
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200"
                                  : i.result === "Reject"
                                  ? "bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200"
                                  : "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                              }`}
                            >
                              <option value="Pass">Passed (Unlock Gate)</option>
                              <option value="Rework">↺ Rework (Repair Line)</option>
                              <option value="Reject">Rejected (Scrap/Quarantine)</option>
                            </select>

                            {canManage && i.result !== "Pass" && (
                              <button
                                onClick={() => handleUpdateInspectionResult(i, "Pass")}
                                title="Approve and unlock next stage gate"
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold flex items-center gap-0.5 shadow-xs transition-all cursor-pointer"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Pass
                              </button>
                            )}

                            {canManage && i.result === "Pass" && (
                              <button
                                onClick={() => handleUpdateInspectionResult(i, "Rework")}
                                title="Flag for rework"
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[10px] font-bold flex items-center gap-0.5 shadow-xs transition-all cursor-pointer"
                              >
                                <RotateCcw className="h-3 w-3" /> Flag Rework
                              </button>
                            )}
                          </div>

                          {i.result === "Rework" && i.rework_action && (
                            <div className="text-[10px] text-amber-800 italic max-w-xs bg-amber-50/60 px-2 py-0.5 rounded border border-amber-200">
                              {i.rework_action}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Customer Privacy Enforcement (Operator & Supervisor Details) */}
                      {!isCustomer && (
                        <td className="px-5 py-4 font-mono text-[11px] text-muted-foreground">
                          <div className="font-semibold text-foreground">{i.operator_name_internal || "Line Operator"}</div>
                          <div className="text-[10px] text-primary font-bold">Sup: {i.supervisor_name || "Supervisor Mike Evans"}</div>
                          <div className="text-[10px] text-muted-foreground/70">{i.machine_id_internal || "JUKI-DL"}</div>
                        </td>
                      )}

                      <td className="px-5 py-4 text-right font-mono text-muted-foreground">
                        {i.inspected_at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
