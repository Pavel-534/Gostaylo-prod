'use client'

/**
 * Stage 200.75 — shared client shell for root / checkout error boundaries.
 * Never render error.message or stack.
 */

import { useEffect } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { StorefrontStateView } from '@/components/product/StorefrontStateView'
import { isUnresolvedI18nKey } from '@/lib/i18n/is-unresolved-i18n-key'

/**
 * @param {{
 *   error: Error & { digest?: string }
 *   reset: () => void
 *   logLabel?: string
 *   bodyKey?: string
 *   secondaryHref?: string
 *   secondaryLabelKey?: string
 * }} props
 */
export function AppErrorBoundaryView({
  error,
  reset,
  logLabel = '[App Error]',
  bodyKey = 'rootError_body',
  secondaryHref = '/',
  secondaryLabelKey = 'backToHome',
}) {
  const { language } = useI18n()

  useEffect(() => {
    console.error(logLabel, error)
  }, [error, logLabel])

  const titleRaw = getUIText('rootError_title', language)
  const bodyRaw = getUIText(bodyKey, language)
  const retryRaw = getUIText('retry', language)
  const homeRaw = getUIText(secondaryLabelKey, language)

  return (
    <StorefrontStateView
      variant="error"
      testId="app-error-boundary"
      className="min-h-[60vh] bg-slate-50"
      title={isUnresolvedI18nKey(titleRaw, 'rootError_title') ? 'Something went wrong' : titleRaw}
      body={
        isUnresolvedI18nKey(bodyRaw, bodyKey)
          ? 'We could not load this page. Try again or go back home.'
          : bodyRaw
      }
      primaryLabel={isUnresolvedI18nKey(retryRaw, 'retry') ? 'Try again' : retryRaw}
      onPrimaryClick={reset}
      secondaryLabel={isUnresolvedI18nKey(homeRaw, secondaryLabelKey) ? 'Home' : homeRaw}
      secondaryHref={secondaryHref}
    />
  )
}
