import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { SubmissionsDashboard } from "../components/merchandiser/SubmissionsDashboard";

export const Route = createFileRoute("/submissions")({
  head: () => ({
    meta: [
      { title: "Submissions Inbox · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Merchandiser order intake and public brand submissions inbox." },
    ],
  }),
  component: SubmissionsPage,
});

function SubmissionsPage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto py-2">
        <SubmissionsDashboard />
      </div>
    </AppShell>
  );
}
