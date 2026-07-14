'use client'

import Link from 'next/link'
import { ChevronRight, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PartnerHostLedgerAmount,
  PartnerHostMidFxFootnote,
} from '@/components/partner/finances/partner-host-amount-display'
import { getUIText } from '@/lib/translations'
import { usePartnerDashboardMoney } from '@/hooks/partner/use-partner-dashboard-money'
import { cn } from '@/lib/utils'

function MoneyRow({ label, thb, highlight = false }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={cn(
          'text-base font-semibold tabular-nums whitespace-nowrap',
          highlight ? 'text-brand' : 'text-slate-900',
        )}
      >
        <PartnerHostLedgerAmount thb={thb} />
      </span>
    </div>
  )
}

function PartnerDashboardMoneyCardSkeleton() {
  return (
    <Card className="border-brand/25 bg-gradient-to-br from-brand/5 to-white" aria-hidden="true">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-brand/40" />
          <span className="h-5 w-28 rounded bg-brand/15 animate-pulse" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-[44px] items-center justify-between gap-3">
            <span className="h-4 w-32 rounded bg-slate-200/80 animate-pulse" />
            <span className="h-5 w-20 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}
        <span className="block h-11 w-full rounded-xl bg-slate-100 animate-pulse" />
      </CardContent>
    </Card>
  )
}

/**
 * Stage 187.0 — compact balance card (escrow SSOT + marketing bonuses).
 */
export function PartnerDashboardMoneyCard({ language = 'ru' }) {
  const t = (key, fb) => getUIText(key, language) || fb
  const { availableThb, inProcessingThb, bonusesThb, showBonuses, isLoading, isError } =
    usePartnerDashboardMoney()

  if (isLoading) return <PartnerDashboardMoneyCardSkeleton />

  if (isError) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <p className="text-sm text-slate-500">
            {t('partnerDashboard_moneyLoadError', 'Не удалось загрузить балансы')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-brand/25 bg-gradient-to-br from-brand/5 to-white" data-testid="partner-dashboard-money-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-brand" aria-hidden />
          {t('partnerDashboard_moneyCardTitle', 'Балансы')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MoneyRow
          label={t('partnerDashboard_moneyAvailable', 'Доступно к выводу')}
          thb={availableThb}
          highlight
        />
        <MoneyRow
          label={t('partnerDashboard_moneyEscrow', 'В обработке / эскроу')}
          thb={inProcessingThb}
        />
        {showBonuses ? (
          <MoneyRow
            label={t('partnerDashboard_moneyBonuses', 'Бонусы')}
            thb={bonusesThb}
          />
        ) : null}
        <PartnerHostMidFxFootnote t={t} className="pt-0.5" />
        <Link
          href="/partner/finances"
          className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-brand/20 bg-white/80 px-3 text-sm font-medium text-brand-hover transition-colors hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {t('partnerDashboard_moneyMoreLink', 'Подробнее в Финансах →')}
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  )
}
