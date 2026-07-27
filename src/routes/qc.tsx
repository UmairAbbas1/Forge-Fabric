import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell, KpiTile, SectionCard, StatusBadge, ProgressBar } from "../components/AppShell";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { X, Search, Plus, ShieldCheck } from "lucide-react";
import {
  validateQCCheckpointEligibility,
  validateQCQuantities,
  QC_PIPELINE_STAGES,
} from "../lib/qcGateValidation";

export const Route = createFileRoute("/qc")({
  head: () => ({
    meta: [
      { title: "QC Audits · Forge & Fabric" },
      { name: "description", content: "Final AQL results, checkpoint audits and inspection statistics across all production stages." },
    ],
  }),
  component: Page,
});

const QC_CHECKPOINTS = [
  "Material Check",
  "First Cut Approval",
  "Inline Sewing QC",
  "Wash-Finish Approval",
  "Final AQL-Packing Audit",
] as const;

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { qc, orders, addQCRecord, isOrderOnHold, isLoading, globalSearchQuery, setGlobalSearchQuery } = useAppData();

  // Add Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [checkpoint, setCheckpoint] = useState<typeof QC_CHECKPOINTS[number]>("Material Check");
  const [inspectedQty, setInspectedQty] = useState(100);
  const [passQty, setPassQty] = useState(98);
  const [rejectQty, setRejectQty] = useState(2);
  const [result, setResult] = useState<"Pass" | "Rework" | "Reject">("Pass");

  // Remove local search filter
  const [formError, setFormError] = useState("");

  // Role Guarding
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    } else if (!["admin", "production", "qc", "customer"].includes(user.role)) {
      navigate({ to: "/orders" });
    }
  }, [user, navigate]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.order_id === selectedOrderId),
    [orders, selectedOrderId]
  );

  const handleInspectedChange = (val: number) => {
    setInspectedQty(val);
    if (passQty > val) {
      setPassQty(val);
      setRejectQty(0);
    } else {
      setRejectQty(Math.max(0, val - passQty));
    }
  };

  const handlePassChange = (val: number) => {
    setPassQty(val);
    setRejectQty(Math.max(0, inspectedQty - val));
  };

  const handleRejectChange = (val: number) => {
    setRejectQty(val);
    setPassQty(Math.max(0, inspectedQty - val));
  };

  const totalInspected = qc.reduce((s, q) => s + q.inspected_qty, 0);
  const totalPass = qc.reduce((s, q) => s + q.pass_qty, 0);
  const totalReject = qc.reduce((s, q) => s + q.reject_qty, 0);
  const passPct = totalInspected > 0 ? Math.round((totalPass / totalInspected) * 100) : 0;
  const rejectPct = 100 - passPct;

  const totalAudits = qc.length;
  const passAudits = qc.filter((q) => q.result === "Pass").length;
  const auditPassRate = totalAudits > 0 ? Math.round((passAudits / totalAudits) * 100) : 0;

  const canEdit = user && ["admin", "qc", "production"].includes(user.role);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedOrder) {
      setFormError("Please select an order before logging a QC audit.");
      return;
    }

    // 1. Validate sequential process gate eligibility
    const gateCheck = validateQCCheckpointEligibility(selectedOrder, checkpoint, qc);
    if (!gateCheck.allowed) {
      setFormError(gateCheck.reason || "This checkpoint cannot be audited yet.");
      return;
    }

    // 2. Validate quantities
    const qtyCheck = validateQCQuantities(inspectedQty, passQty, rejectQty, selectedOrder.qty);
    if (!qtyCheck.valid) {
      setFormError(qtyCheck.error || "Invalid inspection quantities.");
      return;
    }

    addQCRecord({
      qc_id: `QA-${Date.now().toString().slice(-5)}`,
      order_id: selectedOrderId,
      stage_checkpoint: checkpoint,
      inspected_qty: inspectedQty,
      pass_qty: passQty,
      reject_qty: rejectQty,
      result,
      inspected_date: new Date().toISOString().slice(0, 10),
    });
    // Reset Form
    setSelectedOrderId("");
    setOrderQuery("");
    setInspectedQty(100);
    setPassQty(98);
    setRejectQty(2);
    setResult("Pass");
    setFormError("");
    setShowAddModal(false);
  };

  const filteredQC = useMemo(() => {
    const searchVal = globalSearchQuery?.toLowerCase()?.trim() || "";
    if (!searchVal) return qc;
    return qc.filter((item) => {
      const parentOrder = orders.find((o) => o.order_id === item.order_id);
      return (
        item.qc_id?.toLowerCase()?.includes(searchVal) ||
        item.order_id?.toLowerCase()?.includes(searchVal) ||
        item.stage_checkpoint?.toLowerCase()?.includes(searchVal) ||
        (parentOrder && parentOrder.customer_name?.toLowerCase()?.includes(searchVal)) ||
        (parentOrder && parentOrder.PO_number?.toLowerCase()?.includes(searchVal))
      );
    });
  }, [qc, orders, globalSearchQuery]);

  // Loading skeleton state
  if (qc.length === 0 && isLoading) {
    return (
      <AppShell>
        <div className="relative min-h-[400px] flex flex-col justify-start">
          {/* Skeleton Layout */}
          <div className="space-y-6 animate-pulse opacity-45 filter blur-[1px] select-none pointer-events-none">
            <div className="h-8 w-48 bg-muted rounded-md" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="h-24 bg-muted rounded-xl" />
              <div className="h-24 bg-muted rounded-xl" />
              <div className="h-24 bg-muted rounded-xl" />
              <div className="h-24 bg-muted rounded-xl" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-32 bg-muted rounded-xl" />
            </div>
            <div className="h-64 bg-muted rounded-xl" />
          </div>

          {/* Premium Loading Overlay */}
          <LoadingOverlay 
            message="Loading Quality Control..." 
            description="Syncing AQL checklists, inline sewing audits, defect logs, and final packing audits."
            icon={ShieldCheck}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Stage 11 · Quality Checkpoints</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold">Quality Control Audits</h1>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-primary hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Log QC Audit
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile label="Today Inspected (pcs)" value={totalInspected.toLocaleString()} accent="navy" />
          <KpiTile label="Inspected Pass (pcs)" value={totalPass.toLocaleString()} accent="success" />
          <KpiTile label="Inspected Reject (pcs)" value={totalReject.toLocaleString()} accent="destructive" />
          <KpiTile label="Audit Pass Rate" value={`${auditPassRate}%`} accent="gold" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="Quality Rates">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-success/10 border border-success/30 p-4 text-center">
                <div className="text-xs uppercase text-muted-foreground">Pass Rate (pcs)</div>
                <div className="mt-1 text-3xl font-display font-bold text-success">{passPct}%</div>
              </div>
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 text-center">
                <div className="text-xs uppercase text-muted-foreground">Reject Rate (pcs)</div>
                <div className="mt-1 text-3xl font-display font-bold text-destructive">{rejectPct}%</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Inspection Performance">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">AQL Target Audit Rate</span>
              <span className="text-2xl font-display font-bold text-success">98.5%</span>
            </div>
            <ProgressBar value={98} colorClass="bg-success" />
            <div className="mt-3 text-xs text-muted-foreground">
              AQL 2.5 standard enforced across all 5 production floor check sheets.
            </div>
          </SectionCard>
        </div>

        <SectionCard 
          title="Recent QC Inspections"
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Search order or checkpoint..."
                className="pl-8 pr-2 h-8 rounded-md border border-input bg-background text-xs w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
          }
        >
          {filteredQC.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No QC audits logged yet {canEdit && "— click Log QC Audit to add one."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2 pr-4">QC ID</th>
                    <th className="py-2 pr-4">Order ID</th>
                    <th className="py-2 pr-4">Checkpoint</th>
                    <th className="py-2 pr-4">Inspected</th>
                    <th className="py-2 pr-4">Pass</th>
                    <th className="py-2 pr-4">Reject</th>
                    <th className="py-2 pr-4">Result</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQC.slice(0, 40).map((q) => (
                    <tr key={q.qc_id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{q.qc_id}</td>
                      <td className="py-2.5 pr-4">
                        <Link to="/orders/$orderId" params={{ orderId: q.order_id }} className="text-secondary hover:underline">
                          {q.order_id}
                        </Link>
                        {isOrderOnHold(q.order_id) && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-destructive/15 text-destructive border border-destructive/25 uppercase tracking-wider">On Hold</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-xs font-semibold text-primary">{q.stage_checkpoint}</td>
                      <td className="py-2.5 pr-4">{q.inspected_qty.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-success">{q.pass_qty.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-destructive">{q.reject_qty.toLocaleString()}</td>
                      <td className="py-2.5 pr-4"><StatusBadge status={q.result} /></td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs">{q.inspected_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Log QC Audit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => { setShowAddModal(false); setFormError(""); }}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log QC Audit</h3>
            <p className="text-xs text-muted-foreground mb-4">Create quality check sheets audit card.</p>

            {formError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <span className="shrink-0">⚠</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Order Combobox */}
              <div className="relative">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary block mb-1">Select Order (Any Stage)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to search Order ID or Customer..."
                    value={orderQuery}
                    onChange={(e) => {
                      setOrderQuery(e.target.value);
                      setShowOrderDropdown(true);
                    }}
                    onFocus={() => setShowOrderDropdown(true)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary pl-8"
                    required
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                
                {showOrderDropdown && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-outline-variant rounded-lg max-h-48 overflow-y-auto shadow-lg z-50 divide-y divide-border">
                    {orders
                      .filter((o) => {
                        const matchesQuery = o.order_id.toLowerCase().includes(orderQuery.toLowerCase()) ||
                          o.customer_name.toLowerCase().includes(orderQuery.toLowerCase());
                        return matchesQuery;
                      })
                      .map((o) => (
                        <button
                          key={o.order_id}
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(o.order_id);
                            setOrderQuery(`${o.order_id} (${o.customer_name})`);
                            setShowOrderDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40 transition-colors block"
                        >
                          <span className="font-semibold block text-primary">{o.order_id}</span>
                          <span className="text-[10px] text-muted-foreground">{o.customer_name} &bull; Stage {o.current_stage}</span>
                        </button>
                      ))}
                    {orders.length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">No matching active orders.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">QC Stage Checkpoint</label>
                <select
                  value={checkpoint}
                  onChange={(e) => setCheckpoint(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs focus:outline-none"
                >
                  {QC_PIPELINE_STAGES.map((gate) => {
                    const check = selectedOrder
                      ? validateQCCheckpointEligibility(selectedOrder, gate.name, qc)
                      : { allowed: true };
                    const isLocked = !check.allowed;
                    return (
                      <option key={gate.name} value={gate.name} disabled={isLocked}>
                        {gate.name} {isLocked ? `(Locked — ${check.prereqName ? 'Requires ' + check.prereqName : 'Requires Stage ' + gate.minStage})` : ""}
                      </option>
                    );
                  })}
                </select>
                {selectedOrder && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Order Total Qty: <strong className="text-foreground">{selectedOrder.qty} pcs</strong> &bull; Current Stage: <strong className="text-foreground">{selectedOrder.current_stage}</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Inspected</label>
                  <input
                    type="number"
                    value={inspectedQty}
                    onChange={(e) => handleInspectedChange(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none"
                    required
                    min={1}
                    max={selectedOrder?.qty}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary text-success">Pass</label>
                  <input
                    type="number"
                    value={passQty}
                    onChange={(e) => handlePassChange(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none"
                    required
                    min={0}
                    max={inspectedQty}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary text-destructive">Reject</label>
                  <input
                    type="number"
                    value={rejectQty}
                    onChange={(e) => handleRejectChange(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none"
                    required
                    min={0}
                    max={inspectedQty}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">AQL Audit Result</label>
                <select
                  value={result}
                  onChange={(e) => setResult(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg border border-outline-variant text-sm focus:outline-none"
                >
                  <option value="Pass">Pass</option>
                  <option value="Rework">Rework</option>
                  <option value="Reject">Reject</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                Log QC Audit
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
