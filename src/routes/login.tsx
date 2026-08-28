import { createFileRoute } from "@tanstack/react-router";
import { OrganicLandscapeAuth } from "../components/auth/OrganicLandscapeAuth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Sign in to the Forge & Fabric Industries, Inc. Industrial Garment Operations Suite." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return <OrganicLandscapeAuth />;
}
