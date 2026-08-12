import * as React from "react"

import { cn } from "@/lib/utils"

/** Stage 200.102 — same border/focus tokens as Input (wizard copy fields). */
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base text-foreground shadow-sm transition-colors",
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
Textarea.displayName = "Textarea"

export { Textarea }
