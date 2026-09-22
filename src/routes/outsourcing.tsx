import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Factory } from "lucide-react";
import { PublicOutsourcingPortal } from "../components/outsourcing/PublicOutsourcingPortal";

// Deliberately public: no login. Field/vendor-site staff open this link
// directly (opens straight to the order picker, no dashboard, no sidebar)
// and log material dispatched to / received from an outside vendor.
// Access control is the `token` query param, checked server-side against
// OUTSOURCING_PORTAL_TOKEN by the outsourcing-portal edge function — see
// that function's header comment for the full reasoning. Admin/merchandiser
// keep using the full app unchanged; this is an additional, narrower door,
// not a replacement for anything.
const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/outsourcing")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Outsourcing Log · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Log material dispatched to and received from an outside vendor." },
    ],
  }),
  component: OutsourcingLinkPage,
});

function OutsourcingLinkPage() {
  const { token } = Route.useSearch();

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div className="max-w-sm space-y-3">
          <Factory className="h-10 w-10 text-neutral-300 mx-auto" />
          <h1 className="font-bold text-neutral-800">Access link required</h1>
          <p className="text-sm text-neutral-500">
            This page needs the full link your manager shared with you (it includes an access code at the end).
          </p>
        </div>
      </div>
    );
  }

  return <PublicOutsourcingPortal token={token} />;
}
