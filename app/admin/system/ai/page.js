'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Bot,
  Globe,
  Loader2,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Синхронизировано с lib/ai/usage-log.js */
const TASK_TELEGRAM_PARSER = 'telegram_parser'
const TASK_LISTING_DESCRIPTION = 'listing_description'

const PERIODS = [
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: '7 дней' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Весь период' },
]

function formatUsd(n) {
  const v = Number(n) || 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(v)
}

function taskLabel(taskType) {
  if (taskType === TASK_TELEGRAM_PARSER) return 'Ленивый Риелтор (TG)'
  if (taskType === TASK_LISTING_DESCRIPTION) return 'Генератор описаний (Web)'
  return String(taskType || '—')
}

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminSystemAiPage() {
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [payload, setPayload] = useState(null)

  const load = useCallback(async (p) => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/v2/admin/system/ai?period=${encodeURIComponent(p)}`, {
        credentials: 'include',
      })
      const j = await res.json()
      if (!res.ok) {
        setErr(j.error || `Ошибка ${res.status}`)
        setPayload(null)
        return
      }
      if (j.success && j.data) setPayload(j.data)
      else setErr('Некорректный ответ')
    } catch (e) {
      setErr(e?.message || 'Сеть')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period)
  }, [period, load])

  return (
    <div className="min-h-[60vh] space-y-6 px-1 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/system"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-teal-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад в System
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">ИИ-аналитика</h1>
              <p className="text-sm text-slate-600">
                Расходы OpenAI: Telegram и кабинет партнёра
              </p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="w-fit border-violet-200 bg-violet-50 text-violet-800">
          Оценка по токенам · ai_usage_logs
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant={period === p.id ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'rounded-full px-4 transition-all',
              period === p.id &&
                'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:from-violet-700 hover:to-indigo-700',
            )}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {err ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-sm text-red-800">{err}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl">
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-teal-500/20 blur-2xl" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-teal-300">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Всего</span>
            </div>
            <CardTitle className="text-lg font-medium text-slate-200">
              Суммарные расходы на ИИ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
            ) : (
              <>
                <p className="text-3xl font-bold tabular-nums tracking-tight">
                  {formatUsd(payload?.totalUsd)}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Записей в периоде:{' '}
                  <span className="font-medium text-slate-300">{payload?.requestCount ?? 0}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sky-700">
              <Bot className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Telegram</span>
            </div>
            <CardTitle className="text-lg text-slate-800">Ленивый Риелтор (TG)</CardTitle>
            <CardDescription className="text-slate-600">Парсер подписей к объявлениям</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-sky-900">
                {formatUsd(payload?.telegramUsd)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-violet-700">
              <Globe className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Web</span>
            </div>
            <CardTitle className="text-lg text-slate-800">Генератор описаний</CardTitle>
            <CardDescription className="text-slate-600">Кабинет партнёра</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-violet-900">
                {formatUsd(payload?.webUsd)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Последние операции</CardTitle>
          </div>
          <CardDescription>До 20 записей за выбранный период</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
            </div>
          ) : !payload?.recent?.length ? (
            <p className="py-8 text-center text-sm text-slate-500">Нет записей за этот период</p>
          ) : (
            <ul className="space-y-2">
              {payload.recent.map((row) => {
                const isTg = row.task_type === TASK_TELEGRAM_PARSER
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          isTg
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-violet-100 text-violet-700',
                        )}
                      >
                        {isTg ? <Bot className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{taskLabel(row.task_type)}</p>
                        <p className="text-xs text-slate-500">{formatWhen(row.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:text-right">
                      <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">
                        {formatUsd(row.cost_usd)}
                      </span>
                      {row.model ? (
                        <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
                          {row.model}
                        </Badge>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
