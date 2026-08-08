'use client'

import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/admin/charts/ChartSkeleton'

const FinancialIntelligenceDashboard = dynamic(
  () => import('@/components/admin/finance-intelligence/FinancialIntelligenceDashboard'),
  {
    ssr: false,
    loading: () => <ChartSkeleton className="min-h-[480px]" />,
  },
)

export default function IntelligenceClient() {
  return <FinancialIntelligenceDashboard />
}
