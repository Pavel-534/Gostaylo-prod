'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2, ArrowLeft, Siren } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatDt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

function checklistSummary(c) {
  if (!c || typeof c !== 'object') return '—'
  const parts = []
  if (c.health_or_safety === true) parts.push('Здоровье / безопасность')
  if (c.no_property_access === true) parts.push('Нет доступа в жильё')
  if (c.disaster === true) parts.push('Авария / ЧС')
  return parts.length ? parts.join('; ') : '—'
}

function pushStatus(ev) {
  const p = ev?.push && typeof ev.push === 'object' ? ev.push : null
  if (!p) return '—'
  if (p.skipped) return 'Пропуск (staff)'
  if (p.success) return `OK (sent ${p.sent ?? 0})`
  return `Ошибка: ${p.error || 'FCM'}`
}

export default function AdminBookingDetailPage() {
  const params = useParams()
  const id = String(params?.id || '').trim()
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(null)
  const [exempt, setExempt] = useState(false)
  const [markingAt, setMarkingAt] = useState(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v2/admin/bookings/${encodeURIComponent(id)}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || `Ошибка ${res.status}`)
        setBooking(null)
        return
      }
      const b = json.data?.booking
      setBooking(b || null)
      const m = b?.metadata && typeof b.metadata === 'object' ? b.metadata : {}
      setExempt(m.emergency_contact_rate_limit_exempt === true)
    } catch (e) {
      toast.error(e?.message || 'Сеть')
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function setRateExempt(next) {
    try {
      const res = await fetch(`/api/v2/admin/bookings/${encodeURIComponent(id)}/emergency-actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rate_limit_exempt', value: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось сохранить')
        return
      }
      setExempt(next)
      toast.success(next ? 'Лимит 24ч снят для брони' : 'Лимит 24ч снова действует')
      void load()
    } catch (e) {
      toast.error(e?.message || 'Сеть')
    }
  }

  async function markAbuse(at) {
    setMarkingAt(at)
    try {
      const res = await fetch(`/api/v2/admin/bookings/${encodeURIComponent(id)}/emergency-actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_abuse', at }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось пометить')
        return
      }
      toast.success('Событие помечено как злоупотребление')
      void load()
    } catch (e) {
      toast.error(e?.message || 'Сеть')
    } finally {
      setMarkingAt(null)
    }
  }

  const events = Array.isArray(booking?.metadata?.emergency_contact_events)
    ? [...booking.metadata.emergency_contact_events].sort(
        (a, b) => new Date(String(b?.at || 0)).getTime() - new Date(String(a?.at || 0)).getTime(),
      )
    : []

  return (
    <div className="space-y-6 max-w-5xl p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link href="/admin/disputes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К спорам
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-slate-900">Бронирование</h1>
        <code className="text-sm bg-slate-100 px-2 py-1 rounded">{id || '—'}</code>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      ) : !booking ? (
        <p className="text-slate-600">Бронь не найдена или нет доступа.</p>
      ) : (
        <>
          <Card className="rounded-2xl border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Кратко</CardTitle>
              <CardDescription>Статус и участники</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1 text-slate-700">
              <p>
                <span className="text-slate-500">Статус:</span> {String(booking.status || '—')}
              </p>
              <p>
                <span className="text-slate-500">Гость:</span> {String(booking.renter_id || '—')}
              </p>
              <p>
                <span className="text-slate-500">Партнёр:</span> {String(booking.partner_id || '—')}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-red-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Siren className="h-5 w-5 text-red-600" />
                Trust &amp; Safety Audit
              </CardTitle>
              <CardDescription>
                Экстренные вызовы: время, чеклист гостя, доставка push. Лимит 1 вызов / 24 ч на бронь (если не снят
                админом). Пометка «злоупотребление» пишется в{' '}
                <code className="text-xs bg-slate-100 px-1 rounded">metadata.emergency_contact_events[].abuse</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="em-exempt" className="text-sm font-medium text-slate-800">
                    Снять лимит 24 ч (повторные экстренные вызовы)
                  </Label>
                  <p className="text-xs text-slate-500">Только для подтверждённых кейсов службой поддержки.</p>
                </div>
                <Switch id="em-exempt" checked={exempt} onCheckedChange={(v) => void setRateExempt(v === true)} />
              </div>

              {events.length === 0 ? (
                <p className="text-sm text-slate-600">Записей пока нет.</p>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Время</TableHead>
                        <TableHead>Причина</TableHead>
                        <TableHead>Push</TableHead>
                        <TableHead>Абьюз</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((ev) => {
                        const at = String(ev?.at || '')
                        const abused = ev?.abuse?.marked === true
                        return (
                          <TableRow key={at}>
                            <TableCell className="whitespace-nowrap font-mono text-xs">{formatDt(at)}</TableCell>
                            <TableCell className="max-w-[220px] text-xs">{checklistSummary(ev?.checklist)}</TableCell>
                            <TableCell className="text-xs">{pushStatus(ev)}</TableCell>
                            <TableCell>
                              {abused ? (
                                <Badge variant="secondary" className="text-xs">
                                  Помечено
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!abused ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  disabled={markingAt === at}
                                  onClick={() => void markAbuse(at)}
                                >
                                  {markingAt === at ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Пометить как злоупотребление'}
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
