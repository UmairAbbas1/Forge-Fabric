import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Inbox,
  PlusCircle,
  Clock,
  AlertTriangle,
  FileCheck2,
  Filter,
  Sparkles,
  Save,
  ArrowRight,
} from "lucide-react";
import type { ApplySubmission } from "../../lib/types";
import { useSubmissions } from "../../hooks/merchandiser/useSubmissions";
import { SubmissionFilters } from "./SubmissionFilters";
import { SubmissionTable } from "./SubmissionTable";
import { SubmissionDetailPanel } from "./SubmissionDetailPanel";
import { ConversionModal } from "./ConversionModal";
import { SampleRequestsDashboard } from "./SampleRequestsDashboard";
import { scanSavedDrafts, type SavedDraftSummary } from "../../contexts/ApplyWizardContext";

export function SubmissionsDashboard() {
  const { submissions, filters, setFilters, agingStats, isLoading } = useSubmissions();

  const [selectedSub, setSelectedSub] = useState<ApplySubmission | null>(null);
  const [conversionSub, setConversionSub] = useState<ApplySubmission | null>(null);
  const [activeTab, setActiveTab] = useState<"applications" | "samples">("applications");

  // Deliberate "resume a saved internal intake" entry point — mirrors the
  // one on orders.tsx (customer dashboard) for the /apply-intake flow.
  const [savedDrafts, setSavedDrafts] = useState<SavedDraftSummary[]>([]);
  useEffect(() => {
    setSavedDrafts(scanSavedDrafts());
  }, []);

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
            Review public brand submissions, inspect cut sheet specs, and atomically convert
            approved orders into production POs.
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

      {savedDrafts.length > 0 && (
        <div className="rounded-2xl p-4 border border-amber-300/60 bg-amber-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <Save className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                {savedDrafts.length === 1 ? "You Have a Saved Intake Draft" : `You Have ${savedDrafts.length} Saved Intake Drafts`}
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {savedDrafts[0].companyName || "In progress"} · Step {savedDrafts[0].step || 1} of 5
                {savedDrafts[0].lastSavedAt ? ` · Saved ${new Date(savedDrafts[0].lastSavedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : ""}
              </p>
            </div>
          </div>
          <Link
            to="/apply-intake"
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition-all"
          >
            <span>Resume Intake</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        <button
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "applications"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
          }`}
          onClick={() => setActiveTab("applications")}
        >
          Order Applications
        </button>
        <button
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "samples"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
          }`}
          onClick={() => setActiveTab("samples")}
        >
          Sample Requests
        </button>
      </div>

      {activeTab === "applications" ? (
        <>
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-neutral-500 block">
                  Total Inbound
                </span>
                <span className="text-xl font-bold text-neutral-900">{agingStats.total}</span>
              </div>
              <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-600">
                <Inbox className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-neutral-500 block">
                  Pending Review
                </span>
                <span className="text-xl font-bold text-amber-600">{agingStats.pendingReview}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-amber-700 block">
                  &gt;24h Aging
                </span>
                <span className="text-xl font-bold text-amber-700">{agingStats.over24h}</span>
              </div>
              <div className="p-2.5 bg-amber-100/70 rounded-xl text-amber-800">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-rose-200 shadow-xs flex items-center justify-between bg-rose-50/20">
              <div>
                <span className="text-[11px] font-semibold text-rose-700 block">
                  &gt;48h Critical SLA
                </span>
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
        </>
      ) : (
        <SampleRequestsDashboard />
      )}
    </div>
  );
}
