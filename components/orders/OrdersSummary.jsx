import { Card, CardContent } from '@/components/ui/card'
import { formatPrice } from '@/lib/currency'

function renderRenterSummary(visibleCount, currencyTotals) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-500 mb-1">Заказов в списке</p>
          <p className="text-2xl font-bold text-slate-900">{visibleCount}</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl sm:col-span-2">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-500 mb-1">Сумма заказов (SSOT)</p>
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

function renderPartnerSummary(stats) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs text-slate-500">Всего</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total || 0}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs text-slate-500">Ожидают</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending || 0}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs text-slate-500">Подтверждено</p>
          <p className="text-2xl font-bold text-green-600">{stats.confirmed || 0}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs text-slate-500">Ваш доход</p>
          <p className="text-2xl font-bold text-teal-600">{formatPrice(Number(stats.revenue || 0), 'THB')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function OrdersSummary({
  role = 'renter',
  visibleCount = 0,
  currencyTotals = [],
  partnerStats = null,
}) {
  if (role === 'partner' || role === 'admin') {
    return renderPartnerSummary(partnerStats || {})
  }
  return renderRenterSummary(visibleCount, currencyTotals)
}
