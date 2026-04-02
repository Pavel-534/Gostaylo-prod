'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Bot,
  Brain,
  Globe,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/** Синхронизировано с lib/ai/usage-log.js */
const TASK_TELEGRAM_PARSER = 'telegram_parser'
const TASK_LISTING_DESCRIPTION = 'listing_description'
const TASK_EMBEDDING = 'embedding'

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
  if (taskType === TASK_EMBEDDING) return 'Эмбеддинг объявления (поиск)'
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
  const [reindexing, setReindexing] = useState(false)

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

  async function runReindexEmbeddings() {
    setReindexing(true)
    try {
      const res = await fetch('/api/v2/admin/system/ai/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ limit: 5 }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        toast.error(j.error || 'Не удалось переиндексировать')
        return
      }
      const { succeeded, processed, failed } = j.data || {}
      toast.success(
        `Индексы: успешно ${succeeded ?? 0} из ${processed ?? 0}` +
          (failed ? `, ошибок: ${failed}` : ''),
      )
      load(period)
    } catch (e) {
      toast.error(e?.message || 'Сеть')
    } finally {
      setReindexing(false)
    }
  }

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
                Расходы OpenAI: Telegram, кабинет партнёра и векторный поиск
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

      <Card className="border border-amber-200/80 bg-amber-50/40 shadow-sm">
        <CardContent className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-950">Поисковые векторы</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/85">
                Пересчёт эмбеддингов для 5 последних объявлений по <code className="rounded bg-amber-100 px-1">updated_at</code>{' '}
                (только статусы ACTIVE, INACTIVE, PENDING, BOOKED — без REJECTED и без несуществующих в enum литералов).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={reindexing}
              onClick={runReindexEmbeddings}
              title="Переиндексировать до 5 объявлений для смыслового поиска"
              className="h-auto w-full min-h-11 shrink-0 whitespace-normal border-amber-300 bg-white px-4 py-3 text-amber-950 hover:bg-amber-100 sm:w-auto sm:max-w-[14rem]"
            >
              <span className="flex w-full flex-col items-center gap-1 sm:items-stretch">
                <span className="inline-flex items-center justify-center gap-2">
                  {reindexing ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 shrink-0" />
                  )}
                  <span className="text-center text-sm font-semibold leading-tight">Обновить индексы</span>
                </span>
                <span className="text-center text-[11px] font-normal leading-snug text-amber-900/80">
                  5 объектов · ACTIVE / INACTIVE / …
                </span>
              </span>
            </Button>
          </div>

          {payload?.stats ? (
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-amber-200/60 bg-white/70 p-3 sm:grid-cols-3">
              <div className="rounded-md bg-amber-50/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800/80">
                  Активные на сайте
                </p>
                <p className="text-xl font-bold tabular-nums text-amber-950">
                  {loading ? '—' : payload.stats.activeListings ?? '—'}
                </p>
                <p className="text-[10px] text-amber-900/70">status = ACTIVE</p>
              </div>
              <div className="rounded-md bg-amber-50/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800/80">
                  С вектором поиска
                </p>
                <p className="text-xl font-bold tabular-nums text-amber-950">
                  {loading ? '—' : payload.stats.withEmbeddingEligible ?? '—'}
                </p>
                <p className="text-[10px] text-amber-900/70">embedding заполнен, допустимый статус</p>
              </div>
              <div className="rounded-md bg-amber-50/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800/80">
                  ИИ по объявлениям
                </p>
                <p className="text-xl font-bold tabular-nums text-amber-950">
                  {loading ? '—' : payload.stats.aiLogsLinkedToListing ?? '—'}
                </p>
                <p className="text-[10px] text-amber-900/70">
                  записей в логе (описание + эмбеддинг), не уникальные ID
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl sm:col-span-2 xl:col-span-4">
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

        <Card className="border-2 border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-md sm:col-span-1">
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

        <Card className="border-2 border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 shadow-md sm:col-span-1">
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

        <Card className="border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-md sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-emerald-700">
              <Brain className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Vectors</span>
            </div>
            <CardTitle className="text-lg text-slate-800">Эмбеддинги поиска</CardTitle>
            <CardDescription className="text-slate-600">text-embedding-3-small</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-emerald-900">
                {formatUsd(payload?.embeddingUsd)}
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
                const isEmb = row.task_type === TASK_EMBEDDING
                const isWeb = row.task_type === TASK_LISTING_DESCRIPTION
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
                            : isEmb
                              ? 'bg-emerald-100 text-emerald-700'
                              : isWeb
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {isTg ? (
                          <Bot className="h-5 w-5" />
                        ) : isEmb ? (
                          <Brain className="h-5 w-5" />
                        ) : (
                          <Globe className="h-5 w-5" />
                        )}
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
