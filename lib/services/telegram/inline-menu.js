/**
 * Inline-клавиатура главного меню бота.
 * partner | partner_guest | renter | guest
 */
import { buildLocalizedSiteUrl } from '../../site-url.js'
import { telegramMenuButtonLocale } from '@/lib/i18n/locale-resolver.js'

const BTN = {
  ru: {
    drafts: '📋 Мои черновики',
    status: '✅ Статус',
    help: '❓ Справка',
    createListing: '📸 Создать объявление',
    linkSite: '🔗 Привязать на сайте',
    cabinet: '🏠 Кабинет партнёра',
    home: '🏠 Главная',
    villas: '🏠 Виллы',
    transport: '🏍 Транспорт',
    chats: '💬 Чаты',
    guestMode: '🔄 Режим гостя',
    partnerMode: '🏢 Режим партнёра',
  },
  en: {
    drafts: '📋 My drafts',
    status: '✅ Status',
    help: '❓ Help',
    createListing: '📸 Create listing',
    linkSite: '🔗 Link on website',
    cabinet: '🏠 Partner dashboard',
    home: '🏠 Home',
    villas: '🏠 Villas',
    transport: '🏍 Transport',
    chats: '💬 Chats',
    guestMode: '🔄 Guest mode',
    partnerMode: '🏢 Partner mode',
  },
}

function renterGuestKeyboard(lang) {
  const l = telegramMenuButtonLocale(lang) === 'ru' ? BTN.ru : BTN.en
  const villasUrl = buildLocalizedSiteUrl(lang, '/listings?category=property')
  const transportUrl = buildLocalizedSiteUrl(lang, '/listings?category=transport')
  const messagesUrl = buildLocalizedSiteUrl(lang, '/messages')
  const profileUrl = buildLocalizedSiteUrl(lang, '/profile')
  const homeUrl = buildLocalizedSiteUrl(lang, '/')

  return {
    inline_keyboard: [
      [
        { text: l.villas, url: villasUrl },
        { text: l.transport, url: transportUrl },
      ],
      [{ text: l.chats, url: messagesUrl }],
      [
        { text: l.status, callback_data: 'menu:status' },
        { text: l.help, callback_data: 'menu:help' },
      ],
      [
        { text: l.linkSite, url: profileUrl },
        { text: l.home, url: homeUrl },
      ],
    ],
  }
}

/**
 * @param {'ru' | 'en' | 'zh' | 'th'} lang — локаль пользователя; подписи zh/th пока как en.
 * @param {'partner' | 'partner_guest' | 'renter' | 'guest'} [variant='guest']
 */
export function buildMainMenuReplyMarkup(lang, variant = 'guest') {
  const l = telegramMenuButtonLocale(lang) === 'ru' ? BTN.ru : BTN.en

  if (variant === 'partner') {
    const cabinetUrl = buildLocalizedSiteUrl(lang, '/partner/listings')
    const profileUrl = buildLocalizedSiteUrl(lang, '/profile')
    return {
      inline_keyboard: [
        [
          { text: l.drafts, callback_data: 'menu:my' },
          { text: l.status, callback_data: 'menu:status' },
        ],
        [
          { text: l.help, callback_data: 'menu:help' },
          { text: l.createListing, callback_data: 'menu:lazy_hint' },
        ],
        [
          { text: l.linkSite, url: profileUrl },
          { text: l.cabinet, url: cabinetUrl },
        ],
        [{ text: l.guestMode, callback_data: 'menu:guest_on' }],
      ],
    }
  }

  if (variant === 'partner_guest') {
    const base = renterGuestKeyboard(lang)
    return {
      inline_keyboard: [
        ...base.inline_keyboard,
        [{ text: l.partnerMode, callback_data: 'menu:partner_mode' }],
      ],
    }
  }

  if (variant === 'renter' || variant === 'guest') {
    return renterGuestKeyboard(lang)
  }

  return renterGuestKeyboard(lang)
}
