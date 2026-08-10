import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Inbox,
  PlusCircle,
  Clock,
  AlertTriangle,
  FileCheck2,
  Filter,
  Sparkles,
} from "lucide-react";
import type { ApplySubmission } from "../../lib/types";
import { useSubmissions } from "../../hooks/merchandiser/useSubmissions";
import { SubmissionFilters } from "./SubmissionFilters";
import { SubmissionTable } from "./SubmissionTable";
import { SubmissionDetailPanel } from "./SubmissionDetailPanel";
import { ConversionModal } from "./ConversionModal";

export function SubmissionsDashboard() {
  const {
    submissions,
    filters,
    setFilters,
    agingStats,
    isLoading,
  } = useSubmissions();

  const [selectedSub, setSelectedSub] = useState<ApplySubmission | null>(null);
  const [conversionSub, setConversionSub] = useState<ApplySubmission | null>(null);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Intake Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-amber-600" />
            Order Applications & Merchandiser Intake
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Review public brand submissions, inspect cut sheet specs, and atomically convert approved orders into production POs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/apply-intake"
            className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-bold hover:bg-sky-600 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Internal Order Intake
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-neutral-500 block">Total Inbound</span>
            <span className="text-xl font-bold text-neutral-900">{agingStats.total}</span>
          </div>
          <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-600">
            <Inbox className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-neutral-500 block">Pending Review</span>
            <span className="text-xl font-bold text-amber-600">{agingStats.pendingReview}</span>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-700 block">&gt;24h Aging</span>
            <span className="text-xl font-bold text-amber-700">{agingStats.over24h}</span>
          </div>
          <div className="p-2.5 bg-amber-100/70 rounded-xl text-amber-800">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-rose-200 shadow-xs flex items-center justify-between bg-rose-50/20">
          <div>
            <span className="text-[11px] font-semibold text-rose-700 block">&gt;48h Critical SLA</span>
            <span className="text-xl font-bold text-rose-600">{agingStats.over48h}</span>
          </div>
          <div className="p-2.5 bg-rose-100 rounded-xl text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Layout: Filters + Table + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* Left Column: Filter Sidebar */}
        <div className="lg:col-span-1">
          <SubmissionFilters
            filters={filters}
            onFilterChange={setFilters}
            agingStats={agingStats}
          />
        </div>

        {/* Middle/Right Column: Submissions Table & Drawer */}
        <div className={`space-y-4 ${selectedSub ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <SubmissionTable
            submissions={submissions}
            selectedSubmissionId={selectedSub?.id || null}
            onSelectSubmission={(sub) => setSelectedSub(sub)}
            onQuickConvert={(sub) => setConversionSub(sub)}
          />
        </div>

        {/* Right Drawer: Selected Detail */}
        {selectedSub && (
          <div className="lg:col-span-1">
            <SubmissionDetailPanel
              submission={selectedSub}
              onClose={() => setSelectedSub(null)}
            />
          </div>
        )}
      </div>

      {/* Conversion Modal Trigger */}
      {conversionSub && (
        <ConversionModal
          submission={conversionSub}
          isOpen={!!conversionSub}
          onClose={() => setConversionSub(null)}
        />
      )}
    </div>
  );
}
