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
  Compass,
  Warehouse,
  ShieldQuestion,
  ShieldAlert,
} from "lucide-react";
import { AppShell, SectionCard } from "../components/AppShell";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { STAGES } from "../lib/mockData";
import { useAppData, checkStageAdvancement } from "../hooks/useAppData";
import { getNextSelectedStage } from "../lib/utils";
import { getStageFriendlyName } from "../lib/outsourcing-constants";
import { getServiceScopeChips } from "../lib/service-scope-constants";
import { useAuth } from "../hooks/useAuth";

const QC_CHECKPOINTS = [
  { after_stage: 3, name: "Material Check" },
  { after_stage: 5, name: "First Cut Approval" },
  { after_stage: 7, name: "Inline Sewing QC" },
  { after_stage: 10, name: "Wash/Finish Approval" },
  { after_stage: 12, name: "Final AQL / Packing Audit" },
] as const;

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Production Flow · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Live 13-stage garment production pipeline for Forge & Fabric Industries, Inc. — cut, make, trim conversion tracker." },
      { property: "og:title", content: "Production Flow · Forge & Fabric Industries, Inc." },
      { property: "og:description", content: "Live 13-stage garment production pipeline for Forge & Fabric Industries, Inc.." },
    ],
  }),
  component: Page,
});

const ICONS = {
  ClipboardList, PackageOpen, SearchCheck, ClipboardCheck, Scissors,
  Boxes, Cog, ShieldCheck, Droplets, Sparkles, BadgeCheck, Tag, Truck,
} as const;

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
    outsourceRecords
  } = useAppData();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<string>("All");
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"pipeline" | "kanban">(
    user?.dashboard_view === "kanban" ? "kanban" : "pipeline"
  );

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

  const customersList = useMemo(
    () => {
      const raw = Array.from(
        new Set(
          orders
            .filter((o) => o && o.customer_name && !EXCLUDED_BRAND_NAMES.has(o.customer_name.toLowerCase().trim()))
            .map((o) => o.customer_name)
        )
      ).sort();
      return ["All", ...raw];
    },
    [orders]
  );

  const filteredOrders = useMemo(
    () => {
      const validOrders = orders.filter((o) => o && o.order_id);
      return customer === "All" ? validOrders : validOrders.filter((o) => o.customer_name === customer);
    },
    [customer, orders]
  );

  const countsByStage = useMemo(() => {
    const m = new Map<number, number>();
    for (const o of filteredOrders) {
      m.set(o.current_stage, (m.get(o.current_stage) ?? 0) + 1);
    }
    return m;
  }, [filteredOrders]);

  const totalOrders = filteredOrders.length;
  const inProd = filteredOrders.filter((o) => o.status === "In Production").length;
  const shipped = filteredOrders.filter((o) => o.status === "Shipped").length;
  const onHold = filteredOrders.filter((o) => o.status === "On Hold").length;

  const stageOrders = selectedStage
    ? filteredOrders.filter((o) => o && o.order_id && o.current_stage === selectedStage)
    : [];

  const stageMeta = selectedStage ? STAGES[selectedStage - 1] : null;

  // Compute total volume in pipeline
  const totalVolume = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + o.qty, 0);
  }, [filteredOrders]);

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

  // Loading state
  if (orders.length === 0 && isLoading) {
    return (
      <AppShell>
        <div className="relative min-h-[400px] flex flex-col justify-start">
          <LoadingOverlay 
            message="Loading Production Flow…" 
            description="Synchronizing live stages, material intake logs, and workshop metrics."
          />
        </div>
      </AppShell>
    );
  }

  // Grouped phases for Kanban
  const KANBAN_PHASES = [
    {
      id: "phase1",
      title: "Sourcing & Materials",
      stages: [1, 2, 3],
      description: "Intake, Receiving & Inspection"
    },
    {
      id: "phase2",
      title: "Planning & Cutting",
      stages: [4, 5, 6],
      description: "Pre-Prod, Cutting & Bundling"
    },
    {
      id: "phase3",
      title: "Sewing & Finishing",
      stages: [7, 8, 9, 10],
      description: "Line Assembly, QC & Ozone Wash"
    },
    {
      id: "phase4",
      title: "QC & Logistics",
      stages: [11, 12, 13],
      description: "Final Audit, Packaging & Dispatch"
    }
  ];

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Top Control Bar with Apple Segmented Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* View Mode Segmented Control */}
          <div className="inline-flex items-center p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md self-start">
            <button
              onClick={() => setViewMode("pipeline")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 ${
                viewMode === "pipeline"
                  ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Gauge className="h-3.5 w-3.5" />
              <span>Flow Timeline</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-[#1E2433] text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Kanban Board</span>
            </button>
          </div>

          {/* Account Brand Filter Rail */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 hidden md:inline">
              Brand:
            </span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08]">
              {customersList.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCustomer(c);
                    setSelectedStage(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-tight transition-all shrink-0 ${
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

        {/* 4 Apple-grade Frosted Glass KPI Widgets */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Orders</span>
              <div className="h-8 w-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{totalOrders}</div>
            <div className="mt-2 text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{totalVolume.toLocaleString()}</span> units in pipeline
            </div>
          </div>

          <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active WIP</span>
              <div className="h-8 w-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <Factory className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{inProd}</div>
            <div className="mt-2 text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Lines operating normally
            </div>
          </div>

          <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Dispatched</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{shipped}</div>
            <div className="mt-2 text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Registered POD shipments
            </div>
          </div>

          <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">On Hold</span>
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
                <span className="text-[#EF4444] font-semibold">Immediate attention required</span>
              ) : (
                "Zero blocking holds"
              )}
            </div>
          </div>
        </div>

        {/* View Content: Pipeline or Kanban */}
        {viewMode === "pipeline" ? (
          /* 13-Stage Pipeline Frosted Panel */
          <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between pb-5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <h3 className="font-bold text-sm text-foreground tracking-tight">13-Stage Production Pipeline</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select any stage node to inspect active floor batches.</p>
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground bg-black/[0.03] dark:bg-white/[0.06] px-3 py-1 rounded-full border border-black/[0.05] dark:border-white/10 hidden sm:block">
                Interactive Conversion Map
              </div>
            </div>
            
            <div className="pt-6 overflow-x-auto pb-3">
              <div className="min-w-[1280px] px-2">
                <div className="grid grid-cols-13 gap-2.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
                  {STAGES.map((s) => {
                    const Icon = ICONS[s.icon as keyof typeof ICONS];
                    const count = countsByStage.get(s.id) ?? 0;
                    const active = selectedStage === s.id;
                    const hasActiveOrders = count > 0;
                    
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStage(s.id)}
                        className={`group text-left rounded-2xl p-3 transition-all duration-200 flex flex-col justify-between h-38 cursor-pointer select-none ${
                          active
                            ? "bg-[#0071E3] text-white shadow-md shadow-[#0071E3]/25 border border-[#0071E3]"
                            : "bg-white/70 dark:bg-[#151926]/70 border border-black/[0.06] dark:border-white/[0.08] hover:border-[#0071E3]/40 hover:bg-white dark:hover:bg-[#1A2030]"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`h-6 w-6 rounded-lg grid place-items-center text-[11px] font-bold ${
                            active ? "bg-white/20 text-white" : "bg-black/[0.04] dark:bg-white/10 text-foreground"
                          }`}>
                            {s.id}
                          </div>
                          {hasActiveOrders ? (
                            <span className="relative flex h-2 w-2">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                active ? "bg-white" : "bg-emerald-500"
                              }`} />
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                active ? "bg-white" : "bg-emerald-500"
                              }`} />
                            </span>
                          ) : (
                            <Icon className={`h-4 w-4 ${active ? "text-white/80" : "text-muted-foreground group-hover:text-foreground"}`} />
                          )}
                        </div>
                        
                        <div className="my-auto py-1">
                          <div className={`text-xs font-semibold leading-tight line-clamp-2 ${active ? "text-white" : "text-foreground"}`}>
                            {s.name}
                          </div>
                        </div>

                        <div className={`pt-2 border-t flex items-center justify-between w-full text-[10px] ${
                          active ? "border-white/20 text-white/80" : "border-black/[0.05] dark:border-white/[0.08] text-muted-foreground"
                        }`}>
                          <span className="font-medium">Active</span>
                          <span className={`font-bold ${active ? "text-white" : hasActiveOrders ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                            {count}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Clean QC Checkpoint Nodes Row */}
                <div className="mt-5 grid" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
                  {STAGES.map((s) => {
                    const cp = QC_CHECKPOINTS.find((c) => c.after_stage === s.id);
                    return (
                      <div key={s.id} className="flex flex-col items-center">
                        {cp ? (
                          <div className="flex flex-col items-center w-full px-1">
                            <div className="h-3 w-px bg-black/[0.1] dark:bg-white/[0.15]" />
                            <div className="mt-1 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-xl px-2 py-1 flex items-center gap-1 justify-center w-full shadow-2xs">
                              <ShieldCheck className="h-3 w-3 text-[#0071E3] shrink-0" />
                              <span className="text-[10px] font-semibold text-foreground truncate">{cp.name}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-4" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Kanban Board View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {KANBAN_PHASES.map((phase) => {
              const phaseOrders = filteredOrders.filter((o) => phase.stages.includes(o.current_stage));
              
              return (
                <div key={phase.id} className="flex flex-col gap-3">
                  <div className="glass-surface rounded-2xl p-4 border border-white/80 dark:border-white/[0.08] shadow-xs flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{phase.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{phase.description}</p>
                    </div>
                    <span className="h-6 min-w-6 px-2 rounded-full bg-[#0071E3]/10 text-[#0071E3] text-xs font-bold grid place-items-center">
                      {phaseOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3 min-h-[420px]">
                    {phaseOrders.length === 0 ? (
                      <div className="text-center py-12 text-xs text-muted-foreground card-opaque rounded-2xl border border-dashed border-border/80 p-6">
                        <Compass className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
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

                        const stageOutsourceRecords = outsourceRecords.filter(
                          (r) => r.order_id === o.order_id && r.stage_number === o.current_stage
                        );
                        const activeOutsourceRecord = stageOutsourceRecords.length > 0
                          ? [...stageOutsourceRecords].sort((a, b) => b.dispatched_at.localeCompare(a.dispatched_at))[0]
                          : null;
                        const isReturned = activeOutsourceRecord && (activeOutsourceRecord.vendor_status === "Returned_Partial" || activeOutsourceRecord.vendor_status === "Returned_Complete");
                        const outsourceQcPending = !!activeOutsourceRecord && isReturned && activeOutsourceRecord.return_qc_status !== "Passed" && activeOutsourceRecord.return_qc_status !== "Partial_Pass";

                        const pipelineStages = orderSelectedStages && orderSelectedStages.length > 0 ? orderSelectedStages : Array.from({ length: 13 }, (_, i) => i + 1);
                        const posInPipeline = pipelineStages.indexOf(o.current_stage);
                        const progressPct = posInPipeline >= 0 ? Math.round(((posInPipeline + 1) / pipelineStages.length) * 100) : 0;
                        const serviceChips = getServiceScopeChips(orderSelectedStages);

                        return (
                          <div
                            key={o.order_id}
                            className="card-opaque rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col gap-3 group border border-border/80"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <Link
                                  to="/orders/$orderId"
                                  params={{ orderId: o.order_id }}
                                  className="text-xs font-bold text-foreground hover:text-[#0071E3] flex items-center gap-1"
                                >
                                  {o.order_id} <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#0071E3]" />
                                </Link>
                                <span className="text-[11px] font-medium text-muted-foreground block mt-0.5">{o.customer_name}</span>
                              </div>
                              {hasHold && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20">
                                  Hold
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {serviceChips.map((chip) => (
                                <span key={chip} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground">
                                  {chip}
                                </span>
                              ))}
                            </div>

                            <div className="space-y-1">
                              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Current Node</div>
                              <div className="text-xs font-semibold text-foreground">
                                Stage {o.current_stage}: {getStageFriendlyName(o.current_stage)}
                              </div>
                            </div>

                            {activeOutsourceRecord ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[10px] font-semibold border border-amber-500/20 w-fit">
                                <Truck className="h-3 w-3" /> Outsourced &rarr; {activeOutsourceRecord.vendor_name}
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-500/20 w-fit">
                                <Warehouse className="h-3 w-3" /> In-House
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                                <span>PO: {o.PO_number}</span>
                                <span className="font-semibold text-foreground">{o.qty.toLocaleString()} pcs</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#0071E3] transition-all rounded-full"
                                  style={{ width: `${Math.min(100, progressPct)}%` }}
                                />
                              </div>
                            </div>

                            {!isFinalStage ? (
                              <button
                                onClick={() => handleKanbanAdvance(o.order_id, o.current_stage, orderSelectedStages)}
                                disabled={!check.allowed}
                                className={`w-full h-8.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  check.allowed
                                    ? "bg-[#0071E3] text-white hover:bg-[#0071E3]/90 shadow-xs"
                                    : "bg-muted text-muted-foreground/60 cursor-not-allowed"
                                }`}
                              >
                                {!check.allowed && <Lock className="h-3.5 w-3.5" />}
                                Advance Stage &rarr;
                              </button>
                            ) : (
                              <div className="w-full h-8.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1 border border-emerald-500/20">
                                <BadgeCheck className="h-4 w-4" /> Completed
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

        {/* Selected Stage Detail Panel (Pipeline View) */}
        {viewMode === "pipeline" && selectedStage && stageMeta && (
          <div className="animate-apple-fade-in">
            <SectionCard
              title={`Stage ${stageMeta.id} Details · ${stageMeta.name}`}
              action={
                <div className="flex items-center gap-2">
                  {[12, 13].includes(stageMeta.id) && ["admin", "production", "qc"].includes(user?.role || "") && (
                    <Link
                      to="/dispatch"
                      className="inline-flex items-center gap-1 text-xs text-[#0071E3] font-semibold hover:underline"
                    >
                      Open Dispatch <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  <button
                    onClick={() => setSelectedStage(null)}
                    className="h-7 w-7 rounded-full bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.08] flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              }
            >
              <div className="grid md:grid-cols-3 gap-4 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] mb-5">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Input Spec</div>
                  <div className="text-xs font-medium text-foreground">{stageMeta.input}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Output Manifest</div>
                  <div className="text-xs font-medium text-foreground">{stageMeta.output}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Equipment Node</div>
                  <div className="text-xs font-medium text-foreground">{"equipment" in stageMeta ? stageMeta.equipment : "Manual Assembly Unit"}</div>
                </div>
              </div>

              {stageOrders.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/80">
                  No active batches processing at Stage {stageMeta.id}.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground uppercase font-bold text-[10px] border-b border-border">
                      <tr>
                        <th className="py-3 px-4 text-left">Order ID</th>
                        <th className="py-3 px-4 text-left">Brand</th>
                        <th className="py-3 px-4 text-left">PO Reference</th>
                        <th className="py-3 px-4 text-left">Quantity</th>
                        <th className="py-3 px-4 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {stageOrders.map((o) => {
                        const orderId = o?.order_id || "";
                        const customerName = o?.customer_name || "Customer";
                        const poNumber = o?.PO_number || "N/A";
                        const qty = o?.qty ?? 0;
                        const status = o?.status || "Open";
                        return (
                          <tr key={orderId || Math.random().toString()} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-semibold text-[#0071E3]">
                              <Link to="/orders/$orderId" params={{ orderId }} className="hover:underline">
                                {orderId}
                              </Link>
                              {orderId && isOrderOnHold(orderId) && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EF4444]/10 text-[#EF4444]">On Hold</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-medium text-foreground">{customerName}</td>
                            <td className="py-3 px-4 font-mono text-muted-foreground">{poNumber}</td>
                            <td className="py-3 px-4 font-semibold text-foreground">{qty.toLocaleString()} pcs</td>
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
            </SectionCard>
          </div>
        )}

        {/* Minimalist 3-Step Manufacturing Overview */}
        <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs">
          <div className="pb-4 mb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Conversion Lifecycle Overview
            </h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#151926]/60 border border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-7 w-7 rounded-xl bg-[#0071E3]/10 text-[#0071E3] font-bold text-xs flex items-center justify-center">1</div>
                <h4 className="text-xs font-bold text-foreground">Material Ingestion</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Brand-supplied fabrics, trims, and accessories are logged, shade-matched, and cleared for cutting.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#151926]/60 border border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-7 w-7 rounded-xl bg-[#0071E3]/10 text-[#0071E3] font-bold text-xs flex items-center justify-center">2</div>
                <h4 className="text-xs font-bold text-foreground">Transformation &amp; Sewing</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Precision CNC laser spreading, modular line sewing, and sustainable ozone wash finishing.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#151926]/60 border border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-7 w-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">3</div>
                <h4 className="text-xs font-bold text-foreground">Quality &amp; Dispatch</h4>
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
