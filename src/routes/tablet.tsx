import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { AppShell } from "../components/AppShell";
import {
  ScanLine,
  Play,
  CheckCircle2,
  XOctagon,
  ArrowRightCircle,
  LogOut,
  Barcode,
  User,
  AlertTriangle,
  X,
  Layers,
  Sparkles,
  ShieldAlert,
  Clock,
  RotateCcw,
  Check
} from "lucide-react";

export const Route = createFileRoute("/tablet")({
  head: () => ({
    meta: [
      { title: "Shop Floor Tablet Scan Mode · Forge & Fabric Industries, Inc." },
      { name: "description", content: "High-contrast tactile touch interface for sewing and wash workstation operators." },
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
  { code: "ST-01", label: "Skipped Stitching", category: "Sewing" },
  { code: "ST-02", label: "Broken Thread / Tension", category: "Sewing" },
  { code: "FB-01", label: "Fabric Slub / Flaw", category: "Material" },
  { code: "WS-01", label: "Uneven Wash / Streaking", category: "Laundry" },
  { code: "TR-01", label: "Missing Rivet / Button", category: "Trims" },
  { code: "DM-01", label: "Measurement Tolerance Out", category: "Fit" },
];

const WORKSTATIONS = [
  { id: "ws-sew-01", name: "Sewing Line A1 (Front/Back)", stage: 7 },
  { id: "ws-sew-02", name: "Sewing Line A2 (Waistband)", stage: 7 },
  { id: "ws-wash-01", name: "Laundry Wash Line 01", stage: 9 },
  { id: "ws-qc-01", name: "Inline QC Workstation", stage: 8 },
];

export function TabletKioskPage() {
  const { user } = useAuth();
  const [operatorName, setOperatorName] = useState(user?.customer_name || user?.full_name || "Floor Operator 01");
  const [selectedStation, setSelectedStation] = useState(WORKSTATIONS[0].id);
  const [isClockedIn, setIsClockedIn] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [bundle, setBundle] = useState<ScannedBundle | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [showDefectPicker, setShowDefectPicker] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [recentScans, setRecentScans] = useState<Array<{ barcode: string; action: string; time: string }>>([
    { barcode: "BND-2026-WM-30", action: "Started", time: "2 mins ago" },
    { barcode: "BND-2026-WM-32", action: "Passed QC", time: "14 mins ago" },
  ]);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isClockedIn && !bundle) {
      barcodeRef.current?.focus();
    }
  }, [isClockedIn, bundle]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleLookupBundle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
            colorway: b.colorway || "Indigo Raw",
            size_code: b.size || "32",
            quantity: b.quantity || 10,
            status: b.status || "Ready",
          });
          return;
        }
      }

      // Demo/Fallback simulated bundle
      setBundle({
        id: `bnd-${Date.now()}`,
        bundle_barcode: clean,
        work_order_id: "PO-WM-2026-101",
        colorway: "Vintage Indigo Rinse",
        size_code: "32",
        quantity: 12,
        status: "In_Progress",
      });
      setToast({ type: "success", text: `Active bundle ${clean} loaded onto tablet.` });
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
      setRecentScans((prev) => [{ barcode: bundle.bundle_barcode, action: "Started", time: "Just now" }, ...prev]);
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
      setRecentScans((prev) => [{ barcode: bundle.bundle_barcode, action: "Passed QC", time: "Just now" }, ...prev]);
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
      setRecentScans((prev) => [{ barcode: bundle.bundle_barcode, action: `Defect (${defectCode})`, time: "Just now" }, ...prev]);
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
      setRecentScans((prev) => [{ barcode: bundle.bundle_barcode, action: "Stage Complete", time: "Just now" }, ...prev]);
      setToast({ type: "success", text: `Stage complete for ${bundle.bundle_barcode}.` });
      resetScan();
    } catch (err: any) {
      setToast({ type: "error", text: err.message || "Failed to complete stage." });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        
        {/* Top Kiosk Header Banner */}
        <div className="glass-surface rounded-3xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-bold text-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-foreground">Tablet Scan Mode</h1>
                <span className="text-[10px] font-mono font-bold bg-[#0071E3]/10 text-[#0071E3] px-2 py-0.5 rounded-full">
                  Floor Kiosk
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">High-velocity tactile interface for workstation operators and floor QC.</p>
            </div>
          </div>

          {/* Workstation & Operator Badges */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-foreground">{operatorName}</div>
              <div className="text-[10px] font-medium text-muted-foreground">Operator Session Active</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-black/[0.04] dark:bg-white/10 flex items-center justify-center font-bold text-xs text-foreground">
              {operatorName.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Workstation Selector Rail */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
            Workstation:
          </span>
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08]">
            {WORKSTATIONS.map((ws) => (
              <button
                key={ws.id}
                onClick={() => setSelectedStation(ws.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all shrink-0 cursor-pointer ${
                  selectedStation === ws.id
                    ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ws.name}
              </button>
            ))}
          </div>
        </div>

        {/* Toast Feedback */}
        {toast && (
          <div className={`p-4 rounded-2xl font-semibold text-xs flex items-center gap-2.5 shadow-sm animate-apple-fade-in ${
            toast.type === "success" 
              ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200" 
              : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
          }`}>
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Main Touch Kiosk Interactive Area */}
        {!bundle ? (
          /* SCAN FORM SCREEN */
          <div className="glass-surface rounded-3xl p-8 border border-white/80 dark:border-white/[0.08] shadow-xs text-center space-y-6">
            <div className="h-16 w-16 rounded-3xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mx-auto shadow-xs">
              <Barcode className="w-8 h-8" />
            </div>

            <div className="max-w-md mx-auto space-y-1">
              <h2 className="text-xl font-bold text-foreground tracking-tight">Scan Bundle Tag / Barcode</h2>
              <p className="text-xs text-muted-foreground">Scan with bluetooth hardware gun or enter the ticket number below.</p>
            </div>

            <form onSubmit={handleLookupBundle} className="max-w-md mx-auto space-y-3">
              <div className="relative">
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. BND-2026-WM-32"
                  className="w-full h-14 px-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border-2 border-black/[0.08] dark:border-white/[0.1] text-foreground text-lg font-mono font-bold text-center placeholder:text-muted-foreground/50 focus:border-[#0071E3] focus:outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLooking || !barcodeInput.trim()}
                className="w-full h-12 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md shadow-[#0071E3]/20 disabled:opacity-40 cursor-pointer"
              >
                <ScanLine className="w-4 h-4" /> {isLooking ? "Querying MES Floor..." : "Look Up Floor Bundle"}
              </button>
            </form>

            {/* Quick Demo Simulator Barcode Pills */}
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] max-w-md mx-auto">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Quick Test Barcodes:</span>
              <div className="flex flex-wrap justify-center gap-2">
                {["BND-2026-WM-30", "BND-2026-WM-32", "BND-2026-FOG-01"].map((code) => (
                  <button
                    key={code}
                    onClick={() => {
                      setBarcodeInput(code);
                      setTimeout(() => handleLookupBundle(), 50);
                    }}
                    className="px-3 py-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] border border-black/[0.06] text-xs font-mono font-semibold text-foreground transition-all cursor-pointer"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE BUNDLE ACTIONS SCREEN */
          <div className="space-y-4 animate-apple-fade-in">
            {/* Active Bundle Card */}
            <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-bold text-[#0071E3]">{bundle.bundle_barcode}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 text-[10px] font-mono font-bold text-foreground">
                    {bundle.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  PO Ref: <strong className="text-foreground">{bundle.work_order_id}</strong> &bull; Color: <strong className="text-foreground">{bundle.colorway}</strong> &bull; Size: <strong className="text-foreground">{bundle.size_code}</strong> &bull; <strong className="text-[#0071E3]">{bundle.quantity} pcs</strong>
                </div>
              </div>

              <button
                onClick={resetScan}
                className="h-10 px-4 rounded-xl bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.08] text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Scan Next Bundle
              </button>
            </div>

            {/* 4 Apple Tactile Workstation Touch Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleStartBundle}
                className="h-28 rounded-3xl bg-[#0071E3] hover:bg-[#0077ED] text-white p-5 flex flex-col justify-between items-start active:scale-98 transition-all shadow-md shadow-[#0071E3]/20 cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/80">Step 1 &bull; Floor Intake</span>
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-base font-bold tracking-tight">START WORK ORDER</div>
                  <div className="text-[11px] text-white/80 mt-0.5">Assign bundle to current sewing line operator</div>
                </div>
              </button>

              <button
                onClick={handleLogPass}
                className="h-28 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-100 p-5 flex flex-col justify-between items-start active:scale-98 transition-all shadow-md cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-80">Step 2 &bull; Quality Pass</span>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-base font-bold tracking-tight">LOG QC PASS</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Verify 100% tolerance without defect findings</div>
                </div>
              </button>

              <button
                onClick={() => setShowDefectPicker(true)}
                className="h-28 rounded-3xl bg-white dark:bg-[#1A2030] hover:bg-rose-50/50 dark:hover:bg-rose-950/20 border border-black/[0.08] dark:border-white/[0.1] text-foreground p-5 flex flex-col justify-between items-start active:scale-98 transition-all shadow-xs cursor-pointer group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400">Step 3 &bull; Quality Alert</span>
                  <XOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <div className="text-base font-bold tracking-tight text-rose-600 dark:text-rose-400">FLAG DEFECT &amp; REWORK</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Categorize issue and route to correction station</div>
                </div>
              </button>

              <button
                onClick={handleCompleteStage}
                className="h-28 rounded-3xl bg-white dark:bg-[#1A2030] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-foreground p-5 flex flex-col justify-between items-start active:scale-98 transition-all shadow-xs cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Step 4 &bull; Gate Advance</span>
                  <ArrowRightCircle className="w-5 h-5 text-[#0071E3]" />
                </div>
                <div>
                  <div className="text-base font-bold tracking-tight">COMPLETE &amp; ADVANCE</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Forward bundle to next manufacturing station</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Defect Taxonomy Picker Modal */}
        {showDefectPicker && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-apple-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#151926] rounded-3xl p-6 border border-black/[0.08] dark:border-white/[0.1] shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <h3 className="text-base font-bold text-foreground">Categorize Defect Root Cause</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Select the verified non-conformance taxonomy code.</p>
                </div>
                <button
                  onClick={() => setShowDefectPicker(false)}
                  className="h-8 w-8 rounded-full bg-black/[0.04] dark:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {DEFECT_CODES.map((d) => (
                  <button
                    key={d.code}
                    onClick={() => handleLogDefect(d.code)}
                    className="w-full p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-black/[0.06] dark:border-white/[0.08] hover:border-rose-300 text-left flex items-center justify-between active:scale-98 transition-all cursor-pointer group"
                  >
                    <div>
                      <span className="text-xs font-bold text-foreground group-hover:text-rose-700 dark:group-hover:text-rose-300 block">
                        {d.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">{d.category} Category</span>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/10 text-muted-foreground group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50 group-hover:text-rose-700 dark:group-hover:text-rose-200">
                      {d.code}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live Workstation Floor Activity Log */}
        <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Recent Floor Touch Events
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground">Live Telemetry</span>
          </div>

          <div className="space-y-2">
            {recentScans.map((scan, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] text-xs"
              >
                <div className="flex items-center gap-3">
                  <Barcode className="h-4 w-4 text-[#0071E3]" />
                  <span className="font-mono font-bold text-foreground">{scan.barcode}</span>
                  <span className="text-muted-foreground">&bull;</span>
                  <span className="font-semibold text-foreground">{scan.action}</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">{scan.time}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
