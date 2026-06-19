'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Запросы на удаление аккаунта</h1>
        <p className="text-sm text-slate-500 mt-1">
          DSAR erasure queue — 30-дневный grace period, затем cron или ручная обработка.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Очередь</CardTitle>
          <CardDescription>pending_grace → cron `process-data-erasure` или «Выполнить сейчас» (ADMIN)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">Нет запросов.</p>
          ) : (
            <div className="overflow-x-auto">
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
                      <td className="py-2 flex gap-2">
                        {r.status === 'pending_grace' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={acting === r.id}
                              onClick={() => patchRow(r.id, 'cancel')}
                            >
                              Отменить
                            </Button>
                            <Button
                              size="sm"
                              variant="brand"
                              disabled={acting === r.id}
                              onClick={() => patchRow(r.id, 'process_now')}
                            >
                              Выполнить
                            </Button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
