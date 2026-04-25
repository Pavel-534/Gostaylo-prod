/**
 * GoStayLo - Notification Service v3.0 (Stage 2.2 hub)
 * Делегирует: `lib/services/notifications/telegram.service.js`, `email.service.js`, `push.service.js`
 * (шаблоны писем — `lib/services/email.service.js`)
 */

import { EmailService } from './email.service.js';
import { getPublicSiteUrl, buildLocalizedSiteUrl } from '../site-url.js';
import { buildMainMenuReplyMarkup } from './telegram/inline-menu.js';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveThbPerUsdt, resolveDefaultCommissionPercent } from '@/lib/services/currency.service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { normalizeEmailLang, escrowEmailLine } from '@/lib/email/booking-email-i18n';
import {
  getCheckInReminderTelegramCopy,
  getReviewReminderTelegramCopy,
  getPartnerGuestReviewPromptCopy,
} from '@/lib/notification-category-terminology.js';
import { resolveListingCategorySlug } from '@/lib/services/booking.service';
import { PushService } from './notifications/push.service.js';
import {
  sendResendEmail,
  textToHtml as resendTextToHtml,
} from './notifications/email.service.js';
import * as Tg from './notifications/telegram.service.js';
import {
  bookingSpecialRequestsSnippet,
  escapeTelegramHtmlText,
  formatBookingAmountForNotify,
} from './notifications/formatting.js';
import { readBookingFinancialSnapshot } from '@/lib/services/booking-financial-read-model.service';

const BASE_URL = getPublicSiteUrl();

// Notification event types
export const NotificationEvents = {
  USER_WELCOME: 'USER_WELCOME',
  NEW_BOOKING_REQUEST: 'NEW_BOOKING_REQUEST',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PARTNER_VERIFIED: 'PARTNER_VERIFIED',
  PARTNER_REJECTED: 'PARTNER_REJECTED',
  LISTING_APPROVED: 'LISTING_APPROVED',
  LISTING_REJECTED: 'LISTING_REJECTED',
  PAYOUT_PROCESSED: 'PAYOUT_PROCESSED',
  PAYOUT_REJECTED: 'PAYOUT_REJECTED',
  NEW_MESSAGE: 'NEW_MESSAGE',
  CHECK_IN_CONFIRMED: 'CHECK_IN_CONFIRMED',
  // Stage 32 - New events
  ESCROW_THAW_PREVIEW: 'ESCROW_THAW_PREVIEW',
  PAYOUT_BATCH_COMPLETED: 'PAYOUT_BATCH_COMPLETED',
  CHECKIN_REMINDER: 'CHECKIN_REMINDER',
  /** Ежедневное напоминание о черновиках (обрабатывается cron → runDailyDraftDigestReminders) */
  DRAFT_DIGEST_REMINDER: 'DRAFT_DIGEST_REMINDER',
  /** Напоминание об отзыве на следующий день после check_out */
  REVIEW_REMINDER: 'REVIEW_REMINDER',
  /** Средства доступны (THAWED) — партнёр может оставить отзыв о госте */
  PARTNER_GUEST_REVIEW_INVITE: 'PARTNER_GUEST_REVIEW_INVITE',
  /** THAWED: средства по read-model доступны к выводу — push + email → /partner/finances (Stage 47.0) */
  PARTNER_FUNDS_THAWED_AVAILABLE: 'PARTNER_FUNDS_THAWED_AVAILABLE',
};

// Payment method labels for notifications
const PAYMENT_METHOD_LABELS = {
  USDT_TRC20: 'USDT TRC-20',
  CARD_INTL: 'Card (Visa/MC)',
  CARD_RU: 'МИР',
  THAI_QR: 'Thai QR'
};

// Escrow security message (multi-language)
const ESCROW_MESSAGE = {
  ru: '🔒 Ваши средства защищены системой Эскроу GoStayLo и выплачиваются владельцу только после подтверждения заселения.',
  en: '🔒 Your funds are protected by GoStayLo Escrow and are released to the owner only after check-in confirmation.',
  zh: '🔒 您的款项由 GoStayLo 托管保护，仅在确认入住后才会结算给房东。',
  th: '🔒 เงินของคุณได้รับการคุ้มครองโดย GoStayLo Escrow และจะถูกปล่อยให้เจ้าของหลังจากยืนยันการเช็คอินเท่านั้น',
};

/** Изолирует сбой одного канала (email / tg / admin topic). */
async function safeNotifyChannel(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.error(`[NOTIFICATION channel:${label}]`, e);
  }
}

export class NotificationService {
  
  /**
   * Dispatch notification based on event type
   */
  static async dispatch(event, data) {
    let preview = '';
    try {
      preview = JSON.stringify(data).substring(0, 200);
    } catch {
      preview = '[unserializable payload]';
    }
    console.log(`🔔 [NOTIFICATION] Event: ${event}`, preview);
    
    const handlers = {
      [NotificationEvents.USER_WELCOME]: this.handleUserWelcome,
      [NotificationEvents.NEW_BOOKING_REQUEST]: this.handleNewBookingRequest,
      [NotificationEvents.BOOKING_CONFIRMED]: this.handleBookingConfirmed,
      [NotificationEvents.BOOKING_CANCELLED]: this.handleBookingCancelled,
      [NotificationEvents.PAYMENT_SUBMITTED]: this.handlePaymentSubmitted,
      [NotificationEvents.PAYMENT_RECEIVED]: this.handlePaymentReceived,
      [NotificationEvents.PAYMENT_SUCCESS]: this.handlePaymentSuccess,
      [NotificationEvents.PAYMENT_CONFIRMED]: this.handlePaymentConfirmed,
      [NotificationEvents.PARTNER_VERIFIED]: this.handlePartnerVerified,
      [NotificationEvents.PARTNER_REJECTED]: this.handlePartnerRejected,
      [NotificationEvents.LISTING_APPROVED]: this.handleListingApproved,
      [NotificationEvents.LISTING_REJECTED]: this.handleListingRejected,
      [NotificationEvents.PAYOUT_PROCESSED]: this.handlePayoutProcessed,
      [NotificationEvents.PAYOUT_REJECTED]: this.handlePayoutRejected,
      [NotificationEvents.NEW_MESSAGE]: this.handleNewMessage,
      [NotificationEvents.CHECK_IN_CONFIRMED]: this.handleCheckInConfirmed,
      // Stage 32 - New handlers
      [NotificationEvents.ESCROW_THAW_PREVIEW]: this.handleEscrowThawPreview,
      [NotificationEvents.PAYOUT_BATCH_COMPLETED]: this.handlePayoutBatchCompleted,
      [NotificationEvents.CHECKIN_REMINDER]: this.handleCheckInReminder,
      [NotificationEvents.DRAFT_DIGEST_REMINDER]: this.handleDraftDigestReminder,
      [NotificationEvents.REVIEW_REMINDER]: this.handleReviewReminder,
      [NotificationEvents.PARTNER_GUEST_REVIEW_INVITE]: this.handlePartnerGuestReviewInvite,
      [NotificationEvents.PARTNER_FUNDS_THAWED_AVAILABLE]: this.handlePartnerFundsThawedAvailable,
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
  
  static async sendEmail(to, subject, textBody, htmlBody = null) {
    return sendResendEmail(to, subject, textBody, htmlBody);
  }

  static textToHtml(text) {
    return resendTextToHtml(text);
  }

  static async sendTelegramMessagePayload(payload) {
    return Tg.sendTelegramMessagePayload(payload);
  }

  static async sendTelegram(chatId, message) {
    return Tg.sendTelegramChat(chatId, message);
  }

  static async sendToAdminTopic(topicType, message, reply_markup) {
    return Tg.sendToAdminTopic(topicType, message, reply_markup);
  }

  static async sendToAdmin(message, reply_markup) {
    return Tg.sendToAdmin(message, reply_markup);
  }

  static async sendSystemAlert(message, opts = {}) {
    return Tg.sendSystemAlertTelegram(message, opts);
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
        '🌴 Добро пожаловать в GoStayLo!',
        `Здравствуйте, ${user.first_name || 'друг'}!\n\nДобро пожаловать в GoStayLo — вашу платформу для аренды на Пхукете.\n\nС уважением,\nКоманда GoStayLo`
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
    const isInstantConfirmed = String(booking?.status || '').toUpperCase() === 'CONFIRMED';
    const pushDateOpts = { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' };
    const d1 = booking?.check_in ? new Date(booking.check_in).toLocaleDateString('en-GB', pushDateOpts) : '—';
    const d2 = booking?.check_out ? new Date(booking.check_out).toLocaleDateString('en-GB', pushDateOpts) : '—';
    const pushDates = `${d1} — ${d2}`;
    
    // Use commission data from booking (calculated by PricingService)
    // NEVER hardcode or recalculate - use stored values from booking record
    const totalPrice = parseFloat(booking.price_thb) || 0;
    const cr = parseFloat(booking.commission_rate);
    const commissionRate = Number.isFinite(cr) && cr >= 0
      ? cr
      : await resolveDefaultCommissionPercent();
    const commissionAmount = parseFloat(booking.commission_thb) || Math.round(totalPrice * (commissionRate / 100));
    const partnerEarnings = parseFloat(booking.partner_earnings_thb) || (totalPrice - commissionAmount);
    
    console.log(`[NOTIFICATION] Booking commission: ${commissionRate}% (stored in booking record)`);

    const requestsNote = bookingSpecialRequestsSnippet(booking.special_requests, 200);
    
    const bookingData = {
      id: booking.id,
      renterName: booking.guest_name || guest?.name || 'Гость',
      renterEmail: booking.guest_email || guest?.email,
      listingTitle: listing?.title || 'Объект',
      listingDistrict: listing?.district || listing?.listing_district || null,
      listingCategorySlug: listing?.category_slug || listing?.categorySlug || null,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: this.calculateNights(booking.check_in, booking.check_out),
      totalPrice: totalPrice,
      commissionRate,
      commissionAmount,
      partnerEarnings
    };
    
    const guestEmail = booking.guest_email || guest?.email;

    await safeNotifyChannel('newBooking:guestEmail', async () => {
      if (!guestEmail) return;
      try {
        await EmailService.sendBookingRequested(bookingData, guestEmail, lang, {
          instantConfirmed: isInstantConfirmed,
        });
        console.log(`[BOOKING EMAIL] Sent to guest: ${guestEmail}`);
      } catch (error) {
        console.error('[BOOKING EMAIL ERROR]', error);
        const subj = isInstantConfirmed
          ? `✅ Бронирование подтверждено: ${listing?.title || 'Объект'}`
          : `🏠 Заявка на бронирование: ${listing?.title || 'Объект'}`;
        const lead = isInstantConfirmed
          ? `Ваше бронирование подтверждено и оплачено по правилам instant book.\n\n`
          : `Ваша заявка на бронирование получена!\n\n`;
        await this.sendEmail(
          guestEmail,
          subj,
          `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\n${lead}` +
            `📍 Объект: ${listing?.title || 'N/A'}\n📅 Даты: ${booking.check_in} — ${booking.check_out}\n` +
            `💰 Сумма: ฿${totalPrice.toLocaleString()}\n\n${ESCROW_MESSAGE.ru}`
        );
      }
    });

    await safeNotifyChannel('newBooking:partnerEmail', async () => {
      if (!partner?.email) return;
      try {
        await EmailService.sendNewLeadAlert(bookingData, partner.email, lang, {
          instantConfirmed: isInstantConfirmed,
        });
        console.log(`[LEAD ALERT EMAIL] Sent to partner: ${partner.email}`);
      } catch (error) {
        console.error('[LEAD ALERT EMAIL ERROR]', error);
        const subj = isInstantConfirmed
          ? `✅ Новое подтверждённое бронирование: ${listing?.title || 'Объект'}`
          : `🏠 Новая заявка на бронирование: ${listing?.title || 'Объект'}`;
        const lead = isInstantConfirmed
          ? `Поступило мгновенное (instant) бронирование — даты уже заблокированы.\n\n`
          : `Получена новая заявка на бронирование!\n\n`;
        const tail = isInstantConfirmed
          ? `Откройте кабинет партнёра для деталей и чата с гостем.`
          : `Перейдите в панель партнёра чтобы подтвердить или отклонить заявку.`;
        await this.sendEmail(
          partner.email,
          subj,
          `Здравствуйте, ${partner.first_name || 'Партнёр'}!\n\n${lead}` +
            `📍 Объект: ${listing?.title || 'N/A'}\n👤 Гость: ${booking.guest_name || 'N/A'}\n` +
            `📅 Даты: ${booking.check_in} — ${booking.check_out}\n\n` +
            `💰 Сумма бронирования: ฿${totalPrice.toLocaleString()}\n` +
            `📊 Комиссия сервиса: ${commissionRate}% (฿${commissionAmount.toLocaleString()})\n` +
            `💵 Ваш доход: ฿${partnerEarnings.toLocaleString()}\n\n` +
            `${requestsNote ? `💬 Сообщение от гостя: ${requestsNote}\n\n` : ''}` +
            tail
        );
      }
    });

    await safeNotifyChannel('newBooking:partnerPush', async () => {
      const pid = booking?.partner_id;
      if (!pid) return;
      const listingTitle = listing?.title || '—';
      const linkPath = `/partner/bookings?booking=${encodeURIComponent(String(booking.id))}`;
      const templateKey = isInstantConfirmed ? 'BOOKING_INSTANT_PARTNER' : 'BOOKING_REQUEST';
      await PushService.sendToUser(String(pid), templateKey, {
        listing: listingTitle,
        dates: pushDates,
        link: linkPath,
        bookingId: String(booking.id || ''),
      });
    });

    await safeNotifyChannel('newBooking:partnerTelegram', async () => {
      if (!partner?.telegram_id) return;
      await Tg.sendTelegramBookingRequest(partner.telegram_id, {
        booking,
        listing,
        totalPrice,
        commissionRate,
        commissionAmount,
        partnerEarnings
      });
    });

    await safeNotifyChannel('newBooking:adminBookingsTopic', async () => {
      await this.sendToAdminTopic(
        'BOOKINGS',
        `🏠 <b>НОВОЕ БРОНИРОВАНИЕ</b>\n\n` +
          `📍 <b>Объект:</b> ${listing?.title || 'N/A'}\n` +
          `👤 <b>Гость:</b> ${booking.guest_name || 'N/A'}\n` +
          `📧 ${booking.guest_email || ''}\n` +
          `📞 ${booking.guest_phone || ''}\n` +
          `📅 <b>Даты:</b> ${booking.check_in} → ${booking.check_out}\n` +
          `💰 <b>Сумма:</b> ${escapeTelegramHtmlText(formatBookingAmountForNotify(booking, totalPrice))}\n` +
          `📊 <b>Комиссия:</b> ${commissionRate}% (฿${commissionAmount.toLocaleString()})\n` +
          `💵 <b>Партнёру:</b> ฿${partnerEarnings.toLocaleString()}\n` +
          `${requestsNote ? `💬 <b>Сообщение:</b> ${escapeTelegramHtmlText(requestsNote)}\n` : ''}` +
          `\n🏢 <b>Партнёр:</b> ${partner?.first_name || ''} ${partner?.last_name || ''}\n` +
          `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
      );
    });
  }

  /** Делегат в `notifications/telegram.service.js` (inline + `?booking=`). */
  static async sendTelegramBookingRequest(chatId, data) {
    return Tg.sendTelegramBookingRequest(chatId, data);
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

  /** Ссылка на диалог по брони или общий inbox. */
  static async buildGuestChatUrlForBooking(bookingId) {
    if (!bookingId || !supabaseAdmin) return `${BASE_URL}/messages/`;
    try {
      const { data } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle();
      if (data?.id) return `${BASE_URL}/messages/${data.id}/`;
    } catch (e) {
      console.warn('[NOTIFICATION] buildGuestChatUrlForBooking', e?.message || e);
    }
    return `${BASE_URL}/messages/`;
  }

  static async resolveGuestEmailLang(booking, guestProfile) {
    if (guestProfile?.language) return normalizeEmailLang(guestProfile.language);
    if (booking?.renter_id && supabaseAdmin) {
      try {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('language')
          .eq('id', booking.renter_id)
          .maybeSingle();
        if (prof?.language) return normalizeEmailLang(prof.language);
      } catch (_) {
        /* ignore */
      }
    }
    return 'ru';
  }
  
  static async handleBookingConfirmed(data) {
    const { booking, listing, guest: guestField, renter } = data;
    const guest = guestField ?? renter;

    const chatUrl = await this.buildGuestChatUrlForBooking(booking.id);
    const emailLang = await this.resolveGuestEmailLang(booking, guest);
    const payHint = `Ваша бронь подтверждена. Перейдите к оплате или в чат:\n${BASE_URL}/checkout/${booking.id}/`

    const guestEmail = booking.guest_email || guest?.email;
    if (guestEmail) {
      try {
        const totalThb = parseFloat(booking.price_thb) || 0;
        const priceLine = formatBookingAmountForNotify(booking, totalThb);
        let listingImageUrl = listing?.cover_image || null;
        if (!listingImageUrl && Array.isArray(listing?.images) && listing.images.length > 0) {
          listingImageUrl = listing.images[0];
        }
        const guestDisplay =
          booking.guest_name ||
          [guest?.first_name, guest?.last_name].filter(Boolean).join(' ').trim() ||
          'Гость';
        await EmailService.sendBookingConfirmedGuest(
          {
            bookingId: booking.id,
            guestName: guestDisplay,
            listingTitle: listing?.title || 'Объект',
            listingImageUrl,
            district: listing?.district,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            priceLine,
            escrowText: escrowEmailLine(emailLang),
            checkoutUrl: `${BASE_URL}/checkout/${booking.id}/`,
            chatUrl,
            profileUrl: `${BASE_URL}/renter/profile/`,
          },
          guestEmail,
          emailLang,
        );
      } catch (err) {
        console.error('[BOOKING CONFIRMED EMAIL]', err);
        await this.sendEmail(
          guestEmail,
          `✅ Бронирование подтверждено: ${listing?.title || 'Объект'}`,
          `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\n` +
            `Ваше бронирование подтверждено!\n\n` +
            `📍 Объект: ${listing?.title || 'N/A'}\n` +
            `📅 Даты: ${booking.check_in} — ${booking.check_out}\n` +
            `💰 Сумма к оплате: ฿${booking.price_thb?.toLocaleString() || 0}\n\n` +
            `${ESCROW_MESSAGE.ru}\n\n` +
            `${payHint}\n\nС уважением,\nКоманда GoStayLo`,
        );
      }
    }

    const renterTg = guest?.telegram_id
    if (renterTg) {
      await this.sendTelegram(
        renterTg,
        `✅ <b>Ваша бронь подтверждена.</b>\n\n` +
          `📍 ${escapeTelegramHtmlText(listing?.title || 'Объект')}\n\n` +
          `${escapeTelegramHtmlText(payHint)}`,
      )
    }
    
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
      `Если у вас есть вопросы, свяжитесь с поддержкой.\n\nС уважением,\nКоманда GoStayLo`
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
      `🔗 <b>Метод:</b> ${PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.method || 'N/A'}\n` +
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

  /**
   * NEW: Handle payment TXID submission
   */
  static async handlePaymentSubmitted(data) {
    const { booking, payment, listing, partner } = data;
    
    const paymentMethodLabel = PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.payment_method || 'N/A';
    
    const thbAmount = booking?.price_thb || payment?.amount || 0;
    const thbPerUsdt = await resolveThbPerUsdt();
    const usdtAmount = Math.round((parseFloat(thbAmount) / thbPerUsdt) * 100) / 100;
    
    // Admin Topic: FINANCE (Thread 16) - Show amount in USDT
    await this.sendToAdminTopic('FINANCE',
      `💰 <b>NEW [${paymentMethodLabel}] PAYMENT!</b>\n\n` +
      `📍 <b>Объект:</b> ${listing?.title || 'N/A'}\n` +
      `👤 <b>Гость:</b> ${booking?.guest_name || 'N/A'}\n` +
      `💵 <b>Amount:</b> ${usdtAmount} USDT\n` +
      `💴 <b>THB:</b> ฿${parseFloat(thbAmount).toLocaleString()}\n` +
      `📋 <b>TXID:</b> <code>${payment?.txid || 'N/A'}</code>\n\n` +
      `🔗 <a href="https://tronscan.org/#/transaction/${payment?.txid}">Verify on TronScan</a>\n\n` +
      `⏳ <b>Статус:</b> PENDING VERIFICATION\n` +
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
    );
    
    // Notify Partner (listing owner) that payment is under verification
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `⏳ <b>Оплата на проверке</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `👤 Гость: ${booking?.guest_name || 'N/A'}\n` +
        `💵 ฿${booking?.price_thb?.toLocaleString() || 0}\n\n` +
        `<i>Платёж проходит верификацию. Уведомим когда будет подтверждён.</i>`
      );
    }
    
    // Email to partner
    if (partner?.email) {
      await this.sendEmail(
        partner.email,
        `⏳ Новый платёж на проверке: ${listing?.title || 'Объект'}`,
        `Здравствуйте!\n\n` +
        `Получен новый платёж от гостя ${booking?.guest_name || 'N/A'}.\n\n` +
        `📍 Объект: ${listing?.title || 'N/A'}\n` +
        `💵 Сумма: ฿${booking?.price_thb?.toLocaleString() || 0}\n` +
        `🔗 Метод: ${paymentMethodLabel}\n\n` +
        `Платёж проходит верификацию. Мы уведомим вас, когда он будет подтверждён.\n\n` +
        `С уважением,\nКоманда GoStayLo`
      );
    }
  }

  /**
   * NEW: Handle payment confirmation by admin
   */
  static async handlePaymentConfirmed(data) {
    const { booking, payment, listing, partner } = data;
    
    const paymentMethodLabel = PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.payment_method || 'N/A';
    
    // Admin Topic: FINANCE
    await this.sendToAdminTopic('FINANCE',
      `✅ <b>ПЛАТЁЖ ПОДТВЕРЖДЁН</b>\n\n` +
      `📝 <b>Booking:</b> ${booking?.id}\n` +
      `📍 ${listing?.title || 'N/A'}\n` +
      `👤 ${booking?.guest_name || 'N/A'}\n` +
      `💵 ฿${payment?.amount?.toLocaleString() || booking?.price_thb?.toLocaleString() || 0}\n` +
      `🔗 ${paymentMethodLabel}\n\n` +
      `✅ Средства в Эскроу`
    );
    
    // Notify Partner
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `✅ <b>Оплата подтверждена!</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `👤 Гость: ${booking?.guest_name || 'N/A'}\n` +
        `💵 ฿${payment?.amount?.toLocaleString() || 0}\n\n` +
        `${ESCROW_MESSAGE.ru}`
      );
    }
    
    // Email to guest
    if (booking?.guest_email) {
      try {
        const totalThb = parseFloat(booking?.price_thb) || parseFloat(payment?.amount) || 0;
        const amountLine = formatBookingAmountForNotify(booking, totalThb);
        let listingImageUrl = listing?.cover_image || null;
        if (!listingImageUrl && Array.isArray(listing?.images) && listing.images.length > 0) {
          listingImageUrl = listing.images[0];
        }
        const chatUrl = await this.buildGuestChatUrlForBooking(booking.id);
        const emailLang = await this.resolveGuestEmailLang(booking, null);
        await EmailService.sendPaymentSuccessGuest(
          {
            guestName: booking?.guest_name || 'Гость',
            listingTitle: listing?.title || 'Объект',
            listingImageUrl,
            district: listing?.district,
            checkIn: booking?.check_in,
            checkOut: booking?.check_out,
            amountLine,
            methodLine: paymentMethodLabel,
            escrowText: escrowEmailLine(emailLang),
            bookingsUrl: `${BASE_URL}/renter/bookings/?booking=${encodeURIComponent(String(booking.id))}`,
            chatUrl,
            profileUrl: `${BASE_URL}/renter/profile/`,
          },
          booking.guest_email,
          emailLang,
        );
      } catch (err) {
        console.error('[PAYMENT CONFIRMED EMAIL]', err);
        await this.sendEmail(
          booking.guest_email,
          `✅ Оплата подтверждена: ${listing?.title || 'Объект'}`,
          `Здравствуйте, ${booking?.guest_name || 'Гость'}!\n\n` +
            `Ваш платёж успешно подтверждён!\n\n` +
            `📍 Объект: ${listing?.title || 'N/A'}\n` +
            `📅 Даты: ${booking?.check_in} — ${booking?.check_out}\n` +
            `💵 Сумма: ฿${payment?.amount?.toLocaleString() || 0}\n\n` +
            `${ESCROW_MESSAGE.ru}\n\n` +
            `Ждём вас!\n\nС уважением,\nКоманда GoStayLo`,
        );
      }
    }
  }
  
  static async handlePaymentSuccess(data) {
    const { booking, payment, listing } = data;

    const paymentMethodLabel =
      PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.method || payment?.payment_method || 'N/A';

    if (booking?.guest_email) {
      try {
        const totalThb = parseFloat(booking?.price_thb) || parseFloat(payment?.amount) || 0;
        const amountLine = formatBookingAmountForNotify(booking, totalThb);
        let listingImageUrl = listing?.cover_image || null;
        if (!listingImageUrl && Array.isArray(listing?.images) && listing.images.length > 0) {
          listingImageUrl = listing.images[0];
        }
        const chatUrl = await this.buildGuestChatUrlForBooking(booking.id);
        const emailLang = await this.resolveGuestEmailLang(booking, null);
        await EmailService.sendPaymentSuccessGuest(
          {
            guestName: booking.guest_name || 'Гость',
            listingTitle: listing?.title || 'Объект',
            listingImageUrl,
            district: listing?.district,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amountLine,
            methodLine: paymentMethodLabel,
            escrowText: escrowEmailLine(emailLang),
            bookingsUrl: `${BASE_URL}/renter/bookings/?booking=${encodeURIComponent(String(booking.id))}`,
            chatUrl,
            profileUrl: `${BASE_URL}/renter/profile/`,
          },
          booking.guest_email,
          emailLang,
        );
      } catch (err) {
        console.error('[PAYMENT SUCCESS EMAIL]', err);
        await this.sendEmail(
          booking.guest_email,
          `💰 Оплата получена: ${listing?.title || 'Объект'}`,
          `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\n` +
            `Спасибо! Ваша оплата успешно получена.\n\n` +
            `📍 Объект: ${listing?.title || 'N/A'}\n` +
            `💵 Сумма: ฿${payment?.amount?.toLocaleString() || booking.price_thb?.toLocaleString() || 0}\n` +
            `🔗 Метод: ${paymentMethodLabel}\n` +
            `📋 Статус: Оплачено ✅\n\n` +
            `${ESCROW_MESSAGE.ru}\n\n` +
            `Ждём вас ${booking.check_in}!\n\nС уважением,\nКоманда GoStayLo`,
        );
      }
    }
    
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

    try {
      await EmailService.sendPartnerApproved(
        {
          name: partner.first_name || partner.name || 'партнёр',
          email: partner.email,
        },
        'ru',
      );
    } catch (err) {
      console.error('[PARTNER VERIFIED EMAIL]', err);
      await this.sendEmail(
        partner.email,
        '🎉 Ваша учетная запись верифицирована!',
        `Поздравляем, ${partner.first_name || 'Партнёр'}!\n\n` +
          `Ваша учетная запись партнёра была успешно верифицирована.\n\n` +
          `Теперь вы можете:\n` +
          `• Создавать объявления\n` +
          `• Принимать бронирования\n` +
          `• Получать выплаты\n\n` +
          `Удачного бизнеса!\n\nС уважением,\nКоманда GoStayLo`,
      );
    }
    
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
      `Вы можете исправить указанные проблемы и подать заявку повторно.\n\nС уважением,\nКоманда GoStayLo`
    );
  }
  
  static async handleListingApproved(data) {
    const { listing, partner } = data;
    
    if (partner?.email) {
      await this.sendEmail(
        partner.email,
        `✅ Объявление одобрено: ${listing?.title}`,
        `Поздравляем!\n\nВаше объявление "${listing?.title}" было одобрено и опубликовано.\n\n` +
        `Теперь оно доступно для бронирования.\n\nС уважением,\nКоманда GoStayLo`
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
        `Вы можете исправить указанные проблемы и подать объявление повторно.\n\nС уважением,\nКоманда GoStayLo`
      );
    }
    
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `❌ <b>Объявление отклонено</b>\n\n📍 ${listing?.title}\n\n📝 Причина: ${reason || 'Не указана'}`
      );
    }
  }
  
  static async handlePayoutProcessed(data) {
    const { payout, partner, booking, listing } = data;
    
    // Use commission rate from payout data (which comes from booking.commission_rate)
    // This was locked at booking creation time by PricingService
    const pr = parseFloat(payout?.commissionRate);
    const br = parseFloat(booking?.commission_rate);
    const commissionRate = Number.isFinite(pr) && pr >= 0
      ? pr
      : Number.isFinite(br) && br >= 0
        ? br
        : await resolveDefaultCommissionPercent();
    
    console.log(`[NOTIFICATION] Payout commission: ${commissionRate}% (from booking record)`);
    
    // Email to partner with commission details
    await this.sendEmail(
      partner.email,
      '💰 Выплата успешно отправлена!',
      `Выплата обработана!\n\n` +
      `📍 Объект: ${listing?.title || 'N/A'}\n` +
      `💵 Сумма к выплате: ฿${payout?.amount?.toLocaleString() || 0}\n` +
      `💳 Полная сумма: ฿${payout?.total?.toLocaleString() || 0}\n` +
      `📊 Комиссия: ฿${payout?.commission?.toLocaleString() || 0} (${commissionRate}% - зафиксировано при бронировании)\n\n` +
      `Средства поступят в течение 1-3 рабочих дней.\n\nС уважением,\nКоманда GoStayLo`
    );
    
    // Telegram to partner with commission info
    if (partner?.telegram_id) {
      await this.sendTelegram(partner.telegram_id,
        `💰 <b>Выплата отправлена!</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `💵 К выплате: ฿${payout?.amount?.toLocaleString() || 0}\n` +
        `📊 Комиссия: ${commissionRate}% (฿${payout?.commission?.toLocaleString() || 0})\n` +
        `<i>(зафиксировано при бронировании)</i>`
      );
    }
    
    // Admin Topic: FINANCE (Thread 16) - Payout notification with commission
    await this.sendToAdminTopic('FINANCE',
      `💰 <b>ВЫПЛАТА ПАРТНЁРУ</b>\n\n` +
      `👤 ${partner?.first_name || partner?.name || ''} ${partner?.last_name || ''}\n` +
      `📍 ${listing?.title || 'N/A'}\n` +
      `💵 <b>К выплате:</b> ฿${payout?.amount?.toLocaleString() || 0}\n` +
      `💳 <b>Полная сумма:</b> ฿${payout?.total?.toLocaleString() || 0}\n` +
      `📊 <b>Комиссия:</b> ${commissionRate}% (฿${payout?.commission?.toLocaleString() || 0})\n` +
      `<i>Комиссия зафиксирована при бронировании</i>\n\n` +
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
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
      `Обратитесь в поддержку для уточнения деталей.\n\nС уважением,\nКоманда GoStayLo`
    );
  }
  
  static async handleNewMessage(data) {
    const { message, recipient, sender, listing, conversation } = data;
    
    // Send to dedicated MESSAGES topic in Telegram
    await this.sendToAdminTopic('MESSAGES',
      `💬 <b>New message</b>\n\n` +
      `👤 <b>From:</b> ${sender?.name || message?.sender_name || 'User'}\n` +
      `📍 <b>Regarding:</b> ${listing?.title || conversation?.listing_title || 'Listing'}\n` +
      `💬 <i>"${message?.message?.substring(0, 100)}${message?.message?.length > 100 ? '...' : ''}"</i>\n\n` +
      `📱 Reply on site`
    );
    
    // Email to recipient
    if (recipient?.email) {
      const chatPath = conversation?.id
        ? `/messages/${encodeURIComponent(conversation.id)}`
        : '/messages';
      const openChatUrl = `${BASE_URL}${chatPath}`;
      await this.sendEmail(
        recipient.email,
        `💬 Новое сообщение в чате: ${listing?.title || 'GoStayLo'}`,
        `У вас новое сообщение от ${sender?.name || message?.sender_name || 'пользователя'}:\n\n` +
        `📍 Объект: ${listing?.title || 'N/A'}\n\n` +
        `"${message?.message?.substring(0, 200)}${message?.message?.length > 200 ? '...' : ''}"\n\n` +
        `Открыть чат: ${openChatUrl}\n\n` +
        `Ответьте в личном кабинете.\n\nС уважением,\nКоманда GoStayLo`
      );
    }
    
    // Telegram to recipient if they have telegram_id
    if (recipient?.telegram_id) {
      await this.sendTelegram(recipient.telegram_id,
        `💬 <b>Новое сообщение</b>\n\n` +
        `👤 От: ${sender?.name || message?.sender_name || 'Пользователь'}\n` +
        `📍 ${listing?.title || 'Объект'}\n\n` +
        `<i>"${message?.message?.substring(0, 100)}..."</i>\n\n` +
        `📱 Ответьте на сайте`
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
        `Средства из Эскроу переведены на ваш баланс.\n\nС уважением,\nКоманда GoStayLo`
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

  // Stage 32 - Escrow Thaw Preview (admin notification about tomorrow's payouts)
  static async handleEscrowThawPreview(data) {
    const { bookings, thawDate } = data;
    
    if (!bookings || bookings.length === 0) return;
    
    const bookingsList = bookings
      .map((b) => {
        const amount = Number(b.partner_earnings_thb ?? b.amount ?? 0)
        return `• ${b.listing?.title || 'N/A'}: ฿${amount.toLocaleString()}`
      })
      .join('\n');
    
    await this.sendToAdminTopic('FINANCE',
      `🔔 <b>ESCROW PREVIEW</b>\n\n` +
      `📅 Дата разморозки: ${thawDate} 18:00\n` +
      `📊 Бронирований: ${bookings.length}\n\n` +
      `${bookingsList}\n\n` +
      `<i>Эти средства будут выплачены партнёрам завтра (правило 24ч)</i>`
    );
  }

  // Stage 32 - Payout Batch Completed (after cron processes payouts)
  static async handlePayoutBatchCompleted(data) {
    const { count, total, results } = data;
    
    const successList = results
      .filter(r => r.success)
      .map(r => `✅ ${r.listingTitle}: ฿${r.amount?.toLocaleString() || 0}`)
      .join('\n');
    
    const failedList = results
      .filter(r => !r.success)
      .map(r => `❌ ${r.bookingId}: ${r.error}`)
      .join('\n');
    
    await this.sendToAdminTopic('FINANCE',
      `💰 <b>BATCH PAYOUT COMPLETED</b>\n\n` +
      `✅ Успешно: ${count}/${total}\n\n` +
      `${successList}\n` +
      `${failedList ? `\n<b>Ошибки:</b>\n${failedList}` : ''}\n\n` +
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
    );
  }

  /** THAWED: push + email о net из read-model → /partner/finances (Stage 47.0). */
  static async handlePartnerFundsThawedAvailable(data) {
    const { booking, listing, partner } = data || {}
    if (!booking?.partner_id || !booking?.id) return

    const fin = await readBookingFinancialSnapshot(booking.id)
    const netThb =
      fin.success && fin.data?.partnerPayoutThb != null
        ? Math.round(Number(fin.data.partnerPayoutThb))
        : Math.round(Number(booking.partner_earnings_thb ?? 0))
    const amountStr = String(Number.isFinite(netThb) ? netThb : 0)
    const listingTitle = listing?.title || '—'
    const emailLang = normalizeEmailLang(partner?.language || 'ru')

    await safeNotifyChannel('fundsThawed:partnerPush', async () => {
      await PushService.sendToUser(String(booking.partner_id), 'FUNDS_THAWED_PARTNER', {
        amount: amountStr,
        listing: listingTitle,
        link: '/partner/finances',
        bookingId: String(booking.id),
      })
    })

    await safeNotifyChannel('fundsThawed:partnerEmail', async () => {
      const to = partner?.email
      if (!to) return
      try {
        await EmailService.sendPartnerFundsThawedEmail(
          { amountThb: amountStr, listingTitle, bookingId: String(booking.id) },
          to,
          emailLang,
        )
      } catch (e) {
        console.error('[PARTNER_FUNDS_THAWED] email', e)
      }
    })
  }

  /** Сразу после разморозки (THAWED): Telegram + push партнёру — оценить гостя */
  static async handlePartnerGuestReviewInvite(data) {
    const { booking, listing, partner, renter, categorySlug } = data || {};
    if (!booking?.partner_id) return;

    let slug = categorySlug;
    if (!slug && listing?.category_id) {
      slug = await resolveListingCategorySlug(listing.category_id);
    }
    const partnerLang = String(partner?.language || 'ru').toLowerCase().startsWith('en')
      ? 'en'
      : 'ru';
    const copy = getPartnerGuestReviewPromptCopy(slug, partnerLang);

    const guestLabel =
      booking.guest_name ||
      [renter?.first_name, renter?.last_name].filter(Boolean).join(' ').trim() ||
      (partnerLang === 'en' ? 'Guest' : 'Гость');

    const partnerTg = partner?.telegram_id;
    const guestReviewPath = booking?.id
      ? `/partner/bookings/${encodeURIComponent(String(booking.id))}/guest-review`
      : '/partner/bookings';
    if (partnerTg) {
      const cta =
        partnerLang === 'en'
          ? `<a href="${BASE_URL}${guestReviewPath}">Rate your guest</a>`
          : `<a href="${BASE_URL}${guestReviewPath}">Оценить гостя</a>`;
      await this.sendTelegram(
        partnerTg,
        `⭐ <b>${copy.title}</b>\n\n` +
          `📍 ${escapeTelegramHtmlText(listing?.title || 'Объект')}\n` +
          `👤 ${escapeTelegramHtmlText(guestLabel)}\n\n` +
          `${copy.lead}\n\n` +
          `📱 ${cta}`,
      );
    }

    try {
      await PushService.sendToUser(booking.partner_id, 'PARTNER_GUEST_REVIEW', {
        listing: listing?.title || '—',
        guest: guestLabel,
        link: guestReviewPath,
      });
    } catch (e) {
      console.error('[PARTNER_GUEST_REVIEW_INVITE] push', e);
    }
  }

  /** После окончания поездости — напоминание об отзыве (cron review-reminder) */
  static async handleReviewReminder(data) {
    const { booking, listing } = data;
    const guestTelegram = booking?.renter?.telegram_id;
    const bid = booking?.id ? encodeURIComponent(String(booking.id)) : '';
    const bookingsDeep = bid ? `${BASE_URL}/renter/bookings?booking=${bid}` : `${BASE_URL}/renter/bookings`;
    if (guestTelegram) {
      let slug = listing?.category_slug || null;
      if (!slug && listing?.category_id) {
        slug = await resolveListingCategorySlug(listing.category_id);
      }
      const copy = getReviewReminderTelegramCopy(slug, 'ru');
      await this.sendTelegram(
        guestTelegram,
        `⭐ <b>Оставьте отзыв</b>\n\n` +
          `📍 ${listing?.title || 'Объект'}\n` +
          `${copy.lead} Это помогает другим гостям.\n\n` +
          `📱 <a href="${bookingsDeep}">Мои бронирования</a>`,
      );
    }
  }

  // Stage 32 - Check-in Reminder (14:00 on check-in day; FCM: cron → PushService.sendCheckInReminder)
  static async handleCheckInReminder(data) {
    const { booking, listing } = data;
    
    const guestTelegram = booking?.renter?.telegram_id;
    const bid = booking?.id ? encodeURIComponent(String(booking.id)) : '';
    const bookingsDeep = bid ? `${BASE_URL}/renter/bookings?booking=${bid}` : `${BASE_URL}/renter/bookings`;
    if (guestTelegram) {
      await safeNotifyChannel('checkinReminder:guestTg', async () => {
        let slug = listing?.category_slug || null;
        if (!slug && listing?.category_id) {
          slug = await resolveListingCategorySlug(listing.category_id);
        }
        const copy = getCheckInReminderTelegramCopy(slug, 'ru');
        await this.sendTelegram(
          guestTelegram,
          `🔑 <b>${copy.title}</b>\n\n` +
            `📍 ${listing?.title || 'Объект'}\n` +
            `📅 ${copy.lead}\n\n` +
            `${copy.action}\n\n` +
            `📱 <a href="${bookingsDeep}">Мои бронирования</a>`,
        );
      });
    }

    await safeNotifyChannel('checkinReminder:adminFinTopic', async () => {
      await this.sendToAdminTopic(
        'FINANCE',
        `🔑 <b>CHECK-IN REMINDER SENT</b>\n\n` +
          `👤 ${booking?.guest_name || 'Guest'}\n` +
          `📍 ${listing?.title || 'N/A'}\n` +
          `📅 Check-in: Today\n\n` +
          `<i>Push + TG reminder sent at 14:00</i>`,
      );
    });
  }

  /**
   * Точечная отправка дайджеста (можно вызвать через dispatch с data от cron).
   * Обычно используйте runDailyDraftDigestReminders().
   */
  static async handleDraftDigestReminder(data) {
    const { telegramId, draftCount, lang } = data || {};
    return this.sendPartnerDraftDigestReminder({
      telegramId,
      draftCount,
      lang: lang || 'ru',
    });
  }

  /**
   * Напоминание в личку партнёру: есть незавершённые черновики + кнопка в кабинет.
   */
  static async sendPartnerDraftDigestReminder({ telegramId, draftCount, lang = 'ru' }) {
    if (telegramId == null || telegramId === '' || draftCount < 1) {
      return { success: false, reason: 'skip' };
    }
    if (supabaseAdmin) {
      const { data: prof, error: roleErr } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('telegram_id', String(telegramId))
        .maybeSingle();
      if (roleErr) {
        console.error('[DRAFT DIGEST] profile by telegram_id:', roleErr);
        return { success: false, reason: 'profile_error' };
      }
      const role = String(prof?.role || '').toUpperCase();
      if (!['PARTNER', 'ADMIN'].includes(role)) {
        return { success: false, reason: 'not_partner' };
      }
    }
    const uiLang = lang === 'en' ? 'en' : 'ru';
    const draftsUrl = buildLocalizedSiteUrl(uiLang, '/partner/listings?filter=draft');
    const n = Number(draftCount);
    const text =
      lang === 'en'
        ? `📝 <b>Unfinished drafts</b>\n\n` +
          `You have <b>${n}</b> unfinished draft listing${n === 1 ? '' : 's'}. ` +
          `Complete them in your dashboard to start receiving bookings.`
        : `📝 <b>Незавершённые черновики</b>\n\n` +
          `У вас есть незавершённые черновики (<b>${n}</b> шт.). ` +
          `Завершите их в личном кабинете, чтобы начать получать бронирования.`;
    const btn = lang === 'en' ? '📋 Open drafts' : '📋 Открыть черновики';
    const partnerMenu = buildMainMenuReplyMarkup(uiLang, 'partner');
    const reply_markup = {
      inline_keyboard: [
        [{ text: btn, url: draftsUrl }],
        ...partnerMenu.inline_keyboard,
      ],
    };
    return Tg.sendTelegramMessagePayload({
      chat_id: telegramId,
      text,
      reply_markup,
    });
  }

  /**
   * Cron: раз в сутки — только PARTNER/ADMIN с telegram_id и хотя бы одним черновиком.
   * Черновик = как в боте /my: INACTIVE + (metadata.is_draft или source TELEGRAM_LAZY_REALTOR).
   */
  static async runDailyDraftDigestReminders() {
    if (!supabaseAdmin) {
      console.warn('[DRAFT DIGEST] supabaseAdmin not configured');
      return { sent: 0, partnersWithDrafts: 0, error: 'no_db' };
    }
    const { data: rows, error } = await supabaseAdmin
      .from('listings')
      .select('owner_id, metadata')
      .eq('status', 'INACTIVE');
    if (error) {
      console.error('[DRAFT DIGEST] listings query:', error);
      throw error;
    }
    const isDraftRow = (l) =>
      l.metadata?.is_draft === true ||
      l.metadata?.is_draft === 'true' ||
      l.metadata?.source === 'TELEGRAM_LAZY_REALTOR';
    const byOwner = new Map();
    for (const r of rows || []) {
      if (!r.owner_id || !isDraftRow(r)) continue;
      byOwner.set(r.owner_id, (byOwner.get(r.owner_id) || 0) + 1);
    }
    const ownerIds = [...byOwner.keys()];
    if (ownerIds.length === 0) {
      return { sent: 0, partnersWithDrafts: 0 };
    }
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, telegram_id, language, role')
      .in('id', ownerIds);
    if (pErr) {
      console.error('[DRAFT DIGEST] profiles batch:', pErr);
      throw pErr;
    }
    const partnerProfiles = (profiles || []).filter((p) =>
      ['PARTNER', 'ADMIN'].includes(String(p.role || '').toUpperCase())
    );
    const partnersWithDrafts = partnerProfiles.filter((p) => (byOwner.get(p.id) || 0) >= 1).length;
    let sent = 0;
    for (const profile of partnerProfiles) {
      const draftCount = byOwner.get(profile.id) || 0;
      if (draftCount < 1 || !profile.telegram_id) continue;
      const lang = String(profile.language || 'ru').toLowerCase().startsWith('en') ? 'en' : 'ru';
      const r = await this.sendPartnerDraftDigestReminder({
        telegramId: profile.telegram_id,
        draftCount,
        lang,
      });
      if (r?.success) sent += 1;
    }
    return { sent, partnersWithDrafts };
  }
}

export default NotificationService;
