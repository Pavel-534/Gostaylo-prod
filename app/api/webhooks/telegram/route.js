/**
 * FunnyRent 2.1 - Telegram Webhook v5.1
 * 
 * CRITICAL ROUTE - Must be PUBLIC (no auth required)
 * 
 * Pattern: Immediate Response + Fire-and-Forget
 * Runtime: Node.js (more stable than Edge for production)
 * 
 * Commands: /start, /help, /link <email>, /status
 * Feature: Lazy Realtor (photo → draft listing)
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
 * Send Telegram message with retry
 */
async function sendTelegramAsync(chatId, text, options = {}) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...options
      })
    });
    return response.ok;
  } catch (e) {
    console.error('[TELEGRAM SEND ERROR]', e.message);
    return false;
  }
}

/**
 * Fire-and-forget Telegram send (non-blocking)
 */
function sendTelegram(chatId, text, options = {}) {
  sendTelegramAsync(chatId, text, options).catch(() => {});
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
    return NextResponse.json({ ok: true });
  }

  // Only handle private messages
  if (message.chat?.type !== 'private') {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text || message.caption || '';
  const firstName = message.from?.first_name || 'User';
  const username = message.from?.username || '';
  const photo = message.photo;

  console.log(`[WEBHOOK] Chat: ${chatId}, User: ${firstName}, Text: ${text?.substring(0, 50)}`);

  // Step 3: Handle commands
  
  if (text.startsWith('/start')) {
    sendTelegram(chatId,
      `🌴 <b>Aloha, ${firstName}!</b>\n\n` +
      `Добро пожаловать в <b>FunnyRent</b> — платформу для аренды недвижимости на Пхукете!\n\n` +
      `📸 <b>Lazy Realtor</b>\n` +
      `Отправьте фото + описание → получите черновик объявления.\n\n` +
      `📋 <b>Команды:</b>\n` +
      `/help — Подробная справка\n` +
      `/link email — Привязать аккаунт\n` +
      `/status — Проверить привязку`
    );
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/help')) {
    sendTelegram(chatId,
      `📖 <b>FunnyRent Bot — Справка</b>\n\n` +
      `<b>🔗 Привязка аккаунта:</b>\n` +
      `1. Зарегистрируйтесь как партнёр на сайте\n` +
      `2. Отправьте: <code>/link ваш@email.com</code>\n` +
      `3. Готово! Теперь доступен Lazy Realtor\n\n` +
      `<b>📸 Lazy Realtor:</b>\n` +
      `Быстрое создание черновика объявления:\n` +
      `1. Отправьте <b>фото</b> объекта\n` +
      `2. Добавьте <b>описание</b> в подписи:\n` +
      `   • Первая строка = название\n` +
      `   • Цена: <code>25000 thb</code> или <code>฿25000</code>\n` +
      `3. Бот создаст черновик автоматически\n` +
      `4. Отредактируйте в личном кабинете\n\n` +
      `<b>📋 Все команды:</b>\n` +
      `/start — Приветствие\n` +
      `/help — Эта справка\n` +
      `/link email — Привязать аккаунт\n` +
      `/status — Статус привязки\n\n` +
      `❓ Вопросы? Напишите в поддержку.`
    );
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/status')) {
    handleStatusCheck(chatId);
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/link')) {
    const email = text.replace('/link', '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      sendTelegram(chatId, 
        `❌ <b>Неверный формат</b>\n\n` +
        `Используйте: <code>/link ваш@email.com</code>\n\n` +
        `Пример: <code>/link partner@funnyrent.com</code>`
      );
      return NextResponse.json({ ok: true });
    }
    handleLinkAccount(chatId, email, firstName, username);
    return NextResponse.json({ ok: true });
  }

  if (photo && photo.length > 0) {
    handlePhotoUpload(chatId, message, firstName);
    return NextResponse.json({ ok: true });
  }

  // Default response for text without command
  if (text && !text.startsWith('/')) {
    sendTelegram(chatId,
      `📸 Отправьте <b>фото с описанием</b> для создания черновика!\n\n` +
      `💡 <b>Совет:</b> добавьте цену в подписи (например: <code>35000 thb</code>)\n\n` +
      `/help — справка по командам`
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * Async: Check account link status
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
      sendTelegram(chatId,
        `✅ <b>Аккаунт привязан</b>\n\n` +
        `👤 <b>Имя:</b> ${profile.first_name || ''} ${profile.last_name || ''}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `🏷 <b>Роль:</b> ${profile.role}\n\n` +
        `📸 Отправляйте фото для создания черновиков!`
      );
    } else {
      sendTelegram(chatId,
        `❌ <b>Аккаунт не привязан</b>\n\n` +
        `Чтобы использовать бота, привяжите аккаунт партнёра:\n\n` +
        `<code>/link ваш@email.com</code>`
      );
    }
  } catch (e) {
    console.error('[STATUS CHECK ERROR]', e);
    sendTelegram(chatId, `❌ Ошибка проверки статуса. Попробуйте позже.`);
  }
}

/**
 * Async: Link Telegram to Partner account
 */
async function handleLinkAccount(chatId, email, firstName, username) {
  try {
    // Find profile by email
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
      sendTelegram(chatId, 
        `❌ <b>Email не найден</b>\n\n` +
        `Аккаунт <b>${email}</b> не зарегистрирован в системе.\n\n` +
        `Убедитесь, что вы используете email, указанный при регистрации партнёра.`
      );
      return;
    }

    if (profile.role !== 'PARTNER' && profile.role !== 'ADMIN' && profile.role !== 'MODERATOR') {
      sendTelegram(chatId, 
        `❌ <b>Доступ ограничен</b>\n\n` +
        `Telegram-бот доступен только для партнёров, модераторов и администраторов.`
      );
      return;
    }

    // Update profile with Telegram ID
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
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

    if (updateRes.ok) {
      sendTelegram(chatId,
        `✅ <b>Аккаунт успешно привязан!</b>\n\n` +
        `👤 <b>Имя:</b> ${profile.first_name || ''} ${profile.last_name || ''}\n` +
        `📧 <b>Email:</b> ${email}\n` +
        `🏷 <b>Роль:</b> ${profile.role}\n\n` +
        `📸 <b>Lazy Realtor активирован!</b>\n` +
        `Отправьте фото с описанием для создания черновика.`
      );
    } else {
      throw new Error('Update failed');
    }
  } catch (e) {
    console.error('[LINK ERROR]', e);
    sendTelegram(chatId, `❌ Ошибка привязки аккаунта. Попробуйте позже.`);
  }
}

/**
 * Async: Process photo and create listing draft (Lazy Realtor)
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

    if (!partner || (partner.role !== 'PARTNER' && partner.role !== 'ADMIN')) {
      sendTelegram(chatId,
        `❌ <b>Аккаунт не привязан</b>\n\n` +
        `Чтобы использовать Lazy Realtor, сначала привяжите аккаунт:\n\n` +
        `<code>/link ваш@email.com</code>`
      );
      return;
    }

    // Immediate confirmation
    sendTelegram(chatId, `🏝 <b>Создаём черновик...</b>\n\nПодождите несколько секунд.`);

    const photo = message.photo;
    const caption = message.caption || '';
    const fileId = photo[photo.length - 1].file_id;

    // Get photo URL from Telegram
    let photoUrl = null;
    try {
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      if (fileData.ok && fileData.result?.file_path) {
        photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
      }
    } catch (e) {
      console.error('[GET FILE ERROR]', e);
    }

    // Parse price from caption (e.g., "25000 thb", "฿25000", "25000 бат")
    const priceMatch = caption.match(/(\d[\d\s]*)\s*(thb|бат|฿|baht)/i);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, '')) : 10000;

    // Extract title (first line of caption, max 100 chars)
    const lines = caption.split('\n').filter(l => l.trim());
    const title = lines[0]?.substring(0, 100) || `Объект от ${firstName}`;
    
    // Description is everything after the first line
    const description = lines.slice(1).join('\n') || caption || 'Создано через Telegram Lazy Realtor';

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
        description,
        district: 'Phuket',
        base_price_thb: price,
        commission_rate: 15,
        images: photoUrl ? [photoUrl] : [],
        cover_image: photoUrl,
        metadata: {
          source: 'TELEGRAM_LAZY_REALTOR',
          is_draft: true,
          telegram_chat_id: chatId,
          created_by: partner.first_name || firstName,
          created_at: new Date().toISOString()
        },
        available: false,
        is_featured: false,
        views: 0
      })
    });

    if (listingRes.ok) {
      const created = await listingRes.json();
      sendTelegram(chatId,
        `✅ <b>Черновик создан!</b>\n\n` +
        `📝 <b>Название:</b> ${title}\n` +
        `💰 <b>Цена:</b> ฿${price.toLocaleString()} / ночь\n` +
        `📸 <b>Фото:</b> ${photoUrl ? '✓' : '✗'}\n\n` +
        `🔗 <b>ID:</b> <code>${listingId}</code>\n\n` +
        `✏️ Отредактируйте в личном кабинете и отправьте на модерацию.\n\n` +
        `📸 Отправьте ещё фото для следующего объекта!`
      );
    } else {
      const error = await listingRes.text();
      console.error('[LISTING CREATE ERROR]', error);
      sendTelegram(chatId, 
        `❌ <b>Ошибка создания черновика</b>\n\n` +
        `Попробуйте ещё раз или обратитесь в поддержку.`
      );
    }
  } catch (e) {
    console.error('[PHOTO UPLOAD ERROR]', e);
    sendTelegram(chatId, `❌ Ошибка обработки фото. Попробуйте ещё раз.`);
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
