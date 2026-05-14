import { tryGetJwtSecret } from '@/lib/auth/jwt-secret'
import { verifyAppSessionJwt } from '@/lib/auth/verify-app-session-jwt'

/**
 * Verify `gostaylo_session` JWT from Next.js cookies.
 * @returns {Promise<
 *   | { ok: true, payload: object }
 *   | { ok: false, reason: 'unauthorized' }
 *   | { ok: false, reason: 'misconfigured', message: string }
 * >}
 */
export async function verifySessionFromCookies() {
  const jwtCheck = tryGetJwtSecret()
  if (!jwtCheck.ok) {
    return { ok: false, reason: 'misconfigured', message: jwtCheck.error.message }
  }

  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  const session = cookieStore.get('gostaylo_session')
  if (!session?.value) {
    return { ok: false, reason: 'unauthorized' }
  }

  try {
    const v = verifyAppSessionJwt(session.value, jwtCheck.secret)
    if (!v.ok) {
      return { ok: false, reason: 'unauthorized' }
    }
    return { ok: true, payload: v.payload }
  } catch {
    return { ok: false, reason: 'unauthorized' }
  }
}
