import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { SubmissionsDashboard } from "../components/merchandiser/SubmissionsDashboard";

export const Route = createFileRoute("/submissions")({
  head: () => ({
    meta: [
      { title: "Submissions Inbox · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Merchandiser order intake and public brand submissions inbox." },
    ],
  }),
  component: SubmissionsRouteComponent,
});

function SubmissionsRouteComponent() {
  const matches = useMatches();
  const isChildRoute = matches.some((m) => m.routeId.startsWith("/submissions/"));

  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto py-2">
        <SubmissionsDashboard />
      </div>
    </AppShell>
  );
}
