/**
 * Stage 54.0 — booking & messaging cluster (notifications).
 */
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { EmailService } from '@/lib/services/email.service.js'
import { PushService } from '@/lib/services/notifications/push.service.js'
import * as Tg from '@/lib/services/notifications/telegram.service.js'
import {
  bookingSpecialRequestsSnippet,
  escapeTelegramHtmlText,
  formatBookingAmountForNotify,
} from '@/lib/services/notifications/formatting.js'
import { normalizeEmailLang, escrowEmailLine } from '@/lib/email/booking-email-i18n'
import {
  getCheckInReminderTelegramCopy,
  getReviewReminderTelegramCopy,
  getPartnerGuestReviewPromptCopy,
} from '@/lib/notification-category-terminology.js'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'
import { safeNotifyChannel, escrowCheckInSecurityMessageRu } from '@/lib/services/notifications/notify-shared.js'

const BASE_URL = getPublicSiteUrl()


export async function handleNewBookingRequest(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

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
      nights: calculateNights(booking.check_in, booking.check_out),
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
        await sendEmail(
          guestEmail,
          subj,
          `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\n${lead}` +
            `📍 Объект: ${listing?.title || 'N/A'}\n📅 Даты: ${booking.check_in} — ${booking.check_out}\n` +
            `💰 Сумма: ฿${totalPrice.toLocaleString()}\n\n${escrowCheckInSecurityMessageRu()}`
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
        await sendEmail(
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
      await sendToAdminTopic(
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

export async function handleBookingConfirmed(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, listing, guest: guestField, renter } = data;
    const guest = guestField ?? renter;

    const chatUrl = await buildGuestChatUrlForBooking(booking.id);
    const emailLang = await resolveGuestEmailLang(booking, guest);
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
        await sendEmail(
          guestEmail,
          `✅ Бронирование подтверждено: ${listing?.title || 'Объект'}`,
          `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\n` +
            `Ваше бронирование подтверждено!\n\n` +
            `📍 Объект: ${listing?.title || 'N/A'}\n` +
            `📅 Даты: ${booking.check_in} — ${booking.check_out}\n` +
            `💰 Сумма к оплате: ฿${booking.price_thb?.toLocaleString() || 0}\n\n` +
            `${escrowCheckInSecurityMessageRu()}\n\n` +
            `${payHint}\n\nС уважением,\nКоманда ${getSiteDisplayName()}`,
        );
      }
    }

    const renterTg = guest?.telegram_id
    if (renterTg) {
      await sendTelegram(
        renterTg,
        `✅ <b>Ваша бронь подтверждена.</b>\n\n` +
          `📍 ${escapeTelegramHtmlText(listing?.title || 'Объект')}\n\n` +
          `${escapeTelegramHtmlText(payHint)}`,
      )
    }
    
    // Admin Topic
    await sendToAdminTopic('BOOKINGS',
      `✅ <b>БРОНИРОВАНИЕ ПОДТВЕРЖДЕНО</b>\n\n` +
      `📝 <b>ID:</b> ${booking.id}\n` +
      `📍 ${listing?.title || 'N/A'}\n` +
      `👤 ${booking.guest_name || 'N/A'}\n` +
      `📅 ${booking.check_in} → ${booking.check_out}\n` +
      `💰 ฿${booking.price_thb?.toLocaleString() || 0}`
    );
  }

export async function handleBookingCancelled(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, listing, guest, reason } = data;
    
    await sendEmail(
      booking.guest_email || guest?.email,
      `❌ Бронирование отменено: ${listing?.title || 'Объект'}`,
      `К сожалению, ваше бронирование было отменено.\n\n` +
      `📍 Объект: ${listing?.title || 'N/A'}\n` +
      `📅 Даты: ${booking.check_in} — ${booking.check_out}\n` +
      `Причина: ${reason || 'Не указана'}\n\n` +
      `Если у вас есть вопросы, свяжитесь с поддержкой.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
    );
  }

export async function handleNewMessage(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { message, recipient, sender, listing, conversation } = data;
    
    // Send to dedicated MESSAGES topic in Telegram
    await sendToAdminTopic('MESSAGES',
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
      await sendEmail(
        recipient.email,
        `💬 Новое сообщение в чате: ${listing?.title || getSiteDisplayName()}`,
        `У вас новое сообщение от ${sender?.name || message?.sender_name || 'пользователя'}:\n\n` +
        `📍 Объект: ${listing?.title || 'N/A'}\n\n` +
        `"${message?.message?.substring(0, 200)}${message?.message?.length > 200 ? '...' : ''}"\n\n` +
        `Открыть чат: ${openChatUrl}\n\n` +
        `Ответьте в личном кабинете.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
      );
    }
    
    // Telegram to recipient if they have telegram_id
    if (recipient?.telegram_id) {
      await sendTelegram(recipient.telegram_id,
        `💬 <b>Новое сообщение</b>\n\n` +
        `👤 От: ${sender?.name || message?.sender_name || 'Пользователь'}\n` +
        `📍 ${listing?.title || 'Объект'}\n\n` +
        `<i>"${message?.message?.substring(0, 100)}..."</i>\n\n` +
        `📱 Ответьте на сайте`
      );
    }
  }

export async function handleCheckInConfirmed(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, listing, partner } = data;
    
    // Notify Partner about funds release
    if (partner?.email) {
      await sendEmail(
        partner.email,
        `✅ Заселение подтверждено: ${listing?.title}`,
        `Гость заселился!\n\n` +
        `📍 Объект: ${listing?.title}\n` +
        `📅 ${booking.check_in} — ${booking.check_out}\n` +
        `💰 Сумма: ฿${booking.price_thb?.toLocaleString()}\n\n` +
        `Средства из Эскроу переведены на ваш баланс.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
      );
    }
    
    if (partner?.telegram_id) {
      await sendTelegram(partner.telegram_id,
        `✅ <b>Заселение подтверждено!</b>\n\n` +
        `📍 ${listing?.title}\n` +
        `💰 ฿${booking.price_thb?.toLocaleString()}\n\n` +
        `💸 Средства переведены на ваш баланс`
      );
    }
    
    await sendToAdminTopic('FINANCE',
      `✅ <b>ЗАСЕЛЕНИЕ ПОДТВЕРЖДЕНО</b>\n\n` +
      `📝 ${booking?.id}\n` +
      `📍 ${listing?.title}\n` +
      `💰 ฿${booking.price_thb?.toLocaleString()}\n\n` +
      `💸 Эскроу → Партнёр`
    );
  }

  /** После завершения аренды (check_out прошёл): Telegram + push — отзыв о клиенте (cron Stage 47.2). */export async function handlePartnerGuestReviewInvite(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, listing, partner, renter, categorySlug } = data || {};
    if (!booking?.partner_id) return;

    let slug = categorySlug;
    if (!slug && listing?.category_id) {
      slug = await resolveListingCategorySlug(listing.category_id);
    }
    const rawLang = String(partner?.language || 'ru').toLowerCase();
    const partnerCopyLang = rawLang.startsWith('en')
      ? 'en'
      : rawLang.startsWith('zh')
        ? 'zh'
        : rawLang.startsWith('th')
          ? 'th'
          : 'ru';
    const copy = getPartnerGuestReviewPromptCopy(slug, partnerCopyLang);

    const clientLabel =
      booking.guest_name ||
      [renter?.first_name, renter?.last_name].filter(Boolean).join(' ').trim() ||
      (partnerCopyLang === 'en'
        ? 'Client'
        : partnerCopyLang === 'zh'
          ? '客户'
          : partnerCopyLang === 'th'
            ? 'ลูกค้า'
            : 'Клиент');

    const partnerTg = partner?.telegram_id;
    const guestReviewPath = booking?.id
      ? `/partner/bookings/${encodeURIComponent(String(booking.id))}/guest-review`
      : '/partner/bookings';
    const ctaLabel =
      partnerCopyLang === 'en'
        ? 'Rate your client'
        : partnerCopyLang === 'zh'
          ? '评价客户'
          : partnerCopyLang === 'th'
            ? 'ให้คะแนนลูกค้า'
            : 'Оценить клиента';
    if (partnerTg) {
      const cta = `<a href="${BASE_URL}${guestReviewPath}">${ctaLabel}</a>`;
      await sendTelegram(
        partnerTg,
        `⭐ <b>${copy.title}</b>\n\n` +
          `📍 ${escapeTelegramHtmlText(listing?.title || 'Объект')}\n` +
          `👤 ${escapeTelegramHtmlText(clientLabel)}\n\n` +
          `${copy.lead}\n\n` +
          `📱 ${cta}`,
      );
    }

    try {
      await PushService.sendToUser(booking.partner_id, 'PARTNER_GUEST_REVIEW', {
        listing: listing?.title || '—',
        client: clientLabel,
        link: guestReviewPath,
        bookingId: String(booking.id),
      })
    } catch (e) {
      console.error('[PARTNER_GUEST_REVIEW_INVITE] push', e);
    }
  }

export async function handleReviewReminder(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

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
      await sendTelegram(
        guestTelegram,
        `⭐ <b>Оставьте отзыв</b>\n\n` +
          `📍 ${listing?.title || 'Объект'}\n` +
          `${copy.lead} Это помогает другим гостям.\n\n` +
          `📱 <a href="${bookingsDeep}">Мои бронирования</a>`,
      );
    }
  }

export async function handleCheckInReminder(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

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
        await sendTelegram(
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
      await sendToAdminTopic(
        'FINANCE',
        `🔑 <b>CHECK-IN REMINDER SENT</b>\n\n` +
          `👤 ${booking?.guest_name || 'Guest'}\n` +
          `📍 ${listing?.title || 'N/A'}\n` +
          `📅 Check-in: Today\n\n` +
          `<i>Push + TG reminder sent at 14:00</i>`,
      );
    });
  }
