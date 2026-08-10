import React from "react";
import { Check, Scissors, Droplets, Package } from "lucide-react";

export type FlavorRoute = "Full CMT" | "Sew Only" | "Wash & Finish Only" | "Finishing Only";

export interface FlavorSelectorProps {
  value: FlavorRoute;
  onChange: (value: FlavorRoute, startingStage: number) => void;
}

export function FlavorSelector({ value, onChange }: FlavorSelectorProps) {
  const flavors = [
    {
      id: "Full CMT" as FlavorRoute,
      stage: 1,
      title: "Full CMT Package",
      desc: "Starts at Stage 1. Complete marker, cut, sew, wash, and pack.",
      icon: Scissors
    },
    {
      id: "Sew Only" as FlavorRoute,
      stage: 6,
      title: "Sewing Only",
      desc: "Starts at Stage 6. Client provides pre-cut panels.",
      icon: Check
    },
    {
      id: "Wash & Finish Only" as FlavorRoute,
      stage: 9,
      title: "Wash & Laundry",
      desc: "Starts at Stage 9. Client provides stitched raw garments.",
      icon: Droplets
    },
    {
      id: "Finishing Only" as FlavorRoute,
      stage: 12,
      title: "Finishing & Pack",
      desc: "Starts at Stage 12. Trimming, hardware, pressing, tagging.",
      icon: Package
    }
  ];

  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        Process Routing (Flavor)
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {flavors.map((f) => {
          const Icon = f.icon;
          const isSelected = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id, f.stage)}
              className={`flex flex-col items-start p-4 border rounded-xl transition-all text-left ${
                isSelected 
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                  : "border-border/60 hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {f.title}
                </span>
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  Stage {f.stage}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {f.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
