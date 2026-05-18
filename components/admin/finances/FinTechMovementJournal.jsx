'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Filter, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const NAVY = '#0F172A'
const MINT = '#0D9488'

const KIND_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'CONVERSION', label: 'Конвертации' },
  { value: 'PAYOUT_BATCH', label: 'Пулы выплат' },
  { value: 'LEDGER', label: 'Проводки (ledger)' },
  { value: 'FISCAL', label: 'Очередь 54-ФЗ' },
]

const KIND_BADGE = {
  CONVERSION: 'bg-teal-100 text-teal-900',
  PAYOUT_BATCH: 'bg-slate-200 text-slate-800',
  LEDGER: 'bg-indigo-100 text-indigo-900',
  FISCAL: 'bg-amber-100 text-amber-900',
}

function fmtThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `฿${x.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function monthRange() {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

export function FinTechMovementJournal() {
  const initial = monthRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [kind, setKind] = useState('')
  const [currency, setCurrency] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ from, to, limit: '400' })
      if (kind) qs.set('kind', kind)
      if (currency) qs.set('currency', currency)
      if (partnerId.trim()) qs.set('partnerId', partnerId.trim())
      const res = await fetch(`/api/admin/finances/movements?${qs.toString()}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      setRows(json.data?.movements || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to, kind, currency, partnerId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${MINT}` }}>
        <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
          <BookOpen className="h-5 w-5 text-teal-600" />
          Журнал всех движений
        </CardTitle>
        <CardDescription>
          Конвертации, пулы, проводки и очередь чеков — единая лента за период, новые сверху.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">С</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">По</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Тип</Label>
            <select
              className="border rounded-md h-10 px-2 bg-white min-w-[140px]"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Валюта</Label>
            <select
              className="border rounded-md h-10 px-2 bg-white min-w-[90px]"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {['', 'THB', 'RUB', 'KGS', 'USDT'].map((c) => (
                <option key={c || 'all'} value={c}>
                  {c || 'Все'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Партнёр (UUID)</Label>
            <Input
              className="w-48"
              placeholder="опционально"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          </Button>
        </div>

        <div className="rounded-lg border bg-white max-h-[420px] overflow-auto divide-y">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Загрузка журнала…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">За период движений не найдено.</div>
          ) : (
            rows.map((row) => (
              <div key={`${row.kind}-${row.id}`} className="px-3 py-2.5 text-sm hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={KIND_BADGE[row.kind] || 'bg-slate-100'}>{row.kind}</Badge>
                    <span className="font-medium text-slate-900">{row.title}</span>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{row.subtitle}</p>
                <div className="flex flex-wrap gap-3 text-xs mt-1 text-slate-500">
                  {row.amountThb != null ? <span>{fmtThb(row.amountThb)}</span> : null}
                  {row.currency ? <span>{row.currency}</span> : null}
                  {row.reference ? <span className="font-mono truncate max-w-[200px]">{row.reference}</span> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
