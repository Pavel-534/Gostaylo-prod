'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Rocket,
  ExternalLink,
  Building2,
  Shield,
  Play,
  PauseCircle,
  Loader2,
  Info,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getSiteBrandSlug } from '@/lib/site-url'
import {
  postFintechSmokeFinancialRun,
  postFintechPreparePause,
} from '@/lib/admin/admin-fintech-api-client'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
  MOBILE_FLAT_INSET_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

const STATUS_ICON = {
  green: CheckCircle2,
  yellow: AlertCircle,
  red: XCircle,
}

const STATUS_STYLES = {
  green: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  yellow: 'text-amber-700 bg-amber-50 border-amber-200',
  red: 'text-red-700 bg-red-50 border-red-200',
}

const OVERALL_BADGE = {
  green: 'bg-emerald-100 text-emerald-900',
  yellow: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-900',
}

/**
 * @param {{
 *   launchReadiness?: { overallStatus?: string, items?: object[], generatedAt?: string } | null,
 *   onRefresh?: () => void | Promise<void>,
 * }} props
 */
export function OwnerLaunchReadinessCard({ launchReadiness, onRefresh }) {
  const { toast } = useToast()
  const [smokeBusy, setSmokeBusy] = useState(false)
  const [pauseBusy, setPauseBusy] = useState(false)

  if (!launchReadiness?.items?.length) return null

  const overall = launchReadiness.overallStatus || 'yellow'
  const OverallIcon = STATUS_ICON[overall] || AlertCircle
  const paymentsGreen = launchReadiness.items.some(
    (i) => i.id === 'payments_external' && i.status === 'green',
  )

  const runSmoke = async () => {
    setSmokeBusy(true)
    try {
      const { ok, data, json } = await postFintechSmokeFinancialRun({
        rail: 'TBANK_RU',
        priceThb: 5000,
        guestPayCurrency: 'RUB',
      })
      if (!ok) {
        const failed = (data?.steps || []).find((s) => !s.ok)
        throw new Error(failed?.detail || json?.error || 'Проверка не пройдена')
      }
      toast({
        title: 'Smoke пройден',
        description: 'Цепочка от оплаты до выплат отработала на тестовых данных.',
      })
      await onRefresh?.()
    } catch (e) {
      toast({
        title: 'Smoke не пройден',
        description: e?.message || 'См. FinTech-пульт или консоль',
        variant: 'destructive',
      })
      await onRefresh?.()
    } finally {
      setSmokeBusy(false)
    }
  }

  const runPreparePause = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Подготовить систему к паузе? Будет запущен smoke, собран архив и включена пауза новых оплат.',
      )
    ) {
      return
    }
    setPauseBusy(true)
    try {
      const { ok, blob, smokeOk, json } = await postFintechPreparePause({
        confirm: true,
        reason: 'Пауза перед запуском: договоры, ЮKassa, ОсОО',
      })
      if (!ok) {
        throw new Error(json?.error || 'Не удалось подготовить систему')
      }
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${getSiteBrandSlug()}-pause-package-${new Date().toISOString().slice(0, 10)}.zip`
        a.click()
        URL.revokeObjectURL(url)
      }
      toast({
        title: 'Система подготовлена к паузе',
        description: smokeOk
          ? 'Архив скачан, пауза включена.'
          : 'Архив скачан. В отчёте есть ошибки smoke — покажите разработчику.',
        variant: smokeOk ? 'default' : 'destructive',
      })
      await onRefresh?.()
    } catch (e) {
      toast({ title: 'Не удалось подготовить к паузе', description: e?.message, variant: 'destructive' })
    } finally {
      setPauseBusy(false)
    }
  }

  const busy = smokeBusy || pauseBusy

  return (
    <Card
      className={cn(
        MOBILE_FLAT_CARD_CLASS,
        'max-sm:border-b max-sm:border-indigo-100 max-sm:pb-4 sm:border-[3px] sm:border-indigo-500 sm:bg-gradient-to-br sm:from-indigo-50/90 sm:via-white sm:to-emerald-50/30 sm:shadow-xl sm:ring-2 sm:ring-indigo-100/80',
      )}
    >
      <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'pb-3')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900">
              <Rocket className="h-8 w-8 text-indigo-600 shrink-0" aria-hidden />
              Готовность к запуску
            </CardTitle>
            <CardDescription className="text-base text-slate-700 max-w-2xl">
              Что проверить перед открытием сайта для гостей
            </CardDescription>
          </div>
          <span
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${OVERALL_BADGE[overall] || OVERALL_BADGE.yellow}`}
          >
            <OverallIcon className="h-4 w-4" aria-hidden />
            {overall === 'green' ? 'Можно запускать' : overall === 'red' ? 'Есть блокеры' : 'Нужно внимание'}
          </span>
        </div>

        <div
          className={cn(
            MOBILE_FLAT_INSET_CLASS,
            'mt-4 space-y-3 sm:border-2 sm:border-dashed sm:border-brand/35 sm:bg-brand/5',
          )}
          role="group"
          aria-label="Быстрые действия"
        >
          <p className="text-sm font-semibold text-brand">Быстрые действия</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="min-h-[44px] max-sm:w-full"
              disabled={busy}
              onClick={() => void runSmoke()}
            >
              {smokeBusy ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1.5" />
              )}
              Запустить smoke
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-[44px] border-slate-400 bg-white hover:bg-slate-50 max-sm:w-full"
              disabled={busy}
              onClick={() => void runPreparePause()}
            >
              {pauseBusy ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <PauseCircle className="h-4 w-4 mr-1.5" />
              )}
              Подготовить к паузе
            </Button>
            <Button type="button" size="sm" variant="outline" className="min-h-[44px] max-sm:w-full" asChild disabled={busy}>
              <Link href="/admin/moderation">
                <Building2 className="h-4 w-4 mr-1.5" />
                Открыть модерацию
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" className="min-h-[44px] max-sm:w-full" asChild disabled={busy}>
              <Link href="/admin/security">
                <Shield className="h-4 w-4 mr-1.5" />
                Открыть нарушителей
              </Link>
            </Button>
          </div>
        </div>

        {!paymentsGreen ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:px-0">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden />
            После подключения ЮKassa и онлайн-кассы карточка станет полностью зелёной.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-2')}>
        <ul className="divide-y divide-slate-100 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none sm:rounded-lg sm:border sm:border-slate-200 sm:bg-white sm:shadow-sm">
          {launchReadiness.items.map((item) => {
            const Icon = STATUS_ICON[item.status] || AlertCircle
            const style = STATUS_STYLES[item.status] || STATUS_STYLES.yellow
            const inner = (
              <div className={`flex min-h-[44px] gap-3 p-4 ${item.link ? 'hover:bg-slate-50/80' : ''}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${style}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-sm text-slate-600 leading-snug">{item.detail}</p>
                </div>
                {item.link?.href ? (
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 self-center" aria-hidden />
                ) : null}
              </div>
            )
            if (item.link?.href) {
              return (
                <li key={item.id}>
                  <Link href={item.link.href} className="block transition-colors">
                    {inner}
                  </Link>
                </li>
              )
            }
            return <li key={item.id}>{inner}</li>
          })}
        </ul>
        {launchReadiness.generatedAt ? (
          <p className="text-xs text-slate-500 pt-1">
            Обновлено: {new Date(launchReadiness.generatedAt).toLocaleString('ru-RU')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
