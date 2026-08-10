import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { FileDigit, FileCheck2, Send, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/finance")({
  component: FinanceDashboard,
});

import { useAppData } from "../hooks/useAppData";

// Mock Invoicing Records fallback for empty state
const MOCK_INVOICES = [
  { id: "INV-2026-001", wo_number: "WO-2026-9010", po_number: "PO-2026-5501", qty: 1000, amount: 25000, status: "Ready", delivered_at: "2026-08-09T14:30:00Z" },
  { id: "INV-2026-002", wo_number: "WO-2026-8802", po_number: "PO-2026-5502", qty: 450, amount: 9800, status: "Sent", delivered_at: "2026-08-05T09:15:00Z" },
  { id: "INV-2026-003", wo_number: "WO-2026-8801", po_number: "PO-2026-5502", qty: 550, amount: 11950, status: "Paid", delivered_at: "2026-07-28T16:45:00Z" },
];

function FinanceDashboard() {
  const { orders } = useAppData();
  
  // Any order at Stage >= 12 is considered Ready to Bill/Sent.
  // This wires the UI into the live data context for the demo
  const liveInvoices = orders
    .filter(o => o.current_stage >= 12)
    .map(o => ({
      id: `INV-${o.order_id.replace("FF-", "")}`,
      wo_number: o.order_id,
      po_number: o.PO_number || "PO-PENDING",
      qty: o.qty,
      amount: o.qty * 15.5, // Mock pricing for demo
      status: o.status === "Shipped" ? "Paid" : o.current_stage === 13 ? "Sent" : "Ready",
      delivered_at: o.planned_ship_date
    }));

  const [invoices] = useState(liveInvoices.length > 0 ? liveInvoices : MOCK_INVOICES);
  const [activeTab, setActiveTab] = useState<"Ready" | "Sent" | "Paid">("Ready");

  const filteredInvoices = invoices.filter(i => i.status === activeTab);

  return (
    <AppShell activePath="/finance">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-black tracking-tight text-foreground flex items-center gap-3">
              <FileDigit className="h-8 w-8 text-primary" />
              Finance & Invoicing
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Work Orders automatically appear here as "Ready to Bill" the moment finished goods leave the dispatch dock.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-border/60">
          <button 
            onClick={() => setActiveTab("Ready")}
            className={`px-4 py-2 font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "Ready" 
                ? "border-b-2 border-amber-500 text-amber-600" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            Ready to Bill ({invoices.filter(i => i.status === "Ready").length})
          </button>
          <button 
            onClick={() => setActiveTab("Sent")}
            className={`px-4 py-2 font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "Sent" 
                ? "border-b-2 border-blue-500 text-blue-600" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="h-4 w-4" />
            Sent / Awaiting Payment ({invoices.filter(i => i.status === "Sent").length})
          </button>
          <button 
            onClick={() => setActiveTab("Paid")}
            className={`px-4 py-2 font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "Paid" 
                ? "border-b-2 border-emerald-500 text-emerald-600" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Paid ({invoices.filter(i => i.status === "Paid").length})
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Invoice Ref</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Work Order</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Blanket PO</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">Qty Billed</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">Amount (USD)</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    No invoices found for this status.
                  </td>
                </tr>
              ) : filteredInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4 font-black text-primary">{inv.id}</td>
                  <td className="px-5 py-4 font-medium">{inv.wo_number}</td>
                  <td className="px-5 py-4 font-medium text-muted-foreground">{inv.po_number}</td>
                  <td className="px-5 py-4 text-right font-mono">{inv.qty.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-mono font-bold">${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-4 text-right">
                    {inv.status === "Ready" && (
                      <button className="px-3 py-1.5 bg-foreground text-background text-xs font-bold rounded-lg hover:bg-foreground/90 flex items-center gap-1.5 ml-auto">
                        <FileCheck2 className="h-3.5 w-3.5" /> Generate Invoice
                      </button>
                    )}
                    {inv.status === "Sent" && (
                      <button className="px-3 py-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-lg hover:bg-muted/80 ml-auto">
                        Mark Paid
                      </button>
                    )}
                    {inv.status === "Paid" && (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 justify-end">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </AppShell>
  );
}

// Need to import AlertCircle for the tabs
import { AlertCircle } from "lucide-react";
