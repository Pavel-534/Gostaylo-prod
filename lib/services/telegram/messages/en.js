/**
 * English HTML message bodies — Telegram bot (mirror of ru.js).
 */
import { buildLocalizedSiteUrl } from '../../../site-url.js'
import { telegramPartnerRoleLabel } from '../locale.js'

function esc(s) {
  if (s == null || s === '') return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const telegramEn = {
  /** Partner / admin help (lazy realtor, drafts) */
  help_partner: (lang) => {
    const cabinet = buildLocalizedSiteUrl(lang, '/partner/listings')
    return (
      '<b>📖 GoStayLo quick guide</b>\n\n' +
      '🤖 <b>I now run on AI!</b> Send <b>photos</b> and describe the listing <b>in your own words</b> (in the caption or as a follow-up message) — I will structure everything for you.\n\n' +
      '<b>📸 Lazy realtor</b>\n' +
      'You can send a <b>photo album</b>. Mention <b>area</b>, <b>nightly price</b>, and details — AI will craft the title and description.\n\n' +
      '<b>Caption example</b>\n' +
      '<i>🏠 Sea-view villa Rawai, <b>25000 THB</b></i>\n' +
      'or\n' +
      '<i>⛵ Patong apartment\n💰 <b>฿15000</b>/night</i>\n\n' +
      '<b>Price formats</b>\n' +
      '<code>25000 thb</code>, <code>฿25000</code>, <code>25000 baht</code>\n\n' +
      '<b>Chat commands</b>\n' +
      '<code>/my</code> — drafts\n' +
      '<code>/link</code> <code>you@email.com</code> — link by email\n' +
      '<code>/status</code> — link status\n\n' +
      `<b>Dashboard</b>\n<a href="${esc(cabinet)}">Open partner dashboard →</a>`
    )
  },

  /** Renter / guest help (no listing creation) */
  help_renter: (lang) => {
    const profileUrl = buildLocalizedSiteUrl(lang, '/profile')
    const bookingsUrl = buildLocalizedSiteUrl(lang, '/my-bookings')
    const messagesUrl = buildLocalizedSiteUrl(lang, '/messages')
    const homeUrl = buildLocalizedSiteUrl(lang, '/')
    return (
      '<b>📖 GoStayLo guide</b>\n\n' +
      '<b>Booking status</b>\n' +
      'Tap <b>«Status»</b> below to see whether your Telegram is linked to your GoStayLo account. ' +
      'View trips, dates, and payment steps in your dashboard on the website.\n\n' +
      '<b>Notifications</b>\n' +
      'Booking confirmations, payment reminders, and important trip updates are sent <b>to this chat automatically</b> ' +
      'once Telegram is linked to your account.\n\n' +
      '<b>Dashboard &amp; support</b>\n' +
      `<a href="${esc(bookingsUrl)}">My bookings →</a>\n` +
      `<a href="${esc(messagesUrl)}">Messages with host / support →</a>\n` +
      `<a href="${esc(profileUrl)}">Profile &amp; settings →</a>\n\n` +
      '<b>Why link Telegram</b>\n' +
      'So you do not miss urgent booking alerts and can reply faster in chats about your stay.\n\n' +
      `<b>Website</b>\n<a href="${esc(homeUrl)}">GoStayLo — home →</a>`
    )
  },

  start_partner: (firstName, lang) => {
    const cabinet = buildLocalizedSiteUrl(lang, '/partner/listings')
    return (
      `<b>🌴 Hi, ${esc(firstName)}!</b>\n\n` +
      'Welcome to <b>GoStayLo</b> — rentals in Phuket.\n\n' +
      '🤖 <b>I now run on AI!</b> Just send <b>photos</b> and a <b>free-form description</b> — I will understand and package the listing.\n\n' +
      '<b>📸 Lazy realtor</b>\n' +
      'We create a draft in your dashboard — finish the card and submit for review.\n\n' +
      '<b>Quick actions</b> — use the buttons below.\n\n' +
      '<b>Text commands</b>\n' +
      '<code>/help</code> — full guide\n' +
      '<code>/my</code> · <code>/status</code> · <code>/link</code> email\n\n' +
      `<b>Dashboard</b>\n<a href="${esc(cabinet)}">Go to dashboard →</a>`
    )
  },

  start_renter: (firstName, lang) => {
    return (
      `<b>🌴 Hi, ${esc(firstName)}!</b>\n\n` +
      'Booking and payment alerts arrive here. Use the buttons for <b>villas</b>, <b>transport</b>, <b>chats</b>, and the website.\n\n' +
      '<code>/help</code> — short guide.'
    )
  },

  linkInvalidFormat:
    '❌ <b>Invalid format</b>\n\n' + 'Use: <code>/link your@email.com</code>',

  lazyDraftHint:
    '<b>📸 Lazy realtor</b>\n\n' +
    'Send a <b>photo</b> (as one message) and put the <b>title</b> and <b>nightly price</b> in the caption.\n\n' +
    '<b>Example caption</b>\n' +
    '<i>🏠 Rawai villa, <b>25000 THB</b></i>\n\n' +
    'Full guide: <code>/help</code> or tap «Help» below.',

  /** «Create listing» button (callback menu:lazy_hint) */
  createListingPhotoHint:
    '<b>📸 Create a listing</b>\n\n' +
    'Send a <b>photo</b> of the property and put the <b>title</b> and <b>price</b> in the caption.\n\n' +
    '<b>Example:</b> <i>Rawai Villa, 25000</i>\n\n' +
    'We will create a draft in your dashboard — finish the listing and submit it for review. More: <code>/help</code>.',

  plainTextNeedsPhoto:
    '<b>📸 Photos required</b>\n\n' +
    'To let AI create a draft, first send a <b>photo</b> or <b>album</b>, then describe the listing (or put everything in the photo caption).\n\n' +
    '<b>Example text</b>\n' +
    '<i>Rawai, 25000 THB, 3 bedrooms, pool</i>\n\n' +
    'Guide: <code>/help</code>',

  renterFreeTextHint:
    '<b>💬 Chats</b>\n\n' +
    'You do not need to type random text here — open <b>Chats</b> on the website, or <b>reply</b> to a “new message” notification so your text goes to that thread.\n\n' +
    'Search: <b>Villas</b> and <b>Transport</b> below.',

  renterPhotoNoListing:
    '📸 <b>Listing photos</b> are for <b>partners</b> only.\n\n' +
    'Use <b>Villas</b> and <b>Transport</b> to search.',

  chatReplySent: (inboxUrl) =>
    '✅ <b>Message sent to the chat on the website.</b>\n\n' +
    `<a href="${esc(inboxUrl)}">Open conversation →</a>`,

  chatReplyForbidden: () =>
    '❌ Cannot send a reply into this chat. Open the inbox on the website.',

  chatReplyFailed: () => '⚠️ Could not save the message. Try from the website.',

  guestModeEnabled: () =>
    '🔄 <b>Guest mode on.</b> Renter-style menu — easy to browse. Switch back with «Partner mode».',

  partnerModeRestored: () => '🏢 <b>Partner mode.</b> Drafts and AI listings are back.',

  guestModePartnerOnly: () => 'ℹ️ Guest mode is only for partners.',

  webhookError: '⚠️ Could not process your request. Please try again.',

  statusOk: (profile, lang, aiEnabled) => {
    const role = telegramPartnerRoleLabel(profile.role, lang)
    const site = buildLocalizedSiteUrl(lang, '/')
    const aiLine = aiEnabled
      ? '🧠 <b>GoStayLo intelligence:</b> ✅ ON'
      : '🧠 <b>GoStayLo intelligence:</b> ❌ OFF (no API key)'
    return (
      '✅ <b>Account linked</b>\n\n' +
      `👤 ${esc(`${profile.first_name || ''} ${profile.last_name || ''}`.trim())}\n` +
      `📧 ${esc(profile.email)}\n` +
      `🏷 <b>${esc(role)}</b>\n\n` +
      `${aiLine}\n\n` +
      `🌐 <a href="${esc(site)}">Open website →</a>`
    )
  },

  statusUnlinked: () =>
    '❌ <b>Telegram is not linked</b>\n\n' + 'Run: <code>/link your@email.com</code>',

  statusError: () => '⚠️ Could not check status. Try again later.',

  deepLinkUserNotFound: (userId) =>
    '❌ <b>Link failed</b>\n\n' +
    'User not found. Open the link from your account on the website.\n\n' +
    `<i>ID: ${esc(userId)}</i>`,

  deepLinkAlreadyLinked: () =>
    '❌ <b>Already linked</b>\n\n' +
    'This account is connected to another Telegram. Contact support to change it.',

  deepLinkSuccess: (firstName, lastName, email, roleLabel) =>
    '✅ <b>Done!</b>\n\n' +
    '<b>Telegram linked to your account</b>\n\n' +
    `👤 ${esc(`${firstName || ''} ${lastName || ''}`.trim())}\n` +
    `📧 ${esc(email)}\n` +
    `🏷 <b>${esc(roleLabel)}</b>\n\n` +
    '🔔 You will receive booking and important alerts.',

  deepLinkError: () =>
    '⚠️ <b>Link error</b>\n\n' + 'Try again later or contact support.',

  linkEmailNotFound: (email) => `❌ Email <b>${esc(email)}</b> was not found.`,

  linkNotPartner: () =>
    '❌ <b>Access restricted</b>\n\n' + 'This account type cannot be linked via email. Open the link from your profile on the website.',

  linkSuccess: (firstName, lastName, roleLabel) =>
    '✅ <b>Account linked</b>\n\n' +
    `👤 ${esc(`${firstName || ''} ${lastName || ''}`.trim())}\n` +
    `🏷 <b>${esc(roleLabel)}</b>\n\n` +
    '📸 Send a <b>photo with a caption</b> to create a listing draft.',

  linkError: () => '⚠️ Link error. Try again later.',

  draftsAccessDenied: () =>
    '❌ <b>No access</b>\n\n' + 'Link your account: <code>/link email@example.com</code>',

  draftsEmpty: () =>
    '📋 <b>No drafts yet</b>\n\n' +
    '📸 Send a photo with a caption — we will create a draft.\n\n' +
    '/help — guide',

  draftsHeader: (count) => `📋 <b>Your drafts</b> (<b>${count}</b>)\n\n`,

  draftLine: (index, title, priceDisplay, editUrl) =>
    `${index}. 🏠 <b>${esc(title)}</b> · 💰 <b>${esc(priceDisplay)}</b>\n` +
    `   <a href="${esc(editUrl)}">✏️ Edit →</a>`,

  draftsMore: (n) => `\n\n… and <b>${n}</b> more`,

  draftsFooter: (lang) =>
    `\n\n📍 <a href="${esc(buildLocalizedSiteUrl(lang, '/partner/listings'))}">All listings →</a>`,

  draftUntitled: () => 'Untitled',

  lazyNotLinked: (lang) =>
    '❌ <b>Link your account first</b>\n\n' +
    `<code>/link your@email.com</code>\n\n` +
    `Or use your <a href="${esc(buildLocalizedSiteUrl(lang, '/'))}">dashboard on the website</a>.`,

  lazyNoRights: (lang) =>
    '❌ <b>Insufficient permissions</b>\n\n' +
    'Only partners can create listings. Apply from your profile on the site.\n\n' +
    `🏠 <a href="${esc(buildLocalizedSiteUrl(lang, '/'))}">Open website →</a>`,

  lazyCreating: () => '🏝 <b>Creating draft…</b>',

  lazyPhotosAwaitingDescription: () =>
    '📸 <b>Photos received!</b>\n\n' +
    'Please send a short description (<b>area</b>, <b>price</b>, <b>details</b>) in one message so my AI can fill the listing.',

  lazyAiParseError: () =>
    '⚠️ <b>AI could not parse your text.</b> Try again with area, price in THB, and listing type — or resend photos.',

  lazyAiDisabled: () =>
    '⚠️ <b>AI parsing is unavailable</b> on the server (OPENAI_API_KEY missing). Contact the administrator.',

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

  lazyDefaultTitle: (firstName) => `Listing from ${esc(firstName)}`,

  priceNotSet: () => 'Not specified',

  lazyDraftCreated: ({ title, priceLine, photoCount, categoryLine, editUrl, listingsUrl }) =>
    `✅ <b>${esc(title)}</b> — draft saved!\n\n` +
    `${esc(categoryLine)}\n\n` +
    `💰 <b>Price:</b> ${esc(priceLine)}\n` +
    `📸 <b>Photos uploaded:</b> ${photoCount}\n\n` +
    '⚠️ The listing stays <b>hidden</b> from moderators until you publish from the dashboard.\n\n' +
    `🔗 <a href="${esc(editUrl)}">Review and publish →</a>\n\n` +
    `📍 <a href="${esc(listingsUrl)}">All listings</a>`,

  lazyDraftCreateError: () => '❌ Could not create draft. Please try again.',

  lazyPhotoError: () => '⚠️ Could not process the photo. Try another image.',

  createdViaTelegram: () => 'Created via Telegram',

  bookingApprovedBody: ({ listingTitle, guestName, checkIn, checkOut, partnerEarningsFormatted }) =>
    '✅ <b>BOOKING CONFIRMED</b>\n\n' +
    `🏠 <b>${esc(listingTitle)}</b>\n` +
    `👤 ${esc(guestName)}\n` +
    `📅 <b>${esc(checkIn)}</b> → <b>${esc(checkOut)}</b>\n` +
    `💵 <b>Your earnings:</b> <b>${esc(partnerEarningsFormatted)}</b>\n\n` +
    'The guest will be notified.',

  bookingDeclinedBody: ({ listingTitle, guestName, checkIn, checkOut }) =>
    '❌ <b>BOOKING DECLINED</b>\n\n' +
    `🏠 <b>${esc(listingTitle)}</b>\n` +
    `👤 ${esc(guestName)}\n` +
    `📅 <b>${esc(checkIn)}</b> → <b>${esc(checkOut)}</b>\n\n` +
    'The guest will be notified.',

  listingFallbackTitle: () => 'Property',

  callbackUnknown: () => 'Unknown action',
  callbackBookingNotFound: () => 'Booking not found',
  callbackNoPermission: () => 'You are not allowed to do this',
  callbackAlreadyHandled: (status) => `Booking already processed (${status})`,
  callbackUpdateError: () => 'Update failed',
  callbackApproveToast: () => '✅ Booking confirmed!',
  callbackDeclineToast: () => '❌ Booking declined',
  callbackGenericError: () => 'Something went wrong',
}
