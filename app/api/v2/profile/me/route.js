/**
 * PATCH /api/v2/profile/me — preferred_language, instant_booking, iana_timezone, referral_monthly_goal_thb,
 * referral_display_currency и preferred_currency (Stage 76.2: синхронизированы).
 * Session: cookie `gostaylo_session` (same as `/api/v2/auth/me`).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizePreferredLanguageInput } from '@/lib/validation/profile-schema'
import { isValidIanaTimezone } from '@/lib/validation/iana-timezone'
import { normalizeReferralDisplayCurrency } from '@/lib/finance/referral-display-currency'

export async function PATCH(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const rawPreferred = body?.preferred_language ?? body?.preferredLanguage
  const hasInstant = body?.instant_booking !== undefined || body?.instantBooking !== undefined
  const rawTz = body?.iana_timezone ?? body?.ianaTimezone
  const hasTz = rawTz !== undefined
  const rawGoal = body?.referral_monthly_goal_thb ?? body?.referralMonthlyGoalThb
  const hasGoal = rawGoal !== undefined
  const rawDisplayCur = body?.referral_display_currency ?? body?.referralDisplayCurrency
  const hasDisplayCur = rawDisplayCur !== undefined
  const rawPreferredCurrency = body?.preferred_currency ?? body?.preferredCurrency
  const hasPreferredCurrency = rawPreferredCurrency !== undefined

  if (rawPreferred === undefined && !hasInstant && !hasTz && !hasGoal && !hasDisplayCur && !hasPreferredCurrency) {
    return NextResponse.json(
      {
        success: false,
        error:
          'At least one of preferred_language, instant_booking, iana_timezone, referral_monthly_goal_thb, referral_display_currency, preferred_currency is required',
      },
      { status: 400 },
    )
  }

  let normalizedPreferred = null
  if (rawPreferred !== undefined) {
    const preferred = normalizePreferredLanguageInput(rawPreferred)
    if (preferred.error || !preferred.hasValue) {
      return NextResponse.json({ success: false, error: preferred.error || 'Unsupported locale' }, { status: 400 })
    }
    normalizedPreferred = preferred.value
  }
  const nextInstant = hasInstant ? (body?.instant_booking ?? body?.instantBooking) === true : null

  let nextTimezone = null
  if (hasTz) {
    const s = String(rawTz || '').trim()
    if (s && !isValidIanaTimezone(s)) {
      return NextResponse.json({ success: false, error: 'Invalid iana_timezone' }, { status: 400 })
    }
    nextTimezone = s || null
  }

  let nextGoalThb = undefined
  if (hasGoal) {
    const n = Number(rawGoal)
    if (rawGoal === null || rawGoal === '') {
      nextGoalThb = null
    } else if (!Number.isFinite(n) || n < 0 || n > 999999999) {
      return NextResponse.json({ success: false, error: 'referral_monthly_goal_thb invalid' }, { status: 400 })
    } else {
      nextGoalThb = Math.round(n * 100) / 100
    }
  }

  let nextDisplayCurrency = undefined
  if (hasDisplayCur) {
    if (rawDisplayCur === null || rawDisplayCur === '') {
      nextDisplayCurrency = 'THB'
    } else {
      nextDisplayCurrency = normalizeReferralDisplayCurrency(rawDisplayCur)
    }
  }
  let nextPreferredCurrency = undefined
  if (hasPreferredCurrency) {
    if (rawPreferredCurrency === null || rawPreferredCurrency === '') {
      nextPreferredCurrency = 'THB'
    } else {
      nextPreferredCurrency = normalizeReferralDisplayCurrency(rawPreferredCurrency)
    }
  }
  const mergedCurrency = hasDisplayCur
    ? nextDisplayCurrency
    : hasPreferredCurrency
      ? nextPreferredCurrency
      : undefined

  const { data: beforeProfile, error: beforeProfileError } = await supabaseAdmin
    .from('profiles')
    .select('instant_booking')
    .eq('id', session.userId)
    .single()
  if (beforeProfileError) {
    return NextResponse.json({ success: false, error: beforeProfileError.message || 'Profile not found' }, { status: 404 })
  }

  const updates = {
    updated_at: new Date().toISOString(),
  }
  if (normalizedPreferred !== null) updates.preferred_language = normalizedPreferred
  if (hasInstant) updates.instant_booking = nextInstant
  if (hasTz) updates.iana_timezone = nextTimezone
  if (hasGoal) updates.referral_monthly_goal_thb = nextGoalThb
  if (mergedCurrency) {
    // Stage 76.2 SSOT: ambassador and global profile currency must remain synchronized.
    updates.referral_display_currency = mergedCurrency
    updates.preferred_currency = mergedCurrency
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', session.userId)

  if (error) {
    if (/preferred_language|iana_timezone|referral_monthly_goal|referral_display_currency|preferred_currency|column/i.test(String(error.message || ''))) {
      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            'Profile columns missing; run migrations (preferred_language / Stage 73.3 referral profile fields)',
        },
        { status: 503 },
      )
    }
    console.error('[PROFILE/ME PATCH]', error.message)
    return NextResponse.json({ success: false, error: error.message || 'Update failed' }, { status: 400 })
  }

  if (hasInstant) {
    const prevInstant = beforeProfile?.instant_booking === true
    if (prevInstant !== nextInstant) {
      const { error: listingSyncError } = await supabaseAdmin
        .from('listings')
        .update({
          instant_booking: nextInstant,
          updated_at: new Date().toISOString(),
        })
        .eq('owner_id', session.userId)
        .eq('instant_booking', prevInstant)
      if (listingSyncError) {
        console.warn('[PROFILE/ME PATCH] listing instant booking sync failed:', listingSyncError.message)
      }
    }
  }

  return NextResponse.json({
    success: true,
    preferred_language: normalizedPreferred,
    instant_booking: hasInstant ? nextInstant : null,
    iana_timezone: hasTz ? nextTimezone : null,
    referral_monthly_goal_thb: hasGoal ? nextGoalThb : null,
    referral_display_currency: mergedCurrency,
    preferred_currency: mergedCurrency,
  })
}
