import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.24)_inset,0_10px_22px_-14px_rgba(185,28,28,0.82)] hover:bg-primary-emphasis hover:shadow-md",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-95",
        outline:
          "border border-border-strong bg-white/78 text-foreground shadow-xs backdrop-blur hover:bg-white hover:text-accent-foreground",
        secondary:
          "bg-white/70 text-secondary-foreground shadow-xs ring-1 ring-border/70 hover:bg-white",
        ghost: "text-muted-foreground hover:bg-white/72 hover:text-accent-foreground hover:shadow-xs",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-md px-3 text-[13px]",
        lg: "h-10 rounded-md px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
