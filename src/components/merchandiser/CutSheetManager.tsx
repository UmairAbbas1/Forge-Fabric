import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Save,
  CheckCircle2,
  XCircle,
  History,
  GitCompare,
  MessageSquare,
  Highlighter,
  Lock,
  Plus,
  Trash2,
  Calculator,
  Download,
} from "lucide-react";
import type {
  ApplyCutSheet,
  CutSheetComponent,
  CutSheetComment,
  CutSheetFormatting,
  CutSheetApprovalStatus,
} from "../../lib/types";
import { useCutSheetVersions } from "../../hooks/merchandiser/useCutSheetVersions";
import { VersionHistoryModal } from "./VersionHistory";
import { VersionDiffModal } from "./VersionDiff";

interface CutSheetManagerProps {
  cutSheet: ApplyCutSheet;
  onSave?: (updatedCutSheet: ApplyCutSheet) => void;
  isReadOnly?: boolean;
}

// Simple internal formula engine (Fix #12)
export function evaluateFormula(formula: string, values: number[]): number {
  const clean = formula.trim().toUpperCase();
  if (clean.startsWith("=SUM") || clean.startsWith("=TOTAL")) {
    return values.reduce((a, b) => a + (Number(b) || 0), 0);
  }
  if (clean.startsWith("=AVG") || clean.startsWith("=AVERAGE")) {
    return values.length ? values.reduce((a, b) => a + (Number(b) || 0), 0) / values.length : 0;
  }
  if (clean.startsWith("=COUNT")) {
    return values.filter((v) => v > 0).length;
  }
  return Number(formula) || 0;
}

export function CutSheetManager({
  cutSheet: initialCutSheet,
  onSave,
  isReadOnly = false,
}: CutSheetManagerProps) {
  const [cutSheet, setCutSheet] = useState<ApplyCutSheet>(initialCutSheet);
  const [activeCellComment, setActiveCellComment] = useState<{ cellKey: string; comment: string } | null>(null);
  const [comments, setComments] = useState<CutSheetComment[]>(initialCutSheet.comments || []);
  const [formatting, setFormatting] = useState<CutSheetFormatting>(initialCutSheet.formatting || {});
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<"yellow" | "green" | "red" | null>(null);

  // Versioning state
  const {
    versions,
    createNewVersion,
    setApprovalStatus,
  } = useCutSheetVersions(initialCutSheet.id);

  const [showHistory, setShowHistory] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const currentComp = cutSheet.sheet_data?.components?.[0] || {
    component_name: "SELF",
    fabric_code: "DNM-135",
    size_columns: ["28", "30", "32", "34", "36", "38"],
    size_matrix: { "28": 20, "30": 40, "32": 80, "34": 50, "36": 30, "38": 15 },
    total_units: 235,
    plies: 40,
    estimated_yield: 2.3,
  };

  const isLocked = cutSheet.approval_status === "approved" || isReadOnly;

  // Handle cell value edits
  const handleSizeQtyChange = (size: string, value: string) => {
    if (isLocked) return;
    const num = parseInt(value, 10) || 0;
    const newMatrix = { ...(currentComp.size_matrix || {}), [size]: num };
    const newTotal = Object.values(newMatrix).reduce((a, b) => a + (Number(b) || 0), 0);

    const updatedComp: CutSheetComponent = {
      ...currentComp,
      size_matrix: newMatrix,
      total_units: newTotal,
    };

    setCutSheet((prev) => ({
      ...prev,
      sheet_data: {
        ...prev.sheet_data,
        grand_total: newTotal,
        components: [updatedComp, ...(prev.sheet_data?.components?.slice(1) || [])],
      },
    }));
  };

  // Cell highlighting handler
  const handleCellClick = (cellKey: string) => {
    if (isLocked) return;
    if (selectedHighlightColor) {
      setFormatting((prev) => ({
        ...prev,
        highlighted_cells: {
          ...(prev.highlighted_cells || {}),
          [cellKey]: selectedHighlightColor,
        },
      }));
    }
  };

  // Add cell comment
  const handleAddComment = () => {
    if (!activeCellComment || !activeCellComment.comment.trim()) return;
    const newComment: CutSheetComment = {
      id: `comm-${Date.now()}`,
      cell_key: activeCellComment.cellKey,
      author: "Merchandiser",
      text: activeCellComment.comment.trim(),
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, newComment]);
    setActiveCellComment(null);
  };

  // Save changes & snapshot new version
  const handleSaveChanges = async () => {
    const updatedSheet: ApplyCutSheet = {
      ...cutSheet,
      comments,
      formatting,
      updated_at: new Date().toISOString(),
    };

    await createNewVersion({
      summary: `Manual revision saved (Total: ${cutSheet.sheet_data?.grand_total || 0} pcs)`,
      snapshot: cutSheet.sheet_data,
    });

    if (onSave) onSave(updatedSheet);
  };

  // Status transitions
  const handleApprove = async () => {
    await setApprovalStatus({
      versionId: versions[0]?.id || `ver-${cutSheet.id}`,
      status: "approved",
      approvedBy: "Lead Merchandiser",
    });
    setCutSheet((prev) => ({ ...prev, approval_status: "approved" }));
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    await setApprovalStatus({
      versionId: versions[0]?.id || `ver-${cutSheet.id}`,
      status: "rejected",
      reason: rejectionReason,
    });
    setCutSheet((prev) => ({ ...prev, approval_status: "rejected", rejection_reason: rejectionReason }));
    setRejectionModalOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm space-y-4">
      {/* Top Toolbar */}
      <div className="p-4 bg-neutral-50/80 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100/80 rounded-xl text-amber-800">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-neutral-900 text-sm">{cutSheet.style_no || "Cut Sheet"}</h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-200 text-neutral-800 rounded">
                v{cutSheet.version || "1.0"}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                  cutSheet.approval_status === "approved"
                    ? "bg-emerald-100 text-emerald-800"
                    : cutSheet.approval_status === "rejected"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {cutSheet.approval_status || "submitted"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">{cutSheet.style_description || "Standard Factory Cut Ticket"}</p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Highlight Color Pickers */}
          {!isLocked && (
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-200">
              <Highlighter className="w-3.5 h-3.5 text-neutral-400 ml-1" />
              <button
                type="button"
                onClick={() => setSelectedHighlightColor(selectedHighlightColor === "yellow" ? null : "yellow")}
                className={`w-4 h-4 rounded bg-amber-300 border ${selectedHighlightColor === "yellow" ? "ring-2 ring-amber-500" : ""}`}
                title="Highlight Yellow (Attention)"
              />
              <button
                type="button"
                onClick={() => setSelectedHighlightColor(selectedHighlightColor === "green" ? null : "green")}
                className={`w-4 h-4 rounded bg-emerald-400 border ${selectedHighlightColor === "green" ? "ring-2 ring-emerald-500" : ""}`}
                title="Highlight Green (Verified)"
              />
              <button
                type="button"
                onClick={() => setSelectedHighlightColor(selectedHighlightColor === "red" ? null : "red")}
                className={`w-4 h-4 rounded bg-rose-400 border ${selectedHighlightColor === "red" ? "ring-2 ring-rose-500" : ""}`}
                title="Highlight Red (Issue)"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 font-medium text-neutral-700 flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" /> History ({versions.length})
          </button>

          <button
            type="button"
            onClick={() => setShowDiff(true)}
            className="px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 font-medium text-neutral-700 flex items-center gap-1"
          >
            <GitCompare className="w-3.5 h-3.5" /> Diff
          </button>

          {!isLocked && (
            <button
              type="button"
              onClick={handleSaveChanges}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold flex items-center gap-1 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          )}

          {/* Approval Buttons */}
          {cutSheet.approval_status !== "approved" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleApprove}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve Sheet
              </button>
              <button
                type="button"
                onClick={() => setRejectionModalOpen(true)}
                className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-100 font-medium flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sheet Metadata Grid */}
      <div className="px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
          <span className="text-neutral-400 block text-[11px]">Wash Process:</span>
          <span className="font-semibold text-neutral-800">{cutSheet.sheet_data?.wash_type || "N/A"}</span>
        </div>
        <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
          <span className="text-neutral-400 block text-[11px]">Cut For:</span>
          <span className="font-semibold text-neutral-800">{cutSheet.cut_for || "Client"}</span>
        </div>
        <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
          <span className="text-neutral-400 block text-[11px]">Plies:</span>
          <span className="font-semibold text-neutral-800">{currentComp.plies || 45} Spreads</span>
        </div>
        <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
          <span className="text-neutral-400 block text-[11px]">Yield Yardage:</span>
          <span className="font-semibold text-neutral-800">{currentComp.estimated_yield || 2.35} yds/pc</span>
        </div>
      </div>

      {/* Spreadsheet Matrix Editor */}
      <div className="px-6 pb-6 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse border border-neutral-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-neutral-800 text-white font-mono uppercase text-[11px]">
              <th className="p-2.5 border-r border-neutral-700">Component</th>
              <th className="p-2.5 border-r border-neutral-700">Fabric Code</th>
              {Object.keys(currentComp.size_matrix || {}).map((size) => (
                <th key={size} className="p-2.5 border-r border-neutral-700 text-center">
                  Size {size}
                </th>
              ))}
              <th className="p-2.5 text-center bg-amber-700 text-white font-bold">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200 hover:bg-neutral-50/60 transition-colors">
              <td className="p-2.5 font-bold text-neutral-900 border-r border-neutral-200">
                {currentComp.component_name || "SELF"}
              </td>
              <td className="p-2.5 font-mono text-neutral-600 border-r border-neutral-200">
                {currentComp.fabric_code || "DNM-135"}
              </td>
              {Object.entries(currentComp.size_matrix || {}).map(([size, qty]) => {
                const cellKey = `size_${size}`;
                const highlight = formatting.highlighted_cells?.[cellKey];
                const cellComments = comments.filter((c) => c.cell_key === cellKey);

                return (
                  <td
                    key={size}
                    onClick={() => handleCellClick(cellKey)}
                    className={`p-1 border-r border-neutral-200 relative text-center transition-colors cursor-pointer ${
                      highlight === "yellow"
                        ? "bg-amber-100"
                        : highlight === "green"
                        ? "bg-emerald-100"
                        : highlight === "red"
                        ? "bg-rose-100"
                        : ""
                    }`}
                  >
                    <input
                      type="number"
                      min={0}
                      disabled={isLocked}
                      value={qty}
                      onChange={(e) => handleSizeQtyChange(size, e.target.value)}
                      className="w-14 text-center font-bold text-neutral-900 bg-transparent border-0 focus:ring-2 focus:ring-amber-500 rounded p-1"
                    />

                    {/* Cell Comment Trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCellComment({ cellKey, comment: "" });
                      }}
                      className="absolute top-0.5 right-0.5 text-neutral-300 hover:text-amber-600"
                      title="Add Comment"
                    >
                      <MessageSquare className={`w-2.5 h-2.5 ${cellComments.length > 0 ? "text-amber-600 fill-amber-600" : ""}`} />
                    </button>
                  </td>
                );
              })}
              <td className="p-2.5 text-center font-mono font-bold text-amber-900 bg-amber-50/80">
                {cutSheet.sheet_data?.grand_total || currentComp.total_units || 0} pcs
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cell Comment Popover Modal */}
      {activeCellComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-4 max-w-sm w-full space-y-3">
            <h4 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              Comment on Cell: <span className="font-mono text-amber-700">{activeCellComment.cellKey}</span>
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {comments
                .filter((c) => c.cell_key === activeCellComment.cellKey)
                .map((c) => (
                  <div key={c.id} className="p-2 bg-neutral-50 rounded text-[11px]">
                    <span className="font-bold text-neutral-800 block">{c.author}:</span>
                    {c.text}
                  </div>
                ))}
            </div>
            <textarea
              rows={2}
              value={activeCellComment.comment}
              onChange={(e) => setActiveCellComment({ ...activeCellComment, comment: e.target.value })}
              placeholder="Type note or QA instruction..."
              className="w-full p-2 text-xs border border-neutral-200 rounded-lg focus:ring-2 focus:ring-amber-500/20"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveCellComment(null)}
                className="px-3 py-1 text-neutral-600 hover:bg-neutral-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddComment}
                className="px-3 py-1 bg-amber-600 text-white rounded font-semibold hover:bg-amber-700"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-4 max-w-md w-full space-y-3">
            <h4 className="font-bold text-sm text-rose-800 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" />
              Reject Cut Sheet Specifications
            </h4>
            <p className="text-xs text-neutral-500">
              Provide reason for rejection. This will alert the merchandiser and lock execution until revised.
            </p>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Marker efficiency too low, roll width mismatch with 32-inch selvedge..."
              className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-1.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showHistory && (
        <VersionHistoryModal
          versions={versions}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Version Diff Modal */}
      {showDiff && (
        <VersionDiffModal
          versions={versions}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  );
}
