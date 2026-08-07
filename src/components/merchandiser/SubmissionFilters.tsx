import { Filter, Search, RotateCcw } from "lucide-react";
import type { SubmissionFiltersState } from "../../hooks/merchandiser/useSubmissions";

interface SubmissionFiltersProps {
  filters: SubmissionFiltersState;
  onFilterChange: (newFilters: SubmissionFiltersState) => void;
  agingStats: { over24h: number; over48h: number; unassigned: number; pendingReview: number; total: number };
}

export function SubmissionFilters({ filters, onFilterChange, agingStats }: SubmissionFiltersProps) {
  const handleReset = () => {
    onFilterChange({
      status: "all",
      type: "all",
      source: "all",
      assignedTo: "all",
      priority: "all",
      search: "",
      dateRange: "all",
    });
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-neutral-900 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-amber-600" />
          Filter Applications
        </h3>
        <button
          onClick={handleReset}
          className="text-neutral-400 hover:text-neutral-700 flex items-center gap-1 hover:underline"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          placeholder="Search brand, email, ref..."
          className="w-full pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </div>

      {/* Status Badges Filter */}
      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5">Status:</label>
        <div className="flex flex-wrap gap-1">
          {["all", "pending_review", "under_review", "needs_info", "converted", "rejected"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onFilterChange({ ...filters, status: st as any })}
              className={`px-2 py-1 rounded-md capitalize font-medium transition-colors ${
                filters.status === st
                  ? "bg-amber-600 text-white font-bold"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Source Filter */}
      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5">Source:</label>
        <div className="flex gap-1">
          {[
            { id: "all", label: "All" },
            { id: "apply_portal", label: "Client Portal" },
            { id: "merchandiser_intake", label: "Direct Intake" },
          ].map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => onFilterChange({ ...filters, source: src.id as any })}
              className={`px-2 py-1 rounded-md font-medium transition-colors ${
                filters.source === src.id
                  ? "bg-neutral-900 text-white font-bold"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Aging Filter Tags (Fix #15) */}
      <div className="pt-2 border-t border-neutral-100 space-y-1.5">
        <label className="block text-[11px] font-bold text-neutral-700">Aging Review Alerts:</label>
        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/80 border border-amber-200/70">
          <span className="font-semibold text-amber-900">&gt;24 Hours Pending</span>
          <span className="px-2 py-0.5 font-bold text-white bg-amber-600 rounded-full text-[10px]">
            {agingStats.over24h}
          </span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/80 border border-rose-200/70">
          <span className="font-semibold text-rose-900">&gt;48 Hours Critical</span>
          <span className="px-2 py-0.5 font-bold text-white bg-rose-600 rounded-full text-[10px]">
            {agingStats.over48h}
          </span>
        </div>
      </div>
    </div>
  );
}
