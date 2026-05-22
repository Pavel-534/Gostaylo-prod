'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownAZ, Check, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { postReferralPayoutBulk } from '@/lib/admin/admin-fintech-api-client'
import { fmtThb } from '@/lib/admin/fintech-console-shared'

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Дата ↓' },
  { value: 'date_asc', label: 'Дата ↑' },
  { value: 'amount_desc', label: 'Сумма ↓' },
  { value: 'amount_asc', label: 'Сумма ↑' },
  { value: 'email_asc', label: 'Email A→Z' },
]

function sortRows(rows, sortKey) {
  const list = [...rows]
  list.sort((a, b) => {
    if (sortKey === 'amount_desc') return Number(b.amountThb || 0) - Number(a.amountThb || 0)
    if (sortKey === 'amount_asc') return Number(a.amountThb || 0) - Number(b.amountThb || 0)
    if (sortKey === 'email_asc') {
      return String(a.email || a.userId || '').localeCompare(String(b.email || b.userId || ''), 'ru')
    }
    const ta = a.requestedAt ? new Date(a.requestedAt).getTime() : 0
    const tb = b.requestedAt ? new Date(b.requestedAt).getTime() : 0
    if (sortKey === 'date_asc') return ta - tb
    return tb - ta
  })
  return list
}

function sumThbForIds(rows, idSet) {
  return rows.filter((r) => idSet.has(String(r.userId))).reduce((acc, r) => acc + Number(r.amountThb || 0), 0)
}

/**
 * Stage 114.6 / 114.7 — очередь withdrawable_referral: поиск, сортировка, bulk actions.
 */
export function ReferralPayoutWorkflowPanel({ payoutQueue = [], toast, onRefresh }) {
  const rows = Array.isArray(payoutQueue) ? payoutQueue : []
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('date_desc')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? rows.filter((r) => {
          const email = String(r.email || '').toLowerCase()
          const uid = String(r.userId || '').toLowerCase()
          return email.includes(q) || uid.includes(q)
        })
      : rows
    return sortRows(base, sortKey)
  }, [rows, search, sortKey])

  const filteredIds = useMemo(() => filtered.map((r) => String(r.userId)).filter(Boolean), [filtered])
  const selectedCount = selected.size
  const selectedTotalThb = useMemo(() => sumThbForIds(filtered, selected), [filtered, selected])
  const filteredTotalThb = useMemo(
    () => filtered.reduce((acc, r) => acc + Number(r.amountThb || 0), 0),
    [filtered],
  )

  useEffect(() => {
    setSelected((prev) => {
      const allowed = new Set(filteredIds)
      const next = new Set([...prev].filter((id) => allowed.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [filteredIds.join('|')])

  function toggleOne(userId) {
    const uid = String(userId || '')
    if (!uid) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const allSelected = filteredIds.length > 0 && filteredIds.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(filteredIds)
    })
  }

  async function runBulk(action, userIds) {
    const ids = userIds?.length ? userIds : [...selected]
    if (!ids.length) {
      toast?.({ variant: 'destructive', title: 'Referral payouts', description: 'Выберите заявки' })
      return
    }
    const sum = sumThbForIds(rows, new Set(ids.map(String)))
    setBusy(true)
    try {
      const { ok, data, error } = await postReferralPayoutBulk({ action, userIds: ids })
      if (!ok) throw new Error(error || 'BULK_FAILED')
      toast?.({
        title: 'Referral payouts',
        description: `${action}: ${data?.processed ?? 0} · ${fmtThb(sum)} THB`,
      })
      setSelected(new Set())
      await onRefresh?.()
    } catch (e) {
      toast?.({ variant: 'destructive', title: 'Referral payouts', description: e?.message || 'Ошибка' })
    } finally {
      setBusy(false)
    }
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
        Нет заявок <code className="text-xs">withdrawable_referral</code>.{' '}
        <Link href="/admin/marketing/payouts?referralOnly=1" className="text-[#006666] underline">
          Полный список кошельков
        </Link>
      </p>
    )
  }

  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="referral-payout-search" className="text-xs text-slate-600">
            Поиск (email / user id)
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="referral-payout-search"
              className="pl-9"
              placeholder="filter@example.com"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        <div className="space-y-1 w-full sm:w-44">
          <Label className="text-xs text-slate-600">Сортировка</Label>
          <Select value={sortKey} onValueChange={setSortKey} disabled={busy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={toggleAllFiltered} disabled={busy || !filtered.length}>
          {allFilteredSelected ? 'Снять выделение' : `Выбрать видимые (${filtered.length})`}
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-teal-700 hover:bg-teal-800"
          disabled={busy || !selectedCount}
          onClick={() => void runBulk('approve')}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
          Approve ({selectedCount})
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={busy || !selectedCount}
          onClick={() => void runBulk('reject')}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
          Reject ({selectedCount})
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || !filtered.length}
          onClick={() => void runBulk('approve', filteredIds)}
        >
          Approve filtered ({filtered.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-rose-300 text-rose-800 hover:bg-rose-50"
          disabled={busy || !filtered.length}
          onClick={() => void runBulk('reject', filteredIds)}
        >
          Reject filtered ({filtered.length})
        </Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/admin/marketing/payouts?referralOnly=1">Открыть payouts →</Link>
        </Button>
      </div>

      <p className="text-xs text-slate-600 tabular-nums">
        В очереди: {rows.length}
        {search.trim() ? ` · по фильтру: ${filtered.length} · ฿${fmtThb(filteredTotalThb)}` : null}
      </p>

      {!filtered.length ? (
        <p className="text-sm text-slate-500 py-4 text-center border border-dashed rounded-lg">Нет совпадений по поиску</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white max-h-72 overflow-y-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="sticky top-0 bg-slate-50 z-[1]">
              <tr className="border-b text-left text-slate-600">
                <th className="p-2 w-10" />
                <th className="p-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Email
                    {sortKey === 'email_asc' ? <ArrowDownAZ className="h-3 w-3" /> : null}
                  </span>
                </th>
                <th className="p-2 font-medium">THB</th>
                <th className="p-2 font-medium">Запрошено</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const uid = String(row.userId || '')
                return (
                  <tr key={uid} className="border-b last:border-0 hover:bg-slate-50/80">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(uid)}
                        onCheckedChange={() => toggleOne(uid)}
                        aria-label={`Select ${row.email || uid}`}
                      />
                    </td>
                    <td className="p-2 max-w-[200px] truncate" title={row.email || uid}>
                      {row.email || uid}
                    </td>
                    <td className="p-2 tabular-nums font-medium whitespace-nowrap">{fmtThb(row.amountThb)}</td>
                    <td className="p-2 text-slate-500 whitespace-nowrap text-xs">
                      {row.requestedAt ? new Date(row.requestedAt).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedCount > 0 ? (
        <p className="text-xs text-slate-600 tabular-nums">
          Выбрано: {selectedCount} · сумма: <strong>{fmtThb(selectedTotalThb)} THB</strong> (полуавтомат, без автобанка)
        </p>
      ) : null}
    </div>
  )
}
