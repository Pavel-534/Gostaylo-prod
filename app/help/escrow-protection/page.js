'use client'

/**
 * Публичная справка: защита средств (эскроу) — мультиязычно через getUIText.
 */

import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

export default function EscrowProtectionHelpPage() {
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <Link
        href="/messages"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="break-words">{t('escrowProtection_backToMessages')}</span>
      </Link>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 sm:p-6">
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
