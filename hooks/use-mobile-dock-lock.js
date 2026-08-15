'use client'

import { useEffect, useState } from 'react'
import {
  MOBILE_DOCK_LOCK_EVENT,
  acquireMobileDockLock,
  isMobileDockLocked,
} from '@/lib/layout/mobile-dock-lock'

/** Subscribe to dock lock (bottom nav hide while overlay open). */
export function useMobileDockLocked() {
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    const sync = () => setLocked(isMobileDockLocked())
    sync()
    window.addEventListener(MOBILE_DOCK_LOCK_EVENT, sync)
    return () => window.removeEventListener(MOBILE_DOCK_LOCK_EVENT, sync)
  }, [])

  return locked
}

/**
 * While `active`, acquire a dock lock (refcount). Safe for Strict Mode double-mount.
 * @param {boolean} active
 */
export function useMobileDockLock(active) {
  useEffect(() => {
    if (!active) return undefined
    return acquireMobileDockLock()
  }, [active])
}
