import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { Package, Warehouse, Factory, Truck, FileCheck2 } from "lucide-react";
import { useState } from "react";
import { useAppData } from "../hooks/useAppData";

export const Route = createFileRoute("/inventory")({
  component: InventoryDashboard,
});

function InventoryDashboard() {
  const { materials, orders } = useAppData();
  const [activeView, setActiveView] = useState<"fabric" | "finished">("fabric");

  // Summarize raw materials from useAppData
  const rawMaterials = materials.reduce((acc, curr) => {
    const key = `${curr.category}-${curr.name}`;
    if (!acc[key]) {
      acc[key] = {
        name: curr.name,
        category: curr.category,
        received_warehouse: 0,
        issued_floor: 0,
        unit: curr.category === "Fabric" ? "Yards" : "Pieces"
      };
    }
    // Mocking the split: Let's assume 30% of received stock is issued to the floor for demo
    acc[key].received_warehouse += (curr.qty_received * 0.7);
    acc[key].issued_floor += (curr.qty_received * 0.3);
    return acc;
  }, {} as Record<string, any>);

  const rawMaterialData = Object.values(rawMaterials);

  // Summarize finished goods from useAppData
  // Using Stage to determine location
  const finishedGoods = orders.map(o => {
    const isFloor = o.current_stage >= 6 && o.current_stage <= 11;
    const isFinished = o.current_stage >= 12;
    const isInvoiced = o.status === "Shipped" || o.current_stage === 13;

    return {
      id: o.order_id,
      customer: o.customer_name,
      style: o.style_no,
      wip_floor: isFloor ? o.qty : 0,
      ready_delivery: isFinished ? o.qty : 0,
      invoiced: isInvoiced ? o.qty : 0,
    };
  });

  return (
    <AppShell activePath="/inventory">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-black tracking-tight text-foreground flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              Multi-Location Inventory (B.3)
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Real-time tracking of raw materials and finished goods across all facilities.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-border/60">
          <button 
            onClick={() => setActiveView("fabric")}
            className={`px-4 py-2 font-bold text-sm transition-all ${
              activeView === "fabric" 
                ? "border-b-2 border-primary text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Raw Materials (Fabric & Trim)
          </button>
          <button 
            onClick={() => setActiveView("finished")}
            className={`px-4 py-2 font-bold text-sm transition-all ${
              activeView === "finished" 
                ? "border-b-2 border-primary text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Work In Progress & Finished Goods
          </button>
        </div>

        {/* View: Raw Materials */}
        {activeView === "fabric" && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Material Name</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Category</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                    <div className="flex items-center justify-end gap-1.5"><Warehouse className="h-3.5 w-3.5"/> Received (Warehouse)</div>
                  </th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                    <div className="flex items-center justify-end gap-1.5"><Factory className="h-3.5 w-3.5"/> Issued (Shop Floor)</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rawMaterialData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-black">{item.name}</td>
                    <td className="px-5 py-4 font-medium text-muted-foreground">{item.category}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-amber-600">{Math.round(item.received_warehouse).toLocaleString()} {item.unit}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-indigo-600">{Math.round(item.issued_floor).toLocaleString()} {item.unit}</td>
                  </tr>
                ))}
                {rawMaterialData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">No raw materials in inventory.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* View: Finished Goods */}
        {activeView === "finished" && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Order Ref</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Customer & Style</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                    <div className="flex items-center justify-end gap-1.5"><Factory className="h-3.5 w-3.5"/> WIP (Shop Floor)</div>
                  </th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                    <div className="flex items-center justify-end gap-1.5"><Truck className="h-3.5 w-3.5"/> Ready for Delivery</div>
                  </th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">
                    <div className="flex items-center justify-end gap-1.5"><FileCheck2 className="h-3.5 w-3.5"/> Invoiced</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {finishedGoods.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-black text-primary">{item.id}</td>
                    <td className="px-5 py-4">
                      <div className="font-bold">{item.customer}</div>
                      <div className="text-xs text-muted-foreground">{item.style || "N/A"}</div>
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-amber-600">{item.wip_floor > 0 ? item.wip_floor.toLocaleString() : "-"}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-emerald-600">{item.ready_delivery > 0 ? item.ready_delivery.toLocaleString() : "-"}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-blue-600">{item.invoiced > 0 ? item.invoiced.toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </AppShell>
  );
}
