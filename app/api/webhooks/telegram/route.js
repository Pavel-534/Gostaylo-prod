import { NextResponse } from 'next/server';

/**
 * FunnyRent 2.1 - Telegram Webhook v4.0
 * 
 * CRITICAL FIX: Return 200 IMMEDIATELY, then fire-and-forget all processing
 * The key insight: We DON'T await any external calls before returning
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM';
const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';

// Helper: Fire-and-forget fetch (no await)
function fireAndForget(url, options) {
  fetch(url, options).catch(() => {});
}

// Helper: Send Telegram message (fire-and-forget)
function sendTelegram(chatId, text) {
  fireAndForget(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

// POST handler - IMMEDIATE RESPONSE
export async function POST(request) {
  // Step 1: Parse body (minimal, fast)
  let update;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Step 2: Extract basics
  const message = update?.message;
  if (!message || message.chat?.type !== 'private') {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text || message.caption || '';
  const firstName = message.from?.first_name || 'User';
  const photo = message.photo;

  // Step 3: Handle commands with FIRE-AND-FORGET (no await!)
  
  if (text.startsWith('/start')) {
    sendTelegram(chatId,
      `🌴 <b>Aloha, ${firstName}!</b>\n\n` +
      `Добро пожаловать в <b>FunnyRent</b>!\n\n` +
      `📸 <b>Lazy Realtor</b>\n` +
      `Отправьте фото + описание для черновика.\n\n` +
      `Команды: /help, /link email`
    );
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/help')) {
    sendTelegram(chatId,
      `📖 <b>Помощь FunnyRent</b>\n\n` +
      `/start — Начать\n` +
      `/help — Справка\n` +
      `/link email — Привязать аккаунт\n\n` +
      `Отправьте фото → черновик!`
    );
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/link')) {
    const email = text.replace('/link', '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      sendTelegram(chatId, `❌ Формат: <code>/link your@email.com</code>`);
      return NextResponse.json({ ok: true });
    }
    // Fire-and-forget: link account async
    handleLinkAccount(chatId, email);
    return NextResponse.json({ ok: true });
  }

  if (photo && photo.length > 0) {
    // Fire-and-forget: create draft async
    handlePhotoUpload(chatId, message);
    return NextResponse.json({ ok: true });
  }

  if (text && !photo) {
    sendTelegram(chatId, `📸 Отправьте фото для создания черновика!\n\n/help — справка`);
  }

  // Always return 200 immediately
  return NextResponse.json({ ok: true });
}

// Async handler: Link account (runs in background)
async function handleLinkAccount(chatId, email) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,role`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const profiles = await res.json();
    const profile = profiles?.[0];

    if (!profile) {
      sendTelegram(chatId, `❌ Email ${email} не найден`);
      return;
    }
    if (profile.role !== 'PARTNER' && profile.role !== 'ADMIN') {
      sendTelegram(chatId, `❌ Только партнёры могут использовать бота`);
      return;
    }

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ telegram_id: String(chatId), telegram_linked: true })
    });

    sendTelegram(chatId, `✅ Аккаунт привязан!\n\nТеперь отправляйте фото!`);
  } catch (e) {
    sendTelegram(chatId, `❌ Ошибка привязки`);
  }
}

// Async handler: Photo upload (runs in background)
async function handlePhotoUpload(chatId, message) {
  try {
    // Check if linked
    const partnerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?telegram_id=eq.${chatId}&select=id,role`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const partners = await partnerRes.json();
    const partner = partners?.[0];

    if (!partner || (partner.role !== 'PARTNER' && partner.role !== 'ADMIN')) {
      sendTelegram(chatId, `❌ Сначала привяжите аккаунт: /link email`);
      return;
    }

    sendTelegram(chatId, `🏝 Создаём черновик...`);

    const photo = message.photo;
    const caption = message.caption || '';
    const fileId = photo[photo.length - 1].file_id;

    // Get photo URL
    let photoUrl = null;
    try {
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      if (fileData.ok) {
        photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
      }
    } catch {}

    // Parse price
    const priceMatch = caption.match(/(\d+)\s*(thb|бат|฿)/i);
    const price = priceMatch ? parseInt(priceMatch[1]) : 10000;
    const title = caption.split('\n')[0]?.substring(0, 100) || 'Объект из Telegram';

    // Create listing
    const listingRes = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: `lst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`,
        owner_id: partner.id,
        category_id: '1',
        status: 'PENDING',
        title,
        description: caption,
        district: 'Phuket',
        base_price_thb: price,
        commission_rate: 15,
        images: photoUrl ? [photoUrl] : [],
        cover_image: photoUrl,
        metadata: { source: 'TELEGRAM_BOT', is_draft: true },
        available: false,
        is_featured: false,
        views: 0
      })
    });

    if (listingRes.ok) {
      sendTelegram(chatId, `✅ Черновик создан!\n\n📝 ${title}\n💰 ${price.toLocaleString()} THB`);
    } else {
      sendTelegram(chatId, `❌ Ошибка создания черновика`);
    }
  } catch (e) {
    sendTelegram(chatId, `❌ Ошибка обработки фото`);
  }
}

// GET - Status check
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'FunnyRent Telegram Webhook',
    version: '4.0',
    pattern: 'immediate-response-fire-and-forget',
    timestamp: new Date().toISOString()
  });
}
