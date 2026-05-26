'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Building2,
  AlertTriangle,
  Shield,
  CreditCard,
  ChevronRight,
  Activity,
} from 'lucide-react'

const TONE = {
  green: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  yellow: 'text-amber-800 bg-amber-50 border-amber-200',
  red: 'text-red-800 bg-red-50 border-red-200',
}

/**
 * @param {{ platformStatus?: object | null, loading?: boolean }} props
 */
export function OwnerPlatformStatusCard({ platformStatus, loading }) {
  if (loading) {
    return (
      <Card className="border-2 border-slate-200 animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-slate-200 rounded" />
        </CardHeader>
        <CardContent className="h-32 bg-slate-100 rounded-lg" />
      </Card>
    )
  }

  if (!platformStatus) return null

  const payTone = platformStatus.paymentsReady ? 'green' : 'yellow'

  const rows = [
    {
      label: 'Объявлений на модерации',
      hint: 'Ждут вашего одобрения перед показом в каталоге',
      value: platformStatus.pendingModeration ?? 0,
      href: '/admin/moderation',
      icon: Building2,
      tone: (platformStatus.pendingModeration || 0) > 10 ? 'red' : (platformStatus.pendingModeration || 0) > 0 ? 'yellow' : 'green',
    },
    {
      label: 'Нарушители контактов в чате',
      hint: 'Партнёры с высоким числом страйков',
      value: platformStatus.activeViolators ?? 0,
      href: '/admin/security',
      icon: AlertTriangle,
      tone: (platformStatus.activeViolators || 0) > 0 ? 'yellow' : 'green',
    },
    {
      label: 'Попыток увести сделку (7 дней)',
      hint: 'Срабатывания защиты контактов',
      value: platformStatus.contactLeaksWeek ?? 0,
      href: '/admin/security',
      icon: Shield,
      tone: (platformStatus.contactLeaksWeek || 0) > 20 ? 'red' : (platformStatus.contactLeaksWeek || 0) > 5 ? 'yellow' : 'green',
    },
  ]

  return (
    <Card className="border-2 border-indigo-300 bg-gradient-to-br from-white to-indigo-50/40 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
              <Activity className="h-6 w-6 text-indigo-600" aria-hidden />
              Состояние платформы
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-600">
              Ключевые показатели перед запуском и привлечением партнёров
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {rows.map((row) => {
            const Icon = row.icon
            return (
              <Link key={row.label} href={row.href} className="block group">
                <div
                  className={`rounded-xl border p-4 transition-shadow group-hover:shadow-md ${TONE[row.tone] || TONE.green}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
                    <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100" aria-hidden />
                  </div>
                  <p className="text-3xl font-bold tabular-nums leading-none">{row.value}</p>
                  <p className="mt-2 text-sm font-medium leading-snug">{row.label}</p>
                  <p className="mt-1 text-xs opacity-80 leading-snug">{row.hint}</p>
                </div>
              </Link>
            )
          })}
        </div>

        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${TONE[payTone]}`}
        >
          <div className="flex items-start gap-3">
            <CreditCard className="h-6 w-6 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">Готовность к приёму денег</p>
              <p className="text-sm mt-0.5 opacity-90">{platformStatus.paymentsLabel}</p>
            </div>
          </div>
          <Button asChild variant="secondary" className="shrink-0 bg-white/80 hover:bg-white">
            <Link href={platformStatus.paymentsHref || '/admin/settings/finances'}>
              FinTech-пульт
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
