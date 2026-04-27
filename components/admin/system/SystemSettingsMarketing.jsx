'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Megaphone, Percent, Users, Fuel, Rocket, Wallet2 } from 'lucide-react'
import { toast } from 'sonner'

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function formatThb(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

export function SystemSettingsMarketing() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settingsSnapshot, setSettingsSnapshot] = useState(null)
  const [reinvestmentPercent, setReinvestmentPercent] = useState(70)
  const [referrerSharePercent, setReferrerSharePercent] = useState(50)
  const [acquiringFeePercent, setAcquiringFeePercent] = useState(0)
  const [operationalReservePercent, setOperationalReservePercent] = useState(0)
  const [organicToPromoPotPercent, setOrganicToPromoPotPercent] = useState(0)
  const [promoBoostPerBooking, setPromoBoostPerBooking] = useState(0)
  const [promoTurboModeEnabled, setPromoTurboModeEnabled] = useState(false)
  const [manualTopupThb, setManualTopupThb] = useState(1000)
  const [toppingUp, setToppingUp] = useState(false)
  const [monitor, setMonitor] = useState(null)
  const [referralBoostAllocationRule, setReferralBoostAllocationRule] = useState('split_50_50')
  const [welcomeBonusAmount, setWelcomeBonusAmount] = useState(0)
  const [walletMaxDiscountPercent, setWalletMaxDiscountPercent] = useState(30)
  const [walletMinPayoutThb, setWalletMinPayoutThb] = useState(1000)
  const [partnerActivationBonus, setPartnerActivationBonus] = useState(500)
  const [mlmLevel1Percent, setMlmLevel1Percent] = useState(70)
  const [mlmLevel2Percent, setMlmLevel2Percent] = useState(30)
  const [payoutToInternalRatio, setPayoutToInternalRatio] = useState(70)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [settingsRes, monitorRes] = await Promise.all([
          fetch('/api/admin/settings', { cache: 'no-store' }),
          fetch('/api/v2/admin/referral/pnl-monitor', { credentials: 'include', cache: 'no-store' }),
        ])
        const settingsJson = await settingsRes.json().catch(() => ({}))
        const monitorJson = await monitorRes.json().catch(() => ({}))
        if (cancelled) return

        if (settingsRes.ok && settingsJson?.data) {
          const s = settingsJson.data
          setSettingsSnapshot(s)
          const rp = clamp(s.referralReinvestmentPercent ?? s.referral_reinvestment_percent ?? 70, 0, 95)
          const splitRatio = clamp(s.referralSplitRatio ?? s.referral_split_ratio ?? 0.5, 0, 1)
          const acquiring = clamp(s.acquiringFeePercent ?? s.acquiring_fee_percent ?? 0, 0, 100)
          const operational = clamp(
            s.operationalReservePercent ?? s.operational_reserve_percent ?? 0,
            0,
            100,
          )
          setReinvestmentPercent(rp)
          setReferrerSharePercent(Math.round(splitRatio * 10000) / 100)
          setAcquiringFeePercent(acquiring)
          setOperationalReservePercent(operational)
          setOrganicToPromoPotPercent(clamp(s.organicToPromoPotPercent ?? s.organic_to_promo_pot_percent ?? 0, 0, 100))
          setPromoBoostPerBooking(clamp(s.promoBoostPerBooking ?? s.promo_boost_per_booking ?? 0, 0, 1000000))
          setPromoTurboModeEnabled(
            s.promoTurboModeEnabled === true || s.promo_turbo_mode_enabled === true,
          )
          setReferralBoostAllocationRule(
            String(s.referralBoostAllocationRule ?? s.referral_boost_allocation_rule ?? 'split_50_50'),
          )
          setWelcomeBonusAmount(clamp(s.welcomeBonusAmount ?? s.welcome_bonus_amount ?? 0, 0, 1000000))
          setWalletMaxDiscountPercent(
            clamp(s.walletMaxDiscountPercent ?? s.wallet_max_discount_percent ?? 30, 0, 100),
          )
          setWalletMinPayoutThb(clamp(s.walletMinPayoutThb ?? s.wallet_min_payout_thb ?? 1000, 0, 1000000))
          setPartnerActivationBonus(
            clamp(s.partnerActivationBonus ?? s.partner_activation_bonus ?? 500, 0, 1000000000),
          )
          setMlmLevel1Percent(clamp(s.mlmLevel1Percent ?? s.mlm_level1_percent ?? 70, 0, 100))
          setMlmLevel2Percent(clamp(s.mlmLevel2Percent ?? s.mlm_level2_percent ?? 30, 0, 100))
          setPayoutToInternalRatio(
            clamp(s.payoutToInternalRatio ?? s.payout_to_internal_ratio ?? 70, 0, 100),
          )
        } else {
          toast.error('Не удалось загрузить настройки маркетинга')
        }

        if (monitorRes.ok && monitorJson?.success) {
          setMonitor(monitorJson.data || null)
        } else if (monitorRes.status !== 403 && monitorRes.status !== 401) {
          toast.error(monitorJson?.error || 'Не удалось загрузить Referral P&L Monitor')
        }
      } catch {
        if (!cancelled) toast.error('Ошибка загрузки маркетинговых настроек')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const refereeSharePercent = useMemo(
    () => Math.max(0, Math.round((100 - referrerSharePercent) * 100) / 100),
    [referrerSharePercent],
  )

  async function handleSave() {
    if (!settingsSnapshot) return
    setSaving(true)
    try {
      const referralSplitRatio = clamp(referrerSharePercent / 100, 0, 1)
      const payload = {
        ...settingsSnapshot,
        referralReinvestmentPercent: clamp(reinvestmentPercent, 0, 95),
        referralSplitRatio,
        acquiringFeePercent: clamp(acquiringFeePercent, 0, 100),
        operationalReservePercent: clamp(operationalReservePercent, 0, 100),
        organicToPromoPotPercent: clamp(organicToPromoPotPercent, 0, 100),
        promoBoostPerBooking: clamp(promoBoostPerBooking, 0, 1000000),
        promoTurboModeEnabled: promoTurboModeEnabled === true,
        referralBoostAllocationRule:
          referralBoostAllocationRule === '100_to_referrer' ||
          referralBoostAllocationRule === '100_to_referee' ||
          referralBoostAllocationRule === 'split_50_50'
            ? referralBoostAllocationRule
            : 'split_50_50',
        welcomeBonusAmount: clamp(welcomeBonusAmount, 0, 1000000),
        walletMaxDiscountPercent: clamp(walletMaxDiscountPercent, 0, 100),
        partnerActivationBonus: clamp(partnerActivationBonus, 0, 1000000000),
        mlmLevel1Percent: clamp(mlmLevel1Percent, 0, 100),
        mlmLevel2Percent: clamp(mlmLevel2Percent, 0, 100),
        payoutToInternalRatio: clamp(payoutToInternalRatio, 0, 100),
        marketingPromoPot: clamp(monitor?.marketingPromoPotThb ?? settingsSnapshot?.marketingPromoPot ?? 0, 0, 1000000000),
        referral_reinvestment_percent: clamp(reinvestmentPercent, 0, 95),
        referral_split_ratio: referralSplitRatio,
        acquiring_fee_percent: clamp(acquiringFeePercent, 0, 100),
        operational_reserve_percent: clamp(operationalReservePercent, 0, 100),
        organic_to_promo_pot_percent: clamp(organicToPromoPotPercent, 0, 100),
        promo_boost_per_booking: clamp(promoBoostPerBooking, 0, 1000000),
        promo_turbo_mode_enabled: promoTurboModeEnabled === true,
        referral_boost_allocation_rule:
          referralBoostAllocationRule === '100_to_referrer' ||
          referralBoostAllocationRule === '100_to_referee' ||
          referralBoostAllocationRule === 'split_50_50'
            ? referralBoostAllocationRule
            : 'split_50_50',
        welcome_bonus_amount: clamp(welcomeBonusAmount, 0, 1000000),
        wallet_max_discount_percent: clamp(walletMaxDiscountPercent, 0, 100),
        partner_activation_bonus: clamp(partnerActivationBonus, 0, 1000000000),
        mlm_level1_percent: clamp(mlmLevel1Percent, 0, 100),
        mlm_level2_percent: clamp(mlmLevel2Percent, 0, 100),
        payout_to_internal_ratio: clamp(payoutToInternalRatio, 0, 100),
        walletMinPayoutThb: clamp(walletMinPayoutThb, 0, 1000000),
        wallet_min_payout_thb: clamp(walletMinPayoutThb, 0, 1000000),
        marketing_promo_pot: clamp(monitor?.marketingPromoPotThb ?? settingsSnapshot?.marketingPromoPot ?? 0, 0, 1000000000),
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        const details = Array.isArray(json?.details) ? json.details.join(' ') : ''
        throw new Error(details || json?.error || 'SAVE_FAILED')
      }
      setSettingsSnapshot(json.data || payload)
      toast.success('Маркетинговые настройки сохранены')
    } catch (error) {
      toast.error(error?.message || 'Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  async function handleManualTopup() {
    const amount = clamp(manualTopupThb, 0, 1_000_000_000)
    if (amount <= 0) {
      toast.error('Сумма пополнения должна быть больше 0')
      return
    }
    setToppingUp(true)
    try {
      const res = await fetch('/api/v2/admin/referral/pnl-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'topup',
          amountThb: amount,
          note: 'Manual topup from admin cockpit',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.error || 'TOPUP_FAILED')
      setMonitor(json?.data?.monitor || monitor)
      toast.success('Маркетинговый бак пополнен')
    } catch (error) {
      toast.error(error?.message || 'Ошибка пополнения бака')
    } finally {
      setToppingUp(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500">Загрузка маркетинговых настроек...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-2 border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-white">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-fuchsia-600 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-base lg:text-lg">Referral Engine Policy</CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Доля маркетинга от NetProfitOrder и split между пригласившим и приглашенным.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-4 pt-0 lg:px-6 lg:pb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium">Marketing Reinvestment %</Label>
              <span className="text-sm font-semibold text-fuchsia-700">{reinvestmentPercent.toFixed(1)}%</span>
            </div>
            <Slider
              min={0}
              max={95}
              step={0.5}
              value={[reinvestmentPercent]}
              onValueChange={(v) => setReinvestmentPercent(clamp(v?.[0], 0, 95))}
            />
            <p className="text-xs text-slate-600">
              Safety lock в движке гарантирует: общая реферальная выплата не превышает 95% Platform Gross.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="referrerShare" className="text-sm font-medium">
                Referral Split: Referrer %
              </Label>
              <Input
                id="referrerShare"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={referrerSharePercent}
                onChange={(e) => setReferrerSharePercent(clamp(e.target.value, 0, 100))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Referral Split: Referee %</Label>
              <Input value={refereeSharePercent} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acquiringFeePercent" className="text-sm font-medium">
                Acquiring fee %
              </Label>
              <Input
                id="acquiringFeePercent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={acquiringFeePercent}
                onChange={(e) => setAcquiringFeePercent(clamp(e.target.value, 0, 100))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operationalReservePercent" className="text-sm font-medium">
                Operational reserve %
              </Label>
              <Input
                id="operationalReservePercent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={operationalReservePercent}
                onChange={(e) => setOperationalReservePercent(clamp(e.target.value, 0, 100))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="organicToPromoPotPercent" className="text-sm font-medium">
                Organic -&gt; Promo Pot %
              </Label>
              <Input
                id="organicToPromoPotPercent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={organicToPromoPotPercent}
                onChange={(e) => setOrganicToPromoPotPercent(clamp(e.target.value, 0, 100))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promoBoostPerBooking" className="text-sm font-medium">
                Promo boost per booking (THB)
              </Label>
              <Input
                id="promoBoostPerBooking"
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={promoBoostPerBooking}
                onChange={(e) => setPromoBoostPerBooking(clamp(e.target.value, 0, 1000000))}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            <p className="font-semibold mb-1">Формула пула</p>
            <p>
              `AdjustedNetProfit = PlatformGross - InsuranceReserve - AcquiringFee - OperationalReserve`.
            </p>
            <p className="mt-1">
              `ReferralPool = min(AdjustedNetProfit × Reinvestment%, PlatformGross × 95%)`, далее split:
              {' '}
              <span className="font-medium">Bonus {referrerSharePercent.toFixed(1)}%</span>
              {' '}/
              {' '}
              <span className="font-medium">Cashback {refereeSharePercent.toFixed(1)}%</span>.
            </p>
            <p className="mt-2">
              `MarketingPromoPot += OrganicNetProfit × {organicToPromoPotPercent.toFixed(1)}%` для
              завершённых нереферальных заказов.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !settingsSnapshot}
            className="bg-fuchsia-600 hover:bg-fuchsia-700"
          >
            {saving ? 'Сохранение...' : 'Сохранить маркетинговую политику'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-emerald-200">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base lg:text-lg">Referral P&L Monitor</CardTitle>
          </div>
          <CardDescription className="text-xs lg:text-sm">
            Агрегаты всех начислений из `referral_ledger`.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 lg:px-6 lg:pb-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-slate-500">Earned total</p>
              <p className="font-semibold text-emerald-700">฿{formatThb(monitor?.earnedTotalThb)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-slate-500">Pending total</p>
              <p className="font-semibold text-amber-700">฿{formatThb(monitor?.pendingTotalThb)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-slate-500">Canceled total</p>
              <p className="font-semibold text-rose-700">฿{formatThb(monitor?.canceledTotalThb)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-slate-500">Bonus earned</p>
              <p className="font-semibold">฿{formatThb(monitor?.earnedBonusThb)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-slate-500">Cashback earned</p>
              <p className="font-semibold">฿{formatThb(monitor?.earnedCashbackThb)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-slate-500">Ledger rows</p>
              <p className="font-semibold flex items-center gap-1">
                <Percent className="h-4 w-4 text-slate-400" />
                {Number(monitor?.rowsCount || 0).toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-sky-200">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-sky-600" />
            <CardTitle className="text-base lg:text-lg">Promo Tank Control</CardTitle>
          </div>
          <CardDescription className="text-xs lg:text-sm">
            Глобальный бак маркетинга для Turbo-доплат к реферальным выплатам.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 lg:px-6 lg:pb-6">
          <div className="rounded-md border p-3">
            <p className="text-slate-500 text-sm">Текущий баланс бака</p>
            <p className="text-2xl font-semibold text-sky-700">฿{formatThb(monitor?.marketingPromoPotThb)}</p>
            <p className="text-xs text-slate-500 mt-1">
              Topups: ฿{formatThb(monitor?.promoTankTopupsThb)} / Debits: ฿{formatThb(monitor?.promoTankDebitsThb)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              type="number"
              min={0}
              step={10}
              value={manualTopupThb}
              onChange={(e) => setManualTopupThb(clamp(e.target.value, 0, 1000000000))}
              placeholder="Сумма пополнения THB"
            />
            <Button
              type="button"
              onClick={handleManualTopup}
              disabled={toppingUp}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {toppingUp ? 'Пополнение...' : 'Пополнить вручную'}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                <Rocket className="h-4 w-4 text-fuchsia-600" />
                Turbo Mode
              </p>
              <p className="text-xs text-slate-500">Активирует доп. выплаты из бака по `promo_boost_per_booking`.</p>
            </div>
            <Switch checked={promoTurboModeEnabled} onCheckedChange={setPromoTurboModeEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-indigo-200">
        <CardHeader className="p-4 lg:p-6">
          <div className="flex items-center gap-2">
            <Wallet2 className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-base lg:text-lg">Wallet & Payout Policy</CardTitle>
          </div>
          <CardDescription className="text-xs lg:text-sm">
            Политики welcome-бонуса, распределения Turbo Boost и лимита скидки из кошелька.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 lg:px-6 lg:pb-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="welcomeBonusAmount" className="text-sm font-medium">
                Welcome bonus (THB)
              </Label>
              <Input
                id="welcomeBonusAmount"
                type="number"
                min={0}
                step={1}
                value={welcomeBonusAmount}
                onChange={(e) => setWelcomeBonusAmount(clamp(e.target.value, 0, 1000000))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="walletMaxDiscountPercent" className="text-sm font-medium">
                Max wallet discount %
              </Label>
              <Input
                id="walletMaxDiscountPercent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={walletMaxDiscountPercent}
                onChange={(e) => setWalletMaxDiscountPercent(clamp(e.target.value, 0, 100))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="walletMinPayoutThb" className="text-sm font-medium">
                Min balance for payout (THB)
              </Label>
              <Input
                id="walletMinPayoutThb"
                type="number"
                min={0}
                step={100}
                value={walletMinPayoutThb}
                onChange={(e) => setWalletMinPayoutThb(clamp(e.target.value, 0, 1000000))}
              />
              <p className="text-xs text-slate-500">
                Порог для UI «можно вывести» + `profiles.is_verified` + `user_wallets.verified_for_payout` (см. Stage 72.2).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="partnerActivationBonus" className="text-sm font-medium">
                Partner activation bonus (THB)
              </Label>
              <Input
                id="partnerActivationBonus"
                type="number"
                min={0}
                step={1}
                value={partnerActivationBonus}
                onChange={(e) => setPartnerActivationBonus(clamp(e.target.value, 0, 1000000000))}
              />
              <p className="text-xs text-slate-500">
                Fixed debit from marketing promo pot on first COMPLETED booking of invited host.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mlmLevel1Percent" className="text-sm font-medium">
                MLM level 1 %
              </Label>
              <Input
                id="mlmLevel1Percent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={mlmLevel1Percent}
                onChange={(e) => setMlmLevel1Percent(clamp(e.target.value, 0, 100))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mlmLevel2Percent" className="text-sm font-medium">
                MLM level 2 %
              </Label>
              <Input
                id="mlmLevel2Percent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={mlmLevel2Percent}
                onChange={(e) => setMlmLevel2Percent(clamp(e.target.value, 0, 100))}
              />
              <p className="text-xs text-slate-500">
                Stage 72.3 safety gate enforces L1 + L2 <= 100%.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payoutToInternalRatio" className="text-sm font-medium">
                Payout to internal ratio %
              </Label>
              <Input
                id="payoutToInternalRatio"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={payoutToInternalRatio}
                onChange={(e) => setPayoutToInternalRatio(clamp(e.target.value, 0, 100))}
              />
              <p className="text-xs text-slate-500">
                Пример: 70 = к выводу 70%, в internal credits 30%.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="referralBoostAllocationRule" className="text-sm font-medium">
              Turbo boost allocation
            </Label>
            <select
              id="referralBoostAllocationRule"
              value={referralBoostAllocationRule}
              onChange={(e) => setReferralBoostAllocationRule(String(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="100_to_referrer">100% to referrer</option>
              <option value="100_to_referee">100% to referee</option>
              <option value="split_50_50">Split 50/50</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-indigo-200">
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="text-base lg:text-lg">Organic vs Referral Growth</CardTitle>
          <CardDescription className="text-xs lg:text-sm">
            Динамика за последние 6 месяцев (новые пользователи).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 lg:px-6 lg:pb-6">
          {(monitor?.growthSeries || []).map((row) => {
            const organic = Number(row?.organic || 0)
            const referral = Number(row?.referral || 0)
            const total = Math.max(1, organic + referral)
            const organicW = (organic / total) * 100
            const referralW = (referral / total) * 100
            return (
              <div key={row.month} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{row.month}</span>
                  <span>
                    Organic {organic} / Referral {referral}
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-slate-100 overflow-hidden flex">
                  <div className="bg-emerald-500" style={{ width: `${organicW}%` }} />
                  <div className="bg-fuchsia-500" style={{ width: `${referralW}%` }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

