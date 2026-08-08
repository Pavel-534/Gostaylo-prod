'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

const ADMIN_CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b']

/**
 * Admin dashboard revenue + category charts (recharts — load via next/dynamic).
 * @param {{ monthlyRevenue?: Array, categoryDistribution?: Array }} props
 */
export function AdminDashboardCharts({ monthlyRevenue = [], categoryDistribution = [] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'overflow-hidden max-sm:shadow-none sm:shadow-xl')}>
        <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'pb-2 lg:pb-4')}>
          <CardTitle className="text-lg lg:text-xl">Динамика выручки</CardTitle>
          <CardDescription className="text-xs lg:text-sm">Ежемесячный тренд (THB)</CardDescription>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'p-2 lg:p-6 max-sm:pt-2')}>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[300px]">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="thb" stroke="#6366f1" strokeWidth={2} name="THB" />
                  <Line type="monotone" dataKey="usdt" stroke="#8b5cf6" strokeWidth={2} name="USDT" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'overflow-hidden max-sm:shadow-none sm:shadow-xl')}>
        <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'pb-2 lg:pb-4')}>
          <CardTitle className="text-lg lg:text-xl">По категориям</CardTitle>
          <CardDescription className="text-xs lg:text-sm">Распределение листингов</CardDescription>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'p-2 lg:p-6 max-sm:pt-2')}>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[250px]">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(categoryDistribution || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminDashboardCharts
