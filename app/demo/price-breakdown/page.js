'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PriceBreakdown } from '@/components/price-breakdown'
import { useCommission } from '@/hooks/use-commission'

export default function PriceBreakdownDemo() {
  const { effectiveRate, loading } = useCommission()
  // Mock data: Booking that spans two seasons
  // 5 days in LOW season (8,000 THB/day) + 3 days in HIGH season (18,000 THB/day)
  const mockPriceData = {
    totalPrice: 94000, // (5 * 8000) + (3 * 18000)
    totalDays: 8,
    averageDaily: 11750, // 94000 / 8
    isSeasonalApplied: true,
    breakdown: [
      {
        startDate: '2025-10-28',
        endDate: '2025-11-01',
        days: 5,
        priceDaily: 8000,
        seasonLabel: 'Низкий сезон',
        seasonType: 'LOW',
        subtotal: 40000,
      },
      {
        startDate: '2025-11-02',
        endDate: '2025-11-04',
        days: 3,
        priceDaily: 18000,
        seasonLabel: 'Высокий сезон',
        seasonType: 'HIGH',
        subtotal: 54000,
      },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>PriceBreakdown Component Demo</CardTitle>
            <p className="text-sm text-slate-600 mt-2">
              Booking: Oct 28 - Nov 4, 2025 (8 days)
            </p>
            <p className="text-sm text-slate-600">
              Spans two seasons: 5 days LOW + 3 days HIGH
            </p>
          </CardHeader>
        </Card>

        {!loading && effectiveRate != null && (
          <PriceBreakdown
            priceData={mockPriceData}
            commissionRate={effectiveRate}
            currency="THB"
            showDetails={true}
          />
        )}

        <Card className="bg-teal-50 border-teal-200">
          <CardContent className="py-6">
            <h3 className="font-semibold text-slate-900 mb-3">Weighted Average Calculation:</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>• 5 days × 8,000 ₿ (Низкий сезон) = 40,000 ₿</li>
              <li>• 3 days × 18,000 ₿ (Высокий сезон) = 54,000 ₿</li>
              <li className="font-semibold pt-2 border-t">• Total: 94,000 ₿</li>
              <li>• Average per day: 11,750 ₿</li>
              <li>• Commission (from API): see breakdown above</li>
              <li className="font-semibold text-teal-700">• Final Total: 108,100 ₿</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
