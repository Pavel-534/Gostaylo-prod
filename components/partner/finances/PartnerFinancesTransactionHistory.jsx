'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Receipt } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PartnerHostLedgerAmount, PartnerHostMidFxFootnote } from '@/components/partner/finances/partner-host-amount-display'
import { snapshotMoney, resolveBookingStatusBadge } from '@/components/partner/finances/partner-finances-shared'
import { getHostMoneyStage } from '@/lib/booking/host-money-stage'
import { PartnerBookingIncomeKindBadge } from '@/components/partner/finances/PartnerBookingIncomeKindBadge'
import { PartnerBookingPayoutPreviewLine } from '@/components/partner/finances/PartnerBookingPayoutPreviewLine'
import { PartnerBookingTransactionRow } from '@/components/partner/finances/PartnerBookingTransactionRow'

function BookingStatusCell({ booking, t, language }) {
  const st = resolveBookingStatusBadge(booking, { t })
  const moneyStage = getHostMoneyStage(st.uiStatus, language, booking)
  return (
    <>
      <Badge className={`text-xs ${st.badgeClass}`} title={moneyStage?.eta || st.dbStatus}>
        {st.label}
      </Badge>
      {moneyStage?.eta ? (
        <p className="text-xs text-slate-600 mt-1 leading-snug">{moneyStage.eta}</p>
      ) : null}
    </>
  )
}

function buildTransactionRow(booking, t, getBookingPayoutPreview) {
  const { gross, fee, net } = snapshotMoney(booking)
  const payoutPreview = getBookingPayoutPreview?.(booking)
  const checkIn = booking.checkIn || booking.check_in
  const checkOut = booking.checkOut || booking.check_out
  const dateRange =
    checkIn && checkOut
      ? `${format(new Date(checkIn), 'dd.MM.yyyy')} → ${format(new Date(checkOut), 'dd.MM.yyyy')}`
      : '—'

  return {
    gross,
    fee,
    net,
    payoutPreview,
    dateRange,
    listingTitle: booking.listing?.title || t('listing'),
    guestName: booking.guestName || booking.guest_name || 'N/A',
  }
}

export function PartnerFinancesTransactionHistory({
  t,
  language,
  transactionSectionRef,
  escrowBookingFilter,
  isLoading,
  isError,
  error,
  onRefetch,
  bookings,
  displayedBookings,
  getBookingPayoutPreview,
  payoutPreviewBatchLoading,
  hasPayoutProfile,
  onOpenSnapshot,
}) {
  return (
    <Card ref={transactionSectionRef} className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{t('transactionHistory')}</CardTitle>
        <CardDescription>{t('transactionHistoryDesc')}</CardDescription>
        {hasPayoutProfile ? (
          <p className="text-xs text-slate-500 mt-2">{t('stage180_payoutVsLedgerDisclaimer')}</p>
        ) : null}
        <PartnerHostMidFxFootnote t={t} className="mt-1" />
        {escrowBookingFilter ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-sm text-brand sm:flex-row sm:items-center sm:justify-between">
            <span>{t('partnerFinances_escrowFilterBanner')}</span>
            <Link
              href="/partner/finances"
              className="inline-flex min-h-[44px] items-center shrink-0 font-semibold text-brand-hover underline underline-offset-2 hover:text-brand"
            >
              {t('partnerFinances_escrowFilterShowAll')}
            </Link>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="min-w-0">
        {isLoading ? (
          <div className="space-y-3 md:space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-100 gsl-shimmer" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <p className="mb-2 text-slate-700 font-medium">{t('failedToLoad')}</p>
            <p className="text-sm text-slate-500 mb-4">{error?.message}</p>
            <Button onClick={() => onRefetch()} variant="outline" className="min-h-[44px]">
              {t('retry')}
            </Button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">{t('noTransactions')}</h3>
            <p>{t('noTransactionsDesc')}</p>
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="text-center py-10 text-slate-600">
            <p className="font-medium text-slate-800 mb-2">{t('partnerFinances_noEscrowTitle')}</p>
            <p className="text-sm text-slate-500 mb-4">{t('partnerFinances_noEscrowRows')}</p>
            <Button variant="outline" asChild className="min-h-[44px]">
              <Link href="/partner/finances">{t('partnerFinances_escrowFilterShowAll')}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3 min-w-0">
              {displayedBookings.map((booking) => {
                const row = buildTransactionRow(booking, t, getBookingPayoutPreview)
                return (
                  <PartnerBookingTransactionRow
                    key={booking.id}
                    booking={booking}
                    row={row}
                    language={language}
                    t={t}
                    hasPayoutProfile={hasPayoutProfile}
                    payoutPreviewBatchLoading={payoutPreviewBatchLoading}
                    onOpenSnapshot={onOpenSnapshot}
                  />
                )
              })}
            </div>

            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-slate-50 text-slate-600 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('listing')}</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">{t('partnerFinances_colDate')}</th>
                    <th className="px-3 py-2 font-medium">{t('partnerFinances_colStatus')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_colGross')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('fee')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_colFinal')}</th>
                    <th className="px-3 py-2 font-medium text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedBookings.map((booking) => {
                    const row = buildTransactionRow(booking, t, getBookingPayoutPreview)
                    return (
                      <tr key={booking.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-3 align-top min-w-0">
                          <div className="font-medium text-slate-900 break-words">{row.listingTitle}</div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {t('guest')}: {row.guestName}
                          </p>
                          <div className="mt-1">
                            <PartnerBookingIncomeKindBadge
                              categorySlug={booking.financial_snapshot?.category_slug}
                              t={t}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-slate-700 text-sm">
                          {row.dateRange}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <BookingStatusCell booking={booking} t={t} language={language} />
                        </td>
                        <td className="px-3 py-3 align-top text-right tabular-nums">
                          <PartnerHostLedgerAmount thb={row.gross} />
                        </td>
                        <td className="px-3 py-3 align-top text-right tabular-nums text-red-700">
                          −<PartnerHostLedgerAmount thb={row.fee} />
                        </td>
                        <td className="px-3 py-3 align-top text-right tabular-nums font-semibold text-emerald-800">
                          <PartnerHostLedgerAmount thb={row.net} />
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          {hasPayoutProfile ? (
                            <PartnerBookingPayoutPreviewLine
                              t={t}
                              preview={row.payoutPreview}
                              loading={payoutPreviewBatchLoading}
                            />
                          ) : null}
                          {booking.financial_snapshot ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2 min-h-[44px] gap-1.5 border-brand/25 text-brand hover:bg-brand/10"
                              onClick={() => onOpenSnapshot(booking)}
                            >
                              <Receipt className="h-4 w-4 shrink-0" aria-hidden />
                              {t('partnerFinances_rowOpenDetails')}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
