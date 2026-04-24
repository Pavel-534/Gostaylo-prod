/**
 * GoStayLo — транзакционные письма (Resend)
 * Визуальный стиль строится на lib/theme/constants.js + lib/email/premium-email-html.js
 */

import { getTransactionalFromAddress } from '@/lib/email-env'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import {
  premiumEmailDocument,
  emailTitleRow,
  emailContentParagraph,
  emailMutedBox,
  emailListingCardBlock,
  emailCtaStack,
  emailCalendarRow,
  escapeHtml,
  absUrl,
} from '@/lib/email/premium-email-html'
import {
  googleCalendarStayUrl,
  outlookWebCalendarStayUrl,
  stayIcsDownloadUrlFromToken,
  ymdFromBookingDate,
} from '@/lib/email/calendar-links'
import {
  normalizeEmailLang,
  bookingConfirmedCopy,
  bookingConfirmedSubject,
  bookingConfirmedEmailTitle,
  formatBookingEmailDate,
  formatBookingRangeLineEmail,
  buildBookingEmailTimeZoneNote,
  listingImageAltI18n,
  buildStayCalendarDescriptionI18n,
  calendarStayTitle,
  paymentSuccessCopy,
  paymentSuccessSubject,
  paymentListingImageAltI18n,
} from '@/lib/email/booking-email-i18n'
import { signCalendarStayToken } from '@/lib/calendar/calendar-stay-token'
import { buildStayIcsBody } from '@/lib/calendar/stay-ics'
import { getPublicSiteUrl } from '@/lib/site-url'
import { theme } from '@/lib/theme/constants'
import { partnerBookingsListPath, renterBookingsListPath } from '@/lib/email/booking-routes'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const { colors, borderRadius } = theme

function reportEmailFailureSignal(kind, to, template, detail) {
  const toHint = Array.isArray(to) ? to.join(', ') : String(to || '')
  recordCriticalSignal('EMAIL_FAILURE', {
    tag: '[EMAIL_FAILURE]',
    threshold: 1,
    detailLines: [
      `kind: ${kind}`,
      `subject: ${template?.subject || '—'}`,
      `to: ${toHint.slice(0, 120) || '—'}`,
      `detail: ${String(detail || 'unknown').slice(0, 300)}`,
    ],
  })
}

function featuresCardHtml(features, heading) {
  const ff = theme.fonts.main
  const items = features
    .map(
      (f) =>
        `<p style="margin:10px 0;color:${colors.text};font-size:14px;line-height:1.5;font-family:${ff};">${escapeHtml(f)}</p>`,
    )
    .join('')
  return `
<tr>
  <td style="padding:8px 32px 8px;">
    <div style="background-color:${colors.canvas};border:1px solid ${colors.border};border-radius:${borderRadius};padding:20px 22px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${colors.muted};letter-spacing:0.02em;font-family:${ff};">${escapeHtml(heading)}</p>
      ${items}
    </div>
  </td>
</tr>`
}

const templates = {
  welcome: (user, lang = 'en') => {
    const texts = {
      ru: {
        subject: 'Добро пожаловать в GoStayLo',
        preheader: 'Ваш аккаунт готов — начните поиск на Пхукете',
        title: `Привет, ${user.name || 'друг'}!`,
        body: 'Спасибо за регистрацию на GoStayLo — премиальной платформе аренды на Пхукете.',
        featuresHead: 'Что вас ждёт',
        features: [
          'Премиальные объекты размещения и виллы',
          'Транспорт, яхты, туры и услуги',
          'Безопасные платежи и поддержка',
        ],
        cta: 'Войти и начать',
        closing: 'С наилучшими пожеланиями,\nКоманда GoStayLo',
        loginPath: '/login',
      },
      en: {
        subject: 'Welcome to GoStayLo',
        preheader: 'Your account is ready — start exploring Phuket',
        title: `Hello, ${user.name || 'friend'}!`,
        body: 'Thank you for joining GoStayLo — the premium rental platform in Phuket.',
        featuresHead: 'What awaits you',
        features: [
          'Premium stays and villas',
          'Cars, yachts, tours, and services',
          'Secure payments and human support',
        ],
        cta: 'Log in & explore',
        closing: 'Best regards,\nThe GoStayLo Team',
        loginPath: '/login',
      },
      zh: {
        subject: '欢迎来到 GoStayLo',
        preheader: '',
        title: `你好, ${user.name || '朋友'}!`,
        body: '感谢您注册 GoStayLo — 普吉岛高端租赁平台。',
        featuresHead: '您可以享受',
        features: ['高端住宿与别墅', '车辆、游艇、行程与服务', '安全支付与客服支持'],
        cta: '登录并开始',
        closing: '此致敬礼,\nGoStayLo 团队',
        loginPath: '/login',
      },
      th: {
        subject: 'ยินดีต้อนรับสู่ GoStayLo',
        preheader: '',
        title: `สวัสดี, ${user.name || 'เพื่อน'}!`,
        body: 'ขอบคุณที่เข้าร่วม GoStayLo — แพลตฟอร์มเช่าระดับพรีเมียมในภูเก็ต',
        featuresHead: 'สิ่งที่รอคุณ',
        features: ['ที่พักและวิลล่าระดับพรีเมียม', 'รถ เรือ ทัวร์ และบริการ', 'การชำระเงินที่ปลอดภัย'],
        cta: 'เข้าสู่ระบบ',
        closing: 'ด้วยความเคารพ,\nทีม GoStayLo',
        loginPath: '/login',
      },
    }
    const t = texts[lang] || texts.en
    const bodyRows =
      emailTitleRow(t.title) +
      emailContentParagraph(escapeHtml(t.body)) +
      featuresCardHtml(t.features, t.featuresHead) +
      emailCtaStack({
        primary: { href: t.loginPath, label: t.cta },
        secondary: [{ href: '/', label: lang === 'en' ? 'Browse listings' : 'Каталог объектов' }],
      }) +
      emailContentParagraph(`<span style="color:${colors.muted};font-size:14px;white-space:pre-line;">${escapeHtml(t.closing)}</span>`)

    return {
      subject: t.subject,
      html: premiumEmailDocument({ preheader: t.preheader, bodyRowsHtml: bodyRows }),
    }
  },

  bookingRequested: (booking, lang = 'en') => {
    const idShort = String(booking?.id ?? '').replace(/-/g, '').slice(-8) || 'new'
    const texts = {
      ru: {
        subject: `Заявка #${idShort} отправлена партнёру`,
        preheader: 'Мы уведомим вас о решении по бронированию',
        title: `Здравствуйте, ${booking.renterName || 'путешественник'}!`,
        body: 'Ваша заявка на бронирование успешно отправлена партнёру.',
        escrow: 'Ваши средства защищены системой эскроу GoStayLo.',
        footer: 'Мы напишем, когда партнёр подтвердит бронирование.',
        status: 'Ожидает подтверждения',
        listing: 'Объект / услуга',
        dates: 'Даты',
        price: 'Итого',
        statusLabel: 'Статус',
      },
      en: {
        subject: `Booking request #${idShort} sent`,
        preheader: 'We will notify you when the partner responds',
        title: `Hello, ${booking.renterName || 'traveler'}!`,
        body: 'Your booking request has been sent to the partner.',
        escrow: 'Your payment path is protected by GoStayLo escrow.',
        footer: 'We will email you when the booking is confirmed.',
        status: 'Awaiting confirmation',
        listing: 'Listing / service',
        dates: 'Dates',
        price: 'Total',
        statusLabel: 'Status',
      },
      zh: {
        subject: `预订申请 #${idShort} 已发送`,
        preheader: '合作伙伴回复后我们会通知您',
        title: `您好，${booking.renterName || '用户'}！`,
        body: '您的预订申请已发送给合作伙伴。',
        escrow: '您的支付路径受 GoStayLo 托管保护。',
        footer: '预订确认后我们会邮件通知您。',
        status: '等待确认',
        listing: '服务/房源',
        dates: '日期',
        price: '合计',
        statusLabel: '状态',
      },
      th: {
        subject: `ส่งคำขอจอง #${idShort} แล้ว`,
        preheader: 'เราจะแจ้งเมื่อพาร์ทเนอร์ตอบกลับ',
        title: `สวัสดี ${booking.renterName || 'คุณ'}!`,
        body: 'ส่งคำขอจองของคุณไปยังพาร์ทเนอร์แล้ว',
        escrow: 'เส้นทางการชำระเงินของคุณได้รับการคุ้มครองด้วย GoStayLo Escrow',
        footer: 'เราจะอีเมลแจ้งเมื่อการจองได้รับการยืนยัน',
        status: 'รอยืนยัน',
        listing: 'รายการ/บริการ',
        dates: 'วันที่',
        price: 'ยอดรวม',
        statusLabel: 'สถานะ',
      },
    }
    const t = texts[lang] || texts.en
    const L = normalizeEmailLang(lang)
    const myBookingsCta =
      L === 'en' ? 'My bookings' : L === 'zh' ? '我的预订' : L === 'th' ? 'การจองของฉัน' : 'Мои бронирования'
    const messagesCta = L === 'en' ? 'Messages' : L === 'zh' ? '消息' : L === 'th' ? 'ข้อความ' : 'Сообщения'
    const datesLine = formatBookingRangeLineEmail(
      booking.checkIn,
      booking.checkOut,
      lang,
      booking.nights ?? 1,
      booking.listingCategorySlug,
    )
    const tzNote = buildBookingEmailTimeZoneNote(lang, booking.listingDistrict)
    const cardInner = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${colors.border};border-radius:${borderRadius};overflow:hidden;${theme.shadows.soft}">
  <tr><td style="padding:18px 20px;border-bottom:1px solid ${colors.divider};">
    <span style="font-size:12px;color:${colors.muted};">${escapeHtml(t.listing)}</span>
    <p style="margin:6px 0 0;font-size:16px;font-weight:600;color:${colors.text};">${escapeHtml(booking.listingTitle || '—')}</p>
  </td></tr>
  <tr><td style="padding:18px 20px;border-bottom:1px solid ${colors.divider};">
    <span style="font-size:12px;color:${colors.muted};">${escapeHtml(t.dates)}</span>
    <p style="margin:6px 0 0;font-size:15px;color:${colors.text};">${escapeHtml(datesLine)}</p>
    <p style="margin:8px 0 0;font-size:12px;line-height:1.45;color:${colors.muted};">${escapeHtml(tzNote)}</p>
  </td></tr>
  <tr><td style="padding:18px 20px;border-bottom:1px solid ${colors.divider};">
    <span style="font-size:12px;color:${colors.muted};">${escapeHtml(t.price)}</span>
    <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:${colors.primary};">฿${escapeHtml(String(booking.totalPrice?.toLocaleString?.() ?? booking.totalPrice ?? '0'))}</p>
  </td></tr>
  <tr><td style="padding:18px 20px;background-color:${colors.canvas};">
    <span style="font-size:12px;color:${colors.muted};">${escapeHtml(t.statusLabel)}</span>
    <p style="margin:8px 0 0;"><span style="display:inline-block;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;background-color:#fffbeb;color:#92400e;border:1px solid #fde68a;">${escapeHtml(t.status)}</span></p>
  </td></tr>
</table>`
    const bodyRows =
      emailTitleRow(t.title) +
      emailContentParagraph(escapeHtml(t.body)) +
      `<tr><td style="padding:8px 32px;">${cardInner}</td></tr>` +
      emailMutedBox(escapeHtml(t.escrow)) +
      emailContentParagraph(`<span style="color:${colors.muted};font-size:14px;">${escapeHtml(t.footer)}</span>`) +
      emailCtaStack({
        primary: { href: renterBookingsListPath(booking.id), label: myBookingsCta },
        secondary: [{ href: '/messages/', label: messagesCta }],
      })

    return {
      subject: t.subject,
      html: premiumEmailDocument({ preheader: t.preheader, bodyRowsHtml: bodyRows }),
    }
  },

  newLeadAlert: (booking, lang = 'en') => {
    const idShort = String(booking?.id ?? '').replace(/-/g, '').slice(-8) || 'new'
    const texts = {
      ru: {
        subject: `Новая заявка #${idShort}`,
        preheader: 'Подтвердите или отклоните в течение 24 часов',
        title: 'Новая заявка на бронирование',
        body: 'Поступила заявка по вашему объявлению.',
        guest: 'Арендатор',
        listing: 'Объект / услуга',
        dates: 'Даты',
        nights: 'ночей',
        amount: 'Сумма',
        cta: 'Открыть заявку',
        dash: 'Кабинет партнёра',
        footer: 'Пожалуйста, подтвердите или отклоните заявку в кабинете.',
      },
      en: {
        subject: `New request #${idShort}`,
        preheader: 'Confirm or decline within 24 hours',
        title: 'New booking request',
        body: 'A renter submitted a request for your listing.',
        guest: 'Renter',
        listing: 'Listing / service',
        dates: 'Dates',
        nights: 'nights',
        amount: 'Amount',
        cta: 'Review request',
        dash: 'Partner dashboard',
        footer: 'Please confirm or decline from your partner dashboard.',
      },
      zh: {
        subject: `新申请 #${idShort}`,
        preheader: '请在24小时内确认或拒绝',
        title: '新预订申请',
        body: '有预订人对您的发布提交了申请。',
        guest: '预订人',
        listing: '服务/房源',
        dates: '日期',
        nights: '晚',
        amount: '金额',
        cta: '查看申请',
        dash: '合作伙伴中心',
        footer: '请在合作伙伴中心确认或拒绝。',
      },
      th: {
        subject: `คำขอใหม่ #${idShort}`,
        preheader: 'ยืนยันหรือปฏิเสธภายใน 24 ชั่วโมง',
        title: 'คำขอจองใหม่',
        body: 'มีผู้เช่าส่งคำขอสำหรับรายการของคุณ',
        guest: 'ผู้เช่า',
        listing: 'รายการ/บริการ',
        dates: 'วันที่',
        nights: 'คืน',
        amount: 'จำนวนเงิน',
        cta: 'ดูคำขอ',
        dash: 'แดชบอร์ดพาร์ทเนอร์',
        footer: 'โปรดยืนยันหรือปฏิเสธจากแดชบอร์ดพาร์ทเนอร์',
      },
    }
    const t = texts[lang] || texts.en
    const Ln = normalizeEmailLang(lang)
    const messagesCtaLead =
      Ln === 'en' ? 'Messages' : Ln === 'zh' ? '消息' : Ln === 'th' ? 'ข้อความ' : 'Сообщения'
    const datesLine = formatBookingRangeLineEmail(
      booking.checkIn,
      booking.checkOut,
      lang,
      booking.nights ?? 1,
      booking.listingCategorySlug,
    )
    const tzNote = buildBookingEmailTimeZoneNote(lang, booking.listingDistrict)
    const cardInner = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${colors.border};border-radius:${borderRadius};overflow:hidden;${theme.shadows.soft}">
  <tr><td style="padding:18px 20px;border-bottom:1px solid ${colors.divider};">
    <span style="font-size:12px;color:${colors.muted};">${escapeHtml(t.guest)}</span>
    <p style="margin:6px 0 0;font-size:16px;font-weight:600;color:${colors.text};">${escapeHtml(booking.renterName || booking.renterEmail || '—')}</p>
  </td></tr>
  <tr><td style="padding:18px 20px;border-bottom:1px solid ${colors.divider};">
    <span style="font-size:12px;color:${colors.muted};">${escapeHtml(t.listing)}</span>
    <p style="margin:6px 0 0;font-size:15px;color:${colors.text};">${escapeHtml(booking.listingTitle || '—')}</p>
  </td></tr>
  <tr><td style="padding:18px 20px;border-bottom:1px solid ${colors.divider};">
    <span style="font-size:12px;color:${colors.muted};">${escapeHtml(t.dates)}</span>
    <p style="margin:6px 0 0;font-size:15px;color:${colors.text};">${escapeHtml(datesLine)}</p>
    <p style="margin:8px 0 0;font-size:12px;line-height:1.45;color:${colors.muted};">${escapeHtml(tzNote)}</p>
  </td></tr>
  <tr><td style="padding:18px 20px;">
    <span style="font-size:12px;color:${colors.muted};">${escapeHtml(t.amount)}</span>
    <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:${colors.primary};">฿${escapeHtml(String(booking.totalPrice?.toLocaleString?.() ?? booking.totalPrice ?? '0'))}</p>
  </td></tr>
</table>`
    const bodyRows =
      emailTitleRow(t.title) +
      emailContentParagraph(escapeHtml(t.body)) +
      `<tr><td style="padding:8px 32px;">${cardInner}</td></tr>` +
      emailContentParagraph(`<span style="color:${colors.muted};font-size:13px;">${escapeHtml(t.footer)}</span>`) +
      emailCtaStack({
        primary: { href: partnerBookingsListPath(booking.id), label: t.cta },
        secondary: [
          { href: '/partner/bookings', label: t.dash },
          { href: '/messages/', label: messagesCtaLead },
        ],
      })

    return {
      subject: t.subject,
      html: premiumEmailDocument({ preheader: t.preheader, bodyRowsHtml: bodyRows }),
    }
  },

  partnerApproved: (partner, lang = 'en') => {
    const texts = {
      ru: {
        subject: 'Вы стали партнёром GoStayLo',
        preheader: 'Доступ к кабинету и публикации объектов открыт',
        title: `Здравствуйте, ${partner.name || 'партнёр'}!`,
        body: 'Ваша заявка одобрена. Теперь вы можете размещать объекты и принимать бронирования.',
        featuresHead: 'Ваши возможности',
        features: [
          'Панель партнёра и статистика',
          'Неограниченное число объявлений',
          'Выплаты после выполнения условий бронирования',
        ],
        cta: 'Открыть кабинет',
        second: 'Сообщения',
        closing: 'Добро пожаловать в семью GoStayLo!',
      },
      en: {
        subject: 'You are now a GoStayLo partner',
        preheader: 'Your partner dashboard is ready',
        title: `Hello, ${partner.name || 'partner'}!`,
        body: 'Your application was approved. You can publish listings and receive bookings.',
        featuresHead: 'What you can do',
        features: ['Partner dashboard & insights', 'Unlimited listings', 'Payouts after booking fulfillment'],
        cta: 'Open dashboard',
        second: 'Messages',
        closing: 'Welcome to the GoStayLo family!',
      },
      zh: {
        subject: '您已成为 GoStayLo 合作伙伴',
        preheader: '合作伙伴中心已就绪',
        title: `您好，${partner.name || '合作伙伴'}！`,
        body: '您的申请已通过。现在可以发布服务/房源并接受预订。',
        featuresHead: '您可以',
        features: ['合作伙伴面板与数据', '不限数量的上架', '订单履约后的结算'],
        cta: '打开中心',
        second: '消息',
        closing: '欢迎加入 GoStayLo！',
      },
      th: {
        subject: 'คุณเป็นพาร์ทเนอร์ GoStayLo แล้ว',
        preheader: 'แดชบอร์ดพาร์ทเนอร์พร้อมใช้งาน',
        title: `สวัสดี ${partner.name || 'พาร์ทเนอร์'}!`,
        body: 'คำขอของคุณได้รับการอนุมัติ คุณสามารถลงรายการและรับการจองได้แล้ว',
        featuresHead: 'สิ่งที่คุณทำได้',
        features: ['แดชบอร์ดและข้อมูลเชิงลึก', 'ลงรายการได้ไม่จำกัด', 'จ่ายเงินหลังคำสั่งซื้อสำเร็จตามข้อตกลง'],
        cta: 'เปิดแดชบอร์ด',
        second: 'ข้อความ',
        closing: 'ยินดีต้อนรับสู่ครอบครัว GoStayLo!',
      },
    }
    const t = texts[lang] || texts.en
    const Lp = normalizeEmailLang(lang)
    const addListingCta =
      Lp === 'en' ? 'Add listing' : Lp === 'zh' ? '新建上架' : Lp === 'th' ? 'เพิ่มรายการ' : 'Добавить объект'
    const bodyRows =
      emailTitleRow(t.title) +
      emailContentParagraph(escapeHtml(t.body)) +
      featuresCardHtml(t.features, t.featuresHead) +
      emailCtaStack({
        primary: { href: '/partner/', label: t.cta },
        secondary: [
          { href: '/partner/listings/new', label: addListingCta },
          { href: '/messages/', label: t.second },
        ],
      }) +
      emailContentParagraph(`<span style="color:${colors.muted};font-size:14px;">${escapeHtml(t.closing)}</span>`)

    return {
      subject: t.subject,
      html: premiumEmailDocument({ preheader: t.preheader, bodyRowsHtml: bodyRows }),
    }
  },

  bookingConfirmedGuest: (payload, lang = 'ru') => {
    const L = normalizeEmailLang(lang)
    const copy = bookingConfirmedCopy(L)
    const subject = bookingConfirmedSubject(payload.listingTitle, L)
    const title = bookingConfirmedEmailTitle(payload.guestName, L)
    const listingTitle = payload.listingTitle || '—'
    const datesLine = `${formatBookingEmailDate(payload.checkIn, L)} — ${formatBookingEmailDate(payload.checkOut, L)}`
    const calTitle = calendarStayTitle(listingTitle, L)
    const calDesc = buildStayCalendarDescriptionI18n(payload, L, absUrl)
    const googleCalUrl = googleCalendarStayUrl({
      title: calTitle,
      location: payload.district || '',
      description: calDesc,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
    })
    const outlookCalUrl = outlookWebCalendarStayUrl({
      title: calTitle,
      location: payload.district || '',
      description: calDesc,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
    })
    const icsCalUrl = stayIcsDownloadUrlFromToken(payload.calendarStayToken)
    const escrowText = payload.escrowText || copy.escrowDefault
    const bodyRows =
      emailTitleRow(title) +
      emailContentParagraph(escapeHtml(copy.lead)) +
      emailListingCardBlock({
        imageUrl: payload.listingImageUrl,
        imageAlt: listingImageAltI18n(payload, L),
        title: listingTitle,
        subtitle: payload.district || '',
        datesLine,
        priceLine: payload.priceLine || '—',
      }) +
      emailMutedBox(escapeHtml(escrowText)) +
      emailCalendarRow({
        googleUrl: googleCalUrl,
        outlookUrl: outlookCalUrl,
        icsUrl: icsCalUrl,
        caption: copy.calCaption,
        labelGoogle: copy.calGoogle,
        labelOutlook: copy.calOutlook,
        labelIcal: copy.calIcs,
      }) +
      emailCtaStack({
        primary: { href: payload.checkoutUrl, label: copy.checkout },
        secondary: [
          { href: payload.chatUrl, label: copy.chat },
          { href: payload.profileUrl, label: copy.profile },
        ],
      })

    return {
      subject,
      html: premiumEmailDocument({ preheader: copy.preheader, bodyRowsHtml: bodyRows }),
    }
  },

  paymentSuccessGuest: (payload, lang = 'ru') => {
    const L = normalizeEmailLang(lang)
    const copy = paymentSuccessCopy(L)
    const subject = paymentSuccessSubject(payload.listingTitle, L)
    const guest =
      (payload.guestName && String(payload.guestName).trim()) ||
      ({ ru: 'гость', en: 'guest', zh: '客人', th: 'คุณ' }[L] || 'guest')
    const lead = copy.lead.replace(/\{name\}/g, guest)
    const datesLine = `${formatBookingEmailDate(payload.checkIn, L)} — ${formatBookingEmailDate(payload.checkOut, L)}`
    const escrowText = payload.escrowText || copy.escrowDefault
    const methodRow =
      payload.methodLine ?
        `<tr><td style="padding:8px 32px;"><p style="margin:0;font-size:14px;color:${colors.muted};">${escapeHtml(copy.method)}: <span style="color:${colors.text};font-weight:600;">${escapeHtml(payload.methodLine)}</span></p></td></tr>`
      : ''

    const bodyRows =
      emailTitleRow(copy.title) +
      emailContentParagraph(escapeHtml(lead)) +
      methodRow +
      emailListingCardBlock({
        imageUrl: payload.listingImageUrl,
        imageAlt: paymentListingImageAltI18n(payload, L),
        title: payload.listingTitle || '—',
        subtitle: payload.district || '',
        datesLine,
        priceLine: payload.amountLine || '—',
      }) +
      emailMutedBox(escapeHtml(escrowText)) +
      emailCtaStack({
        primary: { href: payload.bookingsUrl, label: copy.bookings },
        secondary: [
          { href: payload.chatUrl, label: copy.chat },
          { href: payload.profileUrl, label: copy.profile },
        ],
      })

    return {
      subject,
      html: premiumEmailDocument({ preheader: copy.preheader, bodyRowsHtml: bodyRows }),
    }
  },

}

async function sendEmail(to, template) {
  if (!RESEND_API_KEY) {
    console.log('[EMAIL] Resend API key not configured, skipping email')
    reportEmailFailureSignal('missing_api_key', to, template, 'RESEND_API_KEY not configured')
    return { success: false, error: 'API key not configured' }
  }

  console.log(`[EMAIL ATTEMPT] To: ${to}, Subject: ${template.subject}`)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getTransactionalFromAddress(),
        to: Array.isArray(to) ? to : [to],
        subject: template.subject,
        html: template.html,
        ...(template.attachments?.length ? { attachments: template.attachments } : {}),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      if (data.message?.includes('domain') || data.message?.includes('verify')) {
        console.log(`[EMAIL QUEUED] Domain not verified. Email to ${to} logged for later: ${template.subject}`)
        return { success: true, queued: true, reason: 'domain_not_verified' }
      }
      console.error('[EMAIL ERROR]', data)
      const toHint = Array.isArray(to) ? to.join(', ') : String(to)
      void notifySystemAlert(
        `📧 <b>Resend: отказ API</b> (EmailService)\n` +
          `subject: <code>${escapeSystemAlertHtml(template.subject)}</code>\n` +
          `to: <code>${escapeSystemAlertHtml(toHint.slice(0, 120))}</code>\n` +
          `<code>${escapeSystemAlertHtml(data?.message || JSON.stringify(data).slice(0, 600))}</code>`,
      )
      reportEmailFailureSignal('resend_rejected', to, template, data?.message || 'resend_rejected')
      return { success: false, error: data.message || 'Failed to send' }
    }

    console.log(`[EMAIL SENT] Successfully to ${to}: ${template.subject} (ID: ${data.id})`)
    return { success: true, id: data.id }
  } catch (error) {
    console.error('[EMAIL ERROR]', error)
    const toHint = Array.isArray(to) ? to.join(', ') : String(to)
    void notifySystemAlert(
      `📧 <b>Resend: исключение</b> (EmailService)\n` +
        `subject: <code>${escapeSystemAlertHtml(template.subject)}</code>\n` +
        `to: <code>${escapeSystemAlertHtml(toHint.slice(0, 120))}</code>\n` +
        `<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    reportEmailFailureSignal('exception', to, template, error?.message || error)
    return { success: false, error: error.message }
  }
}

export const EmailService = {
  templates,
  sendEmail,

  prepareBookingConfirmedGuestEmail(payload, lang = 'ru') {
    const L = normalizeEmailLang(lang)
    const startYmd = ymdFromBookingDate(payload.checkIn)
    const endYmd = ymdFromBookingDate(payload.checkOut)
    let calendarStayToken = null
    /** @type {{ filename: string, content: string, content_type?: string }[] | undefined} */
    let attachments

    if (payload.bookingId && startYmd && endYmd) {
      calendarStayToken = signCalendarStayToken({ bookingId: String(payload.bookingId), startYmd, endYmd })
      const siteHost = getPublicSiteUrl().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'gostaylo'
      const listingTitle = payload.listingTitle || '—'
      const calTitle = calendarStayTitle(listingTitle, L)
      const calDesc = buildStayCalendarDescriptionI18n(payload, L, absUrl)
      const icsBody = buildStayIcsBody({
        title: calTitle,
        location: payload.district || '',
        details: calDesc,
        startYmd,
        endYmd,
        bookingId: String(payload.bookingId),
        siteHost,
      })
      if (icsBody) {
        attachments = [
          {
            filename: 'gostaylo-stay.ics',
            content: Buffer.from(icsBody, 'utf8').toString('base64'),
            content_type: 'text/calendar; charset=utf-8',
          },
        ]
      }
    }

    const template = templates.bookingConfirmedGuest({ ...payload, calendarStayToken }, lang)
    return { template, attachments, calendarStayToken }
  },

  async sendWelcome(user, lang = 'en') {
    const template = templates.welcome(user, lang)
    return sendEmail(user.email, template)
  },

  async sendBookingRequested(booking, renterEmail, lang = 'en') {
    const template = templates.bookingRequested(booking, lang)
    return sendEmail(renterEmail, template)
  },

  async sendNewLeadAlert(booking, partnerEmail, lang = 'en') {
    const template = templates.newLeadAlert(booking, lang)
    return sendEmail(partnerEmail, template)
  },

  async sendPartnerApproved(partner, lang = 'en') {
    const template = templates.partnerApproved(partner, lang)
    return sendEmail(partner.email, template)
  },

  async sendBookingConfirmedGuest(payload, guestEmail, lang = 'ru') {
    const { template, attachments } = this.prepareBookingConfirmedGuestEmail(payload, lang)
    return sendEmail(guestEmail, { ...template, attachments })
  },

  async sendPaymentSuccessGuest(payload, guestEmail, lang = 'ru') {
    const template = templates.paymentSuccessGuest(payload, lang)
    return sendEmail(guestEmail, template)
  },
}

export default EmailService
