'use client'

import { usePartnerReputationHealthQuery } from '@/hooks/use-partner-reputation-health'
import { PartnerHealthWidget } from '@/components/trust/PartnerHealthWidget'
import { SuccessGuide } from '@/components/partner/SuccessGuide'

/**
 * Single fetch for partner dashboard: health + onboarding (Stage 19.0 + 28.0 React Query cache).
 * @param {{ language?: string }} props
 */
export function PartnerReputationSection({ language = 'ru' }) {
  const q = usePartnerReputationHealthQuery(true)
  const effError = q.isError ? String(q.error?.message || 'load_failed') : ''

  return (
    <div className="space-y-4">
      <PartnerHealthWidget
        language={language}
        remote={{
          data: q.data ?? null,
          loading: q.isPending,
          error: effError,
          reload: () => void q.refetch(),
        }}
      />
      <SuccessGuide
        language={language}
        snapshot={q.data?.snapshot ?? null}
        dominantCategorySlug={q.data?.dominantCategorySlug ?? null}
      />
    </div>
  )
}
