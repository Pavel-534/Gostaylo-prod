'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Filter, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { movementKindLabel } from '@/lib/admin/fintech-movement-labels'
import { fmtThb } from '@/lib/admin/fintech-console-shared'
import { fetchFintechMovements } from '@/lib/admin/admin-fintech-api-client'

const NAVY = '#0F172A'
const MINT = '#0D9488'

const KIND_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'CONVERSION', label: 'Конвертация валют' },
  { value: 'PAYOUT_BATCH', label: 'Пул выплат' },
  { value: 'LEDGER', label: 'Оплата гостя' },
  { value: 'FISCAL', label: 'Чек для гостя' },
]

const KIND_BADGE = {
  CONVERSION: 'bg-teal-100 text-teal-900',
  PAYOUT_BATCH: 'bg-slate-200 text-slate-800',
  LEDGER: 'bg-indigo-100 text-indigo-900',
  FISCAL: 'bg-amber-100 text-amber-900',
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

/**
 * @param {{ excludeTest?: boolean, ownerSimple?: boolean, refreshKey?: number }} props
 */
export function FinTechMovementJournal({ excludeTest = true, ownerSimple = false, refreshKey = 0 }) {
  const initial = monthRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [kind, setKind] = useState('')
  const [currency, setCurrency] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [onlyReal, setOnlyReal] = useState(excludeTest)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  useEffect(() => {
    setOnlyReal(excludeTest)
  }, [excludeTest])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ from, to, limit: '400' })
      if (kind) qs.set('kind', kind)
      if (currency) qs.set('currency', currency)
      if (partnerId.trim()) qs.set('partnerId', partnerId.trim())
      if (onlyReal || excludeTest) qs.set('excludeTest', '1')
      const { ok, movements } = await fetchFintechMovements(qs)
      if (!ok) throw new Error('movements load failed')
      setRows(movements)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [from, to, kind, currency, partnerId, onlyReal, excludeTest])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${MINT}` }}>
        <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
          <BookOpen className="h-5 w-5 text-teal-600" />
          {ownerSimple ? 'История движений денег' : 'Журнал всех движений'}
        </CardTitle>
        <CardDescription>
          {ownerSimple
            ? 'Понятный список операций: оплаты, конвертации и выплаты партнёрам.'
            : 'Конвертации, пулы, проводки и фискальные чеки — единая лента по датам.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-teal-300 bg-teal-50 px-3 py-2.5 shadow-sm">
          <Switch id="journal-real-only" checked={onlyReal} onCheckedChange={setOnlyReal} />
          <Label htmlFor="journal-real-only" className="text-sm font-semibold cursor-pointer text-teal-900">
            {ownerSimple ? 'Только реальные операции' : 'Только реальные данные (без smoke/E2E)'}
          </Label>
        </div>

        {!ownerSimple && (
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
                placeholder="необязательно"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {ownerSimple && (
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">С</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">По</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              Обновить
            </Button>
          </div>
        )}

        <div className="rounded-lg border bg-white max-h-[420px] overflow-auto divide-y">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Загрузка движений…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              {onlyReal
                ? 'Нет реальных движений за выбранный период — пульт чист.'
                : 'За период движений не найдено.'}
            </div>
          ) : (
            rows.map((row) => (
              <div key={`${row.kind}-${row.id}`} className="px-3 py-2.5 text-sm hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={KIND_BADGE[row.kind] || 'bg-slate-100'}>
                      {movementKindLabel(row.kind, true)}
                    </Badge>
                    <span className="font-medium text-slate-900">{row.title}</span>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                {!ownerSimple && <p className="text-xs text-slate-600 mt-0.5">{row.subtitle}</p>}
                <div className="flex flex-wrap gap-3 text-xs mt-1 text-slate-500">
                  {row.amountThb != null ? (
                    <span className="font-semibold text-slate-800">{fmtThb(row.amountThb)}</span>
                  ) : null}
                  {row.currency && !ownerSimple ? <span>{row.currency}</span> : null}
                  {row.reference && !ownerSimple ? (
                    <span className="font-mono truncate max-w-[200px]">{row.reference}</span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
