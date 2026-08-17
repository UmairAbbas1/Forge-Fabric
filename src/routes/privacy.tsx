import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/PublicLayout";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicLayout>
      <section className="py-24 px-6 md:px-12 bg-surface">
        <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-xl border border-outline-variant/60 shadow-sm">
          <h1 className="font-display-lg text-4xl font-extrabold text-primary mb-8">Privacy Policy</h1>
          <div className="prose prose-sm text-on-surface-variant font-body-sm leading-relaxed space-y-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <p>
              At Forge & Fabric Industries, Inc., we take your privacy and the confidentiality of your industrial data seriously. This Privacy Policy outlines the types of personal information that is received and collected by our systems and how it is used.
            </p>
            <h3 className="font-bold text-primary text-lg">1. Information We Collect</h3>
            <p>
              We collect information that you provide directly to us when you create an account, use our production tracking services, or communicate with us. This includes contact information (like name, email, and phone number) and business details related to your conversion manufacturing orders.
            </p>
            <h3 className="font-bold text-primary text-lg">2. How We Use Information</h3>
            <p>
              The information we collect is used to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve our production tracking platform.</li>
              <li>Communicate with you regarding your orders, quality checkpoints, and dispatch logs.</li>
              <li>Ensure compliance with our internal AQL and security standards.</li>
            </ul>
            <h3 className="font-bold text-primary text-lg">3. Data Security</h3>
            <p>
              We implement industry-standard security measures to protect against the loss, misuse, and alteration of the information under our control. All real-time tracking data and proprietary tech packs uploaded to our platform are kept strictly confidential.
            </p>
            <h3 className="font-bold text-primary text-lg">4. Contact Us</h3>
            <p>
              If you have any questions about this Privacy Policy, please contact us at <strong>faizijaz914@gmail.com</strong>.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
