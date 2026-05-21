'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Gauge,
  Inbox,
  Play,
  Receipt,
  Scale,
  Shield,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  BREAKDOWN_ROWS,
  FISCAL_QUEUE_STATUS_RU,
  PROFILE_FIELD_LABELS,
  PROFILE_FORM_KEYS,
} from '@/lib/admin/fintech-ui-labels'
import { FINTECH_MINT, FINTECH_NAVY, emptyPricingProfile, fmtThb } from '@/lib/admin/fintech-console-shared'
import { FinTechEmptyState } from '@/components/admin/finances/FinTechEmptyState'
import { FinTechMarginBar } from '@/components/admin/finances/FinTechMarginBar'

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

/**
 * Stage 109.0 — вкладка «Обзор» FinTech-пульта.
 */
export function FinTechOverviewDashboard({
  ownerMode,
  dash,
  loading,
  v2Effective,
  v2EnvLock,
  setV2Pending,
  setV2DialogOpen,
  fiscalSandbox,
  fiscalTestLoading,
  runFiscalTest,
  retryFiscal,
  simSubtotal,
  setSimSubtotal,
  simProfileId,
  setSimProfileId,
  runSimulate,
  simResult,
  activeProfiles,
  archivedProfiles,
  draft,
  setDraft,
  editingId,
  setEditingId,
  draftValid,
  saveProfile,
  archiveProfile,
  monthMargin,
  driftBad,
  lastRecon,
  reconLoading,
  runReconcile,
}) {
  return (
    <div className="space-y-8">
      {!ownerMode && (
        <Card className="border-indigo-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-2" style={{ borderLeft: '4px solid #6366f1' }}>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: FINTECH_NAVY }}>
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
      )}

      {!ownerMode && (
        <Card className="border-teal-100 shadow-sm overflow-hidden">
          <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${FINTECH_MINT}` }}>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: FINTECH_NAVY }}>
              <Zap className="h-5 w-5" style={{ color: FINTECH_MINT }} />
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
                <p className="font-medium" style={{ color: FINTECH_NAVY }}>
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
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: FINTECH_NAVY }}>
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
          <Button onClick={runFiscalTest} disabled={fiscalTestLoading} style={{ backgroundColor: FINTECH_MINT }}>
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
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: FINTECH_NAVY }}>
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
            <Button onClick={runSimulate} style={{ backgroundColor: FINTECH_MINT }}>
              <Play className="h-4 w-4 mr-1" />
              Рассчитать
            </Button>
          </div>
          <BreakdownGrid b={simResult} />

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2" style={{ color: FINTECH_NAVY }}>
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
              <Button onClick={saveProfile} disabled={!draftValid} style={{ backgroundColor: FINTECH_MINT }}>
                {editingId ? 'Сохранить' : 'Создать тариф'}
              </Button>
              {editingId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null)
                    setDraft(emptyPricingProfile)
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
          <CardTitle className="text-lg" style={{ color: FINTECH_NAVY }}>
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
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: FINTECH_NAVY }}>
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
            style={{ borderColor: FINTECH_MINT, color: FINTECH_NAVY }}
          >
            {reconLoading ? 'Считаем…' : 'Запустить сверку сейчас'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
