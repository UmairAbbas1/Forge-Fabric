import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  PackageOpen,
  SearchCheck,
  ClipboardCheck,
  Scissors,
  Boxes,
  Cog,
  ShieldCheck,
  Droplets,
  Sparkles,
  BadgeCheck,
  Tag,
  Truck,
  X,
  TrendingUp,
  AlertOctagon,
  ArrowRight,
  Gauge,
  Factory,
  ArrowUpRight,
  Layers,
  CheckCircle2,
  Lock,
  Warehouse,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
  Activity,
  Check,
  Clock,
  Sparkle
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { AppShell, SectionCard } from "../components/AppShell";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { STAGES } from "../lib/mockData";
import { useAppData, checkStageAdvancement } from "../hooks/useAppData";
import { getNextSelectedStage } from "../lib/utils";
import { getStageFriendlyName } from "../lib/outsourcing-constants";
import { getServiceScopeChips } from "../lib/service-scope-constants";
import { useAuth } from "../hooks/useAuth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Production Flow · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Industrial 13-stage garment conversion tracker and shop floor intelligence." },
    ],
  }),
  component: Page,
});

const ICONS = {
  ClipboardList,
  PackageOpen,
  SearchCheck,
  ClipboardCheck,
  Scissors,
  Boxes,
  Cog,
  ShieldCheck,
  Droplets,
  Sparkles,
  BadgeCheck,
  Tag,
  Truck,
} as const;

// 5 Cohesive Industrial Manufacturing Zones
const PRODUCTION_ZONES = [
  {
    id: "zone-materials",
    zoneNumber: "ZONE A",
    title: "Material Intake & Inspection",
    stageIds: [1, 2, 3],
    checkpoint: { afterStage: 3, name: "Material QC Signoff" },
    description: "Intake POs, raw fabric receiving, and lab shade/GSM verification."
  },
  {
    id: "zone-cutting",
    zoneNumber: "ZONE B",
    title: "Pre-Production & CNC Cutting",
    stageIds: [4, 5, 6],
    checkpoint: { afterStage: 5, name: "First Cut Approval" },
    description: "Pattern grading, marker spreading, CNC cutting, and barcode bundling."
  },
  {
    id: "zone-assembly",
    zoneNumber: "ZONE C",
    title: "Line Assembly & Sewing",
    stageIds: [7],
    checkpoint: { afterStage: 7, name: "Inline 100% Stitch QC" },
    description: "Modular workstation sewing, pocket setting, and waistband assembly."
  },
  {
    id: "zone-wetdry",
    zoneNumber: "ZONE D",
    title: "Laundry & Wet/Dry Finishing",
    stageIds: [8, 9, 10],
    checkpoint: { afterStage: 10, name: "Wash Shade & Handfeel Audit" },
    description: "Pre-wash inspection, stone/enzyme wash, laser whisker, and 3D baking."
  },
  {
    id: "zone-logistics",
    zoneNumber: "ZONE E",
    title: "Quality Audit & Dispatch",
    stageIds: [11, 12, 13],
    checkpoint: { afterStage: 12, name: "Final AQL 2.5 & Packing" },
    description: "Final AQL audit, steam pressing, barcode tagging, and global POD freight."
  },
];

function Page() {
  const { user } = useAuth();
  const {
    orders,
    materials,
    cutting,
    sewing,
    wash,
    qc,
    advanceOrderStage,
    isOrderOnHold,
    isLoading,
    setToast,
    cartons,
    outsourceRecords,
  } = useAppData();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<string>("All");
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"flow_map" | "analytics" | "kanban">("flow_map");

  // Role guard: Only admin has full access to Production Flow dashboard
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    } else if (user.role !== "admin") {
      if (user.role === "qc") {
        navigate({ to: "/qc" });
      } else if (user.role === "customer" || user.role === "merchandiser") {
        navigate({ to: "/orders" });
      } else {
        navigate({ to: "/materials" });
      }
    }
  }, [user, navigate]);

  const EXCLUDED_BRAND_NAMES = new Set([
    "meow", "meow meow", "iwmswsws", "test brand", "ahmedsol", "ahmedsolutions", "ahmed12", "ahmed", 
    "alnasser", "neelam", "billaai", "billacompany", "billahouse", "happyai", "panda", "testingcompany", 
    "testingco", "mycompany", "bigcompany", "smallcompany", "midcompany", "low company", "umairtest", "umairtest1"
  ]);

  const customersList = useMemo(() => {
    const raw = Array.from(
      new Set(
        orders
          .filter((o) => o && o.customer_name && !EXCLUDED_BRAND_NAMES.has(o.customer_name.toLowerCase().trim()))
          .map((o) => o.customer_name)
      )
    ).sort();
    return ["All", ...raw];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const validOrders = orders.filter((o) => o && o.order_id);
    return customer === "All" ? validOrders : validOrders.filter((o) => o.customer_name === customer);
  }, [customer, orders]);

  const countsByStage = useMemo(() => {
    const m = new Map<number, number>();
    for (const o of filteredOrders) {
      m.set(o.current_stage, (m.get(o.current_stage) ?? 0) + 1);
    }
    return m;
  }, [filteredOrders]);

  const unitsByStage = useMemo(() => {
    const m = new Map<number, number>();
    for (const o of filteredOrders) {
      m.set(o.current_stage, (m.get(o.current_stage) ?? 0) + (o.qty || 0));
    }
    return m;
  }, [filteredOrders]);

  const totalOrders = filteredOrders.length;
  const inProd = filteredOrders.filter((o) => o.status === "In Production").length;
  const shipped = filteredOrders.filter((o) => o.status === "Shipped").length;
  const onHold = filteredOrders.filter((o) => o.status === "On Hold").length;

  const totalVolume = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.qty || 0), 0);
  }, [filteredOrders]);

  // Chart Data Preparation for Flow Analytics
  const stageChartData = useMemo(() => {
    return STAGES.map((s) => {
      const activeBatches = countsByStage.get(s.id) || 0;
      const activeUnits = unitsByStage.get(s.id) || 0;
      return {
        stageId: s.id,
        shortCode: `S${s.id}`,
        name: s.name,
        batches: activeBatches,
        units: activeUnits,
      };
    });
  }, [countsByStage, unitsByStage]);

  const stageOrders = selectedStage
    ? filteredOrders.filter((o) => o && o.order_id && o.current_stage === selectedStage)
    : [];

  const stageMeta = selectedStage ? STAGES[selectedStage - 1] : null;

  // Stage advancement eligibility validation helper
  const checkAdvancement = (orderId: string, toStage: number, selectedStages?: number[], fromStage?: number) => {
    return checkStageAdvancement(toStage, orderId, {
      materials,
      cutting,
      sewing,
      wash,
      qc,
      cartons,
      outsourceRecords,
    }, selectedStages, fromStage);
  };

  const handleKanbanAdvance = (orderId: string, currentStage: number, selectedStages?: number[]) => {
    const nextStage = getNextSelectedStage(currentStage, selectedStages);
    if (nextStage === null) return;
    const check = checkAdvancement(orderId, nextStage, selectedStages, currentStage);
    if (!check.allowed) {
      setToast({
        message: `Advance Blocked: ${check.message}`,
        type: "info"
      });
      return;
    }
    advanceOrderStage(orderId, nextStage);
  };

  if (orders.length === 0 && isLoading) {
    return (
      <AppShell>
        <div className="relative min-h-[400px] flex flex-col justify-start">
          <LoadingOverlay 
            message="Synchronizing Production Flow…" 
            description="Connecting floor workstations, telemetry sensors, and active order batches."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        
        {/* Top Control Bar with Apple Segmented Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* View Mode Segmented Control */}
          <div className="inline-flex items-center p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md self-start">
            <button
              onClick={() => setViewMode("flow_map")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
                viewMode === "flow_map"
                  ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Gauge className="h-3.5 w-3.5 text-[#0071E3]" />
              <span>Production Pipeline Map</span>
            </button>
            
            <button
              onClick={() => setViewMode("analytics")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
                viewMode === "analytics"
                  ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-[#0071E3]" />
              <span>WIP Velocity Graph</span>
            </button>

            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-[#0071E3]" />
              <span>Kanban Line</span>
            </button>
          </div>

          {/* Account Brand Filter Rail */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 hidden md:inline">
              Account Filter:
            </span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08]">
              {customersList.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCustomer(c);
                    setSelectedStage(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-tight transition-all shrink-0 cursor-pointer ${
                    customer === c
                      ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "All" ? "All Accounts" : c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Apple-Grade Frosted Glass Metric Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Orders</span>
              <div className="h-8 w-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{totalOrders}</div>
            <div className="mt-2 text-[11px] text-muted-foreground font-medium">
              <span className="text-foreground font-semibold">{totalVolume.toLocaleString()}</span> total units in pipeline
            </div>
          </div>

          <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shop Floor WIP</span>
              <div className="h-8 w-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <Factory className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{inProd}</div>
            <div className="mt-2 text-[11px] text-muted-foreground font-medium">
              Active assembly batches on floor
            </div>
          </div>

          <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Dispatched</span>
              <div className="h-8 w-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{shipped}</div>
            <div className="mt-2 text-[11px] text-muted-foreground font-medium">
              Completed POD shipments
            </div>
          </div>

          <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Quality Holds</span>
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                onHold > 0 ? "bg-[#EF4444]/10 text-[#EF4444]" : "bg-black/[0.04] dark:bg-white/10 text-muted-foreground"
              }`}>
                <AlertOctagon className="h-4 w-4" />
              </div>
            </div>
            <div className={`mt-3 text-3xl font-bold tracking-tight ${onHold > 0 ? "text-[#EF4444]" : "text-foreground"}`}>
              {onHold}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground font-medium">
              {onHold > 0 ? (
                <span className="text-[#EF4444] font-semibold">Action required</span>
              ) : (
                "Zero blocking hold gates"
              )}
            </div>
          </div>
        </div>

        {/* VIEW MODE 1: PRODUCTION FLOW PIPELINE MAP (5 CONNECTED MANUFACTURING ZONES) */}
        {viewMode === "flow_map" && (
          <div className="space-y-4">
            
            {/* Header Description */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">Connected Manufacturing Process Architecture</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Click any stage node to inspect active work orders, specifications, and workstation metrics.</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="h-2 w-2 rounded-full bg-[#0071E3]" />
                <span>13 Sequential MES Conversion Gates</span>
              </div>
            </div>

            {/* 5 Connected Manufacturing Zones Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
              {PRODUCTION_ZONES.map((zone) => {
                const zoneStages = STAGES.filter((s) => zone.stageIds.includes(s.id));
                const zoneTotalWIP = zoneStages.reduce((acc, s) => acc + (countsByStage.get(s.id) || 0), 0);
                const zoneTotalUnits = zoneStages.reduce((acc, s) => acc + (unitsByStage.get(s.id) || 0), 0);

                return (
                  <div
                    key={zone.id}
                    className="glass-surface rounded-3xl p-4.5 border border-white/80 dark:border-white/[0.08] shadow-xs flex flex-col justify-between relative transition-all hover:border-[#0071E3]/30"
                  >
                    <div>
                      {/* Zone Header Badge */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-[#0071E3] tracking-wider block">
                            {zone.zoneNumber}
                          </span>
                          <h3 className="text-xs font-bold text-foreground tracking-tight leading-snug mt-0.5">
                            {zone.title}
                          </h3>
                        </div>
                        {zoneTotalWIP > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] text-[10px] font-mono font-bold shrink-0">
                            {zoneTotalWIP} WIP
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">—</span>
                        )}
                      </div>

                      {/* Stage Nodes Inside Zone */}
                      <div className="space-y-2.5">
                        {zoneStages.map((s) => {
                          const Icon = ICONS[s.icon as keyof typeof ICONS];
                          const count = countsByStage.get(s.id) || 0;
                          const units = unitsByStage.get(s.id) || 0;
                          const active = selectedStage === s.id;

                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelectedStage(active ? null : s.id)}
                              className={`w-full text-left rounded-2xl p-3 transition-all duration-150 flex items-center justify-between gap-2.5 border cursor-pointer ${
                                active
                                  ? "bg-[#0071E3] text-white shadow-md shadow-[#0071E3]/20 border-[#0071E3]"
                                  : "bg-white/80 dark:bg-[#151926]/80 border-black/[0.06] dark:border-white/[0.08] hover:border-[#0071E3]/40 hover:bg-white dark:hover:bg-[#1A2030]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                                  active ? "bg-white/20 text-white" : "bg-black/[0.04] dark:bg-white/10 text-muted-foreground"
                                }`}>
                                  {String(s.id).padStart(2, "0")}
                                </span>
                                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-muted-foreground"}`} />
                                <span className={`text-xs font-semibold truncate ${active ? "text-white" : "text-foreground"}`}>
                                  {s.name}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span className={`text-[10px] font-mono font-bold block ${
                                  active ? "text-white" : count > 0 ? "text-[#0071E3] dark:text-[#0A84FF]" : "text-muted-foreground"
                                }`}>
                                  {count > 0 ? `${count} Batch` : "—"}
                                </span>
                                {units > 0 && (
                                  <span className={`text-[9px] block ${active ? "text-white/80" : "text-muted-foreground"}`}>
                                    {units.toLocaleString()} pcs
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Integrated Zone Checkpoint Pill */}
                    <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground bg-black/[0.02] dark:bg-white/[0.03] px-2.5 py-1.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#0071E3] shrink-0" />
                        <span className="truncate text-foreground">{zone.checkpoint.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live WIP Velocity & Throughput Area Graph */}
            <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#0071E3]" /> Production Load Velocity &amp; WIP Distribution Curve
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Real-time piece volume across all 13 manufacturing stages.</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#0071E3]" />
                    <span className="text-foreground text-[11px]">Piece Volume (pcs)</span>
                  </div>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stageChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sapphireGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0071E3" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0071E3" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="shortCode" 
                      tick={{ fontSize: 10, fill: '#64748B' }} 
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#64748B' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white/95 dark:bg-[#121622]/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-black/[0.08] dark:border-white/[0.1] text-xs">
                              <div className="font-bold text-foreground">Stage {data.stageId}: {data.name}</div>
                              <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                                <div className="flex justify-between gap-4">
                                  <span>Active Units:</span>
                                  <strong className="text-[#0071E3]">{data.units.toLocaleString()} pcs</strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span>Batch Work Orders:</span>
                                  <strong className="text-foreground">{data.batches}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="units"
                      stroke="#0071E3"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#sapphireGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* VIEW MODE 2: WIP VELOCITY & THROUGHPUT AREA GRAPH */}
        {viewMode === "analytics" && (
          <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <h3 className="font-bold text-base text-foreground tracking-tight">Shop Floor WIP Distribution &amp; Load Velocity</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Real-time piece volume across all 13 industrial processing stages.</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-[#0071E3]" />
                  <span className="text-foreground">Piece Volume (pcs)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-slate-400 dark:bg-slate-600" />
                  <span className="text-muted-foreground">Active Batch Orders</span>
                </div>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stageChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sapphireGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0071E3" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0071E3" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="shortCode" 
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 dark:bg-[#121622]/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-black/[0.08] dark:border-white/[0.1] text-xs">
                            <div className="font-bold text-foreground">Stage {data.stageId}: {data.name}</div>
                            <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                              <div className="flex justify-between gap-4">
                                <span>Active Units:</span>
                                <strong className="text-[#0071E3]">{data.units.toLocaleString()} pcs</strong>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>Batch Work Orders:</span>
                                <strong className="text-foreground">{data.batches}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="units"
                    stroke="#0071E3"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#sapphireGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Peak Load Stage</span>
                <div className="text-sm font-bold text-foreground mt-0.5">Stage 07: Sewing Assembly</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Work In Progress</span>
                <div className="text-sm font-bold text-foreground mt-0.5">{totalVolume.toLocaleString()} Total Units</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Average Cycle Time</span>
                <div className="text-sm font-bold text-foreground mt-0.5">4.2 Days / PO</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">First Pass QC Yield</span>
                <div className="text-sm font-bold text-foreground mt-0.5">99.4% Pass Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE 3: KANBAN BOARD */}
        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { id: "phase1", title: "Sourcing & Materials", stages: [1, 2, 3] },
              { id: "phase2", title: "Planning & Cutting", stages: [4, 5, 6] },
              { id: "phase3", title: "Sewing & Finishing", stages: [7, 8, 9, 10] },
              { id: "phase4", title: "QC & Logistics", stages: [11, 12, 13] },
            ].map((phase) => {
              const phaseOrders = filteredOrders.filter((o) => phase.stages.includes(o.current_stage));
              return (
                <div key={phase.id} className="glass-surface rounded-3xl p-4 border border-white/80 dark:border-white/[0.08] shadow-xs flex flex-col">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                    <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">{phase.title}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 text-[10px] font-mono font-bold text-foreground">
                      {phaseOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                    {phaseOrders.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        No orders in this phase.
                      </div>
                    ) : (
                      phaseOrders.map((o) => {
                        const orderSelectedStages = (o as any).selected_stages as number[] | undefined;
                        const resolvedNextStage = getNextSelectedStage(o.current_stage, orderSelectedStages);
                        const isFinalStage = resolvedNextStage === null;
                        const nextStage = resolvedNextStage ?? o.current_stage;
                        const hasHold = isOrderOnHold(o.order_id);
                        const check = !isFinalStage ? checkAdvancement(o.order_id, nextStage, orderSelectedStages, o.current_stage) : { allowed: false };

                        return (
                          <div
                            key={o.order_id}
                            className="bg-white/90 dark:bg-[#151926]/90 rounded-2xl p-3.5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all space-y-2.5"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <Link
                                  to="/orders/$orderId"
                                  params={{ orderId: o.order_id }}
                                  className="text-xs font-bold text-[#0071E3] hover:underline flex items-center gap-1"
                                >
                                  {o.order_id} <ArrowUpRight className="h-3 w-3" />
                                </Link>
                                <span className="text-[11px] font-medium text-muted-foreground block">{o.customer_name}</span>
                              </div>
                              {hasHold && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Hold
                                </span>
                              )}
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                              <span>Stage {o.current_stage}: {getStageFriendlyName(o.current_stage)}</span>
                              <span className="font-bold text-foreground">{o.qty.toLocaleString()} pcs</span>
                            </div>

                            {!isFinalStage ? (
                              <button
                                onClick={() => handleKanbanAdvance(o.order_id, o.current_stage, orderSelectedStages)}
                                disabled={!check.allowed}
                                className={`w-full h-8 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                  check.allowed
                                    ? "bg-[#0071E3] text-white hover:bg-[#0071E3]/90 shadow-xs"
                                    : "bg-black/[0.04] dark:bg-white/10 text-muted-foreground/60 cursor-not-allowed"
                                }`}
                              >
                                {!check.allowed && <Lock className="h-3 w-3" />}
                                Advance Stage &rarr;
                              </button>
                            ) : (
                              <div className="w-full h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-foreground text-xs font-semibold flex items-center justify-center gap-1">
                                <Check className="h-3.5 w-3.5 text-[#0071E3]" /> Completed
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SELECTED STAGE INSPECTION DRAWER / MODAL PANEL */}
        {selectedStage && stageMeta && (
          <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-lg animate-apple-fade-in space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#0071E3] uppercase tracking-wider block">
                  Interactive Node Inspector
                </span>
                <h3 className="text-base font-bold text-foreground tracking-tight mt-0.5">
                  Stage {stageMeta.id}: {stageMeta.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {[12, 13].includes(stageMeta.id) && ["admin", "production", "qc"].includes(user?.role || "") && (
                  <Link
                    to="/dispatch"
                    className="inline-flex items-center gap-1 text-xs text-[#0071E3] font-semibold hover:underline mr-2"
                  >
                    Open Dispatch Module <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
                <button
                  onClick={() => setSelectedStage(null)}
                  className="h-8 w-8 rounded-full bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.08] flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Stage Specifications Grid */}
            <div className="grid md:grid-cols-3 gap-4 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Input Spec</div>
                <div className="text-xs font-semibold text-foreground">{stageMeta.input}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Output Manifest</div>
                <div className="text-xs font-semibold text-foreground">{stageMeta.output}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Equipment Node</div>
                <div className="text-xs font-semibold text-foreground">{"equipment" in stageMeta ? stageMeta.equipment : "Automated Shop Floor Machine"}</div>
              </div>
            </div>

            {/* Live Active Orders at this Stage */}
            {stageOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground bg-black/[0.01] dark:bg-white/[0.02] rounded-2xl border border-dashed border-black/[0.06] dark:border-white/[0.08]">
                No active order batches currently processing at Stage {stageMeta.id}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.04] text-muted-foreground uppercase font-bold text-[10px] border-b border-black/[0.06] dark:border-white/[0.08]">
                    <tr>
                      <th className="py-3 px-4 text-left">Order ID</th>
                      <th className="py-3 px-4 text-left">Brand Account</th>
                      <th className="py-3 px-4 text-left">PO Reference</th>
                      <th className="py-3 px-4 text-left">Quantity</th>
                      <th className="py-3 px-4 text-left">Floor Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                    {stageOrders.map((o) => {
                      const orderId = o?.order_id || "";
                      const customerName = o?.customer_name || "Customer";
                      const poNumber = o?.PO_number || "N/A";
                      const qty = o?.qty ?? 0;
                      const status = o?.status || "In Production";

                      return (
                        <tr key={orderId || Math.random().toString()} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#0071E3]">
                            <Link to="/orders/$orderId" params={{ orderId }} className="hover:underline">
                              {orderId}
                            </Link>
                            {orderId && isOrderOnHold(orderId) && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">On Hold</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground">{customerName}</td>
                          <td className="py-3 px-4 font-medium text-muted-foreground">{poNumber}</td>
                          <td className="py-3 px-4 font-bold text-foreground">{qty.toLocaleString()} pcs</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0071E3]/10 text-[#0071E3]">
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Minimalist 3-Step Manufacturing Overview */}
        <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs">
          <div className="pb-4 mb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Industrial CMT Lifecycle Overview
            </h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#151926]/60 border border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-7 w-7 rounded-xl bg-[#0071E3]/10 text-[#0071E3] font-bold text-xs flex items-center justify-center">1</div>
                <h4 className="text-xs font-bold text-foreground">Material Intake &amp; Shade QC</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Brand fabrics, hardware, and trims are verified against BOM specifications, shade lots, and cut readiness.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#151926]/60 border border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-7 w-7 rounded-xl bg-[#0071E3]/10 text-[#0071E3] font-bold text-xs flex items-center justify-center">2</div>
                <h4 className="text-xs font-bold text-foreground">Transformation &amp; Sewing Lines</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Precision CNC laser spreading, modular line sewing, and sustainable ozone wash finishing.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#151926]/60 border border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-7 w-7 rounded-xl bg-[#0071E3]/10 text-[#0071E3] font-bold text-xs flex items-center justify-center">3</div>
                <h4 className="text-xs font-bold text-foreground">Quality Inspection &amp; Freight</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Comprehensive AQL 2.5 quality audits, carton packing, and global freight dispatch with live tracking.
              </p>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
