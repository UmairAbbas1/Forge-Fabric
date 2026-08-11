import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { UserManagement } from "../components/settings/UserManagement";

export const Route = createFileRoute("/settings/users")({
  head: () => ({
    meta: [
      { title: "User Management · Forge & Fabric Admin" },
      { name: "description", content: "Role-based user management, customer scoping, and invite provisioning." },
    ],
  }),
  component: UserManagementRoutePage,
});

function UserManagementRoutePage() {
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto py-4">
        <UserManagement />
      </div>
    </AppShell>
  );
}
