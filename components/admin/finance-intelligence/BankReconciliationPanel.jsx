'use client';

import { useCallback, useEffect, useState } from 'react';
import { HelpCircle, Landmark, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AdminTableAmount } from '@/components/admin/AdminTableAmount';
import { cn } from '@/lib/utils';

/**
 * @param {{ hint?: Record<string, unknown>, loading?: boolean }} props
 */
export function BankReconciliationPanel({ hint, loading }) {
  const [manualThb, setManualThb] = useState('');
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const glRef = Number(hint?.glReferenceThb) || 0;
  const manual = Number(String(manualThb).replace(/\s/g, '').replace(',', '.'));
  const variance =
    Number.isFinite(manual) && manual > 0 ? Math.round((manual - glRef) * 100) / 100 : null;

  const loadHistory = useCallback(async (prefillLatest = false) => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/finance/intelligence/bank-reconciliation?limit=5', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'LOAD_FAILED');
      setTableMissing(Boolean(json.data?.tableMissing));
      const rows = json.data?.rows || [];
      setHistory(rows);
      if (prefillLatest && rows[0]?.manualBalanceThb != null) {
        setManualThb(String(rows[0].manualBalanceThb));
      }
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить историю сверок');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) loadHistory(true);
  }, [loading, loadHistory]);

  const saveSnapshot = async () => {
    if (!Number.isFinite(manual) || manual <= 0) {
      toast.error('Введите положительную сумму остатка');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/finance/intelligence/bank-reconciliation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualBalanceThb: manual,
          glGuestClearingThb: glRef,
          ledgerDeltaThb: hint?.ledgerDeltaThb,
          cashAtRiskThb: hint?.cashAtRiskThb,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'SAVE_FAILED');
      toast.success('Сверка сохранена');
      await loadHistory();
    } catch (e) {
      toast.error(e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card className="h-48 animate-pulse bg-slate-100 border-0" />;
  }

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-sky-600" />
              Сверка с банком / USDT
            </CardTitle>
            <CardDescription>Остаток на счёте vs проход через GL · сохраняется в базе</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-slate-400 hover:text-slate-600 mt-0.5">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-xs">
                GL показывает сумму гостевых оплат в учёте. Ваш реальный остаток обычно ниже — разница часто
                равна деньгам партнёрам в эскроу и реферальным обязательствам.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[10px] uppercase text-slate-500">GL (гостевой clearing)</div>
          <AdminTableAmount value={glRef} showPlus={false} className="text-lg font-bold" />
          {hint?.ledgerDeltaThb != null && Math.abs(Number(hint.ledgerDeltaThb)) > 0.02 ? (
            <p className="text-xs text-amber-700 mt-1">
              Дельта распределения capture: ฿{Number(hint.ledgerDeltaThb).toLocaleString('ru-RU')}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="fi-bank-balance" className="text-xs">
              Ваш остаток (THB или эквивалент USDT)
            </Label>
            <Input
              id="fi-bank-balance"
              inputMode="decimal"
              placeholder="Например 1250000"
              value={manualThb}
              onChange={(e) => setManualThb(e.target.value)}
              className="h-9"
              disabled={tableMissing}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0"
            onClick={saveSnapshot}
            disabled={saving || tableMissing}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Сохранить
          </Button>
        </div>
        {tableMissing ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Таблица сверок ещё не создана — примените миграцию stage124_10_finance_bank_reconciliation.sql
          </p>
        ) : null}
        {variance != null ? (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              Math.abs(variance) < 500
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-950',
            )}
          >
            <span className="font-medium">Расхождение: </span>
            <AdminTableAmount value={variance} showPlus className="inline font-bold" />
            <span className="text-xs block mt-1 opacity-80">
              = ваш остаток − GL clearing. Крупный минус часто = обязательства партнёрам и рефералам.
            </span>
          </div>
        ) : null}
        {history.length > 0 ? (
          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <div className="text-[10px] uppercase text-slate-500 font-medium">Последние сверки</div>
            {historyLoading ? (
              <p className="text-xs text-slate-400">Загрузка…</p>
            ) : (
              history.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between text-xs rounded-md bg-slate-50 px-2 py-1.5"
                >
                  <span className="text-slate-500">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                  <span className="tabular-nums">
                    остаток ฿{(row.manualBalanceThb || 0).toLocaleString('ru-RU')} · Δ{' '}
                    {(row.varianceThb || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
        <p className="text-xs text-slate-500">{hint?.ownerNote}</p>
      </CardContent>
    </Card>
  );
}

export default BankReconciliationPanel;
