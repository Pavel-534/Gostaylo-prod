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
      bodyRu: `Бронирование завершено. Спасибо, что выбрали ${getSiteDisplayName()}!`,
      titleEn: 'Stay completed',
      bodyEn: `This booking is completed. Thank you for staying with ${getSiteDisplayName()}!`,
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
