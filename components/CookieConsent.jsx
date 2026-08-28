'use client'

/**
 * Stage 202.18 — GDPR / 152-ФЗ cookie consent banner (analytics opt-in).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  setStoredConsent,
  shouldShowBanner,
} from '@/lib/consent/cookie-consent-state.js'

const SHOW_DELAY_MS = 500

export function CookieConsent() {
  const { language } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!shouldShowBanner()) return undefined
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const acceptNecessary = useCallback(() => {
    setStoredConsent({ all: false })
    setVisible(false)
  }, [])

  const acceptAll = useCallback(() => {
    setStoredConsent({ all: true })
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
      aria-label={getUIText('cookie_consent_aria_label', language)}
      data-testid="cookie-consent-banner"
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/90 bg-white p-4 shadow-[0_-4px_24px_rgba(15,23,42,0.08)]',
        'dark:border-neutral-700 dark:bg-neutral-900',
        'sm:p-6 rounded-t-xl motion-reduce:transition-none',
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h2
            id="cookie-consent-title"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base"
          >
            {getUIText('cookie_consent_title', language)}
          </h2>
          <p
            id="cookie-consent-body"
            className="mt-1 text-sm text-slate-600 dark:text-slate-300 sm:text-base leading-snug"
          >
            {getUIText('cookie_consent_body', language)}
          </p>
          <Link
            href="/legal/privacy"
            className="mt-2 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {getUIText('cookie_consent_policy_link', language)}
          </Link>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[220px]">
          <Button
            type="button"
            variant="brand"
            className="w-full"
            onClick={acceptAll}
            data-testid="cookie-consent-accept-all"
          >
            {getUIText('cookie_consent_accept', language)}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={acceptNecessary}
            data-testid="cookie-consent-necessary-only"
          >
            {getUIText('cookie_consent_reject', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}
