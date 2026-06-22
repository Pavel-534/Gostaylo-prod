'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useListingWizard } from '../../context/ListingWizardContext'
import { ListingWizardPreviewContent } from './ListingWizardPreviewContent'

/**
 * Mobile bottom sheet for live listing preview (<sm only).
 */
export function ListingWizardPreviewSheet({ open, onOpenChange }) {
  const { t } = useListingWizard()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        overlayClassName="z-[340]"
        className={cn(
          'z-[350] flex flex-col gap-0 overflow-hidden bg-background sm:hidden',
          'h-[88dvh] max-h-[88dvh] w-full rounded-t-2xl border-t border-slate-200 p-0',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl',
        )}
      >
        <SheetHeader className="shrink-0 space-y-1 px-4 pr-12 text-left">
          <SheetTitle className="text-lg">{t('livePreview')}</SheetTitle>
          <SheetDescription className="line-clamp-2">{t('thisIsHowGuestsSee')}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-4 pt-3">
          <ListingWizardPreviewContent showHints={false} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
