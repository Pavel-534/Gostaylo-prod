/**
 * Inline-клавиатура главного меню бота (callback + ссылки на сайт).
 * Варианты: partner (PARTNER/ADMIN) — полное меню; renter/guest — без кабинета и объявлений.
 */
import { buildLocalizedSiteUrl } from '../../site-url.js'

const BTN = {
  ru: {
    drafts: '📋 Черновики',
    status: '✅ Статус',
    help: '❓ Справка',
    createListing: '📸 Создать объявление',
    linkSite: '🔗 Привязать на сайте',
    cabinet: '🏠 Кабинет партнёра',
    home: '🏠 Главная',
  },
  en: {
    drafts: '📋 Drafts',
    status: '✅ Status',
    help: '❓ Help',
    createListing: '📸 Create listing',
    linkSite: '🔗 Link on website',
    cabinet: '🏠 Partner dashboard',
    home: '🏠 Home',
  },
}

/**
 * @param {'ru' | 'en'} lang
 * @param {'partner' | 'renter' | 'guest'} [variant='guest']
 */
export function buildMainMenuReplyMarkup(lang, variant = 'guest') {
  const l = lang === 'ru' ? BTN.ru : BTN.en
  const profileUrl = buildLocalizedSiteUrl(lang, '/profile')
  const homeUrl = buildLocalizedSiteUrl(lang, '/')

  if (variant === 'partner') {
    const cabinetUrl = buildLocalizedSiteUrl(lang, '/partner/listings')
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
      ],
    }
  }

  return {
    inline_keyboard: [
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
