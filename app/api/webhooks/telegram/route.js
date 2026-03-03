/**
 * FunnyRent 2.1 - Telegram Webhook v6.0 (Stage 27)
 * 
 * CRITICAL ROUTE - Must be PUBLIC (no auth required)
 * 
 * NEW FEATURES:
 * - Advanced price extraction (markers, max number, ignore patterns)
 * - Supabase Storage upload (permanent URLs)
 * - Draft isolation (status = 'DRAFT', metadata.is_draft = true)
 * 
 * Runtime: Node.js
 * DB Column: base_price_thb
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';
const APP_URL = 'https://funnyrent.vercel.app';
const STORAGE_BUCKET = 'listings';

/**
 * Send Telegram message
 */
async function sendTelegram(chatId, text, options = {}) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      })
    });
    return (await response.json()).ok;
  } catch (e) {
    console.error('[TELEGRAM ERROR]', e.message);
    return false;
  }
}

/**
 * Extract email from /link command
 */
function extractEmailFromLinkCommand(text) {
  const cleanText = text.replace(/^\/link(@\w+)?\s*/i, '').trim();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = cleanText.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

/**
 * ADVANCED PRICE EXTRACTION (Stage 27)
 * 
 * Strategy:
 * 1. Look for number + currency marker (thb, bat, бат, ฿, baht)
 * 2. If no marker, find MAX number > 1000 (ignore bedroom/bathroom counts)
 * 3. Ignore numbers preceded by "до", "через", "от" (distances/dates)
 * 4. Default to 0 if nothing found
 */
function extractPrice(text) {
  if (!text) return 0;
  
  // Normalize text
  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');
  
  // Strategy 1: Look for number + currency marker
  // Matches: "25000 thb", "฿25000", "25 000 бат", "25000baht"
  const markerPatterns = [
    /(\d[\d\s]*)\s*(thb|бат|baht)/i,     // 25000 thb, 25000 бат
    /฿\s*(\d[\d\s]*)/,                    // ฿25000
    /(\d[\d\s]*)\s*฿/,                    // 25000฿
  ];
  
  for (const pattern of markerPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1] || match[0];
      const price = parseInt(numStr.replace(/[^\d]/g, ''));
      if (price > 0) {
        console.log(`[PRICE] Found with marker: ${price}`);
        return price;
      }
    }
  }
  
  // Strategy 2: Find all numbers, filter out invalid ones, take MAX
  // Remove numbers preceded by distance/time words
  const cleanedText = normalizedText
    .replace(/(?:до|через|от|в|за)\s*\d+/gi, '') // Remove "до 300м", "через 5 минут"
    .replace(/\d+\s*(?:м|km|метр|минут|мин|м²|кв\.?м)/gi, '') // Remove measurements
    .replace(/\d{1,2}[:.]\d{2}/g, ''); // Remove time patterns like 10:30
  
  // Find all remaining numbers
  const numbers = cleanedText.match(/\d+/g);
  
  if (numbers) {
    // Filter: must be > 1000 (typical rental prices) and < 10000000
    const validPrices = numbers
      .map(n => parseInt(n))
      .filter(n => n >= 1000 && n < 10000000);
    
    if (validPrices.length > 0) {
      const maxPrice = Math.max(...validPrices);
      console.log(`[PRICE] Found max number: ${maxPrice}`);
      return maxPrice;
    }
  }
  
  // Strategy 3: Default to 0
  console.log('[PRICE] No price found, defaulting to 0');
  return 0;
}

/**
 * Download file from Telegram and upload to Supabase Storage
 * Returns the public URL or null
 */
async function uploadPhotoToStorage(fileId, listingId) {
  try {
    // 1. Get file path from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    
    if (!fileData.ok || !fileData.result?.file_path) {
      console.error('[STORAGE] Failed to get file path from Telegram');
      return null;
    }
    
    const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
    
    // 2. Download the file
    const downloadRes = await fetch(telegramFileUrl);
    if (!downloadRes.ok) {
      console.error('[STORAGE] Failed to download from Telegram');
      return null;
    }
    
    const fileBuffer = await downloadRes.arrayBuffer();
    const contentType = downloadRes.headers.get('content-type') || 'image/jpeg';
    
    // 3. Generate unique filename
    const ext = fileData.result.file_path.split('.').pop() || 'jpg';
    const fileName = `${listingId}/${Date.now()}.${ext}`;
    
    // 4. Upload to Supabase Storage
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'true'
        },
        body: fileBuffer
      }
    );
    
    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      console.error('[STORAGE] Upload failed:', error);
      
      // Try to create bucket if it doesn't exist
      if (error.includes('not found') || error.includes('Bucket')) {
        await createStorageBucket();
        // Retry upload
        const retryRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': contentType,
              'x-upsert': 'true'
            },
            body: fileBuffer
          }
        );
        if (!retryRes.ok) {
          console.error('[STORAGE] Retry upload failed');
          return null;
        }
      } else {
        return null;
      }
    }
    
    // 5. Return public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`;
    console.log(`[STORAGE] Uploaded: ${publicUrl}`);
    return publicUrl;
    
  } catch (e) {
    console.error('[STORAGE ERROR]', e);
    return null;
  }
}

/**
 * Create storage bucket if it doesn't exist
 */
async function createStorageBucket() {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: STORAGE_BUCKET,
        name: STORAGE_BUCKET,
        public: true,
        file_size_limit: 10485760, // 10MB
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      })
    });
    
    if (res.ok) {
      console.log('[STORAGE] Bucket created successfully');
    } else {
      const error = await res.text();
      console.log('[STORAGE] Bucket creation response:', error);
    }
  } catch (e) {
    console.error('[STORAGE] Bucket creation error:', e);
  }
}

/**
 * POST /api/webhooks/telegram
 */
export async function POST(request) {
  let chatId;
  
  try {
    const update = await request.json();
    const message = update?.message;
    
    if (!message || message.chat?.type !== 'private') {
      return NextResponse.json({ ok: true });
    }
    
    chatId = message.chat.id;
    const text = message.text || message.caption || '';
    const firstName = message.from?.first_name || 'User';
    const username = message.from?.username || '';
    const photo = message.photo;
    
    console.log(`[WEBHOOK v6.0] Chat: ${chatId}, User: ${firstName}, Text: ${text?.substring(0, 50)}`);
    
    // /help
    if (text.startsWith('/help')) {
      await sendTelegram(chatId,
        '📖 <b>Инструкция FunnyRent</b>\n\n' +
        '1. <b>Привязка:</b> <code>/link email@test.com</code>\n' +
        '2. <b>Статус:</b> <code>/status</code>\n' +
        '3. <b>Lazy Realtor:</b> Отправьте фото с описанием (например: "Вилла на Раваи, 25000 THB")\n' +
        '4. <b>Помощь:</b> <code>/help</code>\n\n' +
        '💡 <b>Цена:</b> Укажите в описании (25000 thb, ฿25000, 25000 бат)\n\n' +
        `🌐 <b>Личный кабинет:</b> ${APP_URL}`
      );
      return NextResponse.json({ ok: true });
    }
    
    // /start
    if (text.startsWith('/start')) {
      await sendTelegram(chatId,
        `🌴 <b>Aloha, ${firstName}!</b>\n\n` +
        'Добро пожаловать в <b>FunnyRent</b>!\n\n' +
        '📸 <b>Lazy Realtor</b>\n' +
        'Отправьте фото + описание → получите черновик.\n\n' +
        '📋 <b>Команды:</b>\n' +
        '/help — Справка\n' +
        '/link email — Привязать аккаунт\n' +
        '/status — Проверить привязку'
      );
      return NextResponse.json({ ok: true });
    }
    
    // /status
    if (text.startsWith('/status')) {
      await handleStatusCheck(chatId);
      return NextResponse.json({ ok: true });
    }
    
    // /link
    if (text.startsWith('/link')) {
      const email = extractEmailFromLinkCommand(text);
      if (!email) {
        await sendTelegram(chatId,
          '❌ <b>Неверный формат</b>\n\n' +
          'Используйте: <code>/link ваш@email.com</code>'
        );
        return NextResponse.json({ ok: true });
      }
      await handleLinkAccount(chatId, email, firstName, username);
      return NextResponse.json({ ok: true });
    }
    
    // Photo upload (Lazy Realtor)
    if (photo && photo.length > 0) {
      await handlePhotoUpload(chatId, message, firstName);
      return NextResponse.json({ ok: true });
    }
    
    // Default
    if (text && !text.startsWith('/')) {
      await sendTelegram(chatId,
        '📸 Отправьте <b>фото с описанием</b> для создания черновика!\n\n' +
        '/help — справка'
      );
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('[WEBHOOK ERROR]', error);
    if (chatId) {
      await sendTelegram(chatId, '⚠️ Ошибка обработки. Попробуйте ещё раз.');
    }
    return NextResponse.json({ ok: true });
  }
}

/**
 * Check account link status
 */
async function handleStatusCheck(chatId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?telegram_id=eq.${chatId}&select=id,email,first_name,last_name,role`,
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
      await sendTelegram(chatId,
        '✅ <b>Аккаунт привязан</b>\n\n' +
        `👤 ${profile.first_name || ''} ${profile.last_name || ''}\n` +
        `📧 ${profile.email}\n` +
        `🏷 ${profile.role}\n\n` +
        `🌐 ${APP_URL}`
      );
    } else {
      await sendTelegram(chatId,
        '❌ <b>Аккаунт не привязан</b>\n\n' +
        '<code>/link ваш@email.com</code>'
      );
    }
  } catch (e) {
    console.error('[STATUS ERROR]', e);
    await sendTelegram(chatId, '⚠️ Ошибка проверки статуса.');
  }
}

/**
 * Link Telegram to Partner account
 */
async function handleLinkAccount(chatId, email, firstName, username) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,role,first_name,last_name`,
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
      await sendTelegram(chatId, `❌ Email <b>${email}</b> не найден в системе.`);
      return;
    }

    if (!['PARTNER', 'ADMIN', 'MODERATOR'].includes(profile.role)) {
      await sendTelegram(chatId, '❌ Бот доступен только для партнёров и админов.');
      return;
    }

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telegram_id: String(chatId),
        telegram_username: username || firstName,
        telegram_linked_at: new Date().toISOString()
      })
    });

    await sendTelegram(chatId,
      '✅ <b>Аккаунт привязан!</b>\n\n' +
      `👤 ${profile.first_name || ''} ${profile.last_name || ''}\n` +
      `🏷 ${profile.role}\n\n` +
      '📸 Отправьте фото для создания черновика!'
    );
  } catch (e) {
    console.error('[LINK ERROR]', e);
    await sendTelegram(chatId, '⚠️ Ошибка привязки.');
  }
}

/**
 * Process photo and create listing DRAFT
 * Status: 'DRAFT' (NOT visible to Admin until Partner publishes)
 */
async function handlePhotoUpload(chatId, message, firstName) {
  try {
    // Check if user is linked
    const partnerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?telegram_id=eq.${chatId}&select=id,role,first_name,last_name`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const partners = await partnerRes.json();
    const partner = partners?.[0];

    if (!partner || !['PARTNER', 'ADMIN'].includes(partner.role)) {
      await sendTelegram(chatId,
        '❌ <b>Сначала привяжите аккаунт</b>\n\n' +
        '<code>/link ваш@email.com</code>'
      );
      return;
    }

    // Immediate confirmation
    await sendTelegram(chatId, '🏝 <b>Создаём черновик...</b>');

    const photo = message.photo;
    const caption = message.caption || '';
    const fileId = photo[photo.length - 1].file_id;
    
    // Generate listing ID
    const listingId = `lst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;

    // Upload photo to Supabase Storage (permanent URL)
    const photoUrl = await uploadPhotoToStorage(fileId, listingId);

    // Extract price using advanced logic
    const price = extractPrice(caption);

    // Extract title (first line, max 100 chars)
    const lines = caption.split('\n').filter(l => l.trim());
    const title = lines[0]?.substring(0, 100) || `Объект от ${firstName}`;
    const description = lines.slice(1).join('\n') || caption || 'Создано через Telegram';

    console.log(`[LAZY REALTOR] Creating DRAFT: ${listingId}, Price: ${price}, Photo: ${photoUrl ? 'yes' : 'no'}`);

    // Create listing with status = 'DRAFT'
    // This will NOT appear in Admin panel until Partner clicks "Publish"
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
        status: 'DRAFT',  // CRITICAL: Draft status, not visible to admin
        title,
        description,
        district: 'Phuket',
        base_price_thb: price,
        commission_rate: 15,
        images: photoUrl ? [photoUrl] : [],
        cover_image: photoUrl,
        metadata: {
          source: 'TELEGRAM_LAZY_REALTOR',
          is_draft: true,
          telegram_chat_id: String(chatId),
          created_by: partner.first_name || firstName,
          created_at: new Date().toISOString(),
          needs_review: false  // Will be true when Partner publishes
        },
        available: false,
        is_featured: false,
        views: 0
      })
    });

    if (listingRes.ok) {
      const priceText = price > 0 ? `฿${price.toLocaleString()}` : 'Не указана';
      
      await sendTelegram(chatId,
        '✅ <b>Черновик создан!</b>\n\n' +
        `📝 <b>Название:</b> ${title}\n` +
        `💰 <b>Цена:</b> ${priceText}\n` +
        `📸 <b>Фото:</b> ${photoUrl ? '✓' : '✗'}\n\n` +
        '⚠️ <b>Важно:</b> Черновик НЕ виден модераторам.\n' +
        'Отредактируйте и нажмите "Опубликовать" в ЛК.\n\n' +
        `🌐 ${APP_URL}/partner/listings`
      );
    } else {
      const error = await listingRes.text();
      console.error('[LISTING CREATE ERROR]', error);
      await sendTelegram(chatId, '❌ Ошибка создания черновика. Попробуйте ещё раз.');
    }
  } catch (e) {
    console.error('[PHOTO ERROR]', e);
    await sendTelegram(chatId, '⚠️ Ошибка обработки фото.');
  }
}

/**
 * GET /api/webhooks/telegram - Health check
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'FunnyRent Telegram Webhook',
    version: '6.0',
    stage: 27,
    runtime: 'nodejs',
    features: [
      'Advanced price extraction',
      'Supabase Storage upload',
      'Draft isolation (status=DRAFT)',
      '/start, /help, /link, /status'
    ],
    db_column: 'base_price_thb',
    storage_bucket: STORAGE_BUCKET,
    timestamp: new Date().toISOString()
  });
}
