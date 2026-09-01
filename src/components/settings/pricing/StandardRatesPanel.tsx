import { useState } from "react";
import { AlertTriangle, Plus, Power, PowerOff, DollarSign } from "lucide-react";
import { SectionCard } from "../../AppShell";
import {
  useRateCards,
  useSaveRateCard,
  useUpdateRateCard,
  useDeactivateRateCard,
  useReactivateRateCard,
  type RateCard,
  type RateCardArticleType,
  type RateCardProcess,
  type RateCardFabricCategory,
} from "../../../hooks/useRateCards";

const ARTICLE_TYPES: RateCardArticleType[] = [
  "Denim/Bottoms", "Hoodie/Sweatshirt", "T-Shirt", "Jacket", "Shorts", "Dress", "Kidswear", "Custom/Other",
];
const PROCESSES: { value: RateCardProcess; label: string }[] = [
  { value: "cmt_base", label: "CMT Base Labor" },
  { value: "wash_surcharge", label: "Wash Surcharge" },
  { value: "trims_packaging", label: "Trims & Packaging Labor" },
];
const FABRIC_CATEGORIES: { value: RateCardFabricCategory; label: string }[] = [
  { value: "denim", label: "Denim" },
  { value: "knit", label: "Knit / Jersey" },
  { value: "woven", label: "Woven (Non-Denim)" },
  { value: "other", label: "Other / Unclassified" },
];

const emptyForm = {
  article_type: "Denim/Bottoms" as RateCardArticleType,
  process: "cmt_base" as RateCardProcess,
  fabric_category: "denim" as RateCardFabricCategory,
  base_rate_usd: "",
  loaded_margin_percent: "",
  effective_date: new Date().toISOString().split("T")[0],
};

export function StandardRatesPanel() {
  const { data: rateCards, isLoading } = useRateCards();
  const saveRateCard = useSaveRateCard();
  const updateRateCard = useUpdateRateCard();
  const deactivate = useDeactivateRateCard();
  const reactivate = useReactivateRateCard();

  const [filterArticle, setFilterArticle] = useState<string>("All");
  const [filterProcess, setFilterProcess] = useState<string>("All");
  const [filterFabric, setFilterFabric] = useState<string>("All");
  const [showInactive, setShowInactive] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = (rateCards || []).filter((r) => {
    if (!showInactive && !r.is_active) return false;
    if (filterArticle !== "All" && r.article_type !== filterArticle) return false;
    if (filterProcess !== "All" && r.process !== filterProcess) return false;
    if (filterFabric !== "All" && r.fabric_category !== filterFabric) return false;
    return true;
  });

  const startEdit = (rc: RateCard) => {
    setEditingId(rc.id);
    setForm({
      article_type: rc.article_type,
      process: rc.process,
      fabric_category: rc.fabric_category,
      base_rate_usd: String(rc.base_rate_usd),
      loaded_margin_percent: String(rc.loaded_margin_percent),
      effective_date: rc.effective_date,
    });
    setFormError("");
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const baseRate = Number(form.base_rate_usd);
    const margin = Number(form.loaded_margin_percent);
    if (!form.base_rate_usd || Number.isNaN(baseRate) || baseRate < 0) {
      setFormError("Enter a valid base rate ($/pc), 0 or greater.");
      return;
    }
    if (form.loaded_margin_percent === "" || Number.isNaN(margin) || margin < 0 || margin > 500) {
      setFormError("Enter a valid loaded margin %, between 0 and 500.");
      return;
    }
    try {
      const input = {
        article_type: form.article_type,
        process: form.process,
        fabric_category: form.fabric_category,
        base_rate_usd: baseRate,
        loaded_margin_percent: margin,
        effective_date: form.effective_date,
      };
      if (editingId) {
        await updateRateCard.mutateAsync({ id: editingId, updates: input });
      } else {
        await saveRateCard.mutateAsync(input);
      }
      resetForm();
    } catch (err: any) {
      setFormError(err.message || "Failed to save rate card. A combination this specific may already be active — deactivate it first.");
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <SectionCard title="Standard Rate Cards">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select value={filterArticle} onChange={(e) => setFilterArticle(e.target.value)} className="h-9 px-2.5 rounded-lg border border-outline-variant bg-card text-xs">
              <option value="All">All Article Types</option>
              {ARTICLE_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filterProcess} onChange={(e) => setFilterProcess(e.target.value)} className="h-9 px-2.5 rounded-lg border border-outline-variant bg-card text-xs">
              <option value="All">All Processes</option>
              {PROCESSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={filterFabric} onChange={(e) => setFilterFabric(e.target.value)} className="h-9 px-2.5 rounded-lg border border-outline-variant bg-card text-xs">
              <option value="All">All Fabric Categories</option>
              {FABRIC_CATEGORIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
              Show deactivated
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2.5 pr-4">Article Type</th>
                  <th className="py-2.5 pr-4">Process</th>
                  <th className="py-2.5 pr-4">Fabric</th>
                  <th className="py-2.5 pr-4 text-right">Base Rate</th>
                  <th className="py-2.5 pr-4 text-right">Margin %</th>
                  <th className="py-2.5 pr-4">Effective</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">Loading rate cards...</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">No rate cards match these filters.</td></tr>
                )}
                {filtered.map((rc) => (
                  <tr key={rc.id} className={`border-b border-border/60 hover:bg-muted/30 transition-colors ${!rc.is_active ? "opacity-50" : ""}`}>
                    <td className="py-3 pr-4 font-semibold text-primary">{rc.article_type}</td>
                    <td className="py-3 pr-4 text-xs">{PROCESSES.find((p) => p.value === rc.process)?.label || rc.process}</td>
                    <td className="py-3 pr-4 text-xs">{FABRIC_CATEGORIES.find((f) => f.value === rc.fabric_category)?.label || rc.fabric_category}</td>
                    <td className="py-3 pr-4 text-right font-mono-data">${rc.base_rate_usd.toFixed(2)}</td>
                    <td className="py-3 pr-4 text-right font-mono-data">{rc.loaded_margin_percent.toFixed(1)}%</td>
                    <td className="py-3 pr-4 text-xs font-mono-data text-muted-foreground">{rc.effective_date}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold border ${rc.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                        {rc.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(rc)} className="text-xs font-semibold text-secondary hover:underline mr-3">Edit</button>
                      {rc.is_active ? (
                        <button onClick={() => deactivate.mutate(rc.id)} className="text-xs font-semibold text-destructive hover:underline inline-flex items-center gap-1">
                          <PowerOff className="h-3 w-3" /> Deactivate
                        </button>
                      ) : (
                        <button onClick={() => reactivate.mutate(rc.id)} className="text-xs font-semibold text-success hover:underline inline-flex items-center gap-1">
                          <Power className="h-3 w-3" /> Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div>
        <SectionCard title={editingId ? "Edit Rate Card" : "Add Rate Card"}>
          {formError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Article Type</label>
              <select value={form.article_type} onChange={(e) => setForm((f) => ({ ...f, article_type: e.target.value as RateCardArticleType }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs">
                {ARTICLE_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Process</label>
              <select value={form.process} onChange={(e) => setForm((f) => ({ ...f, process: e.target.value as RateCardProcess }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs">
                {PROCESSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fabric Category</label>
              <select value={form.fabric_category} onChange={(e) => setForm((f) => ({ ...f, fabric_category: e.target.value as RateCardFabricCategory }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs">
                {FABRIC_CATEGORIES.map((f2) => <option key={f2.value} value={f2.value}>{f2.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Base Rate ($/pc)</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input type="number" step="0.01" min={0} value={form.base_rate_usd} onChange={(e) => setForm((f) => ({ ...f, base_rate_usd: e.target.value }))} placeholder="e.g. 4.50" className="w-full h-10 pl-8 pr-3 rounded-lg border border-outline-variant bg-card text-xs font-mono font-semibold" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Loaded Margin %
                {form.process !== "cmt_base" && <span className="normal-case font-normal text-muted-foreground/70"> (only the CMT Base row's margin is used in quotes)</span>}
              </label>
              <input type="number" step="0.1" min={0} max={500} value={form.loaded_margin_percent} onChange={(e) => setForm((f) => ({ ...f, loaded_margin_percent: e.target.value }))} placeholder="e.g. 20" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs font-mono font-semibold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Effective Date</label>
              <input type="date" value={form.effective_date} onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs" />
            </div>
            <div className="flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="flex-1 h-10 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-muted transition-colors">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={saveRateCard.isPending || updateRateCard.isPending} className="flex-1 bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50">
                <Plus className="h-4 w-4" /> {editingId ? "Save Changes" : "Add Rate Card"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
