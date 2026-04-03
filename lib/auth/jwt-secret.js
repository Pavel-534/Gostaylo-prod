/**
 * Central secret for JWT session cookies and HMAC-derived tokens (e.g. iCal export).
 * No fallback — a missing secret is a deployment misconfiguration.
 */

export class JwtSecretMissingError extends Error {
  constructor() {
    super(
      'JWT_SECRET is not configured. Set a strong, unique JWT_SECRET in the environment (e.g. openssl rand -base64 32).'
    )
    this.name = 'JwtSecretMissingError'
  }
}

/**
 * @returns {string} trimmed secret
 * @throws {JwtSecretMissingError}
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new JwtSecretMissingError()
  }
  return secret.trim()
}

/**
 * Use when missing secret should fail closed without throwing through framework boundaries.
 * @returns {{ ok: true, secret: string } | { ok: false, secret: null, error: JwtSecretMissingError }}
 */
export function tryGetJwtSecret() {
  try {
    return { ok: true, secret: getJwtSecret() }
  } catch (e) {
    if (e instanceof JwtSecretMissingError) {
      return { ok: false, secret: null, error: e }
    }
    throw e
  }
}
