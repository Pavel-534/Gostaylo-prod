import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const CAMPAIGN_STATUS_META = {
  active: {
    label: 'Работает',
    hint: 'Кампания активна, override hold применяется',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  paused: {
    label: 'Пауза',
    hint: 'Вручную приостановлена',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  expired: {
    label: 'Срок истёк',
    hint: 'Дата окончания прошла',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-950 border-amber-300',
  },
  budget_exhausted: {
    label: 'Бюджет 100%',
    hint: 'Лимит исчерпан, кампания на паузе',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-950 border-rose-300',
  },
};

export function CampaignBudgetUsageBadge({ budgetAlertLevel, budgetUsagePct, className }) {
  if (!budgetAlertLevel || budgetAlertLevel === 'ok') return null;
  const isCritical = budgetAlertLevel === 'critical';
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium tabular-nums',
        isCritical
          ? 'bg-rose-100/80 text-rose-900 border-rose-300'
          : 'bg-amber-100/80 text-amber-900 border-amber-300',
        className,
      )}
    >
      {budgetUsagePct != null ? `${budgetUsagePct}%` : '≥90%'}
    </Badge>
  );
}

export function CampaignStatusBadge({ status, showDot = true, className, title }) {
  const meta = CAMPAIGN_STATUS_META[status] || CAMPAIGN_STATUS_META.paused;
  return (
    <Badge
      variant="outline"
      title={title || meta.hint}
      className={cn('gap-1.5 font-medium', meta.badgeClass, className)}
    >
      {showDot ? <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dotClass)} aria-hidden /> : null}
      {meta.label}
    </Badge>
  );
}
