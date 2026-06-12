/**
 * Stage 131.0 — Ambassador 3.0 owner waterfall preview (admin-only; shows owner retained).
 */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Save, Settings2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  fetchFintechSettings,
  putFintechSettings,
  invalidateFintechConsoleBundleCache,
} from '@/lib/admin/admin-fintech-api-client'
import { AmbassadorOwnerWaterfallBar } from '@/components/admin/finances/FinTechMarginBar'
import { fmtThb } from '@/lib/admin/fintech-console-shared'

const DEFAULT_SCENARIO = { subtotalThb: 35_000, guestServiceFeePercent: 15, hostCommissionPercent: 0 }

function numInput(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

/**
 * FinTech Ambassador settings panel — SSOT editor + waterfall viz.
 */
export function FinTechAmbassadorSettingsPanel({ toast, ownerMode = false }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(null)
  const [preview, setPreview] = useState(null)
  const [version, setVersion] = useState(null)
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchFintechSettings()
    if (!res.ok) {
      toast?.({ variant: 'destructive', title: 'FinTech settings', description: res.error || 'load failed' })
      setLoading(false)
      return
    }
    setDraft({ ...res.data.settings })
    setPreview(res.data.preview)
    setVersion(res.data.version)
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const clientPreview = useMemo(() => {
    if (!draft) return preview
    const policy = {
      acquiringFeePercent: numInput(draft.acquiring_fee_percent, 4.3),
      usnProvisionPercent: numInput(draft.usn_provision_percent, 6),
      vatProvisionPercent: numInput(draft.vat_provision_percent, 5),
      reserveBankPercent: numInput(draft.reserve_bank_percent, 0.5),
      operationalReservePercent: numInput(draft.operational_reserve_percent, 0),
      safetyLockMaxShare: numInput(draft.safety_lock_max_share, 0.95),
      referralReinvestmentPercent: numInput(draft.referral_reinvestment_percent, 45),
      referralSplitRatio: numInput(draft.referral_split_ratio, 0.5),
      ambassadorGuestL2Enabled: draft.ambassador_guest_l2_enabled === true,
      ambassadorGuestPoolL1Percent: numInput(draft.ambassador_guest_pool_l1_percent, 45),
      ambassadorGuestPoolL2Percent: numInput(draft.ambassador_guest_pool_l2_percent, 12),
      ambassadorGuestPoolRefereePercent: numInput(draft.ambassador_guest_pool_referee_percent, 43),
      ambassador3WaterfallEnabled: draft.ambassador_3_waterfall_enabled !== false,
    }
    const subtotalThb = numInput(scenario.subtotalThb, 35_000)
    const guestServiceFeePercent = numInput(scenario.guestServiceFeePercent, 15)
    const guestServiceFeeThb = Math.round(subtotalThb * (guestServiceFeePercent / 100))
    const guestPaymentThb = subtotalThb + guestServiceFeeThb
    const platformGross = guestServiceFeeThb
    const ownerRevenueThb = platformGross
    const insuranceReserveThb = Math.round(platformGross * 0.005 * 100) / 100

    const acquiringFeeThb =
      Math.round(guestPaymentThb * (policy.acquiringFeePercent / 100) * 100) / 100
    const usnProvisionThb =
      Math.round(ownerRevenueThb * (policy.usnProvisionPercent / 100) * 100) / 100
    const vatProvisionThb =
      Math.round(ownerRevenueThb * (policy.vatProvisionPercent / 100) * 100) / 100
    const reserveBankThb =
      Math.round(platformGross * (policy.reserveBankPercent / 100) * 100) / 100
    const operationalReserveThb =
      Math.round(platformGross * (policy.operationalReservePercent / 100) * 100) / 100

    const adjustedNetThb = Math.max(
      0,
      ownerRevenueThb -
        insuranceReserveThb -
        acquiringFeeThb -
        usnProvisionThb -
        vatProvisionThb -
        reserveBankThb -
        operationalReserveThb,
    )
    const safetyCapThb = Math.round(platformGross * policy.safetyLockMaxShare * 100) / 100
    const referralPoolRaw = Math.round(adjustedNetThb * (policy.referralReinvestmentPercent / 100) * 100) / 100
    const referralPoolThb = Math.min(referralPoolRaw, safetyCapThb)
    const ownerRetainedThb = Math.max(0, Math.round((adjustedNetThb - referralPoolThb) * 100) / 100)

    let l1AmountThb = 0
    let l2AmountThb = 0
    let refereeAmountThb = 0
    if (policy.ambassadorGuestL2Enabled) {
      l1AmountThb = Math.round((referralPoolThb * policy.ambassadorGuestPoolL1Percent) / 100)
      l2AmountThb = Math.round((referralPoolThb * policy.ambassadorGuestPoolL2Percent) / 100)
      refereeAmountThb = Math.round(referralPoolThb - l1AmountThb - l2AmountThb)
    } else {
      l1AmountThb = Math.round(referralPoolThb * policy.referralSplitRatio)
      refereeAmountThb = Math.round(referralPoolThb - l1AmountThb)
    }

    return {
      guestPaymentThb,
      platformGrossRevenueThb: platformGross,
      netBase: {
        acquiringFeeThb,
        usnProvisionThb,
        vatProvisionThb,
        reserveBankThb,
        operationalReserveThb,
        insuranceReserveThb,
        adjustedNetThb,
        ownerRevenueThb,
      },
      caps: { referralPoolThb, ownerRetainedThb, safetyCapThb },
      split: { l1AmountThb, l2AmountThb, refereeAmountThb },
    }
  }, [draft, preview, scenario])

  async function save() {
    if (!draft || ownerMode) return
    setSaving(true)
    const res = await putFintechSettings(draft)
    setSaving(false)
    if (!res.ok) {
      toast?.({
        variant: 'destructive',
        title: 'Не сохранено',
        description: res.message || res.error || 'validation failed',
      })
      return
    }
    invalidateFintechConsoleBundleCache()
    setPreview(res.data.preview)
    setVersion(res.data.settings?.version ?? version)
    toast?.({ title: 'FinTech settings сохранены', description: `Изменено полей: ${res.data.changes?.length || 0}` })
    await load()
  }

  if (loading || !draft) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-10 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка Ambassador / FinTech SSOT…
        </CardContent>
      </Card>
    )
  }

  const pv = clientPreview || preview

  return (
    <Card className="border-indigo-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="h-5 w-5 text-indigo-600" />
              Ambassador 3.0 — FinTech SSOT
            </CardTitle>
            <CardDescription className="mt-1">
              `system_fintech_settings` · v{version ?? '—'}. Снапшот фиксируется при переходе в AWAITING_PAYMENT.
              {ownerMode ? ' Режим owner: только просмотр.' : ''}
            </CardDescription>
          </div>
          {!ownerMode && (
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            Изменения не затрагивают брони с уже сохранённым <code className="text-xs">metadata.fintech_snapshot</code>.
            Каждое сохранение — audit log + алерт в Telegram FINANCE.
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Эквайринг %" hint="0–10 · от guest payment">
            <Input
              type="number"
              step="0.1"
              min={0}
              max={10}
              disabled={ownerMode}
              value={draft.acquiring_fee_percent ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, acquiring_fee_percent: e.target.value }))}
            />
          </Field>
          <Field label="Reinvestment в pool %" hint="0–90 · ≤ safety lock">
            <Input
              type="number"
              step="0.1"
              min={0}
              max={90}
              disabled={ownerMode}
              value={draft.referral_reinvestment_percent ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, referral_reinvestment_percent: e.target.value }))}
            />
          </Field>
          <Field label="Safety lock (доля gross)" hint="0.5–1.0">
            <Input
              type="number"
              step="0.01"
              min={0.5}
              max={1}
              disabled={ownerMode}
              value={draft.safety_lock_max_share ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, safety_lock_max_share: e.target.value }))}
            />
          </Field>
          <Field label="УСН %">
            <Input
              type="number"
              step="0.1"
              disabled={ownerMode}
              value={draft.usn_provision_percent ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, usn_provision_percent: e.target.value }))}
            />
          </Field>
          <Field label="НДС %">
            <Input
              type="number"
              step="0.1"
              disabled={ownerMode}
              value={draft.vat_provision_percent ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, vat_provision_percent: e.target.value }))}
            />
          </Field>
          <Field label="Банк / прочее %">
            <Input
              type="number"
              step="0.1"
              disabled={ownerMode}
              value={draft.reserve_bank_percent ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, reserve_bank_percent: e.target.value }))}
            />
          </Field>
          <Field label="Program cap THB / мес">
            <Input
              type="number"
              step="1000"
              disabled={ownerMode}
              value={draft.referral_monthly_program_cap_thb ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, referral_monthly_program_cap_thb: e.target.value }))}
            />
          </Field>
          <Field label="Split L1 (legacy ratio)" hint="0–1 когда L2 выключен">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              disabled={ownerMode}
              value={draft.referral_split_ratio ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, referral_split_ratio: e.target.value }))}
            />
          </Field>
          <div className="flex items-center gap-3 pt-6">
            <Switch
              id="guest-l2"
              disabled={ownerMode}
              checked={draft.ambassador_guest_l2_enabled === true}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, ambassador_guest_l2_enabled: v }))}
            />
            <Label htmlFor="guest-l2" className="text-sm">
              Guest L2 (45/12/43)
            </Label>
          </div>
        </div>

        {draft.ambassador_guest_l2_enabled && (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Pool L1 %">
              <Input
                type="number"
                disabled={ownerMode}
                value={draft.ambassador_guest_pool_l1_percent ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, ambassador_guest_pool_l1_percent: e.target.value }))}
              />
            </Field>
            <Field label="Pool L2 %">
              <Input
                type="number"
                disabled={ownerMode}
                value={draft.ambassador_guest_pool_l2_percent ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, ambassador_guest_pool_l2_percent: e.target.value }))}
              />
            </Field>
            <Field label="Pool cashback %">
              <Input
                type="number"
                disabled={ownerMode}
                value={draft.ambassador_guest_pool_referee_percent ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, ambassador_guest_pool_referee_percent: e.target.value }))
                }
              />
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
          <Field label="Сценарий: субтотал THB">
            <Input
              type="number"
              value={scenario.subtotalThb}
              onChange={(e) => setScenario((s) => ({ ...s, subtotalThb: numInput(e.target.value, 35_000) }))}
            />
          </Field>
          <Field label="Guest fee %">
            <Input
              type="number"
              value={scenario.guestServiceFeePercent}
              onChange={(e) =>
                setScenario((s) => ({ ...s, guestServiceFeePercent: numInput(e.target.value, 15) }))
              }
            />
          </Field>
        </div>

        {pv ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-800">
              Водопад (gross → deductions → adjusted net → referral pool → owner retained)
            </p>
            <AmbassadorOwnerWaterfallBar
              guestPaymentThb={pv.guestPaymentThb}
              platformGrossThb={pv.platformGrossRevenueThb}
              deductions={pv.netBase}
              adjustedNetThb={pv.netBase?.adjustedNetThb}
              referralPoolThb={pv.caps?.referralPoolThb}
              ownerRetainedThb={pv.caps?.ownerRetainedThb}
              split={pv.split}
            />
            <p className="text-xs text-slate-500">
              Pool: {fmtThb(pv.caps?.referralPoolThb)} · Owner retained: {fmtThb(pv.caps?.ownerRetainedThb)} ·
              L1/L2/guest: {fmtThb(pv.split?.l1AmountThb)} / {fmtThb(pv.split?.l2AmountThb)} /{' '}
              {fmtThb(pv.split?.refereeAmountThb)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
