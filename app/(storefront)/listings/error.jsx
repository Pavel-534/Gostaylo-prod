'use client'

/**
 * Error Boundary for /listings segment — Stage 199.3 One Surface.
 */

import { useEffect } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { StorefrontStateView } from '@/components/product/StorefrontStateView'
import { isUnresolvedI18nKey } from '@/lib/i18n/is-unresolved-i18n-key'

export default function ListingsError({ error, reset }) {
  const { language } = useI18n()

  useEffect(() => {
    console.error('[Listings Error]', error)
  }, [error])

  const titleRaw = getUIText('loadError', language)
  const bodyRaw = getUIText('listingsSegmentError_body', language)
  const retryRaw = getUIText('retry', language)
  const homeRaw = getUIText('backToHome', language)

  return (
    <StorefrontStateView
      variant="error"
      testId="listings-segment-error"
      title={isUnresolvedI18nKey(titleRaw, 'loadError') ? 'Something went wrong' : titleRaw}
      body={
        isUnresolvedI18nKey(bodyRaw, 'listingsSegmentError_body')
          ? getUIText('catalogLoadError_body', language)
          : bodyRaw
      }
      primaryLabel={isUnresolvedI18nKey(retryRaw, 'retry') ? 'Try again' : retryRaw}
      onPrimaryClick={reset}
      secondaryLabel={isUnresolvedI18nKey(homeRaw, 'backToHome') ? 'Home' : homeRaw}
      secondaryHref="/"
    />
  )
}
