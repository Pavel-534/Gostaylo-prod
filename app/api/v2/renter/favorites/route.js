/**
 * GoStayLo - Renter Favorites API (v2) — thin proxy to SSOT `/api/v2/favorites` (Stage 167.0).
 */

import { NextResponse } from 'next/server'
import { GET as favoritesGet, POST as favoritesPost, DELETE as favoritesDelete } from '@/app/api/v2/favorites/route'
import { GET as favoritesCheckGet } from '@/app/api/v2/favorites/check/route'

export const dynamic = 'force-dynamic'

function adaptFavoritesList(body) {
  const rows = body?.favorites || []
  return rows.map((row) => ({
    id: row.id,
    listing_id: row.listing_id,
    created_at: row.created_at,
    listing: row.listings ?? null,
  }))
}

export async function GET() {
  try {
    const res = await favoritesGet()
    const body = await res.json()
    if (!body?.success) {
      return NextResponse.json(body, { status: res.status })
    }
    const data = adaptFavoritesList(body)
    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      guestServiceFeePercent: body.guestServiceFeePercent,
    })
  } catch (error) {
    console.error('[RENTER FAVORITES PROXY GET]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { listingId } = await request.json()
    if (!listingId) {
      return NextResponse.json({ success: false, error: 'Missing listingId' }, { status: 400 })
    }

    const checkUrl = new URL('http://local/api/v2/favorites/check')
    checkUrl.searchParams.set('listingId', String(listingId))
    const checkRes = await favoritesCheckGet(new Request(checkUrl))
    const checkBody = await checkRes.json()

    if (!checkRes.ok) {
      return NextResponse.json(checkBody, { status: checkRes.status })
    }

    const isFavorite = Boolean(checkBody?.isFavorite)
    const actionRes = isFavorite
      ? await favoritesDelete(
          new Request('http://local/api/v2/favorites', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId }),
          }),
        )
      : await favoritesPost(
          new Request('http://local/api/v2/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId }),
          }),
        )

    const actionBody = await actionRes.json()
    if (!actionBody?.success) {
      return NextResponse.json(actionBody, { status: actionRes.status })
    }

    return NextResponse.json({
      success: true,
      action: isFavorite ? 'removed' : 'added',
      message: isFavorite ? 'Removed from favorites' : 'Added to favorites',
      isFavorite: !isFavorite,
      data: actionBody.favorite ?? null,
    })
  } catch (error) {
    console.error('[RENTER FAVORITES PROXY POST]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const listingId = searchParams.get('listingId')
    if (!listingId) {
      return NextResponse.json({ success: false, error: 'Missing listingId' }, { status: 400 })
    }

    const res = await favoritesDelete(
      new Request('http://local/api/v2/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      }),
    )
    const body = await res.json()
    return NextResponse.json(body, { status: res.status })
  } catch (error) {
    console.error('[RENTER FAVORITES PROXY DELETE]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
