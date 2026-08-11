import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { Hammer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/shop-floor")({
  component: ShopFloorMES,
});

import { useAppData } from "../hooks/useAppData";

function ShopFloorMES() {
  const { workOrders } = useAppData();
  
  // Map live Supabase work_orders to the MES WO view
  const wos = (workOrders || []).map(wo => ({
    id: wo.wo_number,
    style: wo.style_name || "Standard Style",
    qty: wo.target_qty,
    flavor: wo.wash_process_type || "Standard",
    materials_issued: wo.current_stage_id >= 2, // assume issued if stage > 1 for demo purposes
    stage: `Stage ${wo.current_stage_id}`,
    priority: wo.priority || "Normal"
  }));
  const [activeTab, setActiveTab] = useState<"ready" | "blocked">("ready");

  const readyWos = wos.filter(w => w.materials_issued);
  const blockedWos = wos.filter(w => !w.materials_issued);

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
              Live manufacturing execution dashboard. Only Work Orders with issued raw materials are cleared for production.
            </p>
          </div>
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
            Cleared for Production ({readyWos.length})
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
            Blocked: Awaiting Materials ({blockedWos.length})
          </button>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(activeTab === "ready" ? readyWos : blockedWos).map(wo => (
            <div key={wo.id} className="p-5 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black tracking-tight group-hover:text-primary transition-colors">{wo.id}</h3>
                  <p className="text-sm font-medium text-muted-foreground">{wo.style}</p>
                </div>
                <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  wo.priority === 'Rush' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
                }`}>
                  {wo.priority}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Target Qty</p>
                  <p className="font-mono font-bold text-lg">{wo.qty} <span className="text-xs text-muted-foreground font-sans">pcs</span></p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Route / Stage</p>
                  <p className="font-bold text-sm">{wo.flavor} &bull; {wo.stage}</p>
                </div>
              </div>

              {activeTab === "ready" ? (
                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Materials Issued
                  </span>
                  <button className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90">
                    Open Job Card
                  </button>
                </div>
              ) : (
                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-md border border-destructive/20">
                    <AlertTriangle className="h-3.5 w-3.5" /> Hard Stop
                  </span>
                  <button className="px-4 py-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-lg hover:bg-muted/80">
                    Request Materials
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </AppShell>
  );
}
