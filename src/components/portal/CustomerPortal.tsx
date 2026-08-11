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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.company_id) {
      fetchPurchaseOrders(user.company_id);
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchPurchaseOrders = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, 
          po_number, 
          order_date, 
          delivery_due_date, 
          status,
          notes,
          po_line_items (id, ordered_qty, total_amount)
        `)
        .eq('customer_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch POs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user?.company_id) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Clock className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-3xl font-black text-blue-900 tracking-tight mb-3">Account Verification Pending</h2>
          <p className="text-blue-800 text-lg max-w-xl mx-auto mb-8">
            Your brand application is currently being reviewed by our merchandising team. You will be notified once your account is verified and ready to submit orders.
          </p>
          <Link to="/apply-intake" className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-md">
            View Application Status <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    );
  }

  const activeCount = purchaseOrders.filter(po => ['Submitted', 'Approved', 'In_Production'].includes(po.status)).length;
  const completedCount = purchaseOrders.filter(po => po.status === 'Completed').length;
  const draftCount = purchaseOrders.filter(po => po.status === 'Draft').length;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">Welcome, {user.full_name || 'Brand Partner'}!</h1>
          <p className="text-lg text-muted-foreground mt-2">Manage your production orders and contracts smoothly.</p>
        </div>
        <Link 
          to="/apply-intake" 
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3 rounded-2xl shadow-lg hover:shadow-primary/25 hover:bg-primary/90 transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="h-5 w-5" /> Start New Order
        </Link>
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
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-foreground">{completedCount}</div>
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Completed Orders</div>
          </div>
        </div>
        
        <div className="bg-card border rounded-3xl p-6 flex items-center gap-5 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-foreground">{draftCount}</div>
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Draft Contracts</div>
          </div>
        </div>
      </div>

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
                  const totalItems = po.po_line_items?.reduce((acc: number, item: any) => acc + (item.ordered_qty || 0), 0) || 0;
                  
                  // Status badge styling
                  let statusColors = "bg-muted text-muted-foreground";
                  if (po.status === 'Draft') statusColors = "bg-slate-100 text-slate-700";
                  if (po.status === 'Submitted') statusColors = "bg-blue-100 text-blue-700 border border-blue-200";
                  if (po.status === 'Approved') statusColors = "bg-indigo-100 text-indigo-700 border border-indigo-200";
                  if (po.status === 'In_Production') statusColors = "bg-amber-100 text-amber-700 border border-amber-200";
                  if (po.status === 'Completed') statusColors = "bg-emerald-100 text-emerald-700 border border-emerald-200";
                  
                  return (
                    <tr key={po.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-foreground">{po.po_number}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{po.notes || 'No additional notes'}</div>
                      </td>
                      <td className="py-4 text-muted-foreground font-medium">
                        {new Date(po.order_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 font-bold">
                        {totalItems.toLocaleString()} units
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColors}`}>
                          {po.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4">
                        <Link 
                          to="/orders/$orderId" 
                          params={{ orderId: po.id }}
                          className="text-primary font-bold text-xs hover:underline flex items-center gap-1"
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
