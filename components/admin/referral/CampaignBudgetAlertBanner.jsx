import { AlertTriangle, Octagon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CampaignBudgetAlertBanner({ campaign, className }) {
  const level = campaign?.budgetAlertLevel;
  if (!level || level === 'ok') return null;

  const isCritical = level === 'critical' || campaign?.status === 'budget_exhausted';
  const pct = campaign?.budgetUsagePct;

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm flex gap-3 items-start',
        isCritical
          ? 'border-rose-300 bg-rose-50 text-rose-950'
          : 'border-amber-300 bg-amber-50 text-amber-950',
        className,
      )}
      role="alert"
    >
      {isCritical ? (
        <Octagon className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
      )}
      <div>
        {isCritical ? (
          <>
            <p className="font-semibold">Бюджет исчерпан — кампания на паузе</p>
            <p className="mt-1 text-rose-900/85">
              Потрачено {Number(campaign?.spentThb || 0).toLocaleString('ru-RU')} ฿
              {campaign?.maxBudgetThb != null
                ? ` из ${Number(campaign.maxBudgetThb).toLocaleString('ru-RU')} ฿`
                : ''}
              . Новые override hold не применяются. Пополните бюджет или активируйте вручную.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">Бюджет почти исчерпан ({pct != null ? `${pct}%` : '≥90%'})</p>
            <p className="mt-1 text-amber-900/85">
              Остаток:{' '}
              {campaign?.remainingBudgetThb != null
                ? `${Number(campaign.remainingBudgetThb).toLocaleString('ru-RU')} ฿`
                : '—'}
              . При 100% кампания автоматически уйдёт на паузу, админам придёт Telegram-алерт.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
