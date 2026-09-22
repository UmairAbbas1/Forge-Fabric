import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, SectionCard } from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { useAppData } from "../hooks/useAppData";
import { StageOutsourcingPanel } from "../components/stage/StageOutsourcingPanel";
import { Factory, Lock } from "lucide-react";

// Dedicated, directly-linkable entry point for outsourcing logging — same
// underlying panel already embedded in the order detail page and the
// Cutting/Sewing/Wash portals (StageOutsourcingPanel, reused as-is here,
// not duplicated), just without the rest of the app's dashboard around it.
//
// This page owns its own login, on purpose: opening the link must ALWAYS
// show the sign-in screen, never silently reuse whatever session happens to
// already be active in that browser (confirmed live bug — an admin who was
// already logged into the main app got dropped straight into Outsourcing
// as themselves, no login at all, because the shared /login redirect only
// fires when there's no session whatsoever). This forces a real, explicit
// sign-in with the outsourcing account's own credentials every single time
// the link is opened, by signing out whatever session exists the moment
// this page mounts and only showing content after a fresh login on this
// page succeeds. Admin/merchandiser flows on the rest of the app are
// unaffected — this only touches this one route.
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
  const { user, loading, signIn, signOut } = useAuth();
  const { orders } = useAppData();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const forcedLogoutDone = useRef(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Force a clean slate on every visit — whatever session was active
  // (admin, merchandiser, anyone) is signed out once, before anything else
  // renders, so this page can never fall through to someone else's session.
  useEffect(() => {
    if (forcedLogoutDone.current) return;
    forcedLogoutDone.current = true;
    if (loading) return;
    (async () => {
      if (user) await signOut();
      setCheckingSession(false);
    })();
  }, [loading, user, signOut]);

  if (loading || checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <OutsourcingLogin onSignIn={signIn} />;
  }

  if (user.role === "customer") {
    return (
      <OutsourcingLogin
        onSignIn={signIn}
        error="This account cannot access Outsourcing. Sign in with a staff account."
        onMount={() => signOut()}
      />
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

function OutsourcingLogin({
  onSignIn,
  error: externalError,
  onMount,
}: {
  onSignIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  error?: string;
  onMount?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(externalError || "");
  const [submitting, setSubmitting] = useState(false);
  const ranOnMount = useRef(false);

  useEffect(() => {
    if (onMount && !ranOnMount.current) {
      ranOnMount.current = true;
      onMount();
    }
  }, [onMount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await onSignIn(email.trim(), password);
      if (result.error) {
        setError(result.error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <form onSubmit={handleSubmit} className="max-w-sm w-full bg-card border-2 rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-black text-lg text-foreground">Outsourcing Staff Login</h1>
          <p className="text-xs text-muted-foreground mt-1">Sign in with your outsourcing staff account.</p>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-800">{error}</div>
        )}

        <div className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full p-3 border-2 rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-3 border-2 rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-sm rounded-xl"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
