import { NextResponse } from 'next/server'

/**
 * SSOT for `/api/cron/*` — trim `CRON_SECRET`, accept `Authorization: Bearer <token>` or `x-cron-secret`.
 * @param {Request} request
 * @returns {{ ok: boolean, configured: boolean }}
 */
export function verifyCronSecret(request) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) {
    return { ok: false, configured: false }
  }
  const cronHeader = String(request.headers.get('x-cron-secret') || '').trim()
  if (cronHeader && cronHeader === secret) {
    return { ok: true, configured: true }
  }
  const auth = request.headers.get('authorization')
  if (auth) {
    const m = String(auth).match(/^Bearer\s+(.+)$/i)
    const bearer = m ? String(m[1]).trim() : ''
    if (bearer && bearer === secret) {
      return { ok: true, configured: true }
    }
  }
  return { ok: false, configured: true }
}

/**
 * @returns {NextResponse | null} — `null` if authorized
 */
export function assertCronAuthorized(request) {
  const v = verifyCronSecret(request)
  if (!v.configured) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (!v.ok) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
