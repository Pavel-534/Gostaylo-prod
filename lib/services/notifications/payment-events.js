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
import { normalizeEmailLang, escrowEmailLine } from '@/lib/email/booking-email-i18n'
import { PushService } from '@/lib/services/notifications/push.service.js'
import { readBookingFinancialSnapshot } from '@/lib/services/booking-financial-read-model.service'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'
import { safeNotifyChannel, PAYMENT_METHOD_LABELS, escrowCheckInSecurityMessageRu } from '@/lib/services/notifications/notify-shared.js'

const BASE_URL = getPublicSiteUrl()


export async function handlePaymentReceived(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { booking, payment, listing, partner } = data;
    
    // Admin Topic: FINANCE
    await sendToAdminTopic('FINANCE',
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
      await sendTelegram(partner.telegram_id,
        `💰 <b>Оплата получена!</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `💵 ฿${payment?.amount?.toLocaleString() || 0}\n\n` +
        `${escrowCheckInSecurityMessageRu()}`
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
      await sendTelegram(partner.telegram_id,
        `⏳ <b>Оплата на проверке</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `👤 Гость: ${booking?.guest_name || 'N/A'}\n` +
        `💵 ฿${booking?.price_thb?.toLocaleString() || 0}\n\n` +
        `<i>Платёж проходит верификацию. Уведомим когда будет подтверждён.</i>`
      );
    }
    
    // Email to partner
    if (partner?.email) {
      await sendEmail(
        partner.email,
        `⏳ Новый платёж на проверке: ${listing?.title || 'Объект'}`,
        `Здравствуйте!\n\n` +
        `Получен новый платёж от гостя ${booking?.guest_name || 'N/A'}.\n\n` +
        `📍 Объект: ${listing?.title || 'N/A'}\n` +
        `💵 Сумма: ฿${booking?.price_thb?.toLocaleString() || 0}\n` +
        `🔗 Метод: ${paymentMethodLabel}\n\n` +
        `Платёж проходит верификацию. Мы уведомим вас, когда он будет подтверждён.\n\n` +
        `С уважением,\nКоманда ${getSiteDisplayName()}`
      );
    }
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
      await sendTelegram(partner.telegram_id,
        `✅ <b>Оплата подтверждена!</b>\n\n` +
        `📍 ${listing?.title || 'Объект'}\n` +
        `👤 Гость: ${booking?.guest_name || 'N/A'}\n` +
        `💵 ฿${payment?.amount?.toLocaleString() || 0}\n\n` +
        `${escrowCheckInSecurityMessageRu()}`
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
        const chatUrl = await buildGuestChatUrlForBooking(booking.id);
        const emailLang = await resolveGuestEmailLang(booking, null);
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
        await sendEmail(
          booking.guest_email,
          `✅ Оплата подтверждена: ${listing?.title || 'Объект'}`,
          `Здравствуйте, ${booking?.guest_name || 'Гость'}!\n\n` +
            `Ваш платёж успешно подтверждён!\n\n` +
            `📍 Объект: ${listing?.title || 'N/A'}\n` +
            `📅 Даты: ${booking?.check_in} — ${booking?.check_out}\n` +
            `💵 Сумма: ฿${payment?.amount?.toLocaleString() || 0}\n\n` +
            `${escrowCheckInSecurityMessageRu()}\n\n` +
            `Ждём вас!\n\nС уважением,\nКоманда ${getSiteDisplayName()}`,
        );
      }
    }
  }

export async function handlePaymentSuccess(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

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
        const chatUrl = await buildGuestChatUrlForBooking(booking.id);
        const emailLang = await resolveGuestEmailLang(booking, null);
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
        await sendEmail(
          booking.guest_email,
          `💰 Оплата получена: ${listing?.title || 'Объект'}`,
          `Здравствуйте, ${booking.guest_name || 'Гость'}!\n\n` +
            `Спасибо! Ваша оплата успешно получена.\n\n` +
            `📍 Объект: ${listing?.title || 'N/A'}\n` +
            `💵 Сумма: ฿${payment?.amount?.toLocaleString() || booking.price_thb?.toLocaleString() || 0}\n` +
            `🔗 Метод: ${paymentMethodLabel}\n` +
            `📋 Статус: Оплачено ✅\n\n` +
            `${escrowCheckInSecurityMessageRu()}\n\n` +
            `Ждём вас ${booking.check_in}!\n\nС уважением,\nКоманда ${getSiteDisplayName()}`,
        );
      }
    }
    
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
    
    // Email to partner with commission details
    await sendEmail(
      partner.email,
      '💰 Выплата успешно отправлена!',
      `Выплата обработана!\n\n` +
      `📍 Объект: ${listing?.title || 'N/A'}\n` +
      `💵 Сумма к выплате: ฿${payout?.amount?.toLocaleString() || 0}\n` +
      `💳 Полная сумма: ฿${payout?.total?.toLocaleString() || 0}\n` +
      `📊 Комиссия: ฿${payout?.commission?.toLocaleString() || 0} (${commissionRate}% - зафиксировано при бронировании)\n\n` +
      `Средства поступят в течение 1-3 рабочих дней.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
    );
    
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

  // Stage 32 - Escrow Thaw Preview (admin notification about tomorrow's payouts)export async function handleEscrowThawPreview(data) {
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
