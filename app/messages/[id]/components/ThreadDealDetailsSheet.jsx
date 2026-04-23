'use client'

import { Button } from '@/components/ui/button'
import { LifeBuoy, Images, Search } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getUIText } from '@/lib/translations'

/**
 * Mobile bottom sheet: deal details + quick tools (mirrors header actions).
 */
export function ThreadDealDetailsSheet({
  open,
  onOpenChange,
  dealDetailsPanel,
  onOpenSupport,
  onOpenMediaGallery,
  onOpenSearch,
  language,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[210] flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-t-2xl border-slate-200 p-0"
      >
        <div className="shrink-0 border-b border-slate-100 bg-background px-6 pb-3 pr-14 pt-5">
          <SheetHeader className="space-y-0 p-0 text-left">
            <SheetTitle className="text-lg font-semibold text-slate-900">
              {getUIText('messengerThread_dealDetails', language)}
            </SheetTitle>
          </SheetHeader>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {dealDetailsPanel}
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 lg:hidden">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {getUIText('messengerThread_toolsSection', language)}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 text-slate-800"
              onClick={() => {
                onOpenChange(false)
                onOpenSupport()
              }}
            >
              <LifeBuoy className="h-4 w-4 shrink-0 text-teal-600" />
              {getUIText('messengerThread_helpSupport', language)}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 text-slate-800"
              onClick={() => {
                onOpenChange(false)
                onOpenMediaGallery()
              }}
            >
              <Images className="h-4 w-4 shrink-0 text-teal-600" />
              {getUIText('messengerThread_mediaInChat', language)}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 text-slate-800"
              onClick={() => {
                onOpenChange(false)
                onOpenSearch()
              }}
            >
              <Search className="h-4 w-4 shrink-0 text-teal-600" />
              {getUIText('messengerThread_searchMessages', language)}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
