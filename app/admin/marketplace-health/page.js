'use client'

import { useEffect, useState } from 'react'
import { Loader2, Globe2, AlertCircle, ClipboardList, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function pctColor(p) {
  if (p == null || Number.isNaN(p)) return 'bg-slate-200'
  if (p < 55) return 'bg-amber-500'
  if (p < 75) return 'bg-brand'
  return 'bg-emerald-600'
}

function formatThbAdmin(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} THB`
}

function formatRoiRatio(margin, paid, roi) {
  if (paid > 0 && roi != null && Number.isFinite(roi)) {
    return `${roi.toFixed(2)}× (маржа / выплаты)`
  }
  if (paid <= 0 && margin > 0) return '∞ (выплат по бонусам ещё не было)'
  if (paid <= 0 && margin <= 0) return '—'
  return '—'
}

function MarketingRoiBlock({ roi }) {
  if (!roi || typeof roi !== 'object') {
    return <p className="text-sm text-slate-600">Нет данных.</p>
  }
  if (roi.error) {
    return (
      <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
        ROI недоступен: {String(roi.error)}
      </p>
    )
  }
  const margin = Number(roi.referralGrossMarginThb) || 0
  const paid = Number(roi.referralPaidBonusesThb) || 0
  const r = roi.referralRoi
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6 items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Валовая маржа с реф-гостей</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-900 leading-tight">{formatThbAdmin(margin)}</p>
          <p className="text-xs text-slate-500 mt-1">Сумма commission_thb по броням (см. подпись выше)</p>
        </div>
        <div className="border-l border-emerald-200 pl-6 min-w-[8rem]">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Выплачено бонусов</p>
          <p className="text-2xl font-bold tabular-nums text-slate-800 leading-tight">{formatThbAdmin(paid)}</p>
          <p className="text-xs text-slate-500 mt-1">referral_ledger bonus earned</p>
        </div>
        <div className="border-l border-emerald-200 pl-6 min-w-[10rem] flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-emerald-600 shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ROI</p>
            <p className="text-2xl font-black tabular-nums text-emerald-800 leading-tight">{formatRoiRatio(margin, paid, r)}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {roi.estimateNote || 'Период 30d — SSOT с /admin/marketing/roi'}
        {roi.periodPreset ? ` (${roi.periodPreset})` : ''} · referee: {roi.refereeCount ?? '—'} · броней в
        периоде: {roi.bookingRowsScanned ?? '—'}
      </p>
    </div>
  )
}

export default function MarketplaceHealthPage() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const res = await fetch('/api/v2/admin/marketplace-health', { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok || !data.success) {
          setErr(data.error || `HTTP ${res.status}`)
          setPayload(null)
          return
        }
        setPayload(data)
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Request failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cities = payload?.cities || []
  const windowDays = payload?.windowDays ?? 30
  const pulseDays = payload?.pulseWindowDays ?? 7
  const snap7 = payload?.snapshotRowsLast7Days
  const auto7 = payload?.autoVerificationsLast7Days
  const staffFeed = payload?.staffAuditFeed || []
  const auditOk = payload?.auditLogAvailable !== false

  return (
    <div className="p-4 lg:p-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Globe2 className="h-7 w-7 text-brand" aria-hidden />
          Marketplace Health
        </h1>
        <p className="text-slate-600 mt-1 text-sm sm:text-base">
          Средняя доля объявлений с бейджем Verified в выдаче по подсказке места (снимки при majority {'>'} 50%, Stage
          87.1 / 89.0). Окно: последние {windowDays} дней.
        </p>
      </div>

      <Card className="border-brand/20 bg-gradient-to-br from-brand/10 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pulse — верификации за {pulseDays} дней</CardTitle>
          <CardDescription>
            Счётчик из таблицы <code className="text-xs bg-white/80 px-1 rounded border">catalog_verified_snapshots</code>{' '}
            (046): сколько новых снимков выдачи записано; ниже — авто-верификации профилей по одобренным заявкам (
            <code className="text-xs bg-white/80 px-1 rounded border">SYSTEM_AUTO_VERIFICATION</code>), если журнал доступен.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 py-2">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              Загрузка пульса…
            </div>
          ) : err ? null : (
            <div className="flex flex-wrap gap-6 items-end">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Новых снимков каталога</p>
                <p className="text-4xl font-bold tabular-nums text-brand-hover leading-tight">
                  {snap7 != null ? snap7 : '—'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Строк в снимках (телеметрия Verified-share)</p>
              </div>
              <div className="border-l border-brand/20 pl-6 min-w-[8rem]">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Авто VERIFIED (заявки)</p>
                <p className="text-3xl font-semibold tabular-nums text-slate-800 leading-tight">
                  {auto7 != null ? auto7 : '—'}
                </p>
                <p className="text-xs text-slate-500 mt-1">События аудита за тот же период</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Marketing Efficiency</CardTitle>
          <CardDescription>
            ROI реферальной воронки: валовая маржа платформы (комиссии с броней приглашённых гостей) к выплаченным
            бонусам из <code className="text-xs bg-white/80 px-1 rounded border">referral_ledger</code> (
            <code className="text-xs">type=bonus</code>, <code className="text-xs">status=earned</code>). SSOT:{' '}
            <code className="text-xs">bookings.renter_id ∈ referral_relations.referee_id</code>, статусы{' '}
            <code className="text-xs">PAID | PAID_ESCROW | CHECKED_IN | COMPLETED</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 py-2">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              Загрузка ROI…
            </div>
          ) : err ? null : (
            <MarketingRoiBlock roi={payload?.marketingRoi} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand-hover" aria-hidden />
            Последние действия персонала
          </CardTitle>
          <CardDescription>
            Записи из critical_signal_events: одобрение заявок партнёров (SYSTEM_AUTO_VERIFICATION), модерация объявлений
            и ручная верификация в карточке пользователя. Доступно ролям ADMIN и MODERATOR с правом на эту страницу.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 py-6 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Загрузка журнала…
            </div>
          ) : err ? null : !auditOk && payload?.auditLogError ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Журнал недоступен: {payload.auditLogError}
            </p>
          ) : staffFeed.length === 0 ? (
            <p className="text-slate-600 text-sm py-2">
              Пока нет событий в выборке или таблица ещё не создана на проекте.
            </p>
          ) : (
            <ul className="space-y-3">
              {staffFeed.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                >
                  <time
                    className="text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0"
                    dateTime={row.createdAt || undefined}
                  >
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </time>
                  <p className="text-slate-800 leading-snug">{row.summaryRu}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Верификация по «городам»</CardTitle>
          <CardDescription>
            Ниже — агрегаты из <code className="text-xs bg-slate-100 px-1 rounded">catalog_verified_snapshots</code>.
            Низкий % помогает увидеть «белые пятна» на карте доверия.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
              Загрузка…
            </div>
          ) : err ? (
            <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          ) : cities.length === 0 ? (
            <p className="text-slate-600 text-sm py-4">
              Пока нет записей в окне: либо миграция не применена, либо не было поисков с majority Verified.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Подсказка (where_hint)</th>
                    <th className="py-2 pr-4 font-medium whitespace-nowrap">Ср. % Verified</th>
                    <th className="py-2 pr-4 font-medium whitespace-nowrap">Снимков</th>
                    <th className="py-2 font-medium whitespace-nowrap">Последняя запись (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((row) => {
                    const p = Number(row.avgVerifiedPercent)
                    return (
                      <tr key={row.whereHint} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2.5 pr-4 align-middle max-w-[min(52vw,28rem)] truncate" title={row.whereHint}>
                          {row.whereHint}
                        </td>
                        <td className="py-2.5 pr-4 align-middle">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 rounded-full bg-slate-200 overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-full ${pctColor(p)}`}
                                style={{ width: `${Math.min(100, Math.max(0, p))}%` }}
                              />
                            </div>
                            <span className="font-semibold tabular-nums text-slate-900">{p}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 align-middle tabular-nums text-slate-700">
                          {row.snapshotCount}
                        </td>
                        <td className="py-2.5 align-middle text-slate-600 whitespace-nowrap text-xs">
                          {row.lastRecordedAt
                            ? new Date(row.lastRecordedAt).toISOString().replace('T', ' ').slice(0, 19)
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {payload?.truncated ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 mt-4">
                  Достигнут лимит выборки ({payload.maxRows} строк); агрегаты могут быть неполными.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
