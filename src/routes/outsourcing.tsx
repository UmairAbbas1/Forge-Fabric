import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SectionCard } from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { useAppData } from "../hooks/useAppData";
import { StageOutsourcingPanel } from "../components/stage/StageOutsourcingPanel";
import { Factory, Lock, LogOut } from "lucide-react";

// Dedicated, directly-linkable, standalone entry point for outsourcing
// logging — same underlying panel already embedded in the order detail
// page and the Cutting/Sewing/Wash portals (StageOutsourcingPanel, reused
// as-is here, not duplicated). Deliberately does NOT use <AppShell>: this
// account's whole job is outsourcing, so it gets no sidebar and no access
// to anything else in the app — confirmed live gap, the shared shell showed
// every nav item (Order Dashboard, Material Receiving, Dispatch, ...) to an
// account that should only ever see this one screen.
//
// Owns its own login too: opening the link must ALWAYS show a fresh
// sign-in, never silently reuse whatever session is already active in that
// browser (confirmed live bug — an already-logged-in admin landed straight
// on this page as themselves). Forces a sign-out the moment this page
// mounts, and only ONE role is actually allowed through — every other
// account (including admin/merchandiser/QC, not just customers) is
// rejected and signed back out, since this link is specifically for the
// outsourcing account, not a second door into the rest of the app.
export const Route = createFileRoute("/outsourcing")({
  head: () => ({
    meta: [
      { title: "Outsourcing · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Select a production order and route eligible stages to outside vendors, logging material dispatched and received." },
    ],
  }),
  component: OutsourcingPage,
});

// Only this role may use this login. It's a dedicated role that exists
// solely for this page (see permissions.ts) — deliberately not
// production_manager or any other real staff role, both so this account's
// permissions are as narrow as the matrix allows and so AppShell's own
// hard redirect (which keys off this exact role) can bounce it out of
// every other page in the app on sight.
const OUTSOURCING_ALLOWED_ROLES = ["outsourcing_staff"];

function OutsourcingPage() {
  const { user, loading, signIn, signOut } = useAuth();
  const { orders } = useAppData();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const forcedLogoutDone = useRef(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [rejectedRoleError, setRejectedRoleError] = useState("");

  // Force a clean slate on every visit, but ONLY for a session that isn't
  // already this page's own role — signing out an admin/merchandiser/etc.
  // session that leaked in is the whole point, but an outsourcing_staff
  // session that's already correctly authenticated must be let through.
  // Confirmed live bug without this check: logging in via the main /login
  // screen (which has no idea this role exists and defaults it to
  // /dashboard) hits AppShell's redirect to /outsourcing — landing here
  // with an already-valid outsourcing_staff session — and this effect
  // immediately signed it right back out again, bouncing straight back to
  // a login screen forever no matter how many times you signed in.
  useEffect(() => {
    if (forcedLogoutDone.current) return;
    forcedLogoutDone.current = true;
    if (loading) return;
    (async () => {
      if (user && !OUTSOURCING_ALLOWED_ROLES.includes(user.role)) {
        setRejectedRoleError("This account isn't set up for Outsourcing access. Sign in with the outsourcing staff account.");
        await signOut();
      }
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
    return <OutsourcingLogin onSignIn={signIn} error={rejectedRoleError} />;
  }

  if (!OUTSOURCING_ALLOWED_ROLES.includes(user.role)) {
    return (
      <OutsourcingLogin
        onSignIn={signIn}
        error="This account isn't set up for Outsourcing access. Sign in with the outsourcing staff account."
        onMount={() => signOut()}
      />
    );
  }

  const selectedOrder = orders.find((o) => o.order_id === selectedOrderId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-foreground">
          <Factory className="h-5 w-5 text-primary" /> Outsourcing
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user.full_name || user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        <p className="text-sm text-muted-foreground">
          Select a production order, then route an eligible stage to an outside vendor and log the material dispatched or received.
        </p>

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
    </div>
  );
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const ranOnMount = useRef(false);

  useEffect(() => {
    if (onMount && !ranOnMount.current) {
      ranOnMount.current = true;
      onMount();
    }
  }, [onMount]);

  // Live countdown while locked out, and auto-clears once it expires.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = !!lockedUntil && now < lockedUntil;
  const secondsLeft = isLocked ? Math.ceil((lockedUntil! - now) / 1000) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const result = await onSignIn(cleanEmail, password);
      if (result.error) {
        const nextAttempts = failedAttempts + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          setFailedAttempts(0);
          setLockedUntil(Date.now() + LOCKOUT_MS);
          setNow(Date.now());
          setError(`Too many failed attempts. Try again in ${LOCKOUT_MS / 1000} seconds.`);
        } else {
          setFailedAttempts(nextAttempts);
          setError(result.error.message);
        }
      } else {
        setFailedAttempts(0);
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
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-800">
            {isLocked ? `Too many failed attempts. Try again in ${secondsLeft}s.` : error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            disabled={isLocked}
            className="w-full p-3 border-2 rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            disabled={isLocked}
            className="w-full p-3 border-2 rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || isLocked || !email.trim() || !password}
          className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-sm rounded-xl"
        >
          {isLocked ? `Locked (${secondsLeft}s)` : submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
