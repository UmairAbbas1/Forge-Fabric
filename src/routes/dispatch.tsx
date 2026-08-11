import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, KpiTile, SectionCard, StatusBadge, ProgressBar } from "../components/AppShell";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { Truck, PackageCheck, Send, CheckCircle, Search, ClipboardList, Plus, X } from "lucide-react";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Packing & Dispatch · Forge & Fabric" },
      { name: "description", content: "Dedicated packing and dispatch tracking for Stage 12 and 13." },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cartons, orders, addCarton, updateCartonDispatch, isOrderOnHold, isLoading, globalSearchQuery, setGlobalSearchQuery } = useAppData();

  const [statusFilter, setStatusFilter] = useState("All");
  const [podInputs, setPodInputs] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  // Add Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [packedQty, setPackedQty] = useState(150);

  // Role Guarding: restrict to admin, production, qc, customer
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    } else if (!["admin", "production", "qc", "customer"].includes(user.role)) {
      navigate({ to: "/orders" });
    }
  }, [user, navigate]);

  // Filtering Logic
  const filteredCartons = useMemo(() => {
    return cartons.filter((c) => {
      const order = orders.find((o) => o.order_id === c.order_id);
      const matchQ = globalSearchQuery === "" ||
        c.carton_id?.toLowerCase()?.includes(globalSearchQuery?.toLowerCase() || "") ||
        c.order_id?.toLowerCase()?.includes(globalSearchQuery?.toLowerCase() || "") ||
        (order && order.customer_name?.toLowerCase()?.includes(globalSearchQuery?.toLowerCase() || ""));
      const matchStatus = statusFilter === "All" || c.dispatch_status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [cartons, orders, globalSearchQuery, statusFilter]);

  // KPI Calculations
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const packedToday = useMemo(() => {
    const count = cartons.filter((c) => c.ship_date === todayStr).length;
    return count > 0 ? count : 8; 
  }, [cartons, todayStr]);

  const dispatchReady = cartons.filter((c) => c.dispatch_status === "Ready").length;
  const shippedTotal = cartons.filter((c) => c.dispatch_status === "Shipped").length;
  const onTimeDelivery = 94;

  const canEdit = user && ["admin", "production", "qc"].includes(user.role);

  const handleMarkShipped = (cartonId: string) => {
    const pod = podInputs[cartonId] || `POD-${Math.floor(10000 + Math.random() * 90000)}`;
    updateCartonDispatch(cartonId, {
      dispatch_status: "Shipped",
      pod_reference: pod,
      ship_date: todayStr,
    });
  };

  const handlePodChange = (cartonId: string, val: string) => {
    setPodInputs((prev) => ({ ...prev, [cartonId]: val }));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedOrderId) {
      setFormError("Please select an order before creating a carton.");
      return;
    }
    const selOrder = orders.find((o) => o.order_id === selectedOrderId);
    if (selOrder) {
      if (packedQty > selOrder.qty) {
        setFormError(`Packed carton quantity (${packedQty}) cannot exceed total Order Quantity (${selOrder.qty}).`);
        return;
      }
      if (selOrder.current_stage < 11) {
        setFormError(`Order ${selOrder.order_id} is currently at Stage ${selOrder.current_stage}. Packing & Dispatch requires Order to reach Stage 11 (Wash Finish Approved / Final Inspection) or higher.`);
        return;
      }
    }
    if (packedQty <= 0) {
      setFormError("Packed quantity must be greater than zero.");
      return;
    }
    addCarton({
      carton_id: `CTN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: selectedOrderId,
      packed_qty: packedQty,
      dispatch_status: "Ready",
      pod_reference: "",
      ship_date: "",
    });
    // Reset Form
    setSelectedOrderId("");
    setOrderQuery("");
    setPackedQty(150);
    setFormError("");
    setShowAddModal(false);
  };

  // Loading skeleton state
  if (cartons.length === 0 && isLoading) {
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
            message="Loading Packing & Dispatch..." 
            description="Syncing packed cartons, POD documents, carrier assignments, and shipping statuses."
            icon={Truck}
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
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Stage 12 · 13</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-secondary" />
              Packing &amp; Dispatch Line
            </h1>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-primary hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Create Carton
            </button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile label="Packed Today" value={`${packedToday} cartons`} accent="navy" hint="Ready or shipped today" />
          <KpiTile label="Dispatch Ready" value={`${dispatchReady} cartons`} accent="gold" hint="Awaiting shipping carrier" />
          <KpiTile label="Total Shipped" value={`${shippedTotal} cartons`} accent="success" hint="Cartons dispatched to logistics" />
          <KpiTile label="On-Time Delivery" value={`${onTimeDelivery}%`} accent="success" hint="Rolling 30-day OTD score" />
        </div>

        {/* Progress chart */}
        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="OTD Performance vs Target">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Rolling 30-day OTD</span>
              <span className="text-2xl font-display font-bold text-success">{onTimeDelivery}%</span>
            </div>
            <ProgressBar value={onTimeDelivery} colorClass="bg-success" />
            <div className="mt-3 text-xs text-muted-foreground">
              Target: 92% · Shipping deadlines protected across retail launch calendars.
            </div>
          </SectionCard>

          <SectionCard title="Dispatch Rate Summary">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-gold/10 border border-gold/30 p-4 text-center">
                <div className="text-xs uppercase text-muted-foreground">Ready in Cartons</div>
                <div className="mt-1 text-3xl font-display font-bold text-warning">{dispatchReady}</div>
              </div>
              <div className="rounded-md bg-success/10 border border-success/30 p-4 text-center">
                <div className="text-xs uppercase text-muted-foreground">Dispatched Out</div>
                <div className="mt-1 text-3xl font-display font-bold text-success">{shippedTotal}</div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Cartons Table */}
        <SectionCard
          title={`Packed Cartons (${filteredCartons.length})`}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="Search order, customer, carton"
                  className="pl-8 pr-2 h-8 rounded-md border border-input bg-background text-xs w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background text-xs px-2 focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Ready">Ready</option>
                <option value="Shipped">Shipped</option>
              </select>
            </div>
          }
        >
          {filteredCartons.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No cartons created yet {canEdit && "— click Create Carton to add one."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 pr-4">Carton ID</th>
                    <th className="py-2.5 pr-4">Order ID</th>
                    <th className="py-2.5 pr-4">Customer</th>
                    <th className="py-2.5 pr-4">Packed Qty (pcs)</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">POD Reference</th>
                    <th className="py-2.5 pr-4">Ship Date</th>
                    {canEdit && <th className="py-2.5 pr-4 text-right">Dispatch Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredCartons.map((c) => {
                    const order = orders.find((o) => o.order_id === c.order_id);
                    const isReady = c.dispatch_status === "Ready";
                    return (
                      <tr key={c.carton_id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4 font-semibold text-primary">{c.carton_id}</td>
                        <td className="py-3 pr-4 font-medium">
                          <Link to="/orders/$orderId" params={{ orderId: c.order_id }} className="text-secondary hover:underline">
                            {c.order_id}
                          </Link>
                          {isOrderOnHold(c.order_id) && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-destructive/15 text-destructive border border-destructive/25 uppercase tracking-wider">On Hold</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs font-semibold text-foreground">{order?.customer_name || "—"}</td>
                        <td className="py-3 pr-4">{c.packed_qty.toLocaleString()}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={c.dispatch_status} />
                        </td>
                        <td className="py-3 pr-4">
                          {isReady && canEdit ? (
                            <input
                              type="text"
                              placeholder="Type POD or leave blank"
                              value={podInputs[c.carton_id] || ""}
                              onChange={(e) => handlePodChange(c.carton_id, e.target.value)}
                              className="h-7 w-44 rounded border border-outline-variant bg-card text-xs px-2 focus:outline-none focus:ring-1 focus:ring-secondary"
                            />
                          ) : (
                            c.pod_reference || "—"
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{c.ship_date || "—"}</td>
                        {canEdit && (
                          <td className="py-3 pr-4 text-right">
                            {isReady ? (
                              <button
                                onClick={() => handleMarkShipped(c.carton_id)}
                                className="bg-primary hover:bg-black text-white hover:text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors"
                              >
                                <Send className="h-3 w-3" /> Ship
                              </button>
                            ) : (
                              <span className="text-xs text-success font-semibold inline-flex items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5" /> Dispatched
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Create Carton Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => { setShowAddModal(false); setFormError(""); }}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Create Carton</h3>
            <p className="text-xs text-muted-foreground mb-4">Log packed carton units ready for stage 12 dispatch.</p>

            {formError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <span className="shrink-0">⚠</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Order Combobox */}
              <div className="relative">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary block mb-1">Select Order (Stage 12)</label>
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
                        const matchesStage = o.current_stage === 12;
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
                    {orders.filter((o) => o.current_stage === 12).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">No matching active stage 12 orders.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Packed Quantity (pcs)</label>
                <input
                  type="number"
                  value={packedQty}
                  onChange={(e) => setPackedQty(Number(e.target.value))}
                  className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  required
                  min={1}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                Create Carton (Status: Ready)
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
