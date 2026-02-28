import { NextResponse } from 'next/server';

// Enable Edge Runtime for better performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM';
const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';

/**
 * FunnyRent 2.1 - Telegram Webhook (Edge Optimized)
 * CRITICAL: Respond immediately to avoid 502 timeouts
 */

// POST - Telegram Webhook
export async function POST(request) {
  // CRITICAL: Respond IMMEDIATELY to Telegram to avoid 502
  // Process in background after response
  
  let update;
  try {
    update = await request.json();
  } catch (e) {
    return NextResponse.json({ ok: true });
  }
  
  // Start background processing (non-blocking)
  // Use waitUntil if available, otherwise just fire-and-forget
  processUpdate(update).catch(console.error);
  
  // Return 200 OK immediately
  return NextResponse.json({ ok: true });
}

// Background processing function
async function processUpdate(update) {
  const message = update.message;
  if (!message) return;
  
  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const text = message.text || message.caption || '';
  const photo = message.photo;
  const firstName = message.from?.first_name || 'User';
  
  // Ignore group messages
  if (chatType !== 'private') return;
  
  console.log(`[TELEGRAM] Processing: ${text?.substring(0, 30)} from ${chatId}`);
  
  try {
    // Handle /start
    if (text.startsWith('/start')) {
      await sendMessage(chatId, 
        `🌴 <b>Aloha, ${firstName}!</b>\n\n` +
        `Добро пожаловать в <b>FunnyRent</b> — ваш путь к аренде на Пхукете.\n\n` +
        `📸 <b>Lazy Realtor</b>\n` +
        `Отправьте фото + описание для создания черновика!\n\n` +
        `<b>Формат:</b>\n` +
        `• 📷 Фото объекта\n` +
        `• 📝 Описание в подписи\n` +
        `• 💰 Цена: "15000 THB"\n\n` +
        `🏝 Черновик появится в личном кабинете!`
      );
      return;
    }
    
    // Handle /help
    if (text.startsWith('/help')) {
      await sendMessage(chatId,
        `📖 <b>Помощь FunnyRent Bot</b>\n\n` +
        `<b>Команды:</b>\n` +
        `🌴 /start — Начать\n` +
        `❓ /help — Эта справка\n` +
        `🔗 /link email@example.com — Привязать аккаунт\n\n` +
        `<b>Lazy Realtor:</b>\n` +
        `Отправьте фото + описание → мгновенный черновик!`
      );
      return;
    }
    
    // Handle /link
    if (text.startsWith('/link')) {
      const email = text.replace('/link', '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        await sendMessage(chatId,
          `❌ <b>Неверный формат email</b>\n\n` +
          `Пример: <code>/link partner@example.com</code>`
        );
        return;
      }
      
      // Find profile
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,role`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const profiles = await res.json();
      const profile = profiles?.[0];
      
      if (!profile) {
        await sendMessage(chatId, `❌ <b>Email не найден</b>\n\nАккаунт с ${email} не существует.`);
        return;
      }
      
      if (profile.role !== 'PARTNER' && profile.role !== 'ADMIN') {
        await sendMessage(chatId, `❌ <b>Доступ запрещён</b>\n\nТолько партнёры могут использовать Lazy Realtor.`);
        return;
      }
      
      // Update profile
      await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`,
        {
          method: 'PATCH',
          headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ telegram_id: String(chatId), telegram_linked: true })
        }
      );
      
      await sendMessage(chatId,
        `✅ <b>Аккаунт привязан!</b>\n\n` +
        `📧 Email: ${email}\n` +
        `🆔 Telegram: ${chatId}\n\n` +
        `🎉 Теперь отправляйте фото для создания черновиков!`
      );
      return;
    }
    
    // Handle photo
    if (photo && photo.length > 0) {
      // Check if linked
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?telegram_id=eq.${chatId}&role=eq.PARTNER&select=id,email`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const profiles = await profileRes.json();
      const partner = profiles?.[0];
      
      if (!partner) {
        await sendMessage(chatId, `❌ <b>Аккаунт не привязан</b>\n\nИспользуйте: <code>/link ваш@email.com</code>`);
        return;
      }
      
      await sendMessage(chatId, `🏝 <b>Создаём черновик...</b>`);
      
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
      } catch (e) {}
      
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
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          id: `lst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`,
          owner_id: partner.id,
          category_id: '1',
          status: 'PENDING',
          title: title,
          description: caption,
          district: 'Phuket',
          base_price_thb: price,
          commission_rate: 15,
          images: photoUrl ? [photoUrl] : [],
          cover_image: photoUrl,
          metadata: { source: 'TELEGRAM_BOT', telegram_file_id: fileId, is_draft: true },
          available: false,
          is_featured: false,
          views: 0
        })
      });
      
      if (listingRes.ok) {
        await sendMessage(chatId,
          `✅ <b>Черновик создан!</b> 🎉\n\n` +
          `📝 <b>${title}</b>\n` +
          `💰 ${price.toLocaleString()} THB\n\n` +
          `Откройте личный кабинет для редактирования и публикации.`
        );
      } else {
        await sendMessage(chatId, `❌ Ошибка создания. Попробуйте позже.`);
      }
      return;
    }
    
    // Text only
    if (text && !photo) {
      await sendMessage(chatId,
        `📸 <b>Отправьте фото!</b>\n\n` +
        `Для создания черновика нужно фото с описанием.\n\n` +
        `Используйте /help для справки.`
      );
    }
  } catch (error) {
    console.error('[TELEGRAM] Error:', error);
  }
}

// Send message helper
async function sendMessage(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
  } catch (e) {
    console.error('[TELEGRAM] Send error:', e);
  }
}

// GET - Status check
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'FunnyRent Telegram Webhook',
    runtime: 'edge',
    version: '2.1',
    features: ['Lazy Realtor', 'Account Linking', 'Immediate Response'],
    timestamp: new Date().toISOString()
  });
}
