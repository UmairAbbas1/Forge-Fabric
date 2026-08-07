import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { 
  Scissors, 
  Search, 
  RefreshCw, 
  ArrowRight, 
  Phone, 
  Mail, 
  X 
} from 'lucide-react';

export const ApplyHeader: React.FC = () => {
  const navigate = useNavigate();
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lookupCode.trim()) {
      setShowLookupModal(false);
      navigate({
        to: '/apply/status/$referenceCode',
        params: { referenceCode: lookupCode.trim().toUpperCase() },
        search: lookupEmail ? { email: lookupEmail.trim() } : undefined,
      });
    }
  };

  return (
    <>
      {/* Clean Light Top Notice Bar (No dark background) */}
      <div className="bg-neutral-50 text-neutral-600 text-xs py-2 px-4 md:px-8 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-neutral-800">Forge &amp; Fabric Client Intake Portal</span>
            <span className="hidden md:inline text-neutral-300">|</span>
            <span className="hidden md:inline text-neutral-500">Petaluma CMT Production &amp; Bay Area Sewing</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-600 font-medium">
            <a href="tel:+17075550192" className="hidden sm:flex items-center gap-1.5 hover:text-amber-700 transition-colors">
              <Phone className="w-3 h-3 text-neutral-400" />
              <span>(707) 555-0192</span>
            </a>
            <a href="mailto:intake@forgefabric.com" className="flex items-center gap-1.5 hover:text-amber-700 transition-colors">
              <Mail className="w-3 h-3 text-neutral-400" />
              <span>intake@forgefabric.com</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Clean White Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-18 flex items-center justify-between">
          
          {/* Brand Logo & Name (Clean white background for logo) */}
          <Link to="/apply" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center p-1 shadow-xs group-hover:border-amber-400 transition-all">
              <img 
                src="/SVG_MARK.svg" 
                alt="Forge & Fabric Logo" 
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <span className="font-display text-2xl font-bold tracking-tight text-neutral-900 block leading-tight">
                Forge &amp; Fabric
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                Garment Production &amp; CMT Intake
              </span>
            </div>
          </Link>

          {/* Quick Action Navigation */}
          <div className="flex items-center gap-3">
            {/* Status Lookup Button */}
            <button
              type="button"
              onClick={() => setShowLookupModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Track Submission</span>
              <span className="sm:hidden">Track</span>
            </button>

            {/* Request Update */}
            <Link
              to="/apply/update"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden md:inline">Request Update</span>
            </Link>

            {/* New Application CTA */}
            <Link
              to="/apply/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <span>Start Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Track Submission Modal */}
      {showLookupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-700">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-neutral-900">Track Order Submission</h3>
                  <p className="text-xs text-neutral-500">Enter your Reference Code (APP-YYYY-XXXX)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowLookupModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLookupSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                  Application Reference Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. APP-2026-8842"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                  Contact Email (Verification)
                </label>
                <input
                  type="email"
                  placeholder="contact@brand.com"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLookupModal(false)}
                  className="flex-1 h-11 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-lg bg-amber-700 hover:bg-amber-800 text-xs font-bold text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Lookup Status</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
