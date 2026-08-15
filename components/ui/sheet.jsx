"use client";
import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority";
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  buildVisualViewportPinStyle,
  useVisualViewportFrame,
} from "@/hooks/use-visual-viewport-frame"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[200] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref} />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-[201] gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top max-h-[90dvh] overflow-y-auto",
        bottom:
          "inset-x-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom overflow-hidden",
        left: "inset-y-0 left-0 h-full max-h-[100dvh] w-full sm:w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm overflow-y-auto",
        right:
          "inset-y-0 right-0 h-full max-h-[100dvh] w-full sm:w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm overflow-y-auto",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

/**
 * @param {'right' | 'top' | 'bottom' | 'left'} [side]
 * @param {'content' | 'viewport'} [fit='content'] — Stage 201.38.
 *   `content` (default for bottom): hug thumb zone (auto height, bottom-anchored).
 *   `viewport`: fill visualViewport (tall forms / calendar peek / forced full sheet).
 */
const SheetContent = React.forwardRef(
  ({ side = "right", fit = "content", className, overlayClassName, children, style, ...props }, ref) => {
    const frame = useVisualViewportFrame()
    const pinMode =
      side === 'bottom' ? (fit === 'viewport' ? 'fill' : 'hug') : undefined
    const pinStyle =
      pinMode != null
        ? buildVisualViewportPinStyle(frame, {
            mode: pinMode,
            respectAppBottomNav: true,
          })
        : undefined

    return (
      <SheetPortal>
        <SheetOverlay className={overlayClassName} />
        <SheetPrimitive.Content
          ref={ref}
          data-sheet-fit={side === 'bottom' ? fit : undefined}
          style={pinStyle ? { ...pinStyle, ...style } : style}
          className={cn(
            sheetVariants({ side }),
            side === 'bottom' && 'flex flex-col',
            side === 'bottom' && fit === 'content' && 'overflow-y-auto pb-3',
            // viewport fill: nav pin already clears home indicator; light pad only
            side === 'bottom' && fit === 'viewport' && 'pb-3',
            className,
          )}
          {...props}
        >
          <SheetPrimitive.Close
            className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
          {children}
        </SheetPrimitive.Content>
      </SheetPortal>
    )
  }
)
SheetContent.displayName = SheetPrimitive.Content.displayName


const SheetHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
