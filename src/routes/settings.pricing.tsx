import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { usePermission } from "../hooks/usePermission";
import { DollarSign, Zap, Percent, Beaker, ShieldAlert } from "lucide-react";
import { StandardRatesPanel } from "../components/settings/pricing/StandardRatesPanel";
import { RushPricingPanel } from "../components/settings/pricing/RushPricingPanel";
import { CustomerDiscountsPanel } from "../components/settings/pricing/CustomerDiscountsPanel";
import { SamplePricingPanel } from "../components/settings/pricing/SamplePricingPanel";

export const Route = createFileRoute("/settings/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & Rates · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Manage Standard Rates, Rush Pricing, Customer Discounts, and Sample Pricing." },
    ],
  }),
  component: PricingSettingsPage,
});

type Tab = "rates" | "rush" | "discounts" | "samples";

function PricingSettingsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const canRead = usePermission("pricing", "read");
  const [activeTab, setActiveTab] = useState<Tab>("rates");

  // Admin/finance only — merchandiser gets read access to the underlying
  // data (for quoting) but the management console itself is write-capable
  // roles only, same convention as every other /settings/* page.
  const canManage = usePermission("pricing", "update") || usePermission("pricing", "create");

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate({ to: "/login" });
      } else if (!canRead) {
        navigate({ to: "/dashboard" });
      }
    }
  }, [user, loading, canRead, navigate]);

  if (loading || !user || !canRead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Admin Panel</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-secondary" />
            Pricing &amp; Rates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the standard rates, rush multipliers, customer discounts, and sample pricing used across order quoting.
          </p>
        </div>

        {!canManage && (
          <div className="p-3 rounded-lg flex items-center gap-2.5 text-sm border bg-amber-50 text-amber-900 border-amber-200">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>You have read-only access to Pricing &amp; Rates. Only Finance and Admin roles can create or edit rules.</span>
          </div>
        )}

        <div className="flex border-b border-border gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("rates")}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "rates" ? "border-secondary text-foreground font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <DollarSign className="h-4 w-4" /> Standard Rates
          </button>
          <button
            onClick={() => setActiveTab("rush")}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "rush" ? "border-secondary text-foreground font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Zap className="h-4 w-4" /> Rush Pricing
          </button>
          <button
            onClick={() => setActiveTab("discounts")}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "discounts" ? "border-secondary text-foreground font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Percent className="h-4 w-4" /> Customer Discounts
          </button>
          <button
            onClick={() => setActiveTab("samples")}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "samples" ? "border-secondary text-foreground font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Beaker className="h-4 w-4" /> Sample Pricing
          </button>
        </div>

        <fieldset disabled={!canManage} className={!canManage ? "opacity-90" : ""}>
          {activeTab === "rates" && <StandardRatesPanel />}
          {activeTab === "rush" && <RushPricingPanel />}
          {activeTab === "discounts" && <CustomerDiscountsPanel />}
          {activeTab === "samples" && <SamplePricingPanel />}
        </fieldset>
      </div>
    </AppShell>
  );
}
