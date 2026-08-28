import React, { useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Mail, ArrowRight, AlertTriangle, ArrowLeft } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { rateLimiter } from "../../lib/cacheAndRateLimiter";
import gsap from "gsap";

export const OrganicLandscapeAuth: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const bgImageRef = useRef<HTMLDivElement>(null);

  // Subtle interactive morphing offsets
  const [offsets, setOffsets] = useState({
    mx: 0,
    my: 0,
  });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;

    // Smooth background parallax
    if (bgImageRef.current) {
      gsap.to(bgImageRef.current, {
        x: nx * 18,
        y: ny * 12,
        scale: 1.02,
        ease: "power2.out",
        duration: 0.8,
      });
    }

    setOffsets({
      mx: nx * 18,
      my: ny * 14,
    });
  }, []);

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

  if (user && !successMsg) {
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

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-screen min-h-[700px] overflow-hidden flex items-center justify-end bg-neutral-950 font-sans select-none"
    >
      {/* ── 1. Full-Screen Background Artwork ── */}
      <div
        ref={bgImageRef}
        className="absolute inset-0 w-[106%] h-[106%] -left-[3%] -top-[3%] bg-cover bg-left lg:bg-center pointer-events-none transition-transform duration-300"
        style={{
          backgroundImage: `url('/images/atelier_auth_bg.jpg')`,
          filter: "saturate(1.08) contrast(1.04)",
        }}
      />

      {/* Atmospheric Soft Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/25 pointer-events-none" />

      {/* ── 2. Top Navigation: Back to Home ── */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-40 flex items-center gap-2 text-xs font-bold text-neutral-800 hover:text-sky-600 bg-white/90 hover:bg-white px-4 py-2 rounded-full border border-neutral-300/80 backdrop-blur-md transition-all shadow-md hover:shadow-sky-500/20 group"
      >
        <ArrowLeft className="w-4 h-4 text-neutral-700 group-hover:-translate-x-1 transition-transform" />
        <span>Back to Home</span>
      </Link>

      {/* ── 3. Full-Screen SVG Liquid Organic Mask (Exact Reference Silhouette - Smooth Flowing Wave) ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10 hidden lg:block drop-shadow-[-20px_0_40px_rgba(0,0,0,0.28)]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        {/* Main White Organic Liquid Body - Pure Smooth Continuous S-Curve */}
        <path
          d={`
            M ${600 + offsets.mx * 0.4},0
            C ${500 + offsets.mx * 0.3},180 ${640 + offsets.mx * 0.2},380 ${550 + offsets.mx * 0.3},540
            C ${480 + offsets.mx * 0.2},690 ${590 + offsets.mx * 0.4},820 ${630 + offsets.mx * 0.3},900
            L 1440,900
            L 1440,0
            Z
          `}
          fill="#FFFFFF"
          className="transition-all duration-700 ease-out"
        />

        {/* Top-Left Organic Floating Tilted Oval Droplet (Reference Island 1) */}
        <g transform={`translate(${offsets.mx * 0.6}, ${offsets.my * 0.4})`}>
          <ellipse
            cx="440"
            cy="170"
            rx="36"
            ry="68"
            transform="rotate(-22 440 170)"
            fill="#FFFFFF"
            className="transition-all duration-500 ease-out"
          />
        </g>

        {/* Bottom-Left Floating Droplet A (Horizontal Bean Island) (Reference Island 2) */}
        <g transform={`translate(${offsets.mx * 0.5}, ${offsets.my * 0.5})`}>
          <ellipse
            cx="490"
            cy="735"
            rx="42"
            ry="28"
            transform="rotate(14 490 735)"
            fill="#FFFFFF"
            className="transition-all duration-500 ease-out"
          />
        </g>

        {/* Bottom-Left Floating Droplet B (Sub-Droplet Island) (Reference Island 3) */}
        <g transform={`translate(${offsets.mx * 0.4}, ${offsets.my * 0.6})`}>
          <ellipse
            cx="460"
            cy="795"
            rx="18"
            ry="32"
            transform="rotate(-16 460 795)"
            fill="#FFFFFF"
            className="transition-all duration-500 ease-out"
          />
        </g>

        {/* Top-Right Organic Dark Background Hole (Reference Corner 1) */}
        <path
          d="
            M 1200,0
            C 1170,80 1230,220 1350,240
            C 1410,250 1440,200 1440,160
            L 1440,0
            Z
          "
          fill="#1E1235"
          opacity="0.95"
          className="transition-all duration-500 ease-out"
        />

        {/* Bottom-Right Organic Dark Background Hole (Reference Corner 2) */}
        <path
          d="
            M 1440,680
            C 1380,700 1300,770 1320,860
            C 1340,930 1390,980 1440,1000
            Z
          "
          fill="#2B1442"
          opacity="0.95"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* ── 4. Form Content Container (Inside the Liquid White Mask) ── */}
      <div className="relative z-20 w-full lg:w-[50%] xl:w-[46%] h-full flex items-center justify-center p-6 sm:p-10 lg:pr-16 bg-white lg:bg-transparent shadow-2xl lg:shadow-none">
        <div className="w-full max-w-sm space-y-6">
          
          {/* Logo & Company Name */}
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <Link to="/" className="group flex flex-col items-center gap-2">
              <img
                src="/SVG_MARK.svg"
                alt="Forge & Fabric Logo"
                draggable={false}
                className="w-18 h-18 sm:w-20 sm:h-20 object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300 pointer-events-none"
              />
              <div>
                <div className="font-display font-black text-2xl tracking-tight text-neutral-900">
                  FORGE<span className="text-sky-600 font-serif italic font-normal px-0.5">&amp;</span>FABRIC
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-sky-700 mt-0.5">
                  Industries, Inc.
                </div>
              </div>
            </Link>
          </div>

          {/* Auth Header */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">
              Access Operations
            </h2>
            <p className="text-xs text-neutral-500">
              Enter your credentials to access the production management portal.
            </p>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl flex items-center gap-2 text-xs border border-emerald-500/30 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 text-rose-800 p-3 rounded-xl flex items-start gap-2 text-xs border border-rose-200 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@forgefabric.com"
                  className="w-full pl-10 pr-3.5 h-11 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600 transition-all text-neutral-900 font-medium"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 h-11 rounded-xl border border-neutral-200 bg-neutral-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600 transition-all text-neutral-900 font-medium"
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/20 mt-2"
              disabled={submitting}
            >
              {submitting ? "Authenticating..." : "Sign In"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
