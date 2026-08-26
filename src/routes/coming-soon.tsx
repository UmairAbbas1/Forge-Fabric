import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PublicLayout } from "../components/PublicLayout";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/coming-soon")({
  head: () => ({
    meta: [
      { title: "Coming Soon · Forge & Fabric Industries, Inc." },
      { name: "description", content: "Online textile catalog and swatch portal coming soon." },
    ],
  }),
  component: ComingSoonPage,
});

function ComingSoonPage() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="min-h-[75vh] flex items-center justify-center px-4 sm:px-6 py-16 bg-[#FAF8F5]">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-sky-600 border border-sky-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Under Development</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-black text-neutral-950 tracking-tight">
            Coming Soon
          </h1>

          <p className="text-sm text-neutral-600 leading-relaxed font-medium">
            This module is currently being finalized. Please check back soon or explore our 13-stage manufacturing pipeline.
          </p>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  navigate({ to: "/" });
                }
              }}
              className="px-5 py-2.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
