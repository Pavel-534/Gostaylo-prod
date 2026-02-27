import { NextResponse } from 'next/server';

// Enable Edge Runtime for better performance and reliability
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM';
const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';

/**
 * FunnyRent 2.1 - Telegram Webhook Handler (Edge Optimized)
 * "Lazy Realtor" Feature - Create draft listings from Telegram
 */

// Send message to Telegram
async function sendTelegramMessage(chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    return await res.json();
  } catch (error) {
    console.error('[TELEGRAM] Send error:', error);
    return { ok: false, error: error.message };
  }
}

// Get photo file URL from Telegram
async function getPhotoUrl(fileId) {
  if (!BOT_TOKEN || !fileId) return null;
  
  try {
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

// Find partner by telegram chat_id via Supabase REST API
async function findPartnerByChatId(chatId) {
  const chatIdStr = String(chatId);
  
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?telegram_id=eq.${chatIdStr}&role=eq.PARTNER&select=id,email,first_name,last_name,role`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const profiles = await res.json();
    return profiles?.[0] || null;
  } catch (error) {
    console.error('[TELEGRAM] Find partner error:', error);
    return null;
  }
}

// Create draft listing in database via Supabase REST API
async function createDraftListing(partnerId, caption, photoFileId, photoUrl) {
  // Parse caption for price
  const priceMatch = caption?.match(/(\d+)\s*(thb|бат|฿)/i);
  const price = priceMatch ? parseInt(priceMatch[1]) : 10000;
  
  // Extract title from first line
  const title = caption?.split('\n')[0]?.substring(0, 100) || 'Новый объект из Telegram';
  
  const listingData = {
    id: `lst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`,
    owner_id: partnerId,
    category_id: '1',
    status: 'PENDING',
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
      created_via: 'lazy_realtor',
      is_draft: true
    },
    available: false,
    is_featured: false,
    views: 0,
    bookings_count: 0
  };
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(listingData)
    });
    
    if (res.ok) {
      const data = await res.json();
      return data?.[0] || { id: listingData.id, title };
    }
    return null;
  } catch (error) {
    console.error('[LAZY REALTOR] Create listing error:', error);
    return null;
  }
}

// Link profile to Telegram
async function linkProfileToTelegram(email, chatId) {
  try {
    // First find the profile
    const findRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,role,telegram_id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const profiles = await findRes.json();
    const profile = profiles?.[0];
    
    if (!profile) return { success: false, reason: 'not_found' };
    if (profile.role !== 'PARTNER' && profile.role !== 'ADMIN') return { success: false, reason: 'wrong_role', role: profile.role };
    
    // Update profile with telegram_id
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          telegram_id: String(chatId),
          telegram_linked: true
        })
      }
    );
    
    return { success: updateRes.ok, email: profile.email };
  } catch (error) {
    console.error('[TELEGRAM] Link error:', error);
    return { success: false, reason: 'error' };
  }
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
  
  console.log(`[TELEGRAM WEBHOOK] Chat ${chatId} (${chatType}): ${text?.substring(0, 50)}`);
  
  // Ignore group messages
  if (chatType !== 'private') {
    return { action: 'ignored', reason: 'group_message' };
  }
  
  // Handle /start command
  if (text.startsWith('/start')) {
    await sendTelegramMessage(chatId, 
      `🌴 <b>Aloha, ${firstName}!</b>\n\n` +
      `Welcome to <b>FunnyRent</b> — your gateway to the Phuket rental market.\n\n` +
      `📸 <b>Lazy Realtor</b>\n` +
      `Send a photo + description to create a draft listing instantly!\n\n` +
      `<b>Format:</b>\n` +
      `• 📷 Photo of your property\n` +
      `• 📝 Description in the caption\n` +
      `• 💰 Price: "15000 THB" or "15000 бат"\n\n` +
      `Your draft will appear in the Partner Dashboard — edit & publish anytime! 🏝`
    );
    return { action: 'start_command' };
  }
  
  // Handle /help command
  if (text.startsWith('/help')) {
    await sendTelegramMessage(chatId,
      `📖 <b>FunnyRent Bot Help</b>\n\n` +
      `<b>Commands:</b>\n` +
      `🌴 /start — Get started\n` +
      `❓ /help — This help message\n` +
      `🔗 /link your@email.com — Link your account\n\n` +
      `<b>Lazy Realtor:</b>\n` +
      `Send photo + caption → instant draft listing!\n\n` +
      `Need help? Contact support via the Dashboard.`
    );
    return { action: 'help_command' };
  }
  
  // Handle /link command
  if (text.startsWith('/link')) {
    const email = text.replace('/link', '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      await sendTelegramMessage(chatId,
        `❌ <b>Invalid email format</b>\n\n` +
        `Please provide your FunnyRent account email.\n\n` +
        `Example: <code>/link partner@example.com</code>`
      );
      return { action: 'link_invalid' };
    }
    
    const result = await linkProfileToTelegram(email, chatId);
    
    if (!result.success) {
      if (result.reason === 'not_found') {
        await sendTelegramMessage(chatId, 
          `❌ <b>Email not found</b>\n\n` +
          `No account found for: ${email}\n\n` +
          `Please check your spelling or register at FunnyRent first.`
        );
      } else if (result.reason === 'wrong_role') {
        await sendTelegramMessage(chatId,
          `❌ <b>Access Denied</b>\n\n` +
          `Only Partners can use Lazy Realtor.\n` +
          `Your role: ${result.role}\n\n` +
          `Contact support to upgrade your account.`
        );
      } else {
        await sendTelegramMessage(chatId, `❌ Connection error. Please try again later.`);
      }
      return { action: 'link_failed', reason: result.reason };
    }
    
    await sendTelegramMessage(chatId,
      `✅ <b>Account linked successfully!</b>\n\n` +
      `📧 Email: ${result.email}\n` +
      `🆔 Telegram ID: ${chatId}\n\n` +
      `🎉 You're ready to send photos!\n` +
      `Just send a photo with description and watch the magic happen ✨`
    );
    return { action: 'link_success', email: result.email };
  }
  
  // Handle photo message - Lazy Realtor
  if (photo && photo.length > 0) {
    const largestPhoto = photo[photo.length - 1];
    const fileId = largestPhoto.file_id;
    const caption = message.caption || '';
    
    // Find partner by chat_id
    const partner = await findPartnerByChatId(chatId);
    
    if (!partner) {
      await sendTelegramMessage(chatId,
        `❌ <b>Account not linked</b>\n\n` +
        `To create listings, link your account first:\n\n` +
        `<code>/link your@email.com</code>`
      );
      return { action: 'photo_not_linked' };
    }
    
    // Send processing message
    await sendTelegramMessage(chatId, `🏝 <b>Working on your draft...</b>\n\nProcessing your tropical property... 🌴`);
    
    // Get photo URL
    const photoUrl = await getPhotoUrl(fileId);
    
    // Create draft listing
    const listing = await createDraftListing(partner.id, caption, fileId, photoUrl);
    
    if (!listing) {
      await sendTelegramMessage(chatId, `❌ Error creating listing. Please try again later.`);
      return { action: 'photo_create_error' };
    }
    
    const dashboardUrl = `https://c325362c-1be1-450d-a1ad-cc1fb45ba828.preview.emergentagent.com/partner/listings`;
    
    await sendTelegramMessage(chatId,
      `✅ <b>Draft Created!</b> 🎉\n\n` +
      `📝 <b>${listing.title}</b>\n\n` +
      `Your listing is saved as a draft.\n` +
      `Open your Dashboard to:\n` +
      `• Add more photos 📷\n` +
      `• Set exact price & location 📍\n` +
      `• Publish when ready 🚀\n\n` +
      `🔗 <a href="${dashboardUrl}">Open Partner Dashboard</a>`
    );
    
    console.log(`[LAZY REALTOR] Created draft ${listing.id} for ${partner.email}`);
    return { action: 'photo_listing_created', listingId: listing.id };
  }
  
  // Handle text-only message
  if (text && !photo) {
    await sendTelegramMessage(chatId,
      `📸 <b>Send a photo!</b>\n\n` +
      `To create a listing with Lazy Realtor,\n` +
      `send a photo with description in the caption.\n\n` +
      `Type /help for more info 🌴`
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
    
    // Always return 200 to Telegram
    return NextResponse.json({ ok: true, result });
    
  } catch (error) {
    console.error('[TELEGRAM WEBHOOK] Error:', error);
    return NextResponse.json({ ok: true, error: error.message });
  }
}

// GET - Webhook status check
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'FunnyRent Telegram Webhook',
    runtime: 'edge',
    features: ['Lazy Realtor', 'Account Linking'],
    commands: ['/start', '/help', '/link EMAIL'],
    webhook_active: !!BOT_TOKEN,
    timestamp: new Date().toISOString()
  });
}
