'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, Loader2, Users, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchShadowL2Liability } from '@/lib/admin/admin-fintech-api-client'
import { fmtThb } from '@/lib/admin/fintech-console-shared'

export function FinTechShadowL2LiabilityPanel({ ownerMode = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchShadowL2Liability()
    if (!res.ok) {
      setError(res.error || 'load failed')
      setData(null)
    } else {
      setData(res.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <Card className="border-violet-200/70">
        <CardContent className="py-8 flex justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Shadow L2…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-rose-200">
        <CardContent className="py-6 text-sm text-rose-700">{error}</CardContent>
      </Card>
    )
  }

  const totals = data?.totals || {}
  const top = Array.isArray(data?.topMentors) ? data.topMentors : []
  const isShadow = data?.mode === 'shadow'

  return (
    <Card className="border-violet-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-violet-600" />
              Shadow L2 — потенциальная нагрузка
            </CardTitle>
            <CardDescription className="mt-1">
              {isShadow
                ? 'L2 не начисляется в ledger; 12% пула отложено и трекается в metadata.'
                : 'L2 live — исторические shadow-данные для сравнения.'}
              {ownerMode ? ' · режим owner' : ''}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
            <p className="text-xs uppercase tracking-wide text-violet-800/70">Текущий месяц (UTC)</p>
            <p className="text-2xl font-bold tabular-nums text-violet-950 mt-1">
              ฿{fmtThb(totals.currentMonthShadowThb)}
            </p>
            <p className="text-xs text-violet-900/70 mt-1">{data?.currentMonthUtc}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Всего shadow (all time)</p>
            <p className="text-2xl font-bold tabular-nums mt-1">฿{fmtThb(totals.allTimeShadowThb)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Наставников с shadow</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{totals.mentorCount ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">
              cap {data?.config?.l2MonthlyCapThb ?? '—'} THB/мес · {data?.config?.l2PerBookingCapThb} THB/бронь
            </p>
          </div>
        </div>

        {isShadow ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              При flip <code className="text-xs">ambassador_guest_l2_enabled</code> потенциальная выплата ≈
              накопленный shadow (с caps). Сейчас 12% остаётся у платформы (owner retained).
            </span>
          </div>
        ) : null}

        <div>
          <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5 mb-3">
            <Users className="h-4 w-4" />
            Топ наставников (shadow, all time)
          </p>
          {top.length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет completed-броней с shadow_l2_thb.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Наставник</th>
                    <th className="px-3 py-2 text-right">Shadow всего</th>
                    <th className="px-3 py-2 text-right">Этот месяц</th>
                    <th className="px-3 py-2 text-right">% cap</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((row) => (
                    <tr key={row.l2_referrer_id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <span className="font-medium">{row.mentor_name || row.l2_referrer_id}</span>
                        {row.mentor_referral_code ? (
                          <span className="block text-xs text-slate-500">{row.mentor_referral_code}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">฿{fmtThb(row.shadow_l2_thb_sum)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">฿{fmtThb(row.month_shadow_thb)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.at_cap ? (
                          <span className="text-amber-700 font-medium">{row.cap_utilization_pct}% ⚠</span>
                        ) : (
                          `${row.cap_utilization_pct ?? 0}%`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {data?.projectionNote ? (
          <p className="text-xs text-slate-500">{data.projectionNote}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
