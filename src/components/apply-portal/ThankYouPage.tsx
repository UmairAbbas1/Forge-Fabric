import React, { useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Search, 
  RefreshCw, 
  PlusCircle, 
  Clock, 
  Building2, 
  ShieldCheck, 
  Mail,
  ArrowRight
} from 'lucide-react';

interface ThankYouPageProps {
  referenceCode?: string;
  email?: string;
}

export const ThankYouPage: React.FC<ThankYouPageProps> = ({ referenceCode: propRef, email: propEmail }) => {
  const searchParams = useSearch({ strict: false }) as { referenceCode?: string; email?: string };
  const referenceCode = propRef || searchParams?.referenceCode || 'APP-2026-8842';
  const email = propEmail || searchParams?.email || 'your registered email';

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referenceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      
      {/* Hero Success Card */}
      <div className="glass-surface rounded-3xl p-8 md:p-12 border border-white/80 dark:border-white/[0.08] shadow-xs text-center space-y-4">
        
        {/* Animated Badge */}
        <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 stroke-[2.25]" />
        </div>

        <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
          Application Received Successfully
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Your production intake file has been transferred to the Forge &amp; Fabric Industries, Inc. merchandising desk. A confirmation receipt has been dispatched to <strong className="text-foreground">{email}</strong>.
        </p>

        {/* Reference Code Callout */}
        <div className="my-6 p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] max-w-md mx-auto">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
            Application Reference Code
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-2xl md:text-3xl font-bold text-[#0071E3] tracking-wider">
              {referenceCode}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-xl bg-white dark:bg-[#1A2030] border border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-foreground shadow-2xs cursor-pointer transition-all"
              title="Copy Reference Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Save this code to track order status or submit change requests.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/orders"
            className="h-11 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-xs shadow-md shadow-[#0071E3]/20 flex items-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <Building2 className="w-4 h-4" />
            <span>Go to Customer Dashboard</span>
          </Link>

          <Link
            to="/submissions"
            className="h-11 px-5 rounded-xl bg-white/90 dark:bg-[#1A2030] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-foreground font-semibold text-xs shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <span>Submissions Inbox</span>
            <ArrowRight className="w-4 h-4 text-[#0071E3]" />
          </Link>

          <Link
            to="/apply/status/$referenceCode"
            params={{ referenceCode }}
            search={{ email: email !== 'your registered email' ? email : undefined }}
            className="h-11 px-5 rounded-xl bg-white/90 dark:bg-[#1A2030] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-foreground font-semibold text-xs shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <Search className="w-4 h-4 text-[#0071E3]" />
            <span>Track Order Status</span>
          </Link>
        </div>

      </div>

      {/* Production Milestone Journey */}
      <div className="mt-12 bg-white border border-neutral-200/90 rounded-3xl p-8 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-700" />
          <span>What Happens Next (Production Intake Roadmap)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
              Stage 1 (Underway)
            </span>
            <h4 className="font-bold text-xs text-neutral-900">Intake &amp; Tech Audit</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Our lead merchandiser verifies fabric roll widths, spread yields, and trim availability within 24 hours.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-800">
              Stage 2
            </span>
            <h4 className="font-bold text-xs text-neutral-900">Blanket PO Issued</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Official Blanket PO &amp; Work Orders are initialized in the manufacturing ledger with schedule locks.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-800">
              Stage 3
            </span>
            <h4 className="font-bold text-xs text-neutral-900">Fabric &amp; Cut Ticket</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Raw yardage is inspected, tagged to rolls, and released to the automated spreading and cutting lines.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-800">
              Stage 4
            </span>
            <h4 className="font-bold text-xs text-neutral-900">Sewing &amp; Laundry</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              CMT garment assembly, ozone/stone wash finishing, final QC inspection, and carton dispatch to Petaluma.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
