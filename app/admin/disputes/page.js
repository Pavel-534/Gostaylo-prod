'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Gavel } from 'lucide-react'
import { toast } from 'sonner'

import UnifiedOrderCard from '@/components/orders/UnifiedOrderCard'
import AdminDisputeChatPeek from '@/components/admin/AdminDisputeChatPeek'
import { ProxiedImage } from '@/components/proxied-image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'open', label: 'Открытые' },
  { id: 'frozen', label: 'Заморозка' },
  { id: 'resolved', label: 'Закрытые' },
]

function typeLabel(t) {
  if (t === 'transport') return 'Транспорт'
  return 'Жильё'
}

function statusBadgeVariant(status, frozen) {
  const s = String(status || '').toUpperCase()
  if (['RESOLVED', 'CLOSED', 'REJECTED'].includes(s)) return 'secondary'
  if (frozen && ['OPEN', 'IN_REVIEW'].includes(s)) return 'destructive'
  return 'default'
}

function statusLabel(status, frozen) {
  const s = String(status || '').toUpperCase()
  if (frozen && ['OPEN', 'IN_REVIEW'].includes(s)) return 'FROZEN'
  return s || '—'
}

function mergeRowFromSnapshot(row, snap) {
  if (!snap || String(row.id) !== String(snap.id)) return row
  return {
    ...row,
    status: snap.status ?? row.status,
    freezePayment: snap.freezePayment ?? row.freezePayment,
    forceRefundRequested: snap.forceRefundRequested ?? row.forceRefundRequested,
    updatedAt: snap.updatedAt ?? row.updatedAt,
  }
}

function mergeDetailDispute(detail, snap) {
  if (!detail?.dispute || !snap || String(detail.dispute.id) !== String(snap.id)) return detail
  return {
    ...detail,
    dispute: {
      ...detail.dispute,
      status: snap.status ?? detail.dispute.status,
      freezePayment: snap.freezePayment ?? detail.dispute.freezePayment,
      forceRefundRequested: snap.forceRefundRequested ?? detail.dispute.forceRefundRequested,
      penaltyRequested: snap.penaltyRequested ?? detail.dispute.penaltyRequested,
      resolvedAt: snap.resolvedAt !== undefined ? snap.resolvedAt : detail.dispute.resolvedAt,
      closedBy: snap.closedBy !== undefined ? snap.closedBy : detail.dispute.closedBy,
      metadata: snap.metadata ?? detail.dispute.metadata,
    },
  }
}

function ListSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  )
}

export default function AdminDisputesPage() {
  const [me, setMe] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [verdict, setVerdict] = useState('')
  const [guiltyParty, setGuiltyParty] = useState('none')
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (!data.success || !data.user || !['ADMIN', 'MODERATOR'].includes(data.user.role)) {
          setMe(null)
        } else {
          setMe(data.user)
        }
      } catch {
        setMe(null)
      } finally {
        setAuthChecked(true)
      }
    })()
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v2/admin/disputes?filter=${encodeURIComponent(filter)}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось загрузить споры')
        setRows([])
        return
      }
      setRows(Array.isArray(json.data) ? json.data : [])
    } catch {
      toast.error('Ошибка сети')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (!me) return
    void loadList()
  }, [me, loadList])

  const loadDetail = useCallback(async (disputeId) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/v2/admin/disputes/${encodeURIComponent(disputeId)}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось загрузить кейс')
        setDetail(null)
        return
      }
      setDetail(json.data)
      setVerdict('')
      setGuiltyParty('none')
    } catch {
      toast.error('Ошибка сети')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openRow = (id) => {
    setSelectedId(id)
    setSheetOpen(true)
    void loadDetail(id)
  }

  const applySnapshot = useCallback((snap) => {
    if (!snap?.id) return
    setRows((prev) => prev.map((r) => mergeRowFromSnapshot(r, snap)))
    setDetail((d) => mergeDetailDispute(d, snap))
  }, [])

  const postAction = async (action) => {
    if (!selectedId) return
    setActionBusy(true)
    try {
      const body = { action, reason: verdict.trim() }
      if (action === 'close_dispute') {
        body.guiltyParty = guiltyParty
      }
      const res = await fetch(`/api/v2/admin/disputes/${encodeURIComponent(selectedId)}/action`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Действие не выполнено')
        return
      }
      toast.success('Сохранено')
      if (json.data?.dispute) applySnapshot(json.data.dispute)
      else void loadList()
      if (action === 'close_dispute' && json.data?.dispute) {
        setVerdict('')
      }
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setActionBusy(false)
    }
  }

  const terminal = useMemo(() => {
    const s = String(detail?.dispute?.status || '').toUpperCase()
    return ['RESOLVED', 'CLOSED', 'REJECTED'].includes(s)
  }, [detail?.dispute?.status])

  const conversationId = detail?.dispute?.conversationId || detail?.booking?.conversationId || null

  const disputeEvidenceUrls = (() => {
    const m = detail?.dispute?.metadata
    const raw = m && typeof m === 'object' ? m.evidence_urls : null
    if (!Array.isArray(raw)) return []
    return raw.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 6)
  })()

  if (!authChecked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!me) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Доступ запрещён</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/login?redirect=/admin/disputes">Войти</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Gavel className="h-7 w-7 text-teal-700" />
            Центр споров
          </h1>
          <p className="text-slate-600 text-sm mt-1">Арбитраж по бронированиям: заморозка эскроу, возврат, закрытие.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadList()} disabled={loading}>
          Обновить список
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            type="button"
            size="sm"
            variant={filter === f.id ? 'default' : 'outline'}
            className={filter === f.id ? 'bg-teal-700 hover:bg-teal-800' : ''}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Кейсы</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ListSkeleton />
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 py-6">Нет записей для выбранного фильтра.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Заказ / кейс</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Инициатор</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => openRow(r.id)}
                    >
                      <TableCell className="font-mono text-xs sm:text-sm">
                        <div>{r.bookingId}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={r.id}>
                          {r.id}
                        </div>
                      </TableCell>
                      <TableCell>{typeLabel(r.orderType)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.openedByLabel}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(r.status, r.freezePayment)}>
                          {statusLabel(r.status, r.freezePayment)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Разрешение спора</SheetTitle>
            <SheetDescription>
              {selectedId ? (
                <span className="font-mono text-xs">Кейс {selectedId}</span>
              ) : (
                'Выберите строку в таблице'
              )}
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="py-12 flex justify-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : detail?.booking ? (
            <div className="space-y-6 mt-4 pb-8">
              <UnifiedOrderCard booking={detail.booking} unifiedOrder={detail.unifiedOrder} role="admin" language="ru" />

              {detail.booking?.id ? (
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm" className="rounded-xl">
                    <Link href={`/admin/bookings/${encodeURIComponent(String(detail.booking.id))}`}>
                      Логи экстренной связи (бронь)
                    </Link>
                  </Button>
                </div>
              ) : null}

              <AdminDisputeChatPeek conversationId={conversationId} adminUserId={me?.id} />

              {disputeEvidenceUrls.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Материалы от инициатора</p>
                  <div className="flex flex-wrap gap-3">
                    {disputeEvidenceUrls.map((src) => (
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative block w-28 h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0"
                      >
                        <ProxiedImage src={src} alt="" fill className="object-cover" sizes="112px" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-950">Рычаги арбитража</p>
                <div className="space-y-2">
                  <Label htmlFor="verdict">Вердикт / комментарий</Label>
                  <Textarea
                    id="verdict"
                    value={verdict}
                    onChange={(e) => setVerdict(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Кратко зафиксируйте решение для аудита…"
                    disabled={terminal}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Виновная сторона (при закрытии)</Label>
                  <Select value={guiltyParty} onValueChange={setGuiltyParty} disabled={terminal}>
                    <SelectTrigger>
                      <SelectValue placeholder="Не назначать штраф" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Нет / не применять штраф</SelectItem>
                      <SelectItem value="renter">Гость (рентер)</SelectItem>
                      <SelectItem value="partner">Партнёр (хост)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-blue-300 text-blue-900"
                    disabled={terminal || actionBusy}
                    onClick={() => void postAction('freeze_payment')}
                  >
                    Заморозить выплату
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-700 text-amber-900"
                    disabled={terminal || actionBusy}
                    onClick={() => void postAction('force_refund')}
                  >
                    Подготовить возврат
                  </Button>
                  <Button
                    type="button"
                    className="bg-slate-900 text-white hover:bg-slate-800"
                    disabled={terminal || actionBusy}
                    onClick={() => void postAction('close_dispute')}
                  >
                    Закрыть дело
                  </Button>
                </div>
                {terminal ? (
                  <p className="text-xs text-slate-600">Кейс уже закрыт — рычаги недоступны.</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-8">Нет данных по кейсу.</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
