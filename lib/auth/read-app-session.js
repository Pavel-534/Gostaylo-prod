/**
 * Stage 189.1 — read `gostaylo_session` from Request or Next cookies().
 */
import { cookies } from 'next/headers'
import { tryGetJwtSecret } from '@/lib/auth/jwt-secret'
import { verifyAppSessionJwt } from '@/lib/auth/verify-app-session-jwt'
import { authErrorJson, AuthErrorCode } from '@/lib/auth/auth-error-codes'

/**
 * @param {import('next/server').NextRequest | { cookies?: { get: (n: string) => { value?: string } | undefined } } | string | null | undefined} source
 */
export function readAppSessionProfileId(source) {
  const jwtCheck = tryGetJwtSecret()
  if (!jwtCheck.ok) {
    return { ok: false, error: authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500) }
  }

  let cookieValue = ''
  if (typeof source === 'string') {
    cookieValue = source
  } else if (source?.cookies?.get) {
    cookieValue = source.cookies.get('gostaylo_session')?.value || ''
  } else {
    const cookieStore = cookies()
    cookieValue = cookieStore.get('gostaylo_session')?.value || ''
  }

  if (!cookieValue) {
    return { ok: false, error: authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401) }
  }

  const verified = verifyAppSessionJwt(cookieValue, jwtCheck.secret)
  if (!verified.ok || !verified.payload?.userId) {
    return { ok: false, error: authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401) }
  }

  return {
    ok: true,
    profileId: String(verified.payload.userId),
    jwtSecret: jwtCheck.secret,
    payload: verified.payload,
  }
}
