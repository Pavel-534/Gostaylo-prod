/**
 * Stage 145 — plain-text email fallback copy (ru/en/zh/th) when premium EmailService returns success:false.
 */
import { normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver.js'
import { getSiteDisplayName } from '@/lib/site-url.js'
import { escrowCheckInSecurityMessage } from '@/lib/services/notifications/notify-telegram-copy.js'

/** @type {Record<string, Record<string, string>>} */
const COPY = {
  ru: {
    emailFb_greetingGuest: 'Здравствуйте, {name}!',
    emailFb_greetingPartner: 'Здравствуйте, {name}!',
    emailFb_signoff: 'С уважением,\nКоманда {brand}',
    emailFb_listingLine: '📍 Объект: {listing}',
    emailFb_datesLine: '📅 Даты: {checkIn} — {checkOut}',
    emailFb_amountLine: '💰 Сумма: ฿{amount}',
    emailFb_guestBookingRequestedSubj: '🏠 Заявка на бронирование: {listing}',
    emailFb_guestBookingInstantSubj: '✅ Бронирование подтверждено: {listing}',
    emailFb_guestBookingRequestedLead: 'Ваша заявка на бронирование получена!',
    emailFb_guestBookingInstantLead: 'Ваше бронирование подтверждено и оплачено по правилам instant book.',
    emailFb_partnerNewLeadSubj: '🏠 Новая заявка на бронирование: {listing}',
    emailFb_partnerInstantSubj: '✅ Новое подтверждённое бронирование: {listing}',
    emailFb_partnerNewLeadLead: 'Получена новая заявка на бронирование!',
    emailFb_partnerInstantLead: 'Поступило мгновенное (instant) бронирование — даты уже заблокированы.',
    emailFb_guestLine: '👤 Гость: {guest}',
    emailFb_commissionLine: '📊 Комиссия сервиса: {rate}% (฿{commission})',
    emailFb_earningsLine: '💵 Ваш доход: ฿{earnings}',
    emailFb_guestMessageLine: '💬 Сообщение от гостя: {note}',
    emailFb_partnerNewLeadTail: 'Перейдите в панель партнёра чтобы подтвердить или отклонить заявку.',
    emailFb_partnerInstantTail: 'Откройте кабинет партнёра для деталей и чата с гостем.',
    emailFb_guestConfirmedSubj: '✅ Бронирование подтверждено: {listing}',
    emailFb_guestConfirmedLead: 'Ваше бронирование подтверждено!',
    emailFb_payAmountLine: '💰 Сумма к оплате: ฿{amount}',
    emailFb_guestCancelledSubj: '❌ Бронирование отменено: {listing}',
    emailFb_guestCancelledLead: 'К сожалению, ваше бронирование было отменено.',
    emailFb_reasonLine: 'Причина: {reason}',
    emailFb_supportHint: 'Если у вас есть вопросы, свяжитесь с поддержкой.',
    emailFb_paymentConfirmedSubj: '✅ Оплата подтверждена: {listing}',
    emailFb_paymentConfirmedLead: 'Ваш платёж успешно подтверждён!',
    emailFb_paymentSuccessSubj: '💰 Оплата получена: {listing}',
    emailFb_paymentSuccessLead: 'Спасибо! Ваша оплата успешно получена.',
    emailFb_paymentAmountLine: '💵 Сумма: ฿{amount}',
    emailFb_methodLine: '🔗 Метод: {method}',
    emailFb_paidStatus: '📋 Статус: Оплачено ✅',
    emailFb_seeYouLine: 'Ждём вас {checkIn}!',
    emailFb_partnerPaymentPendingSubj: '⏳ Новый платёж на проверке: {listing}',
    emailFb_partnerPaymentPendingLead: 'Получен новый платёж от гостя {guest}.',
    emailFb_partnerPaymentPendingTail: 'Платёж проходит верификацию. Мы уведомим вас, когда он будет подтверждён.',
    emailFb_partnerCheckInSubj: '✅ Заселение подтверждено: {listing}',
    emailFb_partnerCheckInLead: 'Гость заселился!',
    emailFb_partnerCheckInFunds: 'Средства из Эскроу переведены на ваш баланс.',
    emailFb_welcomeSubj: '🌴 Добро пожаловать в {brand}!',
    emailFb_welcomeLead: 'Добро пожаловать в {brand} — вашу платформу для аренды на Пхукете.',
    emailFb_partnerVerifiedSubj: '🎉 Ваша учетная запись верифицирована!',
    emailFb_partnerVerifiedLead: 'Ваша учетная запись партнёра была успешно верифицирована.',
    emailFb_partnerVerifiedBullets:
      'Теперь вы можете:\n• Создавать объявления\n• Принимать бронирования\n• Получать выплаты',
    emailFb_partnerVerifiedTail: 'Удачного бизнеса!',
    emailFb_payoutProcessedSubj: '💰 Выплата успешно отправлена!',
    emailFb_payoutProcessedLead: 'Выплата обработана!',
    emailFb_payoutAmountLine: '💵 Сумма к выплате: ฿{amount}',
    emailFb_payoutGrossLine: '💳 Полная сумма: ฿{amount}',
    emailFb_payoutCommissionNote: '📊 Комиссия: ฿{commission} ({rate}% — зафиксировано при бронировании)',
    emailFb_payoutEta: 'Средства поступят в течение 1-3 рабочих дней.',
    emailFb_fallbackGuest: 'Гость',
    emailFb_fallbackPartner: 'Партнёр',
    emailFb_fallbackListing: 'Объект',
    emailFb_fallbackFriend: 'друг',
  },
  en: {
    emailFb_greetingGuest: 'Hello, {name}!',
    emailFb_greetingPartner: 'Hello, {name}!',
    emailFb_signoff: 'Best regards,\nThe {brand} team',
    emailFb_listingLine: '📍 Listing: {listing}',
    emailFb_datesLine: '📅 Dates: {checkIn} — {checkOut}',
    emailFb_amountLine: '💰 Amount: ฿{amount}',
    emailFb_guestBookingRequestedSubj: '🏠 Booking request: {listing}',
    emailFb_guestBookingInstantSubj: '✅ Booking confirmed: {listing}',
    emailFb_guestBookingRequestedLead: 'We received your booking request!',
    emailFb_guestBookingInstantLead: 'Your instant booking is confirmed and paid.',
    emailFb_partnerNewLeadSubj: '🏠 New booking request: {listing}',
    emailFb_partnerInstantSubj: '✅ New confirmed booking: {listing}',
    emailFb_partnerNewLeadLead: 'You have a new booking request!',
    emailFb_partnerInstantLead: 'An instant booking arrived — dates are already blocked.',
    emailFb_guestLine: '👤 Guest: {guest}',
    emailFb_commissionLine: '📊 Service fee: {rate}% (฿{commission})',
    emailFb_earningsLine: '💵 Your earnings: ฿{earnings}',
    emailFb_guestMessageLine: '💬 Guest message: {note}',
    emailFb_partnerNewLeadTail: 'Open the partner dashboard to accept or decline.',
    emailFb_partnerInstantTail: 'Open the partner dashboard for details and chat.',
    emailFb_guestConfirmedSubj: '✅ Booking confirmed: {listing}',
    emailFb_guestConfirmedLead: 'Your booking is confirmed!',
    emailFb_payAmountLine: '💰 Amount due: ฿{amount}',
    emailFb_guestCancelledSubj: '❌ Booking cancelled: {listing}',
    emailFb_guestCancelledLead: 'Unfortunately, your booking was cancelled.',
    emailFb_reasonLine: 'Reason: {reason}',
    emailFb_supportHint: 'If you have questions, contact support.',
    emailFb_paymentConfirmedSubj: '✅ Payment confirmed: {listing}',
    emailFb_paymentConfirmedLead: 'Your payment was confirmed!',
    emailFb_paymentSuccessSubj: '💰 Payment received: {listing}',
    emailFb_paymentSuccessLead: 'Thank you! Your payment was received.',
    emailFb_paymentAmountLine: '💵 Amount: ฿{amount}',
    emailFb_methodLine: '🔗 Method: {method}',
    emailFb_paidStatus: '📋 Status: Paid ✅',
    emailFb_seeYouLine: 'See you on {checkIn}!',
    emailFb_partnerPaymentPendingSubj: '⏳ New payment under review: {listing}',
    emailFb_partnerPaymentPendingLead: 'A new payment was received from guest {guest}.',
    emailFb_partnerPaymentPendingTail: 'Payment is being verified. We will notify you when confirmed.',
    emailFb_partnerCheckInSubj: '✅ Check-in confirmed: {listing}',
    emailFb_partnerCheckInLead: 'The guest has checked in!',
    emailFb_partnerCheckInFunds: 'Escrow funds have been credited to your balance.',
    emailFb_welcomeSubj: '🌴 Welcome to {brand}!',
    emailFb_welcomeLead: 'Welcome to {brand} — your rental platform in Phuket.',
    emailFb_partnerVerifiedSubj: '🎉 Your account is verified!',
    emailFb_partnerVerifiedLead: 'Your partner account was successfully verified.',
    emailFb_partnerVerifiedBullets:
      'You can now:\n• Create listings\n• Accept bookings\n• Receive payouts',
    emailFb_partnerVerifiedTail: 'Good luck with your business!',
    emailFb_payoutProcessedSubj: '💰 Payout sent successfully!',
    emailFb_payoutProcessedLead: 'Your payout has been processed!',
    emailFb_payoutAmountLine: '💵 Payout amount: ฿{amount}',
    emailFb_payoutGrossLine: '💳 Gross amount: ฿{amount}',
    emailFb_payoutCommissionNote: '📊 Fee: ฿{commission} ({rate}% — locked at booking)',
    emailFb_payoutEta: 'Funds will arrive within 1–3 business days.',
    emailFb_fallbackGuest: 'Guest',
    emailFb_fallbackPartner: 'Partner',
    emailFb_fallbackListing: 'Listing',
    emailFb_fallbackFriend: 'friend',
  },
  zh: {
    emailFb_greetingGuest: '您好，{name}！',
    emailFb_greetingPartner: '您好，{name}！',
    emailFb_signoff: '此致\n{brand} 团队',
    emailFb_listingLine: '📍 房源：{listing}',
    emailFb_datesLine: '📅 日期：{checkIn} — {checkOut}',
    emailFb_amountLine: '💰 金额：฿{amount}',
    emailFb_guestBookingRequestedSubj: '🏠 预订申请：{listing}',
    emailFb_guestBookingInstantSubj: '✅ 预订已确认：{listing}',
    emailFb_guestBookingRequestedLead: '我们已收到您的预订申请！',
    emailFb_guestBookingInstantLead: '您的即时预订已确认并付款。',
    emailFb_partnerNewLeadSubj: '🏠 新预订申请：{listing}',
    emailFb_partnerInstantSubj: '✅ 新确认预订：{listing}',
    emailFb_partnerNewLeadLead: '您有新的预订申请！',
    emailFb_partnerInstantLead: '收到即时预订 — 日期已锁定。',
    emailFb_guestLine: '👤 客户：{guest}',
    emailFb_commissionLine: '📊 服务费：{rate}%（฿{commission}）',
    emailFb_earningsLine: '💵 您的收入：฿{earnings}',
    emailFb_guestMessageLine: '💬 客户留言：{note}',
    emailFb_partnerNewLeadTail: '请打开合作伙伴后台接受或拒绝。',
    emailFb_partnerInstantTail: '请打开合作伙伴后台查看详情并聊天。',
    emailFb_guestConfirmedSubj: '✅ 预订已确认：{listing}',
    emailFb_guestConfirmedLead: '您的预订已确认！',
    emailFb_payAmountLine: '💰 应付金额：฿{amount}',
    emailFb_guestCancelledSubj: '❌ 预订已取消：{listing}',
    emailFb_guestCancelledLead: '很抱歉，您的预订已被取消。',
    emailFb_reasonLine: '原因：{reason}',
    emailFb_supportHint: '如有疑问，请联系客服。',
    emailFb_paymentConfirmedSubj: '✅ 付款已确认：{listing}',
    emailFb_paymentConfirmedLead: '您的付款已确认！',
    emailFb_paymentSuccessSubj: '💰 已收到付款：{listing}',
    emailFb_paymentSuccessLead: '谢谢！我们已收到您的付款。',
    emailFb_paymentAmountLine: '💵 金额：฿{amount}',
    emailFb_methodLine: '🔗 方式：{method}',
    emailFb_paidStatus: '📋 状态：已付款 ✅',
    emailFb_seeYouLine: '期待 {checkIn} 与您见面！',
    emailFb_partnerPaymentPendingSubj: '⏳ 新付款审核中：{listing}',
    emailFb_partnerPaymentPendingLead: '收到客户 {guest} 的新付款。',
    emailFb_partnerPaymentPendingTail: '付款正在验证中，确认后我们会通知您。',
    emailFb_partnerCheckInSubj: '✅ 入住已确认：{listing}',
    emailFb_partnerCheckInLead: '客户已入住！',
    emailFb_partnerCheckInFunds: '托管资金已转入您的余额。',
    emailFb_welcomeSubj: '🌴 欢迎加入 {brand}！',
    emailFb_welcomeLead: '欢迎加入 {brand} — 您在普吉岛的租赁平台。',
    emailFb_partnerVerifiedSubj: '🎉 您的账户已验证！',
    emailFb_partnerVerifiedLead: '您的合作伙伴账户已成功验证。',
    emailFb_partnerVerifiedBullets: '您现在可以：\n• 创建房源\n• 接受预订\n• 接收付款',
    emailFb_partnerVerifiedTail: '祝您生意兴隆！',
    emailFb_payoutProcessedSubj: '💰 付款已发送！',
    emailFb_payoutProcessedLead: '您的付款已处理！',
    emailFb_payoutAmountLine: '💵 付款金额：฿{amount}',
    emailFb_payoutGrossLine: '💳 总额：฿{amount}',
    emailFb_payoutCommissionNote: '📊 佣金：฿{commission}（{rate}% — 预订时锁定）',
    emailFb_payoutEta: '资金将在 1–3 个工作日内到账。',
    emailFb_fallbackGuest: '客户',
    emailFb_fallbackPartner: '合作伙伴',
    emailFb_fallbackListing: '房源',
    emailFb_fallbackFriend: '朋友',
  },
  th: {
    emailFb_greetingGuest: 'สวัสดี {name}!',
    emailFb_greetingPartner: 'สวัสดี {name}!',
    emailFb_signoff: 'ด้วยความนับถือ\nทีม {brand}',
    emailFb_listingLine: '📍 ประกาศ: {listing}',
    emailFb_datesLine: '📅 วันที่: {checkIn} — {checkOut}',
    emailFb_amountLine: '💰 จำนวน: ฿{amount}',
    emailFb_guestBookingRequestedSubj: '🏠 คำขอจอง: {listing}',
    emailFb_guestBookingInstantSubj: '✅ ยืนยันการจองแล้ว: {listing}',
    emailFb_guestBookingRequestedLead: 'เราได้รับคำขอจองของคุณแล้ว!',
    emailFb_guestBookingInstantLead: 'การจองทันทีของคุณได้รับการยืนยันและชำระเงินแล้ว',
    emailFb_partnerNewLeadSubj: '🏠 คำขอจองใหม่: {listing}',
    emailFb_partnerInstantSubj: '✅ การจองยืนยันใหม่: {listing}',
    emailFb_partnerNewLeadLead: 'คุณมีคำขอจองใหม่!',
    emailFb_partnerInstantLead: 'มีการจองทันที — วันที่ถูกบล็อกแล้ว',
    emailFb_guestLine: '👤 ลูกค้า: {guest}',
    emailFb_commissionLine: '📊 ค่าธรรมเนียม: {rate}% (฿{commission})',
    emailFb_earningsLine: '💵 รายได้ของคุณ: ฿{earnings}',
    emailFb_guestMessageLine: '💬 ข้อความจากลูกค้า: {note}',
    emailFb_partnerNewLeadTail: 'เปิดแดชบอร์ดพาร์ทเนอร์เพื่อยอมรับหรือปฏิเสธ',
    emailFb_partnerInstantTail: 'เปิดแดชบอร์ดพาร์ทเนอร์เพื่อดูรายละเอียดและแชท',
    emailFb_guestConfirmedSubj: '✅ ยืนยันการจอง: {listing}',
    emailFb_guestConfirmedLead: 'การจองของคุณได้รับการยืนยันแล้ว!',
    emailFb_payAmountLine: '💰 ยอดชำระ: ฿{amount}',
    emailFb_guestCancelledSubj: '❌ ยกเลิกการจอง: {listing}',
    emailFb_guestCancelledLead: 'ขออภัย การจองของคุณถูกยกเลิก',
    emailFb_reasonLine: 'เหตุผล: {reason}',
    emailFb_supportHint: 'หากมีคำถาม ติดต่อฝ่ายสนับสนุน',
    emailFb_paymentConfirmedSubj: '✅ ยืนยันการชำระเงิน: {listing}',
    emailFb_paymentConfirmedLead: 'การชำระเงินของคุณได้รับการยืนยันแล้ว!',
    emailFb_paymentSuccessSubj: '💰 รับการชำระเงินแล้ว: {listing}',
    emailFb_paymentSuccessLead: 'ขอบคุณ! เราได้รับการชำระเงินของคุณแล้ว',
    emailFb_paymentAmountLine: '💵 จำนวน: ฿{amount}',
    emailFb_methodLine: '🔗 วิธี: {method}',
    emailFb_paidStatus: '📋 สถานะ: ชำระแล้ว ✅',
    emailFb_seeYouLine: 'พบกัน {checkIn}!',
    emailFb_partnerPaymentPendingSubj: '⏳ การชำระเงินใหม่กำลังตรวจสอบ: {listing}',
    emailFb_partnerPaymentPendingLead: 'ได้รับการชำระเงินใหม่จากลูกค้า {guest}',
    emailFb_partnerPaymentPendingTail: 'กำลังตรวจสอบการชำระเงิน เราจะแจ้งเมื่อยืนยันแล้ว',
    emailFb_partnerCheckInSubj: '✅ ยืนยันเช็คอิน: {listing}',
    emailFb_partnerCheckInLead: 'ลูกค้าเช็คอินแล้ว!',
    emailFb_partnerCheckInFunds: 'เงินเอสโครวถูกโอนเข้ายอดของคุณแล้ว',
    emailFb_welcomeSubj: '🌴 ยินดีต้อนรับสู่ {brand}!',
    emailFb_welcomeLead: 'ยินดีต้อนรับสู่ {brand} — แพลตฟอร์มเช่าของคุณในภูเก็ต',
    emailFb_partnerVerifiedSubj: '🎉 บัญชีของคุณได้รับการยืนยันแล้ว!',
    emailFb_partnerVerifiedLead: 'บัญชีพาร์ทเนอร์ของคุณได้รับการยืนยันเรียบร้อย',
    emailFb_partnerVerifiedBullets:
      'ตอนนี้คุณสามารถ:\n• สร้างประกาศ\n• รับการจอง\n• รับการจ่ายเงิน',
    emailFb_partnerVerifiedTail: 'ขอให้ธุรกิจรุ่งเรือง!',
    emailFb_payoutProcessedSubj: '💰 ส่งการจ่ายเงินแล้ว!',
    emailFb_payoutProcessedLead: 'การจ่ายเงินของคุณดำเนินการแล้ว!',
    emailFb_payoutAmountLine: '💵 ยอดจ่าย: ฿{amount}',
    emailFb_payoutGrossLine: '💳 ยอดรวม: ฿{amount}',
    emailFb_payoutCommissionNote: '📊 ค่าธรรมเนียม: ฿{commission} ({rate}% — ล็อกตอนจอง)',
    emailFb_payoutEta: 'เงินจะเข้าภายใน 1–3 วันทำการ',
    emailFb_fallbackGuest: 'ลูกค้า',
    emailFb_fallbackPartner: 'พาร์ทเนอร์',
    emailFb_fallbackListing: 'ประกาศ',
    emailFb_fallbackFriend: 'เพื่อน',
  },
}

/**
 * @param {string} key
 * @param {string | null | undefined} lang
 * @param {Record<string, string | number | null | undefined>} [params]
 */
export function notifyEmailFallbackCopy(key, lang, params = {}) {
  const lg = normalizeUiLocaleCode(lang)
  const pack = COPY[lg] || COPY.ru
  const fallback = COPY.ru[key] || key
  let out = pack[key] || fallback
  const brand = getSiteDisplayName()
  out = out.replaceAll('{brand}', brand)
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, String(v ?? ''))
  }
  return out
}

/** @param {string | null | undefined} lang */
export function emailFallbackSignoff(lang) {
  return notifyEmailFallbackCopy('emailFb_signoff', lang)
}

/** @param {string | null | undefined} lang */
export function emailFallbackEscrowLine(lang) {
  return escrowCheckInSecurityMessage(lang)
}

/**
 * @param {string | null | undefined} lang
 * @param {Record<string, string | number | null | undefined>} p
 */
export function buildGuestBookingRequestFallback(lang, p) {
  const instant = p.instant === true || p.instant === 'true'
  const listing = String(p.listing || notifyEmailFallbackCopy('emailFb_fallbackListing', lang))
  const subject = notifyEmailFallbackCopy(
    instant ? 'emailFb_guestBookingInstantSubj' : 'emailFb_guestBookingRequestedSubj',
    lang,
    { listing },
  )
  const lead = notifyEmailFallbackCopy(
    instant ? 'emailFb_guestBookingInstantLead' : 'emailFb_guestBookingRequestedLead',
    lang,
  )
  const body = [
    notifyEmailFallbackCopy('emailFb_greetingGuest', lang, {
      name: p.guestName || notifyEmailFallbackCopy('emailFb_fallbackGuest', lang),
    }),
    '',
    lead,
    '',
    notifyEmailFallbackCopy('emailFb_listingLine', lang, { listing }),
    notifyEmailFallbackCopy('emailFb_datesLine', lang, {
      checkIn: p.checkIn,
      checkOut: p.checkOut,
    }),
    notifyEmailFallbackCopy('emailFb_amountLine', lang, { amount: p.amount }),
    '',
    emailFallbackEscrowLine(lang),
  ].join('\n')
  return { subject, body }
}

/**
 * @param {string | null | undefined} lang
 * @param {Record<string, string | number | null | undefined>} p
 */
export function buildPartnerNewLeadFallback(lang, p) {
  const instant = p.instant === true || p.instant === 'true'
  const listing = String(p.listing || notifyEmailFallbackCopy('emailFb_fallbackListing', lang))
  const subject = notifyEmailFallbackCopy(
    instant ? 'emailFb_partnerInstantSubj' : 'emailFb_partnerNewLeadSubj',
    lang,
    { listing },
  )
  const lines = [
    notifyEmailFallbackCopy('emailFb_greetingPartner', lang, {
      name: p.partnerName || notifyEmailFallbackCopy('emailFb_fallbackPartner', lang),
    }),
    '',
    notifyEmailFallbackCopy(
      instant ? 'emailFb_partnerInstantLead' : 'emailFb_partnerNewLeadLead',
      lang,
    ),
    '',
    notifyEmailFallbackCopy('emailFb_listingLine', lang, { listing }),
    notifyEmailFallbackCopy('emailFb_guestLine', lang, { guest: p.guestName || 'N/A' }),
    notifyEmailFallbackCopy('emailFb_datesLine', lang, {
      checkIn: p.checkIn,
      checkOut: p.checkOut,
    }),
    '',
    notifyEmailFallbackCopy('emailFb_amountLine', lang, { amount: p.totalAmount }),
    notifyEmailFallbackCopy('emailFb_commissionLine', lang, {
      rate: p.commissionRate,
      commission: p.commissionAmount,
    }),
    notifyEmailFallbackCopy('emailFb_earningsLine', lang, { earnings: p.partnerEarnings }),
  ]
  if (p.requestsNote) {
    lines.push('', notifyEmailFallbackCopy('emailFb_guestMessageLine', lang, { note: p.requestsNote }))
  }
  lines.push(
    '',
    notifyEmailFallbackCopy(
      instant ? 'emailFb_partnerInstantTail' : 'emailFb_partnerNewLeadTail',
      lang,
    ),
  )
  return { subject, body: lines.join('\n') }
}

/**
 * @param {string | null | undefined} lang
 * @param {Record<string, string | number | null | undefined>} p
 */
export function buildGuestBookingConfirmedFallback(lang, p) {
  const listing = String(p.listing || notifyEmailFallbackCopy('emailFb_fallbackListing', lang))
  const subject = notifyEmailFallbackCopy('emailFb_guestConfirmedSubj', lang, { listing })
  const body = [
    notifyEmailFallbackCopy('emailFb_greetingGuest', lang, {
      name: p.guestName || notifyEmailFallbackCopy('emailFb_fallbackGuest', lang),
    }),
    '',
    notifyEmailFallbackCopy('emailFb_guestConfirmedLead', lang),
    '',
    notifyEmailFallbackCopy('emailFb_listingLine', lang, { listing }),
    notifyEmailFallbackCopy('emailFb_datesLine', lang, {
      checkIn: p.checkIn,
      checkOut: p.checkOut,
    }),
    notifyEmailFallbackCopy('emailFb_payAmountLine', lang, { amount: p.amount }),
    '',
    emailFallbackEscrowLine(lang),
    '',
    String(p.payHint || ''),
    '',
    emailFallbackSignoff(lang),
  ].join('\n')
  return { subject, body }
}

/**
 * @param {string | null | undefined} lang
 * @param {Record<string, string | number | null | undefined>} p
 */
export function buildGuestPaymentFallback(lang, p) {
  const listing = String(p.listing || notifyEmailFallbackCopy('emailFb_fallbackListing', lang))
  const variant = p.variant === 'success' ? 'success' : 'confirmed'
  const subject = notifyEmailFallbackCopy(
    variant === 'success' ? 'emailFb_paymentSuccessSubj' : 'emailFb_paymentConfirmedSubj',
    lang,
    { listing },
  )
  const body = [
    notifyEmailFallbackCopy('emailFb_greetingGuest', lang, {
      name: p.guestName || notifyEmailFallbackCopy('emailFb_fallbackGuest', lang),
    }),
    '',
    notifyEmailFallbackCopy(
      variant === 'success' ? 'emailFb_paymentSuccessLead' : 'emailFb_paymentConfirmedLead',
      lang,
    ),
    '',
    notifyEmailFallbackCopy('emailFb_listingLine', lang, { listing }),
    ...(p.checkIn && p.checkOut
      ? [
          notifyEmailFallbackCopy('emailFb_datesLine', lang, {
            checkIn: p.checkIn,
            checkOut: p.checkOut,
          }),
        ]
      : []),
    notifyEmailFallbackCopy('emailFb_paymentAmountLine', lang, { amount: p.amount }),
    ...(p.method ? [notifyEmailFallbackCopy('emailFb_methodLine', lang, { method: p.method })] : []),
    ...(variant === 'success' ? [notifyEmailFallbackCopy('emailFb_paidStatus', lang)] : []),
    '',
    emailFallbackEscrowLine(lang),
    '',
    p.checkIn
      ? notifyEmailFallbackCopy('emailFb_seeYouLine', lang, { checkIn: p.checkIn })
      : '',
    '',
    emailFallbackSignoff(lang),
  ].join('\n')
  return { subject, body }
}
