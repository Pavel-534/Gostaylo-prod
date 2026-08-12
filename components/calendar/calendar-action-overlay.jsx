'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * Stage 188.0 — responsive overlay for partner calendar actions.
 * Mobile (< lg): bottom sheet (90dvh, sticky footer). Desktop: centered dialog.
 */
export function CalendarActionOverlay({
  open,
  onOpenChange,
  isMobile,
  title,
  description,
  children,
  footer,
  wide = false,
}) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          overlayClassName="z-[340]"
          data-testid="partner-cal-action-overlay"
          className={cn(
            'z-[350] flex max-h-[calc(90dvh-var(--app-bottom-nav-height,0px))] w-full max-w-[100vw] min-w-0 flex-col gap-0 overflow-x-hidden overflow-y-hidden',
            '!bottom-[var(--app-bottom-nav-height,0px)] rounded-t-2xl border-t border-border p-0 shadow-2xl',
            'pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4',
          )}
        >
          {title || description ? (
            <SheetHeader className="shrink-0 space-y-1.5 px-4 pr-14 text-left sm:px-5">
              {title ? (
                <SheetTitle className="min-w-0 break-words pr-1 text-lg leading-snug">
                  {title}
                </SheetTitle>
              ) : null}
              {description ? (
                <SheetDescription className="min-w-0 break-words pr-1 text-left leading-snug">
                  {description}
                </SheetDescription>
              ) : null}
            </SheetHeader>
          ) : null}
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-5">
              {footer}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-testid="partner-cal-action-overlay"
          className={cn(
            'gap-0 overflow-x-hidden p-4 sm:p-6',
            wide
              ? 'w-[min(100vw-2rem,32rem)] max-w-[min(100vw-2rem,32rem)] sm:max-w-[500px]'
              : 'w-[min(100vw-2rem,28rem)] max-w-[min(100vw-2rem,28rem)] sm:max-w-[425px]',
          )}
        >
          {title || description ? (
            <DialogHeader className="space-y-2 pr-8 text-left">
              {title ? (
                <DialogTitle className="min-w-0 break-words leading-snug">{title}</DialogTitle>
              ) : null}
              {description ? (
                <DialogDescription className="min-w-0 break-words text-left leading-snug">
                  {description}
                </DialogDescription>
              ) : null}
            </DialogHeader>
          ) : null}
          <div className={cn('min-w-0', wide ? 'grid gap-4 py-4' : 'py-4')}>{children}</div>
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </DialogContent>
    </Dialog>
  )
}

/** Sticky footer button row — 44px touch targets on mobile. */
export function CalendarOverlayFooter({ children, className }) {
  return (
    <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2', className)}>
      {children}
    </div>
  )
}
