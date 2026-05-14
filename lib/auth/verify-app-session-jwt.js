/**
 * SSOT: verify JWTs signed with the app `JWT_SECRET` using HS256
 * (`gostaylo_session`, email verification, password reset tokens — same secret, same algorithm).
 * Node / Route Handlers only — matches `jsonwebtoken` signing in `app-session-issue.js`.
 * Edge middleware continues to use `jose` (`middleware.ts`).
 */

import jwt from 'jsonwebtoken'

/** @type {import('jsonwebtoken').VerifyOptions} */
export const JWT_HS256_VERIFY_OPTIONS = Object.freeze({ algorithms: ['HS256'] })

/**
 * @param {string} token
 * @param {string} secret
 * @returns {{ ok: true, payload: object } | { ok: false, reason: 'invalid_input' | 'verify_failed' }}
 */
export function verifyAppSessionJwt(token, secret) {
  if (typeof token !== 'string' || !token.trim() || typeof secret !== 'string' || !secret.trim()) {
    return { ok: false, reason: 'invalid_input' }
  }
  try {
    const payload = jwt.verify(token.trim(), secret.trim(), JWT_HS256_VERIFY_OPTIONS)
    if (!payload || typeof payload !== 'object') {
      return { ok: false, reason: 'verify_failed' }
    }
    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'verify_failed' }
  }
}
