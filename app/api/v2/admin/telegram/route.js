/**
 * Gostaylo - Telegram Admin API
 * POST /api/v2/admin/telegram - Set webhook
 * GET /api/v2/admin/telegram - Test connection & get info
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gostaylo.com';
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/telegram`;

export async function GET() {
  if (!BOT_TOKEN) {
    return NextResponse.json({ 
      success: false, 
      error: 'TELEGRAM_BOT_TOKEN not configured' 
    }, { status: 500 });
  }
  
  try {
    // Get bot info
    const meResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const meData = await meResponse.json();
    
    // Get webhook info
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookData = await webhookResponse.json();
    
    return NextResponse.json({
      success: true,
      bot: meData.ok ? {
        id: meData.result.id,
        username: meData.result.username,
        firstName: meData.result.first_name
      } : null,
      webhook: webhookData.ok ? {
        url: webhookData.result.url,
        hasCustomCertificate: webhookData.result.has_custom_certificate,
        pendingUpdateCount: webhookData.result.pending_update_count,
        lastErrorDate: webhookData.result.last_error_date,
        lastErrorMessage: webhookData.result.last_error_message
      } : null,
      expectedWebhookUrl: WEBHOOK_URL
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ 
      success: false, 
      error: 'TELEGRAM_BOT_TOKEN not configured' 
    }, { status: 500 });
  }
  
  let body = {};
  try {
    body = await request.json();
  } catch (e) {}
  
  const action = body.action || 'setWebhook';
  
  try {
    if (action === 'setWebhook') {
      // Set webhook to current domain
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ['message', 'callback_query']
        })
      });
      
      const data = await response.json();
      
      return NextResponse.json({
        success: data.ok,
        message: data.description || (data.ok ? 'Webhook set successfully' : 'Failed to set webhook'),
        webhookUrl: WEBHOOK_URL
      });
    }
    
    if (action === 'deleteWebhook') {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
      const data = await response.json();
      
      return NextResponse.json({
        success: data.ok,
        message: data.description || 'Webhook deleted'
      });
    }
    
    if (action === 'testMessage') {
      const chatId = body.chatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
      
      if (!chatId) {
        return NextResponse.json({ 
          success: false, 
          error: 'Chat ID not provided' 
        }, { status: 400 });
      }
      
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ Тест подключения Gostaylo успешен!',
          parse_mode: 'HTML'
        })
      });
      
      const data = await response.json();
      
      return NextResponse.json({
        success: data.ok,
        message: data.ok ? 'Test message sent' : (data.description || 'Failed to send message'),
        chatId
      });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Unknown action' 
    }, { status: 400 });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
