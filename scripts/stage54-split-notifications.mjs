/**
 * Stage 54.0 — split notification.service.js handlers into cluster files.
 * Run: node scripts/stage54-split-notifications.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcPath = path.join(root, 'lib/services/notification.service.js')
const lines = fs.readFileSync(srcPath, 'utf8').split(/\n/)

function slice(a, b) {
  return lines.slice(a - 1, b).join('\n')
}

function rewriteThis(s) {
  return s
    .replace(/\bthis\.sendEmail\b/g, 'sendEmail')
    .replace(/\bthis\.sendToAdminTopic\b/g, 'sendToAdminTopic')
    .replace(/\bthis\.sendTelegram\b/g, 'sendTelegram')
    .replace(/\bthis\.buildGuestChatUrlForBooking\b/g, 'buildGuestChatUrlForBooking')
    .replace(/\bthis\.resolveGuestEmailLang\b/g, 'resolveGuestEmailLang')
    .replace(/\bthis\.calculateNights\b/g, 'calculateNights')
    .replace(/\bthis\.sendPartnerDraftDigestReminder\b/g, 'sendPartnerDraftDigestReminder')
}

function toExportHandle(block, exportName) {
  const stripped = block.replace(/^\s*static\s+async\s+handle\w+\s*\(/m, `export async function ${exportName}(`)
  return rewriteThis(stripped)
}

function toExportOtherStatic(block, exportName) {
  const stripped = block.replace(/^\s*static\s+async\s+\w+\s*\(/m, `export async function ${exportName}(`)
  return rewriteThis(stripped)
}

function injectDepsBlock(fileContent) {
  return fileContent.replace(
    /export async function (\w+)\(([^)]*)\)\s*\{/g,
    'export async function $1($2) {\n' +
      '  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =\n' +
      '    getNotifyDeps()\n',
  )
}

const bookingHeader = `/**
 * Stage 54.0 — booking & messaging cluster (notifications).
 */
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { EmailService } from '@/lib/services/email.service.js'
import { PushService } from '@/lib/services/notifications/push.service.js'
import * as Tg from '@/lib/services/notifications/telegram.service.js'
import {
  bookingSpecialRequestsSnippet,
  escapeTelegramHtmlText,
  formatBookingAmountForNotify,
} from '@/lib/services/notifications/formatting.js'
import { normalizeEmailLang, escrowEmailLine } from '@/lib/email/booking-email-i18n'
import {
  getCheckInReminderTelegramCopy,
  getReviewReminderTelegramCopy,
  getPartnerGuestReviewPromptCopy,
} from '@/lib/notification-category-terminology.js'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'
import { safeNotifyChannel, escrowCheckInSecurityMessageRu } from '@/lib/services/notifications/notify-shared.js'

const BASE_URL = getPublicSiteUrl()

`

const paymentHeader = `/**
 * Stage 54.0 — payment & payout cluster (notifications).
 */
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import { resolveDefaultCommissionPercent, resolveThbPerUsdt } from '@/lib/services/currency.service'
import { EmailService } from '@/lib/services/email.service.js'
import * as Tg from '@/lib/services/notifications/telegram.service.js'
import {
  escapeTelegramHtmlText,
  formatBookingAmountForNotify,
} from '@/lib/services/notifications/formatting.js'
import { normalizeEmailLang, escrowEmailLine } from '@/lib/email/booking-email-i18n'
import { PushService } from '@/lib/services/notifications/push.service.js'
import { readBookingFinancialSnapshot } from '@/lib/services/booking-financial-read-model.service'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'
import { safeNotifyChannel, PAYMENT_METHOD_LABELS, escrowCheckInSecurityMessageRu } from '@/lib/services/notifications/notify-shared.js'

const BASE_URL = getPublicSiteUrl()

`

const marketingHeader = `/**
 * Stage 54.0 — marketing & partner lifecycle cluster (notifications).
 */
import { getSiteDisplayName, buildLocalizedSiteUrl } from '@/lib/site-url.js'
import { EmailService } from '@/lib/services/email.service.js'
import * as Tg from '@/lib/services/notifications/telegram.service.js'
import { supabaseAdmin } from '@/lib/supabase'
import { buildMainMenuReplyMarkup } from '@/lib/services/telegram/inline-menu.js'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'

`

const bookingRanges = [
  [204, 345, 'handleNewBookingRequest'],
  [397, 471, 'handleBookingConfirmed'],
  [473, 485, 'handleBookingCancelled'],
  [853, 892, 'handleNewMessage'],
  [894, 926, 'handleCheckInConfirmed'],
  [1016, 1080, 'handlePartnerGuestReviewInvite'],
  [1083, 1102, 'handleReviewReminder'],
  [1105, 1139, 'handleCheckInReminder'],
]

const paymentRanges = [
  [487, 511, 'handlePaymentReceived'],
  [516, 563, 'handlePaymentSubmitted'],
  [568, 639, 'handlePaymentConfirmed'],
  [641, 702, 'handlePaymentSuccess'],
  [789, 838, 'handlePayoutProcessed'],
  [840, 851, 'handlePayoutRejected'],
  [928, 948, 'handleEscrowThawPreview'],
  [951, 971, 'handlePayoutBatchCompleted'],
  [974, 1014, 'handlePartnerFundsThawedAvailable'],
]

/** sendPartner before handleDraft (forward ref); runDaily last */
const marketingRanges = [
  [171, 202, 'handleUserWelcome'],
  [704, 736, 'handlePartnerVerified'],
  [738, 748, 'handlePartnerRejected'],
  [750, 767, 'handleListingApproved'],
  [769, 787, 'handleListingRejected'],
  [1157, 1199, 'sendPartnerDraftDigestReminder'],
  [1145, 1152, 'handleDraftDigestReminder'],
  [1206, 1257, 'runDailyDraftDigestReminders'],
]

function buildFile(header, ranges, useHandle) {
  const parts = [header]
  for (const [a, b, name] of ranges) {
    const raw = slice(a, b)
    const fn = useHandle ? toExportHandle(raw, name) : toExportOtherStatic(raw, name)
    parts.push(fn)
    parts.push('')
  }
  return injectDepsBlock(parts.join('\n'))
}

fs.writeFileSync(path.join(root, 'lib/services/notifications/booking-events.js'), buildFile(bookingHeader, bookingRanges, true))
fs.writeFileSync(path.join(root, 'lib/services/notifications/payment-events.js'), buildFile(paymentHeader, paymentRanges, true))
fs.writeFileSync(path.join(root, 'lib/services/notifications/marketing-events.js'), buildFile(marketingHeader, marketingRanges, false))
console.log('OK: booking-events.js, payment-events.js, marketing-events.js')
