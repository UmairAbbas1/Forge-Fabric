import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { usePermission } from "../hooks/usePermission";
import { useAuth } from "../hooks/useAuth";
import { useSkuMappings, type SkuMappingItem } from "../hooks/useSkuMappings";
import { 
  Link2, Plus, ArrowRight, Tag, Search, Filter, 
  Building2, FileText, Check, Copy, Trash2, 
  Layers, Sparkles, RefreshCw, ShieldCheck, 
  ChevronRight, AlertCircle, HelpCircle
} from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/sku-mapping")({
  component: SkuMapping,
});

function SkuMapping() {
  const { user } = useAuth();
  const canCreate = usePermission("product_master", "create");
  const canDelete = usePermission("product_master", "delete") || user?.role === 'admin' || user?.role === 'super_admin';
  const isCustomer = user?.role === 'customer';

  const {
    mappings,
    allMappings,
    isLoading,
    customerOptions,
    customerPosMap,
    createSkuMapping,
    deleteSkuMapping,
    refreshData
  } = useSkuMappings();

  // Modal / Add Form State
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCustForForm, setSelectedCustForForm] = useState<string>(
    isCustomer ? (user?.customer_name || "WiesMade") : (customerOptions[0] || "WiesMade")
  );
  const [selectedPoForForm, setSelectedPoForForm] = useState<string>("");
  const [isCustomPo, setIsCustomPo] = useState(false);
  const [customPoInput, setCustomPoInput] = useState("");
  const [custSkuInput, setCustSkuInput] = useState("");
  const [factoryCodeInput, setFactoryCodeInput] = useState("");
  const [styleNameInput, setStyleNameInput] = useState("");
  const [colorwayInput, setColorwayInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("ALL");
  const [selectedPoFilter, setSelectedPoFilter] = useState<string>("ALL");

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // PO Options for the currently selected customer in modal
  const poOptionsForForm = useMemo(() => {
    return customerPosMap[selectedCustForForm] || [];
  }, [customerPosMap, selectedCustForForm]);

  // Handle customer change in modal
  const handleCustomerChangeInForm = (custName: string) => {
    setSelectedCustForForm(custName);
    const availablePos = customerPosMap[custName] || [];
    if (availablePos.length > 0) {
      setSelectedPoForForm(availablePos[0].po_number);
      setIsCustomPo(false);
      setStyleNameInput(availablePos[0].style_description || availablePos[0].style_no || "");
      setColorwayInput(availablePos[0].color || "");
    } else {
      setSelectedPoForForm("");
      setIsCustomPo(true);
    }
  };

  // Handle PO change in modal
  const handlePoChangeInForm = (poVal: string) => {
    if (poVal === "__CUSTOM__") {
      setIsCustomPo(true);
      setSelectedPoForForm("__CUSTOM__");
    } else {
      setIsCustomPo(false);
      setSelectedPoForForm(poVal);
      const foundPo = poOptionsForForm.find(p => p.po_number === poVal);
      if (foundPo) {
        if (!styleNameInput) setStyleNameInput(foundPo.style_description || foundPo.style_no || "");
        if (!colorwayInput) setColorwayInput(foundPo.color || "");
      }
    }
  };

  // Auto-generate Factory Code Helper
  const handleAutoGenerateFactoryCode = () => {
    const custPrefix = selectedCustForForm.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || "CST";
    const skuClean = custSkuInput.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || "SKU";
    const randSuffix = Math.floor(100 + Math.random() * 900);
    setFactoryCodeInput(`FF-${custPrefix}-${skuClean}-${randSuffix}`);
  };

  // Open modal with prefilled data
  const handleOpenAddModal = () => {
    const defaultCust = isCustomer ? (user?.customer_name || "WiesMade") : (selectedCustomerFilter !== "ALL" ? selectedCustomerFilter : (customerOptions[0] || "WiesMade"));
    setSelectedCustForForm(defaultCust);
    const availablePos = customerPosMap[defaultCust] || [];
    if (availablePos.length > 0) {
      setSelectedPoForForm(availablePos[0].po_number);
      setIsCustomPo(false);
      setStyleNameInput(availablePos[0].style_description || "");
      setColorwayInput(availablePos[0].color || "");
    } else {
      setIsCustomPo(true);
      setSelectedPoForForm("__CUSTOM__");
    }
    setCustSkuInput("");
    setFactoryCodeInput("");
    setNotesInput("");
    setFormError("");
    setIsAdding(true);
  };

  // Save new SKU mapping
  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const finalPo = isCustomPo ? customPoInput.trim() : selectedPoForForm.trim();

    if (!selectedCustForForm) {
      setFormError("Please select a customer brand.");
      return;
    }
    if (!finalPo) {
      setFormError("Please select or enter a valid PO Number.");
      return;
    }
    if (!custSkuInput.trim()) {
      setFormError("Customer SKU / Style No is required.");
      return;
    }
    if (!factoryCodeInput.trim()) {
      setFormError("Factory Internal Code is required.");
      return;
    }

    setIsSaving(true);
    try {
      await createSkuMapping({
        customer_name: selectedCustForForm,
        brand_name: selectedCustForForm,
        po_number: finalPo,
        customer_sku: custSkuInput.trim(),
        factory_code: factoryCodeInput.trim(),
        style_name: styleNameInput.trim(),
        colorway: colorwayInput.trim(),
        notes: notesInput.trim()
      });

      setIsAdding(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save SKU mapping.");
    } finally {
      setIsSaving(false);
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Distinct POs available in current view for filter dropdown
  const availablePosForFilter = useMemo(() => {
    const targetMappings = selectedCustomerFilter === "ALL" ? mappings : mappings.filter(m => m.customer_name === selectedCustomerFilter);
    const pos = new Set<string>();
    targetMappings.forEach(m => {
      if (m.po_number) pos.add(m.po_number);
    });
    return Array.from(pos).sort();
  }, [mappings, selectedCustomerFilter]);

  // Filtered Table Mappings
  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
      // 1. Customer Filter
      if (selectedCustomerFilter !== "ALL" && m.customer_name !== selectedCustomerFilter) {
        return false;
      }
      // 2. PO Filter
      if (selectedPoFilter !== "ALL" && m.po_number !== selectedPoFilter) {
        return false;
      }
      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCust = m.customer_name.toLowerCase().includes(q);
        const matchPo = m.po_number.toLowerCase().includes(q);
        const matchSku = m.customer_sku.toLowerCase().includes(q);
        const matchFact = m.factory_code.toLowerCase().includes(q);
        const matchStyle = (m.style_name || '').toLowerCase().includes(q);
        const matchColor = (m.colorway || '').toLowerCase().includes(q);
        return matchCust || matchPo || matchSku || matchFact || matchStyle || matchColor;
      }
      return true;
    });
  }, [mappings, selectedCustomerFilter, selectedPoFilter, searchQuery]);

  // KPI Calculations
  const totalMappingsCount = mappings.length;
  const distinctCustomersCount = new Set(mappings.map(m => m.customer_name)).size;
  const distinctPosCount = new Set(mappings.map(m => m.po_number)).size;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        {/* TOP HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 text-primary">
                <Link2 className="h-6 w-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-foreground">
                {isCustomer ? "My Brand SKU & Factory Code Map" : "Customer SKU Mapping Master (A.4)"}
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm max-w-3xl">
              {isCustomer
                ? `Cross-reference your external SKUs and style numbers with Forge & Fabric Industries internal factory codes for active POs.`
                : `Universal routing table linking customer brand PO style references directly to internal shop floor cut tickets, BOMs, and bundle routing.`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refreshData}
              title="Refresh SKU Mappings"
              className="p-2.5 rounded-xl border bg-background hover:bg-muted text-muted-foreground transition-all shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            </button>

            {canCreate && (
              <button 
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 flex items-center gap-2 transition-all shadow-sm active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Map New SKU to PO
              </button>
            )}
          </div>
        </div>

        {/* TENANT STATUS BANNER (FOR CLIENT USERS) */}
        {isCustomer && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">Authenticated Brand Portal</div>
                <div className="text-sm font-extrabold text-foreground">
                  {user?.customer_name || user?.full_name || "WiesMade"} — Verified Production Mappings
                </div>
              </div>
            </div>
            <div className="text-xs font-bold text-muted-foreground bg-background/80 px-3 py-1.5 rounded-xl border">
              Tenant Isolated View
            </div>
          </div>
        )}

        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-card border rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total SKU Mappings</div>
              <div className="text-2xl font-black text-foreground mt-1">{totalMappingsCount}</div>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Tag className="h-5 w-5" />
            </div>
          </div>

          <div className="p-5 bg-card border rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Purchase Orders</div>
              <div className="text-2xl font-black text-foreground mt-1">{distinctPosCount}</div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
          </div>

          <div className="p-5 bg-card border rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Validated Client Brands</div>
              <div className="text-2xl font-black text-foreground mt-1">{distinctCustomersCount}</div>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS RAIL */}
        <div className="p-4 bg-card border rounded-2xl shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search SKU, PO, Factory Code, Style..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>

            {/* Customer Filter Dropdown (Hidden or Disabled for single Customer user) */}
            {!isCustomer ? (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={selectedCustomerFilter}
                  onChange={(e) => {
                    setSelectedCustomerFilter(e.target.value);
                    setSelectedPoFilter("ALL"); // Reset PO filter when customer changes
                  }}
                  className="w-full py-2 px-3 bg-background border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="ALL">🏢 All Customer Brands ({allMappings.length})</option>
                  {customerOptions.map((cust) => (
                    <option key={cust} value={cust}>
                      {cust}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border rounded-xl text-xs font-bold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Brand: {user?.customer_name || "WiesMade"}</span>
              </div>
            )}

            {/* PO Number Filter Dropdown (Dynamically tied to selected customer) */}
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={selectedPoFilter}
                onChange={(e) => setSelectedPoFilter(e.target.value)}
                className="w-full py-2 px-3 bg-background border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="ALL">📋 All PO Numbers ({availablePosForFilter.length})</option>
                {availablePosForFilter.map((po) => (
                  <option key={po} value={po}>
                    {po}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* NEW MAPPING MODAL / INLINE CARD */}
        {isAdding && (
          <div className="bg-muted/40 border-2 border-primary/30 rounded-3xl p-6 shadow-md animate-in fade-in zoom-in-95 duration-150 space-y-6">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary text-primary-foreground rounded-xl">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-foreground text-base">Create New Customer SKU → Factory Code Mapping</h3>
                  <p className="text-xs text-muted-foreground">Link an external buyer style/SKU against a specific verified PO to internal production routing.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted"
              >
                ✕ Close
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMapping} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. CUSTOMER BRAND DROPDOWN */}
                <div>
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    1. Customer / Brand <span className="text-red-500">*</span>
                  </label>
                  {!isCustomer ? (
                    <select
                      required
                      value={selectedCustForForm}
                      onChange={(e) => handleCustomerChangeInForm(e.target.value)}
                      className="w-full p-2.5 bg-background border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      {customerOptions.map((cust) => (
                        <option key={cust} value={cust}>
                          {cust} — Validated CRM
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={selectedCustForForm}
                      className="w-full p-2.5 bg-muted/60 border rounded-xl text-xs font-bold text-foreground"
                    />
                  )}
                </div>

                {/* 2. PO NUMBER DROPDOWN (DYNAMICALLY TIED TO CUSTOMER) */}
                <div>
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    2. Purchase Order (PO) <span className="text-red-500">*</span>
                  </label>
                  {!isCustomPo ? (
                    <div className="space-y-1.5">
                      <select
                        required
                        value={selectedPoForForm}
                        onChange={(e) => handlePoChangeInForm(e.target.value)}
                        className="w-full p-2.5 bg-background border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                      >
                        {poOptionsForForm.map((po) => (
                          <option key={po.po_number} value={po.po_number}>
                            {po.po_number} {po.style_description ? `(${po.style_description})` : ''}
                          </option>
                        ))}
                        <option value="__CUSTOM__">➕ Enter Custom / New PO Number...</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        placeholder="e.g. PO-WM-2026-999"
                        value={customPoInput}
                        onChange={(e) => setCustomPoInput(e.target.value)}
                        className="w-full p-2.5 bg-background border rounded-xl text-xs font-mono font-bold text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomPo(false)}
                        className="px-2.5 py-1 text-[11px] font-bold border rounded-lg bg-background hover:bg-muted text-muted-foreground shrink-0"
                      >
                        Select List
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. CUSTOMER SKU / STYLE NO */}
                <div>
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    3. Customer SKU / Style Ref <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. WM-RAW-SLM-01"
                    value={custSkuInput}
                    onChange={(e) => setCustSkuInput(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-xl text-xs font-mono font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

                {/* 4. FACTORY INTERNAL CODE */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black text-primary uppercase tracking-wider block">
                      4. Factory Code <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateFactoryCode}
                      className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" /> Auto
                    </button>
                  </div>
                  <input
                    required
                    type="text"
                    placeholder="e.g. FF-DEN-SLIM-SLV"
                    value={factoryCodeInput}
                    onChange={(e) => setFactoryCodeInput(e.target.value)}
                    className="w-full p-2.5 bg-primary/5 border border-primary/40 rounded-xl text-xs font-mono font-black text-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

              </div>

              {/* SECONDARY SPECS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Style Description / Garment Type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Japanese Selvedge Slim Jean"
                    value={styleNameInput}
                    onChange={(e) => setStyleNameInput(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-xl text-xs text-foreground"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Colorway / Wash Specification
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Indigo Rinse / Vintage Stone Wash"
                    value={colorwayInput}
                    onChange={(e) => setColorwayInput(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-xl text-xs text-foreground"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Internal Routing Notes / Tech Pack Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 13.5oz cone denim with felled seams"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-xl text-xs text-foreground"
                  />
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/80">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-5 py-2.5 border bg-background rounded-xl text-xs font-bold hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-foreground text-background font-black rounded-xl text-xs hover:bg-foreground/90 transition-all flex items-center gap-2 shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Confirm &amp; Save Mapping
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SKU MAPPINGS DATA TABLE */}
        <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Showing {filteredMappings.length} of {mappings.length} configured SKU mappings</span>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span>Real-Time Backend Synced</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-5 py-3.5 font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Customer Brand</th>
                  <th className="px-5 py-3.5 font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Purchase Order</th>
                  <th className="px-5 py-3.5 font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Customer SKU</th>
                  <th className="px-5 py-3.5 font-bold text-muted-foreground uppercase tracking-wider text-[11px] text-center">Routing</th>
                  <th className="px-5 py-3.5 font-bold text-primary uppercase tracking-wider text-[11px]">Factory Internal Code</th>
                  <th className="px-5 py-3.5 font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Style &amp; Colorway</th>
                  <th className="px-5 py-3.5 font-bold text-muted-foreground uppercase tracking-wider text-[11px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredMappings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <div className="font-bold text-foreground">No SKU Mappings Found</div>
                      <div className="text-xs mt-1">Try resetting your search or customer filter.</div>
                    </td>
                  </tr>
                ) : (
                  filteredMappings.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors group">
                      
                      {/* Customer Brand */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center border border-primary/20 shrink-0">
                            {m.customer_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-extrabold text-foreground text-sm block">{m.customer_name}</span>
                            {m.notes && <span className="text-[10px] text-muted-foreground line-clamp-1">{m.notes}</span>}
                          </div>
                        </div>
                      </td>

                      {/* PO Number */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg font-mono font-bold text-xs text-foreground border">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {m.po_number}
                        </span>
                      </td>

                      {/* Customer SKU */}
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-foreground text-xs bg-muted/40 px-2.5 py-1 rounded-md border">
                          {m.customer_sku}
                        </span>
                      </td>

                      {/* Routing Arrow */}
                      <td className="px-5 py-4 text-center text-muted-foreground">
                        <ArrowRight className="h-4 w-4 inline-block text-primary/60" />
                      </td>

                      {/* Factory Internal Code */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-primary text-xs bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/30 tracking-wide">
                            {m.factory_code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(m.factory_code, m.id)}
                            title="Copy Factory Code"
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          >
                            {copiedId === m.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Style & Colorway */}
                      <td className="px-5 py-4 text-xs">
                        <span className="font-bold text-foreground block">{m.style_name || "Custom Apparel Style"}</span>
                        <span className="text-muted-foreground text-[11px]">{m.colorway || "Standard Colorway"}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(`${m.customer_sku} -> ${m.factory_code}`, `all-${m.id}`)}
                            title="Copy Mapping String"
                            className="px-2 py-1 text-[11px] font-bold border rounded-lg bg-background hover:bg-muted text-muted-foreground transition-all"
                          >
                            {copiedId === `all-${m.id}` ? "Copied!" : "Copy"}
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete mapping for ${m.customer_sku} (${m.factory_code})?`)) {
                                  deleteSkuMapping(m.id);
                                }
                              }}
                              title="Delete SKU Mapping"
                              className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
