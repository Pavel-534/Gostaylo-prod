'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Landmark,
  Mail,
  Megaphone,
  Route,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { REFERRAL_ROI_OWNER_GUIDE } from '@/lib/analytics/owner/referral-roi-owner-guide';

/**
 * Stage 124.16 — «Как пользоваться аналитикой» на ROI-пульте.
 */
export function RoiOwnerGuideCard() {
  const guide = REFERRAL_ROI_OWNER_GUIDE;

  return (
    <Card
      id="owner-guide"
      className="border-indigo-200/90 shadow-md scroll-mt-24 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-indigo-950 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              Как пользоваться аналитикой
            </CardTitle>
            <CardDescription className="text-indigo-900/70 mt-1 max-w-2xl">
              {guide.subtitle}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="border-indigo-200 bg-white/80">
              <Link href={guide.routes.fi}>
                <Landmark className="h-4 w-4 mr-1" />
                Financial Intelligence
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-indigo-200 bg-white/80">
              <Link href={guide.routes.fraudQueue}>
                <ShieldAlert className="h-4 w-4 mr-1" />
                Фрод-очередь
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
            <Route className="h-3.5 w-3.5" />
            Цепочка от общего к деталям
          </h3>
          <ol className="space-y-2">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex gap-2 text-sm text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {guide.title}
          </h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {guide.controls.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-slate-700">
                <span className="text-emerald-600 shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-violet-100 bg-white/70 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-800 mb-2 flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            Еженедельный ритм
          </h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {guide.weekly.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Megaphone className="h-3.5 w-3.5" />
          Все экраны только для просмотра — изменение бюджетов и правил в разделах «Кампании» и «Бюджет».
          <Link href={guide.routes.budget} className="text-indigo-600 hover:underline inline-flex items-center ml-1">
            Promo tank
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default RoiOwnerGuideCard;
