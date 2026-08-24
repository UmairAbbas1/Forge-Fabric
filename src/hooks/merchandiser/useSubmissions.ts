import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../../lib/supabase";
import type { ApplySubmission, SubmissionStatus, SubmissionType, SubmissionSource } from "../../lib/types";

export interface SubmissionFiltersState {
  status: SubmissionStatus | 'all';
  type: SubmissionType | 'all';
  source: SubmissionSource | 'all';
  assignedTo: 'me' | 'unassigned' | 'all';
  priority: 'all' | 'rush' | 'normal';
  search: string;
  dateRange: 'all' | '7d' | '30d' | '90d';
}

const MOCK_SUBMISSIONS: ApplySubmission[] = [
  {
    id: "sub-101",
    company_name: "Levi Strauss Co.",
    contact_name: "Marcus Vance",
    contact_email: "marcus.v@levi.com",
    contact_phone: "+1 (415) 555-0192",
    brand_name: "Levi's Vintage Clothing",
    website: "https://levi.com",
    status: "pending_review",
    submission_type: "new_order",
    source: "apply_portal",
    apply_reference_code: "APP-2026-0881",
    client_notes: "Please prioritize 13.5oz Raw Indigo Cone Mills denim sample cutting.",
    submitted_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), // 36 hours ago (Aging Yellow)
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
  },
  {
    id: "sub-102",
    company_name: "Nudie Jeans Co.",
    contact_name: "Emma Lindqvist",
    contact_email: "emma@nudiejeans.com",
    contact_phone: "+46 31 600 800",
    brand_name: "Nudie Eco Denim",
    status: "under_review",
    assigned_merchandiser_id: "usr-merch-1",
    submission_type: "new_order",
    source: "merchandiser_intake",
    apply_reference_code: "APP-2026-0914",
    client_notes: "GOTS Certified organic 12.5oz Turkish ring-spun denim.",
    submitted_at: new Date(Date.now() - 52 * 3600 * 1000).toISOString(), // 52 hours ago (Aging Red)
    created_at: new Date(Date.now() - 52 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 52 * 3600 * 1000).toISOString(),
  },
  {
    id: "sub-103",
    company_name: "Iron Heart Denim",
    contact_name: "Haruki Sato",
    contact_email: "haruki@ironheart.jp",
    brand_name: "Iron Heart 21oz Heavy",
    status: "needs_info",
    submission_type: "sample_request",
    source: "apply_portal",
    apply_reference_code: "APP-2026-0940",
    internal_notes: "Awaiting clarification on heavy 21oz selvedge marker width.",
    submitted_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
  {
    id: "sub-104",
    company_name: "A.P.C. Paris",
    contact_name: "Julien Moreau",
    contact_email: "j.moreau@apc.fr",
    status: "converted",
    converted_to_po_id: "po-101",
    submission_type: "new_order",
    source: "apply_portal",
    apply_reference_code: "APP-2026-0792",
    submitted_at: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    reviewed_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
  }
];

const EXCLUDED_SUBMISSION_COMPANIES = new Set([
  'meow', 'meow meow', 'meowsol', 'iwmswsws', 'test brand', 'ahmedsol', 'ahmedsolutions', 'ahmed12', 
  'ahmed', 'alnasser', 'neelam', 'billa', 'billaai', 'billacompany', 'billahouse', 'happyai', 
  'panda', 'testingcompany', 'testingco', 'mycompany', 'bigcompany', 'smallcompany', 'midcompany', 'low company'
]);

export function useSubmissions(currentUserId?: string) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SubmissionFiltersState>({
    status: 'all',
    type: 'all',
    source: 'all',
    assignedTo: 'all',
    priority: 'all',
    search: '',
    dateRange: 'all',
  });

  const { data: submissions = [], isLoading, error, refetch } = useQuery<ApplySubmission[]>({
    queryKey: ['merchandiser_submissions'],
    queryFn: async () => {
      if (!isRealSupabase) {
        const saved = localStorage.getItem('forge_submissions_cache');
        if (saved) {
          try { return JSON.parse(saved); } catch (_) {}
        }
        return MOCK_SUBMISSIONS;
      }

      const { data, error } = await supabase
        .from('apply_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) {
        // Log the error but don't silently swap to mock data — surface it
        console.error('Failed to fetch submissions from Supabase:', error.message);
        throw error; // Let React Query handle the error state
      }

      // Return clean real data, filtering out any test or dummy submissions
      const list = (data || []) as ApplySubmission[];
      return list.filter(s => {
        const comp = s.company_name?.toLowerCase().trim() || '';
        const brand = s.brand_name?.toLowerCase().trim() || '';
        return !EXCLUDED_SUBMISSION_COMPANIES.has(comp) && !EXCLUDED_SUBMISSION_COMPANIES.has(brand);
      });
    },
    staleTime: 10000,
  });

  // Real-time listener for instant inbox updates (Fix #6)
  useEffect(() => {
    if (!isRealSupabase) return;

    const channel = supabase
      .channel('apply_submissions_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'apply_submissions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['merchandiser_submissions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filtered & Search computed view
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Status filter — "all" means "all active applications": a rejected
      // application isn't actionable (can't be converted) and shouldn't
      // clutter the default queue. It stays visible via the explicit
      // "Rejected" filter for reference.
      if (filters.status === 'all') {
        if (sub.status === 'rejected') return false;
      } else if (sub.status !== filters.status) {
        return false;
      }
      // Type filter
      if (filters.type !== 'all' && sub.submission_type !== filters.type) return false;
      // Priority filter — real apply_submissions.priority column
      if (filters.priority === 'rush' && sub.priority !== 'Rush') return false;
      if (filters.priority === 'normal' && sub.priority === 'Rush') return false;
      // Source filter
      if (filters.source !== 'all' && sub.source !== filters.source) return false;
      
      // Assigned filter
      if (filters.assignedTo === 'me' && currentUserId && sub.assigned_merchandiser_id !== currentUserId) {
        return false;
      }
      if (filters.assignedTo === 'unassigned' && sub.assigned_merchandiser_id) {
        return false;
      }

      // Search filter (company, contact, email, reference code)
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchComp = sub.company_name?.toLowerCase().includes(q);
        const matchEmail = sub.contact_email?.toLowerCase().includes(q);
        const matchName = sub.contact_name?.toLowerCase().includes(q);
        const matchRef = sub.apply_reference_code?.toLowerCase().includes(q);
        if (!matchComp && !matchEmail && !matchName && !matchRef) return false;
      }

      return true;
    });
  }, [submissions, filters, currentUserId]);

  // Aging counts computation (Fix #15)
  const agingStats = useMemo(() => {
    const now = Date.now();
    let over24h = 0;
    let over48h = 0;
    let unassigned = 0;
    let pendingReview = 0;

    submissions.forEach((sub) => {
      if (sub.status === 'pending_review' || sub.status === 'under_review') {
        const ageHours = (now - new Date(sub.submitted_at).getTime()) / (1000 * 3600);
        if (ageHours >= 48) over48h++;
        else if (ageHours >= 24) over24h++;
        if (!sub.assigned_merchandiser_id) unassigned++;
        pendingReview++;
      }
    });

    return { over24h, over48h, unassigned, pendingReview, total: submissions.length };
  }, [submissions]);

  return {
    submissions: filteredSubmissions,
    allSubmissions: submissions,
    filters,
    setFilters,
    agingStats,
    isLoading,
    error,
    refetch,
  };
}
