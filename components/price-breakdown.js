import { formatPrice } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar, TrendingUp, TrendingDown, Info } from 'lucide-react'
import { getSeasonColor } from '@/lib/price-calculator'

/**
 * Enhanced PriceBreakdown Component with Seasonal Pricing Support
 * 
 * @param {Object} priceData - Result from calculateSeasonalPrice (if available)
 * @param {number} basePrice - Base price per day (fallback)
 * @param {number} days - Number of days (fallback)
 * @param {number} commissionRate - Commission percentage (from API / booking snapshot)
 * @param {string} currency - Currency code
 * @param {string} className - Additional CSS classes
 * @param {boolean} showDetails - Show detailed breakdown (default: true)
 * @param {string} [quantityLabel] — подпись к множителю (напр. «гостей» для туров вместо «дней»)
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
}) {
  const ratePct = Number(commissionRate)
  if (!Number.isFinite(ratePct) || ratePct < 0) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 ${className}`}>
        Загрузка тарифа…
      </div>
    )
  }

  // If no seasonal data, fall back to simple calculation
  if (!priceData || !priceData.breakdown) {
    const totalBase = basePrice * days
    const serviceFee = totalBase * (ratePct / 100)
    const total = totalBase
    const qtySuffix = quantityLabel ? quantityLabel : getDaysLabel(days)

    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            {formatPrice(basePrice, currency)} × {days} {qtySuffix}
          </span>
          <span className="font-medium text-slate-900">
            {formatPrice(totalBase, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Сервисный сбор ({ratePct}%)</span>
          <span className="font-medium text-green-600">
            {formatPrice(serviceFee, currency)}
          </span>
        </div>
        <div className="border-t pt-3 flex items-center justify-between">
          <span className="font-semibold text-slate-900">Всего</span>
          <span className="text-2xl font-bold text-teal-600">
            {formatPrice(total, currency)}
          </span>
        </div>
        <div className="text-xs text-slate-500">
          Владелец получит: {formatPrice(totalBase - serviceFee, currency)}
        </div>
      </div>
    )
  }
  
  // Enhanced breakdown with seasonal pricing
  const { totalPrice, breakdown, totalDays, isSeasonalApplied, averageDaily } = priceData
  const commission = totalPrice * (ratePct / 100)
  const total = totalPrice + commission
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-teal-600" />
          Расчёт стоимости
        </h4>
        {isSeasonalApplied && (
          <Badge className="bg-teal-600 text-white text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            Сезонные цены
          </Badge>
        )}
      </div>
      
      {/* Detailed Breakdown */}
      {showDetails && breakdown.length > 0 && (
        <div className="space-y-2">
          {breakdown.map((item, index) => {
            const colors = getSeasonColor(item.seasonType)
            const dateRange = item.startDate === item.endDate
              ? formatDate(new Date(item.startDate))
              : `${formatDate(new Date(item.startDate))} — ${formatDate(new Date(item.endDate))}`
            
            return (
              <div key={index} className={`p-3 rounded-lg border-l-4 ${colors.border} bg-white`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-xs ${colors.text} ${colors.bg} border-0`}>
                        {item.seasonLabel}
                      </Badge>
                    </div>
                    
                    {item.isMonthly ? (
                      <p className="text-sm text-slate-700">
                        {item.fullMonths} мес. × {formatPrice(item.priceMonthly, currency)}
                        {item.remainingDays > 0 && (
                          <> + {item.remainingDays} дн. × {formatPrice(item.priceDaily, currency)}</>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-700">
                        {item.days} {getDaysLabel(item.days)} × {formatPrice(item.priceDaily, currency)}/день
                      </p>
                    )}
                    
                    <p className="text-xs text-slate-500 mt-1">{dateRange}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      {formatPrice(item.subtotal, currency)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      <Separator />
      
      {/* Summary */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">
            Проживание ({totalDays} {getDaysLabel(totalDays)})
          </span>
          <span className="font-medium text-slate-900">
            {formatPrice(totalPrice, currency)}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 flex items-center gap-1">
            Сервисный сбор ({ratePct}%)
            <Info className="h-3 w-3 text-slate-400" />
          </span>
          <span className="font-medium text-green-600">
            {formatPrice(commission, currency)}
          </span>
        </div>
        
        {!isSeasonalApplied && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
            <TrendingDown className="h-3 w-3" />
            <span>Базовая цена (сезонные цены не установлены)</span>
          </div>
        )}
      </div>
      
      <Separator />
      
      {/* Total */}
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold text-slate-900">Итого к оплате:</span>
        <div className="text-right">
          <p className="text-2xl font-bold text-teal-700">
            {formatPrice(total, currency)}
          </p>
          {isSeasonalApplied && (
            <p className="text-xs text-slate-500 mt-1">
              Средняя цена: {Math.round(averageDaily).toLocaleString('ru-RU')} ₿/день
            </p>
          )}
        </div>
      </div>
      
      {/* Partner Earnings */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
        <div className="flex justify-between text-sm">
          <span className="text-teal-900">Владелец получит:</span>
          <span className="font-semibold text-teal-900">
            {formatPrice(totalPrice - commission, currency)}
          </span>
        </div>
        <p className="text-xs text-teal-700 mt-1">
          {100 - ratePct}% от стоимости проживания (будет переведено после check-in)
        </p>
      </div>
    </div>
  )
}

function getDaysLabel(days) {
  if (days === 1) return 'день'
  if (days >= 2 && days <= 4) return 'дня'
  return 'дней'
}

function formatDate(date) {
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  const day = date.getDate()
  const month = months[date.getMonth()]
  return `${day} ${month}`
}
