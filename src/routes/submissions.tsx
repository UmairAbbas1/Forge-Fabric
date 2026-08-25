import { createFileRoute, Outlet, useMatches, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "../components/AppShell";
import { SubmissionsDashboard } from "../components/merchandiser/SubmissionsDashboard";
import { useAuth } from "../hooks/useAuth";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const isChildRoute = matches.some((m) => m.routeId.startsWith("/submissions/"));

  useEffect(() => {
    if (user && user.role === "customer") {
      navigate({ to: "/orders" });
    }
  }, [user, navigate]);

  if (user?.role === "customer") {
    return null;
  }

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
