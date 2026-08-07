import { createFileRoute, Link } from '@tanstack/react-router';
import { ApplyLayout } from '../components/apply-portal/ApplyLayout';
import { 
  Scissors, 
  Search, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle2, 
  FileSpreadsheet, 
  ShieldCheck, 
  Clock, 
  Factory
} from 'lucide-react';

export const Route = createFileRoute('/apply/')({
  component: ApplyIndexPage,
});

function ApplyIndexPage() {
  return (
    <ApplyLayout title="Client Self-Service Intake Portal">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20 space-y-16">
        
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">

          <h1 className="text-3xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
            Garment Production Intake &amp; Order Management
          </h1>

          <p className="text-sm md:text-base text-neutral-600 leading-relaxed max-w-2xl mx-auto">
            Self-service intake for garment brands and designers. Submit Blanket POs, customize multi-fabric cut sheets, upload tech packs, and track factory floor status.
          </p>
        </div>

        {/* 3 Main Portals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Start New Application */}
          <div className="bg-white rounded-3xl p-8 border-2 border-blue-500 shadow-md hover:shadow-xl hover:border-blue-600 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-neutral-900">
                Start New Order Application
              </h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Submit Blanket PO terms, interactive size matrices, Excel cut tickets, and attach technical tech packs.
              </p>
              <ul className="space-y-2.5 text-sm text-neutral-700 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>5-Step guided wizard</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Excel import &amp; live spread math</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Auto-saved draft recovery</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                to="/apply/new"
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <span>Start Order Now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Track Status */}
          <div className="bg-white rounded-3xl p-8 border-2 border-blue-500 shadow-md hover:shadow-xl hover:border-blue-600 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-neutral-900">
                Track Order Status
              </h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Monitor real-time progress of submitted intake files, merchandiser reviews, and Blanket PO conversion status.
              </p>
              <ul className="space-y-2.5 text-sm text-neutral-700 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                  <span>Instant lookup via reference code</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                  <span>Live Supabase Realtime updates</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                  <span>Merchandiser review feedback</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                to="/apply/status/$referenceCode"
                params={{ referenceCode: 'lookup' }}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Lookup Submission</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 3: Submit Update Request */}
          <div className="bg-white rounded-3xl p-8 border-2 border-blue-500 shadow-md hover:shadow-xl hover:border-blue-600 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-neutral-900">
                Request Order Revision
              </h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Modify sizing breakdown, update wash formulations, adjust target delivery dates, or upload revised tech packs.
              </p>
              <ul className="space-y-2.5 text-sm text-neutral-700 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                  <span>Attach updated artwork or specs</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                  <span>Floor stop / rush priority flagging</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                  <span>Direct merchandiser ticket routing</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                to="/apply/update"
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Submit Revision</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

        </div>

        {/* Factory Standards & Guarantees */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-3xl p-8 md:p-12 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>24-Hour Review Turnaround</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Dedicated merchandisers review fabric balances and issue official Blanket PO numbers within one business day.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Full Excel Compatibility</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Import and export industry-standard Weissmade, Factory One, and SAME sample spreadsheets seamlessly.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Bay Area CMT Excellence</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Every unit cut, sewn, and ozone-washed in our Northern California facility with 100% carton QC tracking.
              </p>
            </div>
          </div>
        </div>

      </div>
    </ApplyLayout>
  );
}
