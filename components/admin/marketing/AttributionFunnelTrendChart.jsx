'use client'

import { LineChart as LineChartIcon } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Bar,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinTechEmptyState } from '@/components/admin/finances/FinTechEmptyState'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { cn } from '@/lib/utils'

/**
 * Attribution "Динамика воронки" card (recharts — load via next/dynamic).
 * @param {{ chartRows: Array }} props
 */
export function AttributionFunnelTrendChart({ chartRows = [] }) {
  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:border-violet-200/60 sm:bg-gradient-to-br sm:from-violet-50/40 sm:to-white sm:shadow-sm')}>
      <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChartIcon className="h-4 w-4 text-brand" />
          Динамика воронки
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'h-[240px]')}>
        {!chartRows.length ? (
          <FinTechEmptyState title="Нет данных" description="Появятся после кликов." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <RechartsTooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="clicks" name="Клики" fill="#7c3aed" opacity={0.35} barSize={8} />
              <Line yAxisId="right" type="monotone" dataKey="earnedThb" name="Earned" stroke="#d97706" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default AttributionFunnelTrendChart
