'use client';

import Link from 'next/link';
import { ArrowRight, Layers, Ticket, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas';
import { cn } from '@/lib/utils';

const HUB_ITEMS = [
  {
    href: '/admin/marketing/budget/launch-planner',
    title: 'Планировщик запуска',
    description: 'Сценарии: чек, доля в рефералку 30–80%, потолок 1M, turbo и promo tank.',
    icon: Layers,
  },
  {
    href: '/admin/marketing/settings',
    title: 'Бюджет и бонусы',
    description: 'Promo tank, hold, доли, welcome-бонус, защитные ограничения.',
    icon: Layers,
  },
  {
    href: '/admin/marketing/wallet-audit',
    title: 'Журнал кошелька',
    description: 'История wallet_transactions с email пользователя.',
    icon: Wallet,
  },
  {
    href: '/admin/marketing/audit',
    title: 'Аудит promo tank',
    description: 'История движений marketing_promo_tank_ledger.',
    icon: Layers,
  },
  {
    href: '/admin/marketing/referral-payouts',
    title: 'Реферальные выплаты',
    description: 'Очередь выплат и статус verified_for_payout.',
    icon: Ticket,
  },
  {
    href: '/admin/marketing/analytics',
    title: 'ROI и когорты',
    description: 'Ambassador tiers, воронка приглашений, ROI по когортам.',
    icon: Layers,
  },
];

export default function MarketingBudgetHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Бюджет и аудит</h1>
        <p className="mt-1 text-sm text-slate-600">
          Финансовые настройки рефералки, журналы и выплаты — в одном месте.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {HUB_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="block min-h-[44px]">
              <Card
                className={cn(
                  MOBILE_FLAT_CARD_CLASS,
                  'h-full transition-shadow max-sm:border-b max-sm:border-slate-100 max-sm:py-3 sm:border-slate-200 sm:shadow-sm hover:sm:border-brand/30 hover:sm:shadow-md',
                )}
              >
                <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 text-brand" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
                  <span className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-brand">
                    Открыть
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
