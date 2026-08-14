'use client'

/**
 * Payment protection help — Stage 201.31: MarketingDocChrome + getUIText i18n.
 */

import { Shield } from 'lucide-react'

import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'
import { MarketingDocChrome } from '@/components/marketing/MarketingDocChrome'

export default function EscrowProtectionHelpPage() {
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
  const brand = getSiteDisplayName()

  return (
    <MarketingDocChrome
      eyebrow={
        <>
          <Shield className="h-3 w-3" aria-hidden />
          {brand}
        </>
      }
      title={t('escrowProtection_title')}
      lead={t('escrowProtection_lead')}
      contentClassName="max-w-2xl"
    >
      <div
        className={cn(
          MOBILE_FLAT_CARD_CLASS,
          'max-sm:py-2 sm:border-brand/20 sm:bg-brand/5 sm:p-6',
        )}
      >
        <ul className="space-y-3 text-sm leading-relaxed text-slate-800 sm:text-base">
          <li className="flex gap-2 break-words">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            <span>{t('escrowProtection_bullet1')}</span>
          </li>
          <li className="flex gap-2 break-words">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            <span>{t('escrowProtection_bullet2')}</span>
          </li>
          <li className="flex gap-2 break-words">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            <span>{t('escrowProtection_bullet3')}</span>
          </li>
        </ul>
        <p className="mt-6 border-t border-brand/20 pt-4 text-sm leading-relaxed text-slate-600 sm:text-base break-words">
          {t('escrowProtection_footer')}
        </p>
      </div>
    </MarketingDocChrome>
  )
}
