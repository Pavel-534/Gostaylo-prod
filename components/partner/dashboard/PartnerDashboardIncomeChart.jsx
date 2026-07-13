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
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'

/**
 * Lazy-loaded recharts block — keeps initial /partner/dashboard chunk smaller on mobile.
 */
export default function PartnerDashboardIncomeChart({ rows }) {
  const { formatLedgerThb } = usePartnerHostDisplayFx()
  const data = Array.isArray(rows) ? rows : []
  if (!data.length) return null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          width={52}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => {
            const n = Number(v)
            if (!Number.isFinite(n)) return ''
            const formatted = formatLedgerThb(n)
            return n >= 1000 ? formatted.replace(/\s/g, '').slice(0, 8) : formatted
          }}
        />
        <Tooltip content={<IncomeChartTooltip />} cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }} />
        <Bar dataKey="amountThb" fill={brandMintHex} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
