/**
 * GET /api/v2/auth/connections — linked providers for AccountConnections UI.
 * DELETE /api/v2/auth/connections — unlink provider (not last method).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authErrorJson, AuthErrorCode } from '@/lib/auth/auth-error-codes'
import {
  buildAccountConnectionStates,
  listProfileAuthIdentities,
  unlinkProfileAuthIdentity,
} from '@/lib/auth/account-linking.service'
import { readAppSessionProfileId } from '@/lib/auth/read-app-session'
import { isRussia } from '@/lib/geo'

export const dynamic = 'force-dynamic'

async function loadProfile(profileId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return { error: authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500) }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, phone, password_hash, telegram_id, telegram_username, role, is_banned')
    .eq('id', profileId)
    .maybeSingle()

  if (error || !profile) {
    return { error: authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 404) }
  }
  if (profile.is_banned === true) {
    return { error: authErrorJson(AuthErrorCode.AUTH_ACCOUNT_SUSPENDED, 403) }
  }

  return { profile }
}

export async function GET(request) {
  const session = readAppSessionProfileId(request)
  if (!session.ok) return session.error

  const loaded = await loadProfile(session.profileId)
  if (loaded.error) return loaded.error

  const listed = await listProfileAuthIdentities(session.profileId)
  if (!listed.ok) return authErrorJson(listed.error_code, 500)

  const connections = buildAccountConnectionStates(loaded.profile, listed.identities, {
    isRussia: isRussia(request),
  })

  return NextResponse.json({
    success: true,
    connections,
    identities: listed.identities,
  })
}

export async function DELETE(request) {
  const session = readAppSessionProfileId(request)
  if (!session.ok) return session.error

  let body
  try {
    body = await request.json()
  } catch {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400)
  }

  const provider = String(body?.provider || '').toLowerCase().trim()
  if (!provider) return authErrorJson('AUTH_LINK_PROVIDER_INVALID', 400)

  const loaded = await loadProfile(session.profileId)
  if (loaded.error) return loaded.error

  const profile = loaded.profile
  const result = await unlinkProfileAuthIdentity(session.profileId, provider, {
    hasPassword: Boolean(profile.password_hash),
    hasPhone: Boolean(profile.phone),
    hasTelegram: Boolean(profile.telegram_id),
  })

  if (!result.ok) return authErrorJson(result.error_code, 400)
  return NextResponse.json({ success: true })
}
