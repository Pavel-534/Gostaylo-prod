'use client'

import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Stage 105 — партнёру: выплаты в ручном Concierge-режиме.
 */
export function PartnerConciergePayoutBanner({ t }) {
  const title =
    t?.('partnerFinances_conciergePayoutTitle') ||
    'Выплаты в ручном режиме (Concierge)'
  const body =
    t?.('partnerFinances_conciergePayoutBody') ||
    'Перевод на ваш счёт или USDT выполняет команда GoStayLo по расписанию пулов (обычно пн/чт) после 24 часов с момента завершения услуги. Сумма в кабинете — ориентир; фактическая выплата фиксируется в акте и истории.'

  return (
    <Card className="border-amber-200 bg-amber-50/80 shadow-sm">
      <CardContent className="py-4 flex gap-3 text-sm text-amber-950">
        <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-amber-900/90 leading-relaxed">{body}</p>
        </div>
      </CardContent>
    </Card>
  )
}
