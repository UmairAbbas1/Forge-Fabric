import { useState } from "react";
import { AlertTriangle, Plus, Power, PowerOff, Beaker } from "lucide-react";
import { SectionCard } from "../../AppShell";
import {
  useSamplePricingRules,
  useSaveSamplePricingRule,
  useUpdateSamplePricingRule,
  useDeactivateSamplePricingRule,
  useReactivateSamplePricingRule,
  type SamplePricingRule,
  type SampleArticleType,
} from "../../../hooks/useSamplePricingRules";

const ARTICLE_TYPES: SampleArticleType[] = [
  "Denim/Bottoms", "Hoodie/Sweatshirt", "T-Shirt", "Jacket", "Shorts", "Dress", "Kidswear", "Custom/Other",
];

const emptyForm = { article_type: "Denim/Bottoms" as SampleArticleType, flat_fee_usd: "", per_unit_rate_usd: "", notes: "" };

export function SamplePricingPanel() {
  const { data: rules, isLoading } = useSamplePricingRules();
  const saveRule = useSaveSamplePricingRule();
  const updateRule = useUpdateSamplePricingRule();
  const deactivate = useDeactivateSamplePricingRule();
  const reactivate = useReactivateSamplePricingRule();

  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const visible = (rules || []).filter((r) => showInactive || r.is_active);

  const startEdit = (r: SamplePricingRule) => {
    setEditingId(r.id);
    setForm({
      article_type: r.article_type,
      flat_fee_usd: r.flat_fee_usd != null ? String(r.flat_fee_usd) : "",
      per_unit_rate_usd: r.per_unit_rate_usd != null ? String(r.per_unit_rate_usd) : "",
      notes: r.notes || "",
    });
    setFormError("");
  };
  const resetForm = () => { setEditingId(null); setForm(emptyForm); setFormError(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.flat_fee_usd && !form.per_unit_rate_usd) {
      setFormError("Enter a flat fee, a per-unit rate, or both — a sample pricing rule needs at least one.");
      return;
    }
    try {
      const input = {
        article_type: form.article_type,
        flat_fee_usd: form.flat_fee_usd ? Number(form.flat_fee_usd) : null,
        per_unit_rate_usd: form.per_unit_rate_usd ? Number(form.per_unit_rate_usd) : null,
        notes: form.notes || null,
      };
      if (editingId) {
        await updateRule.mutateAsync({ id: editingId, updates: input });
      } else {
        await saveRule.mutateAsync(input);
      }
      resetForm();
    } catch (err: any) {
      setFormError(err.message || "Failed to save. This article type may already have an active sample pricing rule — deactivate it first.");
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <SectionCard title="Sample Pricing Rules">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show deactivated rules
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2.5 pr-4">Article Type</th>
                  <th className="py-2.5 pr-4 text-right">Flat Fee</th>
                  <th className="py-2.5 pr-4 text-right">Per-Unit Rate</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">Loading...</td></tr>}
                {!isLoading && visible.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No sample pricing rules configured yet.</td></tr>
                )}
                {visible.map((r) => (
                  <tr key={r.id} className={`border-b border-border/60 hover:bg-muted/30 transition-colors ${!r.is_active ? "opacity-50" : ""}`}>
                    <td className="py-3 pr-4 font-semibold text-primary flex items-center gap-1.5"><Beaker className="h-3.5 w-3.5 text-violet-600" />{r.article_type}</td>
                    <td className="py-3 pr-4 text-right font-mono-data">{r.flat_fee_usd != null ? `$${r.flat_fee_usd.toFixed(2)}` : "—"}</td>
                    <td className="py-3 pr-4 text-right font-mono-data">{r.per_unit_rate_usd != null ? `$${r.per_unit_rate_usd.toFixed(2)}/pc` : "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold border ${r.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                        {r.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(r)} className="text-xs font-semibold text-secondary hover:underline mr-3">Edit</button>
                      {r.is_active ? (
                        <button onClick={() => deactivate.mutate(r.id)} className="text-xs font-semibold text-destructive hover:underline inline-flex items-center gap-1"><PowerOff className="h-3 w-3" /> Deactivate</button>
                      ) : (
                        <button onClick={() => reactivate.mutate(r.id)} className="text-xs font-semibold text-success hover:underline inline-flex items-center gap-1"><Power className="h-3 w-3" /> Reactivate</button>
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
        <SectionCard title={editingId ? "Edit Sample Pricing Rule" : "Add Sample Pricing Rule"}>
          <p className="text-[11px] text-muted-foreground mb-4">
            Set a flat fee, a per-unit rate, or both for this article type.
          </p>
          {formError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Article Type</label>
              <select value={form.article_type} onChange={(e) => setForm((f) => ({ ...f, article_type: e.target.value as SampleArticleType }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs">
                {ARTICLE_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Flat Fee (USD)</label>
              <input type="number" step="0.01" min={0} value={form.flat_fee_usd} onChange={(e) => setForm((f) => ({ ...f, flat_fee_usd: e.target.value }))} placeholder="e.g. 150.00 (optional)" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs font-mono font-semibold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Per-Unit Rate ($/pc)</label>
              <input type="number" step="0.01" min={0} value={form.per_unit_rate_usd} onChange={(e) => setForm((f) => ({ ...f, per_unit_rate_usd: e.target.value }))} placeholder="e.g. 12.00 (optional)" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs font-mono font-semibold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Includes 1 fit round" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs" />
            </div>
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={resetForm} className="flex-1 h-10 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-muted transition-colors">Cancel</button>}
              <button type="submit" disabled={saveRule.isPending || updateRule.isPending} className="flex-1 bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50">
                <Plus className="h-4 w-4" /> {editingId ? "Save Changes" : "Add Rule"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
