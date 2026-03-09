/**
 * Gostaylo - Telegram Admin API
 * GET /api/v2/admin/telegram - Get status & auto-setup webhook
 * POST /api/v2/admin/telegram - Manual actions (setWebhook, deleteWebhook, testMessage)
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gostaylo.com';
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/telegram`;

// Auto-setup webhook if not configured
async function ensureWebhookConfigured() {
  if (!BOT_TOKEN) return { success: false, error: 'No bot token' };
  
  try {
    // Check current webhook
    const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const infoData = await infoResponse.json();
    
    if (infoData.ok) {
      const currentUrl = infoData.result.url;
      
      // If webhook is not set or points to wrong URL, update it
      if (!currentUrl || !currentUrl.includes('gostaylo.com')) {
        console.log('[TELEGRAM] Auto-setting webhook to:', WEBHOOK_URL);
        
        const setResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: WEBHOOK_URL,
            allowed_updates: ['message', 'callback_query']
          })
        });
        
        const setData = await setResponse.json();
        console.log('[TELEGRAM] Webhook auto-setup result:', setData.ok ? 'SUCCESS' : setData.description);
        
        return { 
          success: setData.ok, 
          autoConfigured: true, 
          message: setData.ok ? 'Webhook auto-configured' : setData.description 
        };
      }
      
      return { success: true, autoConfigured: false, currentUrl };
    }
    
    return { success: false, error: infoData.description };
  } catch (error) {
    console.error('[TELEGRAM] Auto-setup error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function GET() {
  if (!BOT_TOKEN) {
    return NextResponse.json({ 
      success: false, 
      error: 'TELEGRAM_BOT_TOKEN not configured',
      configured: false
    }, { status: 500 });
  }
  
  try {
    // Auto-setup webhook on every GET request
    const autoSetup = await ensureWebhookConfigured();
    
    // Get bot info
    const meResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const meData = await meResponse.json();
    
    // Get webhook info (fresh after potential auto-setup)
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookData = await webhookResponse.json();
    
    const webhookOk = webhookData.ok && 
                      webhookData.result.url && 
                      webhookData.result.url.includes('gostaylo.com');
    
    return NextResponse.json({
      success: true,
      configured: true,
      bot: meData.ok ? {
        id: meData.result.id,
        username: meData.result.username,
        firstName: meData.result.first_name,
        link: `https://t.me/${meData.result.username}`
      } : null,
      webhook: webhookData.ok ? {
        url: webhookData.result.url,
        active: webhookOk,
        pendingUpdateCount: webhookData.result.pending_update_count,
        lastErrorDate: webhookData.result.last_error_date 
          ? new Date(webhookData.result.last_error_date * 1000).toISOString() 
          : null,
        lastErrorMessage: webhookData.result.last_error_message
      } : null,
      autoSetup,
      expectedWebhookUrl: WEBHOOK_URL
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      configured: !!BOT_TOKEN
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
        message: data.description || (data.ok ? 'Webhook set successfully' : 'Failed'),
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
      const chatId = body.chatId || process.env.TELEGRAM_ADMIN_GROUP_ID;
      
      if (!chatId) {
        return NextResponse.json({ 
          success: false, 
          error: 'TELEGRAM_ADMIN_GROUP_ID not configured' 
        }, { status: 400 });
      }
      
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ *Тест подключения Gostaylo*\n\n🌐 Домен: ${BASE_URL}\n⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`,
          parse_mode: 'Markdown'
        })
      });
      
      const data = await response.json();
      
      return NextResponse.json({
        success: data.ok,
        message: data.ok ? 'Test message sent!' : (data.description || 'Failed'),
        chatId
      });
    }
    
    if (action === 'send_moderation_notification') {
      const chatId = process.env.TELEGRAM_ADMIN_GROUP_ID;
      const TOPIC_ID = 17; // Topic for new partners
      
      if (!chatId) {
        return NextResponse.json({ 
          success: false, 
          error: 'TELEGRAM_ADMIN_GROUP_ID not configured' 
        }, { status: 400 });
      }
      
      const listing = body.listing;
      if (!listing) {
        return NextResponse.json({ success: false, error: 'No listing data' }, { status: 400 });
      }
      
      const message = `🔔 <b>НОВАЯ ЗАЯВКА НА МОДЕРАЦИЮ</b>\n\n` +
        `📝 <b>ID:</b> ${listing.id}\n` +
        `🏠 <b>Название:</b> ${listing.title || 'Без названия'}\n` +
        `💰 <b>Цена:</b> ฿${listing.base_price_thb?.toLocaleString() || 0}/день\n` +
        `📸 <b>Фото:</b> ${listing.images_count || 0}\n` +
        `📍 <b>Район:</b> ${listing.district || 'Не указан'}\n\n` +
        `<i>Листинг готов к проверке</i>\n\n` +
        `<a href="${BASE_URL}/admin/moderation">Открыть модерацию</a>`;
      
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_thread_id: TOPIC_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      const data = await response.json();
      
      return NextResponse.json({
        success: data.ok,
        message: data.ok ? 'Notification sent' : (data.description || 'Failed')
      });
    }
    
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
