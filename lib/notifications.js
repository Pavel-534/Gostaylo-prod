/**
 * Unified Notification Dispatcher
 * Handles all system events and routes notifications based on user preferences
 */

import { sendEmail } from './mail';
import { sendTelegramMessage } from './telegram';

// Event types supported by the notification system
export const NotificationEvents = {
  USER_WELCOME: 'USER_WELCOME',
  NEW_BOOKING_REQUEST: 'NEW_BOOKING_REQUEST',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  NEW_MESSAGE: 'NEW_MESSAGE',
  PARTNER_VERIFIED: 'PARTNER_VERIFIED',
  PAYOUT_PROCESSED: 'PAYOUT_PROCESSED',
};

/**
 * Main notification dispatcher
 * @param {string} eventType - Type of event (from NotificationEvents)
 * @param {object} user - User object with notification preferences
 * @param {object} data - Event-specific data
 */
export async function dispatchNotification(eventType, user, data) {
  console.log(`\n🔔 [NOTIFICATION DISPATCHER] Event: ${eventType}`);
  console.log(`👤 User: ${user.name} (${user.email})`);
  console.log(`⚙️  Preferences:`, user.notificationPreferences || 'Not set');

  // Default preferences if not set
  const preferences = user.notificationPreferences || {
    email: true,
    telegram: false,
    telegramChatId: null,
  };

  const results = {
    email: null,
    telegram: null,
  };

  // Route to appropriate handlers based on event type
  switch (eventType) {
    case NotificationEvents.USER_WELCOME:
      if (preferences.email) {
        results.email = await sendWelcomeEmail(user, data);
      }
      if (preferences.telegram && preferences.telegramChatId) {
        results.telegram = await sendWelcomeTelegram(user, data);
      }
      break;

    case NotificationEvents.NEW_BOOKING_REQUEST:
      if (preferences.email) {
        results.email = await sendBookingRequestEmail(user, data);
      }
      if (preferences.telegram && preferences.telegramChatId) {
        results.telegram = await sendBookingRequestTelegram(user, data);
      }
      break;

    case NotificationEvents.PAYMENT_SUCCESS:
      if (preferences.email) {
        results.email = await sendPaymentSuccessEmail(user, data);
      }
      if (preferences.telegram && preferences.telegramChatId) {
        results.telegram = await sendPaymentSuccessTelegram(user, data);
      }
      break;

    case NotificationEvents.NEW_MESSAGE:
      if (preferences.email) {
        results.email = await sendNewMessageEmail(user, data);
      }
      if (preferences.telegram && preferences.telegramChatId) {
        results.telegram = await sendNewMessageTelegram(user, data);
      }
      break;

    case NotificationEvents.PARTNER_VERIFIED:
      // Always send this important notification
      results.email = await sendPartnerVerifiedEmail(user, data);
      if (preferences.telegram && preferences.telegramChatId) {
        results.telegram = await sendPartnerVerifiedTelegram(user, data);
      }
      break;

    case NotificationEvents.PAYOUT_PROCESSED:
      // Always send this important notification
      results.email = await sendPayoutProcessedEmail(user, data);
      if (preferences.telegram && preferences.telegramChatId) {
        results.telegram = await sendPayoutProcessedTelegram(user, data);
      }
      break;

    default:
      console.log(`⚠️  Unknown event type: ${eventType}`);
      return { success: false, error: 'Unknown event type' };
  }

  console.log(`✅ Notification dispatch complete:`, results);
  return results;
}

// ============================================================================
// EMAIL HANDLERS
// ============================================================================

async function sendWelcomeEmail(user, data) {
  return await sendEmail({
    to: user.email,
    subject: '🎉 Добро пожаловать в FunnyRent!',
    template: 'welcome-email',
    data: {
      userName: user.name,
      loginUrl: data.loginUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/login`,
    },
  });
}

async function sendBookingRequestEmail(user, data) {
  const { booking, listing, renter, priceBreakdown } = data;
  
  return await sendEmail({
    to: user.email,
    subject: `🏠 Новая заявка на бронирование: ${listing.title}`,
    template: 'booking-request-email',
    data: {
      partnerName: user.name,
      renterName: renter.name,
      listingTitle: listing.title,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
      totalPrice: booking.totalPrice,
      currency: booking.currency || 'THB',
      priceBreakdown: priceBreakdown || null,
      bookingUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/partner/bookings/${booking.id}`,
    },
  });
}

async function sendPaymentSuccessEmail(user, data) {
  const { booking, listing } = data;
  
  return await sendEmail({
    to: user.email,
    subject: '✅ Оплата получена!',
    template: 'payment-success-email',
    data: {
      userName: user.name,
      listingTitle: listing.title,
      amount: booking.totalPrice,
      currency: booking.currency || 'THB',
      bookingId: booking.id,
      dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/bookings`,
    },
  });
}

async function sendNewMessageEmail(user, data) {
  const { message, sender } = data;
  
  // Simple text email for new messages
  return await sendEmail({
    to: user.email,
    subject: `💬 Новое сообщение от ${sender.name}`,
    template: 'welcome-email', // Reusing template for now
    data: {
      userName: user.name,
      loginUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/messages`,
    },
  });
}

async function sendPartnerVerifiedEmail(user, data) {
  return await sendEmail({
    to: user.email,
    subject: '🎉 Ваша учетная запись верифицирована!',
    template: 'partner-verified-email',
    data: {
      partnerName: user.name,
      loginUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/partner`,
    },
  });
}

async function sendPayoutProcessedEmail(user, data) {
  const { amount, currency, method, destination, transactionId } = data;
  
  return await sendEmail({
    to: user.email,
    subject: '💰 Выплата успешно отправлена!',
    template: 'payout-processed-email',
    data: {
      partnerName: user.name,
      amount,
      currency: currency || 'THB',
      method,
      destination,
      transactionId,
      dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/partner/payouts`,
    },
  });
}

// ============================================================================
// TELEGRAM HANDLERS
// ============================================================================

async function sendWelcomeTelegram(user, data) {
  const message = `🎉 Добро пожаловать в FunnyRent, ${user.name}!\n\nМы рады видеть вас на нашей платформе.`;
  return await sendTelegramMessage(user.notificationPreferences.telegramChatId, message);
}

async function sendBookingRequestTelegram(user, data) {
  const { booking, listing, renter } = data;
  const message = `🏠 Новая заявка на бронирование!\n\n📍 Объект: ${listing.title}\n👤 Арендатор: ${renter.name}\n📅 ${booking.checkIn} → ${booking.checkOut}\n💰 ${booking.totalPrice} ${booking.currency || 'THB'}`;
  return await sendTelegramMessage(user.notificationPreferences.telegramChatId, message);
}

async function sendPaymentSuccessTelegram(user, data) {
  const { booking, listing } = data;
  const message = `✅ Оплата получена!\n\n🏠 ${listing.title}\n💰 ${booking.totalPrice} ${booking.currency || 'THB'}\n📋 ID: ${booking.id}`;
  return await sendTelegramMessage(user.notificationPreferences.telegramChatId, message);
}

async function sendNewMessageTelegram(user, data) {
  const { message: msg, sender } = data;
  const message = `💬 Новое сообщение от ${sender.name}:\n\n"${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}"`;
  return await sendTelegramMessage(user.notificationPreferences.telegramChatId, message);
}

async function sendPartnerVerifiedTelegram(user, data) {
  const message = `🎉 Поздравляем, ${user.name}!\n\n✅ Ваша учетная запись верифицирована!\nТеперь вы можете публиковать объекты и получать бронирования.`;
  return await sendTelegramMessage(user.notificationPreferences.telegramChatId, message);
}

async function sendPayoutProcessedTelegram(user, data) {
  const { amount, currency, method, transactionId } = data;
  const methodText = method === 'bank' ? '🏦 Банк' : '💎 USDT';
  const message = `💰 Выплата отправлена!\n\n💵 ${amount} ${currency || 'THB'}\n${methodText}\n📋 ID: ${transactionId}`;
  return await sendTelegramMessage(user.notificationPreferences.telegramChatId, message);
}
