/**
 * Telegram Bot API: admin topics, DM, inline keyboards, booking deep links.
 * Stage 2.2 — вынесено из notification.service.js
 */

import { decodeTelegramText } from '../telegram/telegram-text.js';
import { getPublicSiteUrl } from '../../site-url.js';
import { bookingSpecialRequestsSnippet, escapeTelegramHtmlText, formatBookingAmountForNotify } from './formatting.js';
import { notifyTelegramCopy } from '@/lib/services/notifications/notify-telegram-copy.js';
import { resolveUserLocale } from '@/lib/i18n/locale-resolver.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID;
const BASE_URL = getPublicSiteUrl();

/** Bound outbound Telegram calls so a hung api.telegram.org never stalls the request flow. */
const TELEGRAM_FETCH_TIMEOUT_MS = 8000;

/** Telegram Topic Thread IDs */
export const TELEGRAM_TOPIC_IDS = {
  BOOKINGS: 15,
  FINANCE: 16,
  NEW_PARTNERS: 17,
  MESSAGES: 18,
};

/**
 * Единая отправка в Telegram: decodeTelegramText + HTML
 * @param {Record<string, unknown>} payload — chat_id, text, reply_markup, message_thread_id, disable_web_page_preview
 */
export async function sendTelegramMessagePayload(payload) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[TELEGRAM SKIP] TELEGRAM_BOT_TOKEN не задан');
    return { success: false, reason: 'missing_token' };
  }
  const chatId = payload.chat_id;
  if (chatId == null || chatId === '') {
    console.log('[TELEGRAM SKIP] No chat ID');
    return { success: false, reason: 'no_chat_id' };
  }
  const rawText = payload.text;
  const text =
    typeof rawText === 'string'
      ? decodeTelegramText(rawText)
      : decodeTelegramText(rawText == null ? '' : String(rawText));
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview:
      payload.disable_web_page_preview !== undefined ? payload.disable_web_page_preview : true,
    ...(payload.message_thread_id != null ? { message_thread_id: payload.message_thread_id } : {}),
    ...(payload.reply_markup ? { reply_markup: payload.reply_markup } : {}),
  };
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELEGRAM_FETCH_TIMEOUT_MS),
    });
    if (response.ok) {
      console.log(`[TELEGRAM SENT] To: ${chatId}`);
      return { success: true };
    }
    const error = await response.text();
    console.error(`[TELEGRAM ERROR] ${error}`);
    return { success: false, error };
  } catch (error) {
    console.error(`[TELEGRAM ERROR] ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function sendTelegramChat(chatId, message) {
  return sendTelegramMessagePayload({
    chat_id: chatId,
    text: message,
  });
}

/**
 * Admin Group Topic: BOOKINGS (15), FINANCE (16), NEW_PARTNERS (17), MESSAGES (18)
 */
export async function sendToAdminTopic(topicType, message, reply_markup) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_GROUP_ID) {
    console.warn('[TOPIC SKIP] Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_GROUP_ID');
    return { success: false, error: 'missing_telegram_config' };
  }

  const threadId = TELEGRAM_TOPIC_IDS[topicType];

  if (!threadId) {
    console.error(`[TOPIC ERROR] Unknown topic: ${topicType}`);
    return { success: false, error: 'unknown_topic' };
  }

  const result = await sendTelegramMessagePayload({
    chat_id: TELEGRAM_ADMIN_GROUP_ID,
    message_thread_id: threadId,
    text: message,
    ...(reply_markup ? { reply_markup } : {}),
  });
  if (result.success) {
    console.log(`[TOPIC SENT] ${topicType} (thread ${threadId})`);
  }
  return result;
}

/**
 * Личка админа или fallback в топик FINANCE.
 */
export async function sendToAdmin(message, reply_markup) {
  const dm =
    (process.env.TELEGRAM_ADMIN_DM_CHAT_ID || process.env.ADMIN_TELEGRAM_ID || '').trim() || null;
  if (dm && TELEGRAM_BOT_TOKEN) {
    return sendTelegramMessagePayload({
      chat_id: dm,
      text: message,
      ...(reply_markup ? { reply_markup } : {}),
    });
  }
  return sendToAdminTopic('FINANCE', message, reply_markup);
}

/**
 * Критические алерты → топик System или sendToAdmin.
 */
export async function sendSystemAlertTelegram(message, opts = {}) {
  const banner = opts.omitBanner ? '' : '🚨 <b>SYSTEM</b>\n';
  const text = `${banner}${message}`;
  const payloadBase = {
    text,
    ...(opts.reply_markup ? { reply_markup: opts.reply_markup } : {}),
  };
  const raw = (process.env.TELEGRAM_SYSTEM_ALERTS_TOPIC_ID || '').trim();
  const threadId = raw ? parseInt(raw, 10) : NaN;
  if (
    TELEGRAM_BOT_TOKEN &&
    TELEGRAM_ADMIN_GROUP_ID &&
    Number.isFinite(threadId) &&
    threadId > 0
  ) {
    return sendTelegramMessagePayload({
      chat_id: TELEGRAM_ADMIN_GROUP_ID,
      message_thread_id: threadId,
      ...payloadBase,
    });
  }
  console.warn(
    '[SYSTEM ALERT] TELEGRAM_SYSTEM_ALERTS_TOPIC_ID missing or invalid; using sendToAdmin fallback',
  );
  return sendToAdmin(text, opts.reply_markup);
}

/**
 * Inline-кнопка «Открыть в приложении» с ?booking= для глубокой ссылки.
 */
export async function sendTelegramBookingRequest(chatId, data) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[TELEGRAM BOOKING SKIP] TELEGRAM_BOT_TOKEN не задан');
    return { success: false, error: 'missing_token' };
  }
  const { booking, listing, totalPrice, commissionRate, commissionAmount, partnerEarnings, lang } = data;
  const partnerLang = lang ? resolveUserLocale({ preferred_language: lang }) : 'ru';
  const listingTitle = listing?.title || notifyTelegramCopy('notifyTg_listingFallback', partnerLang);
  const tgNote = bookingSpecialRequestsSnippet(booking.special_requests, 300);

  const amountLine = formatBookingAmountForNotify(booking, totalPrice);
  const message =
    `🏠 <b>${escapeTelegramHtmlText(notifyTelegramCopy('notifyTg_newBookingTitle', partnerLang, { listing: listingTitle }))}</b>\n\n` +
    `💰 ${escapeTelegramHtmlText(notifyTelegramCopy('notifyTg_amountLine', partnerLang, { amount: amountLine }))}\n\n` +
    `👤 ${escapeTelegramHtmlText(notifyTelegramCopy('notifyTg_guestLabel', partnerLang))}: ${escapeTelegramHtmlText(booking.guest_name || 'N/A')}\n` +
    `📞 ${escapeTelegramHtmlText(booking.guest_phone || '')}\n` +
    `📅 ${escapeTelegramHtmlText(String(booking.check_in || ''))} → ${escapeTelegramHtmlText(String(booking.check_out || ''))}\n\n` +
    `📊 <b>${escapeTelegramHtmlText(notifyTelegramCopy('notifyTg_commissionLine', partnerLang, { rate: commissionRate, amount: commissionAmount.toLocaleString() }))}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 <b>${escapeTelegramHtmlText(notifyTelegramCopy('notifyTg_partnerEarnings', partnerLang, { amount: partnerEarnings.toLocaleString() }))}</b>\n` +
    `${tgNote ? `\n💬 <b>${escapeTelegramHtmlText(notifyTelegramCopy('notifyTg_guestMessage', partnerLang))}</b>\n${escapeTelegramHtmlText(tgNote)}\n` : ''}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: notifyTelegramCopy('notifyTg_bookingApprove', partnerLang), callback_data: `approve_booking_${booking.id}` },
        { text: notifyTelegramCopy('notifyTg_bookingDecline', partnerLang), callback_data: `decline_booking_${booking.id}` },
      ],
      [
        {
          text: notifyTelegramCopy('notifyTg_openInApp', partnerLang),
          url: `${BASE_URL}/partner/bookings?booking=${encodeURIComponent(String(booking.id))}`,
        },
      ],
    ],
  };

  const result = await sendTelegramMessagePayload({
    chat_id: chatId,
    text: message,
    reply_markup: keyboard,
  });
  if (result.success) {
    console.log(`[TELEGRAM BOOKING] Sent to: ${chatId} with inline buttons`);
  } else {
    console.error(`[TELEGRAM BOOKING ERROR] ${result.error || result.reason}`);
  }
  return result;
}

/** Send to admin group (general topic, no thread). */
export async function sendToAdminGroup(message, options = {}) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_GROUP_ID) {
    console.warn('[TELEGRAM] No admin group configured');
    return { success: false, reason: 'missing_config' };
  }
  return sendTelegramMessagePayload({
    chat_id: TELEGRAM_ADMIN_GROUP_ID,
    text: message,
    disable_web_page_preview: options.disable_web_page_preview,
    message_thread_id: options.message_thread_id,
    reply_markup: options.reply_markup,
  });
}

/**
 * Support topic in admin HQ (TELEGRAM_SUPPORT_TOPIC_ID) or general group.
 */
export async function sendToSupportTopic(message, options = {}) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_GROUP_ID) {
    return { success: false, reason: 'missing_config' };
  }
  const raw = (process.env.TELEGRAM_SUPPORT_TOPIC_ID || '').trim();
  const threadId = raw ? parseInt(raw, 10) : NaN;
  const payload = {
    chat_id: TELEGRAM_ADMIN_GROUP_ID,
    text: message,
    disable_web_page_preview:
      options.disable_web_page_preview !== undefined ? options.disable_web_page_preview : true,
    reply_markup: options.reply_markup,
  };
  if (Number.isFinite(threadId) && threadId > 0) {
    payload.message_thread_id = threadId;
  }
  return sendTelegramMessagePayload(payload);
}

/** DM or group chat with optional thread / preview flags. */
export async function sendTelegramToChat(chatId, text, options = {}) {
  return sendTelegramMessagePayload({
    chat_id: chatId,
    text,
    disable_web_page_preview: options.disable_web_page_preview,
    message_thread_id: options.message_thread_id,
    reply_markup: options.reply_markup,
  });
}

async function telegramApiCall(method, params = {}) {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: 'No bot token' };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(TELEGRAM_FETCH_TIMEOUT_MS),
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

export async function getBotInfo() {
  return telegramApiCall('getMe');
}

export async function getChatInfo(chatId) {
  return telegramApiCall('getChat', { chat_id: chatId || TELEGRAM_ADMIN_GROUP_ID });
}

/** One-time link code for Telegram account binding. */
export function generateLinkCode() {
  return 'FR_' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

/** Admin test ping — booking / finance / partner / general. */
export async function sendTestAlert(type) {
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' });
  switch (type) {
    case 'booking':
      return sendToAdminTopic(
        'BOOKINGS',
        `🧪 <b>TEST BOOKING</b>\n\nLuxury Villa Ocean View\nTest Guest\n🕐 ${now}`,
      );
    case 'finance':
      return sendToAdminTopic(
        'FINANCE',
        `🧪 <b>TEST FINANCE</b>\n\n3500 USDT\nTXID: TEST_${Date.now()}\n🕐 ${now}`,
      );
    case 'partner':
      return sendToAdminTopic(
        'NEW_PARTNERS',
        `🧪 <b>TEST PARTNER</b>\n\nTest Partner\ntest@example.com\n🕐 ${now}`,
      );
    default:
      return sendToAdminGroup(`🧪 <b>TEST ALERT</b>\n\n🕐 ${now}`);
  }
}

/** Attempt to create forum topics (admin tooling). */
export async function initializeTopics() {
  const topicConfigs = [
    { key: 'BOOKINGS', name: '🏠 BOOKINGS', color: 7322096 },
    { key: 'FINANCE', name: '💰 FINANCE', color: 16766720 },
    { key: 'NEW_PARTNERS', name: '🤝 NEW_PARTNERS', color: 9367192 },
  ];
  const results = {};
  for (const config of topicConfigs) {
    const result = await telegramApiCall('createForumTopic', {
      chat_id: TELEGRAM_ADMIN_GROUP_ID,
      name: config.name,
      icon_color: config.color,
    });
    if (result.ok) {
      results[config.key] = {
        success: true,
        threadId: result.result?.message_thread_id,
        name: config.name,
      };
    } else {
      results[config.key] = {
        success: false,
        error: result.description || result.error,
      };
    }
  }
  return results;
}
