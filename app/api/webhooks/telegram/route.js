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
  
  // Note: Using PENDING status with is_draft=true in metadata
  // because DRAFT is not in the listing_status enum
  const listingData = {
    owner_id: partnerId,
    category_id: '1', // Default: Property
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
      is_draft: true // Mark as draft for filtering
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
    await sendMessage(chatId,
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
  
  // Handle /link command - link Telegram to platform account
  if (text.startsWith('/link')) {
    const email = text.replace('/link', '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      await sendMessage(chatId,
        `❌ <b>Invalid email format</b>\n\n` +
        `Please provide your FunnyRent account email.\n\n` +
        `Example: <code>/link partner@example.com</code>`
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
        `❌ <b>Email not found</b>\n\n` +
        `No account found for: ${email}\n\n` +
        `Please check your spelling or register at FunnyRent first.`
      );
      return { action: 'link_not_found' };
    }
    
    if (profile.role !== 'PARTNER' && profile.role !== 'ADMIN') {
      await sendMessage(chatId,
        `❌ <b>Access Denied</b>\n\n` +
        `Only Partners can use Lazy Realtor.\n` +
        `Your role: ${profile.role}\n\n` +
        `Contact support to upgrade your account.`
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
      await sendMessage(chatId, `❌ Connection error. Please try again later.`);
      return { action: 'link_error' };
    }
    
    await sendMessage(chatId,
      `✅ <b>Account linked successfully!</b>\n\n` +
      `📧 Email: ${email}\n` +
      `🆔 Telegram ID: ${chatId}\n\n` +
      `🎉 You're ready to send photos!\n` +
      `Just send a photo with description and watch the magic happen ✨`
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
        `❌ <b>Account not linked</b>\n\n` +
        `To create listings, link your account first:\n\n` +
        `<code>/link your@email.com</code>`
      );
      return { action: 'photo_not_linked' };
    }
    
    // Send processing message
    await sendMessage(chatId, `🏝 <b>Working on your draft...</b>\n\nProcessing your tropical property... 🌴`);
    
    // Get photo URL
    const photoUrl = await getPhotoUrl(fileId);
    
    // Create draft listing
    const listing = await createDraftListing(partner.id, caption, fileId, photoUrl);
    
    if (!listing) {
      await sendMessage(chatId, `❌ Error creating listing. Please try again later.`);
      return { action: 'photo_create_error' };
    }
    
    const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/partner/listings`;
    
    await sendMessage(chatId,
      `✅ <b>Draft Created!</b> 🎉\n\n` +
      `📝 <b>${listing.title}</b>\n\n` +
      `Your listing is saved as a draft.\n` +
      `Open your Dashboard to:\n` +
      `• Add more photos 📷\n` +
      `• Set exact price & location 📍\n` +
      `• Publish when ready 🚀\n\n` +
      `🔗 <a href="${dashboardUrl}">Open Partner Dashboard</a>`
    );
    
    console.log(`[LAZY REALTOR] Created draft listing ${listing.id} for partner ${partner.email}`);
    return { action: 'photo_listing_created', listingId: listing.id };
  }
  
  // Handle text-only message
  if (text && !photo) {
    await sendMessage(chatId,
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
