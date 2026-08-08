'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

export default function AdminAuditExplorerPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [action, setAction] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (entityType.trim()) params.set('entity_type', entityType.trim())
      if (entityId.trim()) params.set('entity_id', entityId.trim())
      if (action.trim()) params.set('action', action.trim())
      const res = await fetch(`/api/v2/admin/audit/logs?${params}`, { credentials: 'include' })
      const data = await res.json()
      setRows(data.success ? data.data || [] : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, action])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4 sm:space-y-6 max-sm:px-0 sm:p-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Admin Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">
          Append-only журнал действий администраторов (`admin_audit_logs`).
        </p>
      </div>

      <Card className={MOBILE_FLAT_CARD_CLASS}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>entity_type, entity_id, action (substring)</CardDescription>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'flex flex-col sm:flex-row gap-3')}>
          <Input
            className="min-h-[44px]"
            placeholder="entity_type (booking, user…)"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
          <Input
            className="min-h-[44px]"
            placeholder="entity_id"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          />
          <Input
            className="min-h-[44px]"
            placeholder="action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <Button variant="brand" className="min-h-[44px] max-sm:w-full" onClick={() => void load()}>
            Применить
          </Button>
        </CardContent>
      </Card>

      <Card className={MOBILE_FLAT_CARD_CLASS}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>Записи</CardTitle>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'max-sm:p-0 sm:pt-0')}>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 max-sm:px-0">Нет записей.</p>
          ) : (
            <>
              <div className="sm:hidden space-y-0">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="border-b border-slate-100 px-0 py-3 last:border-b-0 space-y-1"
                  >
                    <p className="text-xs text-slate-500 tabular-nums">
                      {r.created_at?.replace('T', ' ').slice(0, 19) || '—'}
                    </p>
                    <p className="font-medium text-sm text-slate-900">{r.action}</p>
                    <p className="font-mono text-xs text-slate-600">
                      {r.entity_type} · {r.entity_id}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      {r.actor_role} · {r.actor_id?.slice(0, 8)}…
                    </p>
                    {r.reason ? (
                      <p className="text-xs text-slate-600 line-clamp-2">{r.reason}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Actor</th>
                      <th className="py-2 pr-3">Action</th>
                      <th className="py-2 pr-3">Entity</th>
                      <th className="py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-3 text-xs whitespace-nowrap">
                          {r.created_at?.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {r.actor_role}
                          <br />
                          <span className="text-slate-400">{r.actor_id?.slice(0, 8)}…</span>
                        </td>
                        <td className="py-2 pr-3">{r.action}</td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {r.entity_type}
                          <br />
                          {r.entity_id}
                        </td>
                        <td className="py-2 text-xs text-slate-600 max-w-xs truncate">
                          {r.reason || '—'}
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
