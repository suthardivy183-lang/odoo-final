import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight native <select> wrapper styled like shadcn.
 * Keeps the MVP dependency-free (no Radix) while matching the design system.
 */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full appearance-none rounded-md border border-input bg-background bg-[length:16px] bg-[right_0.625rem_center] bg-no-repeat px-3 py-1 pr-9 text-sm text-foreground shadow-xs transition-all outline-none hover:border-border-strong focus-visible:border-primary focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a8f98' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
