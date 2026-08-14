'use client'

/**
 * Публичная справка: защита средств (эскроу) — мультиязычно через getUIText.
 * Stage 201.12 — back via MarketingAppShell soft-back (fallback /help); no page-local back link.
 */

import { Shield } from 'lucide-react'

import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'

export default function EscrowProtectionHelpPage() {
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div
        className={cn(
          MOBILE_FLAT_CARD_CLASS,
          'max-sm:py-2 sm:border-sky-100 sm:bg-sky-50/60 sm:p-6',
        )}
      >
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-8 w-8 shrink-0 text-sky-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl break-words text-balance">
              {t('escrowProtection_title')}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-base break-words">
              {t('escrowProtection_lead')}
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-800 sm:text-base">
              <li className="flex gap-2 break-words">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" aria-hidden />
                <span>{t('escrowProtection_bullet1')}</span>
              </li>
              <li className="flex gap-2 break-words">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" aria-hidden />
                <span>{t('escrowProtection_bullet2')}</span>
              </li>
              <li className="flex gap-2 break-words">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" aria-hidden />
                <span>{t('escrowProtection_bullet3')}</span>
              </li>
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-slate-600 sm:text-base break-words border-t border-sky-200/80 pt-4">
              {t('escrowProtection_footer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
