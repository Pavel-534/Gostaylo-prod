'use client'

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Bar,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Cohort ROI composed chart (recharts — load via next/dynamic).
 * @param {{ cohortChartRows: Array, formatThb: (value: unknown) => string }} props
 */
export function MarketingAnalyticsCohortChart({ cohortChartRows, formatThb }) {
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={cohortChartRows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
          <XAxis dataKey="cohortMonth" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatThb(v)} />
          <Tooltip
            formatter={(value, name) => [formatThb(value), name]}
            labelFormatter={(label) => `Cohort ${label}`}
          />
          <Legend />
          <Bar dataKey="bonusCostThb" name="Bonus cost (THB)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          <Line
            type="monotone"
            dataKey="commissionM0"
            name="Commission M0"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="commissionM1"
            name="Commission M1"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="commissionM3"
            name="Commission M3"
            stroke="#a855f7"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="commissionM6"
            name="Commission M6"
            stroke="#059669"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default MarketingAnalyticsCohortChart
