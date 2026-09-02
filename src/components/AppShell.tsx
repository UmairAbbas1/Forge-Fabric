import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Workflow,
  ClipboardList,
  PackageOpen,
  Warehouse,
  Scissors,
  Cog,
  Droplets,
  ShieldCheck,
  Search,
  Bell,
  BellRing,
  Clock,
  Shield,
  LogOut,
  User,
  Truck,
  TrendingUp,
  MailCheck,
  Menu,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Tablet,
  CheckCircle2,
  AlertOctagon,
  Sparkles
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAppData } from "../hooks/useAppData";
import { useUserLocale } from "../hooks/useUserLocale";
import { hasPermission, type Module } from "../lib/permissions";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip";
import { Sheet, SheetContent } from "./ui/sheet";
import { BackButton } from "./BackButton";

export interface AppNavItem {
  to: string;
  label: string;
  icon: any;
  module?: Module;
}

export function getRequiredModuleForPath(pathname: string): Module | null {
  if (pathname === "/qc" || pathname.startsWith("/qc/")) return "qc";
  if (pathname === "/account" || pathname.startsWith("/account/")) return null; // universal
  if (
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  ) {
    return "admin";
  }
  if (
    pathname === "/sku-mapping" ||
    pathname.startsWith("/sku-mapping/") ||
    pathname === "/boms" ||
    pathname.startsWith("/boms/") ||
    pathname === "/styles" ||
    pathname.startsWith("/styles/") ||
    pathname === "/size-ranges" ||
    pathname.startsWith("/size-ranges/")
  ) {
    return "product_master";
  }
  if (
    pathname === "/materials" ||
    pathname.startsWith("/materials/") ||
    pathname === "/inventory" ||
    pathname.startsWith("/inventory/")
  ) {
    return "inventory";
  }
  if (
    pathname === "/cutting" ||
    pathname.startsWith("/cutting/") ||
    pathname === "/sewing" ||
    pathname.startsWith("/sewing/") ||
    pathname === "/wash" ||
    pathname.startsWith("/wash/") ||
    pathname === "/shop-floor" ||
    pathname.startsWith("/shop-floor/")
  ) {
    return "shop_floor";
  }
  if (pathname === "/dispatch" || pathname.startsWith("/dispatch/")) return "shipping";
  if (pathname === "/finance" || pathname.startsWith("/finance/")) return "finance";
  if (
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/submissions" ||
    pathname.startsWith("/submissions/") ||
    pathname === "/update-requests" ||
    pathname.startsWith("/update-requests/") ||
    pathname === "/apply-intake" ||
    pathname.startsWith("/apply-intake/") ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/")
  ) {
    return "orders";
  }
  return null;
}

const NAV: AppNavItem[] = [
  { to: "/dashboard", label: "Production Flow", icon: Workflow, module: "admin" },
  { to: "/orders", label: "Order Dashboard", icon: ClipboardList, module: "orders" },
  { to: "/materials", label: "Material Receiving", icon: PackageOpen, module: "inventory" },
  { to: "/inventory", label: "Multi-Location Inventory", icon: Warehouse, module: "inventory" },
  { to: "/sku-mapping", label: "Customer SKU Map", icon: ClipboardList, module: "product_master" },
  { to: "/cutting", label: "Cutting Tracker", icon: Scissors, module: "shop_floor" },
  { to: "/sewing", label: "Sewing WIP", icon: Cog, module: "shop_floor" },
  { to: "/wash", label: "Wash & Finishing", icon: Droplets, module: "shop_floor" },
  { to: "/qc", label: "Quality Control", icon: ShieldCheck, module: "qc" },
  { to: "/dispatch", label: "Dispatch", icon: Truck, module: "shipping" },
  { to: "/shop-floor", label: "Shop Floor WIP", icon: TrendingUp, module: "shop_floor" },
  { to: "/tablet", label: "Tablet Scan Mode", icon: Tablet, module: "shop_floor" },
  { to: "/finance", label: "Finance & Invoicing", icon: FileText, module: "finance" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { notifications, markNotificationAsRead, toast, globalSearchQuery, setGlobalSearchQuery } = useAppData();
  const [now, setNow] = useState<string>("");
  // Header clock locale/zone: internal staff run on factory time+format
  // (US, Pacific — both facilities are in California); customers see their
  // own company's local time/format, e.g. a Pakistan-based brand sees
  // Pakistan time in D/M/Y order, a US-based brand sees US time in M/D/Y.
  // Falls back to the viewer's own browser locale/zone when unresolved.
  const { locale: headerLocale, timeZone: headerTimeZone } = useUserLocale();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Popup notification state
  const [popupNotif, setPopupNotif] = useState<{ message: string; orderId: string; id: string; type: string } | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const prevNotifIdsRef = useRef<Set<string>>(new Set());
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissPopup = useCallback(() => {
    setPopupVisible(false);
    setTimeout(() => setPopupNotif(null), 400);
  }, []);

  // Responsive Sidebar States
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("forge_flow_sidebar_collapsed") === "true";
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("forge_flow_sidebar_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        d.toLocaleString(headerLocale, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: headerTimeZone,
        })
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [headerLocale, headerTimeZone]);

  // Handle outside clicks to close notifications panel
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Detect incoming new notifications and show a popup
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    if (prevNotifIdsRef.current.size === 0) {
      notifications.forEach((n) => prevNotifIdsRef.current.add(n.id));
      return;
    }

    const newOnes = notifications.filter((n) => !prevNotifIdsRef.current.has(n.id));
    if (newOnes.length > 0) {
      const latest = newOnes[0];
      setPopupNotif({ message: latest.message, orderId: latest.order_id, id: latest.id, type: latest.type });
      setPopupVisible(true);

      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => dismissPopup(), 6000);

      newOnes.forEach((n) => prevNotifIdsRef.current.add(n.id));
    }
  }, [notifications, dismissPopup]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-[#090A0F]">
        <div className="glass-surface p-6 rounded-2xl text-center space-y-3 shadow-lg border border-white/60 dark:border-white/10">
          <div className="h-6 w-6 border-2 border-[#0071E3] border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-xs font-medium text-muted-foreground">Authenticating session…</p>
        </div>
      </div>
    );
  }

  // Filter navigation links based on user role matrix
  const allowedNav = NAV.filter((item) => {
    if (!item.module) return true;
    return hasPermission(user.role, item.module, "read");
  });

  // Role-specific action routes
  let roleCustomNav = [...allowedNav];
  if (hasPermission(user.role, "orders", "update")) {
    roleCustomNav = [
      ...roleCustomNav,
      { to: "/submissions", label: "Submissions Inbox", icon: ClipboardList, module: "orders" },
      { to: "/update-requests", label: "Update Requests", icon: Workflow, module: "orders" },
      { to: "/apply-intake", label: "Direct Intake", icon: Scissors, module: "orders" },
    ];
  } else if (user.role === "customer") {
    roleCustomNav = [
      ...roleCustomNav,
      { to: "/apply", label: "Submit New Order", icon: Scissors, module: "orders" },
    ];
  }

  // Gated Reports & Export
  const reportsNav = hasPermission(user.role, "orders", "read")
    ? [...roleCustomNav, { to: "/reports", label: "Reporting & Export", icon: TrendingUp, module: "orders" }]
    : roleCustomNav;

  // Gated Admin Settings
  const finalNav = hasPermission(user.role, "admin", "read")
    ? [...reportsNav, { to: "/settings", label: "Admin Settings", icon: Shield, module: "admin" }, { to: "/account", label: "Account Settings", icon: Cog }]
    : [...reportsNav, { to: "/account", label: "Account Settings", icon: Cog }];

  // Role scoped notifications filtering
  const filteredNotifications = notifications.filter((n) => {
    if (user.role === "admin" || user.role === "qc") return true;
    if (user.role === "merchandiser") return true;
    if (user.role === "production") return ["hold", "reject", "overdue", "rework", "status_update", "material_shortage"].includes(n.type);
    return true;
  });

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      const localPart = email.split('@')[0];
      if (localPart.includes('.')) {
        const parts = localPart.split('.');
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return localPart.slice(0, 2).toUpperCase();
    }
    return "FF";
  };

  const formatNotifTime = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const unreadCount = filteredNotifications.filter((n) => !n.read).length;

  const handleNotifClick = (notifId: string, orderId: string) => {
    markNotificationAsRead(notifId);
    setShowNotifs(false);
    navigate({ to: "/orders/$orderId", params: { orderId } });
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F8F9FA] dark:bg-[#090A0F] text-foreground flex font-sans apple-mesh-bg selection:bg-[#0071E3]/20">

      {/* Mobile Menu Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 bg-white/95 dark:bg-[#0E131F]/95 backdrop-blur-2xl w-68 border-r border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex flex-col h-full">
            <div className="px-5 py-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-black/[0.04] dark:bg-white/10 p-1.5 flex items-center justify-center border border-black/[0.06] dark:border-white/10">
                <img src="/SVG_MARK.svg" alt="Logo" className="w-full h-full object-contain select-none" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight text-foreground">FORGE &amp; FABRIC</div>
                <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Garment System</div>
              </div>
            </div>
            
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {finalNav.map((item) => {
                const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all ${
                      active
                        ? "bg-[#0071E3] text-white shadow-sm shadow-[#0071E3]/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-muted-foreground"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            
            <div className="px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.08] text-[10px] text-muted-foreground font-mono">
              F&amp;F INDUSTRIAL MES · v2.4
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Frosted Glass Sidebar */}
      <aside
        className={`no-print hidden md:flex shrink-0 flex-col bg-white/80 dark:bg-[#0E131F]/85 backdrop-blur-2xl border-r border-black/[0.06] dark:border-white/[0.08] transition-all duration-300 z-20 ${
          collapsed ? "w-18" : "w-64"
        }`}
      >
        {collapsed ? (
          <div className="py-5 px-2 border-b border-black/[0.06] dark:border-white/[0.08] flex flex-col items-center gap-3">
            <img src="/SVG_MARK.svg" alt="Logo" className="h-7 w-7 object-contain select-none" />
            <button 
              onClick={toggleCollapsed}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors"
              title="Expand Sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src="/SVG_MARK.svg" alt="Logo" className="h-7 w-7 object-contain select-none shrink-0" />
              <div className="leading-tight">
                <div className="font-bold text-sm tracking-tight text-foreground">FORGE &amp; FABRIC</div>
                <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Garment Conversion</div>
              </div>
            </div>
            <button 
              onClick={toggleCollapsed}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        <TooltipProvider delayDuration={0}>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {finalNav.map((item) => {
              const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
              const Icon = item.icon;
              
              const linkEl = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center text-xs font-semibold tracking-tight transition-all duration-150 ${
                    collapsed ? "justify-center h-10 w-10 mx-auto rounded-xl" : "gap-3 px-3 py-2.5 rounded-xl"
                  } ${
                    active
                      ? "bg-[#0071E3] text-white shadow-xs shadow-[#0071E3]/20"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-muted-foreground"}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      {linkEl}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#11141C] text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl shadow-xl border border-white/10">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkEl;
            })}
          </nav>
        </TooltipProvider>

        <div className="px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.08] text-[10px] text-muted-foreground font-mono text-center">
          {collapsed ? "F&F" : "SYS v2.4"}
        </div>
      </aside>

      {/* Main Content Area — bounded to the viewport height (h-screen from
          the root's flex stretch, made explicit + overflow-hidden here) so
          only <main> below scrolls; the sidebar and this wrapper never do. */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Sticky Frosted Glass Top Bar */}
        <header className="no-print sticky top-0 z-30 bg-white/75 dark:bg-[#0E131F]/80 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between px-4 md:px-8 h-14">

            {/* Back + Mobile Menu */}
            <div className="flex items-center gap-2">
              <BackButton fallbackTo="/dashboard" />
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-xl focus:outline-none"
                title="Open Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            {/* Apple-grade Search Bar */}
            <div className="flex-1 flex items-center max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="search"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="Search orders, materials, POs…"
                  className="w-full pl-9 pr-8 h-9 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.05] text-xs font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 focus:border-[#0071E3] transition-all"
                />
                <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/60 bg-black/[0.04] dark:bg-white/10 px-1.5 py-0.5 rounded border border-black/[0.05] dark:border-white/10">
                  ⌘K
                </kbd>
              </div>
            </div>
            
            {/* Header Right Widgets */}
            <div className="flex items-center gap-2">
              {now && (
                <div
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-muted-foreground bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] font-mono"
                  title="Your local time"
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{now}</span>
                </div>
              )}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifs(!showNotifs)}
                  className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/10 rounded-xl transition-all"
                  title="Notifications"
                >
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-3.5 min-w-3.5 px-1 rounded-full bg-[#EF4444] text-white text-[9px] font-bold grid place-items-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 bg-white/95 dark:bg-[#121622]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-2xl rounded-2xl z-50 overflow-hidden animate-apple-fade-in">
                    <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] flex justify-between items-center bg-black/[0.02] dark:bg-white/[0.02]">
                      <span className="font-bold text-xs text-foreground">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] text-[#EF4444] font-semibold">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                      {filteredNotifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                          <MailCheck className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                          <p className="font-semibold text-foreground">All caught up</p>
                          <p className="text-[11px]">No active production alerts found.</p>
                        </div>
                      ) : (
                        filteredNotifications
                          .sort((a, b) => Number(a.read) - Number(b.read) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotifClick(n.id, n.order_id)}
                              className={`w-full p-3.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors flex gap-2.5 items-start ${
                                !n.read ? "bg-[#0071E3]/[0.03]" : ""
                              }`}
                            >
                              <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                                n.type === "reject" || n.type === "hold" || n.type === "material_shortage" ? "bg-[#EF4444]" : "bg-[#F59E0B]"
                              }`} />
                              <div className="space-y-1 flex-1">
                                <p className="text-xs text-foreground leading-snug font-medium">{n.message}</p>
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                                  <span>Order: {n.order_id}</span>
                                  <span>{formatNotifTime(n.created_at)}</span>
                                </div>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-2 pl-1 border-l border-black/[0.06] dark:border-white/[0.08]">
                <div className="h-8 w-8 rounded-full bg-[#0071E3]/10 dark:bg-[#0071E3]/20 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3] dark:text-[#38BDF8] font-bold text-xs">
                  {getInitials(user.full_name, user.email)}
                </div>
                <div className="hidden lg:block text-left leading-tight">
                  <div className="text-xs font-semibold text-foreground max-w-[120px] truncate">{user.full_name || user.email}</div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    signOut();
                    navigate({ to: "/login" });
                  }}
                  className="p-1.5 text-muted-foreground hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Body — the ONE scrolling region in the shell. The sidebar
            and header never scroll; only page content does, within its own
            bounded height (min-h-0 overrides the flex default that would
            otherwise let this grow to its content size instead of scrolling). */}
        <main className="flex-1 overflow-y-auto min-h-0 px-4 md:px-8 py-6">
          {(!getRequiredModuleForPath(location.pathname) || hasPermission(user.role, getRequiredModuleForPath(location.pathname)!, "read")) ? (
            children
          ) : (
            <div className="max-w-md mx-auto my-16 p-8 glass-floating rounded-3xl text-center space-y-4">
              <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto border border-destructive/20">
                <Shield className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">Access Restricted</h2>
                <p className="text-xs text-muted-foreground">
                  Your role (<span className="font-semibold uppercase text-foreground">{user.role}</span>) does not have permission to view <code className="font-mono text-[#0071E3]">{location.pathname}</code>.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => navigate({ to: user.role === "qc" ? "/qc" : "/orders" })}
                  className="px-5 py-2 bg-[#0071E3] text-white font-semibold text-xs rounded-xl shadow-sm hover:bg-[#0071E3]/90 transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 glass-floating text-foreground text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-apple-fade-in">
          <div className={`h-2 w-2 rounded-full ${
            toast.type === "error" ? "bg-[#EF4444]" : toast.type === "info" ? "bg-[#0071E3]" : "bg-[#10B981]"
          }`} />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Real-time Notification Popup */}
      {popupNotif && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[min(400px,90vw)] transition-all duration-300 ${
            popupVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
          }`}
        >
          <div className="glass-floating rounded-2xl p-4 shadow-2xl border border-white/80 dark:border-white/10 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#0071E3]/10 text-[#0071E3]">
                  <BellRing className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Order {popupNotif.orderId}
                </span>
              </div>
              <button onClick={dismissPopup} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs font-semibold text-foreground leading-snug">{popupNotif.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export interface KpiTileProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function KpiTile({ label, value, hint }: KpiTileProps) {
  return (
    <div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md transition-all">
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-foreground">{value}</div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground font-medium">{hint}</div>}
    </div>
  );
}

export interface SectionCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  description?: string;
  className?: string;
}

export function SectionCard({ title, children, action, description, className = "" }: SectionCardProps) {
  return (
    <div className={`card-opaque rounded-2xl shadow-xs overflow-hidden border border-border/80 ${className}`}>
      <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-muted/30">
        <div>
          <h3 className="font-bold text-xs tracking-tight text-foreground">
            {title}
          </h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  const classes = {
    open: "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20",
    "in production": "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
    "on hold": "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",
    shipped: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20",

    pass: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20",
    approved: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20",
    rework: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
    reject: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",
    rejected: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",
    hold: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",
    pending: "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20",
    ready: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
  };

  const currentClass = classes[normalized as keyof typeof classes] || "bg-secondary text-secondary-foreground border-border";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${currentClass}`}>
      {status}
    </span>
  );
}

export function ProgressBar({ value, colorClass = "bg-[#0071E3]" }: { value: number; colorClass?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full transition-all duration-300 rounded-full ${colorClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
