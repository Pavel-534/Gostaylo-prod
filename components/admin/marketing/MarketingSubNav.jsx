'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  LayoutDashboard,
  Megaphone,
  ShieldAlert,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Stage 124.2 — топ-навигация (6 пунктов), иконки + горизонтальный скролл на узких экранах. */
export const MARKETING_SUB_NAV = [
  { href: '/admin/marketing', label: 'Обзор', exact: true, icon: LayoutDashboard },
  { href: '/admin/marketing/campaigns', label: 'Кампании', icon: Megaphone },
  { href: '/admin/marketing/attribution', label: 'Аналитика', icon: Activity },
  { href: '/admin/marketing/rules', label: 'Правила', icon: Sparkles },
  { href: '/admin/marketing/fraud-queue', label: 'Фрод', icon: ShieldAlert },
  { href: '/admin/marketing/budget', label: 'Бюджет', icon: Wallet },
];

const BUDGET_HUB_PREFIXES = [
  '/admin/marketing/budget',
  '/admin/marketing/wallet-audit',
  '/admin/marketing/audit',
  '/admin/marketing/payouts',
  '/admin/marketing/analytics',
  '/admin/marketing/promos',
];

const RULES_HUB_PREFIXES = [
  '/admin/marketing/rules',
  '/admin/marketing/reward-rules',
  '/admin/marketing/settings',
];

function isActive(pathname, item) {
  const p = String(pathname || '').replace(/\/+$/, '');
  const h = String(item.href || '').replace(/\/+$/, '');

  if (h === '/admin/marketing/budget') {
    return BUDGET_HUB_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
  }
  if (h === '/admin/marketing/rules') {
    return RULES_HUB_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
  }
  if (item.exact) return p === h;
  return p === h || p.startsWith(`${h}/`);
}

export function MarketingSubNav({ className }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-1 shadow-sm scrollbar-thin',
        className,
      )}
      aria-label="Маркетинг и рефералка"
    >
      {MARKETING_SUB_NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.href === '/admin/marketing/rules' ? 'Правила и настройки' : item.label}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-brand text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icon className="h-4 w-4 opacity-90" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
