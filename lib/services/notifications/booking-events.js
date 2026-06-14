/**
 * Stage 54.0 — booking & messaging cluster (notifications).
 */
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import { getUIText } from '@/lib/translations'
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
import { renterBookingsListPath, partnerBookingsListPath } from '@/lib/email/booking-routes.js'
import {
  getCheckInReminderTelegramCopy,
  getReviewReminderTelegramCopy,
  getPartnerGuestReviewPromptCopy,
} from '@/lib/notification-category-terminology.js'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'
import { safeNotifyChannel } from '@/lib/services/notifications/notify-shared.js'
import { deliverPremiumEmailWithPlainFallback } from '@/lib/services/notifications/notify-email-delivery.js'
import {
  buildGuestBookingConfirmedFallback,
  buildGuestBookingRequestFallback,
  buildPartnerNewLeadFallback,
  emailFallbackSignoff,
  notifyEmailFallbackCopy,
  emailFallbackEscrowLine,
} from '@/lib/services/notifications/notify-email-fallback-copy.js'
import { resolveUserLocale } from '@/lib/i18n/locale-resolver.js'
import { resolveGuestNotifyLocale, resolveNotifyLocaleFromProfile } from '@/lib/i18n/resolve-notify-locale.js'
import {
  notifyTelegramCopy,
  escrowCheckInSecurityMessage,
} from '@/lib/services/notifications/notify-telegram-copy.js'
import { DISPUTE_SLA_HOURS } from '@/lib/config/dispute-sla'

const BASE_URL = getPublicSiteUrl()

function pickLang(profile) {
  return resolveUserLocale(profile)
}

function tx(key, lang = 'ru', params = {}) {
  let out = getUIText(key, lang)
  for (const [k, v] of Object.entries(params || {})) {
    out = String(out).replaceAll(`{${k}}`, String(v ?? ''))
  }
  return out
}


export async function handleNewBookingRequest(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, partner, listing, guest, lang: dispatchLang } = data;
    const guestLang = await resolveGuestNotifyLocale(booking, guest)
    const partnerLang = resolveUserLocale(partner)
    const lang = dispatchLang || guestLang
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
      await deliverPremiumEmailWithPlainFallback({
        channelLabel: 'newBooking:guestEmail',
        to: guestEmail,
        premiumFn: () =>
          EmailService.sendBookingRequested(bookingData, guestEmail, guestLang, {
            instantConfirmed: isInstantConfirmed,
          }),
        sendPlainEmail: sendEmail,
        buildFallback: () =>
          buildGuestBookingRequestFallback(guestLang, {
            instant: isInstantConfirmed,
            guestName: booking.guest_name,
            listing: listing?.title,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amount: totalPrice.toLocaleString(),
          }),
      });
    });

    await safeNotifyChannel('newBooking:partnerEmail', async () => {
      if (!partner?.email) return;
      await deliverPremiumEmailWithPlainFallback({
        channelLabel: 'newBooking:partnerEmail',
        to: partner.email,
        premiumFn: () =>
          EmailService.sendNewLeadAlert(bookingData, partner.email, partnerLang, {
            instantConfirmed: isInstantConfirmed,
          }),
        sendPlainEmail: sendEmail,
        buildFallback: () =>
          buildPartnerNewLeadFallback(partnerLang, {
            instant: isInstantConfirmed,
            partnerName: partner.first_name,
            listing: listing?.title,
            guestName: booking.guest_name,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            totalAmount: totalPrice.toLocaleString(),
            commissionRate,
            commissionAmount: commissionAmount.toLocaleString(),
            partnerEarnings: partnerEarnings.toLocaleString(),
            requestsNote,
          }),
      });
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
        partnerEarnings,
        lang: partnerLang,
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
    const guestLang = await resolveGuestNotifyLocale(booking, guest);
    const checkoutUrl = `${BASE_URL}/checkout/${booking.id}/`;
    const payHint = notifyTelegramCopy('notifyTg_bookingConfirmedPayHint', guestLang, { checkoutUrl });

    const guestEmail = booking.guest_email || guest?.email;
    await safeNotifyChannel('bookingConfirmed:guestEmail', async () => {
      if (!guestEmail) return;
      const totalThb = parseFloat(booking.price_thb) || 0;
      const priceLine = formatBookingAmountForNotify(booking, totalThb);
      let listingImageUrl = listing?.cover_image || null;
      if (!listingImageUrl && Array.isArray(listing?.images) && listing.images.length > 0) {
        listingImageUrl = listing.images[0];
      }
      const guestDisplay =
        booking.guest_name ||
        [guest?.first_name, guest?.last_name].filter(Boolean).join(' ').trim() ||
        notifyEmailFallbackCopy('emailFb_fallbackGuest', guestLang);
      await deliverPremiumEmailWithPlainFallback({
        channelLabel: 'bookingConfirmed:guestEmail',
        to: guestEmail,
        premiumFn: () =>
          EmailService.sendBookingConfirmedGuest(
            {
              bookingId: booking.id,
              guestName: guestDisplay,
              listingTitle: listing?.title || notifyEmailFallbackCopy('emailFb_fallbackListing', guestLang),
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
          ),
        sendPlainEmail: sendEmail,
        buildFallback: () =>
          buildGuestBookingConfirmedFallback(guestLang, {
            guestName: guestDisplay,
            listing: listing?.title,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amount: booking.price_thb?.toLocaleString() || '0',
            payHint,
          }),
      });
    });

    const renterTg = guest?.telegram_id
    if (renterTg) {
      const listingTitle = listing?.title || notifyTelegramCopy('notifyTg_listingFallback', guestLang);
      await sendTelegram(
        renterTg,
        `${notifyTelegramCopy('notifyTg_bookingConfirmedTitle', guestLang)}\n\n` +
          `📍 ${escapeTelegramHtmlText(listingTitle)}\n\n` +
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
    const guestLang = await resolveGuestNotifyLocale(booking, guest);
    const listingTitle = listing?.title || notifyTelegramCopy('notifyTg_listingFallback', guestLang);
    const reasonText = reason || notifyTelegramCopy('notifyTg_reasonUnknown', guestLang);
    
    await safeNotifyChannel('bookingCancelled:guestEmail', async () => {
      const to = booking.guest_email || guest?.email;
      if (!to) return;
      const listingTitle =
        listing?.title || notifyEmailFallbackCopy('emailFb_fallbackListing', guestLang);
      await sendEmail(
        to,
        notifyEmailFallbackCopy('emailFb_guestCancelledSubj', guestLang, { listing: listingTitle }),
        [
          notifyEmailFallbackCopy('emailFb_guestCancelledLead', guestLang),
          '',
          notifyEmailFallbackCopy('emailFb_listingLine', guestLang, { listing: listing?.title || 'N/A' }),
          notifyEmailFallbackCopy('emailFb_datesLine', guestLang, {
            checkIn: booking.check_in,
            checkOut: booking.check_out,
          }),
          notifyEmailFallbackCopy('emailFb_reasonLine', guestLang, { reason: reasonText }),
          '',
          notifyEmailFallbackCopy('emailFb_supportHint', guestLang),
          '',
          emailFallbackSignoff(guestLang),
        ].join('\n'),
      );
    });

    const guestTg = guest?.telegram_id;
    if (guestTg) {
      await sendTelegram(
        guestTg,
        `${notifyTelegramCopy('notifyTg_bookingCancelledTitle', guestLang)}\n\n` +
          `${notifyTelegramCopy('notifyTg_bookingCancelledBody', guestLang)}\n\n` +
          `📍 ${escapeTelegramHtmlText(listingTitle)}\n` +
          `📅 ${escapeTelegramHtmlText(String(booking.check_in || ''))} — ${escapeTelegramHtmlText(String(booking.check_out || ''))}\n` +
          `${notifyTelegramCopy('notifyTg_bookingCancelledReason', guestLang, { reason: reasonText })}`,
      );
    }
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
    const partnerLang = resolveNotifyLocaleFromProfile(partner);
    
    await safeNotifyChannel('checkInConfirmed:partnerEmail', async () => {
      if (!partner?.email) return;
      const listingTitle =
        listing?.title || notifyEmailFallbackCopy('emailFb_fallbackListing', partnerLang);
      await sendEmail(
        partner.email,
        notifyEmailFallbackCopy('emailFb_partnerCheckInSubj', partnerLang, { listing: listingTitle }),
        [
          notifyEmailFallbackCopy('emailFb_partnerCheckInLead', partnerLang),
          '',
          notifyEmailFallbackCopy('emailFb_listingLine', partnerLang, { listing: listingTitle }),
          notifyEmailFallbackCopy('emailFb_datesLine', partnerLang, {
            checkIn: booking.check_in,
            checkOut: booking.check_out,
          }),
          notifyEmailFallbackCopy('emailFb_amountLine', partnerLang, {
            amount: booking.price_thb?.toLocaleString() || '0',
          }),
          '',
          notifyEmailFallbackCopy('emailFb_partnerCheckInFunds', partnerLang),
          '',
          emailFallbackSignoff(partnerLang),
        ].join('\n'),
      );
    });
    
    if (partner?.telegram_id) {
      await sendTelegram(partner.telegram_id,
        `${notifyTelegramCopy('notifyTg_checkInConfirmedTitle', partnerLang)}\n\n` +
        `📍 ${escapeTelegramHtmlText(listing?.title || notifyTelegramCopy('notifyTg_listingFallback', partnerLang))}\n` +
        `💰 ฿${booking.price_thb?.toLocaleString()}\n\n` +
        `${notifyTelegramCopy('notifyTg_checkInConfirmedFunds', partnerLang)}`
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

  /** После завершения аренды (check_out прошёл): Telegram + push — отзыв о клиенте (cron Stage 47.2). */
export async function handlePartnerGuestReviewInvite(data) {
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
  const { sendTelegram } = getNotifyDeps()

    const { booking, listing } = data;
    const guestTelegram = booking?.renter?.telegram_id;
    const bookingsDeep = `${BASE_URL}${renterBookingsListPath(booking?.id)}`;
    if (guestTelegram) {
      const guestLang = await resolveGuestNotifyLocale(booking, booking?.renter)
      let slug = listing?.category_slug || null;
      if (!slug && listing?.category_id) {
        slug = await resolveListingCategorySlug(listing.category_id);
      }
      const copy = getReviewReminderTelegramCopy(slug, guestLang);
      const title =
        guestLang === 'en'
          ? 'Leave a review'
          : guestLang === 'zh'
            ? '留下评价'
            : guestLang === 'th'
              ? 'เขียนรีวิว'
              : 'Оставьте отзыв'
      const bookingsLabel = notifyTelegramCopy('notifyTg_myBookings', guestLang);
      const helpLine = notifyTelegramCopy('notifyTg_reviewReminderHelp', guestLang);
      await sendTelegram(
        guestTelegram,
        `⭐ <b>${title}</b>\n\n` +
          `📍 ${listing?.title || notifyTelegramCopy('notifyTg_listingFallback', guestLang)}\n` +
          `${copy.lead} ${helpLine}\n\n` +
          `📱 <a href="${bookingsDeep}">${bookingsLabel}</a>`,
      );
    }
  }

export async function handleCheckInReminder(data) {
  const { sendTelegram } = getNotifyDeps()

    const { booking, listing } = data;

    const guestTelegram = booking?.renter?.telegram_id;
    const bookingsDeep = `${BASE_URL}${renterBookingsListPath(booking?.id)}`;
    if (guestTelegram) {
      await safeNotifyChannel('checkinReminder:guestTg', async () => {
        const guestLang = await resolveGuestNotifyLocale(booking, booking?.renter)
        let slug = listing?.category_slug || null;
        if (!slug && listing?.category_id) {
          slug = await resolveListingCategorySlug(listing.category_id);
        }
        const copy = getCheckInReminderTelegramCopy(slug, guestLang);
        const bookingsLabel = notifyTelegramCopy('notifyTg_myBookings', guestLang);
        await sendTelegram(
          guestTelegram,
          `🔑 <b>${copy.title}</b>\n\n` +
            `📍 ${listing?.title || notifyTelegramCopy('notifyTg_listingFallback', guestLang)}\n` +
            `📅 ${copy.lead}\n\n` +
            `${copy.action}\n\n` +
            `📱 <a href="${bookingsDeep}">${bookingsLabel}</a>`,
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

function disputeLinkByRole(role, bookingId, conversationId) {
  const conv = String(conversationId || '').trim()
  if (conv) return `/messages/${encodeURIComponent(conv)}`
  return String(role || '').toUpperCase() === 'PARTNER'
    ? partnerBookingsListPath(bookingId)
    : renterBookingsListPath(bookingId)
}

async function notifyDisputeUser({ user, role, bookingId, disputeId, messageText, templateKey, hoursLeft, conversationId }) {
  if (!user?.id) return
  const userLang = pickLang(user)
  const link = disputeLinkByRole(role, bookingId, conversationId)
  await safeNotifyChannel(`dispute:${templateKey}:push:${user.id}`, async () => {
    await PushService.sendToUser(String(user.id), templateKey, {
      bookingId: String(bookingId || ''),
      disputeId: String(disputeId || ''),
      summary: messageText,
      hoursLeft: String(hoursLeft || ''),
      link,
    })
  })
  await safeNotifyChannel(`dispute:${templateKey}:tg:${user.id}`, async () => {
    if (!user?.telegram_id) return
    const title = tx('booking.dispute_opened_sla.title', userLang, { bookingId })
    const openCase = notifyTelegramCopy('notifyTg_openCase', userLang)
    await Tg.sendTelegramChat(
      user.telegram_id,
      `<b>${escapeTelegramHtmlText(title)}</b>\n\n${escapeTelegramHtmlText(messageText)}\n\n` +
        `📱 <a href="${BASE_URL}${link}">${openCase}</a>`,
    )
  })
}

/** Уведомление сторонам при открытии официального спора с фиксированным SLA сроком. */
export async function handleDisputeOpenedSla(data) {
  const { bookingId, disputeId, deadlineAt, renter, partner, reason } = data || {}
  const partnerLang = pickLang(partner)
  const renterLang = pickLang(renter)
  const deadlinePartner = deadlineAt ? new Date(String(deadlineAt)).toLocaleString(partnerLang) : '—'
  const deadlineRenter = deadlineAt ? new Date(String(deadlineAt)).toLocaleString(renterLang) : '—'
  const reasonText = reason ? `\n${String(reason).slice(0, 600)}` : ''
  const commonPartner = tx('booking.dispute_opened_sla.common', partnerLang, {
    hours: DISPUTE_SLA_HOURS,
  })
  const commonRenter = tx('booking.dispute_opened_sla.common', renterLang, {
    hours: DISPUTE_SLA_HOURS,
  })
  const partnerLine =
    `${commonPartner}\n` +
    tx('booking.dispute_opened_sla.partner', partnerLang, {
      hours: DISPUTE_SLA_HOURS,
      deadline: deadlinePartner,
    }) +
    reasonText
  const renterLine =
    `${commonRenter}\n` +
    tx('booking.dispute_opened_sla.renter', renterLang, {
      deadline: deadlineRenter,
    }) +
    reasonText

  await notifyDisputeUser({
    user: partner,
    role: 'PARTNER',
    bookingId,
    disputeId,
    messageText: partnerLine,
    templateKey: 'DISPUTE_OPENED',
    hoursLeft: DISPUTE_SLA_HOURS,
    conversationId: data?.conversationId,
  })
  await notifyDisputeUser({
    user: renter,
    role: 'RENTER',
    bookingId,
    disputeId,
    messageText: renterLine,
    templateKey: 'DISPUTE_OPENED',
    hoursLeft: DISPUTE_SLA_HOURS,
    conversationId: data?.conversationId,
  })
}

/** Напоминание сторонам за 24ч/2ч до дедлайна. */
export async function handleDisputeSlaReminder(data) {
  const { bookingId, disputeId, hoursLeft, renter, partner, deadlineAt } = data || {}
  const partnerLang = pickLang(partner)
  const renterLang = pickLang(renter)
  const partnerText = tx('booking.dispute_sla_reminder.body', partnerLang, {
    hours: hoursLeft || '',
    deadline: deadlineAt ? new Date(String(deadlineAt)).toLocaleString(partnerLang) : '—',
  })
  const renterText = tx('booking.dispute_sla_reminder.body', renterLang, {
    hours: hoursLeft || '',
    deadline: deadlineAt ? new Date(String(deadlineAt)).toLocaleString(renterLang) : '—',
  })
  await notifyDisputeUser({
    user: partner,
    role: 'PARTNER',
    bookingId,
    disputeId,
    messageText: partnerText,
    templateKey: 'DISPUTE_SLA_REMINDER',
    hoursLeft,
    conversationId: data?.conversationId,
  })
  await notifyDisputeUser({
    user: renter,
    role: 'RENTER',
    bookingId,
    disputeId,
    messageText: renterText,
    templateKey: 'DISPUTE_SLA_REMINDER',
    hoursLeft,
    conversationId: data?.conversationId,
  })
}

/** Авто-резолюция по breach SLA. */
export async function handleDisputeAutoResolved(data) {
  const { bookingId, disputeId, renter, partner, resolutionReason } = data || {}
  const partnerLang = pickLang(partner)
  const renterLang = pickLang(renter)
  const partnerText = tx('booking.dispute_auto_resolved.body', partnerLang, {
    reason: resolutionReason || '—',
  })
  const renterText = tx('booking.dispute_auto_resolved.body', renterLang, {
    reason: resolutionReason || '—',
  })
  await notifyDisputeUser({
    user: partner,
    role: 'PARTNER',
    bookingId,
    disputeId,
    messageText: partnerText,
    templateKey: 'DISPUTE_AUTO_RESOLVED',
    conversationId: data?.conversationId,
  })
  await notifyDisputeUser({
    user: renter,
    role: 'RENTER',
    bookingId,
    disputeId,
    messageText: renterText,
    templateKey: 'DISPUTE_AUTO_RESOLVED',
    conversationId: data?.conversationId,
  })
}
