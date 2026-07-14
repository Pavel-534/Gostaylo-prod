'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PartnerHostLedgerAmountCell } from '@/components/partner/finances/partner-host-amount-display'
import { PartnerLedgerRow } from '@/components/partner/finances/PartnerLedgerRow'
import { PartnerLedgerDetailDrawer } from '@/components/partner/finances/PartnerLedgerDetailDrawer'
import { PartnerLedgerLoadMoreSkeleton } from '@/components/partner/finances/PartnerLedgerRowSkeleton'
import { PartnerBookingDetailDrawer } from '@/components/partner/bookings/PartnerBookingDetailDrawer'
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'
import { usePartnerBookingDetail } from '@/hooks/use-partner-booking-detail'
import {
  mapLedgerDescription,
  mapLedgerEventType,
  mapLedgerSide,
} from '@/lib/partner/ledger-display-labels'
import { cn } from '@/lib/utils'

export function ledgerRowKey(row) {
  return row?.entryId || `${row?.journalId}-${row?.createdAt}`
}

function findLedgerRowById(rows, entryId) {
  if (!entryId) return null
  const id = String(entryId)
  return rows.find((row) => String(row.entryId) === id) || null
}

/**
 * Ledger list with master-detail drawers + load more (Stage 186.2 / 186.2b).
 */
export function PartnerFinancesLedger({
  t,
  language = 'ru',
  balanceBreakdown,
  initialBookingId = null,
  onInitialBookingConsumed,
  initialLedgerEntryId = null,
  resolvedLedgerEntry = null,
  onInitialLedgerEntryConsumed,
  ledgerHasMore = false,
  ledgerLoadingMore = false,
  onLoadMore,
}) {
  const { isConvertedDisplay } = usePartnerHostDisplayFx()
  const baseRows = balanceBreakdown?.recentLedgerTransactions || []
  const [injectedArchiveEntry, setInjectedArchiveEntry] = useState(null)

  const baseRowIdSet = useMemo(
    () => new Set(baseRows.map((row) => String(row.entryId))),
    [baseRows],
  )

  const displayRows = useMemo(() => {
    if (!injectedArchiveEntry) return baseRows
    if (findLedgerRowById(baseRows, injectedArchiveEntry.entryId)) return baseRows
    return [{ ...injectedArchiveEntry, _archiveInjected: true }, ...baseRows]
  }, [baseRows, injectedArchiveEntry])

  const amountColLabel = isConvertedDisplay
    ? t('partnerFinances_ledgerColAmountThb')
    : t('partnerFinances_ledgerColAmount')

  const [selectedRow, setSelectedRow] = useState(null)
  const [ledgerDrawerOpen, setLedgerDrawerOpen] = useState(false)
  const [bookingDrawerId, setBookingDrawerId] = useState(null)
  const [bookingDrawerOpen, setBookingDrawerOpen] = useState(false)

  const { booking: bookingDetail, isLoading: bookingDetailLoading } = usePartnerBookingDetail(
    bookingDrawerId,
    { enabled: bookingDrawerOpen && !!bookingDrawerId },
  )

  const openLedgerRow = useCallback((row) => {
    setSelectedRow(row)
    setLedgerDrawerOpen(true)
  }, [])

  const openBookingDrawer = useCallback((bookingId) => {
    setLedgerDrawerOpen(false)
    setBookingDrawerId(String(bookingId))
    setBookingDrawerOpen(true)
  }, [])

  const deepLinkLedgerRow = useMemo(() => {
    if (!initialLedgerEntryId) return null
    const inList = findLedgerRowById(baseRows, initialLedgerEntryId)
    if (inList) return inList
    if (resolvedLedgerEntry && String(resolvedLedgerEntry.entryId) === String(initialLedgerEntryId)) {
      return resolvedLedgerEntry
    }
    return null
  }, [initialLedgerEntryId, baseRows, resolvedLedgerEntry])

  useEffect(() => {
    if (!deepLinkLedgerRow) return
    if (!findLedgerRowById(baseRows, deepLinkLedgerRow.entryId)) {
      setInjectedArchiveEntry(deepLinkLedgerRow)
    }
  }, [deepLinkLedgerRow, baseRows])

  useEffect(() => {
    if (!initialBookingId) return
    setBookingDrawerId(String(initialBookingId))
    setBookingDrawerOpen(true)
    onInitialBookingConsumed?.()
  }, [initialBookingId, onInitialBookingConsumed])

  useEffect(() => {
    if (!deepLinkLedgerRow) return
    openLedgerRow(deepLinkLedgerRow)
    onInitialLedgerEntryConsumed?.()
  }, [deepLinkLedgerRow, openLedgerRow, onInitialLedgerEntryConsumed])

  const isSelectedArchivedOutsideList = useMemo(() => {
    if (!selectedRow) return false
    return !baseRowIdSet.has(String(selectedRow.entryId)) || selectedRow._archiveInjected === true
  }, [selectedRow, baseRowIdSet])

  return (
    <>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-600 shrink-0" />
            {t('partnerFinances_ledgerTitle')}
          </CardTitle>
          <CardDescription>{t('partnerFinances_ledgerDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!displayRows.length && !ledgerLoadingMore ? (
            <p className="text-sm text-slate-500 py-2">{t('partnerFinances_ledgerEmpty')}</p>
          ) : (
            <>
              <div className="md:hidden space-y-3 min-w-0">
                {displayRows.map((row) => (
                  <PartnerLedgerRow
                    key={ledgerRowKey(row)}
                    row={row}
                    language={language}
                    showArchiveBadge={row._archiveInjected === true}
                    selected={
                      selectedRow && ledgerRowKey(selectedRow) === ledgerRowKey(row) && ledgerDrawerOpen
                    }
                    onOpen={openLedgerRow}
                  />
                ))}
                {ledgerLoadingMore ? <PartnerLedgerLoadMoreSkeleton count={2} /> : null}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 -mx-0">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-slate-50 text-slate-600 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">{t('partnerFinances_ledgerColDate')}</th>
                      <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColEvent')}</th>
                      <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColSide')}</th>
                      <th className="px-3 py-2 font-medium text-right">{amountColLabel}</th>
                      <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColBooking')}</th>
                      <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColNote')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayRows.map((row) => {
                      const isSelected =
                        selectedRow && ledgerRowKey(selectedRow) === ledgerRowKey(row) && ledgerDrawerOpen
                      const isArchiveRow = row._archiveInjected === true
                      return (
                        <tr
                          key={ledgerRowKey(row)}
                          role="button"
                          tabIndex={0}
                          onClick={() => openLedgerRow(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openLedgerRow(row)
                            }
                          }}
                          className={cn(
                            'cursor-pointer hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
                            isSelected && 'bg-brand/5',
                            isArchiveRow && 'bg-slate-50/60',
                          )}
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                            {row.createdAt ? format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                            {isArchiveRow ? (
                              <span className="ml-2 inline-flex rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                                {t('partnerFinances_ledgerArchiveBadgeShort')}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-slate-800 text-xs">{mapLedgerEventType(row.eventType, t)}</td>
                          <td className="px-3 py-2">{mapLedgerSide(row.side, t)}</td>
                          <td className="px-3 py-2 text-right">
                            <PartnerHostLedgerAmountCell thb={row.amountThb ?? 0} />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.bookingId ? (
                              <span className="text-brand-hover" title={row.bookingId}>
                                {String(row.bookingId).slice(0, 8)}…
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600 max-w-[240px] truncate">
                            {mapLedgerDescription(row.description, t) || '—'}
                          </td>
                        </tr>
                      )
                    })}
                    {ledgerLoadingMore
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <tr key={`sk-${i}`} className="gsl-shimmer" aria-hidden>
                            <td className="px-3 py-2" colSpan={6}>
                              <div className="h-4 w-full rounded bg-slate-200/80" />
                            </td>
                          </tr>
                        ))
                      : null}
                  </tbody>
                </table>
              </div>

              {ledgerHasMore ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full sm:w-auto"
                    onClick={onLoadMore}
                    disabled={ledgerLoadingMore}
                  >
                    {ledgerLoadingMore ? t('partnerFinances_ledgerLoadMoreLoading') : t('partnerFinances_ledgerLoadMore')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <PartnerLedgerDetailDrawer
        row={selectedRow}
        open={ledgerDrawerOpen}
        onOpenChange={setLedgerDrawerOpen}
        language={language}
        isArchivedOutsideList={isSelectedArchivedOutsideList}
        onOpenBooking={openBookingDrawer}
      />

      <PartnerBookingDetailDrawer
        booking={bookingDetailLoading ? null : bookingDetail}
        open={bookingDrawerOpen}
        isLoading={bookingDetailLoading && bookingDrawerOpen}
        onOpenChange={(open) => {
          setBookingDrawerOpen(open)
          if (!open) setBookingDrawerId(null)
        }}
        language={language}
      />
    </>
  )
}
