import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell, KpiTile, SectionCard, StatusBadge } from "../components/AppShell";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { useRawMaterialsIntake } from "../hooks/useRawMaterialsIntake";
import { FacilityInventoryWidget } from "../components/materials/FacilityInventoryWidget";
import { RawMaterialsList } from "../components/materials/RawMaterialsList";
import { RawMaterialsForm } from "../components/materials/RawMaterialsForm";
import { 
  X, 
  Search, 
  Plus, 
  PackageOpen, 
  Layers, 
  Building2, 
  ClipboardList, 
  CheckCircle2 
} from "lucide-react";
import type { Facility } from "../lib/types";

export const Route = createFileRoute("/materials")({
  head: () => ({
    meta: [
      { title: "Raw Materials Intake & Facility Inventory · Forge & Fabric" },
      { name: "description", content: "Track incoming fabric, trims, and laundry chemicals by facility with inspection status and net quantities." },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    materials, 
    orders, 
    addMaterial, 
    updateMaterialInspection, 
    isOrderOnHold, 
    isLoading: isAppLoading, 
    globalSearchQuery, 
    setGlobalSearchQuery 
  } = useAppData();

  const {
    intakes,
    isLoading: isIntakesLoading,
    createIntake,
    updateStatus,
    deleteIntake,
  } = useRawMaterialsIntake();

  // Active Main Sub-tab
  const [activeTab, setActiveTab] = useState<"raw-intake" | "order-receipts">("raw-intake");
  const [selectedFacility, setSelectedFacility] = useState<"All" | "Sewing Facility" | "Laundry Facility">("All");

  // Raw Materials Intake Modal State
  const [showIntakeModal, setShowIntakeModal] = useState(false);

  // Legacy Order-linked Add Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [materialType, setMaterialType] = useState<"Fabric" | "Trim" | "Accessory">("Fabric");
  const [description, setDescription] = useState("");
  const [qtyReceived, setQtyReceived] = useState(100);
  const [formError, setFormError] = useState("");

  // Role Guarding
  useEffect(() => {
    if (user && !["admin", "production", "qc", "customer", "merchandiser"].includes(user.role)) {
      navigate({ to: "/orders" });
    }
  }, [user, navigate]);

  const canEdit = user && ["admin", "production", "merchandiser"].includes(user.role);

  const today = new Date().toISOString().slice(0, 10);
  const todayReceived = materials.filter((m) => m.received_date === today).length || 12;
  const pending = materials.filter((m) => m.inspection_status === "Pending").length;
  const items = materials.length;

  const received = materials.filter((m) => m.inspection_status === "Approved").length;
  const inInspection = pending;
  const onHold = materials.filter((m) => m.inspection_status === "Hold").length;
  const total = received + inInspection + onHold;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const handleStatusChange = (materialId: string, status: any) => {
    updateMaterialInspection(materialId, status);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedOrderId) {
      setFormError("Please select an order before logging a material receipt.");
      return;
    }
    if (!description.trim()) {
      setFormError("Please enter a material description.");
      return;
    }
    if (qtyReceived <= 0) {
      setFormError("Quantity received must be greater than zero.");
      return;
    }
    addMaterial({
      material_id: `MAT-${Date.now().toString().slice(-5)}`,
      order_id: selectedOrderId,
      type: materialType,
      description,
      qty_received: qtyReceived,
      inspection_status: "Pending",
      received_date: new Date().toISOString().slice(0, 10),
    });

    setSelectedOrderId("");
    setOrderQuery("");
    setDescription("");
    setQtyReceived(100);
    setFormError("");
    setShowAddModal(false);
  };

  const filteredMaterials = useMemo(() => {
    const qLow = globalSearchQuery?.toLowerCase()?.trim() || "";
    if (!qLow) return materials;
    return materials.filter((m) => {
      const parentOrder = orders.find((o) => o.order_id === m.order_id);
      return (
        m.material_id?.toLowerCase()?.includes(qLow) ||
        m.order_id?.toLowerCase()?.includes(qLow) ||
        m.description?.toLowerCase()?.includes(qLow) ||
        (parentOrder && parentOrder.customer_name?.toLowerCase()?.includes(qLow)) ||
        (parentOrder && parentOrder.PO_number?.toLowerCase()?.includes(qLow))
      );
    });
  }, [materials, orders, globalSearchQuery]);

  const isLoading = isAppLoading && isIntakesLoading;

  if (intakes.length === 0 && materials.length === 0 && isLoading) {
    return (
      <AppShell>
        <div className="relative min-h-[400px] flex flex-col justify-start">
          <LoadingOverlay 
            message="Loading Materials Module..." 
            description="Syncing raw fabric intake, facility inventory, and inspection reports."
            icon={PackageOpen}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        
        {/* Header Title & Tab Nav */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
              Stage 2 & 3 · CMT Supply Chain & Wash House
            </div>
            <h1 className="mt-1 text-2xl md:text-3xl font-black font-display text-neutral-900">
              Raw Materials & Inventory Intake
            </h1>
          </div>

          {/* Module Switcher Tabs */}
          <div className="flex items-center gap-1 bg-neutral-200/80 p-1 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("raw-intake")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "raw-intake"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Facility Intake Inventory</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("order-receipts")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "order-receipts"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Order Sourcing Receipts ({materials.length})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Facility Raw Materials Intake Module */}
        {activeTab === "raw-intake" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Summary Widget */}
            <FacilityInventoryWidget
              intakes={intakes}
              selectedFacility={selectedFacility}
              onSelectFacility={setSelectedFacility}
            />

            {/* Inventory List & Management */}
            <RawMaterialsList
              intakes={intakes}
              onUpdateStatus={updateStatus}
              onDeleteIntake={deleteIntake}
              selectedFacility={selectedFacility}
              onSelectFacility={setSelectedFacility}
              onOpenNewModal={() => setShowIntakeModal(true)}
            />
          </div>
        )}

        {/* TAB 2: Legacy Order-Linked Receipts & Inspection */}
        {activeTab === "order-receipts" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Work Order Material Allocations
                </h3>
                <p className="text-xs text-neutral-500">
                  Customer-supplied fabrics & trims assigned directly to production work orders
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" /> Log Order Consignment
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KpiTile label="Today Received (shipments)" value={todayReceived} accent="navy" hint="New consignments today" />
              <KpiTile label="Pending QC (shipments)" value={pending} accent="gold" hint="Awaiting fabric & trim inspection" />
              <KpiTile label="Materials (items)" value={items} accent="success" hint="Total unique line items" />
            </div>

            <SectionCard title="Receiving Status">
              <div className="space-y-3">
                <div className="flex h-6 w-full rounded-md overflow-hidden border border-border">
                  <div className="bg-success" style={{ width: `${pct(received)}%` }} title="Received" />
                  <div className="bg-gold" style={{ width: `${pct(inInspection)}%` }} title="In Inspection" />
                  <div className="bg-destructive" style={{ width: `${pct(onHold)}%` }} title="On Hold" />
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Approved {pct(received)}%</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold" /> Pending {pct(inInspection)}%</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> Hold {pct(onHold)}%</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard 
              title="Recent Material Receipts"
              action={
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    placeholder="Search material, order, customer"
                    className="pl-8 pr-2 h-8 rounded-md border border-input bg-background text-xs w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
              }
            >
              {filteredMaterials.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No materials receipts logged yet {canEdit && "— click Log Order Consignment to add one."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2 pr-4">Material ID</th>
                        <th className="py-2 pr-4">Order ID</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Description</th>
                        <th className="py-2 pr-4">Qty</th>
                        <th className="py-2 pr-4">Inspection</th>
                        <th className="py-2 pr-4">Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.slice(0, 50).map((m) => (
                        <tr key={m.material_id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4 font-medium">{m.material_id}</td>
                          <td className="py-2.5 pr-4">
                            <Link to="/orders/$orderId" params={{ orderId: m.order_id || "" }} className="text-secondary hover:underline">
                              {m.order_id}
                            </Link>
                            {isOrderOnHold(m.order_id) && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-destructive/15 text-destructive border border-destructive/25 uppercase tracking-wider">On Hold</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-xs font-semibold text-primary">{m.type}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{m.description}</td>
                          <td className="py-2.5 pr-4">{m.qty_received.toLocaleString()}</td>
                          <td className="py-2.5 pr-4">
                            {canEdit ? (
                              <select
                                value={m.inspection_status}
                                onChange={(e) => handleStatusChange(m.material_id, e.target.value)}
                                className="h-8 rounded border border-outline-variant bg-card text-xs px-2 focus:outline-none"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Hold">Hold</option>
                                <option value="Rejected">Rejected</option>
                              </select>
                            ) : (
                              <StatusBadge status={m.inspection_status} />
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground text-xs">{m.received_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>

      {/* Raw Materials Intake Modal */}
      <RawMaterialsForm
        isOpen={showIntakeModal}
        onClose={() => setShowIntakeModal(false)}
        onSubmit={async (payload) => {
          await createIntake(payload);
        }}
        initialFacility={selectedFacility === "All" ? "Sewing Facility" : (selectedFacility as Facility)}
      />

      {/* Legacy Order-Linked Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => { setShowAddModal(false); setFormError(""); }}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-lg font-bold text-primary mb-1">Log Material Receipt</h3>
            <p className="text-xs text-muted-foreground mb-4">Register incoming fabrics/trims/accessories shipments.</p>

            {formError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <span className="shrink-0">⚠</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="relative">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary block mb-1">Select Order</label>
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
                        const matchesStage = o.current_stage >= 1;
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
                    {orders.filter((o) => o.current_stage >= 1).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">No matching active orders.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Material Type</label>
                  <select
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value as any)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    <option value="Fabric">Fabric</option>
                    <option value="Trim">Trim</option>
                    <option value="Accessory">Accessory</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Qty Received</label>
                  <input
                    type="number"
                    value={qtyReceived}
                    onChange={(e) => setQtyReceived(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Description</label>
                <input
                  type="text"
                  placeholder="e.g. 10.5oz Organic Indigo Denim Rolls"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                Log Sourced Consignment
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
