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
      '📖 <b>Gostaylo — quick guide</b>\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '📸 <b>Lazy realtor</b>\n' +
      'Send a <b>photo</b> and put the <b>title</b> and <b>price per night</b> in the caption — we will create a draft in your dashboard.\n\n' +
      'Caption example:\n' +
      '<i>🏠 Sea-view villa Rawai, <b>25000 THB</b></i>\n' +
      'or\n' +
      '<i>⛵ Patong apartment\n💰 <b>฿15000</b>/night</i>\n\n' +
      '💡 Price: <b>25000 thb</b>, <b>฿25000</b>, <b>25000 baht</b>\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '📋 <b>My drafts:</b> <code>/my</code>\n' +
      '🔗 <b>Link account:</b> <code>/link email@example.com</code>\n' +
      '📋 <b>Link status:</b> <code>/status</code>\n\n' +
      `🌐 <a href="${esc(cabinet)}">Partner dashboard →</a>`
    )
  },

  start: (firstName, lang) => {
    const cabinet = buildLocalizedSiteUrl(lang, '/partner/listings')
    return (
      `🌴 <b>Hi, ${esc(firstName)}!</b>\n\n` +
      'Welcome to <b>Gostaylo</b> — rentals in Phuket.\n\n' +
      '📸 <b>Lazy realtor</b>\n' +
      'Send a <b>photo + caption</b> — a draft appears in your dashboard. Edit it and submit for review.\n\n' +
      '📋 <b>Commands</b>\n' +
      '<code>/my</code> — drafts\n' +
      '<code>/help</code> — details\n' +
      '<code>/link</code> — link email\n' +
      '<code>/status</code> — status\n\n' +
      `🏠 <a href="${esc(cabinet)}">Open dashboard →</a>`
    )
  },

  linkInvalidFormat:
    '❌ <b>Invalid format</b>\n\n' + 'Use: <code>/link your@email.com</code>',

  lazyDraftHint:
    '📸 <b>Lazy realtor</b>\n\n' +
    'Send a <b>photo</b> with <b>title</b> and <b>nightly price</b> in the caption.\n\n' +
    'Example: <i>🏠 Rawai villa, <b>25000 THB</b></i>\n\n' +
    '/help — full guide',

  plainTextNeedsPhoto:
    '📸 To create a draft, send a <b>photo</b> and add a <b>caption</b>.\n\n' +
    'Example: <i>💰 <b>25000 THB</b> — 🏠 Rawai villa</i>\n\n' +
    '/help — instructions',

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
    '❌ <b>Access restricted</b>\n\n' + 'This bot is for partners and staff. Apply on the website.',

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
