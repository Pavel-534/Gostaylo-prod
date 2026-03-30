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
  help: (lang) => {
    const cabinet = buildLocalizedSiteUrl(lang, '/partner/listings')
    return (
      '<b>📖 Gostaylo quick guide</b>\n\n' +
      '<b>📸 Lazy realtor</b>\n' +
      'Send a <b>photo</b> with a <b>caption</b> (title + nightly price) — we create a draft in your dashboard.\n\n' +
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

  start: (firstName, lang) => {
    const cabinet = buildLocalizedSiteUrl(lang, '/partner/listings')
    return (
      `<b>🌴 Hi, ${esc(firstName)}!</b>\n\n` +
      'Welcome to <b>Gostaylo</b> — rentals in Phuket.\n\n' +
      '<b>📸 Lazy realtor</b>\n' +
      'Send a <b>photo</b> with a <b>caption</b> (title and price) — we create a listing draft. Finish it in the dashboard and submit for review.\n\n' +
      '<b>Quick actions</b> — use the buttons below.\n\n' +
      '<b>Text commands</b>\n' +
      '<code>/help</code> — full guide\n' +
      '<code>/my</code> · <code>/status</code> · <code>/link</code> email\n\n' +
      `<b>Dashboard</b>\n<a href="${esc(cabinet)}">Go to dashboard →</a>`
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
    '<b>📸 Photo required</b>\n\n' +
    'To create a draft, send a <b>photo</b> and add a <b>caption</b> to that photo.\n\n' +
    '<b>Example</b>\n' +
    '<i>💰 <b>25000 THB</b> — 🏠 Rawai villa</i>\n\n' +
    'Guide: <code>/help</code>',

  webhookError: '⚠️ Could not process your request. Please try again.',

  statusOk: (profile, lang) => {
    const role = telegramPartnerRoleLabel(profile.role, lang)
    const site = buildLocalizedSiteUrl(lang, '/')
    return (
      '✅ <b>Account linked</b>\n\n' +
      `👤 ${esc(`${profile.first_name || ''} ${profile.last_name || ''}`.trim())}\n` +
      `📧 ${esc(profile.email)}\n` +
      `🏷 <b>${esc(role)}</b>\n\n` +
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

  lazyDefaultTitle: (firstName) => `Listing from ${esc(firstName)}`,

  priceNotSet: () => 'Not specified',

  lazyDraftCreated: ({ title, priceLine, photoOk, editUrl, listingsUrl }) =>
    '✅ <b>Draft created</b>\n\n' +
    `📝 <b>Title:</b> ${esc(title)}\n` +
    `💰 <b>Price:</b> ${esc(priceLine)}\n` +
    `📸 <b>Photo:</b> ${photoOk ? '✓' : '✗'}\n\n` +
    '⚠️ The draft is <b>not visible</b> to moderators until you publish it from the dashboard.\n\n' +
    `✏️ <a href="${esc(editUrl)}">Open draft →</a>\n\n` +
    `📍 <a href="${esc(listingsUrl)}">My listings</a>`,

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
