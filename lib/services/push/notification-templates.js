/**
 * FCM title/body шаблоны по ключу (мультиязычие).
 * Stage 51.0: вынесено из push.service.js.
 */

export function normalizePushUiLang(raw) {
  const s = String(raw || 'ru').toLowerCase().replace(/_/g, '-')
  if (s.startsWith('zh')) return 'zh'
  if (s.startsWith('th')) return 'th'
  if (s.startsWith('en')) return 'en'
  return 'ru'
}

export function pickLocalizedTemplateStrings(template, lang) {
  const L = normalizePushUiLang(lang)
  if (L === 'en') {
    return { title: template.titleEn ?? template.title, body: template.bodyEn ?? template.body }
  }
  if (L === 'zh') {
    return {
      title: template.titleZh ?? template.titleEn ?? template.title,
      body: template.bodyZh ?? template.bodyEn ?? template.body,
    }
  }
  if (L === 'th') {
    return {
      title: template.titleTh ?? template.titleEn ?? template.title,
      body: template.bodyTh ?? template.bodyEn ?? template.body,
    }
  }
  return { title: template.title, body: template.body }
}

/** @type {Record<string, object>} */
export const NOTIFICATION_TEMPLATES = {
  NEW_MESSAGE: {
    title: '{sender}',
    titleEn: '{sender}',
    body: '{message}',
    bodyEn: '{message}',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'message',
    requireInteraction: false,
  },
  BOOKING_REQUEST: {
    title: '📋 Новая заявка на бронирование',
    titleEn: '📋 New booking request',
    body: 'Получена заявка на {listing} ({dates})',
    bodyEn: 'New booking request for {listing} ({dates})',
    icon: '/icons/icon-192x192.png',
    tag: 'booking',
    requireInteraction: true,
  },
  BOOKING_INSTANT_PARTNER: {
    title: '✅ Новое подтверждённое бронирование',
    titleEn: '✅ New confirmed booking',
    titleZh: '✅ 新的已确认预订',
    titleTh: '✅ การจองที่ยืนยันแล้ว',
    body: '{listing} · {dates} — бронь подтверждена (instant) · {siteName}',
    bodyEn: '{listing} · {dates} — booking confirmed (instant) · {siteName}',
    bodyZh: '{listing} · {dates} — 预订已确认（即时）· {siteName}',
    bodyTh: '{listing} · {dates} — การจองได้รับการยืนยัน (ทันที) · {siteName}',
    icon: '/icons/icon-192x192.png',
    tag: 'booking',
    requireInteraction: true,
  },
  FUNDS_THAWED_PARTNER: {
    title: '💸 Средства доступны к выводу',
    titleEn: '💸 Funds available for withdrawal',
    titleZh: '💸 资金可提现',
    titleTh: '💸 พร้อมถอนเงิน',
    body: 'Баланс пополнен на ฿{amount} (net по брони). Откройте «Финансы». · {siteName}',
    bodyEn: 'Your balance was credited ฿{amount} (net for this booking). Open Finances. · {siteName}',
    bodyZh: '余额已入账 ฿{amount}（本单净额）。打开「财务」。· {siteName}',
    bodyTh: 'ยอดเพิ่ม ฿{amount} (net ตามการจอง) เปิด «การเงิน» · {siteName}',
    icon: '/icons/icon-192x192.png',
    tag: 'payout',
    requireInteraction: true,
  },
  BOOKING_CONFIRMED: {
    title: '✅ Бронирование подтверждено',
    titleEn: '✅ Booking Confirmed',
    body: 'Ваше бронирование "{listing}" подтверждено',
    bodyEn: 'Your booking "{listing}" is confirmed',
    icon: '/icons/icon-192x192.png',
    tag: 'booking',
  },
  PAYMENT_RECEIVED: {
    title: '💰 Платёж получен',
    titleEn: '💰 Payment Received',
    body: 'Получен платёж ฿{amount} за {listing}',
    bodyEn: 'Payment received ฿{amount} for {listing}',
    icon: '/icons/icon-192x192.png',
    tag: 'payment',
  },
  CHECKIN_REMINDER: {
    title: '🔑 Подтвердите бронирование',
    titleEn: '🔑 Confirm your booking',
    body: 'Добро пожаловать! Подтвердите начало бронирования «{listing}»',
    bodyEn: 'Welcome! Please confirm your booking for "{listing}"',
    icon: '/icons/icon-192x192.png',
    tag: 'checkin',
    requireInteraction: true,
    actions: [
      { action: 'confirm', title: 'Подтвердить' },
      { action: 'help', title: 'Нужна помощь' },
    ],
  },
  REVIEW_REMINDER: {
    title: '⭐ Как прошло бронирование?',
    titleEn: '⭐ How was your booking?',
    body: 'Оставьте отзыв о «{listing}» — это помогает другим пользователям.',
    bodyEn: 'Leave a review for "{listing}" — it helps other travelers.',
    icon: '/icons/icon-192x192.png',
    tag: 'review',
    requireInteraction: false,
  },
  PAYOUT_READY: {
    title: '💸 Выплата готова',
    titleEn: '💸 Payout Ready',
    body: 'Ваши средства ฿{amount} разморожены и готовы к выплате',
    bodyEn: 'Your funds ฿{amount} are thawed and ready for payout',
    icon: '/icons/icon-192x192.png',
    tag: 'payout',
  },
  PARTNER_GUEST_REVIEW: {
    title: '⭐ Отзыв о клиенте',
    titleEn: '⭐ Review your client',
    titleZh: '⭐ 请评价客户',
    titleTh: '⭐ ให้คะแนนลูกค้า',
    body: '«{listing}» завершено. Клиент: {client}. · {siteName}',
    bodyEn: '"{listing}" has ended. Client: {client}. · {siteName}',
    bodyZh: '「{listing}」已结束。客户：{client}。· {siteName}',
    bodyTh: '«{listing}» สิ้นสุดแล้ว ลูกค้า: {client} · {siteName}',
    icon: '/icons/icon-192x192.png',
    tag: 'guest_review',
    requireInteraction: false,
  },
  SUPPORT_REQUESTED: {
    title: '🆘 Нужна помощь в чате',
    titleEn: '🆘 Support needed',
    body: 'Запрос поддержки в диалоге {conversationId}',
    bodyEn: 'Support requested in conversation {conversationId}',
    icon: '/icons/icon-192x192.png',
    tag: 'support_escalation',
    requireInteraction: true,
  },
  DISPUTE_OPENED: {
    title: '⚖️ Открыт спор по бронированию',
    titleEn: '⚖️ Dispute opened for booking',
    body: 'По вашему заказу открыт спор. Оплата приостановлена до выяснения обстоятельств.',
    bodyEn: 'A dispute has been opened for your booking. Payment is paused while we investigate.',
    icon: '/icons/icon-192x192.png',
    tag: 'booking_dispute',
    requireInteraction: true,
  },
  PARTNER_GUEST_HELP_NUDGE: {
    title: 'Клиент запрашивает помощь',
    titleEn: 'Client needs help',
    body: 'Решите вопрос в чате сейчас, чтобы избежать официального спора. {listing}',
    bodyEn: 'Resolve in chat now to avoid an official dispute. {listing}',
    icon: '/icons/icon-192x192.png',
    tag: 'guest_help_nudge',
    requireInteraction: true,
  },
  RENTER_EMERGENCY_CONTACT: {
    title: '🚨 Экстренная связь от арендатора',
    titleEn: '🚨 Emergency contact from renter',
    body: 'Арендатор нажал «Экстренная связь» по «{listing}». Проверьте чат и заказ.',
    bodyEn: 'Renter used Emergency contact for «{listing}». Check chat and booking.',
    icon: '/icons/icon-192x192.png',
    tag: 'emergency_partner_contact',
    requireInteraction: true,
  },
}
