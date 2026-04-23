'use client'

import { AlertTriangle, Sparkles, Shield, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getUIText } from '@/lib/translations'

/**
 * Partner onboarding: how reliability tiers and TOP rules map to product metrics.
 * @param {{ language?: string, snapshot?: { topBlockedByGuestReviews?: boolean } | null }} props
 */
export function SuccessGuide({ language = 'ru', snapshot = null }) {
  const t = (key) => getUIText(key, language)
  const topBlocked = Boolean(snapshot?.topBlockedByGuestReviews)

  const levels = [
    { key: 'successGuide_level1Title', body: 'successGuide_level1Body', Icon: Shield, tone: 'slate' },
    { key: 'successGuide_level2Title', body: 'successGuide_level2Body', Icon: TrendingUp, tone: 'teal' },
    { key: 'successGuide_level3Title', body: 'successGuide_level3Body', Icon: Sparkles, tone: 'emerald' },
  ]

  const rules = [
    'successGuide_ruleSla',
    'successGuide_ruleDisputes',
    'successGuide_ruleCancels',
    'successGuide_ruleReviews',
    'successGuide_ruleTopStars',
  ]

  return (
    <Card className="border-slate-200 shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          {t('successGuide_title')}
        </CardTitle>
        <CardDescription>{t('successGuide_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {topBlocked ? (
          <div
            className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950"
            role="status"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
            <p className="leading-relaxed">{t('successGuide_topBlockedBanner')}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {levels.map(({ key, body, Icon, tone }) => (
            <div
              key={key}
              className={`rounded-2xl border px-3 py-3 space-y-2 ${
                tone === 'slate'
                  ? 'border-slate-200 bg-slate-50/80'
                  : tone === 'teal'
                    ? 'border-teal-200 bg-teal-50/50'
                    : 'border-emerald-200 bg-emerald-50/50'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icon className={`h-4 w-4 shrink-0 ${tone === 'emerald' ? 'text-emerald-600' : tone === 'teal' ? 'text-teal-600' : 'text-slate-600'}`} />
                {t(key)}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{t(body)}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-3">
          <p className="text-xs font-semibold text-slate-800 mb-2">{t('successGuide_rulesHeading')}</p>
          <ul className="text-xs text-slate-600 space-y-1.5 pl-4 list-disc">
            {rules.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">{t('successGuide_ctaHealth')}</p>
      </CardContent>
    </Card>
  )
}
