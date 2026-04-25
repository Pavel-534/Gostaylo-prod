/**
 * PATCH /api/v2/profile/me — update `preferred_language` and `instant_booking`.
 * Session: cookie `gostaylo_session` (same as `/api/v2/auth/me`).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizePreferredLanguageInput } from '@/lib/validation/profile-schema'

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
  if (rawPreferred === undefined && !hasInstant) {
    return NextResponse.json(
      { success: false, error: 'preferred_language or instant_booking is required' },
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

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', session.userId)

  if (error) {
    if (/preferred_language|column/i.test(String(error.message || ''))) {
      return NextResponse.json(
        { success: false, error: 'preferred_language column missing; run migration 009_stage41_profile_preferred_language.sql' },
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
  })
}
