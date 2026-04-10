/**
 * GET /api/v2/realtime-diag
 * Диагностика Realtime: JWT, публикация, RLS.
 * Доступно только ADMIN или при dev-режиме с заголовком x-diag-secret.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { createSupabaseRealtimeAccessToken } from '@/lib/auth/supabase-realtime-jwt'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const JWT_SECRET    = process.env.SUPABASE_JWT_SECRET
const DIAG_SECRET   = process.env.REALTIME_DIAG_SECRET   // опционально, для dev без авторизации
const IS_DEV        = process.env.NODE_ENV !== 'production'

export async function GET(req) {
  // Авторизация: Admin-сессия или REALTIME_DIAG_SECRET
  const session  = await getSessionPayload()
  const diagHdr  = req.headers.get('x-diag-secret')
  const isAdmin  = session?.role === 'ADMIN'
  const hasSecret = DIAG_SECRET && diagHdr === DIAG_SECRET

  if (!isAdmin && !hasSecret && !IS_DEV) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SUPABASE_URL:   SUPABASE_URL  ? `${SUPABASE_URL.slice(0, 30)}…` : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY:  SERVICE_KEY   ? 'SET' : 'MISSING',
      SUPABASE_JWT_SECRET:        JWT_SECRET    ? `SET (${JWT_SECRET.length} chars)` : 'MISSING ⛔',
    },
    jwtDiag:     null,
    publication: null,
    replicaIdentity: null,
    rlsSample:   null,
  }

  // ── 1. JWT diagnostic ──────────────────────────────────────────────────────
  if (!JWT_SECRET) {
    result.jwtDiag = { error: 'SUPABASE_JWT_SECRET is not set — realtime-token endpoint will return 503 ⛔' }
  } else if (!session?.userId) {
    result.jwtDiag = { note: 'no authenticated session — skipping per-user JWT test' }
  } else {
    const token = createSupabaseRealtimeAccessToken(session.userId, { email: session.email })
    if (!token) {
      result.jwtDiag = { error: 'createSupabaseRealtimeAccessToken returned null ⛔' }
    } else {
      try {
        const decoded = jwt.decode(token, { complete: true })
        // Try to verify (same secret must match Supabase)
        let verified = false
        let verifyError = null
        try {
          jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
          verified = true
        } catch (e) {
          verifyError = e.message
          // Attempt base64 decode fallback
          try {
            jwt.verify(token, Buffer.from(JWT_SECRET, 'base64'), { algorithms: ['HS256'] })
            verified = true
            verifyError = 'signed with raw secret fails but base64-decoded secret works — switch to Buffer.from(secret, "base64") ⚠'
          } catch {
            /* both fail */
          }
        }
        result.jwtDiag = {
          userId: session.userId,
          sub: decoded?.payload?.sub,
          subMatchesUserId: decoded?.payload?.sub === String(session.userId),
          role: decoded?.payload?.role,
          exp: decoded?.payload?.exp ? new Date(decoded.payload.exp * 1000).toISOString() : null,
          selfVerify: verified ? 'OK ✓' : `FAIL ⛔ ${verifyError}`,
          note: !verified ? 'JWT signature mismatch — token will be rejected by Supabase. Check SUPABASE_JWT_SECRET in env vs Dashboard → Settings → API → JWT Secret' : 'JWT verifies OK with provided secret',
        }
      } catch (e) {
        result.jwtDiag = { error: e.message }
      }
    }
  }

  // ── 2. Publication — НЕ через PostgREST: pg_catalog не в /rest/v1 ───────────
  result.publication = {
    note:
      'Таблицы в publication `supabase_realtime` нельзя проверить через PostgREST API. Откройте Supabase Dashboard → Database → Publications → supabase_realtime, либо выполните SQL из database/migrations/020_realtime_publication_fix.sql (SELECT из pg_publication_tables).',
    howToVerifySql:
      "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('messages','conversations');",
  }

  // ── 3. Replica identity — то же, pg_class недоступен через public REST ─────
  result.replicaIdentity = {
    note: 'Проверка REPLICA IDENTITY — только SQL Editor (см. 020_realtime_publication_fix.sql).',
  }

  // ── 4. RLS — pg_policies тоже не в public schema в типичном PostgREST ───────
  result.rlsSample = {
    note: 'Список политик — SQL: SELECT * FROM pg_policies WHERE tablename IN (\'messages\',\'conversations\');',
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const issues = []
  if (result.env.SUPABASE_JWT_SECRET === 'MISSING ⛔') issues.push('SUPABASE_JWT_SECRET not set')
  if (result.jwtDiag?.selfVerify?.startsWith('FAIL')) issues.push('JWT signature mismatch')

  result.summary = issues.length === 0
    ? '✅ No critical issues detected. If Realtime still fails, check Supabase Dashboard → Realtime → inspect channel.'
    : `⛔ ${issues.length} issue(s): ${issues.join('; ')}`

  return NextResponse.json(result, { status: 200 })
}
