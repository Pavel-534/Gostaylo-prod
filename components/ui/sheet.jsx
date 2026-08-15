"use client";
import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority";
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { sheetFitToRecipe } from "@/lib/layout/mobile-chrome-contract"
import {
  buildVisualViewportPinStyle,
  KEYBOARD_VIEWPORT_SHRINK_PX,
  useVisualViewportFrame,
} from "@/hooks/use-visual-viewport-frame"
import { useMobileDockLock } from "@/hooks/use-mobile-dock-lock"
import { useKeepFocusedFieldVisible } from "@/hooks/use-keep-focused-field-visible"
import {
  OverlayOpenProvider,
  useMirroredOpenState,
  useOverlayOpen,
} from "@/lib/layout/overlay-open-context"

/**
 * Stage 201.46 — wrap Root so SheetContent can read `open`. Content stays mounted
 * while closed; locking on Content mount alone permanently hid the tab bar.
 */
const Sheet = ({ open, defaultOpen, onOpenChange, children, ...props }) => {
  const { resolvedOpen, isControlled, handleOpenChange } = useMirroredOpenState({
    open,
    defaultOpen,
    onOpenChange,
  })
  return (
    <OverlayOpenProvider open={resolvedOpen}>
      <SheetPrimitive.Root
        open={isControlled ? open : undefined}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </SheetPrimitive.Root>
    </OverlayOpenProvider>
  )
}

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
 * @param {'action' | 'form' | 'content' | 'viewport'} [fit='action'] — ADR-201.
 *   `action` (default for bottom): short menu, hug content, flush bottom, safe-area pad.
 *   `form`: fill visualViewport (search / tall editors / sticky CTA).
 *   Legacy aliases: `content` → action, `viewport` → form.
 */
const SheetContent = React.forwardRef(
  ({ side = "right", fit = "action", className, overlayClassName, children, style, ...props }, ref) => {
    const frame = useVisualViewportFrame()
    const sheetOpen = useOverlayOpen()
    const contentRef = React.useRef(null)
    const setRefs = React.useCallback(
      (node) => {
        contentRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )
    const recipe = side === 'bottom' ? sheetFitToRecipe(fit) : null
    const keyboardOpen = (frame?.bottomInset || 0) > KEYBOARD_VIEWPORT_SHRINK_PX
    // Lock only while Root is open — Content React tree stays mounted when closed.
    useMobileDockLock(side === 'bottom' && sheetOpen)
    useKeepFocusedFieldVisible(contentRef, side === 'bottom' && sheetOpen)

    const pinStyle =
      recipe != null
        ? buildVisualViewportPinStyle(frame, { recipe })
        : undefined

    // Keyboard / form: scroll lives in an inner body, not on the sheet shell.
    const shellScrollLocked =
      side === 'bottom' && (recipe === 'form' || keyboardOpen)

    return (
      <SheetPortal>
        <SheetOverlay className={overlayClassName} />
        <SheetPrimitive.Content
          ref={setRefs}
          data-sheet-fit={side === 'bottom' ? fit : undefined}
          data-mobile-chrome={recipe || undefined}
          style={pinStyle ? { ...pinStyle, ...style } : style}
          className={cn(
            sheetVariants({ side }),
            side === 'bottom' && 'flex flex-col min-h-0',
            side === 'bottom' && !shellScrollLocked && 'overflow-y-auto',
            shellScrollLocked && 'overflow-hidden',
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
