/**
 * FunnyRent 2.1 - Notification Service
 * Centralized dispatcher for Telegram and Email notifications
 */

import { supabaseAdmin } from '@/lib/supabase';

// Notification event types
export const NotificationEvents = {
  USER_WELCOME: 'USER_WELCOME',
  NEW_BOOKING_REQUEST: 'NEW_BOOKING_REQUEST',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PARTNER_VERIFIED: 'PARTNER_VERIFIED',
  PARTNER_REJECTED: 'PARTNER_REJECTED',
  PAYOUT_PROCESSED: 'PAYOUT_PROCESSED',
  PAYOUT_REJECTED: 'PAYOUT_REJECTED',
  NEW_MESSAGE: 'NEW_MESSAGE'
};

export class NotificationService {
  
  /**
   * Dispatch notification based on event type
   */
  static async dispatch(event, data) {
    console.log(`🔔 [NOTIFICATION] Event: ${event}`, data);
    
    const handlers = {
      [NotificationEvents.USER_WELCOME]: this.handleUserWelcome,
      [NotificationEvents.NEW_BOOKING_REQUEST]: this.handleNewBookingRequest,
      [NotificationEvents.BOOKING_CONFIRMED]: this.handleBookingConfirmed,
      [NotificationEvents.BOOKING_CANCELLED]: this.handleBookingCancelled,
      [NotificationEvents.PAYMENT_RECEIVED]: this.handlePaymentReceived,
      [NotificationEvents.PARTNER_VERIFIED]: this.handlePartnerVerified,
      [NotificationEvents.PARTNER_REJECTED]: this.handlePartnerRejected,
      [NotificationEvents.PAYOUT_PROCESSED]: this.handlePayoutProcessed,
      [NotificationEvents.PAYOUT_REJECTED]: this.handlePayoutRejected,
      [NotificationEvents.NEW_MESSAGE]: this.handleNewMessage
    };
    
    const handler = handlers[event];
    if (handler) {
      try {
        await handler.call(this, data);
      } catch (error) {
        console.error(`[NOTIFICATION ERROR] ${event}:`, error);
      }
    }
    
    // Log activity
    await this.logActivity(event, data);
  }
  
  /**
   * Send email notification (mock for now, ready for Resend)
   */
  static async sendEmail(to, subject, body, html = null) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (RESEND_API_KEY) {
      // Real Resend implementation
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'FunnyRent <noreply@funnyrent.com>',
            to: [to],
            subject,
            text: body,
            html: html || body
          })
        });
        
        if (response.ok) {
          console.log(`[EMAIL SENT] To: ${to}, Subject: ${subject}`);
          return { success: true };
        } else {
          const error = await response.text();
          console.error(`[EMAIL ERROR] ${error}`);
          return { success: false, error };
        }
      } catch (error) {
        console.error(`[EMAIL ERROR] ${error.message}`);
        return { success: false, error: error.message };
      }
    } else {
      // Mock email
      console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
      console.log(`[MOCK EMAIL] Body: ${body.substring(0, 100)}...`);
      return { success: true, mock: true };
    }
  }
  
  /**
   * Send Telegram notification (mock for now, ready for real bot)
   */
  static async sendTelegram(chatId, message) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
    if (TELEGRAM_BOT_TOKEN && chatId) {
      // Real Telegram implementation
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
    } else {
      // Mock telegram
      console.log(`[MOCK TELEGRAM] To: ${chatId || 'no_chat_id'}`);
      console.log(`[MOCK TELEGRAM] Message: ${message.substring(0, 100)}...`);
      return { success: true, mock: true };
    }
  }

  /**
   * Send notification to admin group topic
   * @param {string} topicType - BOOKINGS, FINANCE, or NEW_PARTNERS
   * @param {string} message - HTML formatted message
   */
  static async sendToAdminTopic(topicType, message) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID;
    
    // Topic thread IDs from FunnyRent HQ group
    const TOPIC_IDS = {
      BOOKINGS: 15,
      FINANCE: 16,
      NEW_PARTNERS: 17
    };
    
    const threadId = TOPIC_IDS[topicType];
    
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_GROUP_ID) {
      console.log(`[ADMIN TOPIC] Not configured - would send to ${topicType}`);
      return { success: false, mock: true };
    }
    
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_GROUP_ID,
            message_thread_id: threadId,
            text: message,
            parse_mode: 'HTML'
          })
        }
      );
      
      if (response.ok) {
        console.log(`[TELEGRAM] Sent to ${topicType} topic (thread ${threadId})`);
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
   * Get user notification preferences
   */
  static async getUserPreferences(userId) {
    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('email, notification_preferences, telegram_id')
      .eq('id', userId)
      .single();
    
    return user || { notification_preferences: { email: true, telegram: false } };
  }
  
  // Event Handlers
  
  static async handleUserWelcome(data) {
    const { user } = data;
    
    await this.sendEmail(
      user.email,
      '🎉 Добро пожаловать в FunnyRent!',
      `Здравствуйте, ${user.first_name || 'друг'}!\n\nДобро пожаловать в FunnyRent - вашу платформу для аренды на Пхукете.\n\nВаш реферальный код: ${user.referral_code}\n\nС уважением,\nКоманда FunnyRent`
    );
  }
  
  static async handleNewBookingRequest(data) {
    const { booking, partner, listing } = data;
    
    const prefs = await this.getUserPreferences(partner.id);
    
    // Send to partner email
    if (prefs.notification_preferences?.email) {
      await this.sendEmail(
        partner.email,
        `🏠 Новая заявка на бронирование: ${listing.title}`,
        `Новая заявка на бронирование!\n\nОбъект: ${listing.title}\nГость: ${booking.guest_name}\nДаты: ${booking.check_in} - ${booking.check_out}\nСумма: ${booking.price_thb} THB\n\nПерейдите в личный кабинет для подтверждения.`
      );
    }
    
    // Send to partner's personal Telegram
    if (prefs.notification_preferences?.telegram && prefs.telegram_id) {
      await this.sendTelegram(
        prefs.telegram_id,
        `🏠 <b>Новая заявка!</b>\n\n📍 ${listing.title}\n👤 ${booking.guest_name}\n📅 ${booking.check_in} - ${booking.check_out}\n💰 ${booking.price_thb} THB`
      );
    }
    
    // Send to admin group BOOKINGS topic
    await this.sendToAdminTopic('BOOKINGS', 
      `🏠 <b>НОВОЕ БРОНИРОВАНИЕ</b>\n\n📍 <b>Объект:</b> ${listing?.title || 'N/A'}\n👤 <b>Гость:</b> ${booking?.guest_name || 'N/A'}\n📧 ${booking?.guest_email || ''}\n📞 ${booking?.guest_phone || ''}\n📅 <b>Даты:</b> ${booking?.check_in} → ${booking?.check_out}\n💰 <b>Сумма:</b> ${booking?.price_thb?.toLocaleString() || 0} THB\n\n🏢 <b>Партнёр:</b> ${partner?.first_name || ''} ${partner?.last_name || ''}`
    );
  }
  
  static async handleBookingConfirmed(data) {
    const { booking, renter, listing } = data;
    
    await this.sendEmail(
      renter.email,
      `✅ Бронирование подтверждено: ${listing.title}`,
      `Ваше бронирование подтверждено!\n\nОбъект: ${listing.title}\nДаты: ${booking.check_in} - ${booking.check_out}\n\nОжидаем вашу оплату.`
    );
  }
  
  static async handleBookingCancelled(data) {
    const { booking, renter, listing, reason } = data;
    
    await this.sendEmail(
      renter.email,
      `❌ Бронирование отменено: ${listing.title}`,
      `К сожалению, ваше бронирование было отменено.\n\nОбъект: ${listing.title}\nДаты: ${booking.check_in} - ${booking.check_out}\nПричина: ${reason || 'Не указана'}`
    );
  }
  
  static async handlePaymentReceived(data) {
    const { booking, payment, renter, listing } = data;
    
    await this.sendEmail(
      renter.email,
      `💰 Оплата получена: ${listing.title}`,
      `Спасибо! Ваша оплата получена.\n\nОбъект: ${listing.title}\nСумма: ${payment.amount} ${payment.currency}\nСтатус: Оплачено\n\nЖдём вас ${booking.check_in}!`
    );
  }
  
  static async handlePartnerVerified(data) {
    const { partner } = data;
    
    await this.sendEmail(
      partner.email,
      '🎉 Ваша учетная запись верифицирована!',
      `Поздравляем, ${partner.first_name}!\n\nВаша учетная запись партнёра была успешно верифицирована.\n\nТеперь вы можете:\n- Создавать объявления\n- Принимать бронирования\n- Получать выплаты\n\nУдачного бизнеса!\nКоманда FunnyRent`
    );
  }
  
  static async handlePartnerRejected(data) {
    const { partner, reason } = data;
    
    await this.sendEmail(
      partner.email,
      '❌ Верификация отклонена',
      `К сожалению, ваша заявка на верификацию была отклонена.\n\nПричина: ${reason || 'Документы не соответствуют требованиям'}\n\nВы можете исправить указанные проблемы и подать заявку повторно.`
    );
  }
  
  static async handlePayoutProcessed(data) {
    const { payout, partner } = data;
    
    const prefs = await this.getUserPreferences(partner.id);
    
    await this.sendEmail(
      partner.email,
      '💰 Выплата успешно отправлена!',
      `Выплата обработана!\n\nСумма: ${payout.amount} ${payout.currency}\nМетод: ${payout.method}\nID транзакции: ${payout.transaction_id || 'N/A'}\n\nСредства поступят в течение 1-3 рабочих дней.`
    );
    
    if (prefs.notification_preferences?.telegram && prefs.telegram_id) {
      await this.sendTelegram(
        prefs.telegram_id,
        `💰 <b>Выплата отправлена!</b>\n\n💵 ${payout.amount} ${payout.currency}\n📝 ${payout.method}`
      );
    }
  }
  
  static async handlePayoutRejected(data) {
    const { payout, partner, reason } = data;
    
    await this.sendEmail(
      partner.email,
      '❌ Выплата отклонена',
      `Ваш запрос на выплату был отклонен.\n\nСумма: ${payout.amount} ${payout.currency}\nПричина: ${reason}\n\nОбратитесь в поддержку для уточнения деталей.`
    );
  }
  
  static async handleNewMessage(data) {
    const { message, recipient } = data;
    
    const prefs = await this.getUserPreferences(recipient.id);
    
    if (prefs.notification_preferences?.email) {
      await this.sendEmail(
        recipient.email,
        '💬 Новое сообщение в чате',
        `У вас новое сообщение от ${message.sender_name}:\n\n"${message.message.substring(0, 200)}${message.message.length > 200 ? '...' : ''}"\n\nОтветьте в личном кабинете.`
      );
    }
  }
  
  /**
   * Log activity to database
   */
  static async logActivity(event, data) {
    try {
      await supabaseAdmin
        .from('activity_log')
        .insert({
          activity_type: event,
          description: this.getEventDescription(event, data),
          user_id: data.user?.id || data.partner?.id || data.renter?.id || null,
          user_name: data.user?.first_name || data.partner?.first_name || data.renter?.first_name || null,
          metadata: data
        });
    } catch (error) {
      console.error('[ACTIVITY LOG ERROR]', error);
    }
  }
  
  static getEventDescription(event, data) {
    const descriptions = {
      [NotificationEvents.USER_WELCOME]: `New user registered: ${data.user?.email}`,
      [NotificationEvents.NEW_BOOKING_REQUEST]: `New booking request for ${data.listing?.title}`,
      [NotificationEvents.BOOKING_CONFIRMED]: `Booking confirmed: ${data.booking?.id}`,
      [NotificationEvents.BOOKING_CANCELLED]: `Booking cancelled: ${data.booking?.id}`,
      [NotificationEvents.PAYMENT_RECEIVED]: `Payment received: ${data.payment?.amount} ${data.payment?.currency}`,
      [NotificationEvents.PARTNER_VERIFIED]: `Partner verified: ${data.partner?.email}`,
      [NotificationEvents.PARTNER_REJECTED]: `Partner rejected: ${data.partner?.email}`,
      [NotificationEvents.PAYOUT_PROCESSED]: `Payout processed: ${data.payout?.amount} ${data.payout?.currency}`,
      [NotificationEvents.PAYOUT_REJECTED]: `Payout rejected: ${data.payout?.id}`
    };
    
    return descriptions[event] || event;
  }
}

export default NotificationService;
