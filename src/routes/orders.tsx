import { createFileRoute, useNavigate, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { AppShell, KpiTile, SectionCard, StatusBadge } from "../components/AppShell";
import { ORDER_TREND, type Order } from "../lib/mockData";
import { useAppData } from "../hooks/useAppData";
import { useAuth } from "../hooks/useAuth";
import { usePermission } from "../hooks/usePermission";
import { useSubmissions } from "../hooks/merchandiser/useSubmissions";
import { formatSizeBreakdown } from "../lib/utils";
import { 
  Plus, 
  X, 
  Pencil, 
  Info, 
  Clock, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Scissors,
  Sparkles,
  ShieldCheck,
  Calendar,
  Building2,
  Globe,
  ArrowUpRight,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb
} from "lucide-react";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Order Dashboard · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Track open, in-production, on-hold and shipped orders across the Forge & Fabric Industries, Inc. factory." },
    ],
  }),
  component: OrdersRouteComponent,
});

function OrdersRouteComponent() {
  const matches = useMatches();
  const isChildRoute = matches.some((m) => m.routeId === "/orders/$orderId");

  if (isChildRoute) {
    return <Outlet />;
  }

  return <Page />;
}

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    orders, 
    addOrder, 
    updateOrder, 
    deleteOrder, 
    deleteCustomerCascade, 
    isOrderOnHold, 
    customers, 
    addCustomer, 
    sizeRatios,
    addSizeRatio,
    globalSearchQuery, 
    setGlobalSearchQuery,
    isLoading: isDataLoading
  } = useAppData();

  const [status, setStatus] = useState<string>("All");

  // Add Order Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newPO, setNewPO] = useState("");
  const [newTechPack, setNewTechPack] = useState("");
  const [newSizes, setNewSizes] = useState("");
  const [customNewSizeRatio, setCustomNewSizeRatio] = useState("");
  const [newQty, setNewQty] = useState(1000);
  const [newStartingStage, setNewStartingStage] = useState<number>(1);
  const [addFormError, setAddFormError] = useState("");

  // Edit Order State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editCustomer, setEditCustomer] = useState("");
  const [editPO, setEditPO] = useState("");
  const [editTechPack, setEditTechPack] = useState("");
  const [editSizes, setEditSizes] = useState("");
  const [customEditSizeRatio, setCustomEditSizeRatio] = useState("");
  const [editQty, setEditQty] = useState(1000);
  const [editStatus, setEditStatus] = useState<Order["status"]>("Open");
  const [editFormError, setEditFormError] = useState("");

  // Role Guarding: redirect unauthenticated users to /login and production role users to /materials
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    } else if (user.role === "production") {
      navigate({ to: "/materials" });
    }
  }, [user, navigate]);

  const { submissions: allSubmissions, isLoading: isSubmissionsLoading } = useSubmissions();

  // Submissions under review belonging to the logged in customer (or all for Admin/Merchandiser)
  const customerSubmissions = useMemo(() => {
    if (user?.role === "customer") {
      const custName = user?.customer_name?.toLowerCase()?.trim() || "";
      const custEmail = user?.email?.toLowerCase()?.trim() || "";
      const custComp = (user as any)?.company_name?.toLowerCase()?.trim() || "";
      return allSubmissions.filter((sub) => {
        const matchComp = (custName && (sub.company_name?.toLowerCase()?.includes(custName) || sub.brand_name?.toLowerCase()?.includes(custName))) ||
          (custComp && (sub.company_name?.toLowerCase()?.includes(custComp) || sub.brand_name?.toLowerCase()?.includes(custComp)));
        const matchMail = custEmail && sub.contact_email?.toLowerCase() === custEmail;
        return matchComp || matchMail;
      });
    }
    // Admin & Merchandiser see all incoming intake submissions
    return allSubmissions;
  }, [user, allSubmissions]);

  // Rejected applications never became an order, and approved/converted
  // ones already show up as a real order in the "Active Production Orders"
  // table below (via the combinedOrders/customerSubmissions merge further
  // down) — neither belongs in the "Active Intake" list too, or the
  // customer sees the same order twice.
  const activeCustomerSubmissions = useMemo(
    () => customerSubmissions.filter((sub) => {
      const sLow = (sub.status || "").toLowerCase();
      return sLow !== "rejected" && sLow !== "approved" && sLow !== "converted"
        && sLow !== "pending_customer_review" && sLow !== "customer_rejected";
    }),
    [customerSubmissions]
  );

  // Internal Order Intake submissions awaiting this customer's own
  // approval — shown in their own distinct "Awaiting Your Approval"
  // section so they're never confused with the customer's own
  // self-submitted, merchandiser-pending applications above.
  const awaitingCustomerApproval = useMemo(
    () => customerSubmissions.filter((sub) => (sub.status || "").toLowerCase() === "pending_customer_review"),
    [customerSubmissions]
  );

  // Cap the intake tile grid so it can't render unbounded — show 4 by
  // default (2 rows at md:grid-cols-2), with a "Show all" toggle for the rest.
  const [showAllIntakeApplications, setShowAllIntakeApplications] = useState(false);
  const INTAKE_TILE_LIMIT = 4;
  const visibleIntakeApplications = showAllIntakeApplications
    ? activeCustomerSubmissions
    : activeCustomerSubmissions.slice(0, INTAKE_TILE_LIMIT);

  const filtered = useMemo(() => {
    const qLow = globalSearchQuery?.toLowerCase()?.trim() || "";
    const isCustomerRole = user?.role === "customer";

    // Dynamic Backend Integration: Combine standard orders with live customer intake submissions
    const combinedOrders: Order[] = [...orders];

    if (customerSubmissions.length > 0) {
      customerSubmissions.forEach((sub) => {
        // A rejected application never became a real order — it must not
        // show up in Active Production Orders at all, not even as "On Hold".
        if ((sub.status || "").toLowerCase() === "rejected") return;
        const refCode = sub.apply_reference_code || `APP-${sub.id.substring(0, 6)}`;
        if (!combinedOrders.some(o => o.order_id === refCode || o.PO_number === refCode)) {
          const blocks = Array.isArray(sub.style_blocks) ? sub.style_blocks : [];
          const sAny = sub as any;
          let computedQty = Number(sAny.estimated_quantity) || 0;
          let breakdownList: string[] = [];

          if (sAny.size_breakdown && typeof sAny.size_breakdown === 'object') {
            const entries = Object.entries(sAny.size_breakdown).filter(([_, q]) => Number(q) > 0);
            if (entries.length > 0) {
              breakdownList = entries.map(([s, q]) => `${s}:${q}`);
              if (computedQty === 0) {
                computedQty = entries.reduce((acc, [_, q]) => acc + Number(q), 0);
              }
            }
          }

          if (blocks.length > 0) {
            let blockUnits = 0;
            blocks.forEach((b: any) => {
              let u = Number(b.total_units) || 0;
              // size_matrix is the real, live field name written by the
              // intake wizard (StyleBlockEditor/ConversionModal both read
              // it); size_quantities was never actually populated by any
              // submission path and left this sum at 0 for every style
              // block that had real per-size counts.
              const sizeSource = (b.size_matrix && typeof b.size_matrix === 'object')
                ? b.size_matrix
                : (b.size_quantities && typeof b.size_quantities === 'object' ? b.size_quantities : null);
              if (sizeSource) {
                const entries = Object.entries(sizeSource).filter(([_, q]) => Number(q) > 0);
                if (entries.length > 0) {
                  breakdownList.push(...entries.map(([s, q]) => `${s}:${q}`));
                  u = entries.reduce((acc, [_, q]) => acc + Number(q), 0);
                }
              }
              blockUnits += u;
            });
            if (blockUnits > 0) computedQty = blockUnits;
          }

          // No hardcoded quantity guess — 0 means the intake genuinely never
          // captured a real quantity for this submission (older submissions
          // lost this to a since-fixed backend bug); the table shows "—"
          // rather than a fabricated number that looks like real data.
          if (computedQty === 0) {
            computedQty = Number(sAny.total_units) || 0;
          }

          const mainBlock = blocks[0] || {};
          const isSample = sub.submission_type === 'sample_request' || sAny.order_type === 'sample_request' || sub.product_type?.toLowerCase().includes('sample');
          const styleName = isSample
            ? (sAny.client_reference_sku || sub.product_type || "Sample Development")
            : (mainBlock.style_name || sub.product_type || "Not Specified");

          const sizeSummary = breakdownList.length > 0
            ? breakdownList.join(" ")
            : (mainBlock.size_template || (mainBlock.size_columns ? mainBlock.size_columns.join("-") : "Not Specified"));

          // Map status accurately
          let displayStatus: Order["status"] = "Open";
          let stageNum = 1;
          const sLow = (sub.status || "").toLowerCase();
          if (sLow === "approved" || sLow === "converted") {
            displayStatus = "In Production";
            stageNum = isSample ? 4 : 3;
          } else if (sLow === "in_development" || sLow === "in_production" || sLow === "in_sampling") {
            displayStatus = "In Production";
            stageNum = 4;
          } else if (sLow === "shipped" || sLow === "received") {
            displayStatus = "Shipped";
            stageNum = 13;
          } else if (sLow === "rejected" || sLow === "needs_info") {
            displayStatus = "On Hold";
            stageNum = 1;
          } else {
            displayStatus = "Open";
            stageNum = 1;
          }

          combinedOrders.unshift({
            order_id: refCode,
            customer_name: sub.company_name || sub.brand_name || user?.customer_name || "Brand Partner",
            PO_number: sub.existing_order_reference || refCode,
            style_no: styleName,
            tech_pack_ref: sAny.tech_pack_filename || (sAny.tech_pack_url ? sAny.tech_pack_url : "Not Uploaded"),
            size_breakdown: sizeSummary,
            status: displayStatus,
            created_date: sub.submitted_at ? sub.submitted_at.substring(0, 10) : (sub.created_at ? sub.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10)),
            current_stage: stageNum,
            qty: computedQty,
            notes: sub.client_notes || (isSample ? "Sample Request Intake" : "Submitted via Intake Portal"),
          });
        }
      });
    }

    return combinedOrders.filter((o) => {
      // Customer can only see orders belonging to their company/account
      if (isCustomerRole) {
        const custName = user?.customer_name?.toLowerCase() || "";
        const custComp = (user as any)?.company_name?.toLowerCase() || "";
        const oCust = o.customer_name?.toLowerCase() || "";
        const customerMatch =
          (custName && oCust.includes(custName)) ||
          (custComp && oCust.includes(custComp)) ||
          (user?.id && o.customer_id === user.id) ||
          (user?.email && customerSubmissions.some(cs => cs.contact_email?.toLowerCase() === user.email.toLowerCase()));
        if (!customerMatch) return false;
      }
      const matchQ = qLow === "" ||
        o.order_id?.toLowerCase()?.includes(qLow) ||
        o.customer_name?.toLowerCase()?.includes(qLow) ||
        o.PO_number?.toLowerCase()?.includes(qLow) ||
        o.tech_pack_ref?.toLowerCase()?.includes(qLow) ||
        o.size_breakdown?.toLowerCase()?.includes(qLow) ||
        o.status?.toLowerCase()?.includes(qLow);
      const matchS = status === "All" || o.status === status;
      return matchQ && matchS;
    });
  }, [globalSearchQuery, status, orders, user, customerSubmissions]);

  const { open, inProd, onHold, shipped, overallProgress, donutData } = useMemo(() => {
    let open = 0, inProd = 0, onHold = 0, shipped = 0, totalStages = 0;
    for (let i = 0; i < filtered.length; i++) {
      const s = filtered[i].status;
      if (s === "Open") open++;
      else if (s === "In Production") inProd++;
      else if (s === "On Hold") onHold++;
      else if (s === "Shipped") shipped++;
      totalStages += filtered[i].current_stage || 0;
    }
    const overallProgress = filtered.length > 0 ? Math.round((totalStages / (filtered.length * 13)) * 100) : 0;
    const donutData = [
      { name: "Complete", value: overallProgress },
      { name: "Remaining", value: 100 - overallProgress },
    ];
    return { open, inProd, onHold, shipped, overallProgress, donutData };
  }, [filtered]);

  // Dynamic 14-Day Order Trend calculation based on actual scoped database orders
  const orderTrendData = useMemo(() => {
    const days: { day: string; fullDate: string; orders: number; completed: number }[] = [];
    const today = new Date();
    
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days.push({ day: dayLabel, fullDate: isoDate, orders: 0, completed: 0 });
    }

    filtered.forEach((o) => {
      const createdIso = o.created_date ? o.created_date.slice(0, 10) : "";
      const targetDay = days.find((d) => d.fullDate === createdIso);
      if (targetDay) {
        targetDay.orders += 1;
        if (o.status === "Shipped" || o.current_stage >= 13) {
          targetDay.completed += 1;
        }
      } else {
        // Fallback for orders created on dates within the window or earlier
        const bucketIndex = Math.min(13, Math.max(0, Math.floor((o.current_stage / 13) * 13)));
        days[bucketIndex].orders += 1;
        if (o.status === "Shipped" || o.current_stage >= 13) {
          days[bucketIndex].completed += 1;
        }
      }
    });

    return days;
  }, [filtered]);

  // Pending / Under review submissions count for customer
  const pendingCustomerSubmissions = useMemo(() => {
    return customerSubmissions.filter(s => s.status !== "converted" && s.status !== "rejected");
  }, [customerSubmissions]);

  const canEdit = usePermission("orders", "update");

  // Sync states when Add Modal opens
  useEffect(() => {
    if (showAddModal) {
      if (user?.role === "customer") {
        if (!newCustomer) setNewCustomer(user.customer_name || "");
      } else {
        // Merchandiser / Admin adding order for another customer — no auto fill of self
        if (!newCustomer && customers.length > 0) {
          setNewCustomer(customers[0].name);
        }
      }
      // Clean inputs for PO and Tech pack — merchandiser enters real customer details
      setNewPO("");
      setNewTechPack("");
    }
  }, [showAddModal, user, customers]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError("");
    const selectedCust = newCustomer || (customers.length > 0 ? customers[0].name : "");
    if (!selectedCust) {
      setAddFormError("Please select a customer / brand.");
      return;
    }
    if (!newPO.trim()) {
      setAddFormError("Please enter the PO number.");
      return;
    }
    if (!newTechPack.trim()) {
      setAddFormError("Please enter the tech pack reference.");
      return;
    }
    if (newQty <= 0) {
      setAddFormError("Order quantity must be greater than zero.");
      return;
    }

    let finalNewSize = newSizes;
    if (!finalNewSize) {
      finalNewSize = sizeRatios.length > 0 ? sizeRatios[0].name : "28-38";
    }
    if (newSizes === "__custom__") {
      if (!customNewSizeRatio.trim()) {
        setAddFormError("Please enter the custom size ratio.");
        return;
      }
      finalNewSize = customNewSizeRatio.trim();
      addSizeRatio(finalNewSize);
    }

    const numericIds = orders
      .map((o) => parseInt(o.order_id.replace("FF-", ""), 10))
      .filter((n) => !isNaN(n));
    const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 2601;
    const newOrderId = `FF-${nextId}`;
    const matchedCustomer = customers.find(c => c.name.toLowerCase() === selectedCust.toLowerCase());
    
    addOrder({
      order_id: newOrderId,
      customer_name: selectedCust,
      customer_id: matchedCustomer?.id,
      PO_number: newPO,
      tech_pack_ref: newTechPack,
      size_breakdown: finalNewSize,
      qty: newQty,
      status: newStartingStage >= 13 ? "Shipped" : newStartingStage > 1 ? "In Production" : "Open",
      current_stage: newStartingStage || 1,
    });

    // Reset fields
    setNewCustomer("");
    setNewSizes("");
    setCustomNewSizeRatio("");
    setNewQty(1000);
    setNewStartingStage(1);
    setAddFormError("");
    setShowAddModal(false);
  };

  const handleSelectOrder = (o: Order) => {
    setSelectedOrder(o);
    setEditCustomer(o.customer_name);
    setEditPO(o.PO_number);
    setEditTechPack(o.tech_pack_ref);
    setEditSizes(o.size_breakdown);
    setCustomEditSizeRatio("");
    setEditQty(o.qty);
    setEditStatus(o.status);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setEditFormError("");
    if (!editCustomer) {
      setEditFormError("Please select a customer / brand.");
      return;
    }
    if (!editPO.trim()) {
      setEditFormError("Please enter the PO number.");
      return;
    }
    if (!editTechPack.trim()) {
      setEditFormError("Please enter the tech pack reference.");
      return;
    }
    if (editQty <= 0) {
      setEditFormError("Order quantity must be greater than zero.");
      return;
    }

    let finalEditSize = editSizes;
    if (editSizes === "__custom__") {
      if (!customEditSizeRatio.trim()) {
        setEditFormError("Please enter the custom size ratio.");
        return;
      }
      finalEditSize = customEditSizeRatio.trim();
      addSizeRatio(finalEditSize);
    }

    updateOrder(selectedOrder.order_id, {
      customer_name: editCustomer,
      PO_number: editPO,
      tech_pack_ref: editTechPack,
      size_breakdown: finalEditSize,
      qty: editQty,
      // Status is locked/uneditable in this modal once an order is genuinely
      // Shipped (see the Workflow Status field above) — omit it entirely
      // rather than resubmitting "Shipped", which would otherwise re-run
      // the mutation-level dispatch guard on every unrelated field edit.
      ...(selectedOrder.status !== "Shipped" ? { status: editStatus } : {}),
    });

    setEditFormError("");
    setSelectedOrder(null);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
              <div className="text-xs md:text-sm uppercase tracking-[0.15em] text-primary font-bold">
                {user?.role === "customer" ? "Brand Workspace" : "Operations"}
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight flex items-center gap-3">
              {user?.role === "customer" 
                ? (user?.customer_name || (filtered.length > 0 ? filtered[0].customer_name : "Your Brand")) 
                : "Order Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {user?.role === "customer" ? (
              <Link
                to="/apply/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-label-caps text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Create order
              </Link>
            ) : (
              <>
                <Link
                  to="/submissions"
                  className="bg-neutral-900 hover:bg-neutral-800 text-white px-3.5 py-2 rounded-lg font-label-caps text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-sm transition-all"
                >
                  Submissions Inbox
                </Link>
                <Link
                  to="/update-requests"
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 px-3.5 py-2 rounded-lg font-label-caps text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-sm transition-all"
                >
                  Update Requests
                </Link>
                <Link
                  to="/apply-intake"
                  className="bg-sky-500 hover:bg-sky-600 text-white px-3.5 py-2 rounded-lg font-label-caps text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="h-4 w-4" /> Direct Intake
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile label="Open Orders" value={open} />
          <KpiTile label="In Production" value={inProd} />
          <KpiTile label="On Hold" value={onHold} />
          <KpiTile label="Shipped" value={shipped} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard title="Overall Progress" className="lg:col-span-1">
            <div className="h-56 relative w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    innerRadius={60}
                    outerRadius={85}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    <Cell fill="#0071E3" />
                    <Cell fill="#E2E8F0" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-3xl font-display font-bold text-foreground">{overallProgress}%</div>
                  <div className="text-xs text-muted-foreground font-medium">Avg. stage progress</div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Orders Ingestion & Velocity Trend (14 Days)" className="lg:col-span-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={orderTrendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.6} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} stroke="#CBD5E1" tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} stroke="#CBD5E1" allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/95 dark:bg-[#121622]/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-black/[0.08] dark:border-white/[0.1] text-xs">
                            <div className="font-bold text-foreground mb-1">{label}</div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-4 text-[#0071E3]">
                                <span>Active Ingested:</span>
                                <strong>{payload[0]?.value || 0} orders</strong>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                                <span>Completed/Shipped:</span>
                                <strong>{payload[1]?.value || 0} orders</strong>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line type="monotone" name="Active Orders" dataKey="orders" stroke="#0071E3" strokeWidth={2.5} dot={{ r: 3, fill: '#0071E3' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" name="Completed/Shipped" dataKey="completed" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* Customer Portal: High-End Submissions & Review Experience */}
        {user?.role === "customer" && (
          <div className="space-y-6">
            {/* Luxury Status Hero Banner */}
            {pendingCustomerSubmissions.length > 0 && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/70 border border-amber-500/30 p-6 md:p-8 shadow-xl text-white">
              {/* Background ambient lighting */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner shrink-0 mt-0.5">
                      <Clock className="h-7 w-7 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl md:text-2xl font-display font-black tracking-tight text-white">
                          Order Intake &amp; Technical Audit
                        </h2>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs">
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                          <span>Under Merchandiser Review</span>
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                        Your production order intake applications are currently being evaluated by our lead merchandising and engineering desk. We are confirming fabric yields, cut sheet specifications, and laundry wash recipes before issuing factory Blanket POs.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/apply/new"
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> New Intake
                    </Link>
                  </div>
                </div>

                {/* 3-Step Milestone Mini-Stepper */}
                <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-white uppercase tracking-wider">1. Intake Submitted</div>
                      <div className="text-[10px] text-slate-400">Spec files securely received</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 relative overflow-hidden">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 animate-spin" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">2. Spec &amp; Yield Audit</div>
                      <div className="text-[10px] text-amber-300/80">Merchandiser in progress</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3 opacity-70">
                    <div className="h-7 w-7 rounded-lg bg-white/10 text-slate-400 border border-white/10 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">3. Work Order Release</div>
                      <div className="text-[10px] text-slate-400">Production schedule locked</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Internal Order Intake submissions awaiting this customer's approval */}
            {awaitingCustomerApproval.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-lg text-foreground tracking-tight">
                    Awaiting Your Approval
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">
                    {awaitingCustomerApproval.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {awaitingCustomerApproval.map((sub) => (
                    <Link
                      key={sub.id}
                      to="/orders/review/$submissionId"
                      params={{ submissionId: sub.id }}
                      className="block rounded-2xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-5 shadow-sm hover:shadow-md hover:border-amber-500 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">
                            Entered by your merchandiser
                          </div>
                          <div className="font-bold text-foreground text-sm">{sub.apply_reference_code}</div>
                          <div className="text-xs text-muted-foreground mt-1">{sub.product_type || sub.submission_type?.replace(/_/g, " ")}</div>
                        </div>
                        <span className="shrink-0 bg-amber-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Review Now
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Applications & Sample Requests List */}
            {activeCustomerSubmissions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-lg text-foreground tracking-tight">
                      Active Intake &amp; Sample Requests
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                      {activeCustomerSubmissions.length}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleIntakeApplications.map((sub) => {
                    const isBrandEqual = !sub.brand_name || sub.brand_name.toLowerCase().trim() === sub.company_name.toLowerCase().trim();
                    const displayName = isBrandEqual ? sub.company_name : `${sub.company_name} (${sub.brand_name})`;
                    const sLow = (sub.status || "").toLowerCase();
                    const sAny = sub as any;
                    const isSample = sub.submission_type === 'sample_request' || sAny.order_type === 'sample_request' || sub.product_type?.toLowerCase().includes('sample');
                    const isApproved = sLow === 'approved' || sLow === 'converted';
                    const isSampling = sLow === 'in_development' || sLow === 'in_production' || sLow === 'in_sampling';
                    const isShipped = sLow === 'shipped' || sLow === 'received';
                    const isNeedsInfo = sLow === 'needs_info' || sLow === 'rejected';

                    let statusBadgeClass = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 animate-pulse";
                    let statusLabel = "Under Review";
                    let workflowLabel = isSample ? "Merchandiser Spec Review (Step 1/3)" : "Merchandiser Spec Audit (Step 2/3)";
                    let progressWidth = "w-1/3";

                    if (isApproved) {
                      statusBadgeClass = "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
                      statusLabel = "Approved & Converted";
                      workflowLabel = "Ready for Manufacturing (Step 3/3)";
                      progressWidth = "w-full bg-emerald-500";
                    } else if (isShipped) {
                      statusBadgeClass = "bg-teal-500/15 text-teal-600 border-teal-500/30";
                      statusLabel = "Sample Shipped";
                      workflowLabel = "In Transit / Delivery (Step 3/3)";
                      progressWidth = "w-full bg-teal-500";
                    } else if (isSampling) {
                      statusBadgeClass = "bg-blue-500/15 text-blue-600 border-blue-500/30";
                      statusLabel = "In Sampling / Dev";
                      workflowLabel = "Cut & Sew Sampling (Step 2/3)";
                      progressWidth = "w-2/3 bg-blue-500";
                    } else if (isNeedsInfo) {
                      statusBadgeClass = "bg-red-500/15 text-red-600 border-red-500/30";
                      statusLabel = "Action Required";
                      workflowLabel = "Pending Clarification";
                      progressWidth = "w-1/4 bg-red-500";
                    } else {
                      progressWidth = "w-1/3 bg-amber-500 animate-pulse";
                    }

                    return (
                      <div 
                        key={sub.id} 
                        className="bg-card border border-border/80 hover:border-amber-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all space-y-4 relative overflow-hidden group"
                      >
                        {/* Status bar accent */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                          isApproved ? 'bg-emerald-500' : isShipped ? 'bg-teal-500' : isSampling ? 'bg-blue-500' : isNeedsInfo ? 'bg-red-500' : 'bg-gradient-to-r from-amber-500 to-amber-600'
                        }`} />

                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 pt-1">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-xs text-primary tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20">
                                {sub.apply_reference_code || "APP-PENDING"}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/20">
                                {isSample ? "Sample Request" : (sub.submission_type?.replace(/_/g, ' ') || 'New Order')}
                              </span>
                            </div>
                            <h4 className="font-display font-bold text-base text-foreground mt-1">
                              {displayName}
                            </h4>
                          </div>

                          <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1.5 shadow-2xs border ${statusBadgeClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isApproved ? 'bg-emerald-500' : isShipped ? 'bg-teal-500' : isSampling ? 'bg-blue-500' : isNeedsInfo ? 'bg-red-500' : 'bg-amber-500'}`} />
                            <span>{statusLabel}</span>
                          </span>
                        </div>

                        {/* Specs & Timeline Grid */}
                        <div className="grid grid-cols-2 gap-2 bg-muted/40 rounded-xl p-3 text-xs border border-border/40 font-mono">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Submitted Date</span>
                            <span className="font-semibold text-foreground">
                              {new Date(sub.submitted_at || sub.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Intake Channel</span>
                            <span className="font-semibold text-foreground capitalize">
                              {sub.source === 'apply_portal' ? 'Intake Portal' : 'Direct Atelier'}
                            </span>
                          </div>
                          <div className="space-y-0.5 col-span-2 pt-1.5 border-t border-border/40">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Notification Email</span>
                            <span className="font-sans font-medium text-foreground truncate block">
                              {sub.contact_email}
                            </span>
                          </div>
                        </div>

                        {/* Progress Stepper Visual */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                            <span>Workflow Stage</span>
                            <span className={isApproved ? "text-emerald-600 font-bold" : isSampling ? "text-blue-600 font-bold" : isShipped ? "text-teal-600 font-bold" : "text-amber-600 font-bold"}>
                              {workflowLabel}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                            <div className={`h-full ${progressWidth}`} />
                          </div>
                        </div>

                        {/* Action CTAs */}
                        <div className="flex items-center gap-2.5 pt-1">
                          <Link
                            to="/apply/status/$referenceCode"
                            params={{ referenceCode: sub.apply_reference_code || 'lookup' }}
                            search={{ email: sub.contact_email }}
                            className="flex-1 h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                          >
                            <Search className="h-3.5 w-3.5" />
                            <span>Live Status Tracker</span>
                            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                          </Link>
                          <Link
                            to="/apply/update"
                            className="h-9 px-4 rounded-xl bg-white hover:bg-neutral-50 dark:bg-card border border-neutral-300 dark:border-border text-foreground text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Request Revision</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeCustomerSubmissions.length > INTAKE_TILE_LIMIT && !showAllIntakeApplications && (
                  <button
                    type="button"
                    onClick={() => setShowAllIntakeApplications(true)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Show all ({activeCustomerSubmissions.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <SectionCard
          title={`Active Production Orders (${filtered.length})`}
          action={
            <div className="flex items-center gap-2">
              <input
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Search order, PO, customer"
                className="h-8 rounded-md border border-input bg-background text-xs px-2 w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-secondary"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-8 rounded-md border border-input bg-background text-xs px-2 focus:outline-none"
              >
                {["All", "Open", "In Production", "On Hold", "Shipped"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-4">Order ID</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">PO</th>
                  <th className="py-2 pr-4">Style No</th>
                  <th className="py-2 pr-4">Tech Pack</th>
                  <th className="py-2 pr-4">Sizes</th>
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2 pr-4">Stage</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Created</th>
                  {canEdit && <th className="py-2 pr-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isDataLoading ? (
                  <tr>
                    <td colSpan={canEdit ? 11 : 10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full" />
                        <span className="text-sm font-medium">Loading your orders...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 11 : 10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <Info className="h-6 w-6 opacity-40" />
                        </div>
                        <p className="text-sm font-semibold">
                          {globalSearchQuery ? "No orders match your search" : user?.role === "customer" ? "No orders found for your account" : "No orders yet"}
                        </p>
                        <p className="text-xs max-w-xs">
                          {globalSearchQuery
                            ? "Try clearing the search or changing the status filter."
                            : user?.role === "customer"
                            ? "Your orders will appear here once a merchandiser converts your application."
                            : canEdit ? "Create a new intake order or wait for a converted submission to appear here." : ""}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((o) => (
                  <tr
                    key={o.order_id}
                    onClick={() => {
                      navigate({ to: "/orders/$orderId", params: { orderId: o.order_id } });
                    }}
                    className="border-b border-black/[0.06] dark:border-white/[0.08] hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 pr-4 font-medium">
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: o.order_id }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#0071E3] font-bold hover:underline inline-flex items-center gap-1 group/link"
                      >
                        <span>{o.order_id}</span>
                        <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity text-[#0071E3]" />
                      </Link>
                      {(o as any).is_sample && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-violet-50 text-violet-800 border border-violet-200 uppercase tracking-wider">Sample</span>
                      )}
                      {isOrderOnHold(o.order_id) && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">On Hold</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 font-semibold text-slate-900 dark:text-slate-100">{o.customer_name}</td>
                    <td className="py-3.5 pr-4 font-medium text-slate-800 dark:text-slate-200">{o.PO_number}</td>
                    <td className="py-3.5 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100">{o.style_no || "N/A"}</td>
                    <td className="py-3.5 pr-4 text-slate-700 dark:text-slate-300 font-mono text-xs">{o.tech_pack_ref}</td>
                    <td className="py-3.5 pr-4 text-xs font-medium text-slate-800 dark:text-slate-200">{formatSizeBreakdown(o.size_breakdown)}</td>
                    <td className="py-3.5 pr-4 font-bold text-slate-900 dark:text-white">{o.qty ? o.qty.toLocaleString() : "—"}</td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full bg-[#0071E3]" style={{ width: `${(o.current_stage / 13) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{o.current_stage}/13</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4"><StatusBadge status={o.status} /></td>
                    <td className="py-3.5 pr-4 text-slate-700 dark:text-slate-300 text-xs font-medium">{o.created_date}</td>
                    {canEdit && (
                      <td className="py-3.5 pr-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOrder(o);
                          }}
                          className="p-1.5 text-slate-500 hover:text-[#0071E3] rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          title="Modify Intake Details"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* Add Intake Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => { setShowAddModal(false); setAddFormError(""); }}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display-lg text-lg font-bold text-primary mb-1">Create Intake Order</h3>
            <p className="text-xs text-muted-foreground mb-4">Register incoming fabrics/materials PO details.</p>

            {addFormError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{addFormError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Customer Company</label>
                <select
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary font-medium"
                  required
                >
                  <option value="" disabled>-- Select Registered Customer Company --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">PO Number</label>
                  <input
                    value={newPO}
                    onChange={(e) => setNewPO(e.target.value)}
                    placeholder="PO-54321"
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Tech Pack Ref</label>
                  <input
                    value={newTechPack}
                    onChange={(e) => setNewTechPack(e.target.value)}
                    placeholder="TP-9876"
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Size Ratio</label>
                  <select
                    value={newSizes}
                    onChange={(e) => setNewSizes(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    {sizeRatios.map((s) => (
                      <option key={s.id} value={s.name}>{s.name} {s.description ? `(${s.description})` : ""}</option>
                    ))}
                    <option value="__custom__">+ Add Custom Size Ratio...</option>
                  </select>
                  {newSizes === "__custom__" && (
                    <input
                      type="text"
                      value={customNewSizeRatio}
                      onChange={(e) => setCustomNewSizeRatio(e.target.value)}
                      placeholder="e.g. 27-35 or S-4XL"
                      className="w-full mt-2 px-3 h-9 rounded-lg border border-primary/50 text-xs focus:outline-none focus:ring-1 focus:ring-secondary bg-primary/5 font-semibold"
                      required
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Intake Qty (pcs)</label>
                  <input
                    type="number"
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    min={1}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    Production Scope / Starting Stage
                  </label>
                  <span className="text-[10px] font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded">
                    Stage {newStartingStage}/13
                  </span>
                </div>
                <select
                  value={newStartingStage}
                  onChange={(e) => setNewStartingStage(Number(e.target.value))}
                  className="w-full px-3 h-10 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs mt-1"
                >
                  <option value={1}>Full CMT Package (Start at Stage 1: PO & Fabric Intake)</option>
                  <option value={4}>Cut & Make Only (Start at Stage 4: Fabric Staging & Spreading)</option>
                  <option value={6}>Make / Sewing Only — Pre-cut panels received (Start at Stage 6: Sewing)</option>
                  <option value={9}>Garment Wash Only — Pre-stitched jeans received (Start at Stage 9: Garment Wash)</option>
                  <option value={10}>Dry Process & Special Treatments (Start at Stage 10: Tinting)</option>
                  <option value={12}>Finishing & Packaging Only (Start at Stage 12: Final Pack)</option>
                </select>
                <p className="text-[10px] text-amber-800/80 mt-1 flex items-start gap-1">
                  <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>If customer already provides stitched jeans for washing only, choose <strong>Stage 9</strong> to jump directly into the laundry line!</span>
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white hover:bg-black h-11 rounded-lg font-headline-sm text-sm font-semibold mt-4 transition-all shadow-sm"
              >
                Ingest Order
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-outline-variant max-w-md w-full shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => { setSelectedOrder(null); setEditFormError(""); }}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display-lg text-lg font-bold text-primary mb-1">Modify Order intake: {selectedOrder.order_id}</h3>
            <p className="text-xs text-muted-foreground mb-4">Modify technical parameters or dispatch states.</p>

            {editFormError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{editFormError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Customer Company</label>
                <select
                  value={editCustomer}
                  onChange={(e) => setEditCustomer(e.target.value)}
                  className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary font-medium"
                  required
                >
                  <option value="" disabled>-- Select Registered Customer Company --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">PO Number</label>
                  <input
                    value={editPO}
                    onChange={(e) => setEditPO(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Tech Pack Ref</label>
                  <input
                    value={editTechPack}
                    onChange={(e) => setEditTechPack(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Size Ratio</label>
                  <select
                    value={editSizes}
                    onChange={(e) => setEditSizes(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none"
                  >
                    {sizeRatios.map((s) => (
                      <option key={s.id} value={s.name}>{s.name} {s.description ? `(${s.description})` : ""}</option>
                    ))}
                    {!sizeRatios.some(s => s.name === editSizes) && editSizes && (
                      <option value={editSizes}>{editSizes}</option>
                    )}
                    <option value="__custom__">+ Add Custom Size Ratio...</option>
                  </select>
                  {editSizes === "__custom__" && (
                    <input
                      type="text"
                      value={customEditSizeRatio}
                      onChange={(e) => setCustomEditSizeRatio(e.target.value)}
                      placeholder="e.g. 27-35 or S-4XL"
                      className="w-full mt-2 px-3 h-9 rounded-lg border border-primary/50 text-xs focus:outline-none focus:ring-1 focus:ring-secondary bg-primary/5 font-semibold"
                      required
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Intake Qty (pcs)</label>
                  <input
                    type="number"
                    value={editQty}
                    onChange={(e) => setEditQty(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none"
                    min={1}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 border-t border-outline-variant/60 pt-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-primary">Workflow Status</label>
                {selectedOrder?.status === "Shipped" ? (
                  <>
                    <div className="w-full px-3 h-10 rounded-lg border border-outline-variant bg-muted/40 text-sm flex items-center text-muted-foreground font-medium">
                      Shipped
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      This order has been dispatched and cannot be reopened here.
                    </p>
                  </>
                ) : (
                  <select
                    value={editStatus}
                    onChange={(e: any) => setEditStatus(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    <option value="Open">Open</option>
                    <option value="In Production">In Production</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                )}
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this order? It will be removed from all stages.")) {
                      const remaining = orders.filter(o => o.customer_name === selectedOrder.customer_name && o.order_id !== selectedOrder.order_id);
                      if (remaining.length === 0) {
                         deleteCustomerCascade(selectedOrder.customer_name);
                      } else {
                         deleteOrder(selectedOrder.order_id);
                      }
                      setSelectedOrder(null);
                    }
                  }}
                  className="flex-1 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white h-11 rounded-lg font-headline-sm text-sm font-semibold transition-all"
                >
                  Delete Order
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white hover:bg-black h-11 rounded-lg font-headline-sm text-sm font-semibold transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
