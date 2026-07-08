'use client'

/**
 * ADR-102 Phase 2 — adaptive filter shell: Dialog (md+) | Vaul Drawer (<md).
 * Presentational only; draft/apply logic stays in SearchFiltersDialog.
 */

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

/** Radix Select portal above Dialog (z-[120]). */
export const SEARCH_FILTERS_SHELL_SELECT_DIALOG_Z = 'z-[130]'

/** Radix Select portal above Drawer content (z-[230]). */
export const SEARCH_FILTERS_SHELL_SELECT_DRAWER_Z = 'z-[240]'

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   title: string,
 *   children: React.ReactNode,
 *   onReset: () => void,
 *   onApply: () => void,
 *   resetLabel: string,
 *   applyLabel: string,
 * }} props
 */
export function SearchFiltersShell({
  open,
  onOpenChange,
  title,
  children,
  onReset,
  onApply,
  resetLabel,
  applyLabel,
}) {
  const isMobile = useIsMobile()

  const footerDesktop = (
    <DialogFooter className="shrink-0 flex-col gap-2 border-t border-slate-200 bg-background px-6 py-4 sm:flex-row sm:justify-between">
      <Button type="button" variant="ghost" className="text-slate-600" onClick={onReset}>
        {resetLabel}
      </Button>
      <Button type="button" variant="brand" onClick={onApply}>
        {applyLabel}
      </Button>
    </DialogFooter>
  )

  const footerMobile = (
    <div
      className={cn(
        'shrink-0 border-t border-slate-200 bg-background px-4 pt-3',
        'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
      )}
    >
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="brand"
          className="min-h-12 w-full rounded-2xl text-base font-semibold"
          onClick={onApply}
        >
          {applyLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full text-slate-600"
          onClick={onReset}
        >
          {resetLabel}
        </Button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
        <DrawerContent
          className={cn(
            'mt-0 flex max-h-[92dvh] flex-col rounded-t-[28px] border-slate-200 p-0',
            '[&>div:first-child]:mt-3',
          )}
        >
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-1 text-left">
            <DrawerTitle className="text-lg font-semibold text-slate-900">{title}</DrawerTitle>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">{children}</div>

          {footerMobile}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6">{children}</div>

        {footerDesktop}
      </DialogContent>
    </Dialog>
  )
}

export default SearchFiltersShell
