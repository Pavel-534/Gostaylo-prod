/**
 * GET /api/v2/auth/link-conflict?token= — conflict details for /auth/link-conflict UX.
 */
import { NextResponse } from 'next/server'
import { authErrorJson } from '@/lib/auth/auth-error-codes'
import { getAuthLinkConflictByToken } from '@/lib/auth/account-linking.service'
import { readAppSessionProfileId } from '@/lib/auth/read-app-session'

export const dynamic = 'force-dynamic'

const PROVIDER_LABELS = {
  google: 'Google',
  apple: 'Apple',
  yandex: 'Yandex',
  vk: 'VK',
  telegram: 'Telegram',
  phone: 'Phone',
  email: 'Email',
}

function maskEmail(email) {
  const raw = String(email || '').trim()
  if (!raw || raw.includes('.airento.invalid')) return null
  const [local, domain] = raw.split('@')
  if (!domain) return null
  const head = local.length <= 2 ? `${local[0] || ''}*` : `${local.slice(0, 2)}***`
  return `${head}@${domain}`
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 4) return null
  return `+${digits.slice(0, -4).replace(/\d/g, '*')}${digits.slice(-4)}`
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token')
  const got = await getAuthLinkConflictByToken(token)
  if (!got.ok) return authErrorJson(got.error_code, 404)

  const session = readAppSessionProfileId(request)
  const conflict = got.conflict
  const occupied = conflict.occupied || {}
  const provider = String(conflict.provider || '').toLowerCase()

  return NextResponse.json({
    success: true,
    conflict: {
      token: conflict.token,
      provider,
      providerLabel: PROVIDER_LABELS[provider] || provider,
      occupiedProfileId: conflict.occupied_profile_id,
      challengerProfileId: conflict.challenger_profile_id,
      maskedEmail: maskEmail(conflict.provider_email || occupied.email),
      maskedPhone: maskPhone(occupied.phone),
      expiresAt: conflict.expires_at,
      canMerge:
        session.ok &&
        conflict.challenger_profile_id &&
        session.profileId === String(conflict.challenger_profile_id),
      isChallengerSession:
        session.ok &&
        conflict.challenger_profile_id &&
        session.profileId === String(conflict.challenger_profile_id),
    },
  })
}
