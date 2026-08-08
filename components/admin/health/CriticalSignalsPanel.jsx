'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ShieldAlert } from 'lucide-react'
import { CRITICAL_SIGNAL_KEYS, CRITICAL_SIGNAL_LABELS } from '@/lib/admin/critical-signal-keys.js'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
  MOBILE_FLAT_INSET_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

function formatDt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

const SIGNAL_LABELS = CRITICAL_SIGNAL_LABELS

/**
 * @param {{ signals?: object, windowDays?: number }} props
 */
export function CriticalSignalsPanel({ signals, windowDays = 7 }) {
  const [filterKey, setFilterKey] = useState('all')
  const [search, setSearch] = useState('')

  const events = useMemo(() => {
    const list = Array.isArray(signals?.events) ? signals.events : []
    const q = search.trim().toLowerCase()
    return list.filter((row) => {
      if (filterKey !== 'all' && row.signalKey !== filterKey) return false
      if (!q) return true
      const hay = `${row.signalKey} ${row.detailText || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [signals?.events, filterKey, search])

  if (!signals) return null

  const tamperCount = signals.priceTamperingCount ?? signals.countsByKey?.PRICE_TAMPERING ?? 0

  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:rounded-2xl sm:border-slate-200 sm:shadow-sm sm:border-l-4 sm:border-l-amber-500')}>
      <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'pb-2')}>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          Critical signals
        </CardTitle>
        <CardDescription>
          События целостности за {windowDays} дн.
          {signals.error ? ` — ${signals.error}` : ''}
          {!signals.tablePresent ? ' (таблица не найдена)' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4')}>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-bold text-slate-900">{tamperCount}</span>
          <span className="text-sm text-slate-500">PRICE_TAMPERING</span>
          {tamperCount === 0 ? (
            <Badge className="rounded-lg bg-emerald-100 text-emerald-800 border-emerald-200">Норма</Badge>
          ) : (
            <Badge variant="destructive" className="rounded-lg">Требует внимания</Badge>
          )}
          <span className="text-xs text-slate-400">всего сигналов: {signals.totalInWindow ?? 0}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
            value={filterKey}
            onChange={(e) => setFilterKey(e.target.value)}
            aria-label="Фильтр по типу сигнала"
          >
            <option value="all">Все типы</option>
            {CRITICAL_SIGNAL_KEYS.map((key) => (
              <option key={key} value={key}>
                {SIGNAL_LABELS[key] || key} ({signals.countsByKey?.[key] ?? 0})
              </option>
            ))}
          </select>
          <Input
            className="rounded-xl min-h-[44px]"
            placeholder="Поиск по detail (listing, renter, booking…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {CRITICAL_SIGNAL_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterKey(key)}
              className={`min-h-[44px] rounded-lg border px-3 py-2 transition-colors ${
                filterKey === key
                  ? 'border-brand bg-brand/10 text-brand-hover font-medium'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}
            >
              {SIGNAL_LABELS[key] || key}: {signals.countsByKey?.[key] ?? 0}
            </button>
          ))}
        </div>

        {events.length > 0 ? (
          <ul className={cn(MOBILE_FLAT_INSET_CLASS, 'space-y-2 text-sm p-3 max-h-80 overflow-y-auto sm:border-slate-100 sm:bg-slate-50/80')}>
            {events.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 border-b border-slate-100 last:border-0 pb-2 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-lg font-mono text-[10px]">
                    {row.signalKey}
                  </Badge>
                  <span className="text-xs text-slate-400">{formatDt(row.createdAt)}</span>
                  {Array.isArray(row.links) && row.links.length > 0 ? (
                    <span className="flex flex-wrap gap-2">
                      {row.links.map((link) => (
                        <Link
                          key={`${row.id}-${link.href}`}
                          href={link.href}
                          className="text-xs font-medium text-brand hover:underline min-h-[44px] inline-flex items-center"
                        >
                          {link.label} →
                        </Link>
                      ))}
                    </span>
                  ) : null}
                </div>
                <details className="rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:px-0">
                  <summary className="cursor-pointer text-xs text-slate-600 list-none [&::-webkit-details-marker]:hidden min-h-[44px] flex items-center">
                    detail
                  </summary>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-700">
                    {row.detailText || '—'}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Нет записей по выбранному фильтру.</p>
        )}

        <p className="text-xs text-slate-400">
          Только просмотр. Действия по блокировке — в{' '}
          <Link href="/admin/security" className="text-brand hover:underline">
            Security
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
