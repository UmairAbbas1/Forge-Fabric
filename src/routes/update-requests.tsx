import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { UpdateRequestBoard } from "../components/merchandiser/UpdateRequestBoard";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/update-requests")({
  head: () => ({
    meta: [
      { title: "Client Update Requests · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Manage and resolve client order change requests, size adjustments, and wash formula modifications." },
    ],
  }),
  component: UpdateRequestsPage,
});

function UpdateRequestsPage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto py-4 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-sky-500" />
            Client Order Update Requests
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Track, review, and apply client change requests to active production cut sheets and work orders.
          </p>
        </div>

        <UpdateRequestBoard />
      </div>
    </AppShell>
  );
}
