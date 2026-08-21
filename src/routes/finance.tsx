import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { usePermission } from "../hooks/usePermission";
import { useAppData } from "../hooks/useAppData";
import { FileDigit, FileCheck2, Send, CheckCircle2, Lock, AlertCircle, DollarSign, TrendingUp } from "lucide-react";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Finance & Invoicing · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Finished goods billing, purchase order verification, and accounts receivable tracking." },
    ],
  }),
  component: FinanceDashboard,
});

// Mock Invoicing Records fallback for empty state
const MOCK_INVOICES = [
  { id: "INV-2026-001", wo_number: "WO-2026-9010", po_number: "PO-2026-5501", qty: 1000, amount: 25000, status: "Ready", delivered_at: "2026-08-09T14:30:00Z" },
  { id: "INV-2026-002", wo_number: "WO-2026-8802", po_number: "PO-2026-5502", qty: 450, amount: 9800, status: "Sent", delivered_at: "2026-08-05T09:15:00Z" },
  { id: "INV-2026-003", wo_number: "WO-2026-8801", po_number: "PO-2026-5502", qty: 550, amount: 11950, status: "Paid", delivered_at: "2026-07-28T16:45:00Z" },
];

function FinanceDashboard() {
  const { orders } = useAppData();
  const canManage = usePermission("finance", "update");
  
  // Any order at Stage >= 12 is considered Ready to Bill/Sent.
  const liveInvoices = useMemo(() => {
    return orders
      .filter(o => o.current_stage >= 12)
      .map(o => ({
        id: `INV-${o.order_id.replace("FF-", "")}`,
        wo_number: o.order_id,
        po_number: o.PO_number || "PO-PENDING",
        qty: o.qty,
        amount: o.qty * 15.5,
        status: o.status === "Shipped" ? "Paid" : o.current_stage === 13 ? "Sent" : "Ready",
        delivered_at: o.planned_ship_date
      }));
  }, [orders]);

  const [invoices, setInvoices] = useState(liveInvoices.length > 0 ? liveInvoices : MOCK_INVOICES);
  const [activeTab, setActiveTab] = useState<"Ready" | "Sent" | "Paid">("Ready");
  const [gateMsg, setGateMsg] = useState("");

  const filteredInvoices = invoices.filter(i => i.status === activeTab);

  // Financial Summary
  const readyTotal = invoices.filter(i => i.status === "Ready").reduce((sum, i) => sum + i.amount, 0);
  const sentTotal = invoices.filter(i => i.status === "Sent").reduce((sum, i) => sum + i.amount, 0);
  const paidTotal = invoices.filter(i => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);

  // Financial Chart Data
  const financialChartData = useMemo(() => {
    return [
      { category: "Ready to Bill", amount: readyTotal, count: invoices.filter(i => i.status === "Ready").length, fill: "#F59E0B" },
      { category: "Sent / Receivables", amount: sentTotal, count: invoices.filter(i => i.status === "Sent").length, fill: "#0071E3" },
      { category: "Settled / Paid", amount: paidTotal, count: invoices.filter(i => i.status === "Paid").length, fill: "#10B981" },
    ];
  }, [readyTotal, sentTotal, paidTotal, invoices]);

  const isPoMissing = (poNumber: string) => !poNumber || !poNumber.trim() || poNumber === "PO-PENDING";

  const handleGenerateInvoice = (invoiceId: string, poNumber: string) => {
    if (isPoMissing(poNumber)) {
      setGateMsg(`Cannot generate invoice for ${invoiceId} — no valid Purchase Order linked. Attach a PO number on the order before invoicing.`);
      return;
    }
    setGateMsg("");
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: "Sent" } : inv));
  };

  const handleMarkPaid = (invoiceId: string) => {
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: "Paid" } : inv));
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <FileDigit className="h-7 w-7 text-[#0071E3]" />
              Finance &amp; Invoicing
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm">
              Work Orders automatically appear here as "Ready to Bill" the moment finished goods clear final inspection.
            </p>
          </div>
        </div>

        {/* PO Gate Alert */}
        {gateMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2.5 shadow-sm">
            <Lock className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{gateMsg}</span>
          </div>
        )}

        {/* 3 Frosted Financial KPI Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-surface rounded-3xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ready to Bill</span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">
              ${readyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {invoices.filter(i => i.status === "Ready").length} pending billable batches
            </div>
          </div>

          <div className="glass-surface rounded-3xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Awaiting Payment</span>
              <div className="h-8 w-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold text-[#0071E3]">
              ${sentTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {invoices.filter(i => i.status === "Sent").length} issued client invoices
            </div>
          </div>

          <div className="glass-surface rounded-3xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Settled &amp; Paid</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">
              ${paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {invoices.filter(i => i.status === "Paid").length} realized cash receipts
            </div>
          </div>
        </div>

        {/* Real-time Invoicing Velocity Bar Graph */}
        <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#0071E3]" /> Accounts Receivable &amp; Cash Flow Pipeline
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Real-time monetary breakdown across billing stages.</p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-[#0071E3]/10 text-[#0071E3] px-2 py-0.5 rounded-full">
              USD Cashflow
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.6} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748B' }} stroke="#CBD5E1" tickLine={false} />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#64748B' }} 
                  stroke="#CBD5E1" 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white/95 dark:bg-[#121622]/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-black/[0.08] dark:border-white/[0.1] text-xs">
                          <div className="font-bold text-foreground mb-1">{label}</div>
                          <div className="text-[#0071E3] font-semibold">
                            ${Number(data.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({data.count} batches)
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {financialChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="inline-flex items-center p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08]">
          <button 
            onClick={() => setActiveTab("Ready")}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "Ready" 
                ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            Ready to Bill ({invoices.filter(i => i.status === "Ready").length})
          </button>
          <button 
            onClick={() => setActiveTab("Sent")}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "Sent" 
                ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="h-3.5 w-3.5 text-[#0071E3]" />
            Sent / Awaiting ({invoices.filter(i => i.status === "Sent").length})
          </button>
          <button 
            onClick={() => setActiveTab("Paid")}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "Paid" 
                ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Paid ({invoices.filter(i => i.status === "Paid").length})
          </button>
        </div>

        {/* Invoice Table */}
        <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.04] border-b border-black/[0.06] dark:border-white/[0.08]">
                <tr>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px]">Invoice Ref</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px]">Work Order</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px]">Blanket PO</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Qty Billed</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Amount (USD)</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                      No invoices found for this status.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-[#0071E3]">{inv.id}</td>
                      <td className="px-5 py-3.5 font-bold text-foreground">{inv.wo_number}</td>
                      <td className="px-5 py-3.5 font-mono text-muted-foreground">{inv.po_number}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">{inv.qty.toLocaleString()} pcs</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {inv.status === "Ready" && (
                          <button
                            onClick={() => handleGenerateInvoice(inv.id, inv.po_number)}
                            disabled={!canManage}
                            className="px-3 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-[11px] shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            Generate Invoice &rarr;
                          </button>
                        )}
                        {inv.status === "Sent" && (
                          <button
                            onClick={() => handleMarkPaid(inv.id)}
                            disabled={!canManage}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            Mark Paid &bull; Net 30
                          </button>
                        )}
                        {inv.status === "Paid" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
