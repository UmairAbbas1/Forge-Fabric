import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../../lib/supabase";
import type { UpdateRequest, UpdateRequestStatus, RequestPriority } from "../../lib/types";

const MOCK_UPDATE_REQUESTS: UpdateRequest[] = [
  {
    id: "upd-001",
    work_order_id: "wo-101",
    requested_by_email: "sourcing@demobrand.com",
    request_type: "size_matrix_change",
    request_subject: "Increase Size 34 & 36 breakdown by +15 pcs each",
    request_description: "Retail pre-orders for size 34 and 36 have spiked. Please adjust cut sheet size ratios prior to laying spreads.",
    priority: "urgent",
    status: "submitted",
    attachment_urls: ["https://example.com/revised_matrix.xlsx"],
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: "upd-002",
    work_order_id: "wo-102",
    requested_by_email: "emma@nudiejeans.com",
    request_type: "wash_change",
    request_subject: "Switch wash recipe to Low Water Eco Ozone",
    request_description: "Sustainability compliance check requested reducing wash cycle water ratio by 40% using ozone finishing.",
    priority: "high",
    status: "under_review",
    resolution_notes: "Merchandiser checked chemical availability with laundry manager.",
    created_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: "upd-003",
    work_order_id: "wo-103",
    requested_by_email: "haruki@ironheart.jp",
    request_type: "cut_sheet_update",
    request_subject: "Update thread specs to heavy Poly-Core 40 Tex",
    request_description: "Pocket stitch reinforcement requires heavier gauge thread for Japanese heavyweight denim specification.",
    priority: "normal",
    status: "in_progress",
    created_at: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
  {
    id: "upd-004",
    work_order_id: "wo-104",
    requested_by_email: "j.moreau@apc.fr",
    request_type: "delivery_change",
    request_subject: "Split shipment: 50% Air Freight / 50% Sea",
    request_description: "Expedite initial 250 units to Paris Flagship store via priority air freight.",
    priority: "urgent",
    status: "completed",
    resolution_notes: "Approved and split into 2 manifest shipments. Manifest #MN-881 generated.",
    resolved_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
];

export function useUpdateRequests(orderId?: string) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: requests = [], isLoading, error, refetch } = useQuery<UpdateRequest[]>({
    queryKey: ['update_requests', orderId],
    queryFn: async () => {
      if (!isRealSupabase) {
        const saved = localStorage.getItem('forge_update_requests_cache');
        const list: UpdateRequest[] = saved ? JSON.parse(saved) : MOCK_UPDATE_REQUESTS;
        return orderId ? list.filter((r) => r.work_order_id === orderId) : list;
      }

      let query = supabase.from('update_requests').select('*').order('created_at', { ascending: false });
      if (orderId) query = query.eq('work_order_id', orderId);

      const { data, error } = await query;
      if (error) {
        // Don't silently swap to mock data — surface the real error so a
        // schema/RLS problem is visible instead of looking like "just no
        // requests yet."
        console.error('Failed to fetch update_requests:', error.message);
        throw error;
      }

      return data || [];
    },
  });

  // Real-time listener for Kanban board
  useEffect(() => {
    if (!isRealSupabase) return;

    const channel = supabase
      .channel('update_requests_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'update_requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['update_requests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Update status mutation (drag-and-drop or select)
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
      resolutionNotes,
      newCutSheetId,
    }: {
      requestId: string;
      status: UpdateRequestStatus;
      resolutionNotes?: string;
      newCutSheetId?: string;
    }) => {
      if (isRealSupabase) {
        // The respond-to-update-request edge function isn't reliably
        // deployed (same class of issue as approve/reject on the
        // Submissions Inbox — see useSubmissionDetail.ts) — replicate its
        // update directly rather than depend on it, so a merchandiser's
        // response is never silently lost behind an "Edge Function" error.
        const updates: Record<string, any> = {
          status,
          resolution_notes: resolutionNotes || null,
          updated_at: new Date().toISOString(),
        };
        if (['completed', 'rejected', 'closed'].includes(status)) {
          updates.resolved_at = new Date().toISOString();
        }
        if (newCutSheetId) updates.new_cut_sheet_id = newCutSheetId;

        const { data: updated, error: updateError } = await supabase
          .from('update_requests')
          .update(updates)
          .eq('id', requestId)
          .select('id, blanket_po_id, requested_by_email, request_subject, status')
          .single();

        if (updateError) throw new Error(updateError.message);

        // Best-effort real bell-icon notification back to the customer
        // portal — resolve the request back to a reference
        // notifications_customer_select actually matches on (a real
        // orders.order_id/po_number/apply_reference_code). A failure here
        // must never block the status save that already succeeded above.
        try {
          let orderRef: string | null = null;
          if (updated?.blanket_po_id) {
            const { data: bpo } = await supabase
              .from('blanket_pos')
              .select('apply_reference_code, po_number')
              .eq('id', updated.blanket_po_id)
              .maybeSingle();
            orderRef = bpo?.apply_reference_code || bpo?.po_number || null;
          }
          // Most real orders never went through blanket_pos at all — the
          // ticket's own subject carries the human-readable reference in a
          // leading "[REF]" tag (see useSubmitUpdateRequest), which is a
          // real orders.po_number/order_id/apply_reference_code far more
          // often than it's a blanket_pos row. Resolve against the actual
          // production table directly whenever the blanket_po lookup above
          // didn't find anything.
          if (!orderRef) {
            const tagMatch = updated?.request_subject?.match(/^\[([^\]]+)\]/);
            const rawRef = tagMatch?.[1];
            if (rawRef) {
              const { data: ord } = await supabase
                .from('orders')
                .select('order_id, po_number, apply_reference_code')
                .or(`order_id.eq.${rawRef},po_number.eq.${rawRef},apply_reference_code.eq.${rawRef}`)
                .maybeSingle();
              // order_id is what notifications_customer_select actually
              // compares orders against — prefer it over apply_reference_code
              // (frequently null on real orders) or the raw PO text (which
              // the RLS join would never match).
              orderRef = ord?.order_id || ord?.apply_reference_code || rawRef;
            }
          }
          if (orderRef) {
            const verb = status === 'completed' ? 'APPROVED' : status === 'rejected' ? 'REJECTED' : status.toUpperCase();
            await supabase.from('notifications').insert({
              message: `[REVISION ${verb}] Your requested change "${updated.request_subject}" is now ${status.replace(/_/g, ' ')}.${resolutionNotes ? ` Note: ${resolutionNotes}` : ''}`,
              order_id: orderRef,
              type: status === 'rejected' ? 'reject' : 'approval',
              stage_id: 1,
              read: false,
            });
          }
        } catch (notifErr) {
          console.warn('Could not write customer-facing update-request notification:', notifErr);
        }

        return { success: true, request: updated };
      }

      // Offline mock mutation
      const currentList: UpdateRequest[] = JSON.parse(
        localStorage.getItem('forge_update_requests_cache') || JSON.stringify(MOCK_UPDATE_REQUESTS)
      );
      const updated = currentList.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status,
              resolution_notes: resolutionNotes || r.resolution_notes,
              resolved_at: status === 'completed' || status === 'rejected' ? new Date().toISOString() : r.resolved_at,
              updated_at: new Date().toISOString(),
            }
          : r
      );
      localStorage.setItem('forge_update_requests_cache', JSON.stringify(updated));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['update_requests'] });
    },
  });

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSub = r.request_subject?.toLowerCase().includes(q);
        const matchDesc = r.request_description?.toLowerCase().includes(q);
        const matchEmail = r.requested_by_email?.toLowerCase().includes(q);
        if (!matchSub && !matchDesc && !matchEmail) return false;
      }
      return true;
    });
  }, [requests, statusFilter, priorityFilter, searchQuery]);

  return {
    requests: filteredRequests,
    allRequests: requests,
    isLoading,
    error,
    refetch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    searchQuery,
    setSearchQuery,
    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,
  };
}
