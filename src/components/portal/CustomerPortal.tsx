import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Link } from '@tanstack/react-router';
import { 
  Package, Plus, TrendingUp, Clock, CheckCircle2, FileText, ArrowRight 
} from 'lucide-react';
import { SectionCard } from '../AppShell';

export function CustomerPortal() {
  const { user } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [sampleSubmissions, setSampleSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const custName = user?.customer_name?.toLowerCase()?.trim() || "";
      const custComp = (user as any)?.company_name?.toLowerCase()?.trim() || "";
      const custEmail = user?.email?.toLowerCase()?.trim() || "";

      // 1. Fetch Customer Submissions & Sample Requests FIRST — this is the
      // correctly-scoped source of truth (matches by company name / email)
      // that step 2 below needs, since blanket_pos.customer_id references a
      // legacy, separate `customers` table that isn't reliably linked to
      // this customer's real company_id (a pre-existing data-model split —
      // confirmed live: every blanket_pos row created by the real "Approve
      // & Convert" flow has a customer_id that doesn't match this account).
      let subsList: any[] = [];
      try {
        const { data: subsData, error: subErr } = await supabase
          .from('apply_submissions')
          .select('*')
          .order('created_at', { ascending: false });

        if (!subErr && subsData) {
          subsList = subsData.filter((sub: any) => {
            const matchComp = (custName && (sub.company_name?.toLowerCase()?.includes(custName) || sub.brand_name?.toLowerCase()?.includes(custName))) ||
              (custComp && (sub.company_name?.toLowerCase()?.includes(custComp) || sub.brand_name?.toLowerCase()?.includes(custComp)));
            const matchMail = custEmail && sub.contact_email?.toLowerCase() === custEmail;
            return matchComp || matchMail;
          });
        }
      } catch (e) {
        console.warn('Failed to fetch submissions:', e);
      }

      // Merge localStorage cache as instant fallback
      try {
        const cachedStr = localStorage.getItem("forge_submissions_cache");
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          cached.forEach((c: any) => {
            const matchComp = (custName && (c.company_name?.toLowerCase()?.includes(custName) || c.brand_name?.toLowerCase()?.includes(custName))) ||
              (custComp && (c.company_name?.toLowerCase()?.includes(custComp) || c.brand_name?.toLowerCase()?.includes(custComp)));
            const matchMail = custEmail && c.contact_email?.toLowerCase() === custEmail;
            if ((matchComp || matchMail) && !subsList.some(s => s.id === c.id || (c.apply_reference_code && s.apply_reference_code === c.apply_reference_code))) {
              subsList.push(c);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to read cached submissions:', e);
      }

      setSampleSubmissions(subsList);

      // 2. Fetch converted contracts (Blanket POs). Scoped by matching
      // apply_reference_code against this customer's own submissions
      // (subsList, already correctly scoped above) rather than
      // blanket_pos.customer_id — see note above.
      const refCodes = subsList.map((s: any) => s.apply_reference_code).filter(Boolean);
      if (refCodes.length > 0) {
        try {
          const { data: bpoData, error: bpoErr } = await supabase
            .from('blanket_pos')
            .select('*')
            .in('apply_reference_code', refCodes)
            .order('created_at', { ascending: false });

          if (!bpoErr && bpoData) {
            setPurchaseOrders(bpoData);
          }
        } catch (e) {
          console.warn('Failed to fetch purchase orders:', e);
        }
      } else {
        setPurchaseOrders([]);
      }
    } catch (err) {
      console.error('Failed to fetch customer portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();

    // Listen to real-time submission creations
    const handleCreated = () => fetchCustomerData();
    window.addEventListener("forge_submission_created", handleCreated);
    window.addEventListener("storage", handleCreated);

    return () => {
      window.removeEventListener("forge_submission_created", handleCreated);
      window.removeEventListener("storage", handleCreated);
    };
  }, [user]);

  const activeCount = purchaseOrders.filter(po => po.status === 'Open').length;
  const completedCount = purchaseOrders.filter(po => ['Fulfilled', 'Closed', 'Completed'].includes(po.status)).length;
  // Rejected applications never became an order, and approved/converted
  // ones already show up in "Your Purchase Orders & Contracts" below —
  // neither belongs in the "Active Intake" list too, or the customer sees
  // the same submission twice.
  const activeSampleSubmissions = sampleSubmissions.filter((sub) => {
    const sLow = (sub.status || "").toLowerCase();
    return sLow !== "rejected" && sLow !== "approved" && sLow !== "converted";
  });
  const sampleCount = activeSampleSubmissions.length;

  // Cap the intake tile/row list so it can't render unbounded.
  const [showAllIntakeApplications, setShowAllIntakeApplications] = useState(false);
  const INTAKE_ROW_LIMIT = 4;
  const visibleIntakeApplications = showAllIntakeApplications
    ? activeSampleSubmissions
    : activeSampleSubmissions.slice(0, INTAKE_ROW_LIMIT);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">Welcome, {user?.full_name || user?.customer_name || 'Brand Partner'}!</h1>
          <p className="text-lg text-muted-foreground mt-2">Manage your production orders, sample requests, and spec sheets smoothly.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            to="/apply-intake" 
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3 rounded-2xl shadow-lg hover:shadow-primary/25 hover:bg-primary/90 transition-all transform hover:-translate-y-0.5"
          >
            <Plus className="h-5 w-5" /> Start New Order / Sample
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-3xl p-6 flex items-center gap-5 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Package className="h-7 w-7 text-amber-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-foreground">{activeCount}</div>
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Active POs</div>
          </div>
        </div>
        
        <div className="bg-card border rounded-3xl p-6 flex items-center gap-5 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Clock className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-foreground">{sampleCount}</div>
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Intake &amp; Sample Requests</div>
          </div>
        </div>

        <div className="bg-card border rounded-3xl p-6 flex items-center gap-5 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-foreground">{completedCount}</div>
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Completed Orders</div>
          </div>
        </div>
      </div>

      {/* Active Sample Requests & Applications */}
      <SectionCard
        title={`Active Intake Applications & Sample Requests (${activeSampleSubmissions.length})`}
        description="Track review stage, sampling status, and tech pack audits in real time."
      >
        {loading ? (
          <div className="py-12 text-center text-muted-foreground font-medium">Syncing active requests...</div>
        ) : activeSampleSubmissions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-flex h-16 w-16 rounded-full bg-muted items-center justify-center mb-3">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No Active Sample Requests</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              You don't have any sample requests or intake applications currently in review.
            </p>
            <Link 
              to="/apply-intake" 
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-all text-xs"
            >
              <Plus className="h-4 w-4" /> Submit Sample Request
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Reference / Style</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Request Type</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Quantity &amp; Sizes</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Stage / Status</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Submitted</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleIntakeApplications.map((sub) => {
                  const sLow = (sub.status || "").toLowerCase();
                  const isSample = sub.submission_type === 'sample_request' || sub.order_type === 'sample_request' || sub.product_type?.toLowerCase().includes('sample');
                  const isApproved = sLow === 'approved' || sLow === 'converted';
                  const isSampling = sLow === 'in_development' || sLow === 'in_production' || sLow === 'in_sampling';
                  const isShipped = sLow === 'shipped' || sLow === 'received';
                  const isNeedsInfo = sLow === 'needs_info' || sLow === 'rejected';

                  let statusBadgeClass = "bg-amber-100 text-amber-800 border border-amber-200";
                  let statusLabel = "Under Review";
                  if (isApproved) {
                    statusBadgeClass = "bg-emerald-100 text-emerald-800 border border-emerald-200";
                    statusLabel = "Approved & Converted";
                  } else if (isShipped) {
                    statusBadgeClass = "bg-teal-100 text-teal-800 border border-teal-200";
                    statusLabel = "Sample Shipped";
                  } else if (isSampling) {
                    statusBadgeClass = "bg-blue-100 text-blue-800 border border-blue-200";
                    statusLabel = "In Sampling";
                  } else if (isNeedsInfo) {
                    statusBadgeClass = "bg-red-100 text-red-800 border border-red-200";
                    statusLabel = "Action Required";
                  }

                  const sizeStr = sub.size_breakdown && typeof sub.size_breakdown === 'object'
                    ? Object.entries(sub.size_breakdown).filter(([_, q]) => Number(q) > 0).map(([s, q]) => `${s}:${q}`).join(", ")
                    : "";

                  const refCode = sub.apply_reference_code || `SR-${sub.id?.slice(0, 6) || "PENDING"}`;

                  return (
                    <tr key={sub.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-foreground">{refCode}</div>
                        <div className="text-xs text-muted-foreground">{sub.client_reference_sku || sub.product_type || "Apparel Sample"}</div>
                      </td>
                      <td className="py-4">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-muted text-foreground border">
                          {isSample ? "Sample Request" : (sub.submission_type?.replace(/_/g, ' ') || "Intake Order")}
                        </span>
                      </td>
                      <td className="py-4 font-bold text-xs">
                        <span>{sub.estimated_quantity || 1} pcs</span>
                        {sizeStr && <span className="text-muted-foreground font-mono ml-1.5 font-normal">({sizeStr})</span>}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusBadgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-4 text-muted-foreground text-xs font-medium">
                        {new Date(sub.submitted_at || sub.created_at || Date.now()).toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <Link 
                          to="/apply/status/$referenceCode"
                          params={{ referenceCode: refCode }}
                          search={{ email: sub.contact_email }}
                          className="text-primary font-bold text-xs hover:underline flex items-center gap-1"
                        >
                          Track Status <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {activeSampleSubmissions.length > INTAKE_ROW_LIMIT && !showAllIntakeApplications && (
              <button
                type="button"
                onClick={() => setShowAllIntakeApplications(true)}
                className="mt-3 text-xs font-bold text-primary hover:underline"
              >
                Show all ({activeSampleSubmissions.length})
              </button>
            )}
          </div>
        )}
      </SectionCard>

      {/* PO List */}
      <SectionCard 
        title="Your Purchase Orders & Contracts" 
        description="A complete history of your active and past orders."
      >
        {loading ? (
          <div className="py-12 text-center text-muted-foreground font-medium">Loading your orders...</div>
        ) : purchaseOrders.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex h-20 w-20 rounded-full bg-muted items-center justify-center mb-4">
              <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No orders yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">You haven't created any purchase orders. Click below to start your first order.</p>
            <Link 
              to="/apply-intake" 
              className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground font-bold px-5 py-2.5 rounded-xl hover:bg-secondary/80 transition-all"
            >
              <Plus className="h-4 w-4" /> Start Order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Order Details</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Date Created</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Total Items</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Status</th>
                  <th className="pb-3 font-bold uppercase text-[10px] tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchaseOrders.map((po) => {
                  // blanket_pos carries its own contract total directly —
                  // no po_line_items relation on this table.
                  const totalItems = Number(po.total_contract_qty) || 0;

                  // Status badge styling — blanket_pos.status is a free-form
                  // value (no fixed enum confirmed), so anything besides the
                  // known "Open" state falls back to a neutral badge instead
                  // of guessing at colors for statuses that may not exist.
                  let statusColors = "bg-muted text-muted-foreground";
                  if (po.status === 'Open') statusColors = "bg-amber-100 text-amber-700 border border-amber-200";
                  if (po.status === 'Fulfilled' || po.status === 'Closed' || po.status === 'Completed') statusColors = "bg-emerald-100 text-emerald-700 border border-emerald-200";
                  if (po.status === 'Cancelled') statusColors = "bg-red-100 text-red-700 border border-red-200";

                  return (
                    <tr key={po.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-foreground">{po.po_number}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">Ref: {po.apply_reference_code || 'Not specified'}</div>
                      </td>
                      <td className="py-4 text-muted-foreground font-medium">
                        {po.created_at ? new Date(po.created_at).toLocaleDateString() : 'Not specified'}
                      </td>
                      <td className="py-4 font-bold">
                        {totalItems.toLocaleString()} units
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColors}`}>
                          {(po.status || 'Open').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-4">
                        {/* orders.$orderId.tsx resolves either a real orders
                            row or (falling back) the source apply_submissions
                            record by reference code — this contract hasn't
                            been scheduled into a real production order yet,
                            so the reference code is the only correct link target. */}
                        <Link
                          to="/orders/$orderId"
                          params={{ orderId: po.apply_reference_code || po.po_number }}
                          className="text-foreground font-bold text-xs hover:text-primary flex items-center gap-1 transition-colors"
                        >
                          View Contract <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
