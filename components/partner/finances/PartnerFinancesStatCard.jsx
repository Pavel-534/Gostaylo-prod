'use client'

import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { PARTNER_HUB_LIST_CARD_SURFACE_CLASS, PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS, PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS } from '@/lib/ui/partner-section-rhythm'
import { cn } from '@/lib/utils'

export function PartnerFinancesStatCard({ icon: Icon, title, value, subtitle, trend, loading }) {
  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
      <CardHeader
        className={cn(
          MOBILE_FLAT_CARD_HEADER_CLASS,
          PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS,
          'flex flex-row items-center justify-between sm:pb-2',
        )}
      >
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      </CardHeader>
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS)}>
        {loading ? (
          <div className="h-8 w-24 bg-slate-200 animate-pulse rounded" />
        ) : (
          <>
            <div className="text-3xl font-bold text-slate-900">{value}</div>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            {trend && (
              <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>{trend}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
