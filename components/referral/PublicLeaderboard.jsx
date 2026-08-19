'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2 } from 'lucide-react'

const HERO_PLACEHOLDER = '—'

function safeInitials(maskedName) {
  const s = String(maskedName || '').trim()
  if (!s) return 'A'
  // For masked names like "Иван П." we take the first codepoint char.
  return s.slice(0, 1).toUpperCase()
}

function tierVariant(tierName) {
  const t = String(tierName || '').toLowerCase()
  if (!t) return 'outline'
  if (t.includes('ambassador')) return 'default'
  if (t.includes('pro')) return 'secondary'
  return 'outline'
}

export function PublicLeaderboard({ period = 'month', limit = 10 }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [payload, setPayload] = useState(null)

  const qs = useMemo(() => {
    const p = String(period || 'month').toLowerCase() === 'alltime' ? 'alltime' : 'month'
    const l = Math.min(25, Math.max(1, Math.floor(Number(limit) || 10)))
    return `period=${encodeURIComponent(p)}&limit=${encodeURIComponent(l)}`
  }, [period, limit])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/v2/referral/leaderboard/public?${qs}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP_${res.status}`)
        const json = await res.json()
        if (!alive) return
        setPayload(json || null)
      } catch {
        if (!alive) return
        setError(true)
        setPayload(null)
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [qs])

  const entries = Array.isArray(payload?.entries) ? payload.entries : []
  const nextRankHint = typeof payload?.next_rank_hint === 'string' ? payload.next_rank_hint : null
  const title = payload?.period === 'alltime' ? 'За всё время' : 'Этот месяц'

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-red-700">Не удалось загрузить рейтинг</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {nextRankHint ? (
        <p className="text-xs sm:text-sm text-slate-700 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
          {nextRankHint}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">Топ-10 амбассадоров: {title}</p>
        <Badge variant="outline">{entries.length || HERO_PLACEHOLDER}</Badge>
      </div>

      <TooltipProvider delayDuration={200}>
        <ul className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
          {entries.map((e) => {
            const initials = safeInitials(e.masked_name)
            const partnersCount = Number(e.direct_partners_count || 0)
            const badgeCount = Number(e.badge_count || 0)
            return (
              <li
                key={String(e.rank)}
                className="shrink-0 sm:shrink sm:basis-[320px] w-[320px] sm:w-auto"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      role="group"
                      className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-11 w-11 rounded-full border border-brand/20 bg-brand/5">
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500 tabular-nums">#{e.rank}</div>
                            <div className="text-sm font-semibold text-slate-900 truncate">{e.masked_name}</div>
                          </div>
                        </div>

                        <Badge variant={tierVariant(e.tier_name)} className="shrink-0">
                          {e.tier_name || '—'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">Заработано</div>
                        <div className="text-sm font-semibold tabular-nums text-brand-hover">
                          {e.earned_bucket_thb || HERO_PLACEHOLDER}
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    <div className="space-y-1">
                      <div>Активных партнёров: {partnersCount}</div>
                      <div>Бейджей: {badgeCount}</div>
                      {e.city_label || e.country_code ? (
                        <div className="opacity-80">
                          {e.city_label ? e.city_label : ''}
                          {e.city_label && e.country_code ? ', ' : ''}
                          {e.country_code ? e.country_code : ''}
                        </div>
                      ) : null}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ul>
      </TooltipProvider>

    </div>
  )
}

