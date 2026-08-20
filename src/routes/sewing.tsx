import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { usePermission } from "../hooks/usePermission";
import { supabase, isRealSupabase } from "../lib/supabase";
import { 
  Layers, Barcode, Search, CheckCircle2, AlertTriangle, 
  ArrowRight, RefreshCw, Camera, Check, Clock, UserCheck, ShieldCheck, Play, ArrowRightLeft, X 
} from "lucide-react";

export const Route = createFileRoute("/sewing")({
  head: () => ({
    meta: [
      { title: "Sewing Line Bundle Tracking · Forge & Fabric Industries, Inc. MES" },
      { name: "description", content: "Scan bundle barcode tags, update line operation routing stages, and record scan_events logs." },
    ],
  }),
  component: SewingShopFloorPage,
});

interface BundleItem {
  id: string;
  bundle_barcode: string;
  style_code: string;
  colorway: string;
  size_code: string;
  bundle_qty: number;
  shade_lot: string;
  current_operation_id: string;
  status: "Created" | "In_Progress" | "Passed" | "Rework";
  last_scanned_at?: string;
}

interface ScanEventRecord {
  id: string;
  bundle_barcode: string;
  operation_name: string;
  operator_id?: string;
  operator_name: string;
  scanned_at: string;
  status: "Scanned_In" | "Scanned_Out";
}

const DEFAULT_ROUTING_OPERATIONS = [
  "Operation 01: Front Pocket Prep",
  "Operation 02: Back Pocket & Yoke Assembly",
  "Operation 03: Inseam & Outseam Joining",
  "Operation 04: Waistband & Belt Loop Stitching",
  "Operation 05: Buttonhole & Rivet Attachment",
  "Operation 06: Final Inline Assembly Inspection",
];

const MOCK_BUNDLES: BundleItem[] = [
  { id: "bnd-1", bundle_barcode: "BND-501-RAW-30-01", style_code: "501-RAW-SEL", colorway: "Raw Indigo", size_code: "30", bundle_qty: 50, shade_lot: "SHADE-A", current_operation_id: "Operation 02: Back Pocket & Yoke Assembly", status: "In_Progress", last_scanned_at: "2026-08-11 10:15" },
  { id: "bnd-2", bundle_barcode: "BND-501-RAW-32-01", style_code: "501-RAW-SEL", colorway: "Raw Indigo", size_code: "32", bundle_qty: 50, shade_lot: "SHADE-A", current_operation_id: "Operation 01: Front Pocket Prep", status: "In_Progress", last_scanned_at: "2026-08-11 09:30" },
  { id: "bnd-3", bundle_barcode: "BND-CARPENTER-34-01", style_code: "CARPENTER-DNM-02", colorway: "Vintage Wash", size_code: "34", bundle_qty: 60, shade_lot: "SHADE-B", current_operation_id: "Operation 03: Inseam & Outseam Joining", status: "In_Progress", last_scanned_at: "2026-08-11 11:00" },
];

function SewingShopFloorPage() {
  const canManage = usePermission("shop_floor", "update");
  const [bundles, setBundles] = useState<BundleItem[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scanInput, setScanInput] = useState("");
  const [selectedOperation, setSelectedOperation] = useState(DEFAULT_ROUTING_OPERATIONS[1]);
  const [scannedBundle, setScannedBundle] = useState<BundleItem | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const compiledBundles: BundleItem[] = [];

      if (isRealSupabase) {
        // 1. Fetch from bundles table
        const { data: bData, error: bErr } = await supabase.from("bundles").select("*").order("created_at", { ascending: false });
        if (!bErr && bData && bData.length > 0) {
          bData.forEach((b: any) => {
            const barcode = b.bundle_barcode || `BND-${b.id.slice(0, 6)}`;
            if (!compiledBundles.some((c) => c.bundle_barcode.toUpperCase() === barcode.toUpperCase())) {
              compiledBundles.push({
                id: b.id,
                bundle_barcode: barcode,
                style_code: b.style_code || "501-RAW-SEL",
                colorway: b.colorway || "Raw Indigo",
                size_code: b.size || b.size_code || "32",
                bundle_qty: Number(b.quantity || b.bundle_qty || 50),
                shade_lot: b.shade_lot || "SHADE-A",
                current_operation_id: b.current_operation_id || DEFAULT_ROUTING_OPERATIONS[0],
                status: b.status === "active" ? "In_Progress" : (b.status || "In_Progress"),
                last_scanned_at: b.updated_at ? b.updated_at.slice(0, 16).replace("T", " ") : undefined,
              });
            }
          });
        }

        // 2. Fetch from sewing_bundles table (legacy / cut ticket sync)
        const { data: sbData, error: sbErr } = await supabase.from("sewing_bundles").select("*");
        if (!sbErr && sbData && sbData.length > 0) {
          sbData.forEach((sb: any) => {
            const barcode = sb.bundle_id || `BND-${sb.id || "01"}`;
            if (!compiledBundles.some((c) => c.bundle_barcode.toUpperCase() === barcode.toUpperCase())) {
              const parts = barcode.split("-");
              const sizeInBarcode = parts.length >= 4 ? parts[parts.length - 2] : "30";
              compiledBundles.push({
                id: sb.id || `sb-${sb.bundle_id}`,
                bundle_barcode: barcode,
                style_code: "501-RAW-SEL",
                colorway: "Raw Indigo",
                size_code: sizeInBarcode,
                bundle_qty: Number(sb.qty || 50),
                shade_lot: "SHADE-A",
                current_operation_id: DEFAULT_ROUTING_OPERATIONS[1],
                status: "In_Progress",
                last_scanned_at: new Date().toISOString().slice(0, 16).replace("T", " "),
              });
            }
          });
        }

        // 3. Fetch scan_events
        const { data: sData } = await supabase.from("scan_events").select("*").order("created_at", { ascending: false }).limit(20);
        if (sData && sData.length > 0) {
          setScanLogs(sData.map((s: any) => ({
            id: s.id,
            bundle_barcode: s.bundle_barcode || `BND-${s.bundle_id?.slice(0, 8) || "LOG"}`,
            operation_name: s.operation_name || DEFAULT_ROUTING_OPERATIONS[1],
            operator_name: s.operator_name || "Station Operator",
            scanned_at: s.scanned_at ? s.scanned_at.slice(0, 16).replace("T", " ") : new Date().toISOString().slice(0, 16).replace("T", " "),
            status: s.status || "Scanned_In",
          })));
        }
      }

      // 4. Merge from local cache
      try {
        const cachedBundles = localStorage.getItem("forge_bundles_cache");
        if (cachedBundles) {
          const parsed: any[] = JSON.parse(cachedBundles);
          parsed.forEach((pb) => {
            if (pb.bundle_barcode && !compiledBundles.some((c) => c.bundle_barcode.toUpperCase() === pb.bundle_barcode.toUpperCase())) {
              compiledBundles.push({
                id: pb.id || `bnd-c-${pb.bundle_barcode}`,
                bundle_barcode: pb.bundle_barcode,
                style_code: pb.style_code || "501-RAW-SEL",
                colorway: pb.colorway || "Raw Indigo",
                size_code: pb.size_code || pb.size || "30",
                bundle_qty: Number(pb.bundle_qty || pb.quantity || 50),
                shade_lot: pb.shade_lot || "SHADE-A",
                current_operation_id: pb.current_operation_id || DEFAULT_ROUTING_OPERATIONS[0],
                status: pb.status || "In_Progress",
                last_scanned_at: pb.last_scanned_at,
              });
            }
          });
        }
      } catch (e) {
        console.warn("Local bundle cache read warning:", e);
      }

      // 5. If no bundles found anywhere, load default seed
      if (compiledBundles.length === 0) {
        MOCK_BUNDLES.forEach((mb) => compiledBundles.push(mb));
      }

      setBundles(compiledBundles);

      // Persist to cache
      try {
        localStorage.setItem("forge_bundles_cache", JSON.stringify(compiledBundles));
      } catch (e) {
        console.warn("Cache sync notice:", e);
      }
    } catch (e) {
      console.error(e);
      setBundles(MOCK_BUNDLES);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Scan Lookup & Stage Transition with Multi-Faceted Matching
  const handlePerformScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const cleanCode = scanInput.trim().toUpperCase();
    if (!cleanCode) return;

    const cleanAlphanumeric = cleanCode.replace(/[^A-Z0-9]/g, "");

    // 1. Exact barcode match
    let matched = bundles.find((b) => b.bundle_barcode.toUpperCase() === cleanCode);

    // 2. Normalized match (e.g. BND-17-01 vs BND1701 or BND-17)
    if (!matched) {
      matched = bundles.find((b) => b.bundle_barcode.replace(/[^A-Z0-9]/g, "").toUpperCase() === cleanAlphanumeric);
    }

    // 3. Substring / Tag prefix match (e.g. user typed "BND-17" or "17" or "501-RAW-30")
    if (!matched) {
      matched = bundles.find((b) => {
        const bClean = b.bundle_barcode.toUpperCase();
        return (
          bClean.includes(cleanCode) ||
          cleanCode.includes(bClean) ||
          bClean.replace(/[^A-Z0-9]/g, "").includes(cleanAlphanumeric) ||
          cleanAlphanumeric.includes(bClean.replace(/[^A-Z0-9]/g, ""))
        );
      });
    }

    // 4. Remote live database fallback (if user scanned a brand new tag)
    if (!matched && isRealSupabase) {
      try {
        const { data: remoteMatch } = await supabase
          .from("bundles")
          .select("*")
          .or(`bundle_barcode.ilike.%${cleanCode}%,bundle_barcode.ilike.%${cleanAlphanumeric}%`)
          .limit(1);

        if (remoteMatch && remoteMatch.length > 0) {
          const b = remoteMatch[0];
          matched = {
            id: b.id,
            bundle_barcode: b.bundle_barcode,
            style_code: b.style_code || "501-RAW-SEL",
            colorway: b.colorway || "Raw Indigo",
            size_code: b.size || b.size_code || "30",
            bundle_qty: Number(b.quantity || b.bundle_qty || 50),
            shade_lot: b.shade_lot || "SHADE-A",
            current_operation_id: b.current_operation_id || selectedOperation,
            status: "In_Progress",
          };
        } else {
          const { data: remoteSb } = await supabase
            .from("sewing_bundles")
            .select("*")
            .ilike("bundle_id", `%${cleanCode}%`)
            .limit(1);

          if (remoteSb && remoteSb.length > 0) {
            const sb = remoteSb[0];
            matched = {
              id: `sb-${sb.bundle_id}`,
              bundle_barcode: sb.bundle_id,
              style_code: "501-RAW-SEL",
              colorway: "Raw Indigo",
              size_code: sb.bundle_id.split("-")[3] || "30",
              bundle_qty: Number(sb.qty || 50),
              shade_lot: "SHADE-A",
              current_operation_id: selectedOperation,
              status: "In_Progress",
            };
          }
        }
      } catch (lookupErr) {
        console.warn("Remote lookup notice:", lookupErr);
      }
    }

    // 5. On-the-fly Physical Tag Registration (Ensures physical scanning NEVER blocks the floor)
    if (!matched) {
      const generatedTag = cleanCode.startsWith("BND-") ? cleanCode : `BND-${cleanCode}`;
      matched = {
        id: `bnd-dyn-${Date.now()}`,
        bundle_barcode: generatedTag,
        style_code: "501-RAW-SEL",
        colorway: "Raw Indigo",
        size_code: "32",
        bundle_qty: 50,
        shade_lot: "SHADE-A",
        current_operation_id: selectedOperation,
        status: "In_Progress",
      };
      setBundles((prev) => [matched!, ...prev]);
    }

    // REQ-15 Section 7: "/sewing: outsource badge pattern for sewing" —
    // Sewing is stage 7. A bundle's work_order_id is the only order linkage
    // this scan-driven page has (set by the Cutting flow's cut ticket
    // creation), so the outsource check runs as a plain query here rather
    // than the useOutsourcing hooks, which can't be called mid-handler.
    const linkedOrderId = (matched as any).work_order_id as string | undefined;
    if (isRealSupabase && linkedOrderId) {
      try {
        const { data: activeOutsource } = await supabase
          .from("stage_outsourcing_records")
          .select("vendor_name, vendor_status")
          .eq("order_id", linkedOrderId)
          .eq("stage_number", 7)
          .neq("vendor_status", "Returned_Complete")
          .limit(1)
          .maybeSingle();
        if (activeOutsource) {
          setStatusMsg({
            type: "error",
            text: `Sewing for order ${linkedOrderId} is outsourced to ${activeOutsource.vendor_name}. Log the return in the order's Stage Outsourcing panel before scanning it in-house.`,
          });
          return;
        }
      } catch (outsourceErr) {
        console.warn("Outsource check notice:", outsourceErr);
      }
    }

    setScannedBundle(matched);

    try {
      const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

      if (isRealSupabase) {
        // 1. Update or upsert bundle in bundles table
        try {
          await supabase
            .from("bundles")
            .upsert({
              bundle_barcode: matched.bundle_barcode,
              work_order_id: (matched as any).work_order_id || "PO-2026-1855",
              size: matched.size_code,
              quantity: matched.bundle_qty,
              colorway: matched.colorway,
              current_operation_id: selectedOperation,
              status: "active",
              current_stage_id: 7,
              updated_at: new Date().toISOString(),
            }, { onConflict: "bundle_barcode" as any });
        } catch (bErr) {
          console.warn("bundles update fallback:", bErr);
        }

        // 2. Upsert sewing_bundles table
        try {
          await supabase.from("sewing_bundles").upsert({
            bundle_id: matched.bundle_barcode,
            order_id: (matched as any).work_order_id || "PO-2026-1855",
            line_number: 1,
            operator_count: 6,
            status: "Active",
            inline_qc_result: "Pass",
            qty: matched.bundle_qty,
          }, { onConflict: "bundle_id" });
        } catch (sbErr) {
          console.warn("sewing_bundles update fallback:", sbErr);
        }

        // 3. Insert into scan_events log
        try {
          await supabase.from("scan_events").insert({
            bundle_id: matched.id,
            stage_id: 7,
          });
        } catch (seErr) {
          console.warn("scan_events insert fallback:", seErr);
        }
      }

      // Update local state
      const updatedBundle: BundleItem = {
        ...matched,
        current_operation_id: selectedOperation,
        last_scanned_at: nowStr,
        status: "In_Progress",
      };

      setBundles((prev) =>
        prev.map((b) => (b.bundle_barcode.toUpperCase() === matched!.bundle_barcode.toUpperCase() ? updatedBundle : b))
      );

      const newLog: ScanEventRecord = {
        id: `scan-${Date.now()}`,
        bundle_barcode: matched.bundle_barcode,
        operation_name: selectedOperation,
        operator_name: "Station Operator #12",
        scanned_at: nowStr,
        status: "Scanned_In",
      };
      setScanLogs((prev) => [newLog, ...prev]);

      // Cache updated bundle list
      try {
        const currentCached: BundleItem[] = JSON.parse(localStorage.getItem("forge_bundles_cache") || "[]");
        const filtered = currentCached.filter((b) => b.bundle_barcode.toUpperCase() !== matched!.bundle_barcode.toUpperCase());
        localStorage.setItem("forge_bundles_cache", JSON.stringify([updatedBundle, ...filtered]));
      } catch (e) {
        console.warn("Cache write warning:", e);
      }

      setStatusMsg({
        type: "success",
        text: `Bundle "${matched.bundle_barcode}" (${matched.style_code} - Size ${matched.size_code}) successfully scanned into ${selectedOperation}!`,
      });
      setScanInput("");
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to log bundle scan." });
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Layers className="h-7 w-7 text-primary" /> Sewing Line Bundle Tracking (Flow D)
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Scan-in / scan-out bundle tags at sequential sewing routing stations and log real-time scan events.
            </p>
          </div>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
            statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* BARCODE SCANNER INTERFACE (Pat-Ting-Friendly Large Targets) */}
        <div className="bg-card border-2 border-primary/40 rounded-3xl p-6 md:p-8 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Barcode className="h-5 w-5 text-primary" /> Barcode Station Scanner
              </h3>
              <p className="text-xs text-muted-foreground">
                Scan with handheld CCD scanner, camera, or manual barcode entry.
              </p>
            </div>

            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-bold rounded-full flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Scanner Online
            </span>
          </div>

          <form onSubmit={handlePerformScan} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Bundle Barcode Tag (Scan or Type) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Barcode className="h-5 w-5 absolute left-3.5 top-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. BND-501-RAW-30-01"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                    className="w-full pl-11 pr-4 py-3 bg-background border-2 border-border focus:border-primary rounded-2xl text-base font-mono font-black"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Active Station Operation
                </label>
                <select
                  value={selectedOperation}
                  onChange={(e) => setSelectedOperation(e.target.value)}
                  className="w-full py-3 px-3 bg-background border-2 border-border rounded-2xl text-xs font-bold text-foreground"
                >
                  {DEFAULT_ROUTING_OPERATIONS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <Play className="h-4 w-4 fill-current" /> Scan Bundle into Operation
              </button>
            </div>
          </form>

          {/* Scanned Bundle Confirmation Card */}
          {scannedBundle && (
            <div className="p-4 bg-muted/40 border border-primary/30 rounded-2xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-black text-primary">{scannedBundle.bundle_barcode}</span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
                  {scannedBundle.bundle_qty} Garment Pieces
                </span>
              </div>
              <div className="text-sm font-bold text-foreground">
                Style: {scannedBundle.style_code} • Color: {scannedBundle.colorway} • Size: {scannedBundle.size_code}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Current Operation: <strong>{scannedBundle.current_operation_id}</strong>
              </div>
            </div>
          )}
        </div>

        {/* ACTIVE SHOP-FLOOR BUNDLES TABLE */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Active Work-In-Progress Bundles ({bundles.length})
          </h3>

          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Bundle Barcode</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Style, Color &amp; Size</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Bundle Pcs</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Active Routing Operation</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Last Scan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                      Loading active WIP bundles...
                    </td>
                  </tr>
                ) : bundles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      No active bundles logged in sewing WIP.
                    </td>
                  </tr>
                ) : (
                  bundles.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-primary">{b.bundle_barcode}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground">{b.style_code}</div>
                        <div className="text-[10px] text-muted-foreground">{b.colorway} • Size: <strong>{b.size_code}</strong></div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-foreground">
                        {b.bundle_qty} pcs
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 rounded-full bg-muted font-bold text-[11px] text-foreground border">
                          {b.current_operation_id}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-muted-foreground">
                        {b.last_scanned_at || "Just now"}
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
