import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Mail, ArrowLeft, Building2, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Registration Disabled · Forge & Fabric" },
      { name: "description", content: "Public account self-registration is disabled. Contact your system administrator to receive an invitation." },
    ],
  }),
  component: RegistrationDisabledPage,
});

function RegistrationDisabledPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-neutral-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
          <Shield className="h-6 w-6" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Public Self-Registration Disabled
        </h2>
        <p className="text-sm text-neutral-400 max-w-sm mx-auto">
          Forge &amp; Fabric operates under strict enterprise Role-Based Access Control (RBAC). Open account creation is not permitted.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
          
          <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block mb-1">How do I get access?</span>
                Accounts are provisioned exclusively via administrator invitations. If you are a team member or brand customer, your system admin or merchandiser will dispatch an invite link to your corporate email.
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">Need Assistance?</h4>
              <p className="text-neutral-400">
                To request access or inquire about onboarding your apparel brand, please reach out to our system administration team:
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href="mailto:admin@forgefabric.com?subject=Account%20Access%20Request%20-%20Forge%20%26%20Fabric"
              className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Mail className="h-4 w-4" /> Contact System Administrator
            </a>

            <Link
              to="/contact"
              className="w-full h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-neutral-700"
            >
              <Building2 className="h-4 w-4" /> Submit Brand Inquiry
            </Link>
          </div>

          <div className="pt-4 border-t border-neutral-800 text-center">
            <Link
              to="/login"
              className="text-xs text-neutral-400 hover:text-white inline-flex items-center gap-1.5 transition-colors font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Return to Login
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
