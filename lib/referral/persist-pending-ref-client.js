'use client'

/**
 * Stage 143 — thin wrapper; SSOT is `contexts/auth/auth-referral-handler.js`.
 */
import {
  persistPendingReferralCode,
  trackReferralClick,
} from '@/contexts/auth/auth-referral-handler'

/** @param {string} codeRaw */
export function persistPendingReferralFromLanding(codeRaw) {
  const code = String(codeRaw || '').trim().toUpperCase()
  if (!code) return
  persistPendingReferralCode(code)
  trackReferralClick(code, typeof window !== 'undefined' ? window.location.pathname || '/' : '/')
}
