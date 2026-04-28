'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Trophy } from 'lucide-react'

/**
 * @param {{
 *  t: (key: string, ctx?: Record<string, string | number>) => string,
 *  formatThb: (n: number, locale: string) => string,
 *  locale: string,
 *  formatAmountLine?: (amountThb: number) => string,
 * }} props
 */
export function ReferralMonthlyLeaderboard({ t, formatThb, formatAmountLine, locale }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [payload, setPayload] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(false)
    try {
      const res = await fetch('/api/v2/referral/leaderboard', { credentials: 'include', cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        setErr(true)
        setPayload(null)
        return
      }
      setPayload(json.data || null)
    } catch {
      setErr(true)
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const period =
    payload?.periodStartDdMmYyyy && payload?.periodEndDdMmYyyy
      ? t('stage74_leaderboardPeriod')
          .replace('{from}', String(payload.periodStartDdMmYyyy))
          .replace('{to}', String(payload.periodEndDdMmYyyy))
      : ''

  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  const fmtLine =
    typeof formatAmountLine === 'function'
      ? formatAmountLine
      : (amountThb) => `฿${formatThb(amountThb, locale)}`

  return (
    <Card className="border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-teal-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
          {t('stage74_leaderboardTitle')}
        </CardTitle>
        <CardDescription className="text-xs space-y-1">
          <span>{t('stage74_leaderboardSubtitle')}</span>
          {payload?.statsCalendarIana ? (
            <span className="block font-mono text-[11px] text-slate-500">{payload.statsCalendarIana}</span>
          ) : null}
          {period ? <span className="block tabular-nums">{period}</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('referralFeed_loading')}
          </div>
        ) : err ? (
          <p className="text-sm text-red-700">{t('stage74_leaderboardErr')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-600">{t('stage74_leaderboardEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.referrerId}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-sm"
              >
                <span className="text-slate-600 tabular-nums shrink-0">
                  {t('stage74_leaderboardRank').replace('{n}', String(row.rank))}
                </span>
                <span className="font-medium text-slate-900 truncate min-w-0 flex-1">{row.displayName}</span>
                <span className="tabular-nums font-semibold text-teal-800 shrink-0 text-right max-w-[11rem] leading-tight">
                  {fmtLine(Number(row.amountThb) || 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
