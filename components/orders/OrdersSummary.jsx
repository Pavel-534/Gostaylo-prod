'use client'

import { Card, CardContent } from '@/components/ui/card'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'

function renderRenterSummary(visibleCount, currencyTotals, language) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-500 mb-1">{getUIText('ordersSummary_renterVisibleCount', language)}</p>
          <p className="text-2xl font-bold text-slate-900">{visibleCount}</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl sm:col-span-2">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-500 mb-1">{getUIText('ordersSummary_renterTotalsLabel', language)}</p>
          <div className="flex flex-wrap gap-3">
            {currencyTotals.length === 0 ? (
              <span className="text-slate-500">—</span>
            ) : (
              currencyTotals.map(([currency, amount]) => (
                <span
                  key={currency}
                  className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700"
                >
                  {formatPrice(amount, currency)}
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PartnerSummaryCompact({ stats, language }) {
  const pending = stats.pending || 0
  const confirmed = stats.confirmed || 0
  const revenue = Number(stats.revenue || 0)
  const parts = []

  if (pending > 0) {
    parts.push(
      <span key="pending" className="font-medium text-amber-700 tabular-nums">
        {getUIText('ordersSummary_partnerCompactPending', language, { count: pending })}
      </span>,
    )
  }
  if (confirmed > 0) {
    parts.push(
      <span key="confirmed" className="text-slate-700 tabular-nums">
        {getUIText('ordersSummary_partnerCompactActive', language, { count: confirmed })}
      </span>,
    )
  }
  parts.push(
    <span key="revenue" className="inline-flex items-center gap-1 text-brand-hover font-semibold tabular-nums">
      <span className="text-slate-600 font-normal">{getUIText('netEarnings', language)}</span>
      <PartnerHostLedgerAmount thb={revenue} />
    </span>,
  )

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm md:hidden">
      {parts.map((part, index) => (
        <span key={part.key} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </div>
  )
}

function renderPartnerSummary(stats, language) {
  return (
    <>
      <PartnerSummaryCompact stats={stats} language={language} />
      <div className="mb-6 hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{getUIText('ordersSummary_partnerTotal', language)}</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{getUIText('ordersSummary_partnerPending', language)}</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{getUIText('ordersSummary_partnerConfirmed', language)}</p>
            <p className="text-2xl font-bold text-green-600">{stats.confirmed || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{getUIText('netEarnings', language)}</p>
            <p className="text-2xl font-bold text-brand tabular-nums">
              <PartnerHostLedgerAmount thb={Number(stats.revenue || 0)} />
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function OrdersSummary({
  role = 'renter',
  language = 'ru',
  visibleCount = 0,
  currencyTotals = [],
  partnerStats = null,
}) {
  if (role === 'partner' || role === 'admin') {
    return renderPartnerSummary(partnerStats || {}, language)
  }
  return renderRenterSummary(visibleCount, currencyTotals, language)
}
