/**
 * Gostaylo - Telegram Webhook v7.0 (PRODUCTION)
 * 
 * CRITICAL ROUTE - Must be PUBLIC (no auth required)
 * 
 * FEATURES:
 * - Advanced price extraction (markers, max number, ignore patterns)
 * - Supabase Storage upload (permanent URLs)
 * - Server-side image compression via Sharp (1920px max, WebP)
 * - Draft isolation: Uses status='INACTIVE' + metadata.is_draft=true
 * 
 * Runtime: Node.js
 * DB Column: base_price_thb
 */

import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gostaylo.com';
const STORAGE_BUCKET = 'listings';

// Image compression settings
const IMAGE_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 80,
  format: 'webp'
};

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
 * Compress image using Sharp
 * - Max 1920px
 * - WebP format
 * - 80% quality
 */
async function compressImage(inputBuffer) {
  try {
    const startSize = inputBuffer.byteLength;
    
    const compressed = await sharp(Buffer.from(inputBuffer))
      .resize(IMAGE_CONFIG.maxWidth, IMAGE_CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: IMAGE_CONFIG.quality })
      .toBuffer();
    
    const endSize = compressed.byteLength;
    const ratio = ((1 - endSize / startSize) * 100).toFixed(1);
    
    console.log(`[COMPRESS] ${(startSize/1024).toFixed(1)}KB → ${(endSize/1024).toFixed(1)}KB (-${ratio}%)`);
    
    return compressed;
  } catch (e) {
    console.error('[COMPRESS ERROR]', e.message);
    // Return original if compression fails
    return Buffer.from(inputBuffer);
  }
}

/**
 * Download file from Telegram and upload to Supabase Storage
 * Returns the public URL or null
 */
async function uploadPhotoToStorage(fileId, listingId) {
  try {
    console.log(`[STORAGE] Starting upload for fileId: ${fileId}, listingId: ${listingId}`);
    
    // Validate environment
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[STORAGE] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return null;
    }
    
    // 1. Get file path from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    
    console.log(`[STORAGE] Telegram getFile response:`, JSON.stringify(fileData));
    
    if (!fileData.ok || !fileData.result?.file_path) {
      console.error('[STORAGE] Failed to get file path from Telegram:', fileData.description || 'unknown');
      return null;
    }
    
    const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
    console.log(`[STORAGE] Downloading from: ${telegramFileUrl.replace(BOT_TOKEN, 'BOT_TOKEN')}`);
    
    // 2. Download the file
    const downloadRes = await fetch(telegramFileUrl);
    if (!downloadRes.ok) {
      console.error(`[STORAGE] Failed to download from Telegram: ${downloadRes.status} ${downloadRes.statusText}`);
      return null;
    }
    
    const rawBuffer = await downloadRes.arrayBuffer();
    console.log(`[STORAGE] Downloaded ${(rawBuffer.byteLength / 1024).toFixed(1)}KB`);
    
    // 3. Compress image
    const compressedBuffer = await compressImage(rawBuffer);
    
    // 4. Generate unique filename (always .webp after compression)
    const fileName = `${listingId}/${Date.now()}.webp`;
    
    // 5. Upload to Supabase Storage
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`;
    console.log(`[STORAGE] Uploading to: ${uploadUrl}`);
    
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'image/webp',
        'x-upsert': 'true'
      },
      body: compressedBuffer
    });
    
    const uploadResponseText = await uploadRes.text();
    console.log(`[STORAGE] Upload response: ${uploadRes.status} - ${uploadResponseText}`);
    
    if (!uploadRes.ok) {
      // Try to create bucket if it doesn't exist
      if (uploadResponseText.includes('not found') || uploadResponseText.includes('Bucket') || uploadResponseText.includes('bucket')) {
        console.log('[STORAGE] Bucket may not exist, attempting to create...');
        await createStorageBucket();
        
        // Retry upload
        const retryRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'image/webp',
            'x-upsert': 'true'
          },
          body: compressedBuffer
        });
        
        const retryText = await retryRes.text();
        console.log(`[STORAGE] Retry upload response: ${retryRes.status} - ${retryText}`);
        
        if (!retryRes.ok) {
          console.error('[STORAGE] Retry upload failed');
          return null;
        }
      } else {
        console.error('[STORAGE] Upload failed with error:', uploadResponseText);
        return null;
      }
    }
    
    // 6. Return public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`;
    console.log(`[STORAGE] SUCCESS! Public URL: ${publicUrl}`);
    return publicUrl;
    
  } catch (e) {
    console.error('[STORAGE ERROR]', e.message, e.stack);
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
    const telegramUserId = message.from?.id; // Telegram user ID
    const photo = message.photo;
    
    console.log(`[WEBHOOK v6.0] Chat: ${chatId}, User: ${firstName}, TelegramId: ${telegramUserId}, Text: ${text?.substring(0, 50)}`);
    
    // /help
    if (text.startsWith('/help')) {
      await sendTelegram(chatId,
        '📖 <b>Инструкция Gostaylo</b>\n\n' +
        '1. <b>Привязка:</b> <code>/link email@test.com</code>\n' +
        '2. <b>Статус:</b> <code>/status</code>\n' +
        '3. <b>Lazy Realtor:</b> Отправьте фото с описанием (например: "Вилла на Раваи, 25000 THB")\n' +
        '4. <b>Помощь:</b> <code>/help</code>\n\n' +
        '💡 <b>Цена:</b> Укажите в описании (25000 thb, ฿25000, 25000 бат)\n\n' +
        `🌐 <b>Личный кабинет:</b> ${APP_URL}`
      );
      return NextResponse.json({ ok: true });
    }
    
    // /start (with deep link support)
    if (text.startsWith('/start')) {
      // Check for deep link parameter: /start link_<user_id>
      const deepLinkMatch = text.match(/^\/start\s+link_([a-zA-Z0-9-]+)$/);
      
      if (deepLinkMatch) {
        const userId = deepLinkMatch[1];
        // Auto-link account using user ID and chat_id
        await handleDeepLink(chatId, userId, firstName, username, telegramUserId);
        return NextResponse.json({ ok: true });
      }
      
      // Regular /start command
      await sendTelegram(chatId,
        `🌴 <b>Aloha, ${firstName}!</b>\n\n` +
        'Добро пожаловать в <b>Gostaylo</b>!\n\n' +
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
 * Handle Deep Link - Link Telegram via user ID (from profile page)
 */
async function handleDeepLink(chatId, userId, firstName, username, telegramId) {
  console.log(`[DEEP LINK] Attempt: userId=${userId}, telegramId=${telegramId}, chatId=${chatId}`);
  
  try {
    // Find user by ID
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,role,first_name,last_name,telegram_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const profiles = await res.json();
    const profile = profiles?.[0];

    console.log(`[DEEP LINK] Profile found:`, profile ? profile.email : 'NOT FOUND');

    if (!profile) {
      await sendTelegram(chatId, 
        '❌ <b>Ошибка привязки</b>\n\n' +
        'Пользователь не найден. Попробуйте ещё раз с профиля.\n\n' +
        `<i>ID: ${userId}</i>`
      );
      return;
    }

    // Check if already linked to another Telegram
    if (profile.telegram_id && profile.telegram_id !== chatId.toString()) {
      await sendTelegram(chatId, 
        '❌ <b>Аккаунт уже привязан</b>\n\n' +
        'Этот аккаунт уже связан с другим Telegram.\n' +
        'Обратитесь в поддержку для смены привязки.'
      );
      return;
    }

    // Update profile with Telegram chat_id
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        telegram_id: chatId.toString(),
        telegram_username: username || firstName,
        telegram_linked_at: new Date().toISOString()
      })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('[DEEP LINK] Update failed:', errText);
      throw new Error('DB update failed');
    }

    const roleLabel = {
      'ADMIN': 'Администратор',
      'PARTNER': 'Партнёр',
      'RENTER': 'Арендатор',
      'MODERATOR': 'Модератор'
    }[profile.role] || profile.role;

    await sendTelegram(chatId,
      '✅ <b>Успешно!</b>\n\n' +
      '<b>Telegram привязан к вашему аккаунту:</b>\n\n' +
      `👤 ${profile.first_name || ''} ${profile.last_name || ''}\n` +
      `📧 ${profile.email}\n` +
      `🏷 ${roleLabel}\n\n` +
      '🔔 Теперь вы будете получать уведомления о бронированиях и важных событиях.'
    );
    
    console.log(`[TELEGRAM] Deep link SUCCESS: ${profile.email} -> ${chatId}`);
  } catch (e) {
    console.error('[DEEP LINK ERROR]', e);
    await sendTelegram(chatId, 
      '⚠️ <b>Ошибка привязки</b>\n\n' +
      'Произошла техническая ошибка. Попробуйте позже или обратитесь в поддержку.'
    );
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
 * Uses: status='INACTIVE' + metadata.is_draft=true
 * (INACTIVE is a valid enum value; DRAFT is NOT in the enum)
 * Admin panel will filter out metadata.is_draft=true
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

    // Create listing with status = 'INACTIVE' (valid enum) + metadata.is_draft = true
    // This combination means "draft" - not visible in Admin panel
    // Admin panel filters: status=PENDING AND metadata.is_draft IS NOT true
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
        status: 'INACTIVE',  // Valid enum value (DRAFT is not in enum)
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
    service: 'Gostaylo Telegram Webhook',
    version: '7.0',
    stage: 28,
    runtime: 'nodejs',
    features: [
      'Advanced price extraction',
      'Supabase Storage upload',
      'Server-side image compression (Sharp)',
      'WebP conversion (1920px, 80% quality)',
      'Draft isolation (INACTIVE + metadata.is_draft)',
      '/start, /help, /link, /status'
    ],
    db_column: 'base_price_thb',
    storage_bucket: STORAGE_BUCKET,
    image_config: IMAGE_CONFIG,
    timestamp: new Date().toISOString()
  });
}
