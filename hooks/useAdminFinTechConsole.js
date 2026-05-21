'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Gauge, Receipt, Zap } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { POOL_MESSAGES_RU, resolvePayoutRailLabel } from '@/lib/admin/fintech-ui-labels'
import { isFintechTestPayoutBatchRow } from '@/lib/admin/fintech-test-data-markers'
import {
  currentMonthRange,
  emptyPricingProfile,
  feeSplitValid,
  fmtThb,
} from '@/lib/admin/fintech-console-shared'
import {
  readFintechOwnerModePreference,
  readFintechRealDataOnlyPreference,
} from '@/components/admin/finances/FinTechTestDataToolbar'
import {
  fetchFintechConsoleBundle,
  patchFintechPricingV2,
  postFintechPricingSimulate,
  saveFintechPricingProfile,
  deleteFintechPricingProfile,
  postFintechSmokeFinancialRun,
  postFintechPayoutBatch,
  patchFintechPayoutBatch,
  postFintechFiscalRetry,
  postFintechFiscalTest,
  fetchFintechLedgerReconciliation,
  fetchFintechDownloadBlob,
  invalidateFintechConsoleBundleCache,
} from '@/lib/admin/admin-fintech-api-client'

/**
 * Stage 109.0 — состояние и обработчики FinTech-пульта (без разметки).
 */
export function useAdminFinTechConsole() {
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
  const [draft, setDraft] = useState(emptyPricingProfile)
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
  const [treasuryOps, setTreasuryOps] = useState(null)
  const [cronHealth, setCronHealth] = useState(null)
  const [productionReadiness, setProductionReadiness] = useState(null)
  const [monthMargin, setMonthMargin] = useState(null)
  const [monthlyExporting, setMonthlyExporting] = useState(false)
  const [realDataOnly, setRealDataOnly] = useState(() => readFintechRealDataOnlyPreference(true))
  const [ownerMode, setOwnerMode] = useState(() => readFintechOwnerModePreference(true))
  const [dataRefreshKey, setDataRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    invalidateFintechConsoleBundleCache()
    try {
      const { from, to } = currentMonthRange()
      const bundle = await fetchFintechConsoleBundle({ from, to, excludeTest: realDataOnly })
      if (bundle.dashboard) setDash(bundle.dashboard)
      setTreasuryOps(bundle.treasuryOps)
      setCronHealth(bundle.cronHealth)
      setProductionReadiness(bundle.productionReadiness)
      setMonthMargin(bundle.monthMargin)
      setProfiles(bundle.profiles)
      setSimProfileId((prev) => prev || bundle.profiles?.[0]?.id || '')
      setBatches(bundle.batches)
    } catch (e) {
      toast({ title: 'Не удалось загрузить данные', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, realDataOnly])

  const handleTestDataCleaned = useCallback(() => {
    setDataRefreshKey((k) => k + 1)
    load()
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  const visibleBatches = useMemo(() => {
    let list = batches
    if (batchRailFilter !== 'ALL') list = list.filter((b) => b.rail === batchRailFilter)
    if (realDataOnly) list = list.filter((b) => !isFintechTestPayoutBatchRow(b))
    return list
  }, [batches, batchRailFilter, realDataOnly])

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
    const { json } = await patchFintechPricingV2(v2Pending)
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
    const simProfile = profiles.find((p) => p.id === simProfileId) || profiles[0]
    if (!simProfile) {
      toast({ title: 'Нет тарифного профиля', variant: 'destructive' })
      return
    }
    const { ok, data, json } = await postFintechPricingSimulate({
      subtotal_thb: Number(simSubtotal),
      profile: simProfile,
    })
    if (!ok) {
      toast({ title: 'Ошибка расчёта', description: json.error, variant: 'destructive' })
      return
    }
    setSimResult(data)
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
    const { json } = await saveFintechPricingProfile({ editingId, draft })
    if (!json.success) {
      toast({ title: 'Профиль', description: json.message || json.error, variant: 'destructive' })
      return
    }
    toast({ title: editingId ? 'Тариф обновлён' : 'Тариф создан' })
    setDraft(emptyPricingProfile)
    setEditingId(null)
    load()
  }

  const archiveProfile = async (id, name) => {
    if (!confirm(`Архивировать тариф «${name}»? Он не будет использоваться для новых броней.`)) return
    const { json } = await deleteFintechPricingProfile(id)
    if (!json.success) {
      toast({ title: 'Не удалось архивировать', description: json.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Тариф архивирован' })
    if (editingId === id) {
      setEditingId(null)
      setDraft(emptyPricingProfile)
    }
    load()
  }

  const simulateFinancialRail = async (rail) => {
    const { ok, data, json } = await postFintechSmokeFinancialRun({
      rail,
      priceThb: 5000,
      guestPayCurrency: rail === 'TBANK_RU' ? 'RUB' : 'USDT',
    })
    if (!ok) {
      const failed = (data?.steps || []).find((s) => !s.ok)
      toast({
        title: `Симуляция ${resolvePayoutRailLabel(rail, ownerMode)} не пройдена`,
        description: failed?.detail || json.error || 'См. шаги в Legal',
        variant: 'destructive',
      })
      return
    }
    toast({
      title: `Симуляция ${resolvePayoutRailLabel(rail, ownerMode)} пройдена`,
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
    const { json } = await postFintechPayoutBatch({ rail: poolRail, force })
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
      title: `Пул ${resolvePayoutRailLabel(poolRail, ownerMode)} сформирован`,
      description: `${json.itemCount ?? 0} броней · ${fmtThb(json.totalsThb)}`,
    })
    load()
  }

  const lockBatch = async (id) => {
    const { ok, json } = await patchFintechPayoutBatch(id, 'lock')
    if (!ok) {
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
      const { ok, json } = await patchFintechPayoutBatch(id, 'settled')
      if (!ok) {
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
    const { json } = await postFintechFiscalRetry(bookingId)
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
      const { json } = await postFintechFiscalTest()
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
      const { ok, data, json } = await fetchFintechLedgerReconciliation()
      if (!ok) {
        setLastRecon({ ok: false, error: json.error || `HTTP ${res.status}`, at: Date.now() })
        toast({
          title: 'Сверка не выполнена',
          description: json.error || 'Проверьте доступ администратора',
          variant: 'destructive',
        })
        return
      }
      const d = data
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
    const { blob, filename: headerName } = await fetchFintechDownloadBlob(url)
    const filename = headerName || fallbackName
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
      let blob
      let filename = 'reestr-bank.csv'
      let rowCount = 0
      let isEmpty = false
      try {
        const dl = await fetchFintechDownloadBlob(url)
        if (dl.contentType.includes('application/json')) {
          throw new Error('Export returned JSON')
        }
        blob = dl.blob
        filename = dl.filename
        rowCount = dl.rowCount
        isEmpty = dl.isEmpty
      } catch (err) {
        toast({
          title: 'Не удалось скачать реестр',
          description: err.message || 'Ошибка выгрузки',
          variant: 'destructive',
        })
        return
      }
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

  const statCards = useMemo(() => {
    const cards = [
      {
        label: 'Готово к выплате',
        value: fmtThb(dash?.payout?.readyForPayoutThb),
        sub: `${dash?.payout?.readyForPayoutCount ?? 0} броней`,
        icon: Banknote,
      },
      {
        label: 'Чеки в очереди',
        value: dash?.pendingFiscal?.length ?? 0,
        sub: 'ожидают пробития',
        icon: Receipt,
      },
    ]
    if (!ownerMode) {
      cards.push({
        label: 'Баланс книги',
        value: driftBad ? fmtThb(driftThb) : 'В норме',
        sub: driftBad ? 'нужна проверка' : 'расхождение < 0.01 ฿',
        icon: Gauge,
        danger: driftBad,
      })
      cards.push({
        label: 'Движок цен v2',
        value: v2Effective ? 'Вкл' : 'Выкл',
        sub: v2EnvLock ? 'задано на сервере' : 'в настройках',
        icon: Zap,
      })
    } else if (driftBad) {
      cards.push({
        label: 'Сверка',
        value: 'Проверить',
        sub: 'есть расхождение в учёте',
        icon: Gauge,
        danger: true,
      })
    }
    return cards
  }, [dash, driftBad, driftThb, v2Effective, v2EnvLock, ownerMode])

  return {
    toast,
    dash,
    loading,
    load,
    statCards,
    ownerMode,
    setOwnerMode,
    realDataOnly,
    setRealDataOnly,
    handleTestDataCleaned,
    productionReadiness,
    cronHealth,
    treasuryOps,
    dataRefreshKey,
    monthMargin,
    v2Pending,
    setV2Pending,
    v2DialogOpen,
    setV2DialogOpen,
    v2Effective,
    v2EnvLock,
    applyV2Toggle,
    fiscalSandbox,
    fiscalTestLoading,
    fiscalTestOpen,
    setFiscalTestOpen,
    fiscalTestDisplay,
    runFiscalTest,
    retryFiscal,
    simSubtotal,
    setSimSubtotal,
    simProfileId,
    setSimProfileId,
    simResult,
    runSimulate,
    activeProfiles,
    archivedProfiles,
    draft,
    setDraft,
    editingId,
    setEditingId,
    draftValid,
    saveProfile,
    archiveProfile,
    driftBad,
    lastRecon,
    reconLoading,
    runReconcile,
    poolRail,
    setPoolRail,
    batchRailFilter,
    setBatchRailFilter,
    visibleBatches,
    settlingBatchId,
    createPool,
    lockBatch,
    exportBatch,
    downloadBankPackage,
    markBatchPaid,
    simulateFinancialRail,
    monthlyExporting,
    exportMonthBundle,
    complianceFrom,
    setComplianceFrom,
    complianceTo,
    setComplianceTo,
    complianceBooking,
    setComplianceBooking,
    complianceDownloading,
    downloadCompliance,
  }
}
