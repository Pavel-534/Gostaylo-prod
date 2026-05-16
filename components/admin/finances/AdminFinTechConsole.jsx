'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calculator,
  Download,
  Gauge,
  Landmark,
  Lock,
  Play,
  Receipt,
  RefreshCw,
  Shield,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const MINT = '#0D9488'
const NAVY = '#0F172A'

const emptyProfile = {
  id: '',
  name: '',
  guest_fee_pct: 15,
  host_fee_pct: 0,
  fx_markup_pct: 3,
  ru_agent_share_pct: 7,
  kr_service_share_pct: 8,
  insurance_fund_pct: 0,
  tax_rate_pct: 0,
  is_active: true,
}

function fmtThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `฿${x.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function feeSplitValid(p) {
  const g = Number(p.guest_fee_pct)
  const ru = Number(p.ru_agent_share_pct)
  const kr = Number(p.kr_service_share_pct)
  return Number.isFinite(g) && Number.isFinite(ru) && Number.isFinite(kr) && Math.abs(ru + kr - g) < 0.01
}

function BreakdownGrid({ b }) {
  if (!b) return null
  const rows = [
    ['Subtotal (Netto base)', fmtThb(b.subtotal_thb)],
    ['Guest fee (Brutto add-on)', fmtThb(b.guest_service_fee_thb)],
    ['RU agent (7% leg)', fmtThb(b.ru_fee_thb)],
    ['KG service (8% leg)', fmtThb(b.kr_fee_thb)],
    ['FX markup (3% pot)', fmtThb(b.fx_markup_thb)],
    ['Partner Netto', fmtThb(b.total_partner_netto_thb)],
    ['Guest total (exact)', fmtThb(b.total_guest_payable_thb)],
    ['Guest total (rounded)', fmtThb(b.total_guest_payable_rounded_thb)],
    ['Rounding pot', fmtThb(b.rounding_pot_thb)],
  ]
  return (
    <div className="grid sm:grid-cols-2 gap-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between rounded-lg bg-white/80 border border-slate-100 px-3 py-2">
          <span className="text-slate-600">{k}</span>
          <span className="font-semibold text-slate-900 tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  )
}

export function AdminFinTechConsole() {
  const { toast } = useToast()
  const [dash, setDash] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [v2Pending, setV2Pending] = useState(null)
  const [v2DialogOpen, setV2DialogOpen] = useState(false)
  const [simSubtotal, setSimSubtotal] = useState('10000')
  const [simProfileId, setSimProfileId] = useState('')
  const [simResult, setSimResult] = useState(null)
  const [draft, setDraft] = useState(emptyProfile)
  const [editingId, setEditingId] = useState(null)
  const [complianceFrom, setComplianceFrom] = useState('')
  const [complianceTo, setComplianceTo] = useState('')
  const [complianceBooking, setComplianceBooking] = useState('')
  const [fiscalTestLoading, setFiscalTestLoading] = useState(false)
  const [reconLoading, setReconLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, pRes, bRes] = await Promise.all([
        fetch('/api/admin/finances/dashboard'),
        fetch('/api/admin/finances/pricing-profiles'),
        fetch('/api/admin/finances/payout-batches'),
      ])
      const dJson = await dRes.json()
      const pJson = await pRes.json()
      const bJson = await bRes.json()
      if (dJson.success) setDash(dJson.data)
      if (pJson.success) {
        setProfiles(pJson.data || [])
        setSimProfileId((prev) => prev || pJson.data?.[0]?.id || '')
      }
      if (bJson.success) setBatches(bJson.data || [])
    } catch (e) {
      toast({ title: 'Ошибка загрузки', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const simProfile = profiles.find((p) => p.id === simProfileId) || profiles[0]
  const draftValid = feeSplitValid(draft)
  const driftThb = Math.abs(Number(dash?.reconciliation?.deltaThb) || 0)
  const driftBad = driftThb > 0.01

  const v2Effective = dash?.pricingEngineV2?.effective
  const v2EnvLock = dash?.pricingEngineV2?.envOverride

  const applyV2Toggle = async () => {
    if (v2Pending == null) return
    const res = await fetch('/api/admin/finances/pricing-v2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: v2Pending }),
    })
    const json = await res.json()
    setV2DialogOpen(false)
    if (!json.success) {
      toast({
        title: 'Pricing Engine V2',
        description: json.message || json.error,
        variant: 'destructive',
      })
      return
    }
    toast({
      title: v2Pending ? 'V2 включён' : 'V2 выключен',
      description: 'Новые брони используют обновлённый движок и округление 1 THB',
    })
    load()
  }

  const runSimulate = async () => {
    if (!simProfile) return
    const res = await fetch('/api/admin/finances/pricing-profiles/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtotal_thb: Number(simSubtotal), profile: simProfile }),
    })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Симуляция', description: json.error, variant: 'destructive' })
      return
    }
    setSimResult(json.data?.breakdown || json.data)
  }

  const saveProfile = async () => {
    if (!draftValid) {
      toast({
        title: 'Невалидный профиль',
        description: 'RU% + KG% должны равняться guest_fee%',
        variant: 'destructive',
      })
      return
    }
    const url = editingId
      ? `/api/admin/finances/pricing-profiles/${editingId}`
      : '/api/admin/finances/pricing-profiles'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...draft,
        guest_fee_pct: Number(draft.guest_fee_pct),
        ru_agent_share_pct: Number(draft.ru_agent_share_pct),
        kr_service_share_pct: Number(draft.kr_service_share_pct),
        host_fee_pct: Number(draft.host_fee_pct || 0),
        fx_markup_pct: Number(draft.fx_markup_pct || 0),
      }),
    })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Профиль', description: json.message || json.error, variant: 'destructive' })
      return
    }
    toast({ title: editingId ? 'Профиль обновлён' : 'Профиль создан' })
    setDraft(emptyProfile)
    setEditingId(null)
    load()
  }

  const createPool = async (force = false) => {
    const res = await fetch('/api/admin/finances/payout-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail: 'TBANK_RU', force }),
    })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Пул', description: json.message || json.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Пул создан', description: `${json.batchId || 'ok'} · ${json.itemCount ?? 0} поз.` })
    load()
  }

  const lockBatch = async (id) => {
    await fetch(`/api/admin/finances/payout-batches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock' }),
    })
    load()
  }

  const exportBatch = (id, format) => {
    window.open(`/api/admin/finances/payout-batches/${id}/export?format=${format}`, '_blank')
  }

  const retryFiscal = async (bookingId) => {
    const res = await fetch(`/api/admin/finances/fiscal-retry/${bookingId}`, { method: 'POST' })
    const json = await res.json()
    toast({
      title: json.success ? 'Fiscal retry' : 'Ошибка',
      description: json.receiptId || json.error || json.status,
      variant: json.success ? 'default' : 'destructive',
    })
    load()
  }

  const runFiscalTest = async () => {
    setFiscalTestLoading(true)
    try {
      const res = await fetch('/api/admin/finances/fiscal-test', { method: 'POST' })
      const json = await res.json()
      toast({
        title: json.success ? 'Тестовый чек' : 'Ошибка кассы',
        description: json.receiptId || json.message || json.error,
        variant: json.success ? 'default' : 'destructive',
      })
    } finally {
      setFiscalTestLoading(false)
    }
  }

  const runReconcile = async () => {
    setReconLoading(true)
    try {
      const res = await fetch('/api/v2/admin/ledger-reconciliation', { credentials: 'include' })
      const json = await res.json()
      if (!json.success) {
        toast({ title: 'Reconcile', description: json.error, variant: 'destructive' })
        return
      }
      setDash((prev) => ({ ...prev, reconciliation: json.data }))
      toast({ title: 'Сверка выполнена', description: `Δ ${fmtThb(json.data?.deltaThb)}` })
    } finally {
      setReconLoading(false)
    }
  }

  const downloadCompliance = () => {
    if (complianceBooking.trim()) {
      window.open(
        `/api/admin/finances/compliance-export?bookingId=${encodeURIComponent(complianceBooking.trim())}`,
        '_blank',
      )
      return
    }
    if (!complianceFrom || !complianceTo) {
      toast({ title: 'Укажите период', description: 'from / to или booking UUID', variant: 'destructive' })
      return
    }
    window.open(
      `/api/admin/finances/compliance-export?from=${complianceFrom}&to=${complianceTo}`,
      '_blank',
    )
  }

  const statCards = useMemo(
    () => [
      {
        label: 'READY_FOR_PAYOUT',
        value: dash?.payout?.readyForPayoutCount ?? '—',
        sub: fmtThb(dash?.payout?.readyForPayoutThb),
        icon: Banknote,
      },
      {
        label: 'PENDING_FISCAL',
        value: dash?.pendingFiscal?.length ?? 0,
        sub: 'чеков в очереди',
        icon: Receipt,
      },
      {
        label: 'Ledger drift',
        value: driftBad ? fmtThb(driftThb) : 'OK',
        sub: driftBad ? 'требует внимания' : '< 0.01 THB',
        icon: Gauge,
        danger: driftBad,
      },
      {
        label: 'Pricing V2',
        value: v2Effective ? 'ON' : 'OFF',
        sub: v2EnvLock ? 'env lock' : 'settings',
        icon: Zap,
      },
    ],
    [dash, driftBad, driftThb, v2Effective, v2EnvLock],
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div
        className="border-b border-slate-200/80"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #134e4a 100%)` }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                href="/admin/settings"
                className="inline-flex items-center text-sm text-teal-200/90 hover:text-white mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Настройки
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Landmark className="h-8 w-8 text-teal-300" />
                FinTech-пульт
              </h1>
              <p className="text-teal-100/80 text-sm mt-1 max-w-xl">
                Pricing V2, касса 54-ФЗ, пулы выплат, ledger — только для администратора. Внутренние % не
                показываются гостям и партнёрам.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={load}
              disabled={loading}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
              Обновить
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {statCards.map(({ label, value, sub, icon: Icon, danger }) => (
              <div
                key={label}
                className="rounded-xl bg-white/10 backdrop-blur border border-white/10 px-4 py-3"
              >
                <div className="flex items-center gap-2 text-teal-200/90 text-xs font-medium">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <div className={cn('text-xl font-bold mt-1', danger && 'text-red-300')}>{value}</div>
                <div className="text-xs text-teal-100/70">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* 1. Pricing V2 */}
        <Card className="border-teal-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${MINT}` }}>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Zap className="h-5 w-5" style={{ color: MINT }} />
              Главный рубильник — Pricing Engine V2
            </CardTitle>
            <CardDescription>
              Округление гостя до 1 THB, snapshot v2, fiscal legs. Env{' '}
              <code className="text-xs">PRICING_ENGINE_V2</code> имеет приоритет.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={Boolean(v2Effective)}
                disabled={v2EnvLock || loading}
                onCheckedChange={(checked) => {
                  setV2Pending(checked)
                  setV2DialogOpen(true)
                }}
              />
              <div>
                <p className="font-medium" style={{ color: NAVY }}>
                  {v2Effective ? 'Включён' : 'Выключен'}
                </p>
                {v2EnvLock && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="h-3 w-3" />
                    Заблокировано env PRICING_ENGINE_V2
                  </p>
                )}
              </div>
            </div>
            <Badge variant={v2Effective ? 'default' : 'secondary'} className="bg-teal-600">
              effective: {v2Effective ? 'true' : 'false'}
            </Badge>
          </CardContent>
        </Card>

        {/* 2. Fiscal */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Receipt className="h-5 w-5 text-teal-600" />
              Кассовый аппарат (54-ФЗ)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                className={
                  dash?.fiscal?.sandbox
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-100'
                    : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100'
                }
              >
                {dash?.fiscal?.mode || '—'}
              </Badge>
              {!dash?.fiscal?.providerConfigured && !dash?.fiscal?.sandbox && (
                <Badge variant="destructive">FISCAL_PROVIDER_URL не задан</Badge>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-slate-50 p-3">
                <span className="text-slate-500 block text-xs">FISCAL_RU_AGENT_INN</span>
                <span className="font-mono font-medium">{dash?.fiscal?.ruAgentInn}</span>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <span className="text-slate-500 block text-xs">FISCAL_KG_SUPPLIER_NAME</span>
                <span className="font-medium">{dash?.fiscal?.kgSupplierName}</span>
              </div>
            </div>
            <Button onClick={runFiscalTest} disabled={fiscalTestLoading} style={{ backgroundColor: MINT }}>
              {fiscalTestLoading ? 'Отправка…' : 'Отправить тестовый чек'}
            </Button>
            {dash?.pendingFiscal?.length > 0 ? (
              <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                {dash.pendingFiscal.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
                    <div>
                      <span className="font-mono text-xs">{b.id.slice(0, 8)}…</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {b.status}
                      </Badge>
                      {b.last_error && (
                        <p className="text-xs text-red-600 mt-0.5 truncate max-w-md">{b.last_error}</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => retryFiscal(b.id)}>
                      Перепробить
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Нет PENDING_FISCAL в очереди</p>
            )}
          </CardContent>
        </Card>

        {/* 3. Pricing profiles */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Calculator className="h-5 w-5 text-teal-600" />
              Управление комиссиями (pricing_profiles)
            </CardTitle>
            <CardDescription>SSOT процентов. RU + KG = guest_fee — обязательно.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label>Субтотал THB</Label>
                <Input value={simSubtotal} onChange={(e) => setSimSubtotal(e.target.value)} className="w-32" />
              </div>
              <div>
                <Label>Профиль</Label>
                <select
                  className="border rounded-md h-10 px-2 min-w-[180px]"
                  value={simProfileId}
                  onChange={(e) => setSimProfileId(e.target.value)}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={runSimulate} style={{ backgroundColor: MINT }}>
                <Play className="h-4 w-4 mr-1" />
                Симулятор
              </Button>
            </div>
            <BreakdownGrid b={simResult} />

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2" style={{ color: NAVY }}>
                {editingId ? 'Редактировать' : 'Новый'} профиль
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  'id',
                  'name',
                  'guest_fee_pct',
                  'ru_agent_share_pct',
                  'kr_service_share_pct',
                  'fx_markup_pct',
                  'host_fee_pct',
                ].map((key) => (
                  <div key={key}>
                    <Label className="text-xs">{key}</Label>
                    <Input
                      value={draft[key] ?? ''}
                      disabled={editingId && key === 'id'}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              {!draftValid && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  RU% + KG% ≠ guest_fee% — сохранение заблокировано
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Button onClick={saveProfile} disabled={!draftValid} style={{ backgroundColor: MINT }}>
                  {editingId ? 'Сохранить' : 'Создать'}
                </Button>
                {editingId && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null)
                      setDraft(emptyProfile)
                    }}
                  >
                    Отмена
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:border-teal-200"
                >
                  <div>
                    <strong>{p.name}</strong>{' '}
                    <span className="text-slate-500 font-mono text-xs">({p.id})</span>
                    <p className="text-slate-600 mt-0.5">
                      guest {p.guest_fee_pct}% = RU {p.ru_agent_share_pct}% + KG {p.kr_service_share_pct}%
                      {p.fx_markup_pct ? ` · FX ${p.fx_markup_pct}%` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!p.is_active && <Badge variant="secondary">off</Badge>}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(p.id)
                        setDraft({ ...p })
                      }}
                    >
                      Изменить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Batches */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: NAVY }}>
              Батчинг выплат
            </CardTitle>
            <CardDescription>ПН/ЧТ 07:00 UTC · DRAFT → LOCKED → EXPORTED</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              size="lg"
              className="w-full sm:w-auto text-base h-12 px-8"
              style={{ backgroundColor: MINT }}
              onClick={() => createPool(false)}
            >
              Сформировать пул на сегодня
            </Button>
            <Button variant="outline" size="sm" onClick={() => createPool(true)}>
              Force (вне ПН/ЧТ)
            </Button>
            <div className="space-y-2">
              {batches.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center gap-2 border rounded-lg p-3 text-sm">
                  <span className="font-mono text-xs">{b.id}</span>
                  <Badge>{b.status}</Badge>
                  <span>
                    {b.item_count} шт. · {fmtThb(b.totals_thb)}
                  </span>
                  {b.status === 'DRAFT' && (
                    <Button size="sm" variant="secondary" onClick={() => lockBatch(b.id)}>
                      <Lock className="h-3 w-3 mr-1" />
                      Lock
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => exportBatch(b.id, 'csv')}>
                    <Download className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                </div>
              ))}
              {!batches.length && <p className="text-slate-500 text-sm">Пулов пока нет</p>}
            </div>
          </CardContent>
        </Card>

        {/* 5. Ledger */}
        <Card className={cn('border-slate-200 shadow-sm', driftBad && 'border-red-300 bg-red-50/30')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Gauge className="h-5 w-5" />
              Здоровье леджера
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dash?.reconciliation?.error ? (
              <p className="text-red-600 text-sm">{dash.reconciliation.error}</p>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border p-3 bg-white">
                  <span className="text-slate-500 text-xs">Clearing DEBIT</span>
                  <p className="font-semibold tabular-nums">
                    {fmtThb(dash?.reconciliation?.guestClearingDebitsThb)}
                  </p>
                </div>
                <div className="rounded-lg border p-3 bg-white">
                  <span className="text-slate-500 text-xs">Distribution CREDIT</span>
                  <p className="font-semibold tabular-nums">
                    {fmtThb(dash?.reconciliation?.distributionCreditsThb)}
                  </p>
                </div>
                <div
                  className={cn('rounded-lg border p-3', driftBad ? 'bg-red-100 border-red-200' : 'bg-white')}
                >
                  <span className="text-slate-500 text-xs">Drift Δ</span>
                  <p className={cn('font-semibold tabular-nums', driftBad && 'text-red-700')}>
                    {fmtThb(dash?.reconciliation?.deltaThb)}
                  </p>
                </div>
              </div>
            )}
            <Button variant="outline" onClick={runReconcile} disabled={reconLoading}>
              {reconLoading ? 'Сверка…' : 'Запустить reconcile сейчас'}
            </Button>
          </CardContent>
        </Card>

        {/* 6. Compliance */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Download className="h-5 w-5 text-teal-600" />
              Compliance Export
            </CardTitle>
            <CardDescription>CSV-реестр для банка / бухгалтерии</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs">Booking UUID</Label>
                <Input
                  placeholder="uuid…"
                  value={complianceBooking}
                  onChange={(e) => setComplianceBooking(e.target.value)}
                  className="w-64"
                />
              </div>
              <div>
                <Label className="text-xs">С</Label>
                <Input type="date" value={complianceFrom} onChange={(e) => setComplianceFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">По</Label>
                <Input type="date" value={complianceTo} onChange={(e) => setComplianceTo(e.target.value)} />
              </div>
              <Button onClick={downloadCompliance} style={{ backgroundColor: NAVY }}>
                <Download className="h-4 w-4 mr-1" />
                Скачать CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={v2DialogOpen} onOpenChange={setV2DialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {v2Pending ? 'Включить Pricing Engine V2?' : 'Выключить Pricing Engine V2?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {v2Pending
                ? 'Новые брони получат snapshot v2, округление 1 THB и fiscal legs. Проверьте FISCAL_SANDBOX и профили.'
                : 'Новые брони вернутся к legacy-округлению. Активные v2-брони не меняются.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setV2Pending(null)}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={applyV2Toggle} style={{ backgroundColor: MINT }}>
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
