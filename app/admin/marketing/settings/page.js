'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function pct(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export default function MarketingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [form, setForm] = useState({
    referralReinvestmentPercent: 70,
    acquiringFeePercent: 0,
    operationalReservePercent: 0,
    partnerActivationBonus: 500,
    mlmLevel1Percent: 70,
    mlmLevel2Percent: 30,
    payoutToInternalRatio: 70,
  });
  const [lastBudget, setLastBudget] = useState(null);
  const [payoutStats, setPayoutStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [res, statsRes] = await Promise.all([
          fetch('/api/admin/settings', { cache: 'no-store' }),
          fetch('/api/v2/admin/referral/payout-stats', { cache: 'no-store', credentials: 'include' }),
        ]);
        const json = await res.json().catch(() => ({}));
        const statsJson = await statsRes.json().catch(() => ({}));
        if (!res.ok || !json?.data) throw new Error(json?.error || 'LOAD_FAILED');
        if (cancelled) return;
        const s = json.data;
        setSnapshot(s);
        setForm({
          referralReinvestmentPercent: clamp(
            s.referralReinvestmentPercent ?? s.referral_reinvestment_percent ?? 70,
            0,
            95,
          ),
          acquiringFeePercent: clamp(s.acquiringFeePercent ?? s.acquiring_fee_percent ?? 0, 0, 100),
          operationalReservePercent: clamp(
            s.operationalReservePercent ?? s.operational_reserve_percent ?? 0,
            0,
            100,
          ),
          partnerActivationBonus: clamp(
            s.partnerActivationBonus ?? s.partner_activation_bonus ?? 500,
            0,
            1_000_000_000,
          ),
          mlmLevel1Percent: clamp(s.mlmLevel1Percent ?? s.mlm_level1_percent ?? 70, 0, 100),
          mlmLevel2Percent: clamp(s.mlmLevel2Percent ?? s.mlm_level2_percent ?? 30, 0, 100),
          payoutToInternalRatio: clamp(
            s.payoutToInternalRatio ?? s.payout_to_internal_ratio ?? 70,
            0,
            100,
          ),
        });
        setLastBudget(s.referralSafetyBudget || null);
        if (statsRes.ok && statsJson?.success) {
          setPayoutStats(statsJson?.data || null);
        }
      } catch (error) {
        if (!cancelled) toast.error(error?.message || 'Failed to load marketing settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const mlmTotalPercent = useMemo(
    () => clamp(form.mlmLevel1Percent, 0, 100) + clamp(form.mlmLevel2Percent, 0, 100),
    [form.mlmLevel1Percent, form.mlmLevel2Percent],
  );

  async function handleSave() {
    if (!snapshot) return;
    setSaving(true);
    try {
      const payload = {
        ...snapshot,
        referralReinvestmentPercent: clamp(form.referralReinvestmentPercent, 0, 95),
        acquiringFeePercent: clamp(form.acquiringFeePercent, 0, 100),
        operationalReservePercent: clamp(form.operationalReservePercent, 0, 100),
        partnerActivationBonus: clamp(form.partnerActivationBonus, 0, 1_000_000_000),
        mlmLevel1Percent: clamp(form.mlmLevel1Percent, 0, 100),
        mlmLevel2Percent: clamp(form.mlmLevel2Percent, 0, 100),
        payoutToInternalRatio: clamp(form.payoutToInternalRatio, 0, 100),
        referral_reinvestment_percent: clamp(form.referralReinvestmentPercent, 0, 95),
        acquiring_fee_percent: clamp(form.acquiringFeePercent, 0, 100),
        operational_reserve_percent: clamp(form.operationalReservePercent, 0, 100),
        partner_activation_bonus: clamp(form.partnerActivationBonus, 0, 1_000_000_000),
        mlm_level1_percent: clamp(form.mlmLevel1Percent, 0, 100),
        mlm_level2_percent: clamp(form.mlmLevel2Percent, 0, 100),
        payout_to_internal_ratio: clamp(form.payoutToInternalRatio, 0, 100),
      };
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const details = Array.isArray(json?.details) ? json.details.join(' ') : '';
        throw new Error(details || json?.error || 'SAVE_FAILED');
      }
      setSnapshot(json?.data || payload);
      setLastBudget(json?.budget || null);
      toast.success('Marketing safety settings saved');
    } catch (error) {
      toast.error(error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading marketing safety settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/admin/marketing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to marketing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Marketing safety settings</h1>
          <p className="text-sm text-slate-600 mt-1">
            Stage 72.3: partner activation bonus, MLM depth split, margin safety gate.
          </p>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral engine</CardTitle>
          <CardDescription>Core payout settings and supply-side activation policy.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="referralReinvestmentPercent">Referral reinvestment %</Label>
            <Input
              id="referralReinvestmentPercent"
              type="number"
              min={0}
              max={95}
              step={0.1}
              value={form.referralReinvestmentPercent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  referralReinvestmentPercent: clamp(e.target.value, 0, 95),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partnerActivationBonus">Partner activation bonus (THB)</Label>
            <Input
              id="partnerActivationBonus"
              type="number"
              min={0}
              step={1}
              value={form.partnerActivationBonus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  partnerActivationBonus: clamp(e.target.value, 0, 1_000_000_000),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mlmLevel1Percent">MLM level 1 %</Label>
            <Input
              id="mlmLevel1Percent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.mlmLevel1Percent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  mlmLevel1Percent: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mlmLevel2Percent">MLM level 2 %</Label>
            <Input
              id="mlmLevel2Percent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.mlmLevel2Percent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  mlmLevel2Percent: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payoutToInternalRatio">Payout to internal ratio %</Label>
            <Input
              id="payoutToInternalRatio"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.payoutToInternalRatio}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  payoutToInternalRatio: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variable costs</CardTitle>
          <CardDescription>Used by server-side safety gate for margin validation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="acquiringFeePercent">Acquiring fee %</Label>
            <Input
              id="acquiringFeePercent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.acquiringFeePercent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  acquiringFeePercent: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operationalReservePercent">Operational reserve %</Label>
            <Input
              id="operationalReservePercent"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.operationalReservePercent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  operationalReservePercent: clamp(e.target.value, 0, 100),
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className={mlmTotalPercent > 100 ? 'border-red-300' : 'border-emerald-300'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className={`h-4 w-4 ${mlmTotalPercent > 100 ? 'text-red-600' : 'text-emerald-600'}`} />
            Safety gate preview
          </CardTitle>
          <CardDescription>
            Save is blocked if MLM split is above 100% or if payouts + costs exceed platform margin.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-1">
          <p>MLM levels total: <strong>{pct(mlmTotalPercent)}</strong></p>
          {lastBudget ? (
            <>
              <p>Platform margin: <strong>{pct(lastBudget.platformMarginPercent)}</strong></p>
              <p>Fixed costs: <strong>{pct(lastBudget.fixedCostPercent)}</strong></p>
              <p>Projected referral payouts: <strong>{pct(lastBudget.projectedReferralPercent)}</strong></p>
              <p>Projected total burn: <strong>{pct(lastBudget.projectedTotalBurnPercent)}</strong></p>
            </>
          ) : (
            <p>Budget snapshot will appear after first successful save.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Total paid out</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.totalPaidOutThb || 0).toLocaleString('ru-RU')} THB
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Promo tank balance</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.currentPromoTankBalanceThb || 0).toLocaleString('ru-RU')} THB
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Forecast debits</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {Number(payoutStats?.forecastDebitNext10HostActivationsThb || 0).toLocaleString('ru-RU')} THB
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

