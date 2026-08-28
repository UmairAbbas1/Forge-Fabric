import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../../lib/supabase";
import type { ApplySubmission, ApplyCutSheet, ApplyDocument, MerchandiserAssignment } from "../../lib/types";

export function useSubmissionDetail(submissionId?: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{
    submission: ApplySubmission | null;
    cutSheet: ApplyCutSheet | null;
    documents: ApplyDocument[];
    assignments: MerchandiserAssignment[];
  }>({
    queryKey: ['submission_detail', submissionId],
    queryFn: async () => {
      if (!submissionId) return { submission: null, cutSheet: null, documents: [], assignments: [] };

      if (!isRealSupabase) {
        const cachedSubmissions: ApplySubmission[] = JSON.parse(
          localStorage.getItem('forge_submissions_cache') || '[]'
        );
        const sub = cachedSubmissions.find((s) => s.id === submissionId) || {
          id: submissionId,
          company_name: "Demo Brand",
          contact_name: "Marcus Vance",
          contact_email: "sourcing@demobrand.com",
          contact_phone: "+1 (415) 555-0192",
          brand_name: "Demo Brand Apparel",
          status: "pending_review",
          submission_type: "new_order",
          source: "apply_portal",
          apply_reference_code: "APP-2026-0881",
          client_notes: "Sample cut for 13.5oz Cone Mills Indigo Selvedge denim.",
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ApplySubmission;

        const cutSheet: ApplyCutSheet = {
          id: `cs-${submissionId}`,
          submission_id: submissionId,
          sheet_type: "factory_one_production",
          style_no: "DM-501-RAW",
          style_description: "Classic Straight Leg Selvedge Denim",
          cut_for: "Demo Brand",
          ship_to: "San Francisco Hub #4",
          data_clerk: "Intake Wizard",
          cutter_name: "TBD",
          spreader_name: "TBD",
          sewer_name: "Line 2",
          wash_dx_cd: "Sample Wash — Demo Data",
          laundry_self: "Laundry",
          version: 1.0,
          is_current: true,
          approval_status: "submitted",
          sheet_data: {
            grand_total: 0,
            style_name: "STYLE-MAIN",
            wash_type: "Sample Wash — Demo Data",
            components: [
              {
                component_name: "SELF",
                fabric_code: "",
                fabric_desc: "",
                lot_number: "",
                shade_number: "",
                roll_number: "",
                roll_width: "60",
                roll_width_units: "inches",
                number_of_spreads: 1,
                estimated_yield: 0,
                damage_percent: 0,
                short_percent: 0,
                plies: 1,
                size_columns: ["S", "M", "L", "XL"],
                size_matrix: {},
                color_lot: "",
                total_units: 0,
                ticket_yards: 0,
                yards_cut: 0,
              }
            ],
            trims: {
              buttons: { type: "Vintage Copper Donut Button 22L", qty_per_garment: 5, total_qty: 2285 },
              rivets: { type: "Hidden Rivet Copper LS&CO", qty_per_garment: 6, total_qty: 2742 },
              zippers: { type: "N/A - Button Fly", qty_per_garment: 0, total_qty: 0 },
              thread_outside: "Dual Duty Golden Ochre #40",
              thread_inside: "Navy Blue #50",
              labels: ["Two Horse Leather Patch", "Red Tab Selvedge Hem"]
            }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const documents: ApplyDocument[] = [
          {
            id: "doc-1",
            submission_id: submissionId,
            doc_type: "Tech Pack",
            file_name: "LV_501_1947_TechPack_v2.pdf",
            file_path: "documents/tech_pack.pdf",
            file_size_bytes: 4200000,
            uploaded_at: new Date().toISOString(),
          },
          {
            id: "doc-2",
            submission_id: submissionId,
            doc_type: "Spec Sheet",
            file_name: "Grading_Spec_Sheet_Measurements.xlsx",
            file_path: "documents/spec_sheet.xlsx",
            file_size_bytes: 310000,
            uploaded_at: new Date().toISOString(),
          }
        ];

        return { submission: sub, cutSheet, documents, assignments: [] };
      }

      // Fetch from live Supabase
      const [subRes, cutRes, docRes, assignRes] = await Promise.all([
        supabase.from('apply_submissions').select('*').eq('id', submissionId).single(),
        supabase.from('apply_cut_sheets').select('*').eq('submission_id', submissionId).order('version', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('apply_documents').select('*').eq('submission_id', submissionId),
        supabase.from('merchandiser_assignments').select('*').eq('submission_id', submissionId).order('assigned_at', { ascending: false }),
      ]);

      return {
        submission: subRes.data || null,
        cutSheet: cutRes.data || null,
        documents: docRes.data || [],
        assignments: assignRes.data || [],
      };
    },
    enabled: !!submissionId,
  });

  // Assign Merchandiser Mutation
  const assignMerchandiser = useMutation({
    mutationFn: async ({ merchandiserId, notes }: { merchandiserId: string; notes?: string }) => {
      if (!submissionId) throw new Error("Missing submissionId");

      if (isRealSupabase) {
        const res = await supabase.functions.invoke('assign-submission', {
          body: { submission_id: submissionId, merchandiser_id: merchandiserId, notes },
        });
        if (res.error) throw new Error(res.error.message);
        return res.data;
      }

      // Offline mock assignment
      return { success: true, merchandiser_id: merchandiserId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission_detail', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['merchandiser_submissions'] });
    },
  });

  // Request More Info Mutation
  const requestMoreInfo = useMutation({
    mutationFn: async ({ questions, notes }: { questions: string[]; notes?: string }) => {
      if (!submissionId) throw new Error("Missing submissionId");

      if (isRealSupabase) {
        const res = await supabase.functions.invoke('request-more-info', {
          body: { submission_id: submissionId, questions, notes },
        });
        if (res.error) throw new Error(res.error.message);
        return res.data;
      }

      return { success: true, status: 'needs_info' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission_detail', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['merchandiser_submissions'] });
    },
  });

  // Quick Reject Mutation
  const rejectSubmission = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      if (!submissionId) throw new Error("Missing submissionId");

      if (isRealSupabase) {
        // The approve-reject-submission edge function isn't deployed (404) —
        // replicate its reject branch directly rather than depend on it.
        const { data: submission, error: subFetchErr } = await supabase
          .from('apply_submissions')
          .select('id, status, contact_email, contact_name, apply_reference_code')
          .eq('id', submissionId)
          .single();
        if (subFetchErr || !submission) throw new Error(subFetchErr?.message || 'Submission not found');
        if (submission.status === 'converted') {
          throw new Error('This submission has already been converted into a production order.');
        }

        const internalNote = `[Rejection Reason: ${new Date().toLocaleDateString()}] ${reason}`;
        let { error: rejectError } = await supabase
          .from('apply_submissions')
          .update({
            status: 'rejected',
            internal_notes: internalNote,
            rejection_reason: reason,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', submissionId);

        // rejection_reason is a new column (20260821000000_add_submission_
        // rejection_reason.sql) — if that migration hasn't been applied yet,
        // retry without it so rejecting still works in the meantime.
        if (rejectError && /rejection_reason/i.test(rejectError.message)) {
          ({ error: rejectError } = await supabase
            .from('apply_submissions')
            .update({
              status: 'rejected',
              internal_notes: internalNote,
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', submissionId));
        }
        if (rejectError) throw new Error(rejectError.message);

        // Email audit-trail log (unchanged from the original edge function's behavior).
        try {
          await supabase.from('notification_logs').insert({
            recipient_email: submission.contact_email,
            notification_type: 'submission_rejected',
            subject: `Update regarding your Forge & Fabric order application (${submission.apply_reference_code})`,
            body: `Dear ${submission.contact_name},\n\nThank you for your order submission. After reviewing your specifications, we are unable to accept this order at this time.\n\nReason: ${reason}\n\nPlease contact your merchandiser if you would like to discuss adjustments.`,
            related_submission_id: submissionId,
            sent_at: new Date().toISOString(),
            delivered: true,
            opened: false,
          });
        } catch (notifErr) {
          console.warn('Could not write rejection notification log:', notifErr);
        }

        // In-app bell-icon notification for the customer. notifications has
        // no company/customer column — only order_id — so the submission's
        // own reference code is used as order_id (scopedOrderIds on the
        // customer session recognizes their own reference codes for exactly
        // this reason). Clicking it in the bell dropdown navigates to
        // /orders/$orderId, which already resolves a not-yet-converted
        // submission by reference code.
        try {
          await supabase.from('notifications').insert({
            message: `[REJECTED] Application ${submission.apply_reference_code} was not accepted. Reason: ${reason}`,
            order_id: submission.apply_reference_code,
            type: 'reject',
            stage_id: 1,
            read: false,
          });
        } catch (notifErr) {
          console.warn('Could not write customer-facing rejection notification:', notifErr);
        }

        return { success: true, submission_id: submissionId, action: 'reject', status: 'rejected' };
      }

      return { success: true, status: 'rejected' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission_detail', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['merchandiser_submissions'] });
    },
  });

  // Update Internal Notes
  const updateInternalNotes = useMutation({
    mutationFn: async (notes: string) => {
      if (!submissionId) throw new Error("Missing submissionId");

      if (isRealSupabase) {
        const { error } = await supabase
          .from('apply_submissions')
          .update({ internal_notes: notes, updated_at: new Date().toISOString() })
          .eq('id', submissionId);
        if (error) throw error;
      }
      return { notes };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission_detail', submissionId] });
    },
  });

  return {
    submission: data?.submission,
    cutSheet: data?.cutSheet,
    documents: data?.documents || [],
    assignments: data?.assignments || [],
    isLoading,
    error,
    refetch,
    assignMerchandiser,
    requestMoreInfo,
    rejectSubmission,
    updateInternalNotes,
  };
}
