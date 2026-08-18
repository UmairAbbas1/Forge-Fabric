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
      <div className="bg-white border border-neutral-200/90 rounded-3xl p-8 md:p-12 shadow-sm text-center">
        
        {/* Animated Badge */}
        <div className="h-20 w-20 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-xs">
          <CheckCircle2 className="w-10 h-10 stroke-[2.25]" />
        </div>

        <h1 className="text-2xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">
          Application Received Successfully
        </h1>
        <p className="text-sm md:text-base text-neutral-600 max-w-xl mx-auto mt-2">
          Your production intake file has been transferred to the Forge &amp; Fabric Industries, Inc. merchandising desk. A confirmation receipt has been dispatched to <strong className="text-neutral-900">{email}</strong>.
        </p>

        {/* Reference Code Callout */}
        <div className="my-8 p-6 bg-amber-50/50 rounded-2xl border-2 border-dashed border-amber-300 max-w-md mx-auto">
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 block mb-1">
            Application Reference Code
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-2xl md:text-3xl font-black text-amber-900 tracking-wider">
              {referenceCode}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 shadow-2xs cursor-pointer transition-all"
              title="Copy Reference Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            Save this code to track order status or submit change requests.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/orders"
            className="h-12 px-6 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>Go to Customer Dashboard</span>
          </Link>

          <Link
            to="/apply/status/$referenceCode"
            params={{ referenceCode }}
            search={{ email: email !== 'your registered email' ? email : undefined }}
            className="h-12 px-5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-bold text-xs shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <Search className="w-4 h-4 text-amber-700" />
            <span>Track Order Status</span>
          </Link>

          <Link
            to="/apply/update"
            className="h-12 px-5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <RefreshCw className="w-4 h-4 text-neutral-500" />
            <span>Request Revision</span>
          </Link>

          <Link
            to="/apply/new"
            className="h-12 px-5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <PlusCircle className="w-4 h-4 text-neutral-500" />
            <span>Start Another Order</span>
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
