/**
 * Stage 154.1 — GET /api/v2/profile must reject anonymous cross-user reads (V-01).
 */
import { randomUUID } from 'node:crypto'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'

export async function runStage154ProfileAuthGuardSmokeStep() {
  const { NextRequest } = await import('next/server')
  const { GET: profileGet } = await import('@/app/api/v2/profile/route')

  const probeId = randomUUID()
  const req = new NextRequest(`http://smoke.local/api/v2/profile?userId=${encodeURIComponent(probeId)}`)
  const res = await profileGet(req)
  const status = res.status
  let body = {}
  try {
    body = await res.json()
  } catch {
    body = {}
  }

  if (status !== 401) {
    return { ok: false, detail: `expected_401_anonymous got_status=${status}` }
  }
  if (body?.error_code !== AuthErrorCode.AUTH_NOT_AUTHENTICATED) {
    return { ok: false, detail: `expected_AUTH_NOT_AUTHENTICATED got=${body?.error_code || 'none'}` }
  }

  return { ok: true, detail: `anonymous_blocked status=${status}` }
}
