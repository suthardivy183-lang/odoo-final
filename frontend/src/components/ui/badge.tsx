import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
        outline: "border-border text-muted-foreground",
        success: "border-transparent bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
        warning: "border-transparent bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
        info: "border-transparent bg-primary-wash text-primary ring-1 ring-inset ring-primary/20",
        muted: "border-transparent bg-muted text-muted-foreground ring-1 ring-inset ring-border",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
