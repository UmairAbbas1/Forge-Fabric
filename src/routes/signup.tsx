import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAppData } from "../hooks/useAppData";
import { KeyRound, Mail, ArrowRight, UserPlus, AlertTriangle, ArrowLeft } from "lucide-react";
import { rateLimiter } from "../lib/cacheAndRateLimiter";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up · Forge & Fabric" },
      { name: "description", content: "Create an account for the Forge & Fabric Tracking app." },
    ],
  }),
  component: SignupPage,
});


function SignupPage() {
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const { customers, addCustomer } = useAppData();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"admin" | "merchandiser" | "production" | "qc" | "customer">("customer");
  const [fullName, setFullName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect to dashboard
  if (user && !successMsg) {
    navigate({ to: "/dashboard" });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email || !password) {
      setErrorMsg("Please enter your name, email and password.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("Please enter a valid email address (e.g. name@company.com).");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter to confirm.");
      return;
    }
    if (role === "customer" && !customerName.trim()) {
      setErrorMsg("Please enter your company name.");
      return;
    }

    const rateCheck = rateLimiter.isAllowed(`signup:${email.trim().toLowerCase()}`, 3, 15000);
    if (!rateCheck.allowed) {
      setErrorMsg(`Too many registration attempts. Please wait ${rateCheck.retryAfterSec} seconds before retrying.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const selectedCustomer = role === "customer" ? customerName : undefined;
      const { error } = await signUp(email, password, role, selectedCustomer, fullName.trim());
      if (error) {
        setErrorMsg(error.message);
      } else {
        if (selectedCustomer && !customers.some(c => c.name.toLowerCase() === selectedCustomer.toLowerCase().trim())) {
          addCustomer(selectedCustomer.trim(), email);
        }
        setSuccessMsg("Account created and synced with backend database! Redirecting to dashboard...");
        setTimeout(() => {
          navigate({ to: "/dashboard" });
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row items-stretch justify-center industrial-grid p-4 md:p-0">

      {/* Side Brand panel - Large Centered Logo with Bold Terracotta Separation Line */}
      <div className="hidden lg:flex lg:w-5/12 h-screen sticky top-0 bg-white p-8 items-center justify-center flex-col relative overflow-hidden border-r-[10px] border-primary z-20">
        <div className="absolute inset-0 opacity-5 industrial-grid pointer-events-none"></div>

        {/* Back to Home Button */}
        <Link
          to="/"
          className="absolute top-8 left-8 z-20 flex items-center gap-2 text-xs font-bold text-neutral-700 hover:text-amber-700 bg-neutral-100 hover:bg-amber-50 px-4 py-2 rounded-full border border-neutral-200 transition-all shadow-sm group"
          title="Return to Home Landing Page"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>

        {/* Center Logo */}
        <Link to="/" className="z-10 flex flex-col items-center justify-center gap-6 transform hover:scale-105 transition-all duration-300">
          <img src="/SVG_MARK.svg" alt="Forge & Fabric Logo" className="w-64 h-64 md:w-[320px] md:h-[320px] object-contain mix-blend-multiply" />
          <div className="font-display font-black text-3xl md:text-4xl tracking-tight text-neutral-950 text-center">
            FORGE<span className="text-amber-600 font-serif italic font-normal">&amp;</span>FABRIC
          </div>
        </Link>
      </div>

      {/* Main signup panel */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-6 lg:px-16 bg-white shadow-xl lg:shadow-none max-w-xl mx-auto lg:max-w-none lg:mx-0 lg:w-7/12">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img src="/SVG_MARK.svg" alt="Logo" className="h-12 w-auto object-contain p-1 border border-border shadow-sm rounded-xl" />
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground">
                  Register User Profile
                </h1>
                <p className="font-sans text-xs text-muted-foreground">
                  Create your account credentials and select your functional role below.
                </p>
              </div>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 p-3 rounded-lg flex items-center gap-2.5 text-sm border border-emerald-500/30 shadow-sm animate-fade-in font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-error-container text-on-error-container p-3 rounded-lg flex items-start gap-2.5 text-sm border border-error/25">
              <AlertTriangle className="h-5 w-5 shrink-0 text-error" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Full Name
              </label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Faiz Ijaz"
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@forgefabric.com"
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Strong password required"
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  disabled={submitting}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Minimum 8 characters, uppercase, lowercase, number, special char.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1 p-3 rounded-lg border border-border bg-muted/40 animate-fade-in">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">
                Associate Customer Company
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your company name"
                className="w-full px-3 h-10 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={submitting}
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                All newly registered accounts are set to a Customer role by default. Internal staff roles must be granted by an administrator.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
              disabled={submitting}
            >
              {submitting ? "Creating Profile..." : "Create Account"}
              <UserPlus className="h-4 w-4" />
            </button>
          </form>

          <div className="text-center">
            <span className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Sign In
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
// a 
