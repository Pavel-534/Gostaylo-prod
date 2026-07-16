'use client'

/**
 * Stage 189.0 / 189.1 — mount once in root providers; cold-start + resume snapshots for iOS smoke.
 */

import { useEffect, useRef } from 'react'
import {
  applyStandaloneDocumentAttrs,
  reportPwaColdStartOnce,
  reportPwaResumeFromBackground,
} from '@/lib/pwa/pwa-ios-telemetry.js'

export function PwaIosTelemetry() {
  const hiddenAtRef = useRef(null)

  useEffect(() => {
    applyStandaloneDocumentAttrs()
    const run = () => reportPwaColdStartOnce()
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 2500 })
      return () => cancelIdleCallback(id)
    }
    const t = setTimeout(run, 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      if (document.visibilityState === 'visible' && hiddenAtRef.current != null) {
        const hiddenMs = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = null
        // Ignore brief blips (<1.5s) — real smoke uses ~30s background.
        if (hiddenMs >= 1500) {
          reportPwaResumeFromBackground()
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return null
}
