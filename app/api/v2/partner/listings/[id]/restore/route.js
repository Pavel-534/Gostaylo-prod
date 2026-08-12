/**
 * Stage 200.128 — POST /api/v2/partner/listings/[id]/restore
 * Undelete soft-deleted listing (clear metadata.is_deleted; restore status + iCal pause).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requirePartnerSession } from '@/lib/services/session-service'
import { revalidateListingPaths } from '@/lib/revalidation'
import { buildListingSoftDeleteRestorePatch } from '@/lib/listing/listing-soft-delete-restore.js'

export const dynamic = 'force-dynamic'

export async function POST(_request, context) {
  const params = await Promise.resolve(context.params)
  const listingId = params?.id

  const auth = await requirePartnerSession()
  if (auth.error) return auth.error
  const { userId, userRole } = auth

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: listing, error: loadErr } = await supabase
    .from('listings')
    .select('id, owner_id, status, available, metadata, sync_settings')
    .eq('id', listingId)
    .single()

  if (loadErr || !listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
  }

  if (userRole !== 'ADMIN' && listing.owner_id !== userId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
  }

  const patch = buildListingSoftDeleteRestorePatch(listing)
  if (!patch.ok) {
    const status = patch.code === 'NOT_SOFT_DELETED' ? 409 : 400
    return NextResponse.json(
      { success: false, error: patch.error, code: patch.code },
      { status },
    )
  }

  /** @type {Record<string, unknown>} */
  const updateRow = {
    status: patch.status,
    metadata: patch.metadata,
    updated_at: new Date().toISOString(),
  }
  if (patch.available !== undefined) {
    updateRow.available = patch.available
  }
  if (patch.sync_settings !== undefined) {
    updateRow.sync_settings = patch.sync_settings
  }

  const { error: upErr } = await supabase.from('listings').update(updateRow).eq('id', listingId)
  if (upErr) {
    console.error('[PARTNER-LISTING] restore error:', upErr)
    return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
  }

  try {
    await revalidateListingPaths('update', listingId)
  } catch (e) {
    console.warn('[PARTNER-LISTING] restore revalidate:', e?.message)
  }

  return NextResponse.json({
    success: true,
    restored: true,
    listingId,
    status: patch.status,
  })
}
