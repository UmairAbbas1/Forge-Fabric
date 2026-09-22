import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Factory, Search, Truck, PackageCheck, AlertTriangle, CheckCircle2, Plus, X, Loader2 } from "lucide-react";

// No-login companion to StageOutsourcingPanel (used by logged-in staff on
// the order detail page / Cutting / Sewing). This talks to the
// outsourcing-portal edge function instead of the database directly — see
// that function's header comment for why: a link with no Supabase Auth
// session can never satisfy is_internal_staff(), so every real table stays
// exactly as RLS-locked as it is today. Return QC and "accept shortage as
// final" are deliberately NOT here — those are judgment calls that stay
// behind a real staff login; this page only covers dispatch (material out)
// and receive (material in).

type MaterialType = "general" | "fabric_rolls" | "cut_panels" | "stitched_garments" | "washed_garments" | "finished_garments" | "packed_cartons";

const MATERIAL_TYPE_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: "fabric_rolls", label: "Fabric Rolls / Raw Material" },
  { value: "cut_panels", label: "Cut Panels" },
  { value: "stitched_garments", label: "Stitched Garments" },
  { value: "washed_garments", label: "Washed Garments" },
  { value: "finished_garments", label: "Finished Garments" },
  { value: "packed_cartons", label: "Packed Cartons" },
  { value: "general", label: "General / Other" },
];

const STAGE_NAMES: Record<number, string> = {
  1: "Fabric Receiving & Inspection", 2: "Fabric Receiving & Inspection", 3: "Fabric Receiving & Inspection",
  4: "Pre-Production Planning", 5: "Cutting & Bundling", 6: "Cutting & Bundling", 7: "Sewing Assembly",
  8: "Pre-Wash Quality Check", 9: "Washing & Laundry", 10: "Finishing & Effects",
  11: "Final Quality Inspection", 12: "Pressing, Tagging & Packing", 13: "Dispatch & Delivery",
};

interface OrderRow {
  order_id: string;
  customer_name: string;
  style_no: string | null;
  current_stage: number;
  status: string;
  selected_stages: number[] | null;
}

interface RecordRow {
  id: string;
  order_id: string;
  stage_number: number;
  stage_name: string;
  vendor_name: string;
  outsource_po_number: string;
  quantity_dispatched: number;
  quantity_received: number;
  quantity_short?: number;
  vendor_status: string;
  material_type: MaterialType;
  material_description?: string | null;
  dispatched_at: string;
  dispatched_by_name?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  Dispatched: "bg-amber-50 text-amber-800 border-amber-200",
  In_Process: "bg-blue-50 text-blue-800 border-blue-200",
  Returned_Partial: "bg-orange-50 text-orange-800 border-orange-200",
  Returned_Complete: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

const NAME_KEY = "ff_outsourcing_portal_name";

export function PublicOutsourcingPortal({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [globalError, setGlobalError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [yourName, setYourName] = useState(() => sessionStorage.getItem(NAME_KEY) || "");

  const call = async (action: string, actionPayload?: any) => {
    const { data, error } = await supabase.functions.invoke("outsourcing-portal", {
      body: { token, action, payload: actionPayload },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  useEffect(() => {
    call("list_orders")
      .then((data) => setOrders(data.orders || []))
      .catch((e) => setGlobalError(e.message || "Could not load orders."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadRecords = (orderId: string) => {
    setRecordsLoading(true);
    call("list_records", { order_id: orderId })
      .then((data) => setRecords(data.records || []))
      .catch((e) => setGlobalError(e.message || "Could not load records."))
      .finally(() => setRecordsLoading(false));
  };

  const handleSelectOrder = (o: OrderRow) => {
    setSelectedOrder(o);
    setShowDispatchForm(false);
    loadRecords(o.order_id);
  };

  const handleSaveName = (name: string) => {
    setYourName(name);
    sessionStorage.setItem(NAME_KEY, name);
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.order_id.toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.style_no || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  if (!yourName) {
    return <NamePrompt onSave={handleSaveName} />;
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <Factory className="h-5 w-5 text-indigo-600" /> Outsourcing Log
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">Logged in as <strong>{yourName}</strong></p>
        </div>
        <button
          type="button"
          onClick={() => { sessionStorage.removeItem(NAME_KEY); setYourName(""); }}
          className="text-xs font-bold text-neutral-500 hover:text-neutral-800"
        >
          Not you?
        </button>
      </div>

      {globalError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800">{globalError}</div>
      )}

      {!selectedOrder ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order, customer, or style..."
              className="w-full pl-9 pr-3 py-3 border-2 border-neutral-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-neutral-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">No matching orders.</div>
          ) : (
            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
              {filteredOrders.map((o) => (
                <button
                  key={o.order_id}
                  type="button"
                  onClick={() => handleSelectOrder(o)}
                  className="w-full text-left p-3.5 bg-white border-2 border-neutral-200 rounded-xl hover:border-indigo-400 transition-all"
                >
                  <div className="font-bold text-sm text-neutral-900">[{o.order_id}] {o.customer_name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{o.style_no || "N/A"} · Stage {o.current_stage} · {o.status}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => { setSelectedOrder(null); setRecords([]); }}
            className="text-xs font-bold text-indigo-600 hover:underline"
          >
            &larr; Back to order search
          </button>

          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="font-bold text-sm text-neutral-900">[{selectedOrder.order_id}] {selectedOrder.customer_name}</div>
            <div className="text-xs text-neutral-600 mt-0.5">{selectedOrder.style_no || "N/A"} · Currently Stage {selectedOrder.current_stage}</div>
          </div>

          {!showDispatchForm && (
            <button
              type="button"
              onClick={() => setShowDispatchForm(true)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> Log Material Sent to Vendor
            </button>
          )}

          {showDispatchForm && (
            <DispatchForm
              order={selectedOrder}
              yourName={yourName}
              onCancel={() => setShowDispatchForm(false)}
              onSubmit={async (payload) => {
                await call("dispatch", { ...payload, order_id: selectedOrder.order_id, logged_by_name: yourName });
                setShowDispatchForm(false);
                loadRecords(selectedOrder.order_id);
              }}
            />
          )}

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Outsourcing Activity ({records.length})
            </h3>
            {recordsLoading ? (
              <div className="py-8 text-center text-sm text-neutral-400">Loading...</div>
            ) : records.length === 0 ? (
              <div className="py-8 text-center text-sm text-neutral-400 border border-dashed rounded-xl">
                No material outsourced for this order yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {records.map((r) => (
                  <RecordCard
                    key={r.id}
                    record={r}
                    yourName={yourName}
                    onReceive={async (qty) => {
                      await call("receive", { record_id: r.id, quantity_received: qty, received_by_name: yourName });
                      loadRecords(selectedOrder.order_id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NamePrompt({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}
        className="max-w-sm w-full bg-white border-2 border-neutral-200 rounded-2xl p-6 space-y-4"
      >
        <div className="text-center">
          <Factory className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
          <h1 className="font-black text-lg text-neutral-900">Outsourcing Log</h1>
          <p className="text-xs text-neutral-500 mt-1">Every entry is recorded under your name — enter it to continue.</p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="w-full p-3 border-2 border-neutral-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white font-bold text-sm rounded-xl"
        >
          Continue
        </button>
      </form>
    </div>
  );
}

function DispatchForm({
  order, yourName, onCancel, onSubmit,
}: {
  order: OrderRow; yourName: string; onCancel: () => void; onSubmit: (payload: any) => Promise<void>;
}) {
  const stageOptions = order.selected_stages && order.selected_stages.length > 0
    ? order.selected_stages
    : Array.from({ length: 13 }, (_, i) => i + 1);
  const [stageNumber, setStageNumber] = useState(stageOptions[0]);
  const [vendorName, setVendorName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [qty, setQty] = useState("");
  const [materialType, setMaterialType] = useState<MaterialType>("fabric_rolls");
  const [materialDescription, setMaterialDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!vendorName.trim() || !poNumber.trim() || !qty || Number(qty) <= 0) {
      setError("Vendor name, PO/reference number, and a quantity greater than 0 are required.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        stage_number: stageNumber,
        vendor_name: vendorName.trim(),
        outsource_po_number: poNumber.trim(),
        quantity_dispatched: Number(qty),
        material_type: materialType,
        material_description: materialDescription.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err: any) {
      setError(err.message || "Failed to log dispatch.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-2 border-indigo-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5"><Truck className="h-4 w-4 text-indigo-600" /> Material Going Out</h4>
        <button type="button" onClick={onCancel} className="p-1 text-neutral-400 hover:text-neutral-700"><X className="h-4 w-4" /></button>
      </div>

      {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-800">{error}</div>}

      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Stage Being Outsourced</label>
        <select value={stageNumber} onChange={(e) => setStageNumber(Number(e.target.value))} className="w-full p-2.5 border rounded-lg text-sm">
          {stageOptions.map((s) => <option key={s} value={s}>{STAGE_NAMES[s] || `Stage ${s}`}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Vendor Name *</label>
        <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Al-Noor Cutting Works" className="w-full p-2.5 border rounded-lg text-sm" />
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Vendor PO / Reference # *</label>
        <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. VPO-2026-014" className="w-full p-2.5 border rounded-lg text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Material Type</label>
          <select value={materialType} onChange={(e) => setMaterialType(e.target.value as MaterialType)} className="w-full p-2.5 border rounded-lg text-sm">
            {MATERIAL_TYPE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Quantity *</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 500" className="w-full p-2.5 border rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Description (lot #, rolls, etc.)</label>
        <input value={materialDescription} onChange={(e) => setMaterialDescription(e.target.value)} placeholder="e.g. 5 rolls, lot #FL-2026-0042" className="w-full p-2.5 border rounded-lg text-sm" />
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full p-2.5 border rounded-lg text-sm" />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white font-bold text-sm rounded-xl"
      >
        {submitting ? "Saving..." : `Log Dispatch (as ${yourName})`}
      </button>
    </form>
  );
}

function RecordCard({ record, yourName, onReceive }: { record: RecordRow; yourName: string; onReceive: (qty: number) => Promise<void> }) {
  const [showReceive, setShowReceive] = useState(false);
  const [qty, setQty] = useState(String(record.quantity_dispatched));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isOpen = record.vendor_status !== "Returned_Complete";

  const handleReceive = async () => {
    setError("");
    const n = Number(qty);
    if (!n || n < 0) { setError("Enter a valid quantity."); return; }
    setSubmitting(true);
    try {
      await onReceive(n);
      setShowReceive(false);
    } catch (err: any) {
      setError(err.message || "Failed to log receipt.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <span className="font-bold text-sm text-neutral-900">{record.vendor_name}</span>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[record.vendor_status] || "bg-neutral-50 text-neutral-700 border-neutral-200"}`}>
          {record.vendor_status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="text-xs text-neutral-500">
        {record.stage_name} · PO {record.outsource_po_number}
        {record.material_description ? ` · ${record.material_description}` : ""}
      </div>
      <div className="text-xs font-semibold text-neutral-700">
        {record.quantity_received}/{record.quantity_dispatched} received
        {(record.quantity_short || 0) > 0 && (
          <span className="ml-1.5 inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" /> {record.quantity_short} short</span>
        )}
      </div>

      {isOpen && !showReceive && (
        <button
          type="button"
          onClick={() => setShowReceive(true)}
          className="w-full mt-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
        >
          <PackageCheck className="h-3.5 w-3.5" /> Log Material Received
        </button>
      )}

      {showReceive && (
        <div className="pt-2 border-t space-y-2">
          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] font-bold text-red-800">{error}</div>}
          <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">Quantity Received</label>
          <input type="number" min={0} max={record.quantity_dispatched} value={qty} onChange={(e) => setQty(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowReceive(false)} className="flex-1 py-2 border rounded-lg text-xs font-bold text-neutral-600">Cancel</button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleReceive}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm (as {yourName})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
