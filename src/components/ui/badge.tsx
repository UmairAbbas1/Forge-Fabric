import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-white shadow-2xs",
        secondary:
          "border-border/80 bg-secondary text-secondary-foreground",
        glass:
          "border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/10 backdrop-blur-md text-foreground shadow-2xs",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/20",
        warning:
          "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:bg-amber-500/20",
        destructive:
          "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300 dark:bg-red-500/20",
        outline:
          "border-border text-foreground bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
