'use client';

import Link from 'next/link';
import { ArrowRight, Layers, Ticket, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const HUB_ITEMS = [
  {
    href: '/admin/marketing/settings',
    title: 'Бюджет и бонусы',
    description: 'Promo tank, hold, доли, welcome bonus, safety gates.',
    icon: Layers,
  },
  {
    href: '/admin/marketing/wallet-audit',
    title: 'Wallet Audit Trail',
    description: 'Журнал wallet_transactions с email пользователя.',
    icon: Wallet,
  },
  {
    href: '/admin/marketing/audit',
    title: 'Promo Tank Audit',
    description: 'История движений marketing_promo_tank_ledger.',
    icon: Layers,
  },
  {
    href: '/admin/marketing/referral-payouts',
    title: 'Referral Payouts',
    description: 'Очередь выплат и verified_for_payout.',
    icon: Ticket,
  },
  {
    href: '/admin/marketing/analytics',
    title: 'ROI & когорты',
    description: 'Ambassador tiers, funnel invitations, cohort ROI.',
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
            <Link key={item.href} href={item.href}>
              <Card className="h-full border-slate-200 shadow-sm transition-shadow hover:shadow-md hover:border-brand/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 text-brand" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
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
