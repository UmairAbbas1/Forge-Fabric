import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Package,
  Factory,
  Droplets,
  CheckSquare,
  ArrowUpRight,
  Sparkles,
  Users,
  Award,
  Clock,
  Layers,
  ChevronRight,
  X,
  CheckCircle2,
  Cpu,
  Boxes
} from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge & Fabric Industries, Inc. | Industrial Garment Conversion & Sourcing" },
      { name: "description", content: "Real-time garment production tracking and fabric conversion manufacturing. We convert customer-supplied fabric and trims into finished, high-quality garments." },
      { property: "og:title", content: "Forge & Fabric Industries, Inc. | Industrial Garment Conversion & Sourcing" },
      { property: "og:description", content: "Real-time garment production tracking and fabric conversion manufacturing." },
    ],
  }),
  component: LandingPage,
});

interface StageModalData {
  num: string;
  title: string;
  desc: string;
  equipment: string;
  leadTime: string;
  output: string;
}

function LandingPage() {
  const navigate = useNavigate();
  const [selectedStageModal, setSelectedStageModal] = useState<StageModalData | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const stageDetails: StageModalData[] = [
    {
      num: "01",
      title: "Material Intake & Roll Inspection",
      desc: "Customer-supplied fabric rolls and trims logged, 4-point fabric inspection conducted, and shade lot matching completed.",
      equipment: "Automated Roll Inspection Frame & Color Matching Lightbox",
      leadTime: "12 Hours",
      output: "Approved Fabric Roll Inventory & Inspection Clearance Tag",
    },
    {
      num: "02",
      title: "Precision Spreading & Laser Cutting",
      desc: "Computerized marker planning, vacuum tension spreading, and high precision laser cut panel generation.",
      equipment: "Gerber Automatic Spreader & CNC Laser Cutter",
      leadTime: "18 Hours",
      output: "Bundled Cut Garment Panels & Shade Lot Stickers",
    },
    {
      num: "03",
      title: "Sewing Line Assembly",
      desc: "Modular line assembly with real-time barcode bundle tracking across collar, sleeve, placket, and main body stations.",
      equipment: "Juki Automatic Sewing Machines & Overlock Station",
      leadTime: "36 Hours",
      output: "Assembled Unwashed Garment Shells",
    },
    {
      num: "04",
      title: "Ozone Bio Wash & Garment Dyeing",
      desc: "Sustainable waterless ozone bio wash, vintage stone wash, laser distressing, and color fixation.",
      equipment: "Tonello Industrial Ozone Chamber & Laser Engraver",
      leadTime: "24 Hours",
      output: "Washed Finished Garments with Soft Texture",
    },
    {
      num: "05",
      title: "AQL 2.5 Audit & Goods Dispatch",
      desc: "Final AQL 2.5 quality control audit, steam pressing, price tagging, carton packing, and global shipping dispatch.",
      equipment: "Steam Tunnel Press, Tagging Tacker & Barcode Scanner",
      leadTime: "12 Hours",
      output: "Packed Master Cartons & Dispatch Manifest",
    },
  ];

  return (
    <PublicLayout>
      <div className="bg-[#FAF8F5] min-h-screen py-10 px-4 md:px-12 max-w-7xl mx-auto">
        
        {/* HERO SECTION */}
        <section className="pt-6 pb-12">
          
          {/* Top Headline Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8">
              <h1 className="font-display font-black text-5xl sm:text-7xl lg:text-8xl text-neutral-950 tracking-tight leading-[0.95] select-none">
                Garment Conversion <br />
                <span className="bg-gradient-to-r from-blue-800 via-blue-600 to-sky-400 bg-clip-text text-transparent">Simplified</span>
              </h1>
            </div>

            <div className="lg:col-span-4 pb-2">
              <p className="text-neutral-600 text-sm md:text-base leading-relaxed font-medium max-w-md">
                Custom fabrics, expert support, and 13 stage real-time tracking built for fashion brands, designers, and industrial garment enterprises.
              </p>
            </div>
          </div>

          {/* Thin Separator Line */}
          <div className="my-10 border-t border-neutral-200/90" />

          {/* Hero Bottom Banner Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Card: Testimonial & Big Stat */}
            <div 
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
                transition: "transform 0.15s ease-out",
              }}
              className="lg:col-span-4 flex flex-col justify-between bg-white/80 backdrop-blur border border-blue-100 p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src="/assets/machines/ozone_chambers.png"
                      alt="Production Director"
                      className="w-14 h-14 rounded-full object-cover border-2 border-blue-600 shadow-md"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-blue-700 to-sky-400 text-white rounded-full p-1 shadow">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-700">Client Operations</div>
                    <div className="text-xs text-neutral-500 font-medium">Garment Sourcing &amp; CMT</div>
                  </div>
                </div>

                <blockquote className="text-neutral-700 text-sm italic font-medium leading-relaxed">
                  &ldquo;We deliver fully customized garment conversion at low MOQ with full 13 stage visibility to fashion businesses globally.&rdquo;
                </blockquote>
              </div>

              <div className="pt-8 border-t border-neutral-100 mt-6">
                <div className="font-display font-black text-5xl text-neutral-950 tracking-tight">
                  400<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-sky-400 font-serif font-normal">+</span>
                </div>
                <div className="text-xs font-bold text-blue-700 uppercase tracking-widest mt-1">
                  Private Label Brands
                </div>
              </div>
            </div>

            {/* Right Card: Curved Hero Luxury Denim Garment Presentation */}
            <div className="lg:col-span-8 relative min-h-[360px] md:min-h-[460px] rounded-3xl overflow-hidden group shadow-2xl border border-blue-900/30 bg-neutral-950">
              
              {/* Ultra-High-End Denim Hero Visual */}
              <img
                src="/assets/luxury_denim_hero.png"
                alt="Luxury Industrial Denim Jeans & Jacket Manufacturing"
                draggable={false}
                data-no-lens="true"
                data-lens-widget="false"
                data-no-search="true"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 brightness-[1.02] pointer-events-none select-none"
              />

              {/* Gradient Vignette Overlay for Crisp Contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-transparent to-transparent pointer-events-none" />

              {/* Transparent Event Shield - Blocks browser extension mouse hover popups (PiP / AI Summarizer) */}
              <div className="absolute inset-0 z-10 bg-transparent pointer-events-auto" />

              {/* Floating Bottom-Right Explore Card */}
              <div className="absolute bottom-6 right-6 z-20">
                <Link
                  to="/orders"
                  className="group/btn flex items-center gap-4 bg-gradient-to-r from-blue-800 via-blue-600 to-sky-500 hover:from-sky-500 hover:to-blue-800 text-white p-2.5 pl-6 rounded-full border border-sky-300/30 shadow-xl shadow-blue-900/30 transition-all duration-300"
                >
                  <div className="text-left">
                    <div className="text-xs font-bold uppercase tracking-wider">Explore</div>
                    <div className="text-sm font-black tracking-wide">Garment Conversion</div>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white group-hover/btn:text-neutral-950 transition-all">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </Link>
              </div>

            </div>

          </div>

        </section>

        {/* FACTORY STATS STRIP */}
        <section className="my-12 bg-gradient-to-br from-neutral-950 via-slate-950 to-blue-950 text-white rounded-3xl p-8 md:p-12 shadow-2xl border border-blue-900/40">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
            <div className="space-y-1">
              <div className="text-3xl md:text-4xl font-display font-black text-white">2,450+</div>
              <div className="text-xs font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">Active Machines</div>
              <p className="text-[11px] text-neutral-400">Automated sewing, cutting, and ozone wash</p>
            </div>
            
            <div className="space-y-1 border-l border-neutral-800/80 pl-4 md:pl-8">
              <div className="text-3xl md:text-4xl font-display font-black text-white">13 Stage</div>
              <div className="text-xs font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">Live Pipeline</div>
              <p className="text-[11px] text-neutral-400">Real-time WIP stage tracking</p>
            </div>

            <div className="space-y-1 border-l border-neutral-800/80 pl-4 md:pl-8">
              <div className="text-3xl md:text-4xl font-display font-black text-white">99.8%</div>
              <div className="text-xs font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">On-Time Shipping</div>
              <p className="text-[11px] text-neutral-400">Strict delivery schedule compliance</p>
            </div>

            <div className="space-y-1 border-l border-neutral-800/80 pl-4 md:pl-8">
              <div className="text-3xl md:text-4xl font-display font-black text-white">144K</div>
              <div className="text-xs font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">Daily Units</div>
              <p className="text-[11px] text-neutral-400">High throughput conversion capacity</p>
            </div>
          </div>
        </section>

        {/* 5-PHASE INTERACTIVE PROCESS CARDS */}
        <section className="py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-700">Industrial Process</span>
              <h2 className="text-3xl md:text-4xl font-display font-black text-neutral-950 mt-1">
                5 Core Conversion Phases
              </h2>
              <p className="text-sm text-neutral-600 mt-3 max-w-xl font-medium">
                Our comprehensive 13-stage production pipeline is organized into 5 core phases. Click any phase to inspect the equipment, lead times, and outputs.
              </p>
            </div>
            <Link
              to="/process"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800 hover:text-blue-600 transition-colors"
            >
              <span>View Full 13-Stage Specifications</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {stageDetails.map((stage) => (
              <div
                key={stage.num}
                onClick={() => setSelectedStageModal(stage)}
                className="flex flex-col h-full bg-white border border-neutral-200/90 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-blue-500/80 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-sky-500 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:from-sky-500 group-hover:to-blue-700 transition-all">
                    {stage.num}
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 group-hover:text-blue-600 transition-all" />
                </div>
                <h3 className="font-bold text-base text-neutral-950 group-hover:text-blue-700 transition-colors mb-3">{stage.title}</h3>
                <p className="text-xs text-neutral-600 leading-relaxed line-clamp-3 mb-6 flex-grow">
                  {stage.desc}
                </p>
                <div className="pt-3 border-t border-neutral-100 text-[10px] font-bold text-blue-700 uppercase tracking-wider mt-auto group-hover:text-sky-600 transition-colors">
                  Click to inspect specs ↗
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="my-12 bg-gradient-to-r from-slate-950 via-blue-900 to-sky-600 text-white rounded-3xl p-10 md:p-16 text-center space-y-6 shadow-2xl border border-sky-400/30 relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <h2 className="text-3xl md:text-5xl font-display font-black tracking-tight">
              Ready to Track Your Garment Production?
            </h2>
            <p className="text-white/90 text-sm md:text-base font-medium">
              Access live 13 stage order tracking, material inspection logs, and dispatch manifests in real-time.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/dashboard"
                className="bg-neutral-950 text-white hover:bg-white hover:text-neutral-950 px-8 py-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-lg border border-neutral-800"
              >
                Access Client Portal
              </Link>
              <button
                onClick={() => navigate({ to: "/process" })}
                className="bg-white text-neutral-950 hover:bg-neutral-950 hover:text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-lg cursor-pointer"
              >
                Explore 13 Stage Specs
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* INTERACTIVE STAGE DETAILS MODAL */}
      {selectedStageModal && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-700 to-sky-500 text-white font-bold text-xs grid place-items-center shadow-md">
                  {selectedStageModal.num}
                </span>
                <h3 className="font-bold text-lg text-neutral-950">{selectedStageModal.title}</h3>
              </div>
              <button onClick={() => setSelectedStageModal(null)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-700 leading-relaxed font-medium">
              {selectedStageModal.desc}
            </p>

            <div className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">Equipment Required:</span>
                <span className="font-semibold text-neutral-950">{selectedStageModal.equipment}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">Standard Lead Time:</span>
                <span className="font-semibold text-blue-700">{selectedStageModal.leadTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">Stage Output:</span>
                <span className="font-semibold text-neutral-950">{selectedStageModal.output}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { setSelectedStageModal(null); navigate({ to: "/process" }); }}
                className="w-full bg-neutral-950 text-white hover:bg-blue-700 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
              >
                View Complete 13 Stage Manual
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
