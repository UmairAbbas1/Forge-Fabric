import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/PublicLayout";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/process")({
  component: ProcessPage,
});

function ProcessPage() {
  const stages = [
    { num: 1, title: "Customer Order Intake", desc: "The order is formally logged: purchase order (PO), tech pack, and size breakdown. Output: an internal job card that follows the order through the entire factory." },
    { num: 2, title: "Raw Material Receiving", desc: "The customer's fabric, trims, and accessories physically arrive at the factory and are logged into inventory. Output: a received inventory log confirming exactly what arrived and in what quantity." },
    { num: 3, title: "Fabric & Trim Inspection", desc: "Before anything is cut, the incoming materials are checked for defects, correct color, and correct quantity. This is the first quality checkpoint (Material Check)." },
    { num: 4, title: "Pre-Production Planning", desc: "Using the approved order and materials, the factory builds a production plan: which sewing lines will be used, in what sequence, and on what schedule." },
    { num: 5, title: "Pattern / Marker / Cutting", desc: "The garment pattern is laid out on the fabric to use material efficiently, then the fabric is cut into pieces. Output: cut panels, ready for assembly." },
    { num: 6, title: "Bundling & Line Feeding", desc: "Cut panels are grouped into bundles and delivered to the correct sewing line. This stage is where the second quality checkpoint sits (First Cut Approval)." },
    { num: 7, title: "Sewing Production", desc: "The actual garment assembly: panels are stitched together into a finished garment. Output: stitched garments." },
    { num: 8, title: "Pre-Wash QC", desc: "Before the garments go anywhere near water or chemicals, they are inspected one more time. This is the Inline Sewing QC checkpoint." },
    { num: 9, title: "Laundry / Wash / Dry", desc: "Garments go through industrial washing. This is where a garment gets its final hand-feel and shrinkage is finalized." },
    { num: 10, title: "Laser / Ozone / 3D Finish", desc: "Specialized finishing treatments are applied, especially relevant for denim: laser etching, ozone treatment, and 3D/wrinkle machines." },
    { num: 11, title: "Final Quality Inspection", desc: "A comprehensive inspection of the finished garment, checking stitching, fit, finish, and appearance against the original tech pack. This is the Wash/Finish Approval checkpoint." },
    { num: 12, title: "Pressing / Tagging / Packing", desc: "Approved garments are pressed, tagged (price tags, care labels, brand labels), and packed into cartons." },
    { num: 13, title: "Finished Goods Dispatch", desc: "Packed cartons undergo a final audit (the Final AQL/Packing Audit checkpoint) before being shipped back to the customer along with a Proof of Delivery (POD)." },
  ];

  return (
    <PublicLayout>
      <section className="py-24 px-6 md:px-12 bg-[#FAF8F5]">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-600">Detailed Pipeline</span>
            <h1 className="font-display font-black text-4xl md:text-5xl text-neutral-950">The Thirteen-Stage Production Flow</h1>
            <p className="text-neutral-600 text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed">
              Our conversion model transforms your raw materials into finished, shipped garments through a highly disciplined input/output process.
            </p>
          </div>

          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-sky-200 before:to-transparent">
            {stages.map((stage) => (
              <div key={stage.num} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#FAF8F5] bg-sky-500 text-white font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md z-10 transition-transform group-hover:scale-110">
                  {stage.num}
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-sm hover:shadow-xl hover:border-sky-500 transition-all cursor-pointer group/card">
                  <h3 className="font-bold text-lg text-neutral-950 mb-2 group-hover/card:text-sky-600 transition-colors">
                    {stage.title}
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed font-medium">
                    {stage.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
