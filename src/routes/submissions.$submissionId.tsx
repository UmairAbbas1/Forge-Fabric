import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { useSubmissionDetail } from "../hooks/merchandiser/useSubmissionDetail";
import { SubmissionDetailPanel } from "../components/merchandiser/SubmissionDetailPanel";
import { ArrowLeft, Inbox } from "lucide-react";

export const Route = createFileRoute("/submissions/$submissionId")({
  head: () => ({
    meta: [
      { title: "Submission Details · Forge & Fabric" },
    ],
  }),
  component: SubmissionDetailPage,
});

function SubmissionDetailPage() {
  const { submissionId } = useParams({ from: "/submissions/$submissionId" });
  const { submission, isLoading } = useSubmissionDetail(submissionId);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto py-4 space-y-4">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Link to="/submissions" className="hover:text-amber-700 flex items-center gap-1 font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Submissions Inbox
          </Link>
          <span>/</span>
          <span className="text-neutral-800 font-bold font-mono">
            {submission?.apply_reference_code || submissionId}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-neutral-400">Loading submission specifications...</div>
        ) : submission ? (
          <div className="max-w-3xl">
            <SubmissionDetailPanel
              submission={submission}
              onClose={() => window.history.back()}
            />
          </div>
        ) : (
          <div className="p-12 text-center text-neutral-400">Submission not found.</div>
        )}
      </div>
    </AppShell>
  );
}
