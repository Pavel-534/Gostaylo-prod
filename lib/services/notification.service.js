/**
 * FunnyRent 2.1 - Notification Service v3.0
 * Centralized dispatcher for Telegram and Email notifications
 * 
 * FEATURES:
 * - Direct Telegram API calls (no SDK required)
 * - Resend Email integration with professional HTML templates
 * - Telegram Topics support (BOOKINGS:15, FINANCE:16, NEW_PARTNERS:17)
 * - Multilingual support (RU, EN, ZH, TH)
 * - Escrow security messaging
 */

import { EmailService } from './email.service.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM';
const TELEGRAM_ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID || '-1003832026983';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Use resend.dev for testing until funnyrent.com domain is verified
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'FunnyRent <onboarding@resend.dev>';

// Telegram Topic Thread IDs
const TOPIC_IDS = {
  BOOKINGS: 15,
  FINANCE: 16,
  NEW_PARTNERS: 17
};

// Notification event types
export const NotificationEvents = {
  USER_WELCOME: 'USER_WELCOME',
  NEW_BOOKING_REQUEST: 'NEW_BOOKING_REQUEST',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PARTNER_VERIFIED: 'PARTNER_VERIFIED',
  PARTNER_REJECTED: 'PARTNER_REJECTED',
  LISTING_APPROVED: 'LISTING_APPROVED',
  LISTING_REJECTED: 'LISTING_REJECTED',
  PAYOUT_PROCESSED: 'PAYOUT_PROCESSED',
  PAYOUT_REJECTED: 'PAYOUT_REJECTED',
  NEW_MESSAGE: 'NEW_MESSAGE',
  CHECK_IN_CONFIRMED: 'CHECK_IN_CONFIRMED'
};

// Escrow security message (multi-language)
const ESCROW_MESSAGE = {
  ru: '🔒 Ваши средства защищены системой Эскроу FunnyRent и выплачиваются владельцу только после подтверждения заселения.',
  en: '🔒 Your funds are protected by FunnyRent Escrow and are released to the owner only after check-in confirmation.',
  th: '🔒 เงินของคุณได้รับการคุ้มครองโดย FunnyRent Escrow และจะถูกปล่อยให้เจ้าของหลังจากยืนยันการเช็คอินเท่านั้น'
};

export class NotificationService {
  
  /**
   * Dispatch notification based on event type
   */
  static async dispatch(event, data) {
    console.log(`🔔 [NOTIFICATION] Event: ${event}`, JSON.stringify(data).substring(0, 200));
    
    const handlers = {
      [NotificationEvents.USER_WELCOME]: this.handleUserWelcome,
      [NotificationEvents.NEW_BOOKING_REQUEST]: this.handleNewBookingRequest,
      [NotificationEvents.BOOKING_CONFIRMED]: this.handleBookingConfirmed,
      [NotificationEvents.BOOKING_CANCELLED]: this.handleBookingCancelled,
      [NotificationEvents.PAYMENT_RECEIVED]: this.handlePaymentReceived,
      [NotificationEvents.PAYMENT_SUCCESS]: this.handlePaymentSuccess,
      [NotificationEvents.PARTNER_VERIFIED]: this.handlePartnerVerified,
      [NotificationEvents.PARTNER_REJECTED]: this.handlePartnerRejected,
      [NotificationEvents.LISTING_APPROVED]: this.handleListingApproved,
      [NotificationEvents.LISTING_REJECTED]: this.handleListingRejected,
      [NotificationEvents.PAYOUT_PROCESSED]: this.handlePayoutProcessed,
      [NotificationEvents.PAYOUT_REJECTED]: this.handlePayoutRejected,
      [NotificationEvents.NEW_MESSAGE]: this.handleNewMessage,
      [NotificationEvents.CHECK_IN_CONFIRMED]: this.handleCheckInConfirmed
    };
    
    const handler = handlers[event];
    if (handler) {
      try {
        await handler.call(this, data);
      } catch (error) {
        console.error(`[NOTIFICATION ERROR] ${event}:`, error);
      }
    }
  }
  
  /**
   * Send email via Resend API
   */
  static async sendEmail(to, subject, textBody, htmlBody = null) {
    if (!RESEND_API_KEY) {
      console.log(`[EMAIL MOCK] To: ${to}, Subject: ${subject}`);
      return { success: true, mock: true };
    }
    
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: SENDER_EMAIL,
          to: Array.isArray(to) ? to : [to],
          subject,
          text: textBody,
          html: htmlBody || this.textToHtml(textBody)
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[EMAIL SENT] To: ${to}, ID: ${data.id}`);
        return { success: true, id: data.id };
      } else {
        const error = await response.text();
        console.error(`[EMAIL ERROR] ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      console.error(`[EMAIL ERROR] ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Convert text to basic HTML
   */
  static textToHtml(text) {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${text.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">FunnyRent — Ваша платформа для аренды на Пхукете</p>
      </body>
      </html>
    `;
  }
  
  /**
   * Send Telegram message to individual chat
   */
  static async sendTelegram(chatId, message) {
    if (!chatId) {
      console.log(`[TELEGRAM SKIP] No chat ID`);
      return { success: false, reason: 'no_chat_id' };
    }
    
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          })
        }
      );
      
      if (response.ok) {
        console.log(`[TELEGRAM SENT] To: ${chatId}`);
        return { success: true };
      } else {
        const error = await response.text();
        console.error(`[TELEGRAM ERROR] ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      console.error(`[TELEGRAM ERROR] ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send to Admin Group Topic (CRITICAL for Operations)
   * Topics: BOOKINGS (15), FINANCE (16), NEW_PARTNERS (17)
   */
  static async sendToAdminTopic(topicType, message) {
    const threadId = TOPIC_IDS[topicType];
    
    if (!threadId) {
      console.error(`[TOPIC ERROR] Unknown topic: ${topicType}`);
      return { success: false, error: 'unknown_topic' };
    }
    
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_ADMIN_GROUP_ID,
            message_thread_id: threadId,
            text: message,
            parse_mode: 'HTML'
          })
        }
      );
      
      if (response.ok) {
        console.log(`[TOPIC SENT] ${topicType} (thread ${threadId})`);
        return { success: true };
      } else {
        const error = await response.text();
        console.error(`[TOPIC ERROR] ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      console.error(`[TOPIC ERROR] ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  // ==================== EVENT HANDLERS ====================
  
  static async handleUserWelcome(data) {
    const { user, lang = 'ru' } = data;
    
    // Professional HTML Email to new user using EmailService
    try {
      await EmailService.sendWelcome({
        name: user.first_name || user.name || user.email?.split('@')[0],
        email: user.email
      }, lang);
      console.log(`[WELCOME EMAIL] Sent to ${user.email}`);
    } catch (error) {
      console.error('[WELCOME EMAIL ERROR]', error);
      // Fallback to simple email
      await this.sendEmail(
        user.email,
        '🌴 Добро пожаловать в FunnyRent!',
        `Здравствуйте, ${user.first_name || 'друг'}!\n\nДобро пожаловать в FunnyRent — вашу платформу для аренды на Пхукете.\n\nС уважением,\nКоманда FunnyRent`
      );
    }
    
    // If partner, notify admin group
    if (user.role === 'PARTNER') {
      await this.sendToAdminTopic('NEW_PARTNERS',
        `🤝 <b>НОВЫЙ ПАРТНЁР</b>\n\n` +
        `👤 <b>Имя:</b> ${user.first_name || ''} ${user.last_name || ''}\n` +
        `📧 <b>Email:</b> ${user.email}\n` +
        `📞 <b>Телефон:</b> ${user.phone || 'N/A'}\n\n` +
        `📊 <b>Статус:</b> PENDING VERIFICATION\n` +
        `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
      );
    }
  }
  
  static async handleNewBookingRequest(data) {
    const { booking, partner, listing, guest, lang = 'ru' } = data;
    
    const bookingData = {
      id: booking.id,
      renterName: booking.guest_name || guest?.name || 'Гость',
      renterEmail: booking.guest_email || guest?.email,
      listingTitle: listing?.title || 'Объект',
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: this.calculateNights(booking.check_in, booking.check_out),
      totalPrice: booking.price_thb || 0
    };
    
    // 1. Professional HTML Email to Guest (Booking Requested)
    const guestEmail = booking.guest_email || guest?.email;
    if (guestEmail) {
      try {
        await EmailService.sendBookingRequested(bookingData, guestEmail, lang);
        console.log(`[BOOKING EMAIL] Sent to guest: ${guestEmail}`);
      } catch (error) {
        console.error('[BOOKING EMAIL ERROR]', error);
        // Fallback
        await this.sendEmail(
          guestEmail,
          `🏠 Заявка на бронирование: ${listing?.title || 'Объект'}`,
          `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\nВаша заявка на бронирование получена!\n\n` +
          `📍 Объект: ${listing?.title || 'N/A'}\n📅 Даты: ${booking.check_in} — ${booking.check_out}\n` +
          `💰 Сумма: ฿${booking.price_thb?.toLocaleString() || 0}\n\n${ESCROW_MESSAGE.ru}`
        );
      }
    }
    
    // 2. Professional HTML Email to Partner (New Lead Alert)
    if (partner?.email) {
      try {
        await EmailService.sendNewLeadAlert(bookingData, partner.email, lang);
        console.log(`[LEAD ALERT EMAIL] Sent to partner: ${partner.email}`);
      } catch (error) {
        console.error('[LEAD ALERT EMAIL ERROR]', error);
        // Fallback
        await this.sendEmail(
          partner.email,
          `🏠 Новая заявка на бронирование: ${listing?.title || 'Объект'}`,
          `Здравствуйте, ${partner.first_name || 'Партнёр'}!\n\nПолучена новая заявка на бронирование!\n\n` +
          `📍 Объект: ${listing?.title || 'N/A'}\n👤 Гость: ${booking.guest_name || 'N/A'}\n` +
          `📅 Даты: ${booking.check_in} — ${booking.check_out}\n💰 Сумма: ฿${booking.price_thb?.toLocaleString() || 0}`
        );
      }
    }
    
    // 3. Telegram to Partner (if linked)
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `🏠 <b>Новая заявка!</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `👤 ${booking.guest_name || 'Гость'}\n` +
        `📅 ${booking.check_in} — ${booking.check_out}\n` +
        `💰 ฿${booking.price_thb?.toLocaleString() || 0}`
      );
    }
    
    // 4. Admin Topic: BOOKINGS
    await this.sendToAdminTopic('BOOKINGS',
      `🏠 <b>НОВОЕ БРОНИРОВАНИЕ</b>\n\n` +
      `📍 <b>Объект:</b> ${listing?.title || 'N/A'}\n` +
      `👤 <b>Гость:</b> ${booking.guest_name || 'N/A'}\n` +
      `📧 ${booking.guest_email || ''}\n` +
      `📞 ${booking.guest_phone || ''}\n` +
      `📅 <b>Даты:</b> ${booking.check_in} → ${booking.check_out}\n` +
      `💰 <b>Сумма:</b> ฿${booking.price_thb?.toLocaleString() || 0}\n\n` +
      `🏢 <b>Партнёр:</b> ${partner?.first_name || ''} ${partner?.last_name || ''}\n` +
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
    );
  }
  
  // Helper: Calculate nights between dates
  static calculateNights(checkIn, checkOut) {
    try {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }
  
  static async handleBookingConfirmed(data) {
    const { booking, listing, guest } = data;
    
    // Email to Guest
    await this.sendEmail(
      booking.guest_email || guest?.email,
      `✅ Бронирование подтверждено: ${listing?.title || 'Объект'}`,
      `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\n` +
      `Ваше бронирование подтверждено!\n\n` +
      `📍 Объект: ${listing?.title || 'N/A'}\n` +
      `📅 Даты: ${booking.check_in} — ${booking.check_out}\n` +
      `💰 Сумма к оплате: ฿${booking.price_thb?.toLocaleString() || 0}\n\n` +
      `${ESCROW_MESSAGE.ru}\n\n` +
      `Пожалуйста, перейдите к оплате.\n\nС уважением,\nКоманда FunnyRent`
    );
    
    // Admin Topic
    await this.sendToAdminTopic('BOOKINGS',
      `✅ <b>БРОНИРОВАНИЕ ПОДТВЕРЖДЕНО</b>\n\n` +
      `📝 <b>ID:</b> ${booking.id}\n` +
      `📍 ${listing?.title || 'N/A'}\n` +
      `👤 ${booking.guest_name || 'N/A'}\n` +
      `📅 ${booking.check_in} → ${booking.check_out}\n` +
      `💰 ฿${booking.price_thb?.toLocaleString() || 0}`
    );
  }
  
  static async handleBookingCancelled(data) {
    const { booking, listing, guest, reason } = data;
    
    await this.sendEmail(
      booking.guest_email || guest?.email,
      `❌ Бронирование отменено: ${listing?.title || 'Объект'}`,
      `К сожалению, ваше бронирование было отменено.\n\n` +
      `📍 Объект: ${listing?.title || 'N/A'}\n` +
      `📅 Даты: ${booking.check_in} — ${booking.check_out}\n` +
      `Причина: ${reason || 'Не указана'}\n\n` +
      `Если у вас есть вопросы, свяжитесь с поддержкой.\n\nС уважением,\nКоманда FunnyRent`
    );
  }
  
  static async handlePaymentReceived(data) {
    const { booking, payment, listing, partner } = data;
    
    // Admin Topic: FINANCE
    await this.sendToAdminTopic('FINANCE',
      `💰 <b>ПЛАТЁЖ ПОЛУЧЕН</b>\n\n` +
      `📝 <b>Booking ID:</b> ${booking?.id || 'N/A'}\n` +
      `📍 <b>Объект:</b> ${listing?.title || 'N/A'}\n` +
      `💵 <b>Сумма:</b> ฿${payment?.amount?.toLocaleString() || 0}\n` +
      `🔗 <b>Метод:</b> ${payment?.method || 'N/A'}\n` +
      `${payment?.txid ? `📋 <b>TXID:</b> <code>${payment.txid}</code>\n` : ''}` +
      `\n✅ <b>Статус:</b> CONFIRMED\n` +
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
    );
    
    // Notify Partner
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `💰 <b>Оплата получена!</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `💵 ฿${payment?.amount?.toLocaleString() || 0}\n\n` +
        `${ESCROW_MESSAGE.ru}`
      );
    }
  }
  
  static async handlePaymentSuccess(data) {
    const { booking, payment, listing } = data;
    
    // Email to Guest with Escrow message
    await this.sendEmail(
      booking.guest_email,
      `💰 Оплата получена: ${listing?.title || 'Объект'}`,
      `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\n` +
      `Спасибо! Ваша оплата успешно получена.\n\n` +
      `📍 Объект: ${listing?.title || 'N/A'}\n` +
      `💵 Сумма: ฿${payment?.amount?.toLocaleString() || booking.price_thb?.toLocaleString() || 0}\n` +
      `🔗 Метод: ${payment?.method || 'N/A'}\n` +
      `📋 Статус: Оплачено ✅\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${ESCROW_MESSAGE.ru}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Ждём вас ${booking.check_in}!\n\nС уважением,\nКоманда FunnyRent`,
      // HTML version
      `<!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">💰 Оплата получена!</h1>
        </div>
        <div style="padding: 20px;">
          <p>Здравствуйте, <strong>${booking.guest_name || 'Гость'}</strong>!</p>
          <p>Спасибо! Ваша оплата успешно получена.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">📍 Объект:</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${listing?.title || 'N/A'}</strong></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">💵 Сумма:</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>฿${payment?.amount?.toLocaleString() || booking.price_thb?.toLocaleString() || 0}</strong></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">🔗 Метод:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payment?.method || 'N/A'}</td></tr>
            <tr><td style="padding: 8px;">📋 Статус:</td><td style="padding: 8px;"><span style="color: #0d9488; font-weight: bold;">Оплачено ✅</span></td></tr>
          </table>
          <div style="background: #f0fdfa; border-left: 4px solid #0d9488; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #0d9488;"><strong>🔒 Гарантия безопасности</strong></p>
            <p style="margin: 8px 0 0 0; color: #115e59;">${ESCROW_MESSAGE.ru}</p>
          </div>
          <p>Ждём вас <strong>${booking.check_in}</strong>!</p>
        </div>
        <div style="background: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px;">
          FunnyRent — Ваша платформа для аренды на Пхукете
        </div>
      </body>
      </html>`
    );
    
    // Admin Topic: FINANCE
    await this.sendToAdminTopic('FINANCE',
      `💰 <b>ПЛАТЁЖ ПОДТВЕРЖДЁН</b>\n\n` +
      `📝 <b>Booking:</b> ${booking?.id}\n` +
      `📍 ${listing?.title || 'N/A'}\n` +
      `👤 ${booking.guest_name || 'N/A'}\n` +
      `💵 ฿${payment?.amount?.toLocaleString() || booking.price_thb?.toLocaleString() || 0}\n` +
      `🔗 ${payment?.method || 'N/A'}\n\n` +
      `✅ Средства в Эскроу`
    );
  }
  
  static async handlePartnerVerified(data) {
    const { partner } = data;
    
    await this.sendEmail(
      partner.email,
      '🎉 Ваша учетная запись верифицирована!',
      `Поздравляем, ${partner.first_name || 'Партнёр'}!\n\n` +
      `Ваша учетная запись партнёра была успешно верифицирована.\n\n` +
      `Теперь вы можете:\n` +
      `• Создавать объявления\n` +
      `• Принимать бронирования\n` +
      `• Получать выплаты\n\n` +
      `Удачного бизнеса!\n\nС уважением,\nКоманда FunnyRent`
    );
    
    await this.sendToAdminTopic('NEW_PARTNERS',
      `✅ <b>ПАРТНЁР ВЕРИФИЦИРОВАН</b>\n\n` +
      `👤 ${partner.first_name || ''} ${partner.last_name || ''}\n` +
      `📧 ${partner.email}\n` +
      `📊 <b>Статус:</b> VERIFIED`
    );
  }
  
  static async handlePartnerRejected(data) {
    const { partner, reason } = data;
    
    await this.sendEmail(
      partner.email,
      '❌ Верификация отклонена',
      `К сожалению, ваша заявка на верификацию была отклонена.\n\n` +
      `Причина: ${reason || 'Документы не соответствуют требованиям'}\n\n` +
      `Вы можете исправить указанные проблемы и подать заявку повторно.\n\nС уважением,\nКоманда FunnyRent`
    );
  }
  
  static async handleListingApproved(data) {
    const { listing, partner } = data;
    
    if (partner?.email) {
      await this.sendEmail(
        partner.email,
        `✅ Объявление одобрено: ${listing?.title}`,
        `Поздравляем!\n\nВаше объявление "${listing?.title}" было одобрено и опубликовано.\n\n` +
        `Теперь оно доступно для бронирования.\n\nС уважением,\nКоманда FunnyRent`
      );
    }
    
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `✅ <b>Объявление одобрено!</b>\n\n📍 ${listing?.title}\n\n🎉 Теперь доступно для бронирования`
      );
    }
  }
  
  static async handleListingRejected(data) {
    const { listing, partner, reason } = data;
    
    if (partner?.email) {
      await this.sendEmail(
        partner.email,
        `❌ Объявление отклонено: ${listing?.title}`,
        `К сожалению, ваше объявление "${listing?.title}" было отклонено.\n\n` +
        `Причина: ${reason || 'Не указана'}\n\n` +
        `Вы можете исправить указанные проблемы и подать объявление повторно.\n\nС уважением,\nКоманда FunnyRent`
      );
    }
    
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `❌ <b>Объявление отклонено</b>\n\n📍 ${listing?.title}\n\n📝 Причина: ${reason || 'Не указана'}`
      );
    }
  }
  
  static async handlePayoutProcessed(data) {
    const { payout, partner } = data;
    
    await this.sendEmail(
      partner.email,
      '💰 Выплата успешно отправлена!',
      `Выплата обработана!\n\n` +
      `💵 Сумма: ${payout.amount} ${payout.currency}\n` +
      `🔗 Метод: ${payout.method}\n` +
      `📋 ID: ${payout.transaction_id || 'N/A'}\n\n` +
      `Средства поступят в течение 1-3 рабочих дней.\n\nС уважением,\nКоманда FunnyRent`
    );
    
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `💰 <b>Выплата отправлена!</b>\n\n` +
        `💵 ${payout.amount} ${payout.currency}\n` +
        `📝 ${payout.method}`
      );
    }
    
    await this.sendToAdminTopic('FINANCE',
      `💸 <b>ВЫПЛАТА ОТПРАВЛЕНА</b>\n\n` +
      `👤 ${partner.first_name || ''} ${partner.last_name || ''}\n` +
      `💵 ${payout.amount} ${payout.currency}\n` +
      `🔗 ${payout.method}`
    );
  }
  
  static async handlePayoutRejected(data) {
    const { payout, partner, reason } = data;
    
    await this.sendEmail(
      partner.email,
      '❌ Выплата отклонена',
      `Ваш запрос на выплату был отклонен.\n\n` +
      `💵 Сумма: ${payout.amount} ${payout.currency}\n` +
      `📝 Причина: ${reason || 'Не указана'}\n\n` +
      `Обратитесь в поддержку для уточнения деталей.\n\nС уважением,\nКоманда FunnyRent`
    );
  }
  
  static async handleNewMessage(data) {
    const { message, recipient } = data;
    
    if (recipient?.email) {
      await this.sendEmail(
        recipient.email,
        '💬 Новое сообщение в чате',
        `У вас новое сообщение от ${message.sender_name || 'пользователя'}:\n\n` +
        `"${message.message?.substring(0, 200)}${message.message?.length > 200 ? '...' : ''}"\n\n` +
        `Ответьте в личном кабинете.\n\nС уважением,\nКоманда FunnyRent`
      );
    }
  }
  
  static async handleCheckInConfirmed(data) {
    const { booking, listing, partner } = data;
    
    // Notify Partner about funds release
    if (partner?.email) {
      await this.sendEmail(
        partner.email,
        `✅ Заселение подтверждено: ${listing?.title}`,
        `Гость заселился!\n\n` +
        `📍 Объект: ${listing?.title}\n` +
        `📅 ${booking.check_in} — ${booking.check_out}\n` +
        `💰 Сумма: ฿${booking.price_thb?.toLocaleString()}\n\n` +
        `Средства из Эскроу переведены на ваш баланс.\n\nС уважением,\nКоманда FunnyRent`
      );
    }
    
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `✅ <b>Заселение подтверждено!</b>\n\n` +
        `📍 ${listing?.title}\n` +
        `💰 ฿${booking.price_thb?.toLocaleString()}\n\n` +
        `💸 Средства переведены на ваш баланс`
      );
    }
    
    await this.sendToAdminTopic('FINANCE',
      `✅ <b>ЗАСЕЛЕНИЕ ПОДТВЕРЖДЕНО</b>\n\n` +
      `📝 ${booking?.id}\n` +
      `📍 ${listing?.title}\n` +
      `💰 ฿${booking.price_thb?.toLocaleString()}\n\n` +
      `💸 Эскроу → Партнёр`
    );
  }
}

export default NotificationService;
