'use client';

import { ArrowDown, ArrowRight, Minus } from 'lucide-react';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { cn } from '@/lib/utils';

/**
 * @param {{ report: Record<string, unknown> }} props
 */
export function BookingPlMoneyFlow({ report }) {
  const pl = report?.pl || {};
  const jurisdiction = report?.jurisdiction || {};
  const guestPay = Number(report?.guest?.guestPayableThb) || 0;
  const grossMargin = Number(pl.platformGrossMarginThb) || 0;
  const referralCost = Number(pl.referralCostThb) || 0;
  const ruFee = Number(jurisdiction.ruFeeThb) || 0;
  const kgFee = Number(jurisdiction.krFeeThb) || 0;
  const fxMarkup = Number(jurisdiction.fxMarkupThb) || 0;
  const insurance = Number(jurisdiction.insuranceReserveThb) || 0;
  const jurisdictionTotal = ruFee + kgFee + fxMarkup;
  const netMargin = Number(pl.netPlatformMarginThb) || 0;
  const netAfterAll = Number(pl.netAfterAllThb) ?? netMargin;
  const partnerPayout = Number(pl.partnerPayoutThb) || 0;

  const flowChips = [
    { label: 'Гость', value: guestPay, tone: 'bg-indigo-100 text-indigo-900' },
    { label: 'Маржа', value: grossMargin, tone: 'bg-emerald-100 text-emerald-900' },
    { label: 'RU', value: ruFee, tone: 'bg-indigo-200/80 text-indigo-950' },
    { label: 'KG', value: kgFee, tone: 'bg-violet-100 text-violet-900' },
    { label: 'FX', value: fxMarkup, tone: 'bg-amber-100 text-amber-900' },
    { label: 'Чистая', value: netAfterAll, tone: 'bg-slate-800 text-white' },
    { label: 'Партнёр', value: partnerPayout, tone: 'bg-sky-100 text-sky-900' },
  ].filter((c) => c.value > 0 || c.label === 'Гость' || c.label === 'Маржа' || c.label === 'Чистая');

  const steps = [
    {
      id: 'guest',
      title: '1. Гость заплатил',
      subtitle: 'Полная сумма к оплате (brutto)',
      value: guestPay,
      tone: 'bg-indigo-50 border-indigo-200 text-indigo-950',
      bar: 'bg-indigo-500',
      widthPct: 100,
    },
    {
      id: 'platform',
      title: '2. Доход платформы',
      subtitle: 'Сервисный сбор + комиссия хоста (settlement_v3 / снимок)',
      value: grossMargin,
      tone: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      bar: 'bg-emerald-500',
      widthPct: guestPay > 0 ? Math.min(100, (grossMargin / guestPay) * 100) : 0,
    },
  ];

  if (ruFee > 0) {
    steps.push({
      id: 'ru',
      title: '3a. Отчисление RU (~7%)',
      subtitle: 'Агентство из final_breakdown',
      value: ruFee,
      tone: 'bg-indigo-50/80 border-indigo-300 text-indigo-950',
      bar: 'bg-indigo-600',
      widthPct: grossMargin > 0 ? Math.min(100, (ruFee / grossMargin) * 100) : 0,
      deduct: true,
    });
  }
  if (kgFee > 0) {
    steps.push({
      id: 'kg',
      title: '3b. Отчисление KG (~8%)',
      subtitle: 'ИТ-услуги KG из снимка',
      value: kgFee,
      tone: 'bg-violet-50 border-violet-200 text-violet-950',
      bar: 'bg-violet-500',
      widthPct: grossMargin > 0 ? Math.min(100, (kgFee / grossMargin) * 100) : 0,
      deduct: true,
    });
  }
  if (fxMarkup > 0) {
    steps.push({
      id: 'fx',
      title: '3c. Наценка FX',
      subtitle: 'Доход KG по валютному курсу',
      value: fxMarkup,
      tone: 'bg-amber-50 border-amber-200 text-amber-950',
      bar: 'bg-amber-500',
      widthPct: grossMargin > 0 ? Math.min(100, (fxMarkup / grossMargin) * 100) : 0,
      deduct: true,
    });
  }
  if (referralCost > 0) {
    steps.push({
      id: 'referral',
      title: '4. Минус реферал',
      subtitle: 'Бонусы и удержания по программе',
      value: referralCost,
      tone: 'bg-amber-50 border-amber-200 text-amber-950',
      bar: 'bg-amber-500',
      widthPct: grossMargin > 0 ? Math.min(100, (referralCost / grossMargin) * 100) : 0,
      deduct: true,
    });
  }
  if (insurance > 0) {
    steps.push({
      id: 'insurance',
      title: 'Страховой резерв',
      subtitle: 'Из settlement_v3',
      value: insurance,
      tone: 'bg-slate-50 border-slate-200 text-slate-800',
      bar: 'bg-slate-400',
      widthPct: grossMargin > 0 ? Math.min(100, (insurance / grossMargin) * 100) : 0,
      deduct: true,
    });
  }

  steps.push({
    id: 'net',
    title: 'Итог: чистая прибыль платформы',
    subtitle:
      jurisdictionTotal > 0
        ? 'После RU/KG/FX, реферала и резерва'
        : 'После реферала (разбивка RU/KG — на v2-снимке)',
    value: netAfterAll,
    tone: 'bg-slate-900 border-slate-800 text-white',
    bar: 'bg-white/40',
    widthPct: guestPay > 0 ? Math.min(100, (netAfterAll / guestPay) * 100) : 0,
    highlight: true,
  });

  steps.push({
    id: 'partner',
    title: 'Выплата партнёру',
    subtitle: 'Netto хоста — отдельный поток, не из маржи платформы',
    value: partnerPayout,
    tone: 'bg-sky-50 border-sky-200 text-sky-950',
    bar: 'bg-sky-500',
    widthPct: guestPay > 0 ? Math.min(100, (partnerPayout / guestPay) * 100) : 0,
  });

  return (
    <div className="space-y-4">
      <div className="hidden sm:flex items-center justify-between gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-3 overflow-x-auto">
        {flowChips.map((chip, i) => (
          <div key={chip.label} className="flex items-center gap-1 shrink-0">
            <div className={cn('rounded-lg px-2 py-2 text-center min-w-[72px]', chip.tone)}>
              <div className="text-[10px] font-medium opacity-80">{chip.label}</div>
              <div className="text-xs font-bold tabular-nums">
                ฿{chip.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
              </div>
            </div>
            {i < flowChips.length - 1 ? <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" /> : null}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {steps.map((step, idx) => (
          <div key={step.id}>
            {idx > 0 ? (
              <div className="flex justify-center py-1 text-slate-300">
                {step.deduct ? <Minus className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </div>
            ) : null}
            <div
              className={cn(
                'rounded-xl border px-4 py-3 shadow-sm transition',
                step.tone,
                step.highlight && 'ring-2 ring-emerald-400/50',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={cn('text-sm font-semibold', step.highlight && 'text-white')}>
                    {step.title}
                  </div>
                  <div className={cn('text-xs mt-0.5', step.highlight ? 'text-white/70' : 'opacity-75')}>
                    {step.subtitle}
                  </div>
                </div>
                <AdminTableAmount
                  value={step.deduct ? -Math.abs(step.value) : step.value}
                  showPlus={step.deduct}
                  className={cn('text-lg font-bold', step.highlight && 'text-white')}
                />
              </div>
              <div
                className={cn(
                  'mt-2 h-1.5 rounded-full overflow-hidden',
                  step.highlight ? 'bg-white/20' : 'bg-black/5',
                )}
              >
                <div
                  className={cn('h-full rounded-full transition-all', step.bar)}
                  style={{ width: `${Math.max(4, step.widthPct)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BookingPlMoneyFlow;
