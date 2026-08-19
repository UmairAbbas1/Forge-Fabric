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
  Tablet
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAppData } from "../hooks/useAppData";
import { hasPermission, type Module } from "../lib/permissions";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip";
import { Sheet, SheetContent } from "./ui/sheet";

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
  { to: "/dispatch", label: "Packing & Dispatch", icon: Truck, module: "shipping" },
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
        d.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

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

    // On first load, seed the known IDs without showing popups
    if (prevNotifIdsRef.current.size === 0) {
      notifications.forEach((n) => prevNotifIdsRef.current.add(n.id));
      return;
    }

    // Find genuinely new notifications not seen before
    const newOnes = notifications.filter((n) => !prevNotifIdsRef.current.has(n.id));
    if (newOnes.length > 0) {
      // Show the most recent new notification as a popup
      const latest = newOnes[0];
      setPopupNotif({ message: latest.message, orderId: latest.order_id, id: latest.id, type: latest.type });
      setPopupVisible(true);

      // Auto-dismiss after 6 seconds
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => dismissPopup(), 6000);

      // Update known IDs
      newOnes.forEach((n) => prevNotifIdsRef.current.add(n.id));
    }
  }, [notifications, dismissPopup]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-xs text-muted-foreground">Authenticating user session...</p>
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

  const roleColors: Record<string, string> = {
    admin: "bg-primary/10 text-primary border-primary/25",
    merchandiser: "bg-primary/10 text-primary border-primary/25",
    production: "bg-secondary/10 text-secondary border-secondary/25",
    qc: "bg-tertiary/10 text-tertiary border-tertiary/25",
    customer: "bg-muted text-muted-foreground border-border",
  };

  // Role scoped notifications filtering
  const filteredNotifications = notifications.filter((n) => {
    if (user.role === "admin" || user.role === "qc") return true;
    if (user.role === "merchandiser") return true; // Merchandisers need visibility on all issues
    if (user.role === "production") return ["hold", "reject", "overdue", "rework", "status_update"].includes(n.type);
    return true; // customer already order-scoped at hook level
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
      if (localPart.toLowerCase().startsWith('faizijaz')) {
        return 'FI';
      }
      return localPart.slice(0, 2).toUpperCase();
    }
    return "U";
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
    <div className="min-h-screen bg-background text-foreground flex font-sans industrial-grid">
      
      {/* Mobile Menu Drawer (Radix-based Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 bg-sidebar text-sidebar-foreground w-64 border-r border-sidebar-border/60">
          <div className="flex flex-col h-full">
            <div className="px-5 py-5 border-b border-sidebar-border/60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5 shadow-md">
                  <img
                    src="/SVG_MARK.svg"
                    alt="Logo"
                    draggable={false}
                    data-no-lens="true"
                    data-lens-widget="false"
                    data-no-search="true"
                    className="w-full h-full object-contain pointer-events-none select-none"
                  />
                </div>
                <div className="leading-tight">
                  <div className="font-display font-black text-base tracking-tight text-white">FORGE &amp; FABRIC INDUSTRIES, INC.</div>
                  <div className="text-[9px] uppercase tracking-widest text-sky-400 font-bold">
                    Garment Conversion
                  </div>
                </div>
              </div>
            </div>
            
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {finalNav.map((item) => {
                const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                      active
                        ? "bg-white/10 text-white border-l-4 border-amber-500 font-bold shadow-sm"
                        : "text-neutral-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-amber-400" : "text-neutral-400"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            
            <div className="px-5 py-4 border-t border-sidebar-border text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
              FORGE &amp; FABRIC INDUSTRIES, INC.
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border/60 transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {collapsed ? (
          <div className="py-4 px-2 border-b border-sidebar-border/60 flex flex-col items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-md">
              <img
                src="/SVG_MARK.svg"
                alt="Logo"
                draggable={false}
                data-no-lens="true"
                data-lens-widget="false"
                data-no-search="true"
                className="w-full h-full object-contain pointer-events-none select-none"
              />
            </div>
            <button 
              onClick={toggleCollapsed}
              className="p-1.5 rounded-lg bg-sidebar-accent hover:bg-white/10 hover:text-white transition-all focus:outline-none"
              title="Expand Sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="px-4 py-4 border-b border-sidebar-border/60 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5 shadow-md border border-neutral-200/20">
                <img
                  src="/SVG_MARK.svg"
                  alt="Forge & Fabric Industries, Inc. Logo"
                  draggable={false}
                  data-no-lens="true"
                  data-lens-widget="false"
                  data-no-search="true"
                  className="w-full h-full object-contain pointer-events-none select-none"
                />
              </div>
              <div className="leading-tight transition-all duration-300">
                <div className="font-display font-black text-lg md:text-xl tracking-tight text-white">FORGE &amp; FABRIC INDUSTRIES, INC.</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-sky-400 font-bold">
                  Garment Conversion
                </div>
              </div>
            </div>
            <button 
              onClick={toggleCollapsed}
              className="p-1.5 rounded-lg bg-sidebar-accent hover:bg-white/10 hover:text-white transition-all focus:outline-none"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        <TooltipProvider delayDuration={0}>
          <nav className="flex-1 px-3 py-4 space-y-1.5">
            {finalNav.map((item) => {
              const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
              const Icon = item.icon;
              
              const linkEl = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center text-sm transition-all duration-200 focus:outline-none ${
                    collapsed ? "justify-center h-10 w-10 mx-auto rounded-xl" : "gap-3 px-3.5 py-2.5 rounded-xl"
                  } ${
                    active
                      ? collapsed
                        ? "bg-amber-500/20 text-white border border-amber-500/40 shadow-sm"
                        : "bg-white/10 text-white border-l-4 border-amber-500 font-bold shadow-sm"
                      : "text-neutral-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-amber-400" : "text-neutral-400"}`} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      {linkEl}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-neutral-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg border border-neutral-700">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkEl;
            })}
          </nav>
        </TooltipProvider>

        <div className="px-5 py-4 border-t border-sidebar-border/40 text-[9px] uppercase tracking-widest text-sidebar-foreground/30 truncate text-center font-mono">
          {collapsed ? "F&F" : "FORGE & FABRIC INDUSTRIES, INC. · SYS v2"}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border/60" style={{boxShadow:'0 1px 0 rgba(0,212,255,0.08)'}}>
          <div className="flex items-center justify-between px-4 md:px-8 h-14">
            
            {/* Hamburger Icon for Mobile view */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg focus:outline-none"
                title="Open Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="md:hidden font-display font-bold text-sm">FORGE &amp; FABRIC INDUSTRIES, INC.</div>
            </div>

            <div className="flex-1 flex items-center max-w-xl mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="Search order ID, PO, customer…"
                  className="w-full pl-9 pr-3 h-9 rounded-xl border border-border/60 bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                />
              </div>
            </div>
            
            {/* Header Right */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground border-r border-border/40 pr-4">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400" title="Connected & Synced to Live Backend">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                </span>
                <span className="opacity-30">•</span>
                <span className="font-mono text-[11px]">{now}</span>
              </div>
              
              {/* Notifications Popover */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifs(!showNotifs)}
                  className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-lg transition-all"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[9px] font-black grid place-items-center animate-scale-up">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-outline-variant shadow-2xl rounded-xl z-50 animate-scale-up overflow-hidden">
                    <div className="px-4 py-3 border-b border-outline-variant/60 flex justify-between items-center bg-muted/20">
                      <span className="font-display font-bold text-xs uppercase tracking-wider text-primary">Recent Production Alerts</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] text-destructive font-semibold">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
                      {filteredNotifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                          <MailCheck className="h-8 w-8 text-muted/60 mx-auto" />
                          <p className="font-semibold text-foreground/80">All caught up!</p>
                          <p>No active stage alerts or quality flags found.</p>
                        </div>
                      ) : (
                        filteredNotifications
                          .sort((a, b) => Number(a.read) - Number(b.read) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotifClick(n.id, n.order_id)}
                              className={`w-full p-3.5 text-left hover:bg-muted/30 transition-colors flex gap-2.5 items-start ${
                                !n.read ? "bg-muted/15 font-semibold" : ""
                              }`}
                            >
                              <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                                n.type === "reject" ? "bg-destructive" 
                                : n.type === "hold" ? "bg-error"
                                : "bg-gold"
                              }`} />
                              <div className="space-y-1 flex-1">
                                <p className="text-xs text-foreground leading-snug">{n.message}</p>
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono-data">
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
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs uppercase glow-cyan">
                  {getInitials(user.full_name, user.email)}
                </div>
                <div className="hidden lg:block text-left leading-none">
                  <div className="text-xs font-bold text-foreground font-display max-w-[120px] truncate">{user.full_name || user.email}</div>
                  <span className={`mt-0.5 inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${roleColors[user.role]}`}>
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    signOut();
                    navigate({ to: "/login" });
                  }}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6">
          {(!getRequiredModuleForPath(location.pathname) || hasPermission(user.role, getRequiredModuleForPath(location.pathname)!, "read")) ? (
            children
          ) : (
            <div className="max-w-xl mx-auto my-12 p-8 bg-card border border-destructive/30 rounded-2xl shadow-xl text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto border border-destructive/20">
                <Shield className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
                <p className="text-xs text-muted-foreground">
                  Your account role (<span className="font-bold uppercase text-foreground">{user.role}</span>) is not permitted to access this module (<code className="font-mono text-primary">{location.pathname}</code>).
                </p>
                {(user.role === "qc" || user.role === "qc_inspector") && (
                  <p className="text-xs text-amber-500 font-medium">
                    QC accounts are restricted strictly to Quality Control inspections and Account Settings.
                  </p>
                )}
              </div>
              <div className="pt-2 flex justify-center gap-3">
                {user.role === "qc" || user.role === "qc_inspector" ? (
                  <button
                    onClick={() => navigate({ to: "/qc" })}
                    className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all"
                  >
                    Go to Quality Control Dashboard
                  </button>
                ) : (
                  <button
                    onClick={() => navigate({ to: "/orders" })}
                    className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all"
                  >
                    Return to Orders Dashboard
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-card/95 backdrop-blur-md text-foreground text-xs px-4 py-3 rounded-xl shadow-2xl border border-border/60 flex items-center gap-2 animate-scale-up" style={{boxShadow:'0 0 24px rgba(0,212,255,0.15)'}}>
          <div className={`h-2 w-2 rounded-full animate-ping ${
            toast.type === "error"
              ? "bg-destructive"
              : toast.type === "info"
              ? "bg-primary"
              : "bg-success"
          }`} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Real-time Notification Popup */}
      {popupNotif && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[min(420px,90vw)] transition-all duration-400 ${
            popupVisible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-4 scale-95 pointer-events-none"
          }`}
          style={{ transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          <div className={`rounded-2xl shadow-2xl border overflow-hidden ${
            popupNotif.type === "hold" ? "bg-red-950 border-red-700/60" :
            popupNotif.type === "reject" ? "bg-red-950 border-red-700/60" :
            popupNotif.type === "status_update" ? "bg-slate-900 border-primary/40" :
            "bg-slate-900 border-amber-600/40"
          }`}>
            {/* Progress bar countdown */}
            <div className={`h-0.5 w-full ${
              popupNotif.type === "hold" || popupNotif.type === "reject" ? "bg-red-500/30" : "bg-primary/30"
            }`}>
              <div
                className={`h-full ${
                  popupNotif.type === "hold" || popupNotif.type === "reject" ? "bg-red-400" : "bg-primary"
                }`}
                style={{ width: "100%", animation: "shrink-width 6s linear forwards" }}
              />
            </div>
            <div className="px-4 py-3.5 flex items-start gap-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                popupNotif.type === "hold" || popupNotif.type === "reject"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-primary/20 text-primary"
              }`}>
                <BellRing className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest font-bold mb-0.5 text-white/50">
                  New Notification · Order {popupNotif.orderId}
                </div>
                <p className="text-sm text-white leading-snug font-medium">{popupNotif.message}</p>
              </div>
              <button
                onClick={dismissPopup}
                className="shrink-0 mt-0.5 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface KpiTileProps {
  label: string;
  value: string | number;
  accent?: "navy" | "gold" | "success" | "destructive";
  hint?: string;
}

export function KpiTile({ label, value, accent = "navy", hint }: KpiTileProps) {
  const colors = {
    navy:        { bar: "bg-navy",        num: "text-navy",        badge: "bg-navy/8 border-navy/15" },
    gold:        { bar: "bg-gold",        num: "text-gold",        badge: "bg-gold/8 border-gold/15" },
    success:     { bar: "bg-success",     num: "text-success",     badge: "bg-success/8 border-success/15" },
    destructive: { bar: "bg-destructive", num: "text-destructive", badge: "bg-destructive/8 border-destructive/15" },
  };
  const c = colors[accent];

  return (
    <div className="relative bg-card border border-border rounded-xl p-5 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${c.bar}`} />
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</div>
        <div className={`mt-2 text-3xl font-black font-sans ${c.num}`}>{value}</div>
      </div>
      {hint && <div className="mt-3 text-[10px] text-muted-foreground font-mono">{hint}</div>}
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
    <div className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-muted/40">
        <div>
          <h3 className="font-sans font-bold text-[11px] tracking-widest uppercase text-primary">
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
  
  // Mapping statuses and QC results to appropriate Tailwind classes
  const classes = {
    open: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "in production": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    "on hold": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    shipped: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    
    // QC results
    pass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    rework: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    reject: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    rejected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    hold: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    pending: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    
    // Cartons
    ready: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };

  const currentClass = classes[normalized as keyof typeof classes] || "bg-muted text-muted-foreground border-border";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${currentClass}`}>
      {status}
    </span>
  );
}

export function ProgressBar({ value, colorClass = "bg-primary" }: { value: number; colorClass?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden border border-border/30">
      <div className={`h-full transition-all duration-500 rounded-full ${colorClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
