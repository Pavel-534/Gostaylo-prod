'use client'

/**
 * Partner-facing education: two-way calendar sync (Airbnb-style).
 * Used in listing wizard + master calendar page.
 */

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { CalendarSync, ArrowRight, CheckCircle2, Link2, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PartnerCalendarEducationCard({
  variant = 'wizard',
  className = '',
  /** Транспорт: без промо OTA/iCal — только ручная занятость */
  manualCalendarOnly = false,
}) {
  const { language } = useI18n()
  const tr = (k) => getUIText(k, language)

  if (manualCalendarOnly) {
    return (
      <Card className={cn('border-slate-200 bg-slate-50/80', className)}>
        <CardContent className="p-4 sm:p-5 space-y-2">
          <h3 className="font-semibold text-slate-900">{tr('partnerCal_eduVehicleTitle')}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{tr('partnerCal_eduVehicleBody')}</p>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'calendar-page') {
    return (
      <Card className={cn('border-teal-200 bg-gradient-to-r from-teal-50/90 to-white shadow-sm', className)}>
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex gap-3 flex-1">
            <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <CalendarSync className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-sm sm:text-base">{tr('partnerCal_bannerTitle')}</h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">{tr('partnerCal_bannerBody')}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="border-teal-300 text-teal-800 hover:bg-teal-50 shrink-0">
            <Link href="/partner/listings">
              {tr('partnerCal_bannerCta')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // wizard — shown while creating listing (before listing id exists)
  return (
    <Card className={cn('border-slate-200 bg-slate-50/80', className)}>
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <CalendarSync className="h-6 w-6 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-slate-900">{tr('partnerCal_eduWizardTitle')}</h3>
            <p className="text-sm text-slate-600 mt-1">{tr('partnerCal_eduWizardIntro')}</p>
          </div>
        </div>
        <ol className="space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-semibold text-xs">1</span>
            <span className="pt-0.5 flex gap-2"><Share2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />{tr('partnerCal_eduStep1')}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-semibold text-xs">2</span>
            <span className="pt-0.5 flex gap-2"><Link2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />{tr('partnerCal_eduStep2')}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-semibold text-xs">3</span>
            <span className="pt-0.5 flex gap-2"><CheckCircle2 className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />{tr('partnerCal_eduStep3')}</span>
          </li>
        </ol>
        <p className="text-xs text-slate-500 border-t border-slate-200 pt-3">{tr('partnerCal_eduAfterPublish')}</p>
      </CardContent>
    </Card>
  )
}
