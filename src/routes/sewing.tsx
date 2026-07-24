import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell, KpiTile, SectionCard, StatusBadge, ProgressBar } from "../components/AppShell";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { X, Search, Plus, Cog } from "lucide-react";

export const Route = createFileRoute("/sewing")({
  head: () => ({
    meta: [
      { title: "Sewing WIP · Forge & Fabric" },
      { name: "description", content: "Live sewing floor: active lines, operators, WIP bundles, and inline QC breakdown." },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sewing, orders, equipment, addSewingBundle, updateSewingBundle, isOrderOnHold, isLoading, globalSearchQuery, setGlobalSearchQuery } = useAppData();

  // Add Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [lineNumber, setLineNumber] = useState<number>(1);
  const [operatorCount, setOperatorCount] = useState(15);
  const [qty, setQty] = useState(250);
  const [inlineQcResult, setInlineQcResult] = useState<"Pass" | "Rework" | "Reject">("Pass");

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

  // Load sewing lines
  const sewingLines = equipment.filter((eq) => eq.type === "Sewing Line" && eq.status === "Active");
  useEffect(() => {
    if (sewingLines.length > 0) {
      const match = sewingLines[0].name.match(/\d+/);
      if (match) {
        setLineNumber(parseInt(match[0], 10));
      }
    }
  }, [sewingLines]);

  const activeLines = new Set(sewing.filter((s) => s.status === "Active").map((s) => s.line_number)).size;
  const operators = sewing.reduce((sum, s) => sum + s.operator_count, 0);
  const wipBundles = sewing.filter((s) => s.status === "Active").length;

  const totalQty = sewing.reduce((s, b) => s + b.qty, 0);
  const completedQty = sewing.filter((b) => b.status === "Completed").reduce((s, b) => s + b.qty, 0);
  const sewProgress = totalQty > 0 ? Math.round((completedQty / totalQty) * 100) : 0;

  const pass = sewing.filter((b) => b.inline_qc_result === "Pass").length;
  const rework = sewing.filter((b) => b.inline_qc_result === "Rework").length;
  const reject = sewing.filter((b) => b.inline_qc_result === "Reject").length;
  const t = pass + rework + reject || 1;
  const passPct = Math.round((pass / t) * 100);
  const reworkPct = Math.round((rework / t) * 100);
  const rejectPct = 100 - passPct - reworkPct;

  const canEdit = user && ["admin", "production"].includes(user.role);

  const handleUpdateField = (bundleId: string, field: string, value: any) => {
    updateSewingBundle(bundleId, { [field]: value });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedOrderId) {
      setFormError("Please select an order before logging a sewing bundle.");
      return;
    }
    const selOrder = orders.find((o) => o.order_id === selectedOrderId);
    if (selOrder) {
      if (qty > selOrder.qty) {
        setFormError(`Bundle quantity (${qty}) cannot exceed total Order Quantity (${selOrder.qty}).`);
        return;
      }
      if (selOrder.current_stage < 5) {
        setFormError(`Order ${selOrder.order_id} is currently at Stage ${selOrder.current_stage}. Sewing requires Order to reach Stage 5 (Cutting / Marker Approval) or higher.`);
        return;
      }
    }
    if (qty <= 0) {
      setFormError("Bundle quantity must be greater than zero.");
      return;
    }
    if (operatorCount <= 0) {
      setFormError("Operator count must be at least 1.");
      return;
    }
    addSewingBundle({
      bundle_id: `BDL-${Date.now().toString().slice(-5)}`,
      order_id: selectedOrderId,
      line_number: lineNumber,
      operator_count: operatorCount,
      qty,
      status: "Active",
      inline_qc_result: inlineQcResult,
    });
    // Reset Form
    setSelectedOrderId("");
    setOrderQuery("");
    setOperatorCount(15);
    setQty(250);
    setInlineQcResult("Pass");
    setFormError("");
    setShowAddModal(false);
  };

  const filteredSewing = useMemo(() => {
    const qLow = globalSearchQuery?.toLowerCase()?.trim() || "";
    if (!qLow) return sewing;
    return sewing.filter((s) => {
      const parentOrder = orders.find((o) => o.order_id === s.order_id);
      return (
        s.bundle_id?.toLowerCase()?.includes(qLow) ||
        s.order_id?.toLowerCase()?.includes(qLow) ||
        `line ${s.line_number}`?.toLowerCase()?.includes(qLow) ||
        (parentOrder && parentOrder.customer_name?.toLowerCase()?.includes(qLow)) ||
        (parentOrder && parentOrder.PO_number?.toLowerCase()?.includes(qLow))
      );
    });
  }, [sewing, orders, globalSearchQuery]);

  // Loading skeleton state
  if (sewing.length === 0 && isLoading) {
    return (
      <AppShell>
        <div className="relative min-h-[400px] flex flex-col justify-start">
          {/* Skeleton Layout */}
          <div className="space-y-6 animate-pulse opacity-45 filter blur-[1px] select-none pointer-events-none">
            <div className="h-8 w-48 bg-muted rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="h-24 bg-muted rounded-xl" />
              <div className="h-24 bg-muted rounded-xl" />
              <div className="h-24 bg-muted rounded-xl" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-48 bg-muted rounded-xl" />
            </div>
            <div className="h-64 bg-muted rounded-xl" />
          </div>

          {/* Premium Loading Overlay */}
          <LoadingOverlay 
            message="Loading Sewing Floor..." 
            description="Syncing active assembly lines, bundle registers, operator logs, and WIP counts."
            icon={Cog}
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
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Stage 6 · 7 · 8</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold">Sewing WIP Dashboard</h1>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-primary hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Log Sewing Bundle
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiTile label="Lines Active" value={activeLines} accent="navy" hint="Sewing lines currently running" />
          <KpiTile label="Operators" value={operators} accent="gold" />
          <KpiTile label="WIP Bundles" value={wipBundles} accent="success" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="Sewing Progress">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Completed vs. total bundle qty</span>
              <span className="text-2xl font-display font-bold">{sewProgress}%</span>
            </div>
            <ProgressBar value={sewProgress} colorClass="bg-navy" />
          </SectionCard>

          <SectionCard title="Inline QC Breakdown">
            <div className="flex h-6 w-full rounded-md overflow-hidden border border-border">
              <div className="bg-success" style={{ width: `${passPct}%` }} />
              <div className="bg-gold" style={{ width: `${reworkPct}%` }} />
              <div className="bg-destructive" style={{ width: `${rejectPct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-md bg-success/10 border border-success/30 p-2 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Pass</div>
                <div className="text-xl font-display font-bold text-success">{passPct}%</div>
              </div>
              <div className="rounded-md bg-gold/10 border border-gold/30 p-2 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Rework</div>
                <div className="text-xl font-display font-bold">{reworkPct}%</div>
              </div>
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Reject</div>
                <div className="text-xl font-display font-bold text-destructive">{rejectPct}%</div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard 
          title="Active Bundles by Line"
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Search bundle ID, order, customer, line..."
                className="pl-8 pr-2 h-8 rounded-md border border-input bg-background text-xs w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
          }
        >
          {filteredSewing.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No sewing bundles logged yet {canEdit && "— click Log Sewing Bundle to add one."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2 pr-4">Bundle ID</th>
                    <th className="py-2 pr-4">Order ID</th>
                    <th className="py-2 pr-4">Line #</th>
                    <th className="py-2 pr-4">Operators</th>
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Inline QC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSewing.map((b) => (
                    <tr key={b.bundle_id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{b.bundle_id}</td>
                      <td className="py-2.5 pr-4">
                        <Link to="/orders/$orderId" params={{ orderId: b.order_id }} className="text-secondary hover:underline">
                          {b.order_id}
                        </Link>
                        {isOrderOnHold(b.order_id) && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-destructive/15 text-destructive border border-destructive/25 uppercase tracking-wider">On Hold</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-xs font-semibold text-primary">Line {b.line_number}</td>
                      <td className="py-2.5 pr-4">
                        {canEdit ? (
                          <input
                            type="number"
                            value={b.operator_count}
                            onChange={(e) => handleUpdateField(b.bundle_id, "operator_count", Number(e.target.value))}
                            className="w-16 h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                          />
                        ) : (
                          b.operator_count
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {canEdit ? (
                          <input
                            type="number"
                            value={b.qty}
                            onChange={(e) => handleUpdateField(b.bundle_id, "qty", Number(e.target.value))}
                            className="w-20 h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                          />
                        ) : (
                          b.qty
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {canEdit ? (
                          <select
                            value={b.status}
                            onChange={(e) => handleUpdateField(b.bundle_id, "status", e.target.value)}
                            className="h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                          >
                            <option value="Active">Active</option>
                            <option value="Completed">Completed</option>
                          </select>
                        ) : (
                          <StatusBadge status={b.status} />
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {canEdit ? (
                          <select
                            value={b.inline_qc_result}
                            onChange={(e) => handleUpdateField(b.bundle_id, "inline_qc_result", e.target.value)}
                            className="h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                          >
                            <option value="Pass">Pass</option>
                            <option value="Rework">Rework</option>
                            <option value="Reject">Reject</option>
                          </select>
                        ) : (
                          <StatusBadge status={b.inline_qc_result} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Log Sewing Bundle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => { setShowAddModal(false); setFormError(""); }}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log Sewing Bundle</h3>
            <p className="text-xs text-muted-foreground mb-4">Create operational sewing assemblies for order.</p>

            {formError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <span className="shrink-0">⚠</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Order Combobox */}
              <div className="relative">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary block mb-1">Select Order (Stage 6–7)</label>
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
                        const matchesStage = o.current_stage === 6 || o.current_stage === 7;
                        const matchesQuery = o.order_id.toLowerCase().includes(orderQuery.toLowerCase()) ||
                          o.customer_name.toLowerCase().includes(orderQuery.toLowerCase());
                        return matchesStage && matchesQuery;
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
                    {orders.filter((o) => o.current_stage === 6 || o.current_stage === 7).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">No matching active stage 6-7 orders.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Sewing Line #</label>
                  <select
                    value={lineNumber}
                    onChange={(e) => setLineNumber(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    {sewingLines.map((l) => {
                      const match = l.name.match(/\d+/);
                      const num = match ? parseInt(match[0], 10) : 1;
                      return <option key={l.id} value={num}>{l.name}</option>;
                    })}
                    {sewingLines.length === 0 && (
                      <>
                        <option value={1}>Line 1</option>
                        <option value={2}>Line 2</option>
                        <option value={3}>Line 3</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Operator Count</label>
                  <input
                    type="number"
                    value={operatorCount}
                    onChange={(e) => setOperatorCount(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                    min={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Bundle Quantity</label>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                    min={1}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Inline QC Outcome</label>
                  <select
                    value={inlineQcResult}
                    onChange={(e) => setInlineQcResult(e.target.value as any)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    <option value="Pass">Pass</option>
                    <option value="Rework">Rework</option>
                    <option value="Reject">Reject</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                Log Sewing Bundle
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
