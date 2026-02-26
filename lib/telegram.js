/**
 * FunnyRent 2.1 - Telegram Service
 * Full integration with Telegram Bot API and Group Topics (Threads)
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID;

// Topic Thread IDs - Created in FunnyRent HQ group
// These are the message_thread_id values for each forum topic
const TOPICS = {
  BOOKINGS: 15,      // 🏠 Bookings - For new rental requests
  FINANCE: 16,       // 💰 Finance - For payments and USDT TXIDs  
  NEW_PARTNERS: 17   // 🤝 Partners - For realtor registrations
};

/**
 * Call Telegram Bot API
 */
async function telegramAPI(method, params = {}) {
  if (!BOT_TOKEN) {
    console.log(`[TELEGRAM] No bot token configured`);
    return { ok: false, error: 'No bot token' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error(`[TELEGRAM API ERROR] ${method}:`, result.description);
    }
    
    return result;
  } catch (error) {
    console.error(`[TELEGRAM ERROR] ${method}:`, error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Send message to a chat (user or group)
 */
export async function sendMessage(chatId, text, options = {}) {
  return telegramAPI('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...options
  });
}

/**
 * Send message to a specific topic/thread in a group
 */
export async function sendToTopic(topicName, text, options = {}) {
  if (!ADMIN_GROUP_ID) {
    console.log('[TELEGRAM] No admin group ID configured');
    return { ok: false, error: 'No admin group ID' };
  }

  const threadId = TOPICS[topicName];
  
  const params = {
    chat_id: ADMIN_GROUP_ID,
    text,
    parse_mode: 'HTML',
    ...options
  };

  // Add thread ID if topic exists
  if (threadId) {
    params.message_thread_id = threadId;
  }

  return telegramAPI('sendMessage', params);
}

/**
 * Send message to admin group (General topic if no specific thread)
 */
export async function sendToAdminGroup(text, options = {}) {
  if (!ADMIN_GROUP_ID) {
    console.log('[TELEGRAM] No admin group ID configured');
    return { ok: false, error: 'No admin group ID' };
  }

  return sendMessage(ADMIN_GROUP_ID, text, options);
}

/**
 * Create a topic in the supergroup
 */
export async function createTopic(name, iconColor = null) {
  if (!ADMIN_GROUP_ID) {
    return { ok: false, error: 'No admin group ID' };
  }

  const params = {
    chat_id: ADMIN_GROUP_ID,
    name
  };

  if (iconColor) {
    params.icon_color = iconColor;
  }

  return telegramAPI('createForumTopic', params);
}

/**
 * Initialize topics - create them if they don't exist
 * Call this once to set up the command center
 */
export async function initializeTopics() {
  const topicConfigs = [
    { key: 'BOOKINGS', name: '🏠 BOOKINGS', color: 7322096 },      // Green
    { key: 'FINANCE', name: '💰 FINANCE', color: 16766720 },       // Yellow  
    { key: 'NEW_PARTNERS', name: '🤝 NEW_PARTNERS', color: 9367192 } // Blue
  ];

  const results = {};

  for (const config of topicConfigs) {
    // Try to create the topic
    const result = await createTopic(config.name, config.color);
    
    if (result.ok) {
      TOPICS[config.key] = result.result.message_thread_id;
      results[config.key] = { 
        success: true, 
        threadId: result.result.message_thread_id,
        name: config.name
      };
      console.log(`[TELEGRAM] Created topic: ${config.name} (ID: ${result.result.message_thread_id})`);
    } else {
      results[config.key] = { 
        success: false, 
        error: result.description || result.error 
      };
      console.log(`[TELEGRAM] Topic creation failed for ${config.name}: ${result.description || result.error}`);
    }
  }

  return results;
}

/**
 * Set topic IDs manually (if topics already exist)
 */
export function setTopicIds(bookingsId, financeId, partnersId) {
  if (bookingsId) TOPICS.BOOKINGS = bookingsId;
  if (financeId) TOPICS.FINANCE = financeId;
  if (partnersId) TOPICS.NEW_PARTNERS = partnersId;
  
  return TOPICS;
}

/**
 * Get current topic configuration
 */
export function getTopics() {
  return { ...TOPICS };
}

// ============================================================================
// NOTIFICATION FUNCTIONS - Pre-formatted messages for each event type
// ============================================================================

/**
 * Send booking notification
 */
export async function notifyNewBooking(booking) {
  const message = `
🏠 <b>НОВОЕ БРОНИРОВАНИЕ!</b>

📍 <b>Объект:</b> ${booking.listingTitle || 'N/A'}
👤 <b>Гость:</b> ${booking.guestName || 'N/A'}
📞 <b>Телефон:</b> ${booking.guestPhone || 'N/A'}
📧 <b>Email:</b> ${booking.guestEmail || 'N/A'}

📅 <b>Даты:</b> ${booking.checkIn} → ${booking.checkOut}
🛏️ <b>Гостей:</b> ${booking.guests || 1}

💰 <b>Сумма:</b> ${booking.priceTHB?.toLocaleString() || '0'} THB
💵 <b>USDT:</b> ~${booking.priceUSDT?.toFixed(2) || '0'} USDT

🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}
`;

  return sendToTopic('BOOKINGS', message);
}

/**
 * Send finance/payment notification
 */
export async function notifyPayment(payment) {
  const statusEmoji = payment.status === 'confirmed' ? '✅' : payment.status === 'pending' ? '⏳' : '❓';
  
  const message = `
💰 <b>ПЛАТЁЖ ${statusEmoji}</b>

📝 <b>Booking ID:</b> ${payment.bookingId || 'N/A'}
💵 <b>Сумма:</b> ${payment.amount?.toLocaleString() || '0'} ${payment.currency || 'THB'}

🔗 <b>Метод:</b> ${payment.method || 'N/A'}
${payment.txid ? `📋 <b>TXID:</b> <code>${payment.txid}</code>` : ''}
${payment.wallet ? `👛 <b>Кошелёк:</b> <code>${payment.wallet}</code>` : ''}

📊 <b>Статус:</b> ${payment.status?.toUpperCase() || 'UNKNOWN'}

🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}
`;

  return sendToTopic('FINANCE', message);
}

/**
 * Send new partner registration notification
 */
export async function notifyNewPartner(partner) {
  const message = `
🤝 <b>НОВЫЙ ПАРТНЁР!</b>

👤 <b>Имя:</b> ${partner.firstName || ''} ${partner.lastName || ''}
📧 <b>Email:</b> ${partner.email || 'N/A'}
📞 <b>Телефон:</b> ${partner.phone || 'N/A'}

🏢 <b>Компания:</b> ${partner.company || 'Частное лицо'}
📍 <b>Район:</b> ${partner.district || 'N/A'}

📊 <b>Статус:</b> Ожидает верификации

🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}
`;

  return sendToTopic('NEW_PARTNERS', message);
}

/**
 * Send test message to verify configuration
 */
export async function sendTestAlert(type) {
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' });
  
  switch (type) {
    case 'booking':
      return notifyNewBooking({
        listingTitle: '🧪 TEST: Luxury Villa Ocean View',
        guestName: 'Test Guest',
        guestPhone: '+7 999 123 4567',
        guestEmail: 'test@example.com',
        checkIn: '2025-03-01',
        checkOut: '2025-03-07',
        guests: 4,
        priceTHB: 125000,
        priceUSDT: 3500
      });
      
    case 'finance':
      return notifyPayment({
        bookingId: 'TEST-' + Date.now(),
        amount: 3500,
        currency: 'USDT',
        method: 'USDT TRC-20',
        txid: 'TEST_TXID_' + Math.random().toString(36).substr(2, 16).toUpperCase(),
        wallet: 'TTestWalletAddress123456789',
        status: 'confirmed'
      });
      
    case 'partner':
      return notifyNewPartner({
        firstName: 'Test',
        lastName: 'Partner',
        email: 'test.partner@example.com',
        phone: '+66 99 999 9999',
        company: 'Test Realty Co.',
        district: 'Rawai'
      });
      
    default:
      return sendToAdminGroup(`🧪 <b>TEST ALERT</b>\n\nThis is a test message from FunnyRent 2.1\n\n🕐 ${now}`);
  }
}

/**
 * Generate a unique code for linking Telegram account
 */
export function generateLinkCode(userId) {
  const code = 'FR_' + Math.random().toString(36).substr(2, 8).toUpperCase();
  return code;
}

/**
 * Get bot info
 */
export async function getBotInfo() {
  return telegramAPI('getMe');
}

/**
 * Get chat info
 */
export async function getChatInfo(chatId) {
  return telegramAPI('getChat', { chat_id: chatId || ADMIN_GROUP_ID });
}

export default {
  sendMessage,
  sendToTopic,
  sendToAdminGroup,
  createTopic,
  initializeTopics,
  setTopicIds,
  getTopics,
  notifyNewBooking,
  notifyPayment,
  notifyNewPartner,
  sendTestAlert,
  generateLinkCode,
  getBotInfo,
  getChatInfo
};
