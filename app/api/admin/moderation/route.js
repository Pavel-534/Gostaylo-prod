/**
 * Admin Moderation API
 * GET - Fetch pending listings with owner info and commission rate
 * PATCH - Approve or reject listing
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_TOPIC_ID = '-1003832026983'
const LISTINGS_THREAD_ID = 3

export async function GET() {
  try {
    // Fetch pending listings with owner info
    const listingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?status=eq.PENDING&select=*,owner:profiles!listings_owner_id_fkey(id,first_name,last_name,email,phone,telegram_id,custom_commission_rate)&order=created_at.desc`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      }
    )

    if (!listingsRes.ok) {
      throw new Error('Failed to fetch listings')
    }

    const rawListings = await listingsRes.json()
    
    // Filter out drafts
    const listings = (rawListings || []).filter(listing => {
      const isDraft = listing.metadata?.is_draft === true
      return !isDraft
    })

    // Get system commission rate
    const settingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?key=eq.general&select=value`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    )
    const settings = await settingsRes.json()
    const systemCommission = settings?.[0]?.value?.defaultCommissionRate || 15

    // Add effective commission to each listing
    const listingsWithCommission = listings.map(listing => ({
      ...listing,
      effectiveCommission: listing.owner?.custom_commission_rate ?? systemCommission,
      systemCommission
    }))

    return NextResponse.json({ 
      success: true, 
      listings: listingsWithCommission,
      count: listingsWithCommission.length
    })

  } catch (error) {
    console.error('Moderation GET error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { listingId, action, rejectReason } = body

    if (!listingId || !action) {
      return NextResponse.json({ error: 'listingId and action required' }, { status: 400 })
    }

    // Get listing with owner info
    const listingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=*,owner:profiles!listings_owner_id_fkey(id,first_name,last_name,email,telegram_id)`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    )
    const listings = await listingRes.json()
    const listing = listings?.[0]

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const timestamp = new Date().toISOString()
    let updateData = {}
    let notificationSent = false

    if (action === 'approve') {
      updateData = {
        status: 'ACTIVE',
        available: true,
        updated_at: timestamp
      }
    } else if (action === 'reject') {
      if (!rejectReason) {
        return NextResponse.json({ error: 'Reject reason required' }, { status: 400 })
      }
      updateData = {
        status: 'REJECTED',
        available: false,
        rejection_reason: rejectReason,
        rejected_at: timestamp,
        updated_at: timestamp
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update listing
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      }
    )

    if (!updateRes.ok) {
      throw new Error('Failed to update listing')
    }

    // Send Telegram notification to partner
    if (listing.owner?.telegram_id) {
      const partnerMessage = action === 'approve'
        ? `✅ <b>Ваше объявление опубликовано!</b>\n\n📍 <b>${listing.title}</b>\n\n🎉 Теперь его видят арендаторы!\n\n<a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://gostaylo.com'}/listings/${listing.id}">Посмотреть объявление →</a>`
        : `❌ <b>Объявление отклонено</b>\n\n📍 <b>${listing.title}</b>\n\n📝 <b>Причина:</b>\n${rejectReason}\n\n<i>Исправьте замечания и отправьте повторно</i>`

      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: listing.owner.telegram_id,
            text: partnerMessage,
            parse_mode: 'HTML'
          })
        })
        notificationSent = true
      } catch (tgError) {
        console.error('Telegram to partner error:', tgError)
      }
    }

    // Send to admin topic
    const adminMessage = action === 'approve'
      ? `✅ <b>ОБЪЯВЛЕНИЕ ОДОБРЕНО</b>\n\n📍 ${listing.title}\n👤 ${listing.owner?.first_name || ''} ${listing.owner?.last_name || ''}\n📧 ${listing.owner?.email || ''}`
      : `❌ <b>ОБЪЯВЛЕНИЕ ОТКЛОНЕНО</b>\n\n📍 ${listing.title}\n👤 ${listing.owner?.first_name || ''}\n📝 Причина: ${rejectReason?.substring(0, 100)}`

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_TOPIC_ID,
          message_thread_id: LISTINGS_THREAD_ID,
          text: adminMessage,
          parse_mode: 'HTML'
        })
      })
    } catch (e) {
      console.error('Admin topic error:', e)
    }

    return NextResponse.json({ 
      success: true, 
      action,
      listingId,
      notificationSent
    })

  } catch (error) {
    console.error('Moderation PATCH error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
