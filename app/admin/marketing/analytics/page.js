'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Bar,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, RefreshCw, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

function formatThb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function ymUtcNowString() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function MarketingAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [leaderboardYm, setLeaderboardYm] = useState(() => ymUtcNowString());
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  async function loadAnalytics(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/v2/admin/referral/analytics', {
        cache: 'no-store',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'REFERRAL_ANALYTICS_LOAD_FAILED');
      }
      setData(json.data || null);
    } catch (error) {
      toast.error(error?.message || 'Failed to load referral analytics');
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
    const timer = setInterval(() => {
      void loadAnalytics(true);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLeaderboardLoading(true);
      try {
        const [y, m] = leaderboardYm.split('-').map((x) => Number.parseInt(x, 10));
        const res = await fetch(
          `/api/v2/admin/referral/leaderboard?year=${y}&month=${m}&limit=25`,
          { credentials: 'include', cache: 'no-store' },
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json?.success) setLeaderboardData(json.data || null);
        else setLeaderboardData(null);
      } catch {
        if (!cancelled) setLeaderboardData(null);
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leaderboardYm]);

  const funnelMax = useMemo(() => {
    const funnel = data?.conversionFunnel;
    if (!funnel) return 1;
    return Math.max(
      1,
      Number(funnel.invitations || 0),
      Number(funnel.registrations || 0),
      Number(funnel.firstBookings || 0),
      Number(funnel.partnerActivations || 0),
    );
  }, [data]);

  const efficiencyStatus = String(data?.roi?.efficiencyStatus || '');
  const isLowEfficiency = efficiencyStatus === 'LOW_EFFICIENCY';

  const cohortChartRows = useMemo(() => {
    const cohorts = data?.cohortRoi?.cohorts || [];
    const chronological = [...cohorts].reverse();
    return chronological.map((c) => ({
      cohortMonth: c.cohortMonth,
      bonusCostThb: Number(c.bonusCostThb) || 0,
      commissionM0: Number(c.cumulativeCommissionThb?.M0) || 0,
      commissionM1: Number(c.cumulativeCommissionThb?.M1) || 0,
      commissionM3: Number(c.cumulativeCommissionThb?.M3) || 0,
      commissionM6: Number(c.cumulativeCommissionThb?.M6) || 0,
      referees: Number(c.refereeCount) || 0,
    }));
  }, [data?.cohortRoi]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/admin/marketing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to marketing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">ROI & referral analytics</h1>
          <p className="text-sm text-slate-600 mt-1">
            LTV vs acquisition cost, efficiency index, conversion funnel and ambassador tiers.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadAnalytics(true)} disabled={refreshing || loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${(refreshing || loading) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">Loading analytics...</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-500">Referral LTV (commission)</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-emerald-700">
                {formatThb(data?.roi?.ltvFromCommissionThb)} THB
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-500">Cost of acquisition (bonuses)</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-rose-700">
                {formatThb(data?.roi?.acquisitionCostThb)} THB
              </CardContent>
            </Card>
            <Card className={isLowEfficiency ? 'border-rose-300 bg-rose-50/70' : 'border-emerald-200 bg-emerald-50/60'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-500">Efficiency index (LTV / Cost)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                {isLowEfficiency ? (
                  <TrendingDown className="h-5 w-5 text-rose-700" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-emerald-700" />
                )}
                <div className="text-xl font-semibold">
                  {Number.isFinite(Number(data?.roi?.efficiencyIndex))
                    ? Number(data?.roi?.efficiencyIndex).toFixed(2)
                    : 'n/a'}
                </div>
                <Badge variant={isLowEfficiency ? 'destructive' : 'outline'}>
                  {isLowEfficiency ? 'Low Efficiency' : efficiencyStatus || 'Healthy'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card className="border-violet-200 bg-violet-50/40">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-violet-700" />
                  Global referral leaderboard (UTC)
                </CardTitle>
                <CardDescription>
                  Full names, admin profile links; calendar month in UTC (company SSOT). Differs from user-facing
                  leaderboard (masked, user timezone).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs text-slate-600" htmlFor="admin-lb-month">
                  Month (UTC)
                </label>
                <input
                  id="admin-lb-month"
                  type="month"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums"
                  value={leaderboardYm}
                  onChange={(e) => setLeaderboardYm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {leaderboardLoading ? (
                <p className="text-sm text-slate-500">Loading leaderboard…</p>
              ) : leaderboardData?.rows?.length ? (
                <>
                  <p className="text-xs text-slate-600 mb-3 tabular-nums">
                    Period (UTC): {leaderboardData.periodStartDdMmYyyy} — {leaderboardData.periodEndDdMmYyyy}
                  </p>
                  <div className="rounded-md border bg-white overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-left">
                          <th className="p-2 font-medium">#</th>
                          <th className="p-2 font-medium">Referrer</th>
                          <th className="p-2 font-medium">Earned THB</th>
                          <th className="p-2 font-medium">Admin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardData.rows.map((row) => (
                          <tr key={row.referrerId} className="border-b border-slate-100">
                            <td className="p-2 tabular-nums">{row.rank}</td>
                            <td className="p-2 font-medium">{row.displayNameFull}</td>
                            <td className="p-2 tabular-nums">{formatThb(row.amountThb)}</td>
                            <td className="p-2">
                              <Link
                                href={row.adminProfileUrl}
                                className="text-violet-700 underline font-medium hover:text-violet-900"
                              >
                                Profile
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">No earned referral bonuses in this UTC month.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversion funnel</CardTitle>
              <CardDescription>Invitations → Registrations → First Bookings → Partner Activations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'invitations', label: 'Invitations' },
                { key: 'registrations', label: 'Registrations' },
                { key: 'firstBookings', label: 'First Bookings' },
                { key: 'partnerActivations', label: 'Partner Activations' },
              ].map((step) => {
                const value = Number(data?.conversionFunnel?.[step.key] || 0);
                const pct = Math.round((value / funnelMax) * 100);
                return (
                  <div key={step.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{step.label}</span>
                      <span className="tabular-nums">{value.toLocaleString('ru-RU')}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cohort ROI (by signup month)</CardTitle>
              <CardDescription>
                Bonus spend vs cumulative guest commission (completed bookings) in windows M0–M6 after cohort anchor
                month.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cohortChartRows.length === 0 ? (
                <p className="text-sm text-slate-500">No referral cohorts in the last 36 months.</p>
              ) : (
                <>
                  <div className="h-[340px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={cohortChartRows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                        <XAxis dataKey="cohortMonth" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatThb(v)} />
                        <Tooltip
                          formatter={(value, name) => [formatThb(value), name]}
                          labelFormatter={(label) => `Cohort ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="bonusCostThb" name="Bonus cost (THB)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Line
                          type="monotone"
                          dataKey="commissionM0"
                          name="Commission M0"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="commissionM1"
                          name="Commission M1"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="commissionM3"
                          name="Commission M3"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="commissionM6"
                          name="Commission M6"
                          stroke="#059669"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-md border text-xs overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="p-2 font-medium">Cohort</th>
                          <th className="p-2 font-medium">Referees</th>
                          <th className="p-2 font-medium">Bonus cost</th>
                          <th className="p-2 font-medium">M0</th>
                          <th className="p-2 font-medium">M1</th>
                          <th className="p-2 font-medium">M3</th>
                          <th className="p-2 font-medium">M6</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...cohortChartRows].reverse().map((row) => (
                          <tr key={row.cohortMonth} className="border-b border-slate-100">
                            <td className="p-2 tabular-nums">{row.cohortMonth}</td>
                            <td className="p-2 tabular-nums">{row.referees}</td>
                            <td className="p-2 tabular-nums">{formatThb(row.bonusCostThb)}</td>
                            <td className="p-2 tabular-nums">{formatThb(row.commissionM0)}</td>
                            <td className="p-2 tabular-nums">{formatThb(row.commissionM1)}</td>
                            <td className="p-2 tabular-nums">{formatThb(row.commissionM3)}</td>
                            <td className="p-2 tabular-nums">{formatThb(row.commissionM6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ambassador tiers snapshot</CardTitle>
              <CardDescription>Configured payout tiers and current distribution in network.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.tiers || []).map((tier) => (
                <div key={tier.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{tier.name}</p>
                    <Badge variant="outline">{Number(tier.payoutRatio || 0)}% withdrawable</Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Threshold: {Number(tier.minPartnersInvited || 0)} partners · {tier.description || ''}
                  </p>
                </div>
              ))}
              {(data?.byTier || []).length > 0 ? (
                <div className="rounded-md border p-3 text-sm">
                  {(data.byTier || []).map((item) => (
                    <p key={item.tierName} className="text-slate-700">
                      {item.tierName}: {Number(item.referrersCount || 0)} referrers / {Number(item.invitations || 0)} invitations
                    </p>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-slate-500">
                Updated: {data?.realtimeUpdatedAt ? new Date(data.realtimeUpdatedAt).toLocaleString('ru-RU') : 'n/a'}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
