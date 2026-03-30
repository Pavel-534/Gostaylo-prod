/**
 * Inline-клавиатура главного меню бота (callback + ссылки на сайт).
 */
import { buildLocalizedSiteUrl } from '../../site-url.js'

const BTN = {
  ru: {
    drafts: '📋 Черновики',
    status: '✅ Статус',
    help: '❓ Справка',
    photoHint: '📸 Как отправить фото',
    linkSite: '🔗 Привязать на сайте',
    cabinet: '🏠 Кабинет партнёра',
  },
  en: {
    drafts: '📋 Drafts',
    status: '✅ Status',
    help: '❓ Help',
    photoHint: '📸 How to send a photo',
    linkSite: '🔗 Link on website',
    cabinet: '🏠 Partner dashboard',
  },
}

export function buildMainMenuReplyMarkup(lang) {
  const l = lang === 'ru' ? BTN.ru : BTN.en
  const profileUrl = buildLocalizedSiteUrl(lang, '/profile')
  const cabinetUrl = buildLocalizedSiteUrl(lang, '/partner/listings')

  return {
    inline_keyboard: [
      [
        { text: l.drafts, callback_data: 'menu:my' },
        { text: l.status, callback_data: 'menu:status' },
      ],
      [
        { text: l.help, callback_data: 'menu:help' },
        { text: l.photoHint, callback_data: 'menu:lazy' },
      ],
      [
        { text: l.linkSite, url: profileUrl },
        { text: l.cabinet, url: cabinetUrl },
      ],
    ],
  }
}
