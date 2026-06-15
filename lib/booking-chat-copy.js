/**
 * Тексты системных карточек в чате при смене статуса брони (партнёр → гость).
 */

import { getSiteDisplayName } from '@/lib/site-url'

export function bookingConfirmedCopy(lang) {
  if (lang === 'en') {
    return {
      title: 'Booking confirmed',
      body:
        'The host has confirmed your request. Next step: complete payment using the invoice in this chat or on your booking page.',
    }
  }
  return {
    title: 'Бронирование подтверждено',
    body:
      'Хозяин подтвердил ваш запрос. Следующий шаг — оплата по счёту в этом чате или на странице бронирования.',
  }
}

export function bookingDeclinedCopy(lang, reason) {
  const r = (reason || '').trim()
  if (lang === 'en') {
    const base = {
      title: 'Booking declined',
      body:
        'The host has declined this booking request. You can look for other dates or listings.',
    }
    if (r) {
      return {
        title: base.title,
        body: `${base.body}\n\nReason: ${r}`,
      }
    }
    return base
  }
  const base = {
    title: 'Бронирование отклонено',
    body:
      'Хозяин отклонил этот запрос. Вы можете выбрать другие даты или объявление.',
  }
  if (r) {
    return {
      title: base.title,
      body: `${base.body}\n\nПричина: ${r}`,
    }
  }
  return base
}

/** Пресеты причины отказа (ключ → строка для гостя и для UI модалки). */
export const DECLINE_REASON_PRESETS = {
  occupied: {
    ru: 'Объект занят на ваши даты',
    en: 'The property is not available for these dates',
  },
  repair: {
    ru: 'Ремонт / технические работы',
    en: 'Maintenance or repairs in progress',
  },
  other: {
    ru: 'Другое',
    en: 'Other',
  },
}

/**
 * Одна строка причины для текста системного сообщения (RU/EN в одной карточке храним оба заголовка).
 */
export function declineReasonLineFromPreset(lang, key, detail) {
  const d = (detail || '').trim()
  if (key === 'other') return d || (lang === 'en' ? DECLINE_REASON_PRESETS.other.en : DECLINE_REASON_PRESETS.other.ru)
  if (key && DECLINE_REASON_PRESETS[key]) {
    return lang === 'en' ? DECLINE_REASON_PRESETS[key].en : DECLINE_REASON_PRESETS[key].ru
  }
  return d
}

/**
 * Пара title/body для EN-метаданных карточки (и дублируем RU в announcement_*).
 */
export function bookingDeclinedCopyFromPreset(declineReasonKey, declineReasonDetail) {
  const lineRu = declineReasonLineFromPreset('ru', declineReasonKey, declineReasonDetail)
  const lineEn = declineReasonLineFromPreset('en', declineReasonKey, declineReasonDetail)
  const ru = bookingDeclinedCopy('ru', lineRu)
  const en = bookingDeclinedCopy('en', lineEn)
  return {
    announcement_title: ru.title,
    announcement_body: ru.body,
    announcement_title_en: en.title,
    announcement_body_en: en.body,
  }
}

/**
 * Универсальная карточка смены статуса (когда это не confirm/decline из запроса).
 */
export function bookingStatusUpdateCopy(previousStatus, newStatus) {
  const prev = String(previousStatus || '').toUpperCase()
  const next = String(newStatus || '').toUpperCase()

  const map = {
    PAID: {
      titleRu: 'Оплата получена',
      bodyRu: 'Бронирование оплачено. Дальше — заезд в согласованные даты. Детали в личном кабинете.',
      titleEn: 'Payment received',
      bodyEn: 'Your booking is paid. Next: check-in on the agreed dates. See your dashboard for details.',
      accent: 'info',
    },
    PAID_ESCROW: {
      titleRu: 'Оплата получена',
      bodyRu: 'Платёж подтверждён, средства зарезервированы.',
      titleEn: 'Payment secured',
      bodyEn: 'Payment confirmed; funds are held in escrow.',
      accent: 'info',
    },
    COMPLETED: {
      titleRu: 'Проживание завершено',
      bodyRu: `Бронирование завершено. Спасибо, что выбрали ${getSiteDisplayName()}! Оставьте отзыв — это помогает другим гостям и улучшает сервис.`,
      titleEn: 'Stay completed',
      bodyEn: `This booking is completed. Thank you for staying with ${getSiteDisplayName()}! Leave a review — it helps other guests and improves service.`,
      accent: 'info',
    },
    REFUNDED: {
      titleRu: 'Возврат средств',
      bodyRu: 'По бронированию оформлен возврат.',
      titleEn: 'Refund processed',
      bodyEn: 'A refund has been processed for this booking.',
      accent: 'danger',
    },
    CANCELLED: {
      titleRu: 'Бронирование отменено',
      bodyRu: 'Статус бронирования изменён на «Отменено».',
      titleEn: 'Booking cancelled',
      bodyEn: 'The booking status was updated to cancelled.',
      accent: 'danger',
    },
    CONFIRMED: {
      titleRu: 'Бронирование подтверждено',
      bodyRu: 'Статус обновлён: подтверждено.',
      titleEn: 'Booking confirmed',
      bodyEn: 'Status updated: confirmed.',
      accent: 'success',
    },
  }

  const row = map[next]
  if (row) {
    return {
      system_key: 'booking_status_update',
      accent: row.accent,
      announcement_title: row.titleRu,
      announcement_body: row.bodyRu,
      announcement_title_en: row.titleEn,
      announcement_body_en: row.bodyEn,
      previous_status: prev,
      new_status: next,
    }
  }

  return {
    system_key: 'booking_status_update',
    accent: 'info',
    announcement_title: 'Обновление бронирования',
    announcement_body: `Статус изменён: ${prev || '—'} → ${next}.`,
    announcement_title_en: 'Booking update',
    announcement_body_en: `Status changed: ${prev || '—'} → ${next}.`,
    previous_status: prev,
    new_status: next,
  }
}

/**
 * Собрать метаданные системного сообщения для синка статуса.
 */
export function buildBookingStatusChatPayload({
  previousStatus,
  newStatus,
  declineReasonKey,
  declineReasonDetail,
  reasonFreeText,
}) {
  const prev = String(previousStatus || '').toUpperCase()
  const next = String(newStatus || '').toUpperCase()

  if ((prev === 'PENDING' || prev === 'INQUIRY') && next === 'CONFIRMED') {
    const ru = bookingConfirmedCopy('ru')
    const en = bookingConfirmedCopy('en')
    return {
      system_key: 'booking_confirmed',
      accent: 'success',
      booking_announcement: true,
      announcement_title: ru.title,
      announcement_body: ru.body,
      announcement_title_en: en.title,
      announcement_body_en: en.body,
      previous_status: prev,
      new_status: next,
    }
  }

  if ((prev === 'PENDING' || prev === 'INQUIRY') && next === 'CANCELLED') {
    let lineSource
    if (!declineReasonKey && !declineReasonDetail && !(reasonFreeText || '').trim()) {
      const ru = bookingDeclinedCopy('ru', '')
      const en = bookingDeclinedCopy('en', '')
      lineSource = {
        announcement_title: ru.title,
        announcement_body: ru.body,
        announcement_title_en: en.title,
        announcement_body_en: en.body,
      }
    } else {
      lineSource = bookingDeclinedCopyFromPreset(
        declineReasonKey || 'other',
        declineReasonDetail || reasonFreeText || ''
      )
    }
    return {
      system_key: 'booking_declined',
      accent: 'danger',
      booking_announcement: true,
      announcement_title: lineSource.announcement_title,
      announcement_body: lineSource.announcement_body,
      announcement_title_en: lineSource.announcement_title_en,
      announcement_body_en: lineSource.announcement_body_en,
      decline_reason_key: declineReasonKey || null,
      previous_status: prev,
      new_status: next,
    }
  }

  const generic = bookingStatusUpdateCopy(prev, next)
  return {
    ...generic,
    booking_announcement: true,
    previous_status: prev,
    new_status: next,
  }
}

// ─── Stage 147: dispute & support milestones (RU / EN / ZH / TH) ───────────────

function normalizeChatLang(lang) {
  const l = String(lang || 'ru').toLowerCase().slice(0, 2)
  if (l === 'en' || l === 'zh' || l === 'th') return l
  return 'ru'
}

function formatDeadlineLabel(iso, lang) {
  if (!iso) return lang === 'en' ? 'see chat' : lang === 'zh' ? '见聊天' : lang === 'th' ? 'ดูในแชท' : 'см. чат'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(
      lang === 'ru' ? 'ru-RU' : lang === 'zh' ? 'zh-CN' : lang === 'th' ? 'th-TH' : 'en-US',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    )
  } catch {
    return iso
  }
}

function buildAnnouncementLocales(copies) {
  return {
    announcement_title: copies.ru.title,
    announcement_body: copies.ru.body,
    announcement_title_en: copies.en.title,
    announcement_body_en: copies.en.body,
    announcement_title_zh: copies.zh.title,
    announcement_body_zh: copies.zh.body,
    announcement_title_th: copies.th.title,
    announcement_body_th: copies.th.body,
    booking_announcement: true,
  }
}

/**
 * @param {object} opts
 * @param {string} opts.bookingId
 * @param {string} [opts.orderAmount] — guest payment label, e.g. "45 000 ₽"
 * @param {number} [opts.holdAmountThb] — partner hold (internal)
 * @param {string} [opts.deadlineAt]
 * @param {string} [opts.reasonText]
 */
export function disputeOpenedChatCopy(opts = {}) {
  const bookingId = String(opts.bookingId || '').trim() || '—'
  const orderAmount = String(opts.orderAmount || '').trim() || '—'
  const holdThb = Number(opts.holdAmountThb)
  const holdLine =
    Number.isFinite(holdThb) && holdThb > 0
      ? {
          ru: `\n\nВнутренний учёт платформы: ${Math.round(holdThb).toLocaleString('ru-RU')} THB.`,
          en: `\n\nPlatform ledger reference: ${Math.round(holdThb).toLocaleString('en-US')} THB.`,
          zh: `\n\n平台内部记账：${Math.round(holdThb).toLocaleString('zh-CN')} THB。`,
          th: `\n\nบัญชีภายในแพลตฟอร์ม: ${Math.round(holdThb).toLocaleString('th-TH')} THB`,
        }
      : { ru: '', en: '', zh: '', th: '' }

  const reason = String(opts.reasonText || '').trim()
  const reasonBlock = reason
    ? {
        ru: `\n\nКомментарий: ${reason}`,
        en: `\n\nComment: ${reason}`,
        zh: `\n\n备注：${reason}`,
        th: `\n\nความคิดเห็น: ${reason}`,
      }
    : { ru: '', en: '', zh: '', th: '' }

  const deadlineRu = formatDeadlineLabel(opts.deadlineAt, 'ru')
  const deadlineEn = formatDeadlineLabel(opts.deadlineAt, 'en')
  const deadlineZh = formatDeadlineLabel(opts.deadlineAt, 'zh')
  const deadlineTh = formatDeadlineLabel(opts.deadlineAt, 'th')

  return {
    ru: {
      title: 'Официальный спор открыт',
      body:
        `Мы начали разбор по заказу ${bookingId}. Оплата по заказу (${orderAmount}) временно удержана на защищённом эскроу до решения спора. Срок ответа сторон: до ${deadlineRu}.` +
        reasonBlock.ru +
        holdLine.ru,
    },
    en: {
      title: 'Official dispute opened',
      body:
        `We opened a case for booking ${bookingId}. Your order payment (${orderAmount}) is temporarily held in escrow until the dispute is resolved. Response deadline: ${deadlineEn}.` +
        reasonBlock.en +
        holdLine.en,
    },
    zh: {
      title: '已开启正式争议',
      body:
        `我们已对订单 ${bookingId} 开启争议处理。您的订单付款（${orderAmount}）将暂时托管在受保护的 escrow 账户中，直至争议解决。回复截止：${deadlineZh}。` +
        reasonBlock.zh +
        holdLine.zh,
    },
    th: {
      title: 'เปิดข้อพิพาทอย่างเป็นทางการ',
      body:
        `เราได้เปิดคดีสำหรับการจอง ${bookingId} การชำระเงินของคุณ (${orderAmount}) จะถูกระงับไว้ใน escrow ที่ปลอดภัยจนกว่าจะมีการแก้ไขข้อพิพาท กำหนดตอบกลับ: ${deadlineTh}` +
        reasonBlock.th +
        holdLine.th,
    },
  }
}

/**
 * @param {object} opts
 * @param {string} opts.bookingId
 * @param {number} [opts.mediationMinutes]
 */
export function disputeMediationStartedChatCopy(opts = {}) {
  const bookingId = String(opts.bookingId || '').trim() || '—'
  const mins = Math.max(1, Math.round(Number(opts.mediationMinutes) || 60))

  return {
    ru: {
      title: 'Окно медиации',
      body: `По заказу ${bookingId} начат этап медиации (${mins} мин). Попробуйте договориться в этом чате. После окончания окна можно открыть официальный спор — тогда средства будут заморожены до решения.`,
    },
    en: {
      title: 'Mediation window',
      body: `A ${mins}-minute mediation period has started for booking ${bookingId}. Try to resolve the issue here in chat. After it ends, you may open an official dispute — funds will then be held until resolution.`,
    },
    zh: {
      title: '调解窗口期',
      body: `订单 ${bookingId} 已进入 ${mins} 分钟调解期。请在此聊天中协商解决。期满后如仍未解决，可开启正式争议，届时资金将冻结直至裁决。`,
    },
    th: {
      title: 'ช่วงไกล่เกลี่ย',
      body: `การจอง ${bookingId} อยู่ในช่วงไกล่เกลี่ย ${mins} นาที ลองแก้ไขในแชทนี้ หลังหมดเวลาสามารถเปิดข้อพิพาทอย่างเป็นทางการ — เงินจะถูกระงับจนกว่าจะมีมติ`,
    },
  }
}

/**
 * @param {object} opts
 * @param {string} opts.adminName
 * @param {boolean} [opts.forDispute]
 */
export function supportJoinedChatCopy(opts = {}) {
  const name = String(opts.adminName || '').trim() || 'Support'
  const dispute = opts.forDispute === true

  if (dispute) {
    return {
      ru: {
        title: 'Поддержка подключилась',
        body: `Администратор ${name} подключился к диалогу для помощи в разрешении спора.`,
      },
      en: {
        title: 'Support joined',
        body: `Administrator ${name} has joined this conversation to help resolve the dispute.`,
      },
      zh: {
        title: '客服已加入',
        body: `管理员 ${name} 已加入对话，协助处理争议。`,
      },
      th: {
        title: 'ทีมสนับสนุนเข้าร่วม',
        body: `ผู้ดูแล ${name} เข้าร่วมแชทเพื่อช่วยแก้ไขข้อพิพาท`,
      },
    }
  }

  return {
    ru: {
      title: 'Поддержка подключилась',
      body: `Администратор ${name} подключился к диалогу для помощи в разрешении вопроса.`,
    },
    en: {
      title: 'Support joined',
      body: `Administrator ${name} has joined this conversation to help resolve the issue.`,
    },
    zh: {
      title: '客服已加入',
      body: `管理员 ${name} 已加入对话，协助处理问题。`,
    },
    th: {
      title: 'ทีมสนับสนุนเข้าร่วม',
      body: `ผู้ดูแล ${name} เข้าร่วมแชทเพื่อช่วยแก้ไขปัญหา`,
    },
  }
}

/**
 * @param {object} copies — { ru, en, zh, th } each { title, body }
 * @param {string} [lang]
 */
export function resolveAnnouncementText(copies, lang = 'ru') {
  const l = normalizeChatLang(lang)
  const row = copies[l] || copies.ru
  return {
    title: row?.title || '',
    body: row?.body || '',
  }
}

/**
 * @param {object} opts
 * @param {string} opts.disputeId
 * @param {string} opts.bookingId
 * @param {string} [opts.orderAmount]
 * @param {number} [opts.holdAmountThb]
 * @param {string} [opts.deadlineAt]
 * @param {string} [opts.reasonText]
 */
export function buildDisputeOpenedChatPayload(opts = {}) {
  const copies = disputeOpenedChatCopy(opts)
  const ru = copies.ru
  return {
    system_key: 'dispute_opened',
    accent: 'warning',
    dispute_id: opts.disputeId ?? null,
    booking_id: opts.bookingId ?? null,
    hold_amount_thb: opts.holdAmountThb ?? null,
    guest_display_amount: opts.orderAmount ?? null,
    dispute_reason: opts.reasonText ?? null,
    ...buildAnnouncementLocales(copies),
    announcement_title: ru.title,
    announcement_body: ru.body,
  }
}

/**
 * @param {object} opts
 * @param {string} opts.disputeId
 * @param {string} opts.bookingId
 * @param {number} [opts.mediationMinutes]
 */
export function buildDisputeMediationStartedChatPayload(opts = {}) {
  const copies = disputeMediationStartedChatCopy(opts)
  const ru = copies.ru
  return {
    system_key: 'dispute_mediation_started',
    accent: 'info',
    dispute_id: opts.disputeId ?? null,
    booking_id: opts.bookingId ?? null,
    ...buildAnnouncementLocales(copies),
    announcement_title: ru.title,
    announcement_body: ru.body,
  }
}

/**
 * @param {object} opts
 * @param {string} opts.adminName
 * @param {boolean} [opts.forDispute]
 */
export function buildSupportJoinedChatPayload(opts = {}) {
  const copies = supportJoinedChatCopy(opts)
  const ru = copies.ru
  return {
    system_key: 'support_joined',
    accent: 'info',
    admin_name: opts.adminName ?? null,
    ...buildAnnouncementLocales(copies),
    announcement_title: ru.title,
    announcement_body: ru.body,
  }
}

/**
 * Default RU content string for messages.content (legacy readers).
 * @param {object} payload — from buildDispute* / buildSupportJoined*
 */
export function formatChatAnnouncementContent(payload) {
  const title = payload?.announcement_title || ''
  const body = payload?.announcement_body || ''
  return `${title}\n\n${body}`.trim()
}
