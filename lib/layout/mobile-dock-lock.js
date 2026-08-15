/**
 * ADR-201 — refcount lock so guest/partner bottom docks hide while an overlay owns the bottom edge.
 * Not React Context: Sheet/Dialog portals and dynamic search sheets all share one document lock.
 */

export const MOBILE_DOCK_LOCK_EVENT = 'airento:mobile-dock-lock'

let lockCount = 0

function publish() {
  if (typeof document === 'undefined') return
  const n = lockCount
  if (n > 0) {
    document.documentElement.dataset.mobileDockLock = String(n)
  } else {
    delete document.documentElement.dataset.mobileDockLock
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOBILE_DOCK_LOCK_EVENT, { detail: { locks: n } }))
  }
}

/** @returns {() => void} release */
export function acquireMobileDockLock() {
  lockCount += 1
  publish()
  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    publish()
  }
}

export function getMobileDockLockCount() {
  return lockCount
}

export function isMobileDockLocked() {
  // Trust in-memory refcount only — stale `data-mobile-dock-lock` after HMR/bundle
  // split previously kept the tab bar hidden forever (Stage 201.46).
  return lockCount > 0
}

/** Test helper — do not use in product UI. */
export function __resetMobileDockLockForTests() {
  lockCount = 0
  publish()
}
