import { useState } from "react";
import {
  LayoutGrid,
  List,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderGit2,
  XCircle,
} from "lucide-react";
import type { UpdateRequest, UpdateRequestStatus } from "../../lib/types";
import { useUpdateRequests } from "../../hooks/merchandiser/useUpdateRequests";
import { UpdateRequestCard } from "./UpdateRequestCard";
import { UpdateRequestDetail } from "./UpdateRequestDetail";

export function UpdateRequestBoard({ orderId }: { orderId?: string }) {
  const {
    requests,
    isLoading,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    searchQuery,
    setSearchQuery,
    updateStatus,
  } = useUpdateRequests(orderId);

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [selectedRequest, setSelectedRequest] = useState<UpdateRequest | null>(null);

  const columns: { status: UpdateRequestStatus; label: string; icon: any; color: string }[] = [
    { status: "submitted", label: "Submitted", icon: Clock, color: "text-neutral-600 bg-neutral-100" },
    { status: "under_review", label: "Under Review", icon: AlertCircle, color: "text-sky-600 bg-sky-50" },
    { status: "in_progress", label: "In Progress", icon: FolderGit2, color: "text-indigo-600 bg-indigo-50" },
    { status: "completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    { status: "rejected", label: "Rejected / Closed", icon: XCircle, color: "text-neutral-600 bg-neutral-100" },
  ];

  return (
    <div className="space-y-4">
      {/* Top Filter & View Mode Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search request subject, email, description..."
              className="w-full pl-9 pr-3 py-1.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="p-1.5 border border-neutral-200 rounded-lg font-medium text-neutral-700 bg-neutral-50"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200">
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
              viewMode === "kanban" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
              viewMode === "list" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <List className="w-3.5 h-3.5" /> Table List
          </button>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start">
          {columns.map((col) => {
            const colRequests = requests.filter((r) =>
              col.status === "rejected"
                ? r.status === "rejected" || r.status === "closed"
                : r.status === col.status
            );
            const Icon = col.icon;

            return (
              <div
                key={col.status}
                className="bg-neutral-50/70 border border-neutral-200/80 rounded-2xl p-3 space-y-3 min-h-[420px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                  <div className="flex items-center gap-1.5">
                    <span className={`p-1 rounded-md ${col.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="font-bold text-xs text-neutral-800">{col.label}</h3>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-neutral-200/70 text-neutral-700 rounded-full">
                    {colRequests.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colRequests.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-neutral-400">
                      No requests
                    </div>
                  ) : (
                    colRequests.map((req) => (
                      <UpdateRequestCard
                        key={req.id}
                        request={req}
                        onClick={() => setSelectedRequest(req)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Requested By</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {requests.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedRequest(r)}
                  className="hover:bg-neutral-50 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-mono font-bold text-neutral-700">{r.request_type}</td>
                  <td className="p-3 font-medium text-neutral-900">{r.request_subject}</td>
                  <td className="p-3 text-neutral-600">{r.requested_by_email}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        r.priority === "urgent"
                          ? "bg-rose-100 text-rose-800"
                          : r.priority === "high"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {r.priority}
                    </span>
                  </td>
                  <td className="p-3 capitalize font-semibold">{r.status.replace("_", " ")}</td>
                  <td className="p-3 text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <UpdateRequestDetail
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRespond={updateStatus}
        />
      )}
    </div>
  );
}
