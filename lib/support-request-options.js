/**
 * Варианты формы «Помощь» (эскалация в поддержку).
 * slug → подписи для UI и для текста сообщения в чате.
 */

export const SUPPORT_REASONS = [
  { slug: 'payment', labelRu: 'Оплата или счёт', labelEn: 'Payment or invoice' },
  { slug: 'booking_terms', labelRu: 'Даты, отмена, условия брони', labelEn: 'Dates, cancellation, booking terms' },
  { slug: 'listing_issue', labelRu: 'Объявление не соответствует реальности', labelEn: 'Listing does not match reality' },
  { slug: 'partner_conduct', labelRu: 'Поведение партнёра / хозяина', labelEn: 'Host / partner conduct' },
  { slug: 'guest_conduct', labelRu: 'Поведение гостя', labelEn: 'Guest conduct' },
  { slug: 'technical', labelRu: 'Сбой сайта или приложения', labelEn: 'Website / app issue' },
  { slug: 'other', labelRu: 'Другое', labelEn: 'Other' },
]

export const SUPPORT_DISPUTE_KINDS = [
  { slug: 'mediation', labelRu: 'Нужно вмешательство поддержки', labelEn: 'Need platform mediation' },
  { slug: 'rules', labelRu: 'Нужно разъяснить правила', labelEn: 'Need rules clarification' },
  { slug: 'money', labelRu: 'Спор по деньгам / возврату', labelEn: 'Money / refund dispute' },
  { slug: 'documents', labelRu: 'Документы, верификация', labelEn: 'Documents / verification' },
  { slug: 'communication', labelRu: 'Нет ответа / задержки в чате', labelEn: 'No reply / delays in chat' },
  { slug: 'other', labelRu: 'Другое', labelEn: 'Other' },
]

export function labelForSlug(list, slug, lang) {
  const row = list.find((x) => x.slug === slug)
  if (!row) return slug
  return lang === 'en' ? row.labelEn : row.labelRu
}

export function buildSupportTicketMessage(ticket, lang) {
  const reason = labelForSlug(SUPPORT_REASONS, ticket.category, lang)
  const dispute = labelForSlug(SUPPORT_DISPUTE_KINDS, ticket.disputeType, lang)
  const details = (ticket.details || '').trim() || (lang === 'en' ? '—' : '—')
  if (lang === 'en') {
    return [
      '🆘 Support request',
      `Topic: ${reason}`,
      `What’s wrong: ${dispute}`,
      `Details: ${details}`,
    ].join('\n')
  }
  return [
    '🆘 Запрос в поддержку',
    `Причина обращения: ${reason}`,
    `В чём спор / что нужно: ${dispute}`,
    `Комментарий: ${details}`,
  ].join('\n')
}
