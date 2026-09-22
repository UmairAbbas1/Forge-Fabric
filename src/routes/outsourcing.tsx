import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, SectionCard } from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { useAppData } from "../hooks/useAppData";
import { StageOutsourcingPanel } from "../components/stage/StageOutsourcingPanel";
import { Factory } from "lucide-react";

// Dedicated, directly-linkable entry point for outsourcing logging — same
// underlying panel already embedded in the order detail page and the
// Cutting/Sewing/Wash portals (StageOutsourcingPanel, reused as-is here,
// not duplicated), just without the rest of the app's dashboard around it.
//
// Requires a real login, same accounts admin already creates in Settings ->
// Users — no anonymous/token-based access. Staff open this link, land on
// the normal sign-in screen if not already logged in, and are dropped
// straight into the order picker afterward instead of the full dashboard.
// Admin/merchandiser keep using the app exactly as before.
export const Route = createFileRoute("/outsourcing")({
  head: () => ({
    meta: [
      { title: "Outsourcing · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Select a production order and route eligible stages to outside vendors, logging material dispatched and received." },
    ],
  }),
  component: OutsourcingPage,
});

function OutsourcingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { orders } = useAppData();
  const [selectedOrderId, setSelectedOrderId] = useState("");

  // Same guard pattern as settings.tsx's admin-only redirect: staff-only
  // page, a logged-out visitor goes to the real login screen and customers
  // are sent to their own portal.
  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (user.role === "customer") navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  if (loading || !user || user.role === "customer") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  const selectedOrder = orders.find((o) => o.order_id === selectedOrderId);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" /> Outsourcing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a production order, then route an eligible stage to an outside vendor and log the material dispatched or received.
          </p>
        </div>

        <SectionCard title="Select Order">
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— Select order —</option>
            {orders.map((o) => (
              <option key={o.order_id} value={o.order_id}>
                [{o.order_id}] {o.customer_name} — {o.style_no || "N/A"} (Stage {o.current_stage})
              </option>
            ))}
          </select>
        </SectionCard>

        {selectedOrder ? (
          <StageOutsourcingPanel
            orderId={selectedOrder.order_id}
            currentStage={selectedOrder.current_stage}
            selectedStages={(selectedOrder as any).selected_stages}
          />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-2xl">
            Select an order above to view or log its outsourcing activity.
          </div>
        )}
      </div>
    </AppShell>
  );
}
