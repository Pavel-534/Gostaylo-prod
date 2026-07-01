'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { brandMintHex } from '@/lib/theme/tokens'
import { IncomeChartTooltip } from '@/components/partner/dashboard/partner-dashboard-widgets'

/**
 * Lazy-loaded recharts block — keeps initial /partner/dashboard chunk smaller on mobile.
 */
export default function PartnerDashboardIncomeChart({ rows }) {
  const data = Array.isArray(rows) ? rows : []
  if (!data.length) return null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          width={44}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <Tooltip content={<IncomeChartTooltip />} cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }} />
        <Bar dataKey="amountThb" fill={brandMintHex} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
