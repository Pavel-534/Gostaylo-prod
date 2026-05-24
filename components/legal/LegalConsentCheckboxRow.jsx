'use client'

import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { getUIText } from '@/lib/translations'

/**
 * Чекбокс согласия с юр. документами.
 * @param {'full' | 'offerOnly' | 'checkout' | 'partner'} [variant]
 */
export function LegalConsentCheckboxRow({
  language,
  checked,
  onCheckedChange,
  id = 'legal-consent-checkbox',
  className = '',
  variant = 'full',
}) {
  if (variant === 'checkout' || variant === 'offerOnly') {
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
          <span>{getUIText('legalConsent_checkoutIntro', language)}</span>{' '}
          <Link
            href="/legal/public-offer/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-hover underline underline-offset-2 hover:text-brand-hover"
            onClick={(e) => e.stopPropagation()}
          >
            {getUIText('footerPublicOffer', language)}
          </Link>
          <span>{getUIText('legalConsent_checkoutMid', language)}</span>{' '}
          <Link
            href="/legal/refund/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-hover underline underline-offset-2 hover:text-brand-hover"
            onClick={(e) => e.stopPropagation()}
          >
            {getUIText('footerRefundPolicy', language)}
          </Link>
        </label>
      </div>
    )
  }

  if (variant === 'partner') {
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
          <span>{getUIText('legalConsent_partnerIntro', language)}</span>{' '}
          <Link
            href="/legal/partner-terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-hover underline underline-offset-2 hover:text-brand-hover"
            onClick={(e) => e.stopPropagation()}
          >
            {getUIText('footerPartnerTerms', language)}
          </Link>
          <span>{getUIText('legalConsent_partnerSuffix', language)}</span>
        </label>
      </div>
    )
  }

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
          className="font-medium text-brand-hover underline underline-offset-2 hover:text-brand-hover"
          onClick={(e) => e.stopPropagation()}
        >
          {getUIText('footerPublicOffer', language)}
        </Link>{' '}
        <span>{getUIText('legalConsent_and', language)}</span>{' '}
        <Link
          href="/legal/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-hover underline underline-offset-2 hover:text-brand-hover"
          onClick={(e) => e.stopPropagation()}
        >
          {getUIText('privacyPolicy', language)}
        </Link>
      </label>
    </div>
  )
}
