/**
 * Stage 144 — SSOT plain-text / HTML Telegram copy for outbound notifications (ru/en/zh/th).
 */
import { normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver.js'
import { getSiteDisplayName } from '@/lib/site-url.js'

/** @type {Record<string, Record<string, string>>} */
const COPY = {
  ru: {
    notifyTg_escrowSecurity:
      '🔒 Ваши средства защищены системой Эскроу {brand} и выплачиваются владельцу только после подтверждения заселения.',
    notifyTg_paymentReceivedTitle: '💰 <b>Оплата получена!</b>',
    notifyTg_paymentConfirmedTitle: '✅ <b>Оплата подтверждена!</b>',
    notifyTg_paymentPendingTitle: '⏳ <b>Оплата на проверке</b>',
    notifyTg_paymentPendingHint:
      '<i>Платёж проходит верификацию. Уведомим, когда будет подтверждён.</i>',
    notifyTg_bookingConfirmedTitle: '✅ <b>Ваша бронь подтверждена.</b>',
    notifyTg_bookingConfirmedPayHint:
      'Ваша бронь подтверждена. Перейдите к оплате или в чат:\n{checkoutUrl}',
    notifyTg_bookingCancelledTitle: '❌ <b>Бронирование отменено</b>',
    notifyTg_bookingCancelledBody: 'К сожалению, ваше бронирование было отменено.',
    notifyTg_bookingCancelledReason: 'Причина: {reason}',
    notifyTg_checkInConfirmedTitle: '✅ <b>Заселение подтверждено!</b>',
    notifyTg_checkInConfirmedFunds: '💸 Средства переведены на ваш баланс',
    notifyTg_reviewReminderHelp: 'Это помогает другим клиентам.',
    notifyTg_myBookings: 'Мои бронирования',
    notifyTg_openCase: 'Открыть кейс',
    notifyTg_guestLabel: 'Гость',
    notifyTg_listingFallback: 'Объект',
    notifyTg_newBookingTitle: 'Новое бронирование: {listing}',
    notifyTg_amountLine: 'Сумма: {amount}',
    notifyTg_commissionLine: 'Комиссия: {rate}% (฿{amount})',
    notifyTg_partnerEarnings: 'Ваш доход: ฿{amount}',
    notifyTg_guestMessage: 'Сообщение:',
    notifyTg_bookingApprove: '✅ Подтвердить',
    notifyTg_bookingDecline: '❌ Отклонить',
    notifyTg_openInApp: '📱 Открыть в приложении',
    notifyTg_reasonUnknown: 'Не указана',
  },
  en: {
    notifyTg_escrowSecurity:
      '🔒 Your funds are protected by {brand} Escrow and released to the partner only after check-in is confirmed.',
    notifyTg_paymentReceivedTitle: '💰 <b>Payment received!</b>',
    notifyTg_paymentConfirmedTitle: '✅ <b>Payment confirmed!</b>',
    notifyTg_paymentPendingTitle: '⏳ <b>Payment under review</b>',
    notifyTg_paymentPendingHint:
      '<i>Payment is being verified. We will notify you when it is confirmed.</i>',
    notifyTg_bookingConfirmedTitle: '✅ <b>Your booking is confirmed.</b>',
    notifyTg_bookingConfirmedPayHint:
      'Your booking is confirmed. Proceed to payment or chat:\n{checkoutUrl}',
    notifyTg_bookingCancelledTitle: '❌ <b>Booking cancelled</b>',
    notifyTg_bookingCancelledBody: 'Unfortunately, your booking was cancelled.',
    notifyTg_bookingCancelledReason: 'Reason: {reason}',
    notifyTg_checkInConfirmedTitle: '✅ <b>Check-in confirmed!</b>',
    notifyTg_checkInConfirmedFunds: '💸 Funds have been credited to your balance',
    notifyTg_reviewReminderHelp: 'This helps other clients.',
    notifyTg_myBookings: 'My bookings',
    notifyTg_openCase: 'Open case',
    notifyTg_guestLabel: 'Guest',
    notifyTg_listingFallback: 'Listing',
    notifyTg_newBookingTitle: 'New booking: {listing}',
    notifyTg_amountLine: 'Amount: {amount}',
    notifyTg_commissionLine: 'Commission: {rate}% (฿{amount})',
    notifyTg_partnerEarnings: 'Your earnings: ฿{amount}',
    notifyTg_guestMessage: 'Message:',
    notifyTg_bookingApprove: '✅ Confirm',
    notifyTg_bookingDecline: '❌ Decline',
    notifyTg_openInApp: '📱 Open in app',
    notifyTg_reasonUnknown: 'Not specified',
  },
  zh: {
    notifyTg_escrowSecurity: '🔒 您的资金受 {brand} 托管保护，仅在确认入住后才会释放给合作伙伴。',
    notifyTg_paymentReceivedTitle: '💰 <b>已收到付款！</b>',
    notifyTg_paymentConfirmedTitle: '✅ <b>付款已确认！</b>',
    notifyTg_paymentPendingTitle: '⏳ <b>付款审核中</b>',
    notifyTg_paymentPendingHint: '<i>付款正在验证中，确认后我们会通知您。</i>',
    notifyTg_bookingConfirmedTitle: '✅ <b>您的预订已确认。</b>',
    notifyTg_bookingConfirmedPayHint: '预订已确认。请前往付款或聊天：\n{checkoutUrl}',
    notifyTg_bookingCancelledTitle: '❌ <b>预订已取消</b>',
    notifyTg_bookingCancelledBody: '很抱歉，您的预订已被取消。',
    notifyTg_bookingCancelledReason: '原因：{reason}',
    notifyTg_checkInConfirmedTitle: '✅ <b>入住已确认！</b>',
    notifyTg_checkInConfirmedFunds: '💸 资金已计入您的余额',
    notifyTg_reviewReminderHelp: '这有助于其他客户。',
    notifyTg_myBookings: '我的预订',
    notifyTg_openCase: '打开争议',
    notifyTg_guestLabel: '客人',
    notifyTg_listingFallback: '房源',
    notifyTg_newBookingTitle: '新预订：{listing}',
    notifyTg_amountLine: '金额：{amount}',
    notifyTg_commissionLine: '佣金：{rate}% (฿{amount})',
    notifyTg_partnerEarnings: '您的收入：฿{amount}',
    notifyTg_guestMessage: '留言：',
    notifyTg_bookingApprove: '✅ 确认',
    notifyTg_bookingDecline: '❌ 拒绝',
    notifyTg_openInApp: '📱 在应用中打开',
    notifyTg_reasonUnknown: '未说明',
  },
  th: {
    notifyTg_escrowSecurity:
      '🔒 เงินของคุณได้รับการคุ้มครองด้วย Escrow ของ {brand} และจะจ่ายให้พาร์ทเนอร์หลังยืนยันเช็กอินเท่านั้น',
    notifyTg_paymentReceivedTitle: '💰 <b>ได้รับการชำระเงินแล้ว!</b>',
    notifyTg_paymentConfirmedTitle: '✅ <b>ยืนยันการชำระเงินแล้ว!</b>',
    notifyTg_paymentPendingTitle: '⏳ <b>กำลังตรวจสอบการชำระเงิน</b>',
    notifyTg_paymentPendingHint: '<i>กำลังตรวจสอบการชำระเงิน เราจะแจ้งเมื่อยืนยันแล้ว</i>',
    notifyTg_bookingConfirmedTitle: '✅ <b>การจองของคุณได้รับการยืนยันแล้ว</b>',
    notifyTg_bookingConfirmedPayHint: 'การจองได้รับการยืนยันแล้ว ไปชำระเงินหรือแชท:\n{checkoutUrl}',
    notifyTg_bookingCancelledTitle: '❌ <b>ยกเลิกการจอง</b>',
    notifyTg_bookingCancelledBody: 'ขออภัย การจองของคุณถูกยกเลิก',
    notifyTg_bookingCancelledReason: 'เหตุผล: {reason}',
    notifyTg_checkInConfirmedTitle: '✅ <b>ยืนยันเช็กอินแล้ว!</b>',
    notifyTg_checkInConfirmedFunds: '💸 โอนเงินเข้ายอดคงเหลือของคุณแล้ว',
    notifyTg_reviewReminderHelp: 'ช่วยให้ลูกค้าคนอื่นตัดสินใจได้ดีขึ้น',
    notifyTg_myBookings: 'การจองของฉัน',
    notifyTg_openCase: 'เปิดเคส',
    notifyTg_guestLabel: 'ผู้เช่า',
    notifyTg_listingFallback: 'ประกาศ',
    notifyTg_newBookingTitle: 'การจองใหม่: {listing}',
    notifyTg_amountLine: 'จำนวน: {amount}',
    notifyTg_commissionLine: 'ค่าคอมมิชชัน: {rate}% (฿{amount})',
    notifyTg_partnerEarnings: 'รายได้ของคุณ: ฿{amount}',
    notifyTg_guestMessage: 'ข้อความ:',
    notifyTg_bookingApprove: '✅ ยืนยัน',
    notifyTg_bookingDecline: '❌ ปฏิเสธ',
    notifyTg_openInApp: '📱 เปิดในแอป',
    notifyTg_reasonUnknown: 'ไม่ระบุ',
  },
}

/**
 * @param {string} key
 * @param {string | null | undefined} lang
 * @param {Record<string, string | number | null | undefined>} [params]
 */
export function notifyTelegramCopy(key, lang, params = {}) {
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
export function escrowCheckInSecurityMessage(lang) {
  return notifyTelegramCopy('notifyTg_escrowSecurity', lang)
}
