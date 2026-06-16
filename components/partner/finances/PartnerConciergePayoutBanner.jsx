'use client'

import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Stage 105 — партнёру: выплаты в ручном Concierge-режиме.
 */
export function PartnerConciergePayoutBanner({ t, body: bodyOverride }) {
  const title = t?.('partnerFinances_conciergePayoutTitle') || ''
  const body = bodyOverride || t?.('partnerFinances_conciergePayoutBody') || ''
  if (!title && !body) return null

  return (
    <Card className="border-amber-200 bg-amber-50/80 shadow-sm">
      <CardContent className="py-4 flex gap-3 text-sm text-amber-950">
        <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
        <div>
          {title ? <p className="font-semibold">{title}</p> : null}
          {body ? <p className="mt-1 text-amber-900/90 leading-relaxed">{body}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
