"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { dialogAnchorToRecipe } from "@/lib/layout/mobile-chrome-contract"
import {
  buildVisualViewportPinStyle,
  useVisualViewportFrame,
} from "@/hooks/use-visual-viewport-frame"
import { useMobileDockLock } from "@/hooks/use-mobile-dock-lock"
import {
  OverlayOpenProvider,
  useMirroredOpenState,
  useOverlayOpen,
} from "@/lib/layout/overlay-open-context"

/**
 * Stage 201.46 — Content stays in the React tree while closed; dock lock must
 * follow Root `open`, not Content mount (otherwise every closed Dialog hid tabs).
 */
const Dialog = ({ open, defaultOpen, onOpenChange, children, ...props }) => {
  const { resolvedOpen, isControlled, handleOpenChange } = useMirroredOpenState({
    open,
    defaultOpen,
    onOpenChange,
  })
  return (
    <OverlayOpenProvider open={resolvedOpen}>
      <DialogPrimitive.Root
        open={isControlled ? open : undefined}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
    </OverlayOpenProvider>
  )
}

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[220] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * @param {'top' | 'bottom'} [mobileAnchor='top'] — ADR-201.
 *   `bottom` → recipe `form` (fill visualViewport, sticky footer / keyboard).
 *   `top` → recipe `dialog` (capped to vv; desktop still centered via sm: overrides).
 */
const DialogContent = React.forwardRef(({
  className,
  children,
  showCloseButton = true,
  mobileAnchor = 'top',
  style,
  ...props
}, ref) => {
  const frame = useVisualViewportFrame()
  const contentRef = React.useRef(null)
  const setRefs = React.useCallback(
    (node) => {
      contentRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  const classHintsBottom =
    /\bbottom-0\b/.test(className || '') || /\btop-auto\b/.test(className || '')
  const anchor = mobileAnchor === 'bottom' || classHintsBottom ? 'bottom' : 'top'
  const recipe = dialogAnchorToRecipe(anchor)
  const dialogOpen = useOverlayOpen()
  // Lock only while open + phone viewport (Content mounts even when closed).
  const [isPhone, setIsPhone] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsPhone(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])
  useMobileDockLock(dialogOpen && isPhone)
  const viewportStyle = buildVisualViewportPinStyle(frame, { recipe })

  // Keep focused inputs visible inside the sheet scrollport (iOS mid-form / number pad).
  React.useEffect(() => {
    const root = contentRef.current
    if (!root) return undefined
    const onFocusIn = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (!root.contains(target)) return
      const tag = target.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !target.isContentEditable) {
        return
      }
      window.requestAnimationFrame(() => {
        try {
          target.scrollIntoView({ block: 'center', inline: 'nearest' })
        } catch {
          /* ignore */
        }
      })
    }
    root.addEventListener('focusin', onFocusIn)
    return () => root.removeEventListener('focusin', onFocusIn)
  }, [])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setRefs}
        style={{ ...viewportStyle, ...style }}
        className={cn(
          "fixed z-[220] flex flex-col w-full min-w-0 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-t-xl sm:rounded-lg",
          // Mobile bottom sheets are full-bleed under vv pin; desktop stays centered.
          anchor === 'bottom'
            ? "left-0 right-0 max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none border-b-0 gap-0 sm:left-[50%] sm:right-auto sm:max-w-lg sm:translate-x-[-50%] sm:rounded-lg sm:border-b sm:gap-2"
            : "left-[50%] max-w-[calc(100vw-1rem)] translate-x-[-50%] gap-2 sm:max-w-lg sm:translate-y-[-50%]",
          "overflow-hidden",
          // Desktop: classic centered dialog (override mobile vv pin).
          "sm:!inset-auto sm:!top-[50%] sm:!bottom-auto sm:!left-[50%] sm:!h-auto sm:!max-h-[min(90dvh,720px)] sm:translate-x-[-50%] sm:translate-y-[-50%]",
          className
        )}
        {...props}>
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
