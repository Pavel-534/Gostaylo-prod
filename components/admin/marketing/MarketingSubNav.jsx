'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Stage 124.0 — единая горизонтальная навигация раздела «Маркетинг». */
export const MARKETING_SUB_NAV = [
  { href: '/admin/marketing', label: 'Обзор', exact: true },
  { href: '/admin/marketing/campaigns', label: 'Кампании' },
  { href: '/admin/marketing/reward-rules', label: 'A/B правила' },
  { href: '/admin/marketing/settings', label: 'Настройки' },
  { href: '/admin/marketing/fraud-queue', label: 'Fraud Queue' },
  { href: '/admin/marketing/attribution', label: 'Аналитика' },
  { href: '/admin/marketing/budget', label: 'Бюджет и аудит' },
  { href: '/admin/marketing/promos', label: 'Промокоды' },
];

const BUDGET_HUB_PREFIXES = [
  '/admin/marketing/budget',
  '/admin/marketing/wallet-audit',
  '/admin/marketing/audit',
  '/admin/marketing/payouts',
  '/admin/marketing/analytics',
];

function isActive(pathname, href, exact) {
  const p = String(pathname || '').replace(/\/+$/, '');
  const h = String(href || '').replace(/\/+$/, '');
  if (h === '/admin/marketing/budget') {
    return BUDGET_HUB_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
  }
  if (exact) return p === h;
  return p === h || p.startsWith(`${h}/`);
}

export function MarketingSubNav({ className }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm',
        className,
      )}
      aria-label="Маркетинг"
    >
      {MARKETING_SUB_NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-brand text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
