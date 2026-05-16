'use client'

import { useEffect, useState } from 'react'
import { ROUNDING_MODE_POT10 } from '@/lib/booking-guest-rounding'

let cached = null
let cachedAt = 0
const TTL_MS = 60_000

/**
 * Client SSOT for guest total rounding (matches server when flag toggled).
 */
export function usePricingEngineConfig() {
  const [config, setConfig] = useState(
    cached || {
      pricingEngineV2Enabled: false,
      roundingMode: ROUNDING_MODE_POT10,
      loading: true,
    },
  )

  useEffect(() => {
    const now = Date.now()
    if (cached && now - cachedAt < TTL_MS) {
      setConfig({ ...cached, loading: false })
      return
    }
    let cancelled = false
    fetch('/api/v2/pricing/engine-config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const data = j?.data || {}
        const next = {
          pricingEngineV2Enabled: Boolean(data.pricingEngineV2Enabled),
          roundingMode: data.roundingMode || ROUNDING_MODE_POT10,
          loading: false,
        }
        cached = next
        cachedAt = Date.now()
        setConfig(next)
      })
      .catch(() => {
        if (!cancelled) {
          setConfig((prev) => ({ ...prev, loading: false }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return config
}
