import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitPullRequestArrow } from "lucide-react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { SectionCard } from "../AppShell";

// Customer's own change requests (quantity, delivery, spec...) with their live
// status, so a request sent from the order screen or the chat assistant is
// visible as "pending" until the merchandiser resolves it. RLS
// (update_req_customer_select) already limits rows to the customer's own email.
const OPEN = ["submitted", "under_review", "approved", "in_progress"];

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800 border-amber-200",
  under_review: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const LABEL: Record<string, string> = {
  submitted: "Pending review",
  under_review: "Under review",
  approved: "Approved",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
  rejected: "Rejected",
};

type Row = {
  id: string;
  request_subject: string;
  request_type: string;
  request_description: string;
  status: string;
  resolution_notes?: string | null;
  created_at: string;
};

export function MyChangeRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);
  const email = (user?.email || "").trim();

  const { data: rows = [] } = useQuery<Row[]>({
    queryKey: ["my_update_requests", email],
    enabled: isRealSupabase && !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("update_requests")
        .select("id,request_subject,request_type,request_description,status,resolution_notes,created_at")
        .ilike("requested_by_email", email)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  // Live refresh when the merchandiser moves a request on the board.
  useEffect(() => {
    if (!isRealSupabase || !email) return;
    const channel = supabase
      .channel("my_update_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "update_requests" }, () =>
        queryClient.invalidateQueries({ queryKey: ["my_update_requests"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [email, queryClient]);

  if (!rows.length) return null;

  const open = rows.filter((r) => OPEN.includes(r.status));
  const resolved = rows.filter((r) => !OPEN.includes(r.status));
  const visible = showResolved ? rows : open;

  return (
    <SectionCard
      title={`My Change Requests (${open.length} pending)`}
      description="Changes you asked F&F to make. Nothing on your order changes until your merchandiser approves it."
      action={
        resolved.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs font-bold text-primary hover:underline"
          >
            {showResolved ? "Show pending only" : `Show all (${rows.length})`}
          </button>
        ) : undefined
      }
    >
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending requests. All your earlier requests have been resolved.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {visible.map((r) => (
            <li key={r.id} className="py-3 flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <GitPullRequestArrow className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-foreground break-words">{r.request_subject}</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${STATUS_STYLE[r.status] || "bg-muted text-muted-foreground border-border"}`}
                  >
                    {LABEL[r.status] || r.status.replace(/_/g, " ")}
                  </span>
                </div>
                {r.request_description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">{r.request_description}</p>
                )}
                {r.resolution_notes && (
                  <p className="text-xs text-foreground mt-1 break-words">
                    <span className="font-bold">F&amp;F note:</span> {r.resolution_notes}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  Sent {new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
