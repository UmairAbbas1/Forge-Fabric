import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Droplets, Wind, Sparkles, BadgeCheck, ArrowRight, X, Search, Plus } from "lucide-react";
import { AppShell, KpiTile, SectionCard, ProgressBar, StatusBadge } from "../components/AppShell";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { useActiveOutsourceRecord } from "../hooks/useOutsourcing";

export const Route = createFileRoute("/wash")({
  head: () => ({
    meta: [
      { title: "Wash & Finishing · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Laundry, dry, laser/ozone/spray finish and approval progress across finishing lines." },
    ],
  }),
  component: Page,
});

const FINISHING_EQUIPMENT = [
  "Industrial Washer #3",
  "Jeanologia Laser",
  "Ozone Booth",
  "Spray Booth",
  "3D Wrinkle",
  "Steam Presser",
];

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wash, orders, equipment, addWashBatch, updateWashBatch, isOrderOnHold, isLoading, globalSearchQuery, setGlobalSearchQuery } = useAppData();

  // Add Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  // REQ-15 Section 7: Washing is stage 9 — if it's currently routed to an
  // outside vendor for the selected order, the in-house wash form is disabled.
  const washOutsourceRecord = useActiveOutsourceRecord(selectedOrderId, [9]);
  const [pcsQty, setPcsQty] = useState(500);
  const [batchStage, setBatchStage] = useState<"Wash" | "Dry" | "Finish" | "Approved">("Wash");
  const [selectedEquip, setSelectedEquip] = useState(FINISHING_EQUIPMENT[0]);

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

  // Filter finishing equipment
  const washEquip = equipment.filter(
    (eq) => 
      ["Washer", "Laser", "Laser/Ozone", "Spray", "Finishing"].includes(eq.type) && 
      eq.status === "Active"
  );

  useEffect(() => {
    if (washEquip.length > 0) {
      setSelectedEquip(washEquip[0].name);
    }
  }, [equipment]);

  const inWash = wash.filter((w) => w.stage === "Wash").reduce((s, w) => s + w.pcs_qty, 0);
  const inFinish = wash.filter((w) => w.stage === "Finish").reduce((s, w) => s + w.pcs_qty, 0);
  const completed = wash.filter((w) => w.stage === "Approved").reduce((s, w) => s + w.pcs_qty, 0);

  const stages = [
    { key: "Wash", label: "Wash", icon: Droplets },
    { key: "Dry", label: "Dry", icon: Wind },
    { key: "Finish", label: "Finish", icon: Sparkles },
    { key: "Approved", label: "Approved", icon: BadgeCheck },
  ] as const;

  const totalQty = wash.reduce((s, w) => s + w.pcs_qty, 0) || 1;

  const canEdit = user && ["admin", "production"].includes(user.role);

  const handleUpdateField = (batchId: string, field: string, value: any) => {
    updateWashBatch(batchId, { [field]: value });
  };

  const advanceBatch = (batchId: string, currentStage: string) => {
    const nextMap: Record<string, "Wash" | "Dry" | "Finish" | "Approved"> = {
      "Wash": "Dry",
      "Dry": "Finish",
      "Finish": "Approved",
      "Approved": "Approved"
    };
    const next = nextMap[currentStage] || "Wash";
    handleUpdateField(batchId, "stage", next);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedOrderId) {
      setFormError("Please select an order before logging a wash batch.");
      return;
    }
    if (washOutsourceRecord) {
      setFormError(`Washing for this order is outsourced to ${washOutsourceRecord.vendor_name}. Log the return in the order's Stage Outsourcing panel before logging an in-house wash batch.`);
      return;
    }
    const selOrder = orders.find((o) => o.order_id === selectedOrderId);
    if (selOrder) {
      if (pcsQty > selOrder.qty) {
        setFormError(`Wash batch quantity (${pcsQty}) cannot exceed total Order Quantity (${selOrder.qty}).`);
        return;
      }
      if (selOrder.current_stage < 8) {
        setFormError(`Order ${selOrder.order_id} is currently at Stage ${selOrder.current_stage}. Laundry Wash requires Order to reach Stage 8 (Pre-Wash QC / Sewing Assembly) or higher.`);
        return;
      }
    }
    if (pcsQty <= 0) {
      setFormError("Pieces quantity must be greater than zero.");
      return;
    }
    if (!selectedEquip) {
      setFormError("Please select the equipment used for this wash batch.");
      return;
    }
    addWashBatch({
      batch_id: `WSH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: selectedOrderId,
      pcs_qty: pcsQty,
      stage: batchStage,
      equipment_used: selectedEquip,
    });
    // Reset Form
    setSelectedOrderId("");
    setOrderQuery("");
    setPcsQty(500);
    setBatchStage("Wash");
    setFormError("");
    setShowAddModal(false);
  };

  const filteredWash = useMemo(() => {
    const qLow = globalSearchQuery?.toLowerCase()?.trim() || "";
    if (!qLow) return wash;
    return wash.filter((w) => {
      const parentOrder = orders.find((o) => o.order_id === w.order_id);
      return (
        w.batch_id?.toLowerCase()?.includes(qLow) ||
        w.order_id?.toLowerCase()?.includes(qLow) ||
        w.equipment_used?.toLowerCase()?.includes(qLow) ||
        w.stage?.toLowerCase()?.includes(qLow) ||
        (parentOrder && parentOrder.customer_name?.toLowerCase()?.includes(qLow)) ||
        (parentOrder && parentOrder.PO_number?.toLowerCase()?.includes(qLow))
      );
    });
  }, [wash, orders, globalSearchQuery]);

  // Loading skeleton state
  if (wash.length === 0 && isLoading) {
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
            <div className="h-48 bg-muted rounded-xl" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>

          {/* Premium Loading Overlay */}
          <LoadingOverlay 
            message="Loading Wash & Finishing..." 
            description="Syncing laundry wash batches, laser treatments, ozone finishing, and drying status."
            icon={Droplets}
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
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Stage 9 · 10 · 11</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold">Wash &amp; Finishing Tracker</h1>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-primary hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Log Wash Batch
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiTile label="In Wash (pcs)" value={inWash.toLocaleString()} accent="navy" />
          <KpiTile label="In Finish (pcs)" value={inFinish.toLocaleString()} accent="gold" />
          <KpiTile label="Completed (pcs)" value={completed.toLocaleString()} accent="success" />
        </div>

        <SectionCard title="Finishing Process Flow">
          <div className="flex items-stretch gap-2 overflow-x-auto">
            {stages.map((s, i) => {
              const qty = wash.filter((w) => w.stage === s.key).reduce((sum, w) => sum + w.pcs_qty, 0);
              const pct = Math.round((qty / totalQty) * 100);
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <div className="flex-1 rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-md bg-navy text-navy-foreground grid place-items-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                        <div className="text-lg font-display font-bold">{qty.toLocaleString()} pcs</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={pct} colorClass={s.key === "Approved" ? "bg-success" : "bg-navy"} />
                      <div className="text-[11px] text-muted-foreground mt-1">{pct}% of pipeline</div>
                    </div>
                  </div>
                  {i < stages.length - 1 && <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />}
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard 
          title="Wash / Finish Batches"
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Search order or equipment..."
                className="pl-8 pr-2 h-8 rounded-md border border-input bg-background text-xs w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
          }
        >
          {filteredWash.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No wash batches logged yet {canEdit && "— click Log Wash Batch to add one."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2 pr-4">Batch ID</th>
                    <th className="py-2 pr-4">Order ID</th>
                    <th className="py-2 pr-4">Qty (pcs)</th>
                    <th className="py-2 pr-4">Stage</th>
                    <th className="py-2 pr-4">Equipment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWash.map((w) => (
                    <tr key={w.batch_id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{w.batch_id}</td>
                      <td className="py-2.5 pr-4">
                        <Link to="/orders/$orderId" params={{ orderId: w.order_id }} className="text-secondary hover:underline">
                          {w.order_id}
                        </Link>
                        {isOrderOnHold(w.order_id) && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-destructive/15 text-destructive border border-destructive/25 uppercase tracking-wider">On Hold</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {canEdit ? (
                          <input
                            type="number"
                            value={w.pcs_qty}
                            onChange={(e) => handleUpdateField(w.batch_id, "pcs_qty", Number(e.target.value))}
                            className="w-24 h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                          />
                        ) : (
                          w.pcs_qty.toLocaleString()
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          {canEdit ? (
                            <select
                              value={w.stage}
                              onChange={(e) => handleUpdateField(w.batch_id, "stage", e.target.value)}
                              className="h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none font-medium"
                            >
                              <option value="Wash">Wash</option>
                              <option value="Dry">Dry</option>
                              <option value="Finish">Finish</option>
                              <option value="Approved">Approved</option>
                            </select>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-chart-1/15 text-chart-1">
                              {w.stage}
                            </span>
                          )}
                          {canEdit && w.stage !== "Approved" && (
                            <button
                              onClick={() => advanceBatch(w.batch_id, w.stage)}
                              className="text-[10px] bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/25 px-1.5 py-0.5 rounded transition-all inline-flex items-center gap-0.5 font-bold"
                              title="Advance Batch Stage"
                            >
                              Advance &rarr;
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {canEdit ? (
                          <select
                            value={w.equipment_used}
                            onChange={(e) => handleUpdateField(w.batch_id, "equipment_used", e.target.value)}
                            className="h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                          >
                            {washEquip.map((eq) => (
                              <option key={eq.id} value={eq.name}>{eq.name}</option>
                            ))}
                            {washEquip.length === 0 && 
                              FINISHING_EQUIPMENT.map((eq) => (
                                <option key={eq} value={eq}>{eq}</option>
                              ))
                            }
                          </select>
                        ) : (
                          w.equipment_used
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

      {/* Log Wash Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => { setShowAddModal(false); setFormError(""); }}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log Wash Batch</h3>
            <p className="text-xs text-muted-foreground mb-4">Create finishing laundry batch tracking card.</p>

            {formError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <span className="shrink-0">⚠</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Order Combobox */}
              <div className="relative">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary block mb-1">Select Order (Stage 9–10)</label>
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
                        const matchesStage = o.current_stage === 9 || o.current_stage === 10;
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
                    {orders.filter((o) => o.current_stage === 9 || o.current_stage === 10).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">No matching active stage 9-10 orders.</div>
                    )}
                  </div>
                )}
                {washOutsourceRecord && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5 shrink-0" />
                    Outsourced to {washOutsourceRecord.vendor_name} — in-house wash batch disabled until the return is logged.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Batch Pcs Qty</label>
                  <input
                    type="number"
                    value={pcsQty}
                    onChange={(e) => setPcsQty(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                    min={1}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Finishing Equipment</label>
                  <select
                    value={selectedEquip}
                    onChange={(e) => setSelectedEquip(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    {washEquip.map((eq) => (
                      <option key={eq.id} value={eq.name}>{eq.name}</option>
                    ))}
                    {washEquip.length === 0 && 
                      FINISHING_EQUIPMENT.map((eq) => (
                        <option key={eq} value={eq}>{eq}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Batch Stage</label>
                <select
                  value={batchStage}
                  onChange={(e) => setBatchStage(e.target.value as any)}
                  className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="Wash">Wash</option>
                  <option value="Dry">Dry</option>
                  <option value="Finish">Finish</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!!washOutsourceRecord}
                className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Log Wash Batch
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
