'use client';

import Link from 'next/link';
import { ArrowRight, Layers, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas';
import { cn } from '@/lib/utils';

const HUB_ITEMS = [
  {
    href: '/admin/marketing/reward-rules',
    title: 'A/B правила начислений',
    description: 'Production и shadow-правила: hold, split, min booking, rollout.',
    icon: Sparkles,
  },
  {
    href: '/admin/marketing/settings',
    title: 'Глобальные настройки',
    description: 'Promo tank, hold, доли L1/L2, welcome bonus, лимиты безопасности.',
    icon: Layers,
  },
];

/** Stage 124.1 — hub «Правила и настройки». */
export default function MarketingRulesHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Правила и настройки</h1>
        <p className="mt-1 text-sm text-slate-600">
          Экономика рефералки: A/B-эксперименты и глобальные параметры программы.
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
