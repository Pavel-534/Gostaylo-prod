'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  CheckCircle2,
  Download,
  Filter,
  Loader2,
  Scale,
  TrendingDown,
  Wallet,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { fmtThb } from '@/lib/admin/fintech-console-shared'
import {
  fetchFintechConversions,
  postFintechConversion,
  fetchFintechConversionsReconcile,
  fetchFintechDownloadBlob,
  triggerFintechBlobDownload,
} from '@/lib/admin/admin-fintech-api-client'

const MINT = '#0D9488'
const NAVY = '#0F172A'

const OPERATION_TYPES = [
  { value: '', label: 'Все типы' },
  { value: 'RUB_TO_KGS', label: 'RUB → KGS (биржа/банк)' },
  { value: 'KGS_TO_USDT', label: 'KGS → USDT (крипто)' },
  { value: 'USDT_TO_RUB', label: 'USDT → RUB (выплата)' },
  { value: 'CUSTOM', label: 'Другая' },
]

const FORM_OPERATION_TYPES = OPERATION_TYPES.filter((o) => o.value)

const CURRENCY_FILTERS = ['', 'RUB', 'KGS', 'USDT', 'THB']

function fmtCur(n, cur = '') {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `${x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
}

function fmtPct(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `${x.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {{ excludeTest?: boolean, refreshKey?: number }} [props]
 */
export function FinTechTreasuryConversionsPanel({ excludeTest = false, refreshKey = 0 }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [from, setFrom] = useState(todayDate())
  const [to, setTo] = useState(todayDate())
  const [filterOperationType, setFilterOperationType] = useState('')
  const [filterCurrency, setFilterCurrency] = useState('')
  const [data, setData] = useState(null)
  const [reconcileResult, setReconcileResult] = useState(null)
  const [form, setForm] = useState({
    operationType: 'RUB_TO_KGS',
    fromCurrency: 'RUB',
    toCurrency: 'KGS',
    amountFrom: '',
    amountTo: '',
    rateUsed: '',
    conversionFeeThb: '',
    conversionFeeRub: '',
    conversionLossThb: '',
    externalTxReference: '',
    note: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ from, to, limit: '500' })
      if (filterOperationType) qs.set('operationType', filterOperationType)
      if (filterCurrency) qs.set('currency', filterCurrency)
      if (excludeTest) qs.set('excludeTest', '1')
      const { ok, data, json } = await fetchFintechConversions(qs)
      if (!ok) throw new Error(json.error || `HTTP ${json.status || 'error'}`)
      setData(data)
      setReconcileResult(null)
    } catch (e) {
      toast({ title: 'Не удалось загрузить конвертации', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [from, to, filterOperationType, filterCurrency, excludeTest, toast])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const margin = data?.margin || {}
  const conversions = data?.conversions || []
  const hasListFilters = Boolean(filterOperationType || filterCurrency)

  const listLossesThb = useMemo(
    () =>
      conversions.reduce(
        (sum, row) => sum + (Number(row.conversionFeeThb) || 0) + (Number(row.conversionLossThb) || 0),
        0,
      ),
    [conversions],
  )

  const lossHint = useMemo(() => {
    const fee = Number(form.conversionFeeThb) || 0
    const loss = Number(form.conversionLossThb) || 0
    const total = fee + loss
    if (total <= 0) return 'Укажите комиссию и/или курсовую потерю в THB.'
    return `В учётную книгу попадёт влияние на маржу: ${fmtThb(total)}`
  }, [form.conversionFeeThb, form.conversionLossThb])

  const applyPeriodPreset = (days) => {
    setFrom(days === 0 ? todayDate() : shiftDate(days))
    setTo(todayDate())
  }

  const submit = async () => {
    const amountFrom = Number(form.amountFrom)
    const amountTo = Number(form.amountTo)
    const rateUsed = Number(form.rateUsed)
    if (!Number.isFinite(amountFrom) || amountFrom <= 0) {
      toast({ title: 'Проверьте сумму «из»', variant: 'destructive' })
      return
    }
    if (!Number.isFinite(amountTo) || amountTo <= 0) {
      toast({ title: 'Проверьте сумму «в»', variant: 'destructive' })
      return
    }
    if (!Number.isFinite(rateUsed) || rateUsed <= 0) {
      toast({ title: 'Проверьте фактический курс', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const { ok, data, json } = await postFintechConversion({
        operationType: form.operationType,
        fromCurrency: form.fromCurrency,
        toCurrency: form.toCurrency,
        amountFrom,
        amountTo,
        rateUsed,
        conversionFeeThb: Number(form.conversionFeeThb) || 0,
        conversionFeeRub: Number(form.conversionFeeRub) || 0,
        conversionLossThb: Number(form.conversionLossThb) || 0,
        externalTxReference: form.externalTxReference || null,
        note: form.note || null,
      })
      if (!ok) throw new Error(json.error || `HTTP ${json.status || 'error'}`)
      toast({
        title: 'Конвертация зафиксирована',
        description: `Журнал: ${data.journalId}, влияние: ${fmtThb(data.totalImpactThb)}`,
      })
      setForm((prev) => ({
        ...prev,
        amountFrom: '',
        amountTo: '',
        rateUsed: '',
        conversionFeeThb: '',
        conversionFeeRub: '',
        conversionLossThb: '',
        externalTxReference: '',
        note: '',
      }))
      load()
    } catch (e) {
      toast({ title: 'Не удалось сохранить', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const qs = new URLSearchParams({ from, to })
      const { blob, filename } = await fetchFintechDownloadBlob(
        `/api/admin/finances/conversions/export?${qs.toString()}`,
      )
      triggerFintechBlobDownload(blob, filename || `conversions-${from}-${to}.csv`)
      toast({ title: 'CSV выгружен', description: 'Файл готов для Excel (разделитель «;»).' })
    } catch (e) {
      toast({ title: 'Не удалось выгрузить CSV', description: e.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const runReconcile = async () => {
    setReconciling(true)
    setReconcileResult(null)
    try {
      const { ok, data, json } = await fetchFintechConversionsReconcile(from, to)
      if (!ok) throw new Error(json.error || `HTTP ${json.status || 'error'}`)
      setReconcileResult(data)
      if (data.matched) {
        toast({
          title: 'Сверка пройдена',
          description: `${data.ledgerCount} записей в журнале = ${data.csvCount} строк в CSV.`,
        })
      } else {
        toast({
          title: 'Есть расхождения',
          description: `Найдено ${data.mismatches?.length || 0} несоответствий. См. блок сверки ниже.`,
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({ title: 'Сверка не выполнена', description: e.message, variant: 'destructive' })
    } finally {
      setReconciling(false)
    }
  }

  return (
    <Card
      className="shadow-sm overflow-hidden border-2 border-dashed"
      style={{ borderColor: `${MINT}55`, background: 'linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%)' }}
    >
      <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${MINT}` }}>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
            <ArrowRightLeft className="h-5 w-5" style={{ color: MINT }} />
            Конвертации и потери
          </CardTitle>
          <Badge className="bg-teal-100 text-teal-900 hover:bg-teal-100">Stage 101.2</Badge>
        </div>
        <CardDescription className="text-slate-700">
          Ежедневный контроль: фиксируйте обмены, смотрите реальную маржу, выгружайте CSV для бухгалтера и
          сверяйте журнал с выгрузкой.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <section className="rounded-xl border border-teal-200/80 bg-white/90 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Реальная маржа за период</h3>
            <span className="text-xs text-slate-500">
              {from} — {to}
              {hasListFilters ? ' · фильтры списка не меняют сводку' : ''}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-gradient-to-br from-white to-teal-50 p-4 shadow-sm">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" /> Принято от гостей (RUB)
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {margin.acceptedGuestRub != null ? fmtCur(margin.acceptedGuestRub, 'RUB') : '—'}
              </div>
              <p className="text-xs text-slate-500 mt-1">≈ {fmtThb(margin.acceptedGuestThb)} в учёте</p>
            </div>

            <div className="rounded-xl border bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Выплачено партнёрам</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{fmtThb(margin.paidOutThb)}</div>
              <p className="text-xs text-slate-500 mt-1">статусы PAID / COMPLETED</p>
            </div>

            <div className="rounded-xl border bg-gradient-to-br from-white to-rose-50 p-4 shadow-sm">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" /> Потери на конвертациях
              </div>
              <div className="text-2xl font-bold text-red-700 mt-1">{fmtThb(margin.conversionLossesThb)}</div>
              {hasListFilters ? (
                <p className="text-xs text-amber-700 mt-1">
                  в списке по фильтру: {fmtThb(listLossesThb)} ({conversions.length} оп.)
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border bg-gradient-to-br from-white to-emerald-50 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Чистая маржа платформы</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{fmtThb(margin.netMarginThb)}</div>
              <p className="text-xs font-medium text-emerald-800 mt-1">
                {margin.netMarginPct != null ? fmtPct(margin.netMarginPct) : '—'} от поступлений
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <Filter className="h-4 w-4 text-teal-700" />
            Фильтры и выгрузка
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => applyPeriodPreset(0)}>
              Сегодня
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => applyPeriodPreset(6)}>
              7 дней
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => applyPeriodPreset(29)}>
              30 дней
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">Период: с</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">по</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Тип операции</Label>
              <select
                className="border rounded-md h-10 px-2 w-full min-w-[160px] bg-white"
                value={filterOperationType}
                onChange={(e) => setFilterOperationType(e.target.value)}
              >
                {OPERATION_TYPES.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Валюта (из или в)</Label>
              <select
                className="border rounded-md h-10 px-2 w-full min-w-[100px] bg-white"
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
              >
                {CURRENCY_FILTERS.map((c) => (
                  <option key={c || 'all'} value={c}>
                    {c || 'Все'}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Применить'}
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Экспорт CSV
            </Button>
            <Button variant="outline" onClick={runReconcile} disabled={reconciling}>
              {reconciling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Scale className="h-4 w-4 mr-1" />
              )}
              Сверка с CSV
            </Button>
          </div>
        </section>

        {reconcileResult ? (
          <section
            className={`rounded-lg border px-3 py-2.5 text-sm ${
              reconcileResult.matched
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-2">
              {reconcileResult.matched ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
              )}
              <div>
                <p className="font-medium">
                  {reconcileResult.matched
                    ? 'Журнал и CSV совпадают'
                    : 'Обнаружены расхождения между журналом и CSV'}
                </p>
                <p className="text-xs mt-1 opacity-90">
                  В журнале: {reconcileResult.ledgerCount} · в CSV: {reconcileResult.csvCount}
                </p>
                {(reconcileResult.mismatches || []).length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs max-h-32 overflow-auto">
                    {reconcileResult.mismatches.slice(0, 20).map((m, i) => (
                      <li key={`${m.journalId}-${i}`}>
                        {m.type}
                        {m.journalId ? ` · ${m.journalId}` : ''}
                        {m.field ? ` · ${m.field}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3 space-y-3">
          <p className="text-sm font-medium text-slate-800">Зафиксировать новую конвертацию</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Тип операции</Label>
              <select
                className="border rounded-md h-10 px-2 w-full bg-white"
                value={form.operationType}
                onChange={(e) => setForm((p) => ({ ...p, operationType: e.target.value }))}
              >
                {FORM_OPERATION_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Из валюты</Label>
              <Input
                value={form.fromCurrency}
                onChange={(e) => setForm((p) => ({ ...p, fromCurrency: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <Label className="text-xs">В валюту</Label>
              <Input
                value={form.toCurrency}
                onChange={(e) => setForm((p) => ({ ...p, toCurrency: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <Label className="text-xs">TX hash / ID</Label>
              <Input
                value={form.externalTxReference}
                onChange={(e) => setForm((p) => ({ ...p, externalTxReference: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Сумма из</Label>
              <Input
                value={form.amountFrom}
                onChange={(e) => setForm((p) => ({ ...p, amountFrom: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Сумма в</Label>
              <Input
                value={form.amountTo}
                onChange={(e) => setForm((p) => ({ ...p, amountTo: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Курс (to за 1 from)</Label>
              <Input
                value={form.rateUsed}
                onChange={(e) => setForm((p) => ({ ...p, rateUsed: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Комиссия (THB)</Label>
              <Input
                value={form.conversionFeeThb}
                onChange={(e) => setForm((p) => ({ ...p, conversionFeeThb: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Комиссия (RUB)</Label>
              <Input
                value={form.conversionFeeRub}
                onChange={(e) => setForm((p) => ({ ...p, conversionFeeRub: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Курсовая потеря (THB)</Label>
              <Input
                value={form.conversionLossThb}
                onChange={(e) => setForm((p) => ({ ...p, conversionLossThb: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Комментарий</Label>
            <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
            <p className="text-xs text-slate-500 mt-1">{lossHint}</p>
          </div>

          <Button onClick={submit} disabled={saving} style={{ backgroundColor: MINT }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Зафиксировать конвертацию
          </Button>
        </section>

        <div className="rounded-lg border bg-white">
          <div className="px-3 py-2 border-b flex flex-wrap justify-between gap-2">
            <span className="text-sm font-medium text-slate-800">Журнал конвертаций</span>
            <span className="text-xs text-slate-500">{conversions.length} записей</span>
          </div>
          <div className="max-h-64 overflow-auto divide-y">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Загрузка…
              </div>
            ) : conversions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">Нет записей за выбранный период и фильтры.</div>
            ) : (
              conversions.map((row) => (
                <div key={row.id} className="px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-slate-900">
                      {row.fromCurrency} → {row.toCurrency} · {row.operationType}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {fmtCur(row.amountFrom, row.fromCurrency)} → {fmtCur(row.amountTo, row.toCurrency)} · курс{' '}
                    {row.rateUsed}
                  </div>
                  <div className="text-xs text-amber-700 mt-0.5">
                    Потери: {fmtThb((row.conversionFeeThb || 0) + (row.conversionLossThb || 0))}
                    {row.externalTxReference ? ` · tx: ${row.externalTxReference}` : ''}
                    {row.journalId ? ` · ${row.journalId}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
