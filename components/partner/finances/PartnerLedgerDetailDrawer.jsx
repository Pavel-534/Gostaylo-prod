'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, Archive } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PartnerHostLedgerAmountCell } from '@/components/partner/finances/partner-host-amount-display'
import {
  mapLedgerDescription,
  mapLedgerEventType,
  mapLedgerSide,
} from '@/lib/partner/ledger-display-labels'
import { getUIText } from '@/lib/translations'
import { useIsMobile } from '@/hooks/use-mobile'

function useVisualViewportMaxHeight(fallback = '92dvh') {
  const [maxHeight, setMaxHeight] = useState(fallback)

  useEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        setMaxHeight(`${window.visualViewport.height}px`)
      }
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    return () => window.visualViewport?.removeEventListener('resize', update)
  }, [])

  return maxHeight
}

/**
 * Ledger entry detail — bottom sheet / side panel; CTA opens booking drawer (Stage 186.2).
 */
export function PartnerLedgerDetailDrawer({
  row,
  open,
  onOpenChange,
  language = 'ru',
  isArchivedOutsideList = false,
  onOpenBooking,
}) {
  const isMobile = useIsMobile()
  const side = isMobile ? 'bottom' : 'right'
  const viewportHeight = useVisualViewportMaxHeight()
  const t = (key) => getUIText(key, language)

  if (!row) return null

  const eventLabel = mapLedgerEventType(row.eventType, t)
  const sideLabel = mapLedgerSide(row.side, t)
  const noteLabel = mapLedgerDescription(row.description, t)
  const createdAt = row.createdAt ? format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm') : '—'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        style={side === 'bottom' ? { maxHeight: viewportHeight } : undefined}
        className={
          side === 'bottom'
            ? 'z-[200] flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl border-slate-200 p-0'
            : 'z-[200] flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'
        }
      >
        <div className="shrink-0 border-b border-slate-100 bg-background px-4 pb-3 pr-14 pt-5 sm:px-6">
          <SheetHeader className="space-y-0 p-0 text-left">
            <SheetTitle className="text-lg font-semibold text-slate-900">{eventLabel}</SheetTitle>
            <p className="text-xs text-slate-500 mt-1">{t('partnerFinances_ledgerDetailSubtitle')}</p>
          </SheetHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 space-y-4">
          {isArchivedOutsideList ? (
            <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <Archive className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" aria-hidden />
              <div>
                <Badge variant="secondary" className="mb-1 bg-slate-200/80 text-slate-700">
                  {t('partnerFinances_ledgerArchiveBadge')}
                </Badge>
                <p className="text-xs leading-relaxed text-slate-600">
                  {t('partnerFinances_ledgerArchiveHint')}
                </p>
              </div>
            </div>
          ) : null}
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{t('partnerFinances_ledgerColDate')}</dt>
              <dd className="text-slate-900 tabular-nums">{createdAt}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{t('partnerFinances_ledgerColSide')}</dt>
              <dd className="text-slate-900">{sideLabel}</dd>
            </div>
            <div className="flex justify-between gap-3 items-start">
              <dt className="text-slate-500">{t('partnerFinances_ledgerColAmount')}</dt>
              <dd>
                <PartnerHostLedgerAmountCell thb={row.amountThb ?? 0} />
              </dd>
            </div>
            {noteLabel ? (
              <div>
                <dt className="text-slate-500 mb-1">{t('partnerFinances_ledgerColNote')}</dt>
                <dd className="text-slate-800 leading-relaxed">{noteLabel}</dd>
              </div>
            ) : null}
            {row.bookingId ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t('partnerFinances_ledgerColBooking')}</dt>
                <dd className="font-mono text-xs text-slate-800 break-all">{row.bookingId}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {row.bookingId ? (
          <div className="shrink-0 border-t border-slate-200 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/90">
            <Button
              type="button"
              variant="brand"
              className="w-full min-h-[44px] gap-2"
              onClick={() => onOpenBooking?.(row.bookingId)}
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              {t('partnerFinances_ledgerOpenBooking')}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
