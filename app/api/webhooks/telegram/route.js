import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMessage } from '@/lib/telegram';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * FunnyRent 2.1 - Telegram Webhook Handler
 * "Lazy Realtor" Feature - Create draft listings from Telegram
 * 
 * Flow:
 * 1. Partner sends photo + caption to bot
 * 2. Bot identifies partner by chat_id (stored in profiles.telegram_id)
 * 3. Creates DRAFT listing with photo file_id and caption in metadata
 * 4. Sends confirmation with dashboard link
 */

// Get photo file URL from Telegram
async function getPhotoUrl(fileId) {
  if (!BOT_TOKEN || !fileId) return null;
  
  try {
    // Get file path from Telegram
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const data = await response.json();
    
    if (data.ok && data.result.file_path) {
      return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
    }
  } catch (error) {
    console.error('[TELEGRAM] Error getting file URL:', error);
  }
  return null;
}

// Find partner by telegram chat_id
async function findPartnerByChatId(chatId) {
  if (!supabaseAdmin) return null;
  
  const chatIdStr = String(chatId);
  
  // First check profiles.telegram_id
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('telegram_id', chatIdStr)
    .eq('role', 'PARTNER')
    .single();
  
  if (profile) return profile;
  
  // Also check telegram_link_codes for recently linked accounts
  const { data: linkCode } = await supabaseAdmin
    .from('telegram_link_codes')
    .select('user_id')
    .eq('chat_id', chatIdStr)
    .eq('used', true)
    .single();
  
  if (linkCode?.user_id) {
    const { data: linkedProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .eq('id', linkCode.user_id)
      .eq('role', 'PARTNER')
      .single();
    
    return linkedProfile;
  }
  
  return null;
}

// Create draft listing in database
async function createDraftListing(partnerId, caption, photoFileId, photoUrl) {
  if (!supabaseAdmin) return null;
  
  // Parse caption for price (optional)
  const priceMatch = caption?.match(/(\d+)\s*(thb|бат|฿)/i);
  const price = priceMatch ? parseInt(priceMatch[1]) : 10000;
  
  // Extract title from first line or first 50 chars
  const title = caption?.split('\n')[0]?.substring(0, 100) || 'Новый объект из Telegram';
  
  const listingData = {
    owner_id: partnerId,
    category_id: '1', // Default: Property
    status: 'DRAFT',
    title: title,
    description: caption || '',
    district: 'Phuket',
    base_price_thb: price,
    commission_rate: 15,
    images: photoUrl ? [photoUrl] : [],
    cover_image: photoUrl || null,
    metadata: {
      source: 'TELEGRAM_BOT',
      telegram_file_id: photoFileId,
      telegram_caption: caption,
      created_via: 'lazy_realtor'
    },
    available: false, // Will be enabled when published
    is_featured: false,
    views: 0,
    bookings_count: 0
  };
  
  const { data, error } = await supabaseAdmin
    .from('listings')
    .insert(listingData)
    .select('id, title')
    .single();
  
  if (error) {
    console.error('[LAZY REALTOR] Error creating listing:', error);
    return null;
  }
  
  return data;
}

// Handle incoming Telegram update
async function handleTelegramUpdate(update) {
  const message = update.message;
  if (!message) return { action: 'ignored', reason: 'no_message' };
  
  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const text = message.text || message.caption || '';
  const photo = message.photo;
  const firstName = message.from?.first_name || 'Partner';
  
  console.log(`[TELEGRAM WEBHOOK] Received from chat ${chatId} (${chatType}):`, text?.substring(0, 50));
  
  // Ignore group messages (only process private messages for Lazy Realtor)
  if (chatType !== 'private') {
    return { action: 'ignored', reason: 'group_message' };
  }
  
  // Handle /start command
  if (text.startsWith('/start')) {
    await sendMessage(chatId, 
      `Привет, ${firstName}! 👋\n\n` +
      `Это бот FunnyRent для партнёров.\n\n` +
      `📸 <b>Lazy Realtor</b>: Отправьте фото с описанием, чтобы создать черновик объявления.\n\n` +
      `Формат:\n` +
      `• Фото объекта\n` +
      `• Описание в подписи\n` +
      `• Укажите цену: "15000 THB" или "15000 бат"\n\n` +
      `После создания черновика вы сможете отредактировать его в личном кабинете.`
    );
    return { action: 'start_command' };
  }
  
  // Handle /help command
  if (text.startsWith('/help')) {
    await sendMessage(chatId,
      `📖 <b>Помощь FunnyRent Bot</b>\n\n` +
      `<b>Команды:</b>\n` +
      `/start - Начать\n` +
      `/help - Эта справка\n` +
      `/link ВАШЕ_ИМЯ@email.com - Привязать аккаунт\n\n` +
      `<b>Lazy Realtor:</b>\n` +
      `Отправьте фото + описание чтобы создать черновик объявления.`
    );
    return { action: 'help_command' };
  }
  
  // Handle /link command - link Telegram to platform account
  if (text.startsWith('/link')) {
    const email = text.replace('/link', '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      await sendMessage(chatId,
        `❌ Укажите email вашего аккаунта.\n\n` +
        `Пример: /link partner@example.com`
      );
      return { action: 'link_invalid' };
    }
    
    // Find profile by email
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, telegram_id')
      .eq('email', email)
      .single();
    
    if (!profile) {
      await sendMessage(chatId, 
        `❌ Аккаунт с email ${email} не найден.\n\n` +
        `Убедитесь, что вы зарегистрированы на платформе.`
      );
      return { action: 'link_not_found' };
    }
    
    if (profile.role !== 'PARTNER' && profile.role !== 'ADMIN') {
      await sendMessage(chatId,
        `❌ Только партнёры могут использовать Lazy Realtor.\n\n` +
        `Ваша роль: ${profile.role}`
      );
      return { action: 'link_wrong_role' };
    }
    
    // Update profile with telegram_id
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        telegram_id: String(chatId),
        telegram_linked: true 
      })
      .eq('id', profile.id);
    
    if (updateError) {
      console.error('[TELEGRAM] Error linking account:', updateError);
      await sendMessage(chatId, `❌ Ошибка привязки аккаунта. Попробуйте позже.`);
      return { action: 'link_error' };
    }
    
    await sendMessage(chatId,
      `✅ <b>Аккаунт успешно привязан!</b>\n\n` +
      `Email: ${email}\n` +
      `Telegram ID: ${chatId}\n\n` +
      `Теперь вы можете использовать Lazy Realtor:\n` +
      `📸 Отправьте фото с описанием, чтобы создать черновик.`
    );
    return { action: 'link_success', email };
  }
  
  // Handle photo message - Lazy Realtor main feature
  if (photo && photo.length > 0) {
    // Get largest photo
    const largestPhoto = photo[photo.length - 1];
    const fileId = largestPhoto.file_id;
    const caption = message.caption || '';
    
    // Find partner by chat_id
    const partner = await findPartnerByChatId(chatId);
    
    if (!partner) {
      await sendMessage(chatId,
        `❌ <b>Аккаунт не привязан</b>\n\n` +
        `Чтобы создавать объявления, привяжите свой аккаунт:\n\n` +
        `/link ваш@email.com`
      );
      return { action: 'photo_not_linked' };
    }
    
    // Get photo URL
    const photoUrl = await getPhotoUrl(fileId);
    
    // Create draft listing
    const listing = await createDraftListing(partner.id, caption, fileId, photoUrl);
    
    if (!listing) {
      await sendMessage(chatId, `❌ Ошибка создания объявления. Попробуйте позже.`);
      return { action: 'photo_create_error' };
    }
    
    const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/partner/listings`;
    
    await sendMessage(chatId,
      `✅ <b>Черновик создан!</b>\n\n` +
      `📝 ${listing.title}\n\n` +
      `Объявление сохранено как черновик.\n` +
      `Откройте личный кабинет, чтобы:\n` +
      `• Добавить больше фото\n` +
      `• Указать точную цену и адрес\n` +
      `• Опубликовать объявление\n\n` +
      `🔗 <a href="${dashboardUrl}">Открыть личный кабинет</a>`
    );
    
    console.log(`[LAZY REALTOR] Created draft listing ${listing.id} for partner ${partner.email}`);
    return { action: 'photo_listing_created', listingId: listing.id };
  }
  
  // Handle text-only message
  if (text && !photo) {
    await sendMessage(chatId,
      `📸 <b>Отправьте фото!</b>\n\n` +
      `Чтобы создать объявление через Lazy Realtor,\n` +
      `отправьте фото с описанием в подписи.\n\n` +
      `Или используйте /help для справки.`
    );
    return { action: 'text_only_hint' };
  }
  
  return { action: 'ignored', reason: 'unknown_message_type' };
}

// POST - Webhook endpoint for Telegram
export async function POST(request) {
  try {
    const update = await request.json();
    
    console.log('[TELEGRAM WEBHOOK] Received update:', JSON.stringify(update).substring(0, 200));
    
    const result = await handleTelegramUpdate(update);
    
    // Always return 200 to Telegram (acknowledge receipt)
    return NextResponse.json({ ok: true, result });
    
  } catch (error) {
    console.error('[TELEGRAM WEBHOOK] Error:', error);
    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true, error: error.message });
  }
}

// GET - Webhook status check
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'FunnyRent Telegram Webhook',
    features: ['Lazy Realtor', 'Account Linking'],
    commands: ['/start', '/help', '/link EMAIL'],
    webhook_active: !!BOT_TOKEN,
    timestamp: new Date().toISOString()
  });
}
