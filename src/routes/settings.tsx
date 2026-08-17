import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getMockProfiles, saveMockProfiles, type Profile, isRealSupabase, supabase } from "../lib/supabase";
import { AppShell, SectionCard } from "../components/AppShell";
import { useAppData } from "../hooks/useAppData";
import { UserManagement } from "../components/settings/UserManagement";
import { 
  Shield, Users, Save, UserX, UserCheck, AlertTriangle, 
  Briefcase, Cog, ShieldCheck, Plus, CheckCircle, XCircle, Ruler, Trash2
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Admin Panel · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Admin configurations, user access controls, customer directories, equipment trackers, size ratios, and AQL checkpoints." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateUserRole, loading } = useAuth();
  const { 
    orders, 
    customers, 
    equipment, 
    checkpoints, 
    sizeRatios,
    addCustomer, 
    addEquipment, 
    toggleEquipmentStatus, 
    updateCheckpoint,
    addSizeRatio,
    deleteSizeRatio,
    deleteCustomerCascade 
  } = useAppData();

  const [activeTab, setActiveTab] = useState<"users" | "customers" | "equipment" | "checkpoints" | "sizeRatios">("users");
  
  // Tab states
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(true);

  // New Customer Form State
  const [custName, setCustName] = useState("");
  const [custContact, setCustContact] = useState("");
  const [custFormError, setCustFormError] = useState("");

  // New Equipment Form State
  const [eqName, setEqName] = useState("");
  const [eqType, setEqType] = useState("Cutter");
  const [eqFormError, setEqFormError] = useState("");

  // New Size Ratio Form State
  const [srName, setSrName] = useState("");
  const [srDesc, setSrDesc] = useState("");
  const [srFormError, setSrFormError] = useState("");

  // Checkpoints editable states
  const [editAql, setEditAql] = useState<Record<string, string>>({});

  // Security Check: Redirect to /login if not authenticated, to /dashboard if not admin
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate({ to: "/login" });
      } else if (user.role !== "admin") {
        navigate({ to: "/dashboard" });
      }
    }
  }, [user, loading, navigate]);

  // Load profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      if (isRealSupabase) {
        const { data, error } = await supabase.from("profiles").select("*, customers(name)");
        if (!error && data) {
          const mapped = data.map((p: any) => ({
            ...p,
            customer_name: p.customers?.name || p.customer_name
          }));
          setProfiles(mapped);
        }
      } else {
        setProfiles(getMockProfiles());
      }
    };
    fetchProfiles();
  }, []);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying administrator authorization...</p>
        </div>
      </div>
    );
  }

  const handleRemoveProfile = async (profile: Profile) => {
    if (!window.confirm(`Are you sure you want to completely remove ${profile.email}? This will delete their brand and all associated orders.`)) {
      return;
    }
    setUpdatingId(profile.id);
    setStatusMsg("");
    try {
      if (isRealSupabase) {
        await supabase.from("profiles").delete().eq("id", profile.id);
      } else {
        const currentProfiles = getMockProfiles();
        saveMockProfiles(currentProfiles.filter(p => p.id !== profile.id));
      }

      if (profile.customer_name) {
        deleteCustomerCascade(profile.customer_name);
      }

      setProfiles(prev => prev.filter(p => p.id !== profile.id));
      setIsSuccess(true);
      setStatusMsg("User, brand, and all associated orders were removed successfully.");
    } catch (e: any) {
      setIsSuccess(false);
      setStatusMsg(e.message || "Failed to remove user");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Profile["role"]) => {
    setUpdatingId(userId);
    setStatusMsg("");
    
    try {
      const { error } = await updateUserRole(userId, newRole);
      if (error) {
        setIsSuccess(false);
        setStatusMsg(error.message);
      } else {
        setIsSuccess(true);
        setStatusMsg("User authorization updated successfully.");
        // Refresh local profiles state
        if (isRealSupabase) {
          const { data } = await supabase.from("profiles").select("*, customers(name)");
          if (data) {
            const mapped = data.map((p: any) => ({
              ...p,
              customer_name: p.customers?.name || p.customer_name
            }));
            setProfiles(mapped);
          }
        } else {
          setProfiles(getMockProfiles());
        }
      }
    } catch (e: any) {
      setIsSuccess(false);
      setStatusMsg(e.message || "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleDeactivate = async (userId: string, currentDeactivated: boolean) => {
    setUpdatingId(userId);
    setStatusMsg("");
    const targetState = !currentDeactivated;

    try {
      if (isRealSupabase) {
        const { error } = await supabase
          .from("profiles")
          .update({ deactivated: targetState })
          .eq("id", userId);
        if (error) throw error;
        
        const { data } = await supabase.from("profiles").select("*, customers(name)");
        if (data) {
          const mapped = data.map((p: any) => ({
            ...p,
            customer_name: p.customers?.name || p.customer_name
          }));
          setProfiles(mapped);
        }
      } else {
        const profs = getMockProfiles();
        const idx = profs.findIndex((p) => p.id === userId);
        if (idx !== -1) {
          profs[idx].deactivated = targetState;
          saveMockProfiles(profs);
          setProfiles(profs);
        }
      }
      setIsSuccess(true);
      setStatusMsg(targetState ? "Account deactivated successfully." : "Account activated successfully.");
    } catch (e: any) {
      setIsSuccess(false);
      setStatusMsg(e.message || "Failed to toggle activation status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Customer submit
  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustFormError("");
    if (!custName.trim()) {
      setCustFormError("Please enter the company name.");
      return;
    }
    if (!custContact.trim()) {
      setCustFormError("Please enter a contact email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custContact.trim())) {
      setCustFormError("Please enter a valid contact email address (e.g. sourcing@retailer.com).");
      return;
    }
    addCustomer(custName, custContact);
    setCustName("");
    setCustContact("");
    setCustFormError("");
    setIsSuccess(true);
    setStatusMsg(`Customer "${custName}" registered successfully.`);
  };

  // Equipment submit
  const handleAddEquipmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEqFormError("");
    if (!eqName.trim()) {
      setEqFormError("Please enter the asset / equipment name.");
      return;
    }
    addEquipment(eqName, eqType);
    setEqName("");
    setEqFormError("");
    setIsSuccess(true);
    setStatusMsg(`Equipment "${eqName}" registered successfully.`);
  };

  // Size Ratio submit
  const handleAddSizeRatioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSrFormError("");
    if (!srName.trim()) {
      setSrFormError("Please enter the size ratio name (e.g. 28-38 or S-XXL).");
      return;
    }
    if (sizeRatios.some(sr => sr.name.toLowerCase() === srName.trim().toLowerCase())) {
      setSrFormError(`Size ratio "${srName.trim()}" already exists.`);
      return;
    }
    addSizeRatio(srName.trim(), srDesc.trim() || undefined);
    setSrName("");
    setSrDesc("");
    setSrFormError("");
    setIsSuccess(true);
    setStatusMsg(`Size Ratio "${srName}" registered successfully!`);
  };

  const handleRemoveSizeRatio = (ratio: { id: string; name: string }) => {
    if (window.confirm(`Are you sure you want to delete size ratio "${ratio.name}"?`)) {
      deleteSizeRatio(ratio.id);
      setIsSuccess(true);
      setStatusMsg(`Size ratio "${ratio.name}" removed.`);
    }
  };

  // Save Checkpoint AQL limits
  const handleSaveCheckpoint = (cpId: string) => {
    const limit = editAql[cpId];
    if (!limit) return;
    updateCheckpoint(cpId, { aql_limit: limit });
    setIsSuccess(true);
    setStatusMsg("AQL QC checkpoint configurations updated.");
  };

  const handleAqlChange = (cpId: string, val: string) => {
    setEditAql((prev) => ({ ...prev, [cpId]: val }));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Admin Panel</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-secondary" />
            Forge &amp; Fabric Settings Center
          </h1>
        </div>

        {statusMsg && (
          <div className={`p-3 rounded-lg flex items-center gap-2.5 text-sm border ${
            isSuccess 
              ? "bg-success/15 text-success border-success/30" 
              : "bg-error-container text-on-error-container border-error/25"
          }`}>
            {isSuccess ? <UserCheck className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Configuration Tabs */}
        <div className="flex border-b border-border gap-2 overflow-x-auto">
          <button
            onClick={() => { setActiveTab("users"); setStatusMsg(""); }}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "users" 
                ? "border-secondary text-foreground font-bold" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> Users List
          </button>
          <button
            onClick={() => { setActiveTab("customers"); setStatusMsg(""); }}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "customers" 
                ? "border-secondary text-foreground font-bold" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Briefcase className="h-4 w-4" /> Customers Directory
          </button>
          <button
            onClick={() => { setActiveTab("equipment"); setStatusMsg(""); }}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "equipment" 
                ? "border-secondary text-foreground font-bold" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Cog className="h-4 w-4" /> Equipment &amp; Lines
          </button>
          <button
            onClick={() => { setActiveTab("checkpoints"); setStatusMsg(""); }}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "checkpoints" 
                ? "border-secondary text-foreground font-bold" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" /> QC Checkpoints
          </button>
          <button
            onClick={() => { setActiveTab("sizeRatios"); setStatusMsg(""); }}
            className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "sizeRatios" 
                ? "border-secondary text-foreground font-bold" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ruler className="h-4 w-4" /> Size Ratios
          </button>
        </div>

        {/* Tab content area */}
        <div className="space-y-6">

          {/* TAB 1: USERS LIST */}
          {activeTab === "users" && <UserManagement />}

          {/* TAB 2: CUSTOMERS DIRECTORY */}
          {activeTab === "customers" && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column: List Customers */}
              <div className="lg:col-span-2">
                <SectionCard title="Active Retail Accounts">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 pr-4">Company Name</th>
                          <th className="py-2.5 pr-4">Primary Contact</th>
                          <th className="py-2.5 pr-4 text-right">Linked Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map((c) => {
                          const linked = orders.filter((o) => o.customer_name === c.name).length;
                          return (
                            <tr key={c.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                              <td className="py-3 pr-4 font-semibold text-primary">{c.name}</td>
                              <td className="py-3 pr-4 text-muted-foreground font-mono-data text-xs">{c.contact || "—"}</td>
                              <td className="py-3 pr-4 text-right font-medium">{linked} orders</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>

              {/* Right Column: Register Customer */}
              <div>
                <SectionCard title="Register New Account">
                  <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
                    {custFormError && (
                      <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25">
                        <span className="shrink-0">⚠</span>
                        <span>{custFormError}</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Retail Company Name</label>
                      <input
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        placeholder="e.g. Levi Strauss & Co."
                        className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact Email</label>
                      <input
                        type="email"
                        value={custContact}
                        onChange={(e) => setCustContact(e.target.value)}
                        placeholder="sourcing@retailer.com"
                        className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="h-4 w-4" /> Add Retailer
                    </button>
                  </form>
                </SectionCard>
              </div>
            </div>
          )}

          {/* TAB 3: EQUIPMENT & LINES */}
          {activeTab === "equipment" && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column: Equipment list */}
              <div className="lg:col-span-2">
                <SectionCard title="Factory Floor Equipment & Machinery">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 pr-4">Asset ID</th>
                          <th className="py-2.5 pr-4">Equipment Name</th>
                          <th className="py-2.5 pr-4">Type</th>
                          <th className="py-2.5 pr-4">Status</th>
                          <th className="py-2.5 pr-4 text-right">Floor Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipment.map((eq) => {
                          const isActive = eq.status === "Active";
                          return (
                            <tr key={eq.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                              <td className="py-3 pr-4 font-mono-data text-xs text-muted-foreground">{eq.id}</td>
                              <td className="py-3 pr-4 font-semibold text-primary">{eq.name}</td>
                              <td className="py-3 pr-4 text-xs font-medium text-foreground">{eq.type}</td>
                              <td className="py-3 pr-4">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                                  isActive 
                                    ? "bg-success/10 text-success border-success/20" 
                                    : "bg-muted text-muted-foreground border-border"
                                }`}>
                                  {eq.status}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-right">
                                <button
                                  onClick={() => toggleEquipmentStatus(eq.id)}
                                  className={`text-xs font-semibold border px-2 py-0.5 rounded transition-all ${
                                    isActive 
                                      ? "text-destructive hover:bg-destructive/5 border-destructive/25" 
                                      : "text-success hover:bg-success/5 border-success/25"
                                  }`}
                                >
                                  Toggle Status
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>

              {/* Right Column: Register Equipment */}
              <div>
                <SectionCard title="Add Floor Asset">
                  <form onSubmit={handleAddEquipmentSubmit} className="space-y-4">
                    {eqFormError && (
                      <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25">
                        <span className="shrink-0">⚠</span>
                        <span>{eqFormError}</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Asset Name</label>
                      <input
                        value={eqName}
                        onChange={(e) => setEqName(e.target.value)}
                        placeholder="e.g. Jeanologia Laser #3"
                        className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Equipment Type</label>
                      <select
                        value={eqType}
                        onChange={(e) => setEqType(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs focus:outline-none"
                      >
                        <option value="Cutter">Cutter</option>
                        <option value="Sewing Line">Sewing Line</option>
                        <option value="Washer">Washer</option>
                        <option value="Laser">Laser</option>
                        <option value="Presser">Presser</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="h-4 w-4" /> Add Asset
                    </button>
                  </form>
                </SectionCard>
              </div>
            </div>
          )}

          {/* TAB 4: QC CHECKPOINTS CONFIG */}
          {activeTab === "checkpoints" && (
            <SectionCard title="Acceptable Quality Limits (AQL) QC Configurator">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2.5 pr-4">CP ID</th>
                      <th className="py-2.5 pr-4">QC Checkpoint Definition</th>
                      <th className="py-2.5 pr-4">Stage Reference</th>
                      <th className="py-2.5 pr-4">Target AQL Max Limit (%)</th>
                      <th className="py-2.5 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkpoints.map((cp) => {
                      const currentVal = editAql[cp.id] !== undefined ? editAql[cp.id] : cp.aql_limit;
                      return (
                        <tr key={cp.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4 font-mono-data text-xs text-muted-foreground">{cp.id}</td>
                          <td className="py-3 pr-4 font-semibold text-primary">{cp.name}</td>
                          <td className="py-3 pr-4 text-xs font-medium text-foreground">{cp.stage}</td>
                          <td className="py-3 pr-4">
                            <input
                              type="text"
                              value={currentVal}
                              onChange={(e) => handleAqlChange(cp.id, e.target.value)}
                              className="h-8 w-20 rounded border border-outline-variant bg-card text-xs px-2 focus:outline-none focus:ring-1 focus:ring-secondary font-semibold"
                            />
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <button
                              onClick={() => handleSaveCheckpoint(cp.id)}
                              className="bg-primary hover:bg-black text-white hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <Save className="h-3.5 w-3.5" /> Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* TAB 5: SIZE RATIOS MASTER CONFIG */}
          {activeTab === "sizeRatios" && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SectionCard title={`Size Ratios Master Directory (${sizeRatios.length})`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 pr-4">Ratio Name</th>
                          <th className="py-2.5 pr-4">Description / Target Fit</th>
                          <th className="py-2.5 pr-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sizeRatios.map((sr) => (
                          <tr key={sr.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                            <td className="py-3 pr-4 font-bold text-primary">{sr.name}</td>
                            <td className="py-3 pr-4 text-xs text-muted-foreground">{sr.description || "Standard Size Breakdown"}</td>
                            <td className="py-3 pr-4 text-right">
                              <button
                                onClick={() => handleRemoveSizeRatio(sr)}
                                className="text-destructive hover:text-red-700 p-1.5 hover:bg-destructive/10 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                                title="Delete Size Ratio"
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>

              <div>
                <SectionCard title="Register New Size Ratio">
                  {srFormError && (
                    <div className="bg-destructive/15 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs border border-destructive/25 mb-4 font-medium">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{srFormError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAddSizeRatioSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size Ratio Name *</label>
                      <input
                        value={srName}
                        onChange={(e) => setSrName(e.target.value)}
                        placeholder="e.g. 28-38, S-XXL, 24-34"
                        className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs focus:outline-none focus:ring-1 focus:ring-secondary font-semibold"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description / Category</label>
                      <input
                        value={srDesc}
                        onChange={(e) => setSrDesc(e.target.value)}
                        placeholder="e.g. Men's Waist / Women's Denim"
                        className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-card text-xs focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary hover:bg-black text-white h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="h-4 w-4" /> Add Size Ratio
                    </button>
                  </form>
                </SectionCard>
              </div>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  );
}
