'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Receipt } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/currency'
import { snapshotMoney, STATUS_COLORS } from '@/components/partner/finances/partner-finances-shared'
import { PartnerBookingIncomeKindBadge } from '@/components/partner/finances/PartnerBookingIncomeKindBadge'

export function PartnerFinancesTransactionHistory({
  t,
  currency,
  exchangeRates,
  transactionSectionRef,
  escrowBookingFilter,
  isLoading,
  isError,
  error,
  onRefetch,
  bookings,
  displayedBookings,
  calcPayoutMath,
  onOpenSnapshot,
}) {
  return (
    <Card ref={transactionSectionRef}>
      <CardHeader>
        <CardTitle>{t('transactionHistory')}</CardTitle>
        <CardDescription>{t('transactionHistoryDesc')}</CardDescription>
        {escrowBookingFilter ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2 text-sm text-teal-950 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('partnerFinances_escrowFilterBanner')}</span>
            <Link
              href="/partner/finances"
              className="shrink-0 font-semibold text-teal-800 underline underline-offset-2 hover:text-teal-900"
            >
              {t('partnerFinances_escrowFilterShowAll')}
            </Link>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <p className="mb-2 text-slate-700 font-medium">{t('failedToLoad')}</p>
            <p className="text-sm text-slate-500 mb-4">{error?.message}</p>
            <Button onClick={() => onRefetch()} variant="outline">
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
            <Button variant="outline" asChild>
              <Link href="/partner/finances">{t('partnerFinances_escrowFilterShowAll')}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedBookings.map((booking) => {
              const { gross, fee, net } = snapshotMoney(booking)
              const payoutMath = calcPayoutMath(net)
              const checkIn = booking.checkIn || booking.check_in
              const checkOut = booking.checkOut || booking.check_out

              return (
                <div
                  key={booking.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors gap-4"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{booking.listing?.title || t('listing')}</h4>
                      <PartnerBookingIncomeKindBadge
                        categorySlug={booking.financial_snapshot?.category_slug}
                        t={t}
                      />
                      <Badge className={`text-xs ${STATUS_COLORS[booking.status] || 'bg-slate-100'}`}>
                        {booking.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      {t('guest')}: {booking.guestName || booking.guest_name || 'N/A'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {checkIn && format(new Date(checkIn), 'MMM d')} →{' '}
                      {checkOut && format(new Date(checkOut), 'MMM d, yyyy')}
                    </p>
                  </div>

                  <div className="flex flex-col md:items-end gap-1">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">{t('gross')}:</span>
                        <span className="font-medium text-slate-900 ml-2">
                          {formatPrice(gross, currency, exchangeRates)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">{t('fee')}:</span>
                        <span className="font-medium text-red-600 ml-2">
                          -{formatPrice(fee, currency, exchangeRates)}
                        </span>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {formatPrice(net, currency, exchangeRates)}
                    </div>
                    <p className="text-xs text-slate-500">{t('yourNetEarnings')}</p>
                    <p className="text-xs text-indigo-700">
                      {t('partnerFinances_payoutLine')}: {formatPrice(net, currency, exchangeRates)} −{' '}
                      {formatPrice(payoutMath.fee, currency, exchangeRates)} ={' '}
                      {formatPrice(payoutMath.final, currency, exchangeRates)}
                    </p>
                    {booking.financial_snapshot ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-1.5 border-teal-200 text-teal-900 hover:bg-teal-50"
                        onClick={() => onOpenSnapshot(booking)}
                      >
                        <Receipt className="h-4 w-4 shrink-0" aria-hidden />
                        {t('partnerFinances_rowOpenDetails')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
