'use client'

/**
 * Stage 200.75 — shared client shell for root / checkout error boundaries.
 * Never render error.message or stack.
 * Stage 201.15 — chunk / soft-nav failures → hard reload on Retry.
 * Stage 202.0 — Sentry.captureException (Telegram only via server beforeSend filters).
 */

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { StorefrontStateView } from '@/components/product/StorefrontStateView'
import { isUnresolvedI18nKey } from '@/lib/i18n/is-unresolved-i18n-key'
import { isClientNavFailure } from '@/lib/navigation/is-client-nav-failure'

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
  const hardReloadOnRetry = isClientNavFailure(error)

  useEffect(() => {
    console.error(logLabel, error)
    Sentry.captureException(error, {
      tags: {
        surface: 'app_error_boundary',
        nav_failure: hardReloadOnRetry ? '1' : '0',
      },
    })
  }, [error, logLabel, hardReloadOnRetry])

  const titleRaw = getUIText('rootError_title', language)
  const bodyRaw = getUIText(bodyKey, language)
  const retryRaw = getUIText('retry', language)
  const homeRaw = getUIText(secondaryLabelKey, language)

  const onPrimaryClick = () => {
    if (hardReloadOnRetry && typeof window !== 'undefined') {
      window.location.reload()
      return
    }
    reset()
  }

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
      onPrimaryClick={onPrimaryClick}
      secondaryLabel={isUnresolvedI18nKey(homeRaw, secondaryLabelKey) ? 'Home' : homeRaw}
      secondaryHref={secondaryHref}
    />
  )
}
