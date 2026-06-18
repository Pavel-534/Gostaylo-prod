'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MapPin, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { LocationSuggestionsTable } from '@/components/admin/locations/LocationSuggestionsTable'
import { LocationMergeDialog } from '@/components/admin/locations/LocationMergeDialog'
import { LocationRejectDialog } from '@/components/admin/locations/LocationRejectDialog'
import {
  fetchAdminHealthLocationStats,
  fetchLocationSuggestionsQueue,
  resolveLocationSuggestion,
} from '@/lib/admin/location-suggestions-api-client'

export default function LocationSuggestionsAdminPage() {
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [healthStats, setHealthStats] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [mergeRow, setMergeRow] = useState(null)
  const [rejectRow, setRejectRow] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const canResolve = user?.role === 'ADMIN'

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [queue, health] = await Promise.all([
        fetchLocationSuggestionsQueue({ status: 'PENDING', limit: 100 }),
        fetchAdminHealthLocationStats(),
      ])
      setRows(queue.items || [])
      setTotal(queue.total ?? queue.items?.length ?? 0)
      setHealthStats(health)
    } catch (e) {
      setErr(e?.message || 'Не удалось загрузить очередь')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return
        if (!data.success || !data.user || !['ADMIN', 'MODERATOR'].includes(data.user.role)) {
          window.location.href = '/login?redirect=/admin/locations/suggestions'
          return
        }
        setUser(data.user)
      } catch {
        if (!cancelled) setErr('Ошибка авторизации')
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadQueue()
  }, [user, loadQueue])

  async function handleMergeConfirm(payload) {
    if (!mergeRow) return
    setProcessingId(mergeRow.id)
    try {
      const result = await resolveLocationSuggestion(mergeRow.id, {
        action: 'MERGE',
        target_code: payload.target_code,
        target_type: payload.target_type,
      })
      setRows((prev) => prev.filter((r) => r.id !== mergeRow.id))
      setTotal((t) => Math.max(0, t - 1))
      setMergeRow(null)
      toast.success(
        `Слито в «${result.target_code}» · обновлено объявлений: ${result.merged_listings_count ?? 0}`,
      )
      loadQueue()
    } catch (e) {
      toast.error(e?.message || 'Merge не выполнен')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleRejectConfirm() {
    if (!rejectRow) return
    setProcessingId(rejectRow.id)
    try {
      await resolveLocationSuggestion(rejectRow.id, {
        action: 'REJECT',
        reject_reason: rejectReason.trim() || undefined,
      })
      setRows((prev) => prev.filter((r) => r.id !== rejectRow.id))
      setTotal((t) => Math.max(0, t - 1))
      setRejectRow(null)
      setRejectReason('')
      toast.success('Термин отклонён')
      loadQueue()
    } catch (e) {
      toast.error(e?.message || 'Reject не выполнен')
    } finally {
      setProcessingId(null)
    }
  }


  const lastNormalize = healthStats?.locationNormalize?.last_summary
  const suggestMetrics = healthStats?.locationSuggest

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-7 w-7 text-brand" aria-hidden />
            Очередь локаций
          </h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base max-w-2xl">
            Непроверенные термины из объявлений партнёров. MERGE создаёт синоним и обновляет листинги;
            REJECT скрывает термин из подсказок. Разрешение — только ADMIN.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={loadQueue} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Обновить
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">В очереди</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Unverified (batch)</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {lastNormalize?.remaining_unverified ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Suggest p95</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {suggestMetrics?.p95_ms != null ? `${suggestMetrics.p95_ms} ms` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Synonym hit rate</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700">
              {suggestMetrics?.synonym_hit_rate != null
                ? `${Math.round(suggestMetrics.synonym_hit_rate * 100)}%`
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {!canResolve ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Режим просмотра (MODERATOR): кнопки MERGE / REJECT доступны только ADMIN.
        </p>
      ) : null}

      {err ? (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
        </div>
      ) : null}

      {!loading && rows.length === 0 && !err ? (
        <Card className="border-dashed">
          <CardContent className="py-4">
            <EmptyState
              title="Очередь чиста — все локации верифицированы ✅"
              hint="Партнёры используют канонические районы. Новые непроверенные термины появятся здесь автоматически, когда кто-то укажет незнакомое место в объявлении."
              ctaLabel="Обновить очередь"
              onCtaClick={loadQueue}
            >
              {lastNormalize?.processed != null ? (
                <p className="text-xs text-slate-500">
                  Последний batch-normalize: обработано {lastNormalize.processed}, synonym{' '}
                  {lastNormalize.by_source?.synonym ?? 0}, canon {lastNormalize.by_source?.canon_only ?? 0}
                </p>
              ) : null}
            </EmptyState>
          </CardContent>
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <LocationSuggestionsTable
          rows={rows}
          canResolve={canResolve}
          processingId={processingId}
          onMerge={(row) => setMergeRow(row)}
          onReject={(row) => {
            setRejectReason('')
            setRejectRow(row)
          }}
        />
      ) : null}

      <LocationMergeDialog
        open={Boolean(mergeRow)}
        onOpenChange={(open) => {
          if (!open) setMergeRow(null)
        }}
        suggestion={mergeRow}
        processing={processingId === mergeRow?.id}
        onConfirm={handleMergeConfirm}
      />

      <LocationRejectDialog
        open={Boolean(rejectRow)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectRow(null)
            setRejectReason('')
          }
        }}
        suggestion={rejectRow}
        processing={processingId === rejectRow?.id}
        rejectReason={rejectReason}
        onRejectReasonChange={setRejectReason}
        onConfirm={handleRejectConfirm}
      />
    </div>
  )
}
