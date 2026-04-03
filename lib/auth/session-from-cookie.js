import { tryGetJwtSecret } from '@/lib/auth/jwt-secret'

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
    const jwt = (await import('jsonwebtoken')).default
    const payload = jwt.verify(session.value, jwtCheck.secret)
    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'unauthorized' }
  }
}
