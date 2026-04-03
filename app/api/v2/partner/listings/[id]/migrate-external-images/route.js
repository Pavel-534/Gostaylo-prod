/**
 * POST /api/v2/partner/listings/[id]/migrate-external-images
 * Перекачивает внешние URL из images в bucket listing-images (Service Role).
 * Только колонка images (+ updated_at). Сезонные цены и прочие поля не трогаем.
 *
 * Body (optional): { urls?: string[] } — по умолчанию берём текущие images из БД.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { verifyPartnerAccess } from '@/lib/services/session-service'
import { migrateListingExternalImages } from '@/lib/services/external-image-storage'
import { getJwtSecret } from '@/lib/auth/jwt-secret'

async function getPartnerFromSession() {
  let secret
  try {
    secret = getJwtSecret()
  } catch (e) {
    return { error: NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
  }
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  let decoded
  try {
    decoded = jwt.verify(sessionCookie.value, secret)
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }) }
  }
  const partner = await verifyPartnerAccess(decoded.userId)
  if (!partner) {
    return { error: NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 }) }
  }
  return { userId: decoded.userId, userRole: partner.role }
}

export async function POST(request, context) {
  const params = await Promise.resolve(context.params)
  const listingId = params.id

  const auth = await getPartnerFromSession()
  if (auth.error) return auth.error

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: row, error: fetchErr } = await supabase
    .from('listings')
    .select('id, owner_id, images')
    .eq('id', listingId)
    .single()

  if (fetchErr || !row) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
  }

  if (auth.userRole !== 'ADMIN' && String(row.owner_id) !== String(auth.userId)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const urlsFromBody = Array.isArray(body.urls) ? body.urls : null
  const sourceUrls = urlsFromBody && urlsFromBody.length > 0 ? urlsFromBody : row.images || []

  const { images, migrated, failed, details } = await migrateListingExternalImages(listingId, sourceUrls)

  const { error: updateErr } = await supabase
    .from('listings')
    .update({
      images,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (updateErr) {
    console.error('[migrate-external-images]', updateErr)
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    images,
    migrated,
    failed,
    details,
  })
}
