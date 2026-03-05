import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

// GET /api/v2/conversations/[id] - Get conversation with messages
export async function GET(request, { params }) {
  try {
    const conversationId = params.id
    
    // Get conversation
    const convRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}&select=*`,
      { headers }
    )
    const convData = await convRes.json()
    
    if (!convData || convData.length === 0) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }
    
    const conversation = convData[0]
    
    // Get messages
    const msgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conversationId}&order=created_at.asc&select=*`,
      { headers }
    )
    const messages = await msgRes.json()
    
    // Get listing if exists
    let listing = null
    if (conversation.listing_id) {
      const listingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${conversation.listing_id}&select=id,title,images,district,base_price_thb`,
        { headers }
      )
      const listingData = await listingRes.json()
      listing = listingData?.[0] || null
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        conversation: {
          ...conversation,
          partnerId: conversation.partner_id,
          partnerName: conversation.partner_name,
          renterId: conversation.renter_id,
          renterName: conversation.renter_name
        },
        messages: (messages || []).map(m => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          senderRole: m.sender_role,
          senderName: m.sender_name,
          message: m.message,
          type: m.type || 'TEXT',
          isRead: m.is_read,
          createdAt: m.created_at
        })),
        listing
      }
    })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PATCH /api/v2/conversations/[id] - Update conversation (mark read, close, etc)
export async function PATCH(request, { params }) {
  try {
    const conversationId = params.id
    const body = await request.json()
    const { action, readerId, readerRole } = body
    
    if (action === 'mark_read') {
      // Mark all messages as read for this reader
      await fetch(
        `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conversationId}&sender_role=neq.${readerRole}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ is_read: true })
        }
      )
      
      return NextResponse.json({ success: true, message: 'Messages marked as read' })
    }
    
    if (action === 'close') {
      await fetch(
        `${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'CLOSED', updated_at: new Date().toISOString() })
        }
      )
      
      return NextResponse.json({ success: true, message: 'Conversation closed' })
    }
    
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
