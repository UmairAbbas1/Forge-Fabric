import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/materials")({
  component: MaterialsRedirectPage,
});

function MaterialsRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Cleanly redirect legacy /materials requests to the unified /inventory hub
    navigate({ to: "/inventory", replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-neutral-500">
      <div className="space-y-2">
        <div className="h-6 w-6 border-2 border-amber-600 border-t-transparent animate-spin rounded-full mx-auto" />
        <p>Redirecting to Unified Facility Inventory...</p>
      </div>
    </div>
  );
}
