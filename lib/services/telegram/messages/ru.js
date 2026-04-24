/**
 * Russian HTML message bodies — Telegram webhook, lazy realtor, accounts, drafts, callbacks.
 */
import { buildLocalizedSiteUrl } from '../../../site-url.js'
import { telegramPartnerRoleLabel } from '../locale.js'

function esc(s) {
  if (s == null || s === '') return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const telegramRu = {
  /** Справка для партнёра / админа (ленивый риелтор, черновики, кабинет) */
  help_partner: (lang) => {
    const cabinet = buildLocalizedSiteUrl(lang, '/partner/listings')
    return (
      '<b>📖 Справка GoStayLo</b>\n\n' +
      '🤖 <b>Теперь я работаю на базе ИИ!</b> Скиньте <b>фото</b> и опишите объект <b>в свободной форме</b> (в подписи к снимку или отдельным сообщением) — я сам пойму и упакую объявление.\n\n' +
      '<b>📸 Ленивый риелтор</b>\n' +
      'Можно приложить <b>альбом</b> фото. Нужны <b>район</b>, <b>цена за ночь</b> и детали — ИИ оформит заголовок и описание.\n\n' +
      '<b>Пример подписи</b>\n' +
      '<i>🏠 Вилла на Раваи, <b>25000 THB</b></i>\n' +
      'или\n' +
      '<i>⛵ Апартаменты Патонг\n💰 <b>฿15000</b>/ночь</i>\n\n' +
      '<b>Как указать цену</b>\n' +
      '<code>25000 thb</code>, <code>฿25000</code>, <code>25000 бат</code>\n\n' +
      '<b>Команды в чате</b>\n' +
      '<code>/my</code> — черновики\n' +
      '<code>/promo</code> — активные Flash-акции и статистика\n' +
      '<code>/link</code> <code>email@mail.ru</code> — привязка по email\n' +
      '<code>/status</code> — статус привязки\n\n' +
      `<b>Кабинет</b>\n<a href="${esc(cabinet)}">Открыть кабинет партнёра →</a>`
    )
  },

  /** Справка для арендатора (без объявлений и /my) */
  help_renter: (lang) => {
    const profileUrl = buildLocalizedSiteUrl(lang, '/profile')
    const bookingsUrl = buildLocalizedSiteUrl(lang, '/my-bookings')
    const messagesUrl = buildLocalizedSiteUrl(lang, '/messages')
    const homeUrl = buildLocalizedSiteUrl(lang, '/')
    return (
      '<b>📖 Справка GoStayLo</b>\n\n' +
      '<b>Статус бронирования</b>\n' +
      'Нажмите кнопку <b>«Статус»</b> ниже — бот покажет, привязан ли Telegram к вашему аккаунту на сайте. ' +
      'Список бронирований, даты заезда и этапы оплаты смотрите в личном кабинете.\n\n' +
      '<b>Уведомления</b>\n' +
      'Подтверждения брони, напоминания об оплате и важные сообщения по поездке приходят <b>в этот чат автоматически</b>, ' +
      'если вы привязали Telegram к аккаунту на GoStayLo.\n\n' +
      '<b>Кабинет и поддержка</b>\n' +
      `<a href="${esc(bookingsUrl)}">Мои бронирования →</a>\n` +
      `<a href="${esc(messagesUrl)}">Сообщения с хозяином / поддержкой →</a>\n` +
      `<a href="${esc(profileUrl)}">Профиль и настройки →</a>\n\n` +
      '<b>Зачем привязать Telegram к сайту</b>\n' +
      'Так вы не пропустите срочные уведомления по брони и сможете быстрее отвечать в переписке по объекту.\n\n' +
      `<b>Сайт</b>\n<a href="${esc(homeUrl)}">GoStayLo — главная →</a>`
    )
  },

  /** /start для партнёра / админа */
  start_partner: (firstName, lang) => {
    const cabinet = buildLocalizedSiteUrl(lang, '/partner/listings')
    return (
      `<b>🌴 Привет, ${esc(firstName)}!</b>\n\n` +
      'Добро пожаловать в <b>GoStayLo</b> — аренда на Пхукете.\n\n' +
      '🤖 <b>Теперь я работаю на базе ИИ!</b> Просто скиньте <b>фото</b> и <b>описание в свободной форме</b> — я сам всё пойму и упакую объявление.\n\n' +
      '<b>📸 Ленивый риелтор</b>\n' +
      'Черновик появится в кабинете — доработайте карточку и отправьте на модерацию.\n\n' +
      '<b>Быстрые действия</b> — кнопки под этим сообщением.\n\n' +
      '<b>Текстовые команды</b>\n' +
      '<code>/help</code> — полная справка\n' +
      '<code>/my</code> · <code>/promo</code> · <code>/status</code> · <code>/link</code> email\n\n' +
      `<b>Кабинет</b>\n<a href="${esc(cabinet)}">Перейти в кабинет →</a>`
    )
  },

  /** /start для арендатора и гостя (без партнёрских команд) */
  start_renter: (firstName, lang) => {
    return (
      `<b>🌴 Привет, ${esc(firstName)}!</b>\n\n` +
      'Здесь — уведомления о бронированиях и оплате. Ниже кнопки: <b>виллы</b>, <b>транспорт</b>, <b>чаты</b> и сайт.\n\n' +
      '<code>/help</code> — краткая справка.'
    )
  },

  linkInvalidFormat:
    '❌ <b>Неверный формат</b>\n\n' + 'Укажите email: <code>/link ваш@email.com</code>',

  lazyDraftHint:
    '<b>📸 Ленивый риелтор</b>\n\n' +
    'Отправьте <b>фото</b> (одним сообщением) и в подписи укажите <b>название</b> и <b>цену за ночь</b>.\n\n' +
    '<b>Пример подписи</b>\n' +
    '<i>🏠 Вилла Раваи, <b>25000 THB</b></i>\n\n' +
    'Полная справка: <code>/help</code> или кнопка «Справка» ниже.',

  /** Кнопка «Создать объявление» (callback menu:lazy_hint) */
  createListingPhotoHint:
    '<b>📸 Создать объявление</b>\n\n' +
    'Просто отправьте мне <b>фото объекта</b> и в подписи укажите <b>название</b> и <b>цену</b>.\n\n' +
    '<b>Например:</b> <i>Вилла Раваи, 25000</i>\n\n' +
    'Мы создадим черновик в кабинете — доработайте карточку и отправьте на модерацию. Подробнее: <code>/help</code>.',

  plainTextNeedsPhoto:
    '<b>📸 Нужно фото</b>\n\n' +
    'Чтобы ИИ создал черновик, отправьте <b>фото</b> или <b>альбом</b>, затем опишите объект (или укажите всё в подписи).\n\n' +
    '<b>Пример текста</b>\n' +
    '<i>Раваи, 25000 бат, 3 спальни, бассейн</i>\n\n' +
    'Справка: <code>/help</code>',

  renterFreeTextHint:
    '<b>💬 Сообщения в чате</b>\n\n' +
    'Обычный текст здесь не нужен — откройте <b>«Чаты»</b> на сайте или ответьте <b>ответом</b> на уведомление о новом сообщении, чтобы оно ушло в переписку.\n\n' +
    'Поиск жилья — кнопки <b>Виллы</b> и <b>Транспорт</b> ниже.',

  renterPhotoNoListing:
    '📸 <b>Фото объявлений</b> доступны только <b>партнёрам</b>.\n\n' +
    'Для поиска жилья используйте кнопки <b>Виллы</b> и <b>Транспорт</b>.',

  chatReplySent: (inboxUrl) =>
    '✅ <b>Сообщение отправлено в чат на сайте.</b>\n\n' +
    `<a href="${esc(inboxUrl)}">Открыть переписку →</a>`,

  chatReplyForbidden: () =>
    '❌ Нельзя отправить ответ в этот чат. Откройте переписку на сайте.',

  chatReplyFailed: () => '⚠️ Не удалось записать сообщение. Попробуйте через сайт.',

  guestModeEnabled: () =>
    '🔄 <b>Режим гостя включён.</b> Меню как у арендатора — удобно искать жильё. Вернитесь кнопкой «Режим партнёра».',

  partnerModeRestored: () => '🏢 <b>Режим партнёра.</b> Снова доступны черновики и ИИ-объявления.',

  guestModePartnerOnly: () => 'ℹ️ Режим гостя доступен только партнёрам.',

  webhookError: '⚠️ Не удалось обработать запрос. Попробуйте ещё раз.',

  statusOk: (profile, lang, aiEnabled) => {
    const role = telegramPartnerRoleLabel(profile.role, lang)
    const site = buildLocalizedSiteUrl(lang, '/')
    const aiLine = aiEnabled
      ? '<b>Интеллект GoStayLo:</b> ✅ ВКЛЮЧЕН'
      : '<b>Интеллект GoStayLo:</b> ❌ ВЫКЛЮЧЕН (нет ключа API)'
    return (
      '✅ <b>Аккаунт привязан</b>\n\n' +
      `👤 ${esc(`${profile.first_name || ''} ${profile.last_name || ''}`.trim())}\n` +
      `📧 ${esc(profile.email)}\n` +
      `🏷 <b>${esc(role)}</b>\n\n` +
      `${aiLine}\n\n` +
      `🌐 <a href="${esc(site)}">Открыть сайт →</a>`
    )
  },

  statusUnlinked: () =>
    '❌ <b>Telegram не привязан</b>\n\n' + 'Выполните: <code>/link ваш@email.com</code>',

  statusError: () => '⚠️ Не удалось проверить статус. Попробуйте позже.',

  deepLinkUserNotFound: (userId) =>
    '❌ <b>Привязка не удалась</b>\n\n' +
    'Пользователь не найден. Откройте ссылку из личного кабинета на сайте.\n\n' +
    `<i>ID: ${esc(userId)}</i>`,

  deepLinkAlreadyLinked: () =>
    '❌ <b>Уже привязано</b>\n\n' +
    'Этот аккаунт связан с другим Telegram. Для смены привязки напишите в поддержку.',

  deepLinkSuccess: (firstName, lastName, email, roleLabel) =>
    '✅ <b>Готово!</b>\n\n' +
    '<b>Telegram привязан к аккаунту</b>\n\n' +
    `👤 ${esc(`${firstName || ''} ${lastName || ''}`.trim())}\n` +
    `📧 ${esc(email)}\n` +
    `🏷 <b>${esc(roleLabel)}</b>\n\n` +
    '🔔 Будем присылать уведомления о бронированиях и важных событиях.',

  deepLinkError: () =>
    '⚠️ <b>Ошибка привязки</b>\n\n' + 'Попробуйте позже или обратитесь в поддержку.',

  linkEmailNotFound: (email) => `❌ Email <b>${esc(email)}</b> не найден в системе.`,

  linkNotPartner: () =>
    '❌ <b>Доступ ограничен</b>\n\n' + 'Этот тип аккаунта нельзя привязать по email. Войдите на сайт и откройте ссылку из профиля.',

  linkSuccess: (firstName, lastName, roleLabel) =>
    '✅ <b>Аккаунт привязан</b>\n\n' +
    `👤 ${esc(`${firstName || ''} ${lastName || ''}`.trim())}\n` +
    `🏷 <b>${esc(roleLabel)}</b>\n\n` +
    '📸 Отправьте <b>фото с подписью</b>, чтобы создать черновик объекта.',

  linkError: () => '⚠️ Ошибка привязки. Попробуйте позже.',

  draftsAccessDenied: () =>
    '❌ <b>Нет доступа</b>\n\n' + 'Привяжите аккаунт: <code>/link email@example.com</code>',

  draftsEmpty: () =>
    '📋 <b>Черновиков пока нет</b>\n\n' +
    '📸 Отправьте фото с описанием — создадим черновик.\n\n' +
    '/help — инструкция',

  draftsHeader: (count) => `📋 <b>Ваши черновики</b> (<b>${count}</b>)\n\n`,

  draftLine: (index, title, priceDisplay, editUrl) =>
    `${index}. 🏠 <b>${esc(title)}</b> · 💰 <b>${esc(priceDisplay)}</b>\n` +
    `   <a href="${esc(editUrl)}">✏️ Редактировать →</a>`,

  draftsMore: (n) => `\n\n… и ещё <b>${n}</b>`,

  draftsFooter: (lang) =>
    `\n\n📍 <a href="${esc(buildLocalizedSiteUrl(lang, '/partner/listings'))}">Все объекты →</a>`,

  promo_flash_header: () => '🔥 Активные Flash Sale',
  promo_flash_empty: () => 'Нет активных Flash-акций сейчас.',
  promo_flash_partner_only: () => 'Команда <code>/promo</code> доступна партнёрам.',
  promo_flash_link_first: () => 'Сначала привяжите аккаунт: <code>/link ваш@email.com</code>',
  promo_flash_db_error: () => '⚠️ Не удалось загрузить данные. Попробуйте позже.',
  promo_flash_line_remaining: (hm) => `Осталось ${hm}`,
  promo_flash_line_bookings: (n) => `Броней: ${n}`,
  promo_flash_coach_high: () => '🚀 Отличный результат! Акция работает на полную.',
  promo_flash_coach_zero: () =>
    '💡 Совет: Попробуйте сделать скидку чуть выше для привлечения первых гостей.',

  draftUntitled: () => 'Без названия',

  lazyNotLinked: (lang) =>
    '❌ <b>Сначала привяжите аккаунт</b>\n\n' +
    `<code>/link ваш@email.com</code>\n\n` +
    `Или в <a href="${esc(buildLocalizedSiteUrl(lang, '/'))}">личном кабинете на сайте</a>.`,

  lazyNoRights: (lang) =>
    '❌ <b>Недостаточно прав</b>\n\n' +
    'Создавать объекты могут партнёры. Заявка — в профиле на сайте.\n\n' +
    `🏠 <a href="${esc(buildLocalizedSiteUrl(lang, '/'))}">Открыть сайт →</a>`,

  lazyCreating: () => '🏝 <b>Создаём черновик…</b>',

  lazyPhotosAwaitingDescription: () =>
    '📸 <b>Фотографии получил!</b>\n\n' +
    'Теперь, пожалуйста, напишите кратко об объекте (<b>район</b>, <b>цена</b>, <b>детали</b>), чтобы мой AI-мозг заполнил объявление — одним сообщением в этот чат.',

  lazyAiParseError: () =>
    '⚠️ <b>ИИ не смог разобрать текст.</b> Попробуйте переформулировать (район, цена в батах, тип объекта) или отправьте фото заново.',

  lazyAiDisabled: () =>
    '⚠️ <b>ИИ-парсинг недоступен</b> на сервере (не задан OPENAI_API_KEY). Обратитесь к администратору.',

  draftCategoryLabel: (display, lang) => {
    const d = display || 'property'
    const ru = {
      property: '🏠 Вилла · Недвижимость',
      transport: '🏍 Транспорт',
      yachts: '⛵ Яхта',
      nanny: '🍼 Няня',
      tours: '🗺 Туры',
    }
    const en = {
      property: '🏠 Villa · Property',
      transport: '🏍 Transport',
      yachts: '⛵ Yacht',
      nanny: '🍼 Nanny',
      tours: '🗺 Tours',
    }
    const map = lang === 'ru' ? ru : en
    return map[d] || map.property
  },

  lazyDefaultTitle: (firstName) => `Объект от ${esc(firstName)}`,

  priceNotSet: () => 'Не указана',

  lazyDraftCreated: ({ title, priceLine, photoCount, categoryLine, editUrl, listingsUrl }) =>
    `✅ <b>${esc(title)}</b> — черновик в кабинете!\n\n` +
    `${esc(categoryLine)}\n\n` +
    `💰 <b>Цена:</b> ${esc(priceLine)}\n` +
    `📸 <b>Загружено фото:</b> ${photoCount} шт.\n\n` +
    '⚠️ До публикации из кабинета объявление <b>не видно</b> модераторам.\n\n' +
    `🔗 <a href="${esc(editUrl)}">Проверить и опубликовать →</a>\n\n` +
    `📍 <a href="${esc(listingsUrl)}">Все объекты</a>`,

  lazyDraftCreateError: () => '❌ Не удалось создать черновик. Попробуйте ещё раз.',

  lazyPhotoError: () => '⚠️ Ошибка обработки фото. Попробуйте другое изображение.',

  createdViaTelegram: () => 'Создано через Telegram',

  bookingApprovedBody: ({ listingTitle, guestName, checkIn, checkOut, partnerEarningsFormatted }) =>
    '✅ <b>БРОНИРОВАНИЕ ПОДТВЕРЖДЕНО</b>\n\n' +
    `🏠 <b>${esc(listingTitle)}</b>\n` +
    `👤 ${esc(guestName)}\n` +
    `📅 <b>${esc(checkIn)}</b> → <b>${esc(checkOut)}</b>\n` +
    `💵 <b>Ваш доход:</b> <b>${esc(partnerEarningsFormatted)}</b>\n\n` +
    'Гость получит уведомление.',

  bookingDeclinedBody: ({ listingTitle, guestName, checkIn, checkOut }) =>
    '❌ <b>БРОНИРОВАНИЕ ОТКЛОНЕНО</b>\n\n' +
    `🏠 <b>${esc(listingTitle)}</b>\n` +
    `👤 ${esc(guestName)}\n` +
    `📅 <b>${esc(checkIn)}</b> → <b>${esc(checkOut)}</b>\n\n` +
    'Гость получит уведомление.',

  listingFallbackTitle: () => 'Объект',

  callbackUnknown: () => 'Неизвестная команда',
  callbackBookingNotFound: () => 'Бронирование не найдено',
  callbackNoPermission: () => 'У вас нет прав на это действие',
  callbackAlreadyHandled: (status) => `Бронирование уже обработано (${status})`,
  callbackUpdateError: () => 'Ошибка обновления',
  callbackApproveToast: () => '✅ Бронирование подтверждено!',
  callbackDeclineToast: () => '❌ Бронирование отклонено',
  callbackGenericError: () => 'Ошибка обработки',
}
