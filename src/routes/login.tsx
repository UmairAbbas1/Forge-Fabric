import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { KeyRound, Mail, ArrowRight, UserCheck, AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { rateLimiter } from "../lib/cacheAndRateLimiter";
import { supabase, isRealSupabase } from "../lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Sign in to the Forge & Fabric Industries, Inc. Industrial Garment Tracking app." },
    ],
  }),
  component: LoginPage,
});

const DEMO_USERS = [
  { label: "Admin", email: "admin@forgefabric.com", role: "admin", desc: "Full access & User settings" },
  { label: "Merchandiser", email: "merch@forgefabric.com", role: "merchandiser", desc: "Orders & Intake data" },
  { label: "Production", email: "prod@forgefabric.com", role: "production", desc: "Internal floor stages" },
  { label: "QC Inspector", email: "qc@forgefabric.com", role: "qc", desc: "Audits & read floor views" },
  { label: "Customer", email: "customer@forgefabric.com", role: "customer", desc: "Scoped order view" },
];

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, user, updateUserProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Detect an invite/recovery link (Supabase redirects here with #access_token=...&type=invite
  // or &type=recovery) captured synchronously on first render — before Supabase's client library
  // has a chance to auto-parse and strip the hash from the URL.
  const [isInviteFlow, setIsInviteFlow] = useState(
    () =>
      isRealSupabase &&
      typeof window !== "undefined" &&
      /type=(invite|recovery)/.test(window.location.hash)
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setPasswordError, setSetPasswordError] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordWasSet, setPasswordWasSet] = useState(false);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetPasswordError("");

    if (newPassword.length < 8) {
      setSetPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSetPasswordError("Passwords do not match.");
      return;
    }

    setSettingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setSetPasswordError(error.message);
        return;
      }
      // Mark the invited profile as fully activated now that a password exists.
      if (user) {
        await updateUserProfile({ status: "active" });
      }
      setPasswordWasSet(true);
      setIsInviteFlow(false);
      // Clean the consumed auth tokens out of the URL bar.
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (err: any) {
      setSetPasswordError(err?.message || "Could not set your password. Please try again.");
    } finally {
      setSettingPassword(false);
    }
  };

  const getRoleDefaultRoute = (role?: string) => {
    switch (role) {
      case "admin":
        return "/dashboard";
      case "qc":
        return "/qc";
      case "production":
        return "/materials";
      case "merchandiser":
      case "customer":
        return "/orders";
      default:
        return "/dashboard";
    }
  };

  // If already logged in, redirect to role's default dashboard — but never while
  // an invite/recovery link is being honored; that must resolve to a password
  // being set first, not a silent auto-login with no password ever configured.
  if (user && !successMsg && !isInviteFlow) {
    navigate({ to: getRoleDefaultRoute(user.role) });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("Please enter a valid email address (e.g. name@company.com).");
      return;
    }

    const rateCheck = rateLimiter.isAllowed(`login:${email.trim().toLowerCase()}`, 5, 10000);
    if (!rateCheck.allowed) {
      setErrorMsg(`Too many login attempts. Please wait ${rateCheck.retryAfterSec} seconds before retrying.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Authenticated successfully! Redirecting...");
        setTimeout(() => {
          navigate({ to: getRoleDefaultRoute(user?.role) });
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setSubmitting(true);
    setErrorMsg("");
    setEmail(demoEmail);
    setPassword("password123");

    const demoUser = DEMO_USERS.find((u) => u.email === demoEmail);
    const role = demoUser ? (demoUser.role as any) : "customer";
    const customerName = role === "customer" ? "Demo Brand" : undefined;

    try {
      let { error } = await signIn(demoEmail, "password123");

      // If user does not exist on Supabase Auth, automatically register them!
      if (error && (
        error.message.toLowerCase().includes("invalid login credentials") ||
        error.message.toLowerCase().includes("does not exist") ||
        error.message.toLowerCase().includes("email not confirmed")
      )) {
        const { error: signUpError } = await signUp(demoEmail, "password123", role, customerName);

        if (signUpError) {
          if (signUpError.message.includes("Email confirmation")) {
            setErrorMsg("Email confirmation is enabled. Please disable 'Confirm email' in your Supabase Auth provider settings to use quick login.");
          } else {
            setErrorMsg(signUpError.message);
          }
          setSubmitting(false);
          return;
        }

        // Retry logging in now that user is registered
        const retry = await signIn(demoEmail, "password123");
        error = retry.error;
      }

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setErrorMsg("Please disable 'Confirm email' in your Supabase Auth provider settings to enable quick login.");
        } else {
          setErrorMsg(error.message);
        }
      } else {
        navigate({ to: getRoleDefaultRoute(role) });
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
          className="absolute top-8 left-8 z-20 flex items-center gap-2 text-xs font-bold text-neutral-700 hover:text-sky-600 bg-neutral-100 hover:bg-sky-50 px-4 py-2 rounded-full border border-neutral-200 transition-all shadow-sm group"
          title="Return to Home Landing Page"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>

        {/* Center Logo */}
        <Link to="/" className="z-10 flex flex-col items-center justify-center gap-4 transform hover:scale-105 transition-all duration-300">
          <img
            src="/SVG_MARK.svg"
            alt="Forge & Fabric Industries, Inc. Logo"
            draggable={false}
            data-no-lens="true"
            data-lens-widget="false"
            data-no-search="true"
            className="w-56 h-56 md:w-64 md:h-64 object-contain drop-shadow-md pointer-events-none select-none"
          />
          <div className="text-center">
            <div className="font-display font-black text-2xl md:text-3xl tracking-tight text-neutral-950">
              FORGE<span className="text-blue-600 font-serif italic font-normal">&amp;</span>FABRIC
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700 mt-1">
              Industries, Inc.
            </div>
          </div>
        </Link>
      </div>

      {/* Main login panel */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-6 lg:px-16 bg-white shadow-xl lg:shadow-none max-w-xl mx-auto lg:max-w-none lg:mx-0 lg:w-7/12">
        <div className="w-full max-w-md space-y-8">
          {isInviteFlow ? (
            <>
              <div className="space-y-1.5">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Set Your Password
                </h1>
                <p className="text-xs text-muted-foreground">
                  Your account has been created. Choose a password to finish setting up your access.
                </p>
              </div>

              {setPasswordError && (
                <div className="bg-error-container text-on-error-container p-3 rounded-lg flex items-start gap-2.5 text-sm border border-error/25">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-error" />
                  <span>{setPasswordError}</span>
                </div>
              )}

              {!user ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2.5 py-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
                  Preparing your account…
                </div>
              ) : (
                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                      New Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        disabled={settingPassword}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        disabled={settingPassword}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                    disabled={settingPassword}
                  >
                    {settingPassword ? "Setting Password..." : "Set Password & Continue"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Access Operations
            </h1>
            <p className="text-xs text-muted-foreground">
              Enter your credentials or select a demo role profile below.
            </p>
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
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
              disabled={submitting}
            >
              {submitting ? "Signing In..." : "Sign In"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="text-center">
            <span className="text-xs text-muted-foreground">
              New team member?{" "}
              <Link to="/signup" className="text-primary font-semibold hover:underline">
                Create Account
              </Link>
            </span>
          </div>

          <div className="border-t border-border pt-6 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-primary" />
              Demo Roles Quick-Access
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {DEMO_USERS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => handleQuickLogin(demo.email)}
                  className="flex items-center justify-between text-left p-3 rounded-lg border border-border bg-background hover:border-primary hover:bg-card transition-all group"
                  disabled={submitting}
                >
                  <div>
                    <span className="text-xs font-bold text-foreground block group-hover:text-primary">
                      {demo.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {demo.desc}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-muted-foreground block">
                      {demo.email}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-primary mt-0.5 inline-block">
                      Click to enter
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
