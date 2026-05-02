'use client'

import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { getUIText } from '@/lib/translations'

/**
 * Чекбокс ссылки на `/legal/public-offer` и `/legal/privacy`.
 * Переводы: `legalConsent_intro`, `legalConsent_and`, `footerPublicOffer`, `privacyPolicy`.
 */
export function LegalConsentCheckboxRow({
  language,
  checked,
  onCheckedChange,
  id = 'legal-consent-checkbox',
  className = '',
}) {
  return (
    <div className={`flex gap-3 items-start ${className}`}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-1"
        aria-required="true"
      />
      <label htmlFor={id} className="text-sm text-slate-600 leading-snug cursor-pointer select-none">
        <span>{getUIText('legalConsent_intro', language)}</span>{' '}
        <Link
          href="/legal/public-offer/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
          onClick={(e) => e.stopPropagation()}
        >
          {getUIText('footerPublicOffer', language)}
        </Link>{' '}
        <span>{getUIText('legalConsent_and', language)}</span>{' '}
        <Link
          href="/legal/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
          onClick={(e) => e.stopPropagation()}
        >
          {getUIText('privacyPolicy', language)}
        </Link>
      </label>
    </div>
  )
}
