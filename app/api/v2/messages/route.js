import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

// POST /api/v2/messages - Send a message
export async function POST(request) {
  try {
    const body = await request.json()
    const { 
      conversationId, 
      senderId, 
      senderRole, 
      senderName, 
      message, 
      type = 'TEXT',
      metadata = null,
      notifyTelegram = false,
      recipientTelegramId = null
    } = body
    
    // Validate required fields
    if (!conversationId || !senderId || !message) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: conversationId, senderId, message' 
      }, { status: 400 })
    }
    
    // Create message
    const messageData = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole || 'USER',
      sender_name: senderName || 'User',
      message,
      type,
      metadata,
      is_read: false,
      created_at: new Date().toISOString()
    }
    
    const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(messageData)
    })
    
    const msgData = await msgRes.json()
    
    if (!msgRes.ok) {
      return NextResponse.json({ success: false, error: msgData }, { status: 400 })
    }
    
    // Update conversation's updated_at
    await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ updated_at: new Date().toISOString() })
    })
    
    // Send Telegram notification if requested
    let telegramSent = false
    if (notifyTelegram && recipientTelegramId && TELEGRAM_BOT_TOKEN) {
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: recipientTelegramId,
              text: `📬 <b>Новое сообщение от ${senderName}</b>\n\n${message.substring(0, 500)}${message.length > 500 ? '...' : ''}\n\n<i>Ответьте в личном кабинете Gostaylo</i>`,
              parse_mode: 'HTML'
            })
          }
        )
        telegramSent = tgRes.ok
      } catch (tgError) {
        console.error('Telegram notification failed:', tgError)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        id: messageData.id,
        conversationId: messageData.conversation_id,
        senderId: messageData.sender_id,
        senderRole: messageData.sender_role,
        senderName: messageData.sender_name,
        message: messageData.message,
        type: messageData.type,
        isRead: messageData.is_read,
        createdAt: messageData.created_at
      },
      telegramSent
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// GET /api/v2/messages - Get messages for a conversation (alternative endpoint)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    
    if (!conversationId) {
      return NextResponse.json({ success: false, error: 'conversationId required' }, { status: 400 })
    }
    
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conversationId}&order=created_at.asc&select=*`,
      { headers }
    )
    const data = await res.json()
    
    return NextResponse.json({ 
      success: true, 
      data: (data || []).map(m => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        senderRole: m.sender_role,
        senderName: m.sender_name,
        message: m.message,
        type: m.type,
        isRead: m.is_read,
        createdAt: m.created_at
      }))
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
