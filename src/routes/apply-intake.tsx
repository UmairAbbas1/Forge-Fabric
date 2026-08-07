import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { ClientSearch, type SelectedClientInfo } from "../components/merchandiser/ClientSearch";
import { useConvertSubmission } from "../hooks/merchandiser/useConvertSubmission";
import {
  FilePlus,
  Layers,
  Sparkles,
  CheckCircle2,
  Calendar,
  DollarSign,
  Scissors,
  Check,
} from "lucide-react";
import type { SizeMatrix } from "../lib/types";

export const Route = createFileRoute("/apply-intake")({
  head: () => ({
    meta: [
      { title: "Direct Order Intake · Forge & Fabric" },
      { name: "description", content: "Internal merchandiser order creation with instant PO conversion." },
    ],
  }),
  component: DirectIntakePage,
});

function DirectIntakePage() {
  const navigate = useNavigate();
  const { convert, conversionState } = useConvertSubmission();

  const [selectedClient, setSelectedClient] = useState<SelectedClientInfo | null>(null);
  const [styleNo, setStyleNo] = useState("");
  const [styleDesc, setStyleDesc] = useState("");
  const [washType, setWashType] = useState("Raw Indigo Wash");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [priority, setPriority] = useState<"Normal" | "High" | "Urgent">("Normal");
  const [assignedLine, setAssignedLine] = useState("Line 1 (Heavy Denim)");
  const [marginNotes, setMarginNotes] = useState("");

  const [sizes, setSizes] = useState<SizeMatrix>({
    "28": 15,
    "30": 35,
    "32": 70,
    "34": 50,
    "36": 25,
    "38": 10,
  });

  const totalUnits = Object.values(sizes).reduce((a, b) => a + (Number(b) || 0), 0);

  const handleSizeChange = (sz: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    setSizes((prev) => ({ ...prev, [sz]: num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      alert("Please select or create a client account first.");
      return;
    }
    if (!styleNo.trim()) {
      alert("Please enter a style number / code.");
      return;
    }

    const fakeSubmissionId = `sub-intake-${Date.now()}`;
    const generatedPo = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const generatedWo = `WO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    await convert({
      submission_id: fakeSubmissionId,
      company_name: selectedClient.companyName,
      contact_email: selectedClient.contactEmail,
      customer_id: selectedClient.id,
      po_number: generatedPo,
      contract_quantity: totalUnits,
      wo_number: generatedWo,
      style_name: styleNo,
      colorway: "Indigo Raw",
      wash_process_type: washType,
      due_date: dueDate,
      order_type: "Bulk",
      priority: priority === "Urgent" ? "Rush" : "Normal",
      size_breakdown: sizes,
      gate_1_planned_sizes: sizes,
      link_documents: true,
      link_cut_sheet: true,
    });
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto py-4 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <FilePlus className="w-6 h-6 text-amber-600" />
            Internal Merchandiser Order Intake
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Create and issue production POs directly for VIP brand accounts with automatic Gate 1 and Cut Sheet initialization.
          </p>
        </div>

        {conversionState.result ? (
          <div className="p-8 bg-white rounded-2xl border border-neutral-200 shadow-md text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900">Order Created & Issued Successfully!</h2>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              Blanket PO <span className="font-mono font-bold text-neutral-800">{conversionState.result.po_number}</span> and Work Order <span className="font-mono font-bold text-neutral-800">{conversionState.result.wo_number}</span> have been sent to factory dispatch.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate({ to: "/orders" })}
                className="px-5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 shadow-sm"
              >
                View Orders Dashboard
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-xs font-semibold hover:bg-neutral-200"
              >
                New Intake Entry
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            {/* 1. Client Search & Lookup */}
            <ClientSearch
              selectedClient={selectedClient}
              onSelectClient={(c) => setSelectedClient(c)}
            />

            {/* 2. Order Specs & Style */}
            <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-600" />
                Garment Specifications & Style
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Style Number / Code *</label>
                  <input
                    type="text"
                    required
                    value={styleNo}
                    onChange={(e) => setStyleNo(e.target.value)}
                    placeholder="e.g. SLV-2026-IND"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Style Description</label>
                  <input
                    type="text"
                    value={styleDesc}
                    onChange={(e) => setStyleDesc(e.target.value)}
                    placeholder="e.g. 14oz Japanese Selvedge Slim Fit Denim"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Wash Recipe</label>
                  <input
                    type="text"
                    value={washType}
                    onChange={(e) => setWashType(e.target.value)}
                    placeholder="e.g. Dark Stone Enzyme Bleach Rinse"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Factory Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
              </div>
            </div>

            {/* 3. Gate 1 Size Breakdown */}
            <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  Planned Size Breakdown (Gate 1)
                </h3>
                <span className="font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full text-xs">
                  Total: {totalUnits} Units
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(sizes).map(([sz, qty]) => (
                  <div key={sz} className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-center">
                    <span className="text-[11px] font-bold text-neutral-500 block">Size {sz}</span>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => handleSizeChange(sz, e.target.value)}
                      className="w-full text-center font-bold text-neutral-900 border-b border-neutral-300 focus:border-amber-500 focus:outline-none mt-1 py-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Internal Production Routing */}
            <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-600" />
                Merchandiser Production Routing & Margins
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Production Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-semibold"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent / Rush Order</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Assigned Sewing Line</label>
                  <select
                    value={assignedLine}
                    onChange={(e) => setAssignedLine(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-semibold"
                  >
                    <option value="Line 1 (Heavy Denim)">Line 1 (Heavy Denim Selvedge)</option>
                    <option value="Line 2 (Stretch & Comfort)">Line 2 (Stretch & Comfort)</option>
                    <option value="Line 3 (Sample & Small Batch)">Line 3 (Sample & Small Batch)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-neutral-700 mb-1">Internal Costing & Margin Notes</label>
                  <textarea
                    rows={2}
                    value={marginNotes}
                    onChange={(e) => setMarginNotes(e.target.value)}
                    placeholder="e.g. Target FOB $24.50/pc, Selvedge waste buffer 8%..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate({ to: "/submissions" })}
                className="px-4 py-2.5 bg-white border border-neutral-300 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={conversionState.isConverting}
                className="px-6 py-2.5 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {conversionState.isConverting ? "Creating PO & Work Orders..." : "Create & Issue Production PO"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
