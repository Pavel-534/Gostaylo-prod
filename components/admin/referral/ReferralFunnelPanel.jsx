'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FinTechEmptyState } from '@/components/admin/finances/FinTechEmptyState';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
const FINTECH_NAVY = '#0f172a';
const STAGE_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#db2777'];

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

function formatChartDay(dateKey) {
  if (!dateKey) return '';
  const [, m, d] = String(dateKey).split('-');
  return `${d}.${m}`;
}

function FunnelStageBar({ stage, maxCount, color }) {
  const count = Number(stage?.count) || 0;
  const widthPct = maxCount > 0 ? Math.max(8, (count / maxCount) * 100) : 8;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{stage.label}</span>
        <span className="text-lg font-bold tabular-nums" style={{ color: FINTECH_NAVY }}>
          {count.toLocaleString('ru-RU')}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span>от пред.: {formatPct(stage.pctFromPrevious)}</span>
        <span>от кликов: {formatPct(stage.pctFromTop)}</span>
      </div>
    </div>
  );
}

export function ReferralFunnelPanel({ funnel, chartRows = [] }) {
  const stages = Array.isArray(funnel?.stages) ? funnel.stages : [];
  const byUtm = Array.isArray(funnel?.byUtm) ? funnel.byUtm : [];
  const summary = funnel?.summary || {};
  const maxStageCount = Math.max(...stages.map((s) => Number(s.count) || 0), 1);

  const chartData = (chartRows.length ? chartRows : funnel?.chartDaily || []).map((row) => ({
    ...row,
    label: formatChartDay(row.date),
  }));

  return (
    <div className="space-y-6">
      <Card className="border-violet-200/70 bg-gradient-to-br from-violet-50/50 to-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base" style={{ color: FINTECH_NAVY }}>
            Воронка 2.0 — этапы
          </CardTitle>
          <CardDescription>
            Click → регистрация → первая оплаченная бронь → повторные брони (гости с 2+ бронями)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-5">
            {stages.map((stage, i) => (
              <FunnelStageBar
                key={stage.id}
                stage={stage}
                maxCount={maxStageCount}
                color={STAGE_COLORS[i % STAGE_COLORS.length]}
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 content-start">
            {[
              ['CR клик → рег.', summary.clickToSignupPct],
              ['CR рег. → 1-я бронь', summary.signupToFirstBookingPct],
              ['Доля repeat-гостей', summary.repeatUserPct],
              ['Earned за период', summary.earnedTotalThb, 'thb'],
            ].map(([label, val, kind]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {kind === 'thb' ? (
                    <AdminTableAmount value={val} showPlus={false} className="inline text-xl font-bold" />
                  ) : (
                    formatPct(val)
                  )}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base" style={{ color: FINTECH_NAVY }}>
            Динамика воронки за период
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          {!chartData.length ? (
            <FinTechEmptyState title="Нет данных" description="Выберите период с кликами." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="clicks" name="Клики" fill="#7c3aed" opacity={0.4} barSize={6} />
                <Bar yAxisId="left" dataKey="signups" name="Регистрации" fill="#2563eb" opacity={0.5} barSize={6} />
                <Bar yAxisId="left" dataKey="firstBookings" name="1-я бронь" fill="#059669" opacity={0.55} barSize={6} />
                <Bar yAxisId="left" dataKey="repeatBookings" name="Повтор" fill="#d97706" opacity={0.5} barSize={6} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="earnedThb"
                  name="Earned ฿"
                  stroke="#db2777"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base" style={{ color: FINTECH_NAVY }}>
            Разбивка по UTM source
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          {!byUtm.length ? (
            <FinTechEmptyState title="Нет UTM" description="Клики без utm_source попадут в (none)." />
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>UTM</TableHead>
                  <TableHead className="text-right">Клики</TableHead>
                  <TableHead className="text-right">Рег.</TableHead>
                  <TableHead className="text-right">1-я бронь</TableHead>
                  <TableHead className="text-right">Повтор</TableHead>
                  <TableHead className="text-right">CR→рег.</TableHead>
                  <TableHead className="text-right">CR→бронь</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byUtm.map((row) => (
                  <TableRow key={row.utmSource}>
                    <TableCell className="font-medium">{row.utmSource}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.clicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.signups}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.firstBookings}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.repeatBookings}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(row.clickToSignupPct)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPct(row.signupToFirstBookingPct)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReferrerPersonalFunnel({ funnel }) {
  const stages = Array.isArray(funnel?.stages) ? funnel.stages : [];
  if (!stages.length) {
    return <FinTechEmptyState title="Нет воронки" description="За период нет кликов или регистраций." />;
  }
  const max = Math.max(...stages.map((s) => Number(s.count) || 0), 1);
  return (
    <div className="space-y-4">
      {stages.map((stage, i) => (
        <FunnelStageBar
          key={stage.id}
          stage={stage}
          maxCount={max}
          color={STAGE_COLORS[i % STAGE_COLORS.length]}
        />
      ))}
      <p className="text-xs text-slate-500">
        Earned за период:{' '}
        <AdminTableAmount
          value={funnel?.summary?.earnedTotalThb ?? 0}
          showPlus={false}
          className="inline font-semibold"
        />
      </p>
    </div>
  );
}
