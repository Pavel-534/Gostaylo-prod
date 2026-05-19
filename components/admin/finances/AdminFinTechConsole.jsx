'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calculator,
  CheckCircle2,
  Download,
  FileStack,
  Gauge,
  Inbox,
  Landmark,
  Lock,
  Play,
  Receipt,
  RefreshCw,
  Shield,
  Trash2,
  XCircle,
  Zap,
  BookOpen,
  LayoutDashboard,
  Scale,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  BREAKDOWN_ROWS,
  PROFILE_FIELD_LABELS,
  PROFILE_FORM_KEYS,
  BATCH_STATUS_RU,
  POOL_MESSAGES_RU,
  FISCAL_QUEUE_STATUS_RU,
  TREASURY_DAILY_STEPS,
  PAYOUT_RAIL_LABELS,
} from '@/lib/admin/fintech-ui-labels'
import { FinTechEmptyState } from '@/components/admin/finances/FinTechEmptyState'
import { FiscalSandboxReceiptDialog } from '@/components/admin/finances/FiscalSandboxReceiptDialog'
import { FinTechTreasuryConversionsPanel } from '@/components/admin/finances/FinTechTreasuryConversionsPanel'
import { PayoutBatchRow } from '@/components/admin/finances/PayoutBatchRow'
import { FinTechMovementJournal } from '@/components/admin/finances/FinTechMovementJournal'
import { FinTechMarginBar } from '@/components/admin/finances/FinTechMarginBar'
import { FinTechConsoleHeaderAlerts } from '@/components/admin/finances/FinTechConsoleHeaderAlerts'
import { FinTechTreasuryHeroDashboard } from '@/components/admin/finances/FinTechTreasuryHeroDashboard'

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

function currentMonthRange() {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

function feeSplitValid(p) {
  const g = Number(p.guest_fee_pct)
  const ru = Number(p.ru_agent_share_pct)
  const kr = Number(p.kr_service_share_pct)
  return Number.isFinite(g) && Number.isFinite(ru) && Number.isFinite(kr) && Math.abs(ru + kr - g) < 0.01
}

function BreakdownGrid({ b }) {
  if (!b) {
    return (
      <FinTechEmptyState
        icon={Calculator}
        title="Запустите симулятор"
        description="Укажите сумму брони в батах и нажмите «Рассчитать» — увидите разбивку для владельца бизнеса."
        className="mt-2"
      />
    )
  }
  return (
    <div className="grid sm:grid-cols-2 gap-2 text-sm">
      {BREAKDOWN_ROWS.map(({ key, label }) => (
        <div key={key} className="flex justify-between rounded-lg bg-white/80 border border-slate-100 px-3 py-2">
          <span className="text-slate-600">{label}</span>
          <span className="font-semibold text-slate-900 tabular-nums">{fmtThb(b[key])}</span>
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
  const [complianceDownloading, setComplianceDownloading] = useState(false)
  const [fiscalTestLoading, setFiscalTestLoading] = useState(false)
  const [fiscalTestOpen, setFiscalTestOpen] = useState(false)
  const [fiscalTestDisplay, setFiscalTestDisplay] = useState(null)
  const [reconLoading, setReconLoading] = useState(false)
  const [lastRecon, setLastRecon] = useState(null)
  const [settlingBatchId, setSettlingBatchId] = useState(null)
  const [poolRail, setPoolRail] = useState('TBANK_RU')
  const [batchRailFilter, setBatchRailFilter] = useState('ALL')
  const [monthMargin, setMonthMargin] = useState(null)
  const [monthlyExporting, setMonthlyExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = currentMonthRange()
      const [dRes, pRes, bRes, mRes] = await Promise.all([
        fetch('/api/admin/finances/dashboard'),
        fetch('/api/admin/finances/pricing-profiles'),
        fetch('/api/admin/finances/payout-batches'),
        fetch(`/api/admin/finances/conversions?from=${from}&to=${to}`, { credentials: 'include' }),
      ])
      const dJson = await dRes.json()
      const pJson = await pRes.json()
      const bJson = await bRes.json()
      const mJson = await mRes.json()
      if (dJson.success) setDash(dJson.data)
      if (mJson.success) setMonthMargin(mJson.data?.margin || null)
      if (pJson.success) {
        setProfiles(pJson.data || [])
        setSimProfileId((prev) => prev || pJson.data?.[0]?.id || '')
      }
      if (bJson.success) setBatches(bJson.data || [])
    } catch (e) {
      toast({ title: 'Не удалось загрузить данные', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const simProfile = profiles.find((p) => p.id === simProfileId) || profiles[0]
  const activeProfiles = profiles.filter((p) => p.is_active !== false)
  const archivedProfiles = profiles.filter((p) => p.is_active === false)
  const draftValid = feeSplitValid(draft) && String(draft.name || '').trim().length > 0
  const driftThb = Math.abs(Number(dash?.reconciliation?.deltaThb) || 0)
  const driftBad = driftThb > 0.01

  const v2Effective = dash?.pricingEngineV2?.effective
  const v2EnvLock = dash?.pricingEngineV2?.envOverride
  const fiscalSandbox = dash?.fiscal?.sandbox

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
        title: 'Новый движок цен',
        description: json.message || json.error,
        variant: 'destructive',
      })
      return
    }
    toast({
      title: v2Pending ? 'Новый движок включён' : 'Новый движок выключен',
      description: v2Pending
        ? 'Новые брони: округление до 1 ฿ и полная финансовая схема v2'
        : 'Новые брони снова по старой схеме округления',
    })
    load()
  }

  const runSimulate = async () => {
    if (!simProfile) {
      toast({ title: 'Нет тарифного профиля', variant: 'destructive' })
      return
    }
    const res = await fetch('/api/admin/finances/pricing-profiles/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtotal_thb: Number(simSubtotal), profile: simProfile }),
    })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Ошибка расчёта', description: json.error, variant: 'destructive' })
      return
    }
    setSimResult(json.data?.breakdown || json.data)
  }

  const saveProfile = async () => {
    if (!draftValid) {
      toast({
        title: 'Проверьте доли',
        description: 'Доля РФ + доля КР должны равняться комиссии с гостя',
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
    toast({ title: editingId ? 'Тариф обновлён' : 'Тариф создан' })
    setDraft(emptyProfile)
    setEditingId(null)
    load()
  }

  const archiveProfile = async (id, name) => {
    if (!confirm(`Архивировать тариф «${name}»? Он не будет использоваться для новых броней.`)) return
    const res = await fetch(`/api/admin/finances/pricing-profiles/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) {
      toast({ title: 'Не удалось архивировать', description: json.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Тариф архивирован' })
    if (editingId === id) {
      setEditingId(null)
      setDraft(emptyProfile)
    }
    load()
  }

  const simulateFinancialRail = async (rail) => {
    const res = await fetch('/api/admin/smoke/financial-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail, priceThb: 5000, guestPayCurrency: rail === 'TBANK_RU' ? 'RUB' : 'USDT' }),
    })
    const json = await res.json().catch(() => ({}))
    const data = json.data || json
    if (!res.ok || !data?.ok) {
      const failed = (data?.steps || []).find((s) => !s.ok)
      toast({
        title: `Симуляция ${PAYOUT_RAIL_LABELS[rail] || rail} не пройдена`,
        description: failed?.detail || json.error || 'См. шаги в Legal',
        variant: 'destructive',
      })
      return
    }
    toast({
      title: `Симуляция ${PAYOUT_RAIL_LABELS[rail] || rail} пройдена`,
      description: `Пул ${data.context?.batchId || '—'} · ${data.context?.payoutRailLabel || ''}`,
    })
    load()
  }

  const createPool = async (force = false) => {
    const railReady =
      poolRail === 'TBANK_RU'
        ? dash?.rails?.TBANK_RU?.readyCount ?? 0
        : dash?.rails?.KG_CRYPTO?.readyCount ?? 0
    const railReadyThb =
      poolRail === 'TBANK_RU'
        ? Number(dash?.rails?.TBANK_RU?.readyThb) || 0
        : Number(dash?.rails?.KG_CRYPTO?.readyThb) || 0
    if (railReady === 0 || railReadyThb <= 0) {
      toast({
        title: POOL_MESSAGES_RU.no_ready_bookings,
        description:
          'Брони появятся после оплаты, 24-часового удержания и перевода в статус «Готово к выплате».',
      })
      return
    }
    const res = await fetch('/api/admin/finances/payout-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail: poolRail, force }),
    })
    const json = await res.json()
    if (!json.success) {
      const msg =
        json.message ||
        POOL_MESSAGES_RU[json.code?.toLowerCase?.()] ||
        POOL_MESSAGES_RU[json.message] ||
        json.error
      toast({
        title:
          json.code === 'NO_READY_BOOKINGS' || json.message === 'no_ready_bookings'
            ? POOL_MESSAGES_RU.no_ready_bookings
            : 'Пул не создан',
        description: msg || 'Попробуйте позже',
        variant: 'destructive',
      })
      return
    }
    toast({
      title: `Пул ${PAYOUT_RAIL_LABELS[poolRail] || poolRail} сформирован`,
      description: `${json.itemCount ?? 0} броней · ${fmtThb(json.totalsThb)}`,
    })
    load()
  }

  const lockBatch = async (id) => {
    const res = await fetch(`/api/admin/finances/payout-batches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock' }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.success === false) {
      toast({
        title: 'Не удалось зафиксировать пул',
        description: json.error || json.message || 'Проверьте статус (нужен черновик)',
        variant: 'destructive',
      })
      return
    }
    toast({ title: 'Пул зафиксирован', description: 'Можно скачать CSV и отправить в банк' })
    load()
  }

  const exportBatch = (id) => {
    window.open(`/api/admin/finances/payout-batches/${id}/export?format=csv`, '_blank')
    toast({
      title: 'Выгрузка CSV',
      description: 'Если файл не открылся — разрешите всплывающие окна для сайта',
    })
  }

  const downloadBankPackage = (id) => {
    window.open(`/api/admin/finances/payout-batches/${id}/bank-package`, '_blank')
    toast({
      title: 'Пакет для банка',
      description:
        'ZIP: реестр CSV, справка по оферте и PDF-акты (после закрытия пула). Если файл не скачался — разрешите всплывающие окна.',
    })
  }

  const markBatchPaid = async (id) => {
    if (
      !confirm(
        'Подтвердите: перевод в банк уже выполнен.\n\nПул будет закрыт, брони перейдут в «Завершено», обязательства в учётной книге спишутся. Отменить это действие нельзя.',
      )
    ) {
      return
    }
    setSettlingBatchId(id)
    try {
      const res = await fetch(`/api/admin/finances/payout-batches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settled' }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        const blocked = json.error === 'open_partner_payout_requests'
        toast({
          title: blocked ? 'Открытые заявки на вывод' : 'Не удалось закрыть пул',
          description:
            json.message ||
            (blocked
              ? 'У партнёров из пула есть заявки PENDING/PROCESSING — обработайте их в разделе выплат.'
              : json.error || 'Доступно только для пула «Зафиксирован» или «Выгружен»'),
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Пул закрыт, балансы обновлены',
        description: `Броней завершено: ${json.bookingsCompleted ?? 0}, проводок в книге: ${json.ledgerPosted ?? 0}`,
      })
      load()
    } catch (e) {
      toast({ title: 'Ошибка сети', description: e.message, variant: 'destructive' })
    } finally {
      setSettlingBatchId(null)
    }
  }

  const retryFiscal = async (bookingId) => {
    const res = await fetch(`/api/admin/finances/fiscal-retry/${bookingId}`, { method: 'POST' })
    const json = await res.json()
    toast({
      title: json.success ? 'Чек отправлен повторно' : 'Не удалось пробить чек',
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
      if (json.success && (json.sandbox || fiscalSandbox)) {
        setFiscalTestDisplay(json.display || null)
        setFiscalTestOpen(true)
        return
      }
      if (json.success) {
        toast({
          title: 'Тестовый чек отправлен',
          description: json.receiptId || 'Провайдер принял запрос',
        })
        return
      }
      toast({
        title: 'Ошибка кассы',
        description: json.error || json.message,
        variant: 'destructive',
      })
    } finally {
      setFiscalTestLoading(false)
    }
  }

  const runReconcile = async () => {
    setReconLoading(true)
    try {
      const res = await fetch('/api/v2/admin/ledger-reconciliation', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setLastRecon({ ok: false, error: json.error || `HTTP ${res.status}`, at: Date.now() })
        toast({
          title: 'Сверка не выполнена',
          description: json.error || 'Проверьте доступ администратора',
          variant: 'destructive',
        })
        return
      }
      const d = json.data
      const delta = Math.abs(Number(d?.deltaThb) || 0)
      const bad = delta > 0.01 || d?.marginLeakage
      setDash((prev) => ({ ...prev, reconciliation: d }))
      setLastRecon({ ok: true, data: d, at: Date.now() })
      toast({
        title: bad ? 'Сверка: есть расхождение' : 'Сверка успешна',
        description: bad
          ? `Расхождение ${fmtThb(d?.deltaThb)} — проверьте проводки`
          : `Расхождение в норме (${fmtThb(d?.deltaThb)})`,
        variant: bad ? 'destructive' : 'default',
      })
    } catch (e) {
      setLastRecon({ ok: false, error: e.message, at: Date.now() })
      toast({ title: 'Ошибка сети', description: e.message, variant: 'destructive' })
    } finally {
      setReconLoading(false)
    }
  }

  const downloadBlob = async (url, fallbackName) => {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || `HTTP ${res.status}`)
    }
    const blob = await res.blob()
    const disposition = res.headers.get('content-disposition') || ''
    const match = disposition.match(/filename="?([^";]+)"?/i)
    const filename = match?.[1] || fallbackName
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  const exportMonthBundle = async () => {
    const { from, to } = currentMonthRange()
    setMonthlyExporting(true)
    try {
      await downloadBlob(
        `/api/admin/finances/compliance-export?from=${from}&to=${to}`,
        `reestr-${from}-${to}.csv`,
      )
      await downloadBlob(
        `/api/admin/finances/conversions/export?from=${from}&to=${to}`,
        `conversions-${from}-${to}.csv`,
      )
      await downloadBlob(
        `/api/admin/finances/payout-batches/export-period?from=${from}&to=${to}`,
        `payout-pools-${from}-${to}.csv`,
      )
      toast({
        title: 'Пакет за месяц выгружен',
        description: 'Три файла: реестр броней, конвертации и пулы выплат (разделитель «;»).',
      })
    } catch (e) {
      toast({ title: 'Не удалось выгрузить пакет', description: e.message, variant: 'destructive' })
    } finally {
      setMonthlyExporting(false)
    }
  }

  const downloadCompliance = async () => {
    let url = ''
    if (complianceBooking.trim()) {
      url = `/api/admin/finances/compliance-export?bookingId=${encodeURIComponent(complianceBooking.trim())}`
    } else {
      if (!complianceFrom || !complianceTo) {
        toast({
          title: 'Укажите период',
          description: 'Даты «с» и «по» или номер брони',
          variant: 'destructive',
        })
        return
      }
      url = `/api/admin/finances/compliance-export?from=${complianceFrom}&to=${complianceTo}`
    }

    setComplianceDownloading(true)
    try {
      const res = await fetch(url, { credentials: 'include' })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok || contentType.includes('application/json')) {
        const json = await res.json().catch(() => ({}))
        toast({
          title: 'Не удалось скачать реестр',
          description: json.error || `Ошибка ${res.status}`,
          variant: 'destructive',
        })
        return
      }
      const rowCount = Number(res.headers.get('x-export-row-count') || 0)
      const isEmpty = res.headers.get('x-export-empty') === '1'
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="?([^";]+)"?/i)
      const filename = match?.[1] || 'reestr-bank.csv'
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(objectUrl)
      if (isEmpty || rowCount === 0) {
        toast({
          title: 'Реестр пустой',
          description:
            'За период нет оплаченных броней (фильтр по дате оплаты). Откройте файл — в первой строке пояснение. Укажите UUID брони, если нужна одна операция.',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Реестр скачан',
        description: complianceBooking.trim()
          ? 'Одна бронь сохранена в CSV (разделитель «;» для Excel)'
          : `Период ${complianceFrom} — ${complianceTo}: ${rowCount} строк`,
      })
    } catch (e) {
      toast({
        title: 'Ошибка сети',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setComplianceDownloading(false)
    }
  }

  const statCards = useMemo(
    () => [
      {
        label: 'Чеки в очереди',
        value: dash?.pendingFiscal?.length ?? 0,
        sub: 'ожидают пробития',
        icon: Receipt,
      },
      {
        label: 'Баланс книги',
        value: driftBad ? fmtThb(driftThb) : 'В норме',
        sub: driftBad ? 'нужна проверка' : 'расхождение < 0.01 ฿',
        icon: Gauge,
        danger: driftBad,
      },
      {
        label: 'Движок цен v2',
        value: v2Effective ? 'Вкл' : 'Выкл',
        sub: v2EnvLock ? 'задано на сервере' : 'в настройках',
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
                Финансовый пульт
              </h1>
              <p className="text-teal-100/80 text-sm mt-1 max-w-xl">
                Цены, онлайн-касса, выплаты партнёрам и выгрузки для банка. Только для владельца и
                администратора.
              </p>
              <div className="mt-3">
                <FinTechConsoleHeaderAlerts alerts={dash?.alerts} />
              </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <FinTechTreasuryHeroDashboard
          dash={dash}
          statCards={statCards}
          onSimulateRail={simulateFinancialRail}
        />
        <Card className="border-amber-200 bg-amber-50/90 shadow-sm">
          <CardContent className="py-4 flex flex-wrap items-start gap-3 text-sm text-amber-950">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Режим Concierge Launch (ручной)</p>
              <p className="mt-1 text-amber-900/90">
                Это ручной режим Concierge Launch: автоматизация банковских выплат будет позже. Вы
                сами формируете пул, скачиваете CSV/ZIP для банка, переводите деньги и отмечаете пул
                оплаченным. PDF-акты партнёрам создаются при закрытии пула.
              </p>
              <Link
                href="/admin/settings/legal"
                className="inline-block mt-2 text-teal-800 font-medium underline"
              >
                Юридические документы и версии оферты
              </Link>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Обзор
            </TabsTrigger>
            <TabsTrigger value="pools" className="gap-1.5">
              <FileStack className="h-4 w-4" />
              Пулы
            </TabsTrigger>
            <TabsTrigger value="conversions" className="gap-1.5">
              <Banknote className="h-4 w-4" />
              Конвертации
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              Журнал
            </TabsTrigger>
            <TabsTrigger value="exports" className="gap-1.5">
              <Download className="h-4 w-4" />
              Выгрузки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8 mt-0">
        <Card className="border-indigo-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-2" style={{ borderLeft: '4px solid #6366f1' }}>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Scale className="h-5 w-5 text-indigo-600" />
              Юридические документы
            </CardTitle>
            <CardDescription>
              Версии оферты, журнал согласий и PDF-акты при выплатах партнёрам.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground max-w-md">
              Управление публичной офертой, условиями для хостов и выгрузкой справки для архива.
            </p>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
              <Link href="/admin/settings/legal">Открыть раздел</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-teal-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${MINT}` }}>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Zap className="h-5 w-5" style={{ color: MINT }} />
              Новый движок расчёта цен
            </CardTitle>
            <CardDescription>
              Округление для гостя до целого бата, детальная схема комиссий и чеки 54-ФЗ для новых броней.
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
                  {v2Effective ? 'Включён для новых броней' : 'Выключен'}
                </p>
                {v2EnvLock && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="h-3 w-3" />
                    Переключатель на сервере (переменная PRICING_ENGINE_V2) — меняется в Vercel
                  </p>
                )}
              </div>
            </div>
            <Badge variant={v2Effective ? 'default' : 'secondary'} className="bg-teal-600">
              {v2Effective ? 'Активен' : 'Неактивен'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Receipt className="h-5 w-5 text-teal-600" />
              Онлайн-касса (54-ФЗ)
            </CardTitle>
            <CardDescription>Пробитие чеков для гостей из РФ при оплате через агента.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                className={
                  fiscalSandbox
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-100'
                    : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100'
                }
              >
                {fiscalSandbox ? 'Песочница (тест)' : 'Боевой режим'}
              </Badge>
              {!dash?.fiscal?.providerConfigured && !fiscalSandbox && (
                <Badge variant="destructive">Не настроен адрес кассы (OFD)</Badge>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-slate-50 p-3">
                <span className="text-slate-500 block text-xs">ИНН агента (РФ)</span>
                <span className="font-mono font-medium">{dash?.fiscal?.ruAgentInn}</span>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <span className="text-slate-500 block text-xs">Поставщик (Кыргызстан, ОсОО)</span>
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
                        {FISCAL_QUEUE_STATUS_RU[b.status] || b.status}
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
              <FinTechEmptyState
                icon={CheckCircle2}
                title="Очередь чеков пуста"
                description="Все оплаченные брони пробиты или ещё не требуют фискализации."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Calculator className="h-5 w-5 text-teal-600" />
              Тарифы и комиссии
            </CardTitle>
            <CardDescription>
              Единый источник процентов. Доля РФ + доля КР = комиссия с гостя.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label>Сумма брони (฿), без сборов</Label>
                <Input value={simSubtotal} onChange={(e) => setSimSubtotal(e.target.value)} className="w-36" />
              </div>
              <div>
                <Label>Тариф</Label>
                <select
                  className="border rounded-md h-10 px-2 min-w-[200px]"
                  value={simProfileId}
                  onChange={(e) => setSimProfileId(e.target.value)}
                >
                  {activeProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={runSimulate} style={{ backgroundColor: MINT }}>
                <Play className="h-4 w-4 mr-1" />
                Рассчитать
              </Button>
            </div>
            <BreakdownGrid b={simResult} />

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2" style={{ color: NAVY }}>
                {editingId ? 'Редактировать тариф' : 'Новый тариф'}
              </h4>
              <div className="mb-3">
                <Label>{PROFILE_FIELD_LABELS.name}</Label>
                <Input
                  value={draft.name ?? ''}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Базовый Таиланд"
                  className="max-w-md"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PROFILE_FORM_KEYS.filter((k) => k !== 'name').map((key) => (
                  <div key={key}>
                    <Label className="text-xs">{PROFILE_FIELD_LABELS[key] || key}</Label>
                    <Input
                      value={draft[key] ?? ''}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              {!draftValid && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Доля РФ + доля КР должны равняться комиссии с гостя
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Button onClick={saveProfile} disabled={!draftValid} style={{ backgroundColor: MINT }}>
                  {editingId ? 'Сохранить' : 'Создать тариф'}
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

            {activeProfiles.length === 0 && archivedProfiles.length === 0 ? (
              <FinTechEmptyState
                icon={Inbox}
                title="Тарифов пока нет"
                description="Создайте первый тариф — от него считаются все новые брони с движком v2."
              />
            ) : (
              <div className="space-y-2">
                {activeProfiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:border-teal-200"
                  >
                    <div>
                      <strong>{p.name}</strong>
                      <p className="text-slate-600 mt-0.5">
                        С гостя {p.guest_fee_pct}% = РФ {p.ru_agent_share_pct}% + КР {p.kr_service_share_pct}%
                        {p.fx_markup_pct ? ` · курс +${p.fx_markup_pct}%` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
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
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => archiveProfile(p.id, p.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Архивировать
                      </Button>
                    </div>
                  </div>
                ))}
                {archivedProfiles.length > 0 && (
                  <div className="pt-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">Архив (не используются)</p>
                    {archivedProfiles.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm opacity-70 mb-2"
                      >
                        <span>{p.name}</span>
                        <Badge variant="secondary">архив</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-teal-100/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg" style={{ color: NAVY }}>
              Маржа за текущий месяц
            </CardTitle>
            <CardDescription>Визуально: из поступлений гостей → выплаты и FX-потери → чистая маржа.</CardDescription>
          </CardHeader>
          <CardContent>
            <FinTechMarginBar
              acceptedThb={monthMargin?.acceptedGuestThb}
              paidOutThb={monthMargin?.paidOutThb}
              lossesThb={monthMargin?.conversionLossesThb}
              netMarginThb={monthMargin?.netMarginThb}
            />
          </CardContent>
        </Card>

        <Card className={cn('border-slate-200 shadow-sm', driftBad && 'border-red-300 bg-red-50/30')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Gauge className="h-5 w-5" />
              Сверка денежной книги
            </CardTitle>
            <CardDescription>Начните день с этой проверки: поступления гостей и распределение по счетам.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dash?.reconciliation?.error ? (
              <p className="text-red-600 text-sm">{dash.reconciliation.error}</p>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border p-3 bg-white">
                  <span className="text-slate-500 text-xs">Поступило от гостей</span>
                  <p className="font-semibold tabular-nums">
                    {fmtThb(dash?.reconciliation?.guestClearingDebitsThb)}
                  </p>
                </div>
                <div className="rounded-lg border p-3 bg-white">
                  <span className="text-slate-500 text-xs">Распределено по счетам</span>
                  <p className="font-semibold tabular-nums">
                    {fmtThb(dash?.reconciliation?.distributionCreditsThb)}
                  </p>
                </div>
                <div
                  className={cn('rounded-lg border p-3', driftBad ? 'bg-red-100 border-red-200' : 'bg-white')}
                >
                  <span className="text-slate-500 text-xs">Расхождение</span>
                  <p className={cn('font-semibold tabular-nums', driftBad && 'text-red-700')}>
                    {fmtThb(dash?.reconciliation?.deltaThb)}
                  </p>
                </div>
              </div>
            )}
            {lastRecon && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                  lastRecon.ok && !driftBad ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200',
                )}
              >
                {lastRecon.ok && !driftBad ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    {lastRecon.ok
                      ? lastRecon.data?.marginLeakage
                        ? 'Сверка завершена — есть предупреждение'
                        : 'Последняя сверка успешна'
                      : 'Последняя сверка с ошибкой'}
                  </p>
                  <p className="text-slate-600 text-xs mt-0.5">
                    {lastRecon.ok
                      ? `Расхождение ${fmtThb(lastRecon.data?.deltaThb)} · ${new Date(lastRecon.at).toLocaleString('ru-RU')}`
                      : `${lastRecon.error} · ${new Date(lastRecon.at).toLocaleString('ru-RU')}`}
                  </p>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              onClick={runReconcile}
              disabled={reconLoading}
              style={{ borderColor: MINT, color: NAVY }}
            >
              {reconLoading ? 'Считаем…' : 'Запустить сверку сейчас'}
            </Button>
          </CardContent>
        </Card>

          </TabsContent>

          <TabsContent value="pools" className="space-y-8 mt-0">
        <Card className="border-teal-100 shadow-md overflow-hidden">
          <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${MINT}` }}>
            <CardTitle className="text-lg" style={{ color: NAVY }}>
              Пулы выплат партнёрам
            </CardTitle>
            <CardDescription className="space-y-2">
              <span className="block font-medium text-amber-900">
                Concierge Launch: банк не подключён автоматически — каждый перевод делаете вы.
              </span>
              <span className="block">
                Обычно пул в понедельник и четверг: «Сформировать пул» → Lock → CSV/ZIP в банк → перевод →
                «Закрыть пул». Брони берутся со статусом «Готово к выплате».
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="flex flex-wrap gap-2 text-xs text-slate-600 list-none p-0 m-0">
              {TREASURY_DAILY_STEPS.map((step, i) => (
                <li key={step} className="rounded-full bg-slate-100 px-2.5 py-1">
                  {i + 1}. {step}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm text-slate-600">Рельс выплат</Label>
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={poolRail}
                onChange={(e) => setPoolRail(e.target.value)}
              >
                <option value="TBANK_RU">RUB Direct (T-Bank)</option>
                <option value="KG_CRYPTO">KG / USDT (International)</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                className="text-base h-12 px-8"
                style={{ backgroundColor: MINT }}
                onClick={() => createPool(false)}
              >
                Сформировать пул ({PAYOUT_RAIL_LABELS[poolRail] || poolRail})
              </Button>
              <Button variant="outline" onClick={() => createPool(true)}>
                Вне расписания (форс)
              </Button>
            </div>
            <p className="text-sm text-slate-600">
              Готово по рельсу:{' '}
              <strong>{poolRail === 'TBANK_RU' ? dash?.rails?.TBANK_RU?.readyCount : dash?.rails?.KG_CRYPTO?.readyCount}</strong>{' '}
              броней · <strong>{fmtThb(poolRail === 'TBANK_RU' ? dash?.rails?.TBANK_RU?.readyThb : dash?.rails?.KG_CRYPTO?.readyThb)}</strong>
              {' · '}
              всего {dash?.payout?.readyForPayoutCount ?? 0} / {fmtThb(dash?.payout?.readyForPayoutThb)}
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="text-slate-500">Показать пулы:</span>
              {['ALL', 'TBANK_RU', 'KG_CRYPTO'].map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={batchRailFilter === key ? 'default' : 'outline'}
                  onClick={() => setBatchRailFilter(key)}
                >
                  {key === 'ALL' ? 'Все' : PAYOUT_RAIL_LABELS[key]}
                </Button>
              ))}
            </div>
            {(batchRailFilter === 'ALL' ? batches : batches.filter((b) => b.rail === batchRailFilter))
              .length === 0 ? (
              <FinTechEmptyState
                icon={FileStack}
                title="Пулов выплат ещё нет"
                description="Когда появятся брони «Готово к выплате», нажмите кнопку выше — здесь появится черновик для банка."
              />
            ) : (
              <div className="space-y-3">
                {(batchRailFilter === 'ALL'
                  ? batches
                  : batches.filter((b) => b.rail === batchRailFilter)
                ).map((b) => (
                  <PayoutBatchRow
                    key={b.id}
                    batch={b}
                    settling={settlingBatchId === b.id}
                    onLock={lockBatch}
                    onExport={exportBatch}
                    onBankPackage={downloadBankPackage}
                    onSettle={markBatchPaid}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="conversions" className="mt-0">
            <FinTechTreasuryConversionsPanel />
          </TabsContent>

          <TabsContent value="journal" className="mt-0">
            <FinTechMovementJournal />
          </TabsContent>

          <TabsContent value="exports" className="space-y-8 mt-0">
        <Card className="border-slate-200 shadow-sm border-teal-100">
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: NAVY }}>
              Экспорт всего за месяц
            </CardTitle>
            <CardDescription>
              Одним кликом: реестр оплаченных броней + журнал конвертаций (два CSV для бухгалтера).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportMonthBundle} disabled={monthlyExporting} style={{ backgroundColor: MINT }}>
              {monthlyExporting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {monthlyExporting ? 'Формируем…' : 'Скачать пакет за текущий месяц'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
              <Download className="h-5 w-5 text-teal-600" />
              Реестр для банка и бухгалтерии
            </CardTitle>
            <CardDescription>
              Выгрузка для бухгалтерии и валютного контроля. Период — по <strong>дате оплаты</strong> гостя, не
              по дате создания брони. Файл с разделителем «;» — открывается в Excel без настроек.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs">Номер брони (UUID)</Label>
                <Input
                  placeholder="если нужна одна бронь"
                  value={complianceBooking}
                  onChange={(e) => setComplianceBooking(e.target.value)}
                  className="w-64"
                />
              </div>
              <div>
                <Label className="text-xs">Период: с</Label>
                <Input type="date" value={complianceFrom} onChange={(e) => setComplianceFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">по</Label>
                <Input type="date" value={complianceTo} onChange={(e) => setComplianceTo(e.target.value)} />
              </div>
              <Button
                onClick={downloadCompliance}
                disabled={complianceDownloading}
                style={{ backgroundColor: NAVY }}
              >
                <Download className="h-4 w-4 mr-1" />
                {complianceDownloading ? 'Формируем…' : 'Скачать CSV'}
              </Button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              В файле: номер брони, дата оплаты, объявление, тип услуги, статус, суммы в батах и рублях, курс,
              статус онлайн-кассы. Если строк нет — в файле будет пояснение; проверьте другой период или вставьте
              UUID оплаченной брони.
            </p>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      <FiscalSandboxReceiptDialog
        open={fiscalTestOpen}
        onOpenChange={setFiscalTestOpen}
        display={fiscalTestDisplay}
      />

      <AlertDialog open={v2DialogOpen} onOpenChange={setV2DialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {v2Pending ? 'Включить новый движок цен?' : 'Выключить новый движок цен?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {v2Pending
                ? 'Новые брони: округление до 1 ฿, полная схема комиссий и чеки. Убедитесь, что касса в нужном режиме (тест/бой).'
                : 'Новые брони вернутся к прежней схеме. Уже созданные брони не изменятся.'}
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
