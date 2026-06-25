'use client'

import { useEffect, useState } from 'react'
import {
  getNetworkQualitySnapshot,
  readNetworkConnection,
} from '@/lib/media/network-quality'

/**
 * Live Network Information snapshot (save-data / 2g–3g) for image delivery tuning.
 * @returns {import('@/lib/media/network-quality').NetworkQualitySnapshot}
 */
export function useNetworkQuality() {
  const [quality, setQuality] = useState(() => getNetworkQualitySnapshot())

  useEffect(() => {
    const connection = readNetworkConnection()
    if (!connection) return undefined

    const onChange = () => {
      setQuality(getNetworkQualitySnapshot())
    }

    connection.addEventListener?.('change', onChange)
    setQuality(getNetworkQualitySnapshot())

    return () => {
      connection.removeEventListener?.('change', onChange)
    }
  }, [])

  return quality
}
