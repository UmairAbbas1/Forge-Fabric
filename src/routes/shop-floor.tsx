import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { Hammer, AlertTriangle, CheckCircle2, PackageSearch, Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { useOrderMaterialBalances, useReleaseMaterialHold } from "../hooks/useOrderMaterialBalance";
import { STAGES } from "../lib/mockData";
import { getServiceScopeChips } from "../lib/service-scope-constants";

export const Route = createFileRoute("/shop-floor")({
  component: ShopFloorMES,
});

// Real cleared-vs-blocked determination (Phase C/D): an order is blocked when
// it's genuinely on a material hold — either the shortage-hold mechanism
// (orders.status === 'On Hold' with a hold_reason, see
// check_material_shortage_and_hold) or the existing material-inspection hold
// (isOrderOnHold, from a "Hold" 4-point inspection result). No heuristic
// stand-in ("assume issued if stage > 1") — this reads the real hold state.
function ShopFloorMES() {
  const { orders, isOrderOnHold } = useAppData();
  const { user } = useAuth();
  const { byOrderId, isLoading: balanceLoading } = useOrderMaterialBalances();
  const releaseHold = useReleaseMaterialHold();
  const [activeTab, setActiveTab] = useState<"ready" | "blocked">("ready");
  const [searchQuery, setSearchQuery] = useState("");
  const canReleaseHold = user?.role === "admin" || user?.role === "merchandiser" || user?.role === "production";

  // Exclude fully-dispatched orders — Shop Floor is a WIP view, not an archive.
  const wipOrders = (orders || []).filter((o) => o.status !== "Shipped");

  // Search by order/WO id, PO number, or brand (customer) name — matches
  // whichever of those the merchandiser actually has on hand when looking
  // for a specific job.
  const searchedOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return wipOrders;
    return wipOrders.filter((o) =>
      o.order_id?.toLowerCase().includes(q) ||
      o.PO_number?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q)
    );
  }, [wipOrders, searchQuery]);

  const blockedOrders = searchedOrders.filter((o) => isOrderOnHold(o.order_id));
  const readyOrders = searchedOrders.filter((o) => !isOrderOnHold(o.order_id));

  const stageName = (stageId: number) => STAGES.find((s) => s.id === stageId)?.name || `Stage ${stageId}`;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-black tracking-tight text-foreground flex items-center gap-3">
              <Hammer className="h-8 w-8 text-primary" />
              Shop Floor Dispatch (MES)
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Live manufacturing execution dashboard, driven by real received/used/remaining material balances —
              only orders with sufficient material logged and approved are cleared for production.
            </p>
          </div>
          {balanceLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading material balances…
            </span>
          )}
        </div>

        {/* Search — order/WO id, PO number, or brand name */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PO, brand name, or WO/order ID…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-border/60 bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-border/60">
          <button
            onClick={() => setActiveTab("ready")}
            className={`px-4 py-2 font-bold text-sm transition-all ${
              activeTab === "ready"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cleared for Production ({readyOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("blocked")}
            className={`px-4 py-2 font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "blocked"
                ? "border-b-2 border-destructive text-destructive"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Blocked: On Hold ({blockedOrders.length})
          </button>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(activeTab === "ready" ? readyOrders : blockedOrders).length === 0 && (
            <div className="md:col-span-2 py-16 text-center text-muted-foreground">
              <PackageSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">
                {searchQuery
                  ? "No orders match your search."
                  : activeTab === "ready" ? "No orders currently cleared for production." : "No orders on hold."}
              </p>
            </div>
          )}
          {(activeTab === "ready" ? readyOrders : blockedOrders).map((o) => {
            const balance = byOrderId.get(o.order_id);
            const pipelineChips = getServiceScopeChips(o.selected_stages);
            const isShortageHold = o.status === "On Hold" && !!o.hold_reason;

            return (
              <div key={o.order_id} className="p-5 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black tracking-tight group-hover:text-primary transition-colors">{o.order_id}</h3>
                    <p className="text-sm font-medium text-muted-foreground">{o.style_no || "Standard Style"} {o.color ? `· ${o.color}` : ""}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.customer_name}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    o.priority === 'Rush' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
                  }`}>
                    {o.priority || "Normal"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Target Qty</p>
                    <p className="font-mono font-bold text-lg">{o.qty} <span className="text-xs text-muted-foreground font-sans">pcs</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Current Stage</p>
                    <p className="font-bold text-sm">{stageName(o.current_stage)}</p>
                  </div>
                </div>

                {/* Real pipeline preview — only the stages this order actually selected (Phase A fix), not an assumed full 13-stage route */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {pipelineChips.map((chip) => (
                    <span key={chip} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-neutral-100 text-neutral-500 border border-neutral-200">
                      {chip}
                    </span>
                  ))}
                </div>

                {/* Real material balance */}
                <div className="grid grid-cols-3 gap-2 mb-4 p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-center">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Received</p>
                    <p className="font-mono font-bold text-sm">{balance ? balance.qty_received : "—"}</p>
                  </div>
                  <div className="text-center border-x border-border/50">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Used</p>
                    <p className="font-mono font-bold text-sm">{balance ? balance.qty_used : "—"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Remaining</p>
                    <p className={`font-mono font-bold text-sm ${balance && balance.qty_remaining < 0 ? "text-destructive" : ""}`}>
                      {balance ? balance.qty_remaining : "—"}
                    </p>
                  </div>
                </div>

                {activeTab === "ready" ? (
                  <div className="pt-4 border-t flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Cleared
                    </span>
                    <OpenJobCardButton orderId={o.order_id} />
                  </div>
                ) : (
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-start gap-1.5 text-xs font-bold text-destructive bg-destructive/10 px-2 py-1.5 rounded-md border border-destructive/20">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="font-normal leading-snug">{o.hold_reason || "On material inspection hold — see Materials for details."}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <OrderMoreMaterialButton orderId={o.order_id} isShortage={isShortageHold} />
                      {isShortageHold && canReleaseHold && (
                        <button
                          onClick={() => releaseHold.mutate(o.order_id)}
                          disabled={releaseHold.isPending || (balance ? balance.qty_remaining < 0 : true)}
                          title={balance && balance.qty_remaining < 0 ? "Still short — receive more material first" : "Release hold and resume production"}
                          className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {releaseHold.isPending ? "Releasing…" : "Release Hold"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </AppShell>
  );
}

function OpenJobCardButton({ orderId }: { orderId: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to: "/orders/$orderId", params: { orderId } })}
      className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90"
    >
      Open Job Card
    </button>
  );
}

// Real action, not a dead button: deep-links to Materials with this order
// pre-selected so a shortage can actually be acted on from here, instead of
// leaving the merchandiser to find the right PO manually (see the
// `order` search param handling in materials.tsx).
function OrderMoreMaterialButton({ orderId, isShortage }: { orderId: string; isShortage: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to: "/materials", search: { order: orderId } })}
      className="px-4 py-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-lg hover:bg-muted/80"
    >
      {isShortage ? "Order More Material" : "Request Materials"}
    </button>
  );
}
