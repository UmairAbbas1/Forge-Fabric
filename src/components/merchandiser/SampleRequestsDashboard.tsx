import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import { 
  Beaker, Package, Search, RefreshCw, Filter, 
  Calendar, Layers, Clock, CheckCircle2, AlertCircle, 
  Building2, ArrowUpRight, Sparkles, Truck, Tag, FileText 
} from "lucide-react";
import { SampleRequestDetails } from "./SampleRequestDetails";

export interface UnifiedSampleRequest {
  id: string;
  company_name: string;
  brand_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  sample_type: string;
  fabric_trim_source: string;
  status: string;
  quantity: number;
  size_breakdown?: Record<string, number>;
  tech_pack_url?: string;
  special_instructions?: string;
  client_notes?: string;
  apply_reference_code?: string;
  created_at: string;
  source_table: "apply_submissions" | "sample_requests" | "local_cache";
  is_sample_requests_row?: boolean;
}

export function SampleRequestsDashboard() {
  const [requests, setRequests] = useState<UnifiedSampleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      let combined: UnifiedSampleRequest[] = [];

      // 1. Fetch from apply_submissions where submission_type = 'sample_request' or product_type has Sample
      if (isRealSupabase) {
        try {
          const { data: subsData, error: subsError } = await supabase
            .from("apply_submissions")
            .select("*")
            .or("submission_type.eq.sample_request,order_type.eq.sample_request,product_type.ilike.%Sample%,sample_status.not.is.null")
            .order("created_at", { ascending: false });

          if (!subsError && subsData) {
            subsData.forEach((s: any) => {
              const mainStyle = s.style_blocks?.[0] || {};
              let rawType = s.product_type || mainStyle.sample_type || "Fit Sample";
              if (rawType.endsWith(" Sample")) rawType = rawType.replace(" Sample", "");
              const cleanType = ["Fit", "Photo", "Pre-Production", "Counter", "Design Prototype"].includes(rawType) 
                ? `${rawType} Sample` 
                : (rawType.includes("Sample") ? rawType : `${rawType} Sample`);

              const finalQty = Number(s.estimated_quantity) || 
                (s.size_breakdown && typeof s.size_breakdown === "object"
                  ? Object.values(s.size_breakdown).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
                  : 0) || 1;

              combined.push({
                id: s.id,
                company_name: s.company_name || s.brand_name || "Brand Partner",
                brand_name: s.brand_name || s.company_name,
                contact_name: s.contact_name,
                contact_email: s.contact_email,
                contact_phone: s.contact_phone,
                sample_type: cleanType,
                fabric_trim_source: s.fabric_type || "Factory Sourced",
                status: s.status || "pending_review",
                quantity: Number(finalQty) || 1,
                size_breakdown: s.size_breakdown || mainStyle.size_quantities || {},
                tech_pack_url: s.tech_pack_url,
                special_instructions: s.client_notes,
                client_notes: s.client_notes,
                apply_reference_code: s.apply_reference_code || `SR-${s.id.slice(0, 6)}`,
                created_at: s.created_at || s.submitted_at || new Date().toISOString(),
                source_table: "apply_submissions",
              });
            });
          }
        } catch (e) {
          console.warn("Could not fetch sample requests from apply_submissions:", e);
        }

        // 2. Fetch from sample_requests table with joined companies
        try {
          const { data: srData, error: srError } = await supabase
            .from("sample_requests")
            .select(`
              *,
              companies ( name, code )
            `)
            .order("created_at", { ascending: false });

          if (!srError && srData) {
            srData.forEach((r: any) => {
              // Avoid duplicates if same ID or same reference
              const alreadyExists = combined.some(
                (c) => c.id === r.id || (r.apply_reference_code && c.apply_reference_code === r.apply_reference_code)
              );

              if (!alreadyExists) {
                const finalQty = Number(r.quantity) || 
                  (r.size_breakdown && typeof r.size_breakdown === "object"
                    ? Object.values(r.size_breakdown).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
                    : 0) || 1;

                combined.push({
                  id: r.id,
                  company_name: r.companies?.name || "Brand Partner",
                  brand_name: r.companies?.name,
                  contact_name: r.contact_name,
                  contact_email: r.contact_email,
                  sample_type: r.sample_type ? (r.sample_type.includes("Sample") ? r.sample_type : `${r.sample_type} Sample`) : "Fit Sample",
                  fabric_trim_source: r.fabric_trim_source || "Factory Sourced",
                  status: r.status || "submitted",
                  quantity: Number(finalQty) || 1,
                  size_breakdown: r.size_breakdown || {},
                  tech_pack_url: r.tech_pack_url,
                  special_instructions: r.special_instructions,
                  client_notes: r.special_instructions,
                  apply_reference_code: r.apply_reference_code || `SR-${r.id.slice(0, 6)}`,
                  created_at: r.created_at || new Date().toISOString(),
                  source_table: "sample_requests",
                  is_sample_requests_row: true,
                });
              }
            });
          }
        } catch (e) {
          console.warn("Could not fetch from sample_requests table:", e);
        }
      }

      // 3. Fallback to localStorage cache (forge_submissions_cache)
      try {
        const cachedStr = localStorage.getItem("forge_submissions_cache");
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          cached.forEach((c: any) => {
            const isSample = c.submission_type === "sample_request" || c.order_type === "sample_request" || c.product_type?.includes("Sample");
            const alreadyExists = combined.some(
              (item) => item.id === c.id || (c.apply_reference_code && item.apply_reference_code === c.apply_reference_code)
            );

            if (isSample && !alreadyExists) {
              const finalQty = Number(c.estimated_quantity) || 
                (c.size_breakdown && typeof c.size_breakdown === "object"
                  ? Object.values(c.size_breakdown).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
                  : 0) || 1;

              combined.push({
                id: c.id,
                company_name: c.company_name || c.brand_name || "Brand Partner",
                brand_name: c.brand_name || c.company_name,
                contact_name: c.contact_name,
                contact_email: c.contact_email,
                contact_phone: c.contact_phone,
                sample_type: c.product_type || "Fit Sample",
                fabric_trim_source: c.fabric_type || "Factory Sourced",
                status: c.status || "pending_review",
                quantity: Number(finalQty) || 1,
                size_breakdown: c.size_breakdown || {},
                tech_pack_url: c.tech_pack_url,
                special_instructions: c.client_notes,
                client_notes: c.client_notes,
                apply_reference_code: c.apply_reference_code || `SR-${c.id?.slice(0, 6) || "NEW"}`,
                created_at: c.created_at || c.submitted_at || new Date().toISOString(),
                source_table: "local_cache",
              });
            }
          });
        }
      } catch (e) {
        console.warn("Could not read local storage submissions cache:", e);
      }

      // 4. Default Seed Sample Requests for verified brands if empty
      if (combined.length === 0) {
        combined = [
          {
            id: "sr-wm-01",
            company_name: "WiesMade",
            brand_name: "WiesMade",
            contact_name: "WiesMade Lead",
            contact_email: "wiesmade@forgefabric.com",
            sample_type: "Proto Sample",
            fabric_trim_source: "Factory Sourced",
            status: "in_development",
            quantity: 4,
            size_breakdown: { "30": 1, "32": 2, "34": 1 },
            special_instructions: "Japanese 13.5oz Raw Indigo Selvedge with felled chainstitch seams.",
            client_notes: "Japanese 13.5oz Raw Indigo Selvedge with felled chainstitch seams.",
            apply_reference_code: "SR-WM-2026-01",
            created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
            source_table: "apply_submissions",
          },
          {
            id: "sr-fog-02",
            company_name: "Fear of God",
            brand_name: "Fear of God Essentials",
            contact_name: "Fear of God Merchandiser",
            contact_email: "fearofgod@forgefabric.com",
            sample_type: "Fit Sample",
            fabric_trim_source: "Brand Sourced",
            status: "pending_review",
            quantity: 3,
            size_breakdown: { S: 1, M: 1, L: 1 },
            special_instructions: "Relaxed Vintage Wash Denim Overshirt with Italian Riri hardware.",
            client_notes: "Relaxed Vintage Wash Denim Overshirt with Italian Riri hardware.",
            apply_reference_code: "SR-FOG-2026-02",
            created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
            source_table: "apply_submissions",
          }
        ];
      }

      setRequests(combined);
    } catch (err) {
      console.error("Error loading sample requests pipeline:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-Time WebSocket Channel Subscription
  useEffect(() => {
    if (!isRealSupabase) return;

    const channel = supabase
      .channel("realtime_sample_requests_pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "apply_submissions" }, () => {
        fetchRequests();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sample_requests" }, () => {
        fetchRequests();
      })
      .subscribe();

    // Listen to local event fired by Order Intake wizard
    const handleLocalSubmission = () => {
      fetchRequests();
    };

    window.addEventListener("forge_submission_created", handleLocalSubmission);
    window.addEventListener("storage", handleLocalSubmission);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("forge_submission_created", handleLocalSubmission);
      window.removeEventListener("storage", handleLocalSubmission);
    };
  }, [fetchRequests]);

  // Filtered List
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Status Filter
      if (statusFilter !== "ALL") {
        const s = req.status.toLowerCase();
        if (statusFilter === "pending" && !["pending_review", "submitted"].includes(s)) return false;
        if (statusFilter === "review" && !["in_review", "factory_review", "cost_approval", "waiting_materials"].includes(s)) return false;
        if (statusFilter === "development" && !["in_development", "in_production"].includes(s)) return false;
        if (statusFilter === "shipped" && !["shipped", "received"].includes(s)) return false;
        if (statusFilter === "approved" && !["approved", "converted"].includes(s)) return false;
        if (statusFilter === "rejected" && s !== "rejected") return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mCompany = req.company_name.toLowerCase().includes(q);
        const mBrand = (req.brand_name || "").toLowerCase().includes(q);
        const mType = req.sample_type.toLowerCase().includes(q);
        const mSource = req.fabric_trim_source.toLowerCase().includes(q);
        const mStatus = req.status.toLowerCase().includes(q);
        const mRef = (req.apply_reference_code || "").toLowerCase().includes(q);
        return mCompany || mBrand || mType || mSource || mStatus || mRef;
      }

      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  const selectedRequest = requests.find((r) => r.id === selectedId);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "submitted":
      case "pending_review":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800">Pending Review</span>;
      case "factory_review":
      case "in_review":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800">In Review</span>;
      case "waiting_materials":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-800">Waiting Materials</span>;
      case "cost_approval":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800">Cost Approval</span>;
      case "in_production":
      case "in_development":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800">In Sampling</span>;
      case "shipped":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-cyan-100 text-cyan-800">Shipped</span>;
      case "received":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-teal-100 text-teal-800">Client Received</span>;
      case "approved":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">Sample Approved</span>;
      case "converted":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white">Converted</span>;
      case "rejected":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-800">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-neutral-100 text-neutral-800 capitalize">{status.replace("_", " ")}</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-in fade-in">
      <div className={`space-y-4 ${selectedId ? "lg:col-span-2" : "lg:col-span-3"}`}>
        
        {/* Main Card */}
        <div className="bg-card rounded-2xl border border-border/80 shadow-sm overflow-hidden">
          
          {/* Header with Search and Status Tabs */}
          <div className="p-4 border-b border-border/70 bg-muted/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-primary" />
                  <span>Sample Requests Pipeline</span>
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary">
                    {filteredRequests.length}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time intake stream from Customer Portal, Merchandiser Direct, and Admin Intake.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchRequests()}
                  title="Refresh Pipeline"
                  className="p-2 rounded-xl border bg-background hover:bg-muted text-muted-foreground transition-all shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
                </button>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search brand, style, type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { id: "ALL", label: `All (${requests.length})` },
                { id: "pending", label: "Pending Review" },
                { id: "review", label: "In Review / Costing" },
                { id: "development", label: "In Sampling" },
                { id: "shipped", label: "Shipped" },
                { id: "approved", label: "Approved" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/40 text-muted-foreground font-bold uppercase text-[11px] tracking-wider border-b border-border/70">
                <tr>
                  <th className="px-5 py-3.5">Brand / Reference</th>
                  <th className="px-5 py-3.5">Sample Type</th>
                  <th className="px-5 py-3.5">Sourcing</th>
                  <th className="px-5 py-3.5">Quantity &amp; Sizes</th>
                  <th className="px-5 py-3.5">Stage / Status</th>
                  <th className="px-5 py-3.5 text-right">Received Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      <div className="font-bold text-xs">Syncing real-time sample requests...</div>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <Beaker className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                      <div className="font-extrabold text-foreground text-sm">No Sample Requests Found</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Sample requests submitted via Customer Order Intake or Direct Intake will appear here in real time.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedId(req.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedId === req.id ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-muted/30"
                      }`}
                    >
                      {/* Brand & Ref */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center border border-primary/20 shrink-0">
                            {req.company_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                              {req.company_name}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {req.apply_reference_code}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sample Type */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-muted text-foreground border">
                          <Beaker className="w-3.5 h-3.5 text-primary" />
                          {req.sample_type}
                        </span>
                      </td>

                      {/* Sourcing Scope */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            req.fabric_trim_source === "Brand Sourced"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          <Package className="w-3.5 h-3.5" />
                          {req.fabric_trim_source}
                        </span>
                      </td>

                      {/* Quantity & Sizes */}
                      <td className="px-5 py-4 text-xs font-medium">
                        <span className="font-bold text-foreground">{req.quantity} pcs</span>
                        {req.size_breakdown && Object.keys(req.size_breakdown).length > 0 && (
                          <span className="text-muted-foreground ml-1.5 font-mono">
                            ({Object.entries(req.size_breakdown).map(([k, v]) => `${k}:${v}`).join(", ")})
                          </span>
                        )}
                      </td>

                      {/* Stage / Status */}
                      <td className="px-5 py-4">
                        {getStatusBadge(req.status)}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-right text-muted-foreground text-xs font-medium">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Drawer / Selected Detail */}
      {selectedId && selectedRequest && (
        <div className="lg:col-span-1">
          <SampleRequestDetails
            request={selectedRequest}
            onClose={() => setSelectedId(null)}
            onUpdate={() => fetchRequests()}
          />
        </div>
      )}
    </div>
  );
}
