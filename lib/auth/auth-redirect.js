/**
 * Stage 189.0 — post-auth redirect + booking resume bridge (SSOT).
 */
import { safeInternalPath } from '@/lib/security/safe-internal-path'

export const AUTH_CLOSE_EVENT = 'gostaylo-auth-close'

/** @param {'success' | 'dismiss'} outcome */
export function dispatchAuthCloseEvent(outcome = 'success') {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(AUTH_CLOSE_EVENT, { detail: { outcome } }))
  } catch {
    /* ignore */
  }
}

export function readRedirectAfterLogin() {
  if (typeof window === 'undefined') return null
  try {
    const saved = sessionStorage.getItem('gostaylo_redirect_after_login')
    return saved?.startsWith('/') && !saved.startsWith('//') ? saved : null
  } catch {
    return null
  }
}

export function clearRedirectAfterLogin() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem('gostaylo_redirect_after_login')
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('next/navigation').AppRouterInstance} router
 * @param {string} [fallback='/profile/']
 */
export function finishAuthNavigation(router, fallback = '/profile/') {
  const next = readRedirectAfterLogin() || fallback
  clearRedirectAfterLogin()
  dispatchAuthCloseEvent('success')
  router.push(safeInternalPath(next, fallback))
  router.refresh()
}

/**
 * @param {string} [currentPath]
 */
export function persistRedirectBeforeAuth(currentPath) {
  if (typeof window === 'undefined') return
  const path = String(currentPath || '').trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/auth/')) return
  try {
    sessionStorage.setItem('gostaylo_redirect_after_login', path.slice(0, 2048))
  } catch {
    /* ignore */
  }
}
