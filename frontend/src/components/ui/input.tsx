import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-white/82 px-3 py-1 text-sm text-foreground shadow-xs backdrop-blur transition-all placeholder:text-muted-foreground/70 outline-none hover:border-border-strong hover:bg-white focus-visible:border-primary focus-visible:bg-white focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
