/**
 * FunnyRent 2.1 - Telegram Webhook v5.0
 * 
 * CRITICAL ROUTE - Must be PUBLIC (no auth required)
 * 
 * Pattern: Immediate Response + Fire-and-Forget
 * Runtime: Node.js (more stable than Edge for production)
 */

import { NextResponse } from 'next/server';

// Use Node.js runtime for stability
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';

/**
 * Fire-and-forget fetch (no await, non-blocking)
 */
function fireAndForget(url, options) {
  fetch(url, options).catch(err => console.error('[FIRE&FORGET ERROR]', err.message));
}

/**
 * Send Telegram message (fire-and-forget)
 */
function sendTelegram(chatId, text, options = {}) {
  fireAndForget(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options
    })
  });
}

/**
 * POST /api/webhooks/telegram
 * CRITICAL: Must return 200 immediately to avoid Telegram retries
 */
export async function POST(request) {
  // Step 1: Parse body fast
  let update;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Step 2: Extract message basics
  const message = update?.message;
  if (!message) {
    // Could be callback_query, edited_message, etc.
    return NextResponse.json({ ok: true });
  }

  // Only handle private messages
  if (message.chat?.type !== 'private') {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text || message.caption || '';
  const firstName = message.from?.first_name || 'User';
  const photo = message.photo;

  // Step 3: Handle commands (return 200 immediately, process async)
  
  if (text.startsWith('/start')) {
    sendTelegram(chatId,
      `🌴 <b>Aloha, ${firstName}!</b>\n\n` +
      `Добро пожаловать в <b>FunnyRent</b>!\n\n` +
      `📸 <b>Lazy Realtor</b>\n` +
      `Отправьте фото + описание для черновика.\n\n` +
      `📋 <b>Команды:</b>\n` +
      `/help — Справка\n` +
      `/link email — Привязать аккаунт\n` +
      `/status — Статус привязки`
    );
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/help')) {
    sendTelegram(chatId,
      `📖 <b>Помощь FunnyRent</b>\n\n` +
      `<b>Команды:</b>\n` +
      `/start — Начать работу\n` +
      `/help — Эта справка\n` +
      `/link email — Привязать аккаунт партнёра\n` +
      `/status — Проверить привязку\n\n` +
      `<b>Lazy Realtor:</b>\n` +
      `Отправьте фото с описанием → автоматический черновик объявления!`
    );
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/status')) {
    // Fire-and-forget status check
    handleStatusCheck(chatId);
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/link')) {
    const email = text.replace('/link', '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      sendTelegram(chatId, `❌ Формат: <code>/link your@email.com</code>`);
      return NextResponse.json({ ok: true });
    }
    // Fire-and-forget account linking
    handleLinkAccount(chatId, email, firstName);
    return NextResponse.json({ ok: true });
  }

  if (photo && photo.length > 0) {
    // Fire-and-forget photo processing
    handlePhotoUpload(chatId, message);
    return NextResponse.json({ ok: true });
  }

  // Default response for text without command
  if (text && !text.startsWith('/')) {
    sendTelegram(chatId,
      `📸 Отправьте <b>фото</b> с описанием для создания черновика!\n\n` +
      `/help — справка по командам`
    );
  }

  // Always return 200 immediately
  return NextResponse.json({ ok: true });
}

/**
 * Async: Check account link status
 */
async function handleStatusCheck(chatId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?telegram_id=eq.${chatId}&select=id,email,first_name,role`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const profiles = await res.json();
    const profile = profiles?.[0];

    if (profile) {
      sendTelegram(chatId,
        `✅ <b>Аккаунт привязан</b>\n\n` +
        `👤 ${profile.first_name || 'N/A'}\n` +
        `📧 ${profile.email}\n` +
        `🏷 ${profile.role}\n\n` +
        `📸 Отправляйте фото для создания черновиков!`
      );
    } else {
      sendTelegram(chatId,
        `❌ <b>Аккаунт не привязан</b>\n\n` +
        `Используйте команду:\n<code>/link your@email.com</code>`
      );
    }
  } catch (e) {
    console.error('[STATUS CHECK ERROR]', e);
    sendTelegram(chatId, `❌ Ошибка проверки статуса`);
  }
}

/**
 * Async: Link Telegram to Partner account
 */
async function handleLinkAccount(chatId, email, firstName) {
  try {
    // Find profile by email
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,role,first_name`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const profiles = await res.json();
    const profile = profiles?.[0];

    if (!profile) {
      sendTelegram(chatId, `❌ Email <b>${email}</b> не найден в системе`);
      return;
    }

    if (profile.role !== 'PARTNER' && profile.role !== 'ADMIN') {
      sendTelegram(chatId, `❌ Только партнёры и админы могут использовать бота`);
      return;
    }

    // Update profile with Telegram ID
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telegram_id: String(chatId),
        telegram_username: firstName,
        telegram_linked_at: new Date().toISOString()
      })
    });

    sendTelegram(chatId,
      `✅ <b>Аккаунт привязан!</b>\n\n` +
      `👤 ${profile.first_name || email}\n` +
      `🏷 ${profile.role}\n\n` +
      `📸 Теперь отправляйте фото для создания черновиков!`
    );
  } catch (e) {
    console.error('[LINK ERROR]', e);
    sendTelegram(chatId, `❌ Ошибка привязки аккаунта`);
  }
}

/**
 * Async: Process photo and create listing draft
 */
async function handlePhotoUpload(chatId, message) {
  try {
    // Check if user is linked
    const partnerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?telegram_id=eq.${chatId}&select=id,role,first_name`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const partners = await partnerRes.json();
    const partner = partners?.[0];

    if (!partner || (partner.role !== 'PARTNER' && partner.role !== 'ADMIN')) {
      sendTelegram(chatId,
        `❌ <b>Сначала привяжите аккаунт</b>\n\n` +
        `Используйте: <code>/link your@email.com</code>`
      );
      return;
    }

    // Notify user we're processing
    sendTelegram(chatId, `🏝 <b>Создаём черновик...</b>`);

    const photo = message.photo;
    const caption = message.caption || '';
    const fileId = photo[photo.length - 1].file_id;

    // Get photo URL from Telegram
    let photoUrl = null;
    try {
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      if (fileData.ok) {
        photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
      }
    } catch {}

    // Parse price from caption (e.g., "25000 thb" or "฿25000")
    const priceMatch = caption.match(/(\d+)\s*(thb|бат|฿|baht)/i);
    const price = priceMatch ? parseInt(priceMatch[1]) : 10000;

    // Extract title (first line of caption)
    const title = caption.split('\n')[0]?.substring(0, 100) || 'Объект из Telegram';

    // Create listing draft
    const listingId = `lst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
    
    const listingRes = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: listingId,
        owner_id: partner.id,
        category_id: '1',
        status: 'DRAFT',
        title,
        description: caption || 'Создано через Telegram',
        district: 'Phuket',
        base_price_thb: price,
        commission_rate: 15,
        images: photoUrl ? [photoUrl] : [],
        cover_image: photoUrl,
        metadata: {
          source: 'TELEGRAM_BOT',
          is_draft: true,
          telegram_chat_id: chatId,
          created_at: new Date().toISOString()
        },
        available: false,
        is_featured: false,
        views: 0
      })
    });

    if (listingRes.ok) {
      sendTelegram(chatId,
        `✅ <b>Черновик создан!</b>\n\n` +
        `📝 ${title}\n` +
        `💰 ${price.toLocaleString()} THB\n\n` +
        `✏️ Отредактируйте в личном кабинете и отправьте на модерацию.`
      );
    } else {
      const error = await listingRes.text();
      console.error('[LISTING CREATE ERROR]', error);
      sendTelegram(chatId, `❌ Ошибка создания черновика`);
    }
  } catch (e) {
    console.error('[PHOTO UPLOAD ERROR]', e);
    sendTelegram(chatId, `❌ Ошибка обработки фото`);
  }
}

/**
 * GET /api/webhooks/telegram
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'FunnyRent Telegram Webhook',
    version: '5.0',
    runtime: 'nodejs',
    pattern: 'immediate-response-fire-and-forget',
    timestamp: new Date().toISOString()
  });
}
