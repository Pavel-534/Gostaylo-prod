/**
 * Stage 201.68 — partner listing moderation emails (premium HTML SSOT).
 * Uses premium-email-html chrome (logo lockup + theme tokens).
 */

import { getSiteDisplayName } from '@/lib/site-url.js'
import {
  premiumEmailDocument,
  emailTitleRow,
  emailContentParagraph,
  emailMutedBox,
  emailCtaStack,
  escapeHtml,
} from '@/lib/email/premium-email-html.js'
import { normalizeEmailLang } from '@/lib/email/booking-email-i18n.js'
import { theme } from '@/lib/theme/constants.js'

const { colors } = theme

/**
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @param {{ title?: string, reason?: string }} opts
 */
function listingModerationCopy(lang, { title, reason } = {}) {
  const brand = getSiteDisplayName()
  const listingTitle = String(title || '').trim() || '—'
  const reasonText = String(reason || '').trim()

  const pack = {
    ru: {
      approvedSubject: `Объявление одобрено: ${listingTitle}`,
      approvedPreheader: `Оно уже в каталоге ${brand}`,
      approvedTitle: 'Объявление одобрено',
      approvedBody: `Поздравляем! «${listingTitle}» прошло модерацию и опубликовано на ${brand}. Гости уже могут бронировать.`,
      approvedCta: 'Открыть объявления',
      approvedClosing: `С уважением,\nКоманда ${brand}`,
      rejectedSubject: `Объявление отклонено: ${listingTitle}`,
      rejectedPreheader: 'Исправьте замечания и отправьте снова',
      rejectedTitle: 'Объявление отклонено',
      rejectedBody: `К сожалению, «${listingTitle}» не прошло модерацию на ${brand}.`,
      rejectedReasonLabel: 'Причина',
      rejectedReasonFallback: 'Не указана',
      rejectedHint: 'Исправьте замечания в кабинете и снова отправьте объявление на модерацию.',
      rejectedCta: 'К объявлениям',
      rejectedClosing: `С уважением,\nКоманда ${brand}`,
    },
    en: {
      approvedSubject: `Listing approved: ${listingTitle}`,
      approvedPreheader: `It’s live in the ${brand} catalog`,
      approvedTitle: 'Listing approved',
      approvedBody: `Great news — “${listingTitle}” passed moderation and is published on ${brand}. Guests can book it now.`,
      approvedCta: 'Open listings',
      approvedClosing: `Best regards,\nThe ${brand} team`,
      rejectedSubject: `Listing rejected: ${listingTitle}`,
      rejectedPreheader: 'Fix the notes and resubmit',
      rejectedTitle: 'Listing rejected',
      rejectedBody: `Unfortunately, “${listingTitle}” did not pass moderation on ${brand}.`,
      rejectedReasonLabel: 'Reason',
      rejectedReasonFallback: 'Not specified',
      rejectedHint: 'Update the listing in your dashboard and submit it for moderation again.',
      rejectedCta: 'Go to listings',
      rejectedClosing: `Best regards,\nThe ${brand} team`,
    },
    zh: {
      approvedSubject: `上架已通过：${listingTitle}`,
      approvedPreheader: `已在 ${brand} 目录中展示`,
      approvedTitle: '上架已通过',
      approvedBody: `恭喜！「${listingTitle}」已通过审核并在 ${brand} 发布，客人现在可以预订。`,
      approvedCta: '查看上架',
      approvedClosing: `此致\n${brand} 团队`,
      rejectedSubject: `上架未通过：${listingTitle}`,
      rejectedPreheader: '请按意见修改后重新提交',
      rejectedTitle: '上架未通过',
      rejectedBody: `很抱歉，「${listingTitle}」未通过 ${brand} 审核。`,
      rejectedReasonLabel: '原因',
      rejectedReasonFallback: '未说明',
      rejectedHint: '请在合作伙伴中心修改后再次提交审核。',
      rejectedCta: '前往上架',
      rejectedClosing: `此致\n${brand} 团队`,
    },
    th: {
      approvedSubject: `อนุมัติรายการแล้ว: ${listingTitle}`,
      approvedPreheader: `ขึ้นแคตตาล็อก ${brand} แล้ว`,
      approvedTitle: 'อนุมัติรายการแล้ว',
      approvedBody: `ยินดีด้วย! «${listingTitle}» ผ่านการตรวจสอบและเผยแพร่บน ${brand} แล้ว ลูกค้าจองได้ทันที`,
      approvedCta: 'เปิดรายการ',
      approvedClosing: `ด้วยความนับถือ\nทีม ${brand}`,
      rejectedSubject: `รายการไม่ผ่าน: ${listingTitle}`,
      rejectedPreheader: 'แก้ตามเหตุผลแล้วส่งใหม่',
      rejectedTitle: 'รายการไม่ผ่าน',
      rejectedBody: `ขออภัย «${listingTitle}» ไม่ผ่านการตรวจสอบบน ${brand}`,
      rejectedReasonLabel: 'เหตุผล',
      rejectedReasonFallback: 'ไม่ระบุ',
      rejectedHint: 'แก้ไขในแดชบอร์ดแล้วส่งตรวจอีกครั้ง',
      rejectedCta: 'ไปที่รายการ',
      rejectedClosing: `ด้วยความนับถือ\nทีม ${brand}`,
    },
  }

  const t = pack[lang] || pack.en
  return { ...t, listingTitle, reasonText }
}

/**
 * @param {{ title?: string }} listing
 * @param {string} [lang]
 */
export function buildListingApprovedEmailTemplate(listing, lang = 'ru') {
  const L = normalizeEmailLang(lang)
  const t = listingModerationCopy(L, { title: listing?.title })
  const bodyRows =
    emailTitleRow(t.approvedTitle) +
    emailContentParagraph(escapeHtml(t.approvedBody)) +
    emailCtaStack({
      primary: { href: '/partner/listings', label: t.approvedCta },
    }) +
    emailContentParagraph(
      `<span style="color:${colors.muted};font-size:14px;white-space:pre-line;">${escapeHtml(t.approvedClosing)}</span>`,
    )

  return {
    subject: t.approvedSubject,
    html: premiumEmailDocument({ preheader: t.approvedPreheader, bodyRowsHtml: bodyRows }),
  }
}

/**
 * @param {{ title?: string }} listing
 * @param {string} [reason]
 * @param {string} [lang]
 */
export function buildListingRejectedEmailTemplate(listing, reason, lang = 'ru') {
  const L = normalizeEmailLang(lang)
  const t = listingModerationCopy(L, { title: listing?.title, reason })
  const reasonLine = t.reasonText || t.rejectedReasonFallback
  const bodyRows =
    emailTitleRow(t.rejectedTitle) +
    emailContentParagraph(escapeHtml(t.rejectedBody)) +
    emailMutedBox(
      `<strong>${escapeHtml(t.rejectedReasonLabel)}:</strong> ${escapeHtml(reasonLine)}`,
    ) +
    emailContentParagraph(escapeHtml(t.rejectedHint)) +
    emailCtaStack({
      primary: { href: '/partner/listings', label: t.rejectedCta },
    }) +
    emailContentParagraph(
      `<span style="color:${colors.muted};font-size:14px;white-space:pre-line;">${escapeHtml(t.rejectedClosing)}</span>`,
    )

  return {
    subject: t.rejectedSubject,
    html: premiumEmailDocument({ preheader: t.rejectedPreheader, bodyRowsHtml: bodyRows }),
  }
}
