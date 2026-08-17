import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/PublicLayout";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicLayout>
      <section className="py-24 px-6 md:px-12 bg-surface">
        <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-xl border border-outline-variant/60 shadow-sm">
          <h1 className="font-display-lg text-4xl font-extrabold text-primary mb-8">Terms of Service</h1>
          <div className="prose prose-sm text-on-surface-variant font-body-sm leading-relaxed space-y-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <p>
              Please read these Terms of Service ("Terms") carefully before using the Forge & Fabric Industries, Inc. industrial tracking platform and manufacturing services.
            </p>
            <h3 className="font-bold text-primary text-lg">1. Agreement to Terms</h3>
            <p>
              By accessing or using our services, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.
            </p>
            <h3 className="font-bold text-primary text-lg">2. Conversion Manufacturing Services</h3>
            <p>
              Forge & Fabric Industries, Inc. provides "cut, make, wash, pack" conversion services. As the customer, you are responsible for supplying all raw materials, including fabric and trims, in a timely manner. We provide the labor, machinery, and facility to convert your materials into finished garments.
            </p>
            <h3 className="font-bold text-primary text-lg">3. Quality and Tolerances</h3>
            <p>
              We operate under industry-standard AQL (Acceptable Quality Limit) methodologies. By utilizing our services, you agree to our standard AQL 2.5 defect thresholds unless a separate quality agreement is negotiated in writing prior to production.
            </p>
            <h3 className="font-bold text-primary text-lg">4. Intellectual Property</h3>
            <p>
              All tech packs, designs, and brand IP provided by you remain your exclusive property. We will not reproduce or share your proprietary designs outside of the scope required for your production run.
            </p>
            <h3 className="font-bold text-primary text-lg">5. Limitation of Liability</h3>
            <p>
              In no event shall Forge & Fabric Industries, Inc. be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of our services or delays in material delivery outside of our control.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
