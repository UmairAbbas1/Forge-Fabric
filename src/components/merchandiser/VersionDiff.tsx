import { useState, useMemo } from "react";
import { X, GitCompare, ArrowRight, Plus, Minus } from "lucide-react";
import type { CutSheetVersionRecord } from "../../lib/types";
import { computeCutSheetSemanticDiff } from "../../hooks/merchandiser/useCutSheetVersions";

interface VersionDiffModalProps {
  versions: CutSheetVersionRecord[];
  onClose: () => void;
}

export function VersionDiffModal({ versions, onClose }: VersionDiffModalProps) {
  const [leftVerId, setLeftVerId] = useState<string>(versions[1]?.id || versions[0]?.id || "");
  const [rightVerId, setRightVerId] = useState<string>(versions[0]?.id || "");

  const leftVer = versions.find((v) => v.id === leftVerId);
  const rightVer = versions.find((v) => v.id === rightVerId);

  const diffs = useMemo(() => {
    return computeCutSheetSemanticDiff(leftVer?.snapshot, rightVer?.snapshot);
  }, [leftVer, rightVer]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-sm text-neutral-900">Semantic Version Comparison</h3>
              <p className="text-[11px] text-neutral-500">Compare engineering spec differences across cut sheet revisions.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Version Pickers */}
        <div className="px-5 py-3 bg-neutral-100/70 border-b border-neutral-200 grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Base Version (Left):</label>
            <select
              value={leftVerId}
              onChange={(e) => setLeftVerId(e.target.value)}
              className="w-full p-2 bg-white border border-neutral-200 rounded-lg font-medium text-neutral-900"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} — {v.change_summary}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Target Version (Right):</label>
            <select
              value={rightVerId}
              onChange={(e) => setRightVerId(e.target.value)}
              className="w-full p-2 bg-white border border-neutral-200 rounded-lg font-medium text-neutral-900"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} — {v.change_summary}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Diff Results Container */}
        <div className="p-5 overflow-y-auto space-y-3 text-xs flex-1">
          {diffs.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <p className="font-medium">No differences detected between selected versions.</p>
            </div>
          ) : (
            <div className="border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
              {diffs.map((d, i) => (
                <div key={i} className="p-3 flex items-center justify-between hover:bg-neutral-50">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                      {d.type.replace('_', ' ')}
                    </span>
                    <span className="font-semibold text-neutral-900">{d.label}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                      {d.old_value}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-300" />
                    <span className="font-bold text-neutral-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                      {d.new_value}
                    </span>
                    {d.delta !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-0.5 ${
                          d.delta > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : d.delta < 0
                            ? "bg-rose-100 text-rose-800"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {d.delta > 0 ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {Math.abs(d.delta)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
