import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Mail, ArrowLeft, Building2, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Registration Disabled · Forge & Fabric Industries, Inc." },
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
          Access to Forge &amp; Fabric is by invitation only. Please submit a brand inquiry below to request account setup.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
          
          <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block mb-1">How do I get access?</span>
                Accounts are provisioned via invitation. If you are an apparel brand or team customer, submit your inquiry below to receive your setup invitation link.
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              to="/contact"
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
            >
              <Building2 className="h-4 w-4" /> Submit Brand Access Inquiry
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
