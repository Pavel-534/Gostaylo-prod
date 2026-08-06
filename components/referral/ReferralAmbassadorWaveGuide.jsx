'use client'

import { BookOpen, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

/**
 * Stage 143.1 — краткая инструкция для первой волны амбассадоров (in-app).
 * @param {{ t: (key: string) => string }} props
 */
export function ReferralAmbassadorWaveGuide({ t }) {
  const steps = [
    t('stage1431_ambassadorGuideStep1'),
    t('stage1431_ambassadorGuideStep2'),
    t('stage1431_ambassadorGuideStep3'),
    t('stage1431_ambassadorGuideStep4'),
  ]

  return (
    <Card
      className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:border-brand/20 sm:bg-brand/5')}
      data-testid="ambassador-first-wave-guide"
    >
      <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'sm:pb-2')}>
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-brand" aria-hidden />
          {t('stage1431_ambassadorGuideTitle')}
        </CardTitle>
        <CardDescription>{t('stage1431_ambassadorGuideIntro')}</CardDescription>
      </CardHeader>
      <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
        <ol className="space-y-2.5">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand mt-0.5" aria-hidden />
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
