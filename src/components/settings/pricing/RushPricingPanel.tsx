import { useState } from "react";
import { AlertTriangle, Plus, Power, PowerOff, Zap, Gauge } from "lucide-react";
import { SectionCard } from "../../AppShell";
import {
  useArticleCycleProfiles,
  useSaveCycleProfile,
  useUpdateCycleProfile,
  useDeactivateCycleProfile,
  useReactivateCycleProfile,
  useRushMultiplierTiers,
  useSaveMultiplierTier,
  useUpdateMultiplierTier,
  useDeactivateMultiplierTier,
  useReactivateMultiplierTier,
  type ArticleCycleProfile,
  type RushMultiplierTier,
  type ComplexityTier,
  type CycleProfileArticleType,
} from "../../../hooks/useRushPricing";

const ARTICLE_TYPES: CycleProfileArticleType[] = [
  "Denim/Bottoms", "Hoodie/Sweatshirt", "T-Shirt", "Jacket", "Shorts", "Dress", "Kidswear", "Custom/Other",
];
const TIERS: ComplexityTier[] = ["Simple", "Moderate", "Complex"];

const emptyProfileForm = { article_type: "Denim/Bottoms" as CycleProfileArticleType, complexity_tier: "Moderate" as ComplexityTier, units_per_shift: "", notes: "" };
const emptyTierForm = { complexity_tier: "Simple" as ComplexityTier, multiplier: "" };

export function RushPricingPanel() {
  const { data: profiles, isLoading: profilesLoading } = useArticleCycleProfiles();
  const saveProfile = useSaveCycleProfile();
  const updateProfile = useUpdateCycleProfile();
  const deactivateProfile = useDeactivateCycleProfile();
  const reactivateProfile = useReactivateCycleProfile();

  const { data: tiers, isLoading: tiersLoading } = useRushMultiplierTiers();
  const saveTier = useSaveMultiplierTier();
  const updateTier = useUpdateMultiplierTier();
  const deactivateTier = useDeactivateMultiplierTier();
  const reactivateTier = useReactivateMultiplierTier();

  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [profileEditingId, setProfileEditingId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState("");

  const [tierForm, setTierForm] = useState(emptyTierForm);
  const [tierEditingId, setTierEditingId] = useState<string | null>(null);
  const [tierError, setTierError] = useState("");

  const startEditProfile = (p: ArticleCycleProfile) => {
    setProfileEditingId(p.id);
    setProfileForm({ article_type: p.article_type, complexity_tier: p.complexity_tier, units_per_shift: String(p.units_per_shift), notes: p.notes || "" });
  };
  const resetProfileForm = () => { setProfileEditingId(null); setProfileForm(emptyProfileForm); setProfileError(""); };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    const ups = Number(profileForm.units_per_shift);
    if (!profileForm.units_per_shift || Number.isNaN(ups) || ups <= 0) {
      setProfileError("Enter a valid units-per-shift throughput, greater than 0.");
      return;
    }
    try {
      const input = { article_type: profileForm.article_type, complexity_tier: profileForm.complexity_tier, units_per_shift: ups, notes: profileForm.notes || null };
      if (profileEditingId) {
        await updateProfile.mutateAsync({ id: profileEditingId, updates: input });
      } else {
        await saveProfile.mutateAsync(input);
      }
      resetProfileForm();
    } catch (err: any) {
      setProfileError(err.message || "Failed to save. This article type may already have an active cycle profile — deactivate it first.");
    }
  };

  const startEditTier = (t: RushMultiplierTier) => {
    setTierEditingId(t.id);
    setTierForm({ complexity_tier: t.complexity_tier, multiplier: String(t.multiplier) });
  };
  const resetTierForm = () => { setTierEditingId(null); setTierForm(emptyTierForm); setTierError(""); };

  const handleTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTierError("");
    const mult = Number(tierForm.multiplier);
    if (!tierForm.multiplier || Number.isNaN(mult) || mult < 1) {
      setTierError("Enter a valid multiplier, 1.0 or greater.");
      return;
    }
    try {
      const input = { complexity_tier: tierForm.complexity_tier, multiplier: mult };
      if (tierEditingId) {
        await updateTier.mutateAsync({ id: tierEditingId, updates: input });
      } else {
        await saveTier.mutateAsync(input);
      }
      resetTierForm();
    } catch (err: any) {
      setTierError(err.message || "Failed to save. This tier may already have an active multiplier — deactivate it first.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard title="Article Cycle Profiles (Complexity & Throughput)">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 pr-4">Article Type</th>
                    <th className="py-2.5 pr-4">Complexity Tier</th>
                    <th className="py-2.5 pr-4 text-right">Units / Shift</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profilesLoading && <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">Loading...</td></tr>}
                  {!profilesLoading && (profiles || []).length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No cycle profiles configured yet.</td></tr>
                  )}
                  {(profiles || []).map((p) => (
                    <tr key={p.id} className={`border-b border-border/60 hover:bg-muted/30 transition-colors ${!p.is_active ? "opacity-50" : ""}`}>
                      <td className="py-3 pr-4 font-semibold text-primary">{p.article_type}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold border bg-amber-50 text-amber-800 border-amber-200">{p.complexity_tier}</span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono-data">{p.units_per_shift.toLocaleString()}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold border ${p.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                          {p.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <button onClick={() => startEditProfile(p)} className="text-xs font-semibold text-secondary hover:underline mr-3">Edit</button>
                        {p.is_active ? (
                          <button onClick={() => deactivateProfile.mutate(p.id)} className="text-xs font-semibold text-destructive hover:underline inline-flex items-center gap-1"><PowerOff className="h-3 w-3" /> Deactivate</button>
                        ) : (
                          <button onClick={() => reactivateProfile.mutate(p.id)} className="text-xs font-semibold text-success hover:underline inline-flex items-center gap-1"><Power className="h-3 w-3" /> Reactivate</button>
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
          <SectionCard title={profileEditingId ? "Edit Cycle Profile" : "Add Cycle Profile"}>
            {profileError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{profileError}</span>
              </div>
            )}
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Article Type</label>
                <select value={profileForm.article_type} onChange={(e) => setProfileForm((f) => ({ ...f, article_type: e.target.value as CycleProfileArticleType }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs">
                  {ARTICLE_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Complexity Tier</label>
                <select value={profileForm.complexity_tier} onChange={(e) => setProfileForm((f) => ({ ...f, complexity_tier: e.target.value as ComplexityTier }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs">
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Real Units / Shift</label>
                <div className="relative">
                  <Gauge className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input type="number" min={1} value={profileForm.units_per_shift} onChange={(e) => setProfileForm((f) => ({ ...f, units_per_shift: e.target.value }))} placeholder="e.g. 800" className="w-full h-10 pl-8 pr-3 rounded-lg border border-outline-variant bg-card text-xs font-mono font-semibold" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
                <input value={profileForm.notes} onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Complex due to multi-panel construction" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs" />
              </div>
              <div className="flex gap-2">
                {profileEditingId && <button type="button" onClick={resetProfileForm} className="flex-1 h-10 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-muted transition-colors">Cancel</button>}
                <button type="submit" disabled={saveProfile.isPending || updateProfile.isPending} className="flex-1 bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50">
                  <Plus className="h-4 w-4" /> {profileEditingId ? "Save Changes" : "Add Profile"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard title="Rush Multiplier Tiers">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 pr-4">Complexity Tier</th>
                    <th className="py-2.5 pr-4 text-right">Multiplier</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tiersLoading && <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">Loading...</td></tr>}
                  {!tiersLoading && (tiers || []).length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No rush multiplier tiers configured yet.</td></tr>
                  )}
                  {(tiers || []).map((t) => (
                    <tr key={t.id} className={`border-b border-border/60 hover:bg-muted/30 transition-colors ${!t.is_active ? "opacity-50" : ""}`}>
                      <td className="py-3 pr-4 font-semibold text-primary flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-amber-600" />{t.complexity_tier}</td>
                      <td className="py-3 pr-4 text-right font-mono-data font-bold">{t.multiplier.toFixed(2)}x</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold border ${t.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}`}>
                          {t.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <button onClick={() => startEditTier(t)} className="text-xs font-semibold text-secondary hover:underline mr-3">Edit</button>
                        {t.is_active ? (
                          <button onClick={() => deactivateTier.mutate(t.id)} className="text-xs font-semibold text-destructive hover:underline inline-flex items-center gap-1"><PowerOff className="h-3 w-3" /> Deactivate</button>
                        ) : (
                          <button onClick={() => reactivateTier.mutate(t.id)} className="text-xs font-semibold text-success hover:underline inline-flex items-center gap-1"><Power className="h-3 w-3" /> Reactivate</button>
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
          <SectionCard title={tierEditingId ? "Edit Multiplier Tier" : "Add Multiplier Tier"}>
            {tierError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{tierError}</span>
              </div>
            )}
            <form onSubmit={handleTierSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Complexity Tier</label>
                <select value={tierForm.complexity_tier} onChange={(e) => setTierForm((f) => ({ ...f, complexity_tier: e.target.value as ComplexityTier }))} className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs">
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rush Multiplier</label>
                <input type="number" step="0.05" min={1} value={tierForm.multiplier} onChange={(e) => setTierForm((f) => ({ ...f, multiplier: e.target.value }))} placeholder="e.g. 1.75" className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs font-mono font-semibold" />
              </div>
              <div className="flex gap-2">
                {tierEditingId && <button type="button" onClick={resetTierForm} className="flex-1 h-10 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-muted transition-colors">Cancel</button>}
                <button type="submit" disabled={saveTier.isPending || updateTier.isPending} className="flex-1 bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50">
                  <Plus className="h-4 w-4" /> {tierEditingId ? "Save Changes" : "Add Tier"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
