'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'
import { getSeasonColor } from '@/lib/price-calculator'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

export default function PriceCalendarPreview({ seasonalPrices = [], basePriceThb }) {
  const currentYear = new Date().getFullYear()
  
  // Calculate average price for each month
  const monthlyData = MONTHS.map((month, index) => {
    const monthNum = index + 1
    const startDate = new Date(currentYear, index, 1)
    const endDate = new Date(currentYear, index + 1, 0) // Last day of month
    const daysInMonth = endDate.getDate()
    
    let totalPrice = 0
    let hasSeasonalPrice = false
    const seasonsInMonth = new Set()
    
    // For each day in month, find applicable price
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(currentYear, index, day)
      
      const applicableSeason = seasonalPrices.find(sp => {
        const start = new Date(sp.startDate)
        const end = new Date(sp.endDate)
        return currentDate >= start && currentDate <= end
      })
      
      if (applicableSeason) {
        totalPrice += applicableSeason.priceDaily
        hasSeasonalPrice = true
        seasonsInMonth.add(applicableSeason.seasonType)
      } else {
        totalPrice += basePriceThb
      }
    }
    
    const averagePrice = Math.round(totalPrice / daysInMonth)
    
    // Determine dominant season type
    let dominantSeasonType = 'NORMAL'
    if (seasonsInMonth.size > 0) {
      if (seasonsInMonth.has('PEAK')) dominantSeasonType = 'PEAK'
      else if (seasonsInMonth.has('HIGH')) dominantSeasonType = 'HIGH'
      else if (seasonsInMonth.has('LOW')) dominantSeasonType = 'LOW'
    }
    
    return {
      month,
      monthNum,
      averagePrice,
      hasSeasonalPrice,
      seasonType: dominantSeasonType,
      daysInMonth,
    }
  })
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-teal-600" />
          Календарь цен ({currentYear})
        </CardTitle>
        <CardDescription>
          Средняя цена за день для каждого месяца
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {monthlyData.map((data) => {
            const colors = getSeasonColor(data.seasonType)
            
            return (
              <div
                key={data.monthNum}
                className={`p-4 border-2 ${colors.border} ${colors.bg} rounded-lg transition-all hover:shadow-md`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-900 text-sm">{data.month}</p>
                  <Badge variant="outline" className={`${colors.text} text-xs`}>
                    {colors.label}
                  </Badge>
                </div>
                
                <p className="text-2xl font-bold text-slate-900">
                  {data.averagePrice.toLocaleString('ru-RU')}
                </p>
                <p className="text-xs text-slate-600">₿/день (средн.)</p>
                
                {!data.hasSeasonalPrice && (
                  <p className="text-xs text-slate-500 mt-2">Базовая цена</p>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Legend */}
        <div className="mt-6 pt-6 border-t flex flex-wrap gap-3">
          <p className="text-sm font-medium text-slate-700 w-full mb-2">Легенда:</p>
          {['LOW', 'NORMAL', 'HIGH', 'PEAK'].map((type) => {
            const colors = getSeasonColor(type)
            return (
              <div key={type} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${colors.bg} border-2 ${colors.border}`} />
                <span className="text-sm text-slate-600">{colors.label}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
