import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { useSubmissionDetail } from "../hooks/merchandiser/useSubmissionDetail";
import { CutSheetManager } from "../components/merchandiser/CutSheetManager";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/submissions/$submissionId/cut-sheet")({
  head: () => ({
    meta: [
      { title: "Cut Sheet Specification Editor · Forge & Fabric Industries, Inc." },
    ],
  }),
  component: CutSheetEditorPage,
});

function CutSheetEditorPage() {
  const { submissionId } = useParams({ from: "/submissions/$submissionId/cut-sheet" });
  const { submission, cutSheet, isLoading } = useSubmissionDetail(submissionId);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto py-4 space-y-4">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-neutral-500">
            <Link
              to="/submissions/$submissionId"
              params={{ submissionId }}
              className="hover:text-amber-700 flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Submission Overview
            </Link>
            <span>/</span>
            <span className="text-neutral-800 font-bold">
              Cut Sheet Editor ({submission?.company_name})
            </span>
          </div>

          <div className="flex items-center gap-1 text-neutral-400 font-mono">
            <span>Ref: {submission?.apply_reference_code || submissionId}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-neutral-400">Loading cut sheet data...</div>
        ) : cutSheet ? (
          <CutSheetManager
            cutSheet={cutSheet}
            styleBlocks={(submission?.style_blocks as any) || []}
            referenceCode={submission?.apply_reference_code}
            companyName={submission?.company_name}
            onSave={(updated) => {
              console.log("Saved cut sheet revision:", updated);
            }}
          />
        ) : (
          <div className="p-12 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-200">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-600" />
            <p className="font-semibold text-neutral-700">No Cut Sheet Available</p>
            <p className="text-xs text-neutral-500 mt-1">
              This order submission did not include a structured cut sheet.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
