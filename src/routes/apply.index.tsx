import { createFileRoute, Link } from '@tanstack/react-router';
import { ApplyLayout } from '../components/apply-portal/ApplyLayout';
import { 
  Scissors, 
  Search, 
  RefreshCw, 
  ArrowRight, 
  Clock, 
  FileSpreadsheet, 
  ShieldCheck 
} from 'lucide-react';

export const Route = createFileRoute('/apply/')({
  head: () => ({
    meta: [
      { title: 'Order Intake · Forge & Fabric Industries, Inc.' },
      { name: 'description', content: 'Client intake for garment production and technical specifications.' },
    ],
  }),
  component: ApplyIndexPage,
});

function ApplyIndexPage() {
  return (
    <ApplyLayout title="Order Intake">
      <div className="max-w-4xl mx-auto space-y-8 py-2">
        
        {/* Minimalist Apple Header */}
        <div className="text-center space-y-2 max-w-2xl mx-auto pt-2">
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground tracking-tight">
            Order Intake &amp; Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Initiate bulk production orders, track development samples, or request specification changes.
          </p>
        </div>

        {/* 3 Minimalist visionOS Frosted Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1: Start Order */}
          <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md hover:border-[#0071E3]/40 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  New Order
                </h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Submit purchase orders, size matrices, and tech pack specifications.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Link
                to="/apply/new"
                className="w-full h-10 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <span>Start Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Track Status */}
          <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md hover:border-[#0071E3]/40 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-black/[0.04] dark:bg-white/10 text-foreground flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  Track Submission
                </h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Look up intake status, review feedback, and Blanket PO conversion.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Link
                to="/apply/status/$referenceCode"
                params={{ referenceCode: 'lookup' }}
                className="w-full h-10 rounded-xl bg-white/90 dark:bg-[#1A2030] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-foreground font-semibold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Track Order</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>

          {/* Card 3: Request Revision */}
          <div className="glass-surface rounded-3xl p-6 border border-white/80 dark:border-white/[0.08] shadow-xs hover:shadow-md hover:border-[#0071E3]/40 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-black/[0.04] dark:bg-white/10 text-foreground flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  Request Revision
                </h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Modify size ratios, wash formulations, or upload revised artwork.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Link
                to="/apply/update"
                className="w-full h-10 rounded-xl bg-white/90 dark:bg-[#1A2030] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-foreground font-semibold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Revision</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>

        </div>

        {/* Minimalist 3-Pill Capability Bar */}
        <div className="glass-surface rounded-2xl p-4 border border-white/80 dark:border-white/[0.08] shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground text-center">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-[#0071E3] shrink-0" />
              <span className="font-semibold text-foreground">24-Hour Review Turnaround</span>
            </div>
            <div className="flex items-center justify-center gap-2 border-y sm:border-y-0 sm:border-x border-black/[0.06] dark:border-white/[0.08] py-2 sm:py-0">
              <FileSpreadsheet className="w-4 h-4 text-[#0071E3] shrink-0" />
              <span className="font-semibold text-foreground">Excel &amp; Cut Sheet Import</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0071E3] shrink-0" />
              <span className="font-semibold text-foreground">Bay Area CMT Production</span>
            </div>
          </div>
        </div>

      </div>
    </ApplyLayout>
  );
}
