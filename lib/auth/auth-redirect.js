/**
 * Stage 189.0 / 196.0-B / 201.23 — post-auth redirect + booking resume bridge (SSOT).
 * Dual channel: `?redirect=` query (primary) + `gostaylo_redirect_after_login` sessionStorage (fallback).
 * After login: optimistic pending + replace (do not refresh the auth page — that was the dead gap).
 */
import { safeInternalPath } from '@/lib/security/safe-internal-path'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'

export const AUTH_CLOSE_EVENT = 'gostaylo-auth-close'
export const REDIRECT_AFTER_LOGIN_KEY = 'gostaylo_redirect_after_login'

const INVALID_SENTINEL = '/__auth_redirect_invalid__'

/** @param {'success' | 'dismiss'} outcome */
export function dispatchAuthCloseEvent(outcome = 'success') {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(AUTH_CLOSE_EVENT, { detail: { outcome } }))
  } catch {
    /* ignore */
  }
}

/**
 * Normalize a candidate return path; reject auth loops / open redirects.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function sanitizeAuthReturnPath(raw) {
  const input = String(raw || '').trim()
  if (!input) return null
  if (!input.startsWith('/') || input.startsWith('//')) return null
  if (input.startsWith('/auth/') || input === '/auth') return null
  const resolved = safeInternalPath(input.slice(0, 2048), INVALID_SENTINEL)
  if (!resolved || resolved === INVALID_SENTINEL) return null
  if (resolved.startsWith('/auth/') || resolved === '/auth') return null
  return resolved
}

export function readRedirectAfterLogin() {
  if (typeof window === 'undefined') return null
  try {
    return sanitizeAuthReturnPath(sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY))
  } catch {
    return null
  }
}

export function clearRedirectAfterLogin() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Read `redirect` from a query string or URLSearchParams (auth page URL).
 * @param {string|URLSearchParams|null|undefined} search
 * @returns {string|null}
 */
export function readRedirectFromAuthQuery(search) {
  try {
    let raw = null
    if (typeof search === 'string') {
      const qs = search.startsWith('?') ? search.slice(1) : search
      raw = new URLSearchParams(qs).get('redirect')
    } else if (search && typeof search.get === 'function') {
      raw = search.get('redirect')
    }
    if (!raw) return null
    try {
      raw = decodeURIComponent(String(raw))
    } catch {
      raw = String(raw)
    }
    return sanitizeAuthReturnPath(raw)
  } catch {
    return null
  }
}

/**
 * Query `redirect` wins over sessionStorage.
 * @param {{ search?: string|URLSearchParams|null, fallback?: string }} [opts]
 */
export function resolvePostAuthRedirect(opts = {}) {
  const fallback = sanitizeAuthReturnPath(opts.fallback) || '/profile/'
  let search = opts.search
  if (search == null && typeof window !== 'undefined') {
    search = window.location.search || ''
  }
  const fromQuery = readRedirectFromAuthQuery(search)
  if (fromQuery) return fromQuery
  const fromStorage = readRedirectAfterLogin()
  if (fromStorage) return fromStorage
  return fallback
}

/**
 * @param {'login'|'register'} [mode]
 * @param {string|null|undefined} [returnPath]
 */
export function buildAuthEntryHref(mode = 'login', returnPath) {
  const base = mode === 'register' ? '/auth/register' : '/auth/login'
  const safe = sanitizeAuthReturnPath(returnPath)
  if (!safe) return base
  return `${base}?redirect=${encodeURIComponent(safe)}`
}

/**
 * @param {import('next/navigation').AppRouterInstance} router
 * @param {string} [fallback='/profile/']
 * @param {{ search?: string|URLSearchParams|null }} [opts]
 */
export function finishAuthNavigation(router, fallback = '/profile/', opts = {}) {
  const next = resolvePostAuthRedirect({ search: opts.search, fallback })
  clearRedirectAfterLogin()
  dispatchAuthCloseEvent('success')
  const href = safeInternalPath(next, fallback)
  dispatchOptimisticNavPending(href)
  router.replace(href)
}

/**
 * @param {string} [currentPath]
 */
export function persistRedirectBeforeAuth(currentPath) {
  if (typeof window === 'undefined') return
  const path = sanitizeAuthReturnPath(currentPath)
  if (!path) return
  try {
    sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, path.slice(0, 2048))
  } catch {
    /* ignore */
  }
}
