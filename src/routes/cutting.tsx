import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell, KpiTile, SectionCard, StatusBadge, ProgressBar } from "../components/AppShell";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { CutSheetEditor } from "../components/cutting/CutSheetEditor";
import { 
  X, 
  Search, 
  Plus, 
  Scissors, 
  Layers, 
  FileSpreadsheet, 
  CheckCircle2 
} from "lucide-react";

export const Route = createFileRoute("/cutting")({
  head: () => ({
    meta: [
      { title: "Cutting Tracker & Cut Sheet Editor · Forge & Fabric" },
      { name: "description", content: "Panel cutting progress, first-cut approvals, cutter utilisation, and cut sheet fabric allocations." },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cutting, orders, equipment, addCuttingRecord, updateCuttingRecord, isOrderOnHold, isLoading } = useAppData();

  // Tab State: Floor Operations vs. Cut Sheet Editor
  const [activeTab, setActiveTab] = useState<"floor" | "cut-sheet">("floor");

  // Add Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [panelsCut, setPanelsCut] = useState(500);
  const [size, setSize] = useState("M");
  const [color, setColor] = useState("Indigo Blue");
  const [cutterUsed, setCutterUsed] = useState("");
  const [status, setStatus] = useState<"In Progress" | "Completed">("In Progress");

  // Search filter
  const [q, setQ] = useState("");

  // Role Guarding
  useEffect(() => {
    if (user && !["admin", "production", "qc", "customer", "merchandiser"].includes(user.role)) {
      navigate({ to: "/orders" });
    }
  }, [user, navigate]);

  // Load cutters
  const cutters = equipment.filter((eq) => eq.type === "Cutter" && eq.status === "Active");
  useEffect(() => {
    if (cutters.length > 0 && !cutterUsed) {
      setCutterUsed(cutters[0].name);
    }
  }, [cutters, cutterUsed]);

  const cutOrders = cutting.length;
  const inProgress = cutting.filter((c) => c.status === "In Progress").length;
  const completed = cutting.filter((c) => c.status === "Completed").length;
  const cutProgress = Math.round(
    (cutting.reduce((s, c) => s + c.panels_cut, 0) /
      Math.max(1, orders.filter((o) => o.current_stage >= 5).reduce((s, o) => s + o.qty, 0))) *
      100
  );
  const approvedToday = cutting.filter((c) => c.first_cut_approval_status === "Approved").length;
  const pendingApproval = cutting.filter((c) => c.first_cut_approval_status === "Pending").length;

  const canEdit = user && ["admin", "production", "merchandiser"].includes(user.role);

  const handleUpdateField = (cutId: string, field: string, value: any) => {
    updateCuttingRecord(cutId, { [field]: value });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || panelsCut <= 0 || !cutterUsed) return;
    addCuttingRecord({
      cut_id: `CUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_id: selectedOrderId,
      panels_cut: panelsCut,
      size,
      color,
      cutter_used: cutterUsed,
      status,
      first_cut_approval_status: "Pending",
    });
    // Reset Form
    setSelectedOrderId("");
    setOrderQuery("");
    setPanelsCut(500);
    setSize("M");
    setColor("Indigo Blue");
    setStatus("In Progress");
    setShowAddModal(false);
  };

  const filteredCutting = useMemo(() => {
    return cutting.filter((c) => {
      if (q === "") return true;
      return (
        c.cut_id.toLowerCase().includes(q.toLowerCase()) ||
        c.order_id.toLowerCase().includes(q.toLowerCase()) ||
        c.cutter_used.toLowerCase().includes(q.toLowerCase())
      );
    });
  }, [cutting, q]);

  // Loading skeleton state
  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-muted rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        
        {/* Header & Sub-tab Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
              Stage 5 · Pattern Spreading & Precision Cutting
            </div>
            <h1 className="mt-1 text-2xl md:text-3xl font-black font-display text-neutral-900">
              Cutting Room Operations
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center gap-1 bg-neutral-200/80 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab("floor")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "floor"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Scissors className="w-4 h-4" />
                <span>Floor Jobs & Progress</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("cut-sheet")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "cut-sheet"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Cut Sheet Fabric Editor</span>
              </button>
            </div>

            {canEdit && activeTab === "floor" && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Log Cutting Job
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: Floor Operations */}
        {activeTab === "floor" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiTile label="Cut Orders" value={cutOrders} accent="navy" />
              <KpiTile label="In Progress" value={inProgress} accent="gold" />
              <KpiTile label="Completed" value={completed} accent="success" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <SectionCard title="Cut Progress">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Panels cut vs. planned</span>
                  <span className="text-2xl font-display font-bold">{cutProgress}%</span>
                </div>
                <ProgressBar value={cutProgress} colorClass="bg-navy" />
              </SectionCard>

              <SectionCard title="First Cut Approvals">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-success/10 border border-success/30 p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Approved Today</div>
                    <div className="mt-1 text-2xl font-display font-bold text-success">{approvedToday}</div>
                  </div>
                  <div className="rounded-md bg-gold/10 border border-gold/30 p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending Approval</div>
                    <div className="mt-1 text-2xl font-display font-bold text-warning-foreground">{pendingApproval}</div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard 
              title="Cutting Jobs"
              action={
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search order or cutter..."
                    className="pl-8 pr-2 h-8 rounded-md border border-input bg-background text-xs w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
              }
            >
              {filteredCutting.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No cutting jobs logged yet {canEdit && "— click Log Cutting Job to add one."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2 pr-4">Cut ID</th>
                        <th className="py-2 pr-4">Order ID</th>
                        <th className="py-2 pr-4">Panels Cut</th>
                        <th className="py-2 pr-4">Size</th>
                        <th className="py-2 pr-4">Color</th>
                        <th className="py-2 pr-4">Cutter</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">First Cut Approval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCutting.map((c) => (
                        <tr key={c.cut_id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4 font-medium">{c.cut_id}</td>
                          <td className="py-2.5 pr-4">
                            <Link to="/orders/$orderId" params={{ orderId: c.order_id }} className="text-secondary hover:underline">
                              {c.order_id}
                            </Link>
                            {isOrderOnHold(c.order_id) && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-destructive/15 text-destructive border border-destructive/25 uppercase tracking-wider">On Hold</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            {canEdit ? (
                              <input
                                type="number"
                                value={c.panels_cut}
                                onChange={(e) => handleUpdateField(c.cut_id, "panels_cut", Number(e.target.value))}
                                className="w-24 h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                              />
                            ) : (
                              c.panels_cut.toLocaleString()
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-xs">{c.size}</td>
                          <td className="py-2.5 pr-4 text-xs font-semibold">{c.color}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{c.cutter_used}</td>
                          <td className="py-2.5 pr-4">
                            {canEdit ? (
                              <select
                                value={c.status}
                                onChange={(e) => handleUpdateField(c.cut_id, "status", e.target.value)}
                                className="h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                              >
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                              </select>
                            ) : (
                              <StatusBadge status={c.status} />
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <div>
                              {canEdit ? (
                                <select
                                  value={c.first_cut_approval_status}
                                  onChange={(e) => handleUpdateField(c.cut_id, "first_cut_approval_status", e.target.value)}
                                  className="h-7 rounded border border-outline-variant bg-card text-xs px-1.5 focus:outline-none"
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Approved">Approved</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              ) : (
                                <StatusBadge status={c.first_cut_approval_status} />
                              )}
                              {canEdit && (
                                <div className="flex gap-1.5 mt-1">
                                  <button
                                    onClick={() => handleUpdateField(c.cut_id, "first_cut_approval_status", "Approved")}
                                    className="text-[9px] font-bold text-success hover:underline"
                                  >
                                    Approve
                                  </button>
                                  <span className="text-[9px] text-muted-foreground/60">|</span>
                                  <button
                                    onClick={() => handleUpdateField(c.cut_id, "first_cut_approval_status", "Rejected")}
                                    className="text-[9px] font-bold text-destructive hover:underline"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* TAB 2: Cut Sheet Editor */}
        {activeTab === "cut-sheet" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <CutSheetEditor
              readOnly={!canEdit}
              onSave={async (cutSheetData) => {
                // Save feedback toast / simulation
                alert("Cut Sheet updated with dynamic fabric rows!");
              }}
            />
          </div>
        )}
      </div>

      {/* Log Cutting Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log Cutting Job</h3>
            <p className="text-xs text-muted-foreground mb-6">Create panels cutting tracking card for order.</p>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Order Combobox */}
              <div className="relative">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary block mb-1">Select Order (Stage 5)</label>
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
                        const matchesStage = o.current_stage === 5;
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
                    {orders.filter((o) => o.current_stage === 5).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">No matching active stage 5 orders.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Panels Cut</label>
                  <input
                    type="number"
                    value={panelsCut}
                    onChange={(e) => setPanelsCut(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                    min={1}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Cutter Machine</label>
                  <select
                    value={cutterUsed}
                    onChange={(e) => setCutterUsed(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    {cutters.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    {cutters.length === 0 && <option value="Manual Cut Table 1">Manual Cut Table 1</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Garment Size</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="e.g. M or 32"
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Fabric Color</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Indigo Blue"
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Initial Job Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                Log Cutting Job
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
