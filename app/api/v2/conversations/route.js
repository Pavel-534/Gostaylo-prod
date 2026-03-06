import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

// GET /api/v2/conversations - List conversations for a user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role') // ADMIN, PARTNER, RENTER
    
    let query = `${SUPABASE_URL}/rest/v1/conversations?select=*,listing:listings(id,title,images,district),messages:messages(id,message,sender_role,created_at,is_read)&order=updated_at.desc`
    
    // Filter by user role
    if (role === 'PARTNER') {
      query += `&partner_id=eq.${userId}`
    } else if (role === 'RENTER') {
      query += `&renter_id=eq.${userId}`
    } else if (role === 'ADMIN') {
      // Admin sees all conversations
    }
    
    const res = await fetch(query, { headers })
    const data = await res.json()
    
    if (res.ok) {
      // Transform data - get last message and unread count
      const conversations = (data || []).map(conv => {
        const messages = conv.messages || []
        const lastMessage = messages.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        )[0]
        
        const unreadCount = messages.filter(m => 
          !m.is_read && m.sender_role !== role
        ).length
        
        return {
          id: conv.id,
          listing: conv.listing,
          partnerId: conv.partner_id,
          partnerName: conv.partner_name,
          renterId: conv.renter_id,
          renterName: conv.renter_name,
          lastMessage,
          unreadCount,
          updatedAt: conv.updated_at,
          createdAt: conv.created_at
        }
      })
      
      return NextResponse.json({ success: true, data: conversations })
    } else {
      return NextResponse.json({ success: false, error: data }, { status: 400 })
    }
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST /api/v2/conversations - Create new conversation
export async function POST(request) {
  try {
    const body = await request.json()
    const { listingId, partnerId, partnerName, renterId, renterName, adminId, adminName, type = 'INQUIRY' } = body
    
    // Check if conversation already exists
    let existingQuery = `${SUPABASE_URL}/rest/v1/conversations?listing_id=eq.${listingId}`
    if (partnerId && renterId) {
      existingQuery += `&partner_id=eq.${partnerId}&renter_id=eq.${renterId}`
    } else if (partnerId && adminId) {
      existingQuery += `&partner_id=eq.${partnerId}&admin_id=eq.${adminId}`
    }
    existingQuery += '&limit=1'
    
    const existingRes = await fetch(existingQuery, { headers })
    const existingData = await existingRes.json()
    
    if (existingData && existingData.length > 0) {
      return NextResponse.json({ success: true, data: existingData[0], existing: true })
    }
    
    // Create new conversation
    const conversationData = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      listing_id: listingId,
      partner_id: partnerId || null,
      partner_name: partnerName || null,
      renter_id: renterId || null,
      renter_name: renterName || null,
      admin_id: adminId || null,
      admin_name: adminName || null,
      type,
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(conversationData)
    })
    
    const data = await res.json()
    
    if (res.ok) {
      return NextResponse.json({ success: true, data: data[0] || conversationData })
    } else {
      return NextResponse.json({ success: false, error: data }, { status: 400 })
    }
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
