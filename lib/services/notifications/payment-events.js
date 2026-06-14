/**
 * Stage 54.0 — payment & payout cluster (notifications).
 */
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import { resolveDefaultCommissionPercent, resolveThbPerUsdt } from '@/lib/services/currency.service'
import { EmailService } from '@/lib/services/email.service.js'
import * as Tg from '@/lib/services/notifications/telegram.service.js'
import {
  escapeTelegramHtmlText,
  formatBookingAmountForNotify,
} from '@/lib/services/notifications/formatting.js'
import { renterBookingsListPath, partnerBookingsListPath } from '@/lib/email/booking-routes.js'
import { normalizeEmailLang, escrowEmailLine } from '@/lib/email/booking-email-i18n'
import { PushService } from '@/lib/services/notifications/push.service.js'
import { readBookingFinancialSnapshot } from '@/lib/services/booking-financial-read-model.service'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'
import { safeNotifyChannel, PAYMENT_METHOD_LABELS } from '@/lib/services/notifications/notify-shared.js'
import { deliverPremiumEmailWithPlainFallback } from '@/lib/services/notifications/notify-email-delivery.js'
import {
  buildGuestPaymentFallback,
  emailFallbackSignoff,
  notifyEmailFallbackCopy,
} from '@/lib/services/notifications/notify-email-fallback-copy.js'
import { resolveNotifyLocaleFromProfile } from '@/lib/i18n/resolve-notify-locale.js'
import {
  notifyTelegramCopy,
  escrowCheckInSecurityMessage,
} from '@/lib/services/notifications/notify-telegram-copy.js'
import { maybeAlertLargePayment } from '@/lib/treasury/treasury-monitoring-alerts.js'

const BASE_URL = getPublicSiteUrl()


export async function handlePaymentReceived(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, payment, listing, partner } = data;
    
    // Admin Topic: FINANCE
    const amountThb =
      Number(payment?.amount) ||
      Number(booking?.price_thb) + Number(booking?.commission_thb || 0) ||
      0

    const methodLabel = PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.method || 'N/A'
    const methodUpper = String(payment?.payment_method || payment?.method || '').toUpperCase()
    const isMir = methodUpper.includes('MIR') || methodUpper.includes('CARD_RU')

    let rubExtra = ''
    let fiLink = ''
    try {
      const { isFintechTestBookingRow } = await import('@/lib/admin/fintech-test-data-markers.js')
      const { readGuestBruttoFromBooking } = await import(
        '@/lib/services/payment-adapters/acquirer-charge-amount.js'
      )
      if (booking && !isFintechTestBookingRow(booking)) {
        const brutto = readGuestBruttoFromBooking(booking)
        if (brutto?.currency === 'RUB' && Number(brutto.amount) > 0) {
          rubExtra = `\n💳 <b>RUB:</b> ${Number(brutto.amount).toLocaleString('ru-RU')} ₽`
        }
        if (booking.id) {
          fiLink =
            `\n<a href="${BASE_URL}/admin/finance/intelligence/bookings/${encodeURIComponent(String(booking.id))}">P&amp;L → Financial Intelligence</a>`
        }
      }
    } catch {
      /* optional enrichment */
    }

    await sendToAdminTopic('FINANCE',
      `💰 <b>ПЛАТЁЖ ПОЛУЧЕН</b>${isMir ? ' · MIR' : ''}\n\n` +
      `📝 <b>Booking ID:</b> ${booking?.id || 'N/A'}\n` +
      `📍 <b>Объект:</b> ${listing?.title || 'N/A'}\n` +
      `💵 <b>Сумма:</b> ฿${amountThb.toLocaleString('ru-RU')}${rubExtra}\n` +
      `🔗 <b>Метод:</b> ${methodLabel}\n` +
      `${payment?.txid ? `📋 <b>TXID:</b> <code>${payment.txid}</code>\n` : ''}` +
      `\n✅ <b>Статус:</b> CONFIRMED${fiLink}\n` +
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
    );

    void maybeAlertLargePayment({
      bookingId: booking?.id,
      amountThb,
      listingTitle: listing?.title,
      method: PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.method,
    })

    await safeNotifyChannel('paymentReceived:partnerPush', async () => {
      const partnerId = partner?.id || booking?.partner_id
      if (!partnerId) return
      await PushService.sendToUser(String(partnerId), 'PAYMENT_RECEIVED', {
        amount: String(amountThb || payment?.amount || booking?.price_thb || 0),
        listing: listing?.title || '—',
        link: partnerBookingsListPath(booking?.id),
        bookingId: String(booking?.id || ''),
      })
    })

    void import('@/lib/treasury/controlled-live.js').then(({ maybeAlertFirstRealPayment, maybeAlertDailyPilotLimitSoft }) => {
      maybeAlertFirstRealPayment({ booking, payment })
      maybeAlertDailyPilotLimitSoft({ booking })
    })
    
    // Notify Partner
    if (partner?.telegram_id) {
      const partnerLang = resolveNotifyLocaleFromProfile(partner);
      const listingTitle = listing?.title || notifyTelegramCopy('notifyTg_listingFallback', partnerLang);
      await sendTelegram(partner.telegram_id,
        `${notifyTelegramCopy('notifyTg_paymentReceivedTitle', partnerLang)}\n\n` +
        `📍 ${escapeTelegramHtmlText(listingTitle)}\n` +
        `💵 ฿${payment?.amount?.toLocaleString() || 0}\n\n` +
        `${escrowCheckInSecurityMessage(partnerLang)}`
      );
    }
  }

export async function handlePaymentSubmitted(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, payment, listing, partner } = data;
    
    const paymentMethodLabel = PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.payment_method || 'N/A';
    
    const thbAmount = booking?.price_thb || payment?.amount || 0;
    const thbPerUsdt = await resolveThbPerUsdt();
    const usdtAmount = Math.round((parseFloat(thbAmount) / thbPerUsdt) * 100) / 100;
    
    // Admin Topic: FINANCE (Thread 16) - Show amount in USDT
    await sendToAdminTopic('FINANCE',
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
      const partnerLang = resolveNotifyLocaleFromProfile(partner);
      const listingTitle = listing?.title || notifyTelegramCopy('notifyTg_listingFallback', partnerLang);
      const guestLabel = notifyTelegramCopy('notifyTg_guestLabel', partnerLang);
      await sendTelegram(partner.telegram_id,
        `${notifyTelegramCopy('notifyTg_paymentPendingTitle', partnerLang)}\n\n` +
        `📍 ${escapeTelegramHtmlText(listingTitle)}\n` +
        `👤 ${guestLabel}: ${escapeTelegramHtmlText(booking?.guest_name || 'N/A')}\n` +
        `💵 ฿${booking?.price_thb?.toLocaleString() || 0}\n\n` +
        `${notifyTelegramCopy('notifyTg_paymentPendingHint', partnerLang)}`
      );
    }
    
    await safeNotifyChannel('paymentSubmitted:partnerEmail', async () => {
      if (!partner?.email) return;
      const partnerLang = resolveNotifyLocaleFromProfile(partner);
      const listingTitle =
        listing?.title || notifyEmailFallbackCopy('emailFb_fallbackListing', partnerLang);
      await sendEmail(
        partner.email,
        notifyEmailFallbackCopy('emailFb_partnerPaymentPendingSubj', partnerLang, { listing: listingTitle }),
        [
          notifyEmailFallbackCopy('emailFb_partnerPaymentPendingLead', partnerLang, {
            guest: booking?.guest_name || 'N/A',
          }),
          '',
          notifyEmailFallbackCopy('emailFb_listingLine', partnerLang, { listing: listing?.title || 'N/A' }),
          notifyEmailFallbackCopy('emailFb_paymentAmountLine', partnerLang, {
            amount: booking?.price_thb?.toLocaleString() || '0',
          }),
          notifyEmailFallbackCopy('emailFb_methodLine', partnerLang, { method: paymentMethodLabel }),
          '',
          notifyEmailFallbackCopy('emailFb_partnerPaymentPendingTail', partnerLang),
          '',
          emailFallbackSignoff(partnerLang),
        ].join('\n'),
      );
    });

    await safeNotifyChannel('paymentSubmitted:partnerPush', async () => {
      const partnerId = partner?.id || booking?.partner_id
      if (!partnerId) return
      await PushService.sendToUser(String(partnerId), 'PAYMENT_PENDING_PARTNER', {
        amount: String(booking?.price_thb || payment?.amount || 0),
        listing: listing?.title || '—',
        link: partnerBookingsListPath(booking?.id),
        bookingId: String(booking?.id || ''),
      })
    })
  }

export async function handlePaymentConfirmed(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, payment, listing, partner } = data;
    
    const paymentMethodLabel = PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.payment_method || 'N/A';
    
    // Admin Topic: FINANCE
    await sendToAdminTopic('FINANCE',
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
      const partnerLang = resolveNotifyLocaleFromProfile(partner);
      const listingTitle = listing?.title || notifyTelegramCopy('notifyTg_listingFallback', partnerLang);
      const guestLabel = notifyTelegramCopy('notifyTg_guestLabel', partnerLang);
      await sendTelegram(partner.telegram_id,
        `${notifyTelegramCopy('notifyTg_paymentConfirmedTitle', partnerLang)}\n\n` +
        `📍 ${escapeTelegramHtmlText(listingTitle)}\n` +
        `👤 ${guestLabel}: ${escapeTelegramHtmlText(booking?.guest_name || 'N/A')}\n` +
        `💵 ฿${payment?.amount?.toLocaleString() || 0}\n\n` +
        `${escrowCheckInSecurityMessage(partnerLang)}`
      );
    }

    await safeNotifyChannel('paymentConfirmed:partnerPush', async () => {
      const partnerId = partner?.id || booking?.partner_id
      if (!partnerId) return
      const amount = payment?.amount || booking?.price_thb || 0
      await PushService.sendToUser(String(partnerId), 'PAYMENT_RECEIVED', {
        amount: String(amount),
        listing: listing?.title || '—',
        link: partnerBookingsListPath(booking?.id),
        bookingId: String(booking?.id || ''),
      })
    })
    
    await safeNotifyChannel('paymentConfirmed:guestEmail', async () => {
      if (!booking?.guest_email) return;
      const totalThb = parseFloat(booking?.price_thb) || parseFloat(payment?.amount) || 0;
      const amountLine = formatBookingAmountForNotify(booking, totalThb);
      let listingImageUrl = listing?.cover_image || null;
      if (!listingImageUrl && Array.isArray(listing?.images) && listing.images.length > 0) {
        listingImageUrl = listing.images[0];
      }
      const chatUrl = await buildGuestChatUrlForBooking(booking.id);
      const emailLang = await resolveGuestEmailLang(booking, null);
      const guestLang = emailLang;
      await deliverPremiumEmailWithPlainFallback({
        channelLabel: 'paymentConfirmed:guestEmail',
        to: booking.guest_email,
        premiumFn: () =>
          EmailService.sendPaymentSuccessGuest(
            {
              guestName: booking?.guest_name || notifyEmailFallbackCopy('emailFb_fallbackGuest', guestLang),
              listingTitle:
                listing?.title || notifyEmailFallbackCopy('emailFb_fallbackListing', guestLang),
              listingImageUrl,
              district: listing?.district,
              checkIn: booking?.check_in,
              checkOut: booking?.check_out,
              amountLine,
              methodLine: paymentMethodLabel,
              escrowText: escrowEmailLine(emailLang),
              bookingsUrl: `${BASE_URL}${renterBookingsListPath(booking.id)}`,
              chatUrl,
              profileUrl: `${BASE_URL}/renter/profile/`,
            },
            booking.guest_email,
            emailLang,
          ),
        sendPlainEmail: sendEmail,
        buildFallback: () =>
          buildGuestPaymentFallback(guestLang, {
            variant: 'confirmed',
            guestName: booking?.guest_name,
            listing: listing?.title,
            checkIn: booking?.check_in,
            checkOut: booking?.check_out,
            amount: payment?.amount?.toLocaleString() || '0',
          }),
      });
    });
  }

export async function handlePaymentSuccess(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, payment, listing } = data;

    const paymentMethodLabel =
      PAYMENT_METHOD_LABELS[payment?.payment_method] || payment?.method || payment?.payment_method || 'N/A';

    await safeNotifyChannel('paymentSuccess:guestEmail', async () => {
      if (!booking?.guest_email) return;
      const totalThb = parseFloat(booking?.price_thb) || parseFloat(payment?.amount) || 0;
      const amountLine = formatBookingAmountForNotify(booking, totalThb);
      let listingImageUrl = listing?.cover_image || null;
      if (!listingImageUrl && Array.isArray(listing?.images) && listing.images.length > 0) {
        listingImageUrl = listing.images[0];
      }
      const chatUrl = await buildGuestChatUrlForBooking(booking.id);
      const emailLang = await resolveGuestEmailLang(booking, null);
      const guestLang = emailLang;
      await deliverPremiumEmailWithPlainFallback({
        channelLabel: 'paymentSuccess:guestEmail',
        to: booking.guest_email,
        premiumFn: () =>
          EmailService.sendPaymentSuccessGuest(
            {
              guestName: booking.guest_name || notifyEmailFallbackCopy('emailFb_fallbackGuest', guestLang),
              listingTitle:
                listing?.title || notifyEmailFallbackCopy('emailFb_fallbackListing', guestLang),
              listingImageUrl,
              district: listing?.district,
              checkIn: booking.check_in,
              checkOut: booking.check_out,
              amountLine,
              methodLine: paymentMethodLabel,
              escrowText: escrowEmailLine(emailLang),
              bookingsUrl: `${BASE_URL}${renterBookingsListPath(booking.id)}`,
              chatUrl,
              profileUrl: `${BASE_URL}/renter/profile/`,
            },
            booking.guest_email,
            emailLang,
          ),
        sendPlainEmail: sendEmail,
        buildFallback: () =>
          buildGuestPaymentFallback(guestLang, {
            variant: 'success',
            guestName: booking.guest_name,
            listing: listing?.title,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            amount:
              payment?.amount?.toLocaleString() || booking.price_thb?.toLocaleString() || '0',
            method: paymentMethodLabel,
          }),
      });
    });
    
    // Admin Topic: FINANCE
    await sendToAdminTopic('FINANCE',
      `💰 <b>ПЛАТЁЖ ПОДТВЕРЖДЁН</b>\n\n` +
      `📝 <b>Booking:</b> ${booking?.id}\n` +
      `📍 ${listing?.title || 'N/A'}\n` +
      `👤 ${booking.guest_name || 'N/A'}\n` +
      `💵 ฿${payment?.amount?.toLocaleString() || booking.price_thb?.toLocaleString() || 0}\n` +
      `🔗 ${payment?.method || 'N/A'}\n\n` +
      `✅ Средства в Эскроу`
    );
  }

export async function handlePayoutProcessed(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

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
    
    const partnerLang = resolveNotifyLocaleFromProfile(partner);
    await safeNotifyChannel('payoutProcessed:partnerEmail', async () => {
      if (!partner?.email) return;
      await sendEmail(
        partner.email,
        notifyEmailFallbackCopy('emailFb_payoutProcessedSubj', partnerLang),
        [
          notifyEmailFallbackCopy('emailFb_payoutProcessedLead', partnerLang),
          '',
          notifyEmailFallbackCopy('emailFb_listingLine', partnerLang, { listing: listing?.title || 'N/A' }),
          notifyEmailFallbackCopy('emailFb_payoutAmountLine', partnerLang, {
            amount: payout?.amount?.toLocaleString() || '0',
          }),
          notifyEmailFallbackCopy('emailFb_payoutGrossLine', partnerLang, {
            amount: payout?.total?.toLocaleString() || '0',
          }),
          notifyEmailFallbackCopy('emailFb_payoutCommissionNote', partnerLang, {
            commission: payout?.commission?.toLocaleString() || '0',
            rate: commissionRate,
          }),
          '',
          notifyEmailFallbackCopy('emailFb_payoutEta', partnerLang),
          '',
          emailFallbackSignoff(partnerLang),
        ].join('\n'),
      );
    });
    
    // Telegram to partner with commission info
    if (partner?.telegram_id) {
      await sendTelegram(partner.telegram_id,
        `💰 <b>Выплата отправлена!</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `💵 К выплате: ฿${payout?.amount?.toLocaleString() || 0}\n` +
        `📊 Комиссия: ${commissionRate}% (฿${payout?.commission?.toLocaleString() || 0})\n` +
        `<i>(зафиксировано при бронировании)</i>`
      );
    }
    
    // Admin Topic: FINANCE (Thread 16) - Payout notification with commission
    await sendToAdminTopic('FINANCE',
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

export async function handlePayoutRejected(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { payout, partner, reason } = data;
    
    await sendEmail(
      partner.email,
      '❌ Выплата отклонена',
      `Ваш запрос на выплату был отклонен.\n\n` +
      `💵 Сумма: ${payout.amount} ${payout.currency}\n` +
      `📝 Причина: ${reason || 'Не указана'}\n\n` +
      `Обратитесь в поддержку для уточнения деталей.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
    );
  }

  // Stage 32 - Escrow Thaw Preview (admin notification about tomorrow's payouts)
export async function handleEscrowThawPreview(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { bookings, thawDate } = data;
    
    if (!bookings || bookings.length === 0) return;
    
    const bookingsList = bookings
      .map((b) => {
        const amount = Number(b.partner_earnings_thb ?? b.amount ?? 0)
        return `• ${b.listing?.title || 'N/A'}: ฿${amount.toLocaleString()}`
      })
      .join('\n');
    
    await sendToAdminTopic('FINANCE',
      `🔔 <b>ESCROW PREVIEW</b>\n\n` +
      `📅 Дата разморозки: ${thawDate} 18:00\n` +
      `📊 Бронирований: ${bookings.length}\n\n` +
      `${bookingsList}\n\n` +
      `<i>Эти средства будут выплачены партнёрам завтра (правило 24ч)</i>`
    );
  }

export async function handlePayoutBatchCompleted(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { count, total, results } = data;
    
    const successList = results
      .filter(r => r.success)
      .map(r => `✅ ${r.listingTitle}: ฿${r.amount?.toLocaleString() || 0}`)
      .join('\n');
    
    const failedList = results
      .filter(r => !r.success)
      .map(r => `❌ ${r.bookingId}: ${r.error}`)
      .join('\n');
    
    await sendToAdminTopic('FINANCE',
      `💰 <b>BATCH PAYOUT COMPLETED</b>\n\n` +
      `✅ Успешно: ${count}/${total}\n\n` +
      `${successList}\n` +
      `${failedList ? `\n<b>Ошибки:</b>\n${failedList}` : ''}\n\n` +
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
    );
  }

export async function handlePartnerFundsThawedAvailable(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, listing, partner, fundsNetThb: preNet } = data || {}
    if (!booking?.partner_id || !booking?.id) return

    let amountStr
    if (preNet != null && String(preNet).trim() !== '') {
      amountStr = String(preNet).trim()
    } else {
      const fin = await readBookingFinancialSnapshot(booking.id)
      const netThb =
        fin.success && fin.data?.partnerPayoutThb != null
          ? Math.round(Number(fin.data.partnerPayoutThb))
          : Math.round(Number(booking.partner_earnings_thb ?? 0))
      amountStr = String(Number.isFinite(netThb) ? netThb : 0)
    }
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
      await deliverPremiumEmailWithPlainFallback({
        channelLabel: 'fundsThawed:partnerEmail',
        to,
        premiumFn: () =>
          EmailService.sendPartnerFundsThawedEmail(
            { amountThb: amountStr, listingTitle, bookingId: String(booking.id) },
            to,
            emailLang,
          ),
        sendPlainEmail: sendEmail,
        buildFallback: () => ({
          subject: notifyEmailFallbackCopy('emailFb_partnerCheckInSubj', emailLang, { listing: listingTitle }),
          body: [
            notifyEmailFallbackCopy('emailFb_partnerCheckInFunds', emailLang),
            '',
            notifyEmailFallbackCopy('emailFb_listingLine', emailLang, { listing: listingTitle }),
            notifyEmailFallbackCopy('emailFb_amountLine', emailLang, { amount: amountStr }),
            '',
            emailFallbackSignoff(emailLang),
          ].join('\n'),
        }),
      })
    })
  }
