import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import {
  ScanLine, Play, CheckCircle2, XOctagon, ArrowRightCircle,
  LogOut, Barcode, User, AlertTriangle, X,
} from "lucide-react";

export const Route = createFileRoute("/tablet")({
  head: () => ({
    meta: [
      { title: "Shop Floor Tablet · Forge & Fabric Industries, Inc." },
      { name: "description", content: "High-contrast large-touch operator interface for sewing and wash workstation tablets." },
    ],
  }),
  component: TabletKioskPage,
});

interface ScannedBundle {
  id?: string;
  bundle_barcode: string;
  work_order_id?: string;
  style_code?: string;
  colorway?: string;
  size_code?: string;
  quantity?: number;
  status?: string;
}

const DEFECT_CODES = [
  { code: "ST-01", label: "Skipped Stitching" },
  { code: "ST-02", label: "Broken Thread" },
  { code: "FB-01", label: "Fabric Slub / Flaw" },
  { code: "WS-01", label: "Uneven Wash" },
  { code: "TR-01", label: "Missing Rivet / Button" },
];

/** REQ-12: High-Velocity Mobile / Tablet Shop Floor Touch Interface. */
function TabletKioskPage() {
  const { user } = useAuth();
  const [operatorName, setOperatorName] = useState("");
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [bundle, setBundle] = useState<ScannedBundle | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [showDefectPicker, setShowDefectPicker] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isClockedIn) barcodeRef.current?.focus();
  }, [isClockedIn]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleClockIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorName.trim()) return;
    setIsClockedIn(true);
  };

  const handleClockOut = () => {
    setIsClockedIn(false);
    setOperatorName("");
    setBundle(null);
    setBarcodeInput("");
  };

  const handleLookupBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = barcodeInput.trim().toUpperCase();
    if (!clean) return;
    setIsLooking(true);
    setBundle(null);
    try {
      if (isRealSupabase) {
        const { data } = await supabase.from("bundles").select("*").ilike("bundle_barcode", `%${clean}%`).limit(1);
        if (data && data.length > 0) {
          const b = data[0];
          setBundle({
            id: b.id,
            bundle_barcode: b.bundle_barcode,
            work_order_id: b.work_order_id,
            colorway: b.colorway,
            size_code: b.size,
            quantity: b.quantity,
            status: b.status,
          });
          return;
        }
      }
      setToast({ type: "error", text: `Bundle "${clean}" not found. Check the barcode and try again.` });
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "Lookup failed." });
    } finally {
      setIsLooking(false);
    }
  };

  const resetScan = () => {
    setBundle(null);
    setBarcodeInput("");
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  const handleStartBundle = async () => {
    if (!bundle) return;
    try {
      if (isRealSupabase) {
        await supabase.from("bundles").update({ status: "In_Progress" }).eq("bundle_barcode", bundle.bundle_barcode);
        await supabase.from("scan_events").insert({ bundle_id: bundle.id, stage_id: 7, operator_id: operatorName, status: "passed" });
      }
      setToast({ type: "success", text: `Bundle ${bundle.bundle_barcode} started by ${operatorName}.` });
      resetScan();
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "Failed to start bundle." });
    }
  };

  const handleLogPass = async () => {
    if (!bundle) return;
    try {
      if (isRealSupabase) {
        await supabase.from("qc_inspections").insert({
          bundle_barcode: bundle.bundle_barcode,
          style_code: bundle.work_order_id,
          colorway: bundle.colorway,
          size_code: bundle.size_code,
          inspected_qty: bundle.quantity || 1,
          passed_qty: bundle.quantity || 1,
          failed_qty: 0,
          result: "Pass",
          operator_name_internal: operatorName,
        });
      }
      setToast({ type: "success", text: `Pass logged for ${bundle.bundle_barcode}.` });
      resetScan();
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "Failed to log pass." });
    }
  };

  const handleLogDefect = async (defectCode: string) => {
    if (!bundle) return;
    try {
      const matched = DEFECT_CODES.find((d) => d.code === defectCode);
      if (isRealSupabase) {
        await supabase.from("qc_inspections").insert({
          bundle_barcode: bundle.bundle_barcode,
          style_code: bundle.work_order_id,
          colorway: bundle.colorway,
          size_code: bundle.size_code,
          inspected_qty: bundle.quantity || 1,
          passed_qty: 0,
          failed_qty: bundle.quantity || 1,
          defect_code: defectCode,
          defect_category: matched?.label,
          result: "Rework",
          operator_name_internal: operatorName,
        });
        await supabase.from("bundles").update({ status: "Rework" }).eq("bundle_barcode", bundle.bundle_barcode);
      }
      setToast({ type: "success", text: `Defect ${defectCode} logged. Bundle routed to Rework.` });
      setShowDefectPicker(false);
      resetScan();
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "Failed to log defect." });
    }
  };

  const handleCompleteStage = async () => {
    if (!bundle) return;
    try {
      if (isRealSupabase) {
        await supabase.from("bundles").update({ status: "Passed" }).eq("bundle_barcode", bundle.bundle_barcode);
        await supabase.from("scan_events").insert({ bundle_id: bundle.id, stage_id: 8, operator_id: operatorName, status: "passed" });
      }
      setToast({ type: "success", text: `Stage complete for ${bundle.bundle_barcode}.` });
      resetScan();
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "Failed to complete stage." });
    }
  };

  // -- Clock-in screen --
  if (!isClockedIn) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <form onSubmit={handleClockIn} className="w-full max-w-md bg-neutral-900 border-2 border-neutral-800 rounded-3xl p-8 space-y-6 text-center">
          <User className="w-14 h-14 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-black text-white">Shop Floor Tablet</h1>
          <p className="text-neutral-400 text-sm">Scan or type your operator badge to begin your shift.</p>
          <input
            type="text"
            autoFocus
            required
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            placeholder="Operator Badge / Name"
            className="w-full h-16 px-5 rounded-2xl bg-neutral-800 border-2 border-neutral-700 text-white text-lg font-bold text-center focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full h-[60px] rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-lg font-black flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Play className="w-6 h-6" /> Clock In & Start Scanning
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 md:p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-neutral-900 border-2 border-neutral-800 rounded-2xl px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
            {operatorName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-black text-sm">{operatorName}</div>
            <div className="text-[11px] text-neutral-400">Shift Active</div>
          </div>
        </div>
        <button
          onClick={handleClockOut}
          className="h-[52px] px-5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm flex items-center gap-2"
        >
          <LogOut className="w-5 h-5" /> Clock Out
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`p-4 rounded-2xl font-bold text-sm flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-900/60 border-2 border-emerald-600 text-emerald-200" : "bg-red-900/60 border-2 border-red-600 text-red-200"}`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          {toast.text}
        </div>
      )}

      {!bundle ? (
        /* Scan screen */
        <form onSubmit={handleLookupBundle} className="flex-1 flex flex-col items-center justify-center gap-6">
          <Barcode className="w-20 h-20 text-amber-400" />
          <h2 className="text-xl font-black text-center">Scan Bundle Barcode</h2>
          <input
            ref={barcodeRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
            placeholder="BND-501-RAW-30-01"
            className="w-full max-w-lg h-20 px-6 rounded-2xl bg-neutral-900 border-2 border-neutral-700 text-white text-2xl font-mono font-black text-center focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLooking}
            className="w-full max-w-lg h-[60px] rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-lg font-black flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            <ScanLine className="w-6 h-6" /> {isLooking ? "Looking up..." : "Look Up Bundle"}
          </button>
        </form>
      ) : (
        /* Action screen */
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-neutral-900 border-2 border-amber-500/40 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="font-mono font-black text-2xl text-amber-400">{bundle.bundle_barcode}</div>
              <div className="text-neutral-400 text-sm mt-1">
                {bundle.colorway} · Size {bundle.size_code} · {bundle.quantity} pcs · Status: {bundle.status}
              </div>
            </div>
            <button onClick={resetScan} className="h-[52px] w-[52px] rounded-xl bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <button
              onClick={handleStartBundle}
              className="h-[100px] sm:h-full rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xl font-black flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Play className="w-9 h-9" /> START BUNDLE
            </button>
            <button
              onClick={handleLogPass}
              className="h-[100px] sm:h-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-black flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-9 h-9" /> LOG PASS
            </button>
            <button
              onClick={() => setShowDefectPicker(true)}
              className="h-[100px] sm:h-full rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xl font-black flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <XOctagon className="w-9 h-9" /> LOG DEFECT
            </button>
            <button
              onClick={handleCompleteStage}
              className="h-[100px] sm:h-full rounded-2xl bg-neutral-700 hover:bg-neutral-600 text-white text-xl font-black flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <ArrowRightCircle className="w-9 h-9" /> COMPLETE STAGE
            </button>
          </div>
        </div>
      )}

      {/* Defect Picker */}
      {showDefectPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border-2 border-neutral-700 rounded-3xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Select Defect Code</h3>
              <button onClick={() => setShowDefectPicker(false)}><X className="w-6 h-6 text-neutral-400" /></button>
            </div>
            {DEFECT_CODES.map((d) => (
              <button
                key={d.code}
                onClick={() => handleLogDefect(d.code)}
                className="w-full h-[60px] rounded-xl bg-neutral-800 hover:bg-red-900/40 border-2 border-neutral-700 hover:border-red-600 text-white font-bold text-left px-5 flex items-center justify-between active:scale-95 transition-all"
              >
                <span>{d.label}</span>
                <span className="font-mono text-red-400">{d.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
