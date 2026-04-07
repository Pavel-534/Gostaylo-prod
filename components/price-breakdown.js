import { formatPrice } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar, TrendingUp, TrendingDown, Info } from 'lucide-react'
import { getSeasonColor } from '@/lib/price-calculator'
import { getUIText } from '@/lib/translations'
import { format } from 'date-fns'
import { ru, enUS, zhCN, th as thDateLocale } from 'date-fns/locale'

const DATE_LOCALES = { ru, en: enUS, zh: zhCN, th: thDateLocale }

function t(key, language) {
  return getUIText(key, language)
}

function interpolate(str, vars) {
  let s = str
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(String(v))
  }
  return s
}

function calendarUnitWord(days, language) {
  const lang = String(language || 'en').toLowerCase().slice(0, 2)
  if (lang === 'ru') {
    if (days === 1) return t('priceBreakdown_calendarDay_1', language)
    if (days >= 2 && days <= 4) return t('priceBreakdown_calendarDay_234', language)
    return t('priceBreakdown_calendarDay_many', language)
  }
  return days === 1 ? t('priceBreakdown_unitDay', language) : t('priceBreakdown_unitDays', language)
}

function formatShortDate(date, language) {
  const loc = DATE_LOCALES[String(language || 'en').toLowerCase().slice(0, 2)] || enUS
  return format(date, 'd MMM', { locale: loc })
}

/**
 * @param {Object} props
 * @param {string} [props.language='ru']
 * @param {Record<string, number>} [props.exchangeRates]
 */
export function PriceBreakdown({
  priceData = null,
  basePrice,
  days = 1,
  commissionRate,
  currency = 'THB',
  className = '',
  showDetails = true,
  quantityLabel = '',
  language = 'ru',
  exchangeRates = { THB: 1 },
}) {
  const rates = exchangeRates && typeof exchangeRates === 'object' ? exchangeRates : { THB: 1 }
  const fp = (amountThb) => formatPrice(amountThb, currency, rates, language)

  const ratePct = Number(commissionRate)
  if (!Number.isFinite(ratePct) || ratePct < 0) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 ${className}`}>
        {t('priceBreakdown_loadingCommission', language)}
      </div>
    )
  }

  const qtySuffix =
    quantityLabel ||
    `${days} ${calendarUnitWord(days, language)}`

  if (!priceData || !priceData.breakdown) {
    const totalBase = basePrice * days
    const serviceFee = totalBase * (ratePct / 100)
    const total = totalBase

    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            {fp(basePrice)} × {qtySuffix}
          </span>
          <span className="font-medium text-slate-900 tabular-nums">{fp(totalBase)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            {interpolate(t('priceBreakdown_serviceFeePct', language), { pct: ratePct })}
          </span>
          <span className="font-medium text-green-600 tabular-nums">{fp(serviceFee)}</span>
        </div>
        <div className="border-t pt-3 flex items-center justify-between">
          <span className="font-semibold text-slate-900">{t('priceBreakdown_totalLabel', language)}</span>
          <span className="text-2xl font-bold text-teal-600 tabular-nums">{fp(total)}</span>
        </div>
        <div className="text-xs text-slate-500">
          {t('priceBreakdown_hostReceivesShort', language)} {fp(totalBase - serviceFee)}
        </div>
      </div>
    )
  }

  const { totalPrice, breakdown, totalDays, isSeasonalApplied, averageDaily } = priceData
  const commission = totalPrice * (ratePct / 100)
  const total = totalPrice + commission
  const stayUnit = calendarUnitWord(totalDays, language)

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-teal-600" />
          {t('priceBreakdown_title', language)}
        </h4>
        {isSeasonalApplied && (
          <Badge className="bg-teal-600 text-white text-xs rounded-xl">
            <TrendingUp className="h-3 w-3 mr-1" />
            {t('priceBreakdown_seasonalBadge', language)}
          </Badge>
        )}
      </div>

      {showDetails && breakdown.length > 0 && (
        <div className="space-y-2">
          {breakdown.map((item, index) => {
            const colors = getSeasonColor(item.seasonType)
            const dateRange =
              item.startDate === item.endDate
                ? formatShortDate(new Date(item.startDate), language)
                : `${formatShortDate(new Date(item.startDate), language)} — ${formatShortDate(
                    new Date(item.endDate),
                    language,
                  )}`

            return (
              <div key={index} className={`p-3 rounded-xl border-l-4 ${colors.border} bg-white`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-xs ${colors.text} ${colors.bg} border-0`}>
                        {item.seasonLabel}
                      </Badge>
                    </div>

                    {item.isMonthly ? (
                      <p className="text-sm text-slate-700">
                        {interpolate(t('priceBreakdown_monthsTimes', language), {
                          months: item.fullMonths,
                        })}{' '}
                        {fp(item.priceMonthly)}
                        {item.remainingDays > 0 && (
                          <>
                            {' '}
                            {interpolate(t('priceBreakdown_plusDaysTimes', language), {
                              days: item.remainingDays,
                            })}{' '}
                            {fp(item.priceDaily)}
                          </>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-700">
                        {item.days} {calendarUnitWord(item.days, language)} × {fp(item.priceDaily)}
                        {t('priceBreakdown_perDaySuffix', language)}
                      </p>
                    )}

                    <p className="text-xs text-slate-500 mt-1">{dateRange}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-900 tabular-nums">{fp(item.subtotal)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <div className="flex justify-between text-sm gap-2">
          <span className="text-slate-600">
            {interpolate(t('priceBreakdown_accommodationLine', language), {
              days: totalDays,
              unit: stayUnit,
            })}
          </span>
          <span className="font-medium text-slate-900 tabular-nums">{fp(totalPrice)}</span>
        </div>

        <div className="flex justify-between text-sm gap-2">
          <span className="text-slate-600 flex items-center gap-1 min-w-0">
            {interpolate(t('priceBreakdown_serviceFeePct', language), { pct: ratePct })}
            <Info className="h-3 w-3 text-slate-400 shrink-0" />
          </span>
          <span className="font-medium text-green-600 tabular-nums">{fp(commission)}</span>
        </div>

        {!isSeasonalApplied && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-xl">
            <TrendingDown className="h-3 w-3 shrink-0" />
            <span>{t('priceBreakdown_basePriceNote', language)}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex justify-between items-center gap-2">
        <span className="text-lg font-bold text-slate-900">{t('priceBreakdown_totalToPay', language)}</span>
        <div className="text-right">
          <p className="text-2xl font-bold text-teal-700 tabular-nums">{fp(total)}</p>
          {isSeasonalApplied && (
            <p className="text-xs text-slate-500 mt-1">
              {interpolate(t('priceBreakdown_avgPerDayThb', language), {
                amount: fp(Math.round(averageDaily)),
              })}
            </p>
          )}
        </div>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3">
        <div className="flex justify-between text-sm gap-2">
          <span className="text-teal-900">{t('priceBreakdown_hostBlockTitle', language)}</span>
          <span className="font-semibold text-teal-900 tabular-nums">
            {fp(totalPrice - commission)}
          </span>
        </div>
        <p className="text-xs text-teal-700 mt-1">
          {interpolate(t('priceBreakdown_hostShareHint', language), { pct: 100 - ratePct })}
        </p>
      </div>
    </div>
  )
}
