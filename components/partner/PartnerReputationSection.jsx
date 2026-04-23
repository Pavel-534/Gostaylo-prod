'use client'

import { useCallback, useEffect, useState } from 'react'
import { PartnerHealthWidget } from '@/components/trust/PartnerHealthWidget'
import { SuccessGuide } from '@/components/partner/SuccessGuide'

/**
 * Single fetch for partner dashboard: health + onboarding (Stage 19.0).
 * @param {{ language?: string }} props
 */
export function PartnerReputationSection({ language = 'ru' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v2/partner/reputation-health', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setError(json.error || 'load_failed')
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError('network')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <PartnerHealthWidget
        language={language}
        remote={{ data, loading, error, reload: load }}
      />
      <SuccessGuide language={language} snapshot={data?.snapshot ?? null} />
    </div>
  )
}
