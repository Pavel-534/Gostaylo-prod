'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

export default function AdminPrivacyErasurePage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v2/admin/privacy/erasure-requests?limit=100', {
        credentials: 'include',
      })
      const data = await res.json()
      setRows(data.success ? data.data || [] : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function patchRow(id, action) {
    setActing(id)
    try {
      await fetch(`/api/v2/admin/privacy/erasure-requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await load()
    } finally {
      setActing(null)
    }
  }

  function RowActions({ r }) {
    if (r.status !== 'pending_grace') return null
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="min-h-[44px] max-sm:w-full"
          disabled={acting === r.id}
          onClick={() => patchRow(r.id, 'cancel')}
        >
          Отменить
        </Button>
        <Button
          variant="brand"
          className="min-h-[44px] max-sm:w-full"
          disabled={acting === r.id}
          onClick={() => patchRow(r.id, 'process_now')}
        >
          Выполнить
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-sm:px-0 sm:p-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Запросы на удаление аккаунта</h1>
        <p className="text-sm text-slate-500 mt-1">
          DSAR erasure queue — 30-дневный grace period, затем cron или ручная обработка.
        </p>
      </div>

      <Card className={MOBILE_FLAT_CARD_CLASS}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>Очередь</CardTitle>
          <CardDescription>
            pending_grace → cron `process-data-erasure` или «Выполнить сейчас» (ADMIN)
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'max-sm:p-0 sm:pt-0')}>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">Нет запросов.</p>
          ) : (
            <>
              <div className="sm:hidden space-y-0">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="border-b border-slate-100 px-0 py-3 last:border-b-0 space-y-2"
                  >
                    <p className="font-mono text-xs break-all text-slate-900">{r.user_id}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <p className="text-slate-400">Status</p>
                        <p className="mt-0.5 font-medium text-slate-800">{r.status}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Requested</p>
                        <p className="mt-0.5">{r.requested_at?.slice(0, 10) || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Scheduled</p>
                        <p className="mt-0.5">{r.scheduled_for?.slice(0, 10) || '—'}</p>
                      </div>
                    </div>
                    <RowActions r={r} />
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Requested</th>
                      <th className="py-2 pr-3">Scheduled</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-mono text-xs">{r.user_id}</td>
                        <td className="py-2 pr-3">{r.status}</td>
                        <td className="py-2 pr-3">{r.requested_at?.slice(0, 10)}</td>
                        <td className="py-2 pr-3">{r.scheduled_for?.slice(0, 10)}</td>
                        <td className="py-2">
                          <RowActions r={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
