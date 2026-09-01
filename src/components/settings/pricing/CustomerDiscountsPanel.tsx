import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Power, PowerOff, Percent, Clock, User } from "lucide-react";
import { SectionCard } from "../../AppShell";
import {
  useCustomerPricingRules,
  useCompaniesForPricingPicker,
  useSaveCustomerPricingRule,
  useUpdateCustomerPricingRule,
  useDeactivateCustomerPricingRule,
  useReactivateCustomerPricingRule,
  type CustomerPricingRule,
} from "../../../hooks/useCustomerPricingRules";

const emptyForm = {
  company_id: "",
  discount_percent: "",
  effective_from: new Date().toISOString().split("T")[0],
  effective_until: "",
  notes: "",
};

export function CustomerDiscountsPanel() {
  const { data: rules, isLoading } = useCustomerPricingRules();
  const { data: companies } = useCompaniesForPricingPicker();
  const saveRule = useSaveCustomerPricingRule();
  const updateRule = useUpdateCustomerPricingRule();
  const deactivate = useDeactivateCustomerPricingRule();
  const reactivate = useReactivateCustomerPricingRule();

  const [companySearch, setCompanySearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return companies || [];
    return (companies || []).filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, companySearch]);

  const visibleRules = (rules || []).filter((r) => showInactive || r.is_active);

  const startEdit = (r: CustomerPricingRule) => {
    setEditingId(r.id);
    setForm({
      company_id: r.company_id,
      discount_percent: String(r.discount_percent ?? ""),
      effective_from: r.effective_from,
      effective_until: r.effective_until || "",
      notes: r.notes || "",
    });
    setCompanySearch(r.companies?.name || "");
    setFormError("");
  };
  const resetForm = () => { setEditingId(null); setForm(emptyForm); setCompanySearch(""); setFormError(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.company_id) {
      setFormError("Select the customer this discount applies to.");
      return;
    }
    const pct = Number(form.discount_percent);
    if (form.discount_percent === "" || Number.isNaN(pct) || pct < 0 || pct > 100) {
      setFormError("Enter a discount percent between 0 and 100.");
      return;
    }
    if (form.effective_until && form.effective_until <= form.effective_from) {
      setFormError("The end date must be after the start date.");
      return;
    }
    const companyName = (companies || []).find((c) => c.id === form.company_id)?.name;
    try {
      if (editingId) {
        await updateRule.mutateAsync({
          id: editingId,
          companyId: form.company_id,
          companyName,
          updates: {
            discount_percent: pct,
            effective_from: form.effective_from,
            effective_until: form.effective_until || null,
            notes: form.notes || null,
          },
        });
      } else {
        await saveRule.mutateAsync({
          company_id: form.company_id,
          companyName,
          discount_percent: pct,
          effective_from: form.effective_from,
          effective_until: form.effective_until || null,
          notes: form.notes || null,
        });
      }
      resetForm();
    } catch (err: any) {
      setFormError(err.message || "Failed to save discount rule.");
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <SectionCard title="Customer Discount Rules">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show deactivated rules
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2.5 pr-4">Customer</th>
                  <th className="py-2.5 pr-4 text-right">Discount</th>
                  <th className="py-2.5 pr-4">Effective Window</th>
                  <th className="py-2.5 pr-4">Audit Trail</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">Loading discount rules...</td></tr>}
                {!isLoading && visibleRules.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">No customer discount rules configured yet.</td></tr>
                )}
                {visibleRules.map((r) => (
                  <tr key={r.id} className={`border-b border-border/60 hover:bg-muted/30 transition-colors ${!r.is_active ? "opacity-50" : ""}`}>
                    <td className="py-3 pr-4 font-semibold text-primary">{r.companies?.name || "Unknown Company"}</td>
                    <td className="py-3 pr-4 text-right font-mono-data font-bold flex items-center justify-end gap-1">
                      <Percent className="h-3 w-3 text-muted-foreground" />{r.discount_percent?.toFixed(1)}
                    </td>
                    <td className="py-3 pr-4 text-xs font-mono-data text-muted-foreground">
                      {r.effective_from} → {r.effective_until || "Ongoing"}
                    </td>
                    <td className="py-3 pr-4 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold border ${r.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                        {r.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(r)} className="text-xs font-semibold text-secondary hover:underline mr-3">Edit</button>
                      {r.is_active ? (
                        <button onClick={() => deactivate.mutate({ id: r.id, companyId: r.company_id, companyName: r.companies?.name })} className="text-xs font-semibold text-destructive hover:underline inline-flex items-center gap-1">
                          <PowerOff className="h-3 w-3" /> Deactivate
                        </button>
                      ) : (
                        <button onClick={() => reactivate.mutate({ id: r.id, companyId: r.company_id, companyName: r.companies?.name })} className="text-xs font-semibold text-success hover:underline inline-flex items-center gap-1">
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
        <SectionCard title={editingId ? "Edit Discount Rule" : "Add Discount Rule"}>
          {formError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer / Company</label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={companySearch}
                  onChange={(e) => { setCompanySearch(e.target.value); setForm((f) => ({ ...f, company_id: "" })); }}
                  placeholder="Search company name..."
                  className="w-full h-10 pl-8 pr-3 rounded-lg border border-outline-variant bg-card text-xs"
                />
              </div>
              {companySearch && !form.company_id && (
                <div className="max-h-36 overflow-y-auto border border-outline-variant rounded-lg divide-y divide-border">
                  {filteredCompanies.length === 0 && <div className="p-2 text-xs text-muted-foreground">No matching companies.</div>}
                  {filteredCompanies.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => { setForm((f) => ({ ...f, company_id: c.id })); setCompanySearch(c.name); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              {form.company_id && <p className="text-[11px] text-success font-semibold">Selected ✓</p>}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Discount %</label>
              <input type="number" step="0.5" min={0} max={100} value={form.discount_percent} onChange={(e) => setForm((f) => ({ ...f, discount_percent: e.target.value }))} placeholder="e.g. 10" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs font-mono font-semibold" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Effective From</label>
                <input type="date" value={form.effective_from} onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Effective Until</label>
                <input type="date" value={form.effective_until} onChange={(e) => setForm((f) => ({ ...f, effective_until: e.target.value }))} placeholder="Ongoing" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Volume partner agreement" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs" />
            </div>
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={resetForm} className="flex-1 h-10 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-muted transition-colors">Cancel</button>}
              <button type="submit" disabled={saveRule.isPending || updateRule.isPending} className="flex-1 bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50">
                <Plus className="h-4 w-4" /> {editingId ? "Save Changes" : "Add Discount Rule"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
