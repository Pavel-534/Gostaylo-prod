'use client'

import Link from 'next/link'
import { ScrollText } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_INSET_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { MarketingDocChrome } from '@/components/marketing/MarketingDocChrome'

/**
 * Оболочка юр. страниц — тот же MarketingDocChrome, что About / Terms / Help.
 * Stage 201.31 — единый chrome; RU = binding SSOT, EN = convenience + disclaimer.
 */
export function LegalDocShell({
  eyebrow = 'Legal',
  title,
  lead,
  introBlock,
  publisher,
  disclaimer,
  children,
}) {
  const brand = getSiteDisplayName()
  const { language } = useI18n()
  const supportEmail = publisher?.email ?? getPublicSupportEmail()
  const t = (key) => getUIText(key, language)

  return (
    <MarketingDocChrome
      eyebrow={
        <>
          <ScrollText className="h-3 w-3" aria-hidden />
          {eyebrow}
          {' · '}
          {brand}
        </>
      }
      title={title}
      lead={lead}
      banner={disclaimer}
      contentClassName="max-w-3xl"
    >
      {introBlock ? (
        <div
          className={cn(
            MOBILE_FLAT_INSET_CLASS,
            'mb-8 text-[15px] leading-relaxed text-slate-700 sm:border-brand/20 sm:bg-brand/5 sm:px-5 sm:py-4',
          )}
        >
          {introBlock}
        </div>
      ) : null}

      <PublisherCard publisher={{ ...publisher, email: supportEmail }} language={language} />

      <div className="prose prose-slate mt-12 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-a:text-brand-hover prose-a:no-underline hover:prose-a:underline">
        {children}
      </div>

      <footer className="mt-16 border-t border-slate-200 pt-10 text-sm text-slate-500">
        <p>{t('legalFooter_contactIntro')} </p>
        <a
          href={`mailto:${supportEmail}`}
          className="mt-2 inline-block font-medium text-brand-hover underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/legal/public-offer/" className="text-brand-hover hover:underline">
            {t('footerPublicOffer')}
          </Link>
          <Link href="/legal/partner-terms/" className="text-brand-hover hover:underline">
            {t('footerPartnerTerms')}
          </Link>
          <Link href="/legal/privacy/" className="text-brand-hover hover:underline">
            {t('privacyPolicy')}
          </Link>
          <Link href="/legal/refund/" className="text-brand-hover hover:underline">
            {t('footerRefundPolicy')}
          </Link>
          <Link href="/terms/" className="text-slate-600 hover:text-slate-900">
            {t('terms')}
          </Link>
          <Link href="/help/" className="text-slate-600 hover:text-slate-900">
            {t('helpCenter')}
          </Link>
        </p>
      </footer>
    </MarketingDocChrome>
  )
}

const PUBLISHER_LABELS = {
  ru: {
    heading: 'Оператор платформы',
    inn: 'ИНН',
    ogrnip: 'ОГРНИП',
    address: 'Адрес',
    email: 'E-mail',
    updated: 'Последнее обновление редакции:',
  },
  en: {
    heading: 'Platform operator',
    inn: 'INN',
    ogrnip: 'OGRNIP',
    address: 'Address',
    email: 'E-mail',
    updated: 'Document last updated:',
  },
}

function PublisherCard({ publisher, language }) {
  const labels = PUBLISHER_LABELS[language] || PUBLISHER_LABELS.en
  return (
    <div
      className={cn(
        MOBILE_FLAT_CARD_CLASS,
        'mt-2 space-y-0 max-sm:border-t max-sm:border-slate-200 max-sm:pt-8 sm:p-8 sm:ring-1 sm:ring-slate-100',
      )}
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {labels.heading}
      </h2>
      <dl className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-700">
        <div>
          <dt className="sr-only">Name</dt>
          <dd className="font-medium text-slate-900">{publisher.companyName}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
          <dt className="text-slate-500">{labels.inn}</dt>
          <dd>{publisher.inn}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
          <dt className="text-slate-500">{labels.ogrnip}</dt>
          <dd>{publisher.ogrnip}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
          <dt className="text-slate-500">{labels.address}</dt>
          <dd>{publisher.address}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
          <dt className="text-slate-500">{labels.email}</dt>
          <dd>
            <a href={`mailto:${publisher.email}`} className="text-brand-hover hover:underline">
              {publisher.email}
            </a>
          </dd>
        </div>
        <div className="pt-3 text-xs text-slate-500">
          {labels.updated} {publisher.lastUpdated}
        </div>
      </dl>
    </div>
  )
}

/** EN convenience disclaimer; switching language shows binding RU. */
export function LegalTranslationDisclaimer({ onShowRussian }) {
  return (
    <div
      role="note"
      className={cn(
        MOBILE_FLAT_INSET_CLASS,
        'border border-brand/25 bg-brand/5 px-4 py-3 text-sm leading-relaxed text-slate-700 sm:rounded-2xl',
      )}
    >
      <p>
        This document is an English translation provided for convenience. In case of any discrepancies, the
        legally binding version is the official Russian text
        {onShowRussian ? (
          <>
            {' '}
            <button
              type="button"
              onClick={onShowRussian}
              className="font-semibold text-brand-hover underline-offset-2 hover:underline"
            >
              (open Russian version)
            </button>
          </>
        ) : null}
        .
      </p>
    </div>
  )
}
