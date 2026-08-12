import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Stage 200.102 — border via semantic `border-input` (dark token raised in globals.css).
 * Focus: brand-mint ring (no layout shift from border-2). No slate-/hex borders.
 */
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-sm transition-colors box-border",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground",
        "hover:border-ring/45",
        "focus-visible:outline-none focus-visible:border-brand-mint focus-visible:ring-2 focus-visible:ring-brand-mint/40",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
        "md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
