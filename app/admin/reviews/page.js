'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, RefreshCw, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function ReviewModerationLinks({ row }) {
  return (
    <div className="space-y-1 text-sm">
      {row.listingId ? (
        <Link
          href={`/listings/${encodeURIComponent(row.listingId)}`}
          className="inline-flex items-center gap-1 text-brand hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="line-clamp-1">{row.listingTitle || row.listingId}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </Link>
      ) : null}
      {row.bookingId ? (
        <div>
          <Link
            href={`/admin/bookings/${encodeURIComponent(row.bookingId)}`}
            className="text-xs text-slate-600 hover:underline"
          >
            Бронь {row.bookingId}
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function ReviewModerationActions({ row, busy, onModerate }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="brand"
        className="min-h-[44px] w-full sm:w-auto"
        disabled={busy}
        onClick={() => void onModerate(row, 'approved')}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Одобрить'}
      </Button>
      <Button
        variant="outline"
        className="min-h-[44px] w-full sm:w-auto"
        disabled={busy}
        onClick={() => void onModerate(row, 'removed')}
      >
        Скрыть
      </Button>
    </div>
  )
}

function ReviewModerationMobileCard({ row, busy, onModerate }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline">{row.sourceLabel}</Badge>
          <span className="text-sm font-semibold text-slate-900">★ {row.rating ?? '—'}</span>
        </div>

        <div className="text-sm">
          <div className="font-medium text-slate-900">{row.authorName || row.authorId || '—'}</div>
          {row.guestName ? (
            <div className="text-xs text-slate-500">Клиент: {row.guestName}</div>
          ) : null}
        </div>

        <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
          {row.comment || <span className="text-slate-400">—</span>}
        </p>

        <ReviewModerationLinks row={row} />

        <ReviewModerationActions row={row} busy={busy} onModerate={onModerate} />
      </CardContent>
    </Card>
  )
}

export default function AdminReviewsModerationPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [actingId, setActingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reviews?limit=200', {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      setRows(json.data?.items || [])
      if (json.warnings?.length) {
        console.warn('[admin/reviews]', json.warnings)
      }
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить очередь')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function moderate(row, status) {
    const key = `${row.source}:${row.id}`
    setActingId(key)
    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(row.id)}/moderation`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, source: row.source }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Ошибка модерации')
      }
      toast.success(status === 'approved' ? 'Отзыв опубликован' : 'Отзыв скрыт')
      setRows((prev) => prev.filter((r) => !(r.id === row.id && r.source === row.source)))
    } catch (e) {
      toast.error(e?.message || 'Не удалось обновить отзыв')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Модерация отзывов</h1>
          <p className="mt-1 text-sm text-slate-600">
            Очередь Content Guard: отзывы со статусом <code className="text-xs">flagged</code>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-amber-500" />
            Flagged ({rows.length})
          </CardTitle>
          <CardDescription>
            Гостевые отзывы на листинг и отзывы партнёра о клиенте. Одобрение обновит рейтинг листинга
            автоматически.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Загрузка…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Нет отзывов на проверке.</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rows.map((row) => {
                  const rowKey = `${row.source}:${row.id}`
                  return (
                    <ReviewModerationMobileCard
                      key={rowKey}
                      row={row}
                      busy={actingId === rowKey}
                      onModerate={moderate}
                    />
                  )
                })}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Тип</TableHead>
                      <TableHead>Автор</TableHead>
                      <TableHead>Текст</TableHead>
                      <TableHead>Оценка</TableHead>
                      <TableHead>Ссылки</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const rowKey = `${row.source}:${row.id}`
                      const busy = actingId === rowKey
                      return (
                        <TableRow key={rowKey}>
                          <TableCell>
                            <Badge variant="outline">{row.sourceLabel}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">{row.authorName || row.authorId || '—'}</div>
                            {row.guestName ? (
                              <div className="text-xs text-slate-500">Клиент: {row.guestName}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-md whitespace-pre-wrap text-sm text-slate-700">
                            {row.comment || <span className="text-slate-400">—</span>}
                          </TableCell>
                          <TableCell>{row.rating ?? '—'}</TableCell>
                          <TableCell>
                            <ReviewModerationLinks row={row} />
                          </TableCell>
                          <TableCell className="text-right">
                            <ReviewModerationActions row={row} busy={busy} onModerate={moderate} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
