import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/PublicLayout";
import { Factory, Cog, Layers } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicLayout>
      <section className="py-24 px-6 md:px-12 bg-surface">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h1 className="font-display-lg text-4xl md:text-5xl font-extrabold text-primary">About Forge & Fabric Industries, Inc.</h1>
            <p className="font-body-lg text-xl text-secondary italic">
              Redefining the industrial conversion model.
            </p>
          </div>

          <div className="prose prose-lg max-w-none text-on-surface-variant font-body-sm leading-relaxed space-y-8">
            <p>
              Most people picture a clothing factory as one that designs, sources fabric, and manufactures a garment from scratch. <strong>A conversion factory works differently.</strong>
            </p>
            
            <p>
              At Forge & Fabric Industries, Inc., we operate on a "cut, make, wash, pack" conversion model. This means:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 not-prose py-8">
              <div className="bg-white p-6 rounded-xl border border-outline-variant/60 shadow-sm text-center">
                <Layers className="w-8 h-8 mx-auto text-secondary mb-4" />
                <h4 className="font-bold text-primary mb-2">1. You Supply</h4>
                <p className="text-sm">The customer supplies the fabric, trims (buttons, zips, labels), and accessories.</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-outline-variant/60 shadow-sm text-center">
                <Cog className="w-8 h-8 mx-auto text-secondary mb-4" />
                <h4 className="font-bold text-primary mb-2">2. We Convert</h4>
                <p className="text-sm">We perform the physical work: cutting, sewing, washing, finishing, and packing.</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-outline-variant/60 shadow-sm text-center">
                <Factory className="w-8 h-8 mx-auto text-secondary mb-4" />
                <h4 className="font-bold text-primary mb-2">3. We Ship</h4>
                <p className="text-sm">The finished garments are shipped back to the customer, ready for retail sale.</p>
              </div>
            </div>

            <p>
              In other words, we are not selling a product. We are selling a <em>service</em> – the labor, the machinery, and the industrial data tracking needed to transform material the customer already owns into a finished garment.
            </p>

            <p>
              This model is utilized by premium brands who want full control over their fabric sourcing for cost, quality, or sustainability reasons, but do not want the capital overhead of operating their own factory.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
