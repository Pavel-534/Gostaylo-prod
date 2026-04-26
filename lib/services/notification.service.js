/**
 * GoStayLo — Notification Service hub (Stage 54.0–56.0)
 * Handlers: `lib/services/notifications/*-events.js`; registry + outbox: `notification-registry.js`.
 */

import { setNotificationHandlerDeps } from './notifications/notify-deps.js'
import {
  NotificationEvents,
  resolveNotificationHandler,
  isNotificationEventAsync,
} from './notifications/notification-registry.js'
import { enqueueNotificationOutbox } from './notifications/notification-outbox.js'
import {
  sendResendEmail,
  textToHtml as resendTextToHtml,
} from './notifications/email.service.js'
import * as Tg from './notifications/telegram.service.js'
import * as MarketingEvents from './notifications/marketing-events.js'
import {
  calculateNights,
  buildGuestChatUrlForBooking,
  resolveGuestEmailLang,
} from './notifications/notify-shared.js'
import { logStructured } from '@/lib/critical-telemetry.js'
import { getCorrelationId } from '@/lib/request-correlation.js'

export { NotificationEvents }

const USE_NOTIFICATION_OUTBOX = process.env.NOTIFICATION_OUTBOX === '1'

/** Stage 59.0 — outbox worker / cron must call this before `resolveNotificationHandler` (same as `dispatch`). */
export function wireNotificationHandlerDeps() {
  wireHandlerDepsInner()
}

function wireHandlerDepsInner() {
  setNotificationHandlerDeps({
    sendEmail: (...a) => NotificationService.sendEmail(...a),
    sendTelegram: (...a) => NotificationService.sendTelegram(...a),
    sendToAdminTopic: (...a) => NotificationService.sendToAdminTopic(...a),
    calculateNights,
    buildGuestChatUrlForBooking,
    resolveGuestEmailLang,
    sendTelegramBookingRequest: (...a) => NotificationService.sendTelegramBookingRequest(...a),
  })
}

export class NotificationService {
  static async dispatch(event, data) {
    let preview = ''
    try {
      preview = JSON.stringify(data).substring(0, 200)
    } catch {
      preview = '[unserializable payload]'
    }
    const correlationId = getCorrelationId()
    logStructured({
      module: 'NotificationService',
      stage: 'dispatch',
      event,
      correlationId: correlationId || undefined,
      preview,
    })
    console.log(`🔔 [NOTIFICATION] Event: ${event}`, preview)

    const handler = resolveNotificationHandler(event)
    if (!handler) return

    wireHandlerDepsInner()

    const asyncFlag = isNotificationEventAsync(event)
    if (USE_NOTIFICATION_OUTBOX && asyncFlag) {
      try {
        await enqueueNotificationOutbox(event, data)
        logStructured({
          module: 'NotificationService',
          stage: 'outbox_enqueued',
          event,
          correlationId: correlationId || undefined,
        })
        return
      } catch (e) {
        console.error('[NOTIFICATION] outbox enqueue failed, sync fallback', e)
      }
    }

    try {
      await handler(data)
    } catch (error) {
      console.error(`[NOTIFICATION ERROR] ${event}:`, error)
    }
  }

  static async sendEmail(to, subject, textBody, htmlBody = null) {
    return sendResendEmail(to, subject, textBody, htmlBody)
  }

  static textToHtml(text) {
    return resendTextToHtml(text)
  }

  static async sendTelegramMessagePayload(payload) {
    return Tg.sendTelegramMessagePayload(payload)
  }

  static async sendTelegram(chatId, message) {
    return Tg.sendTelegramChat(chatId, message)
  }

  static async sendToAdminTopic(topicType, message, reply_markup) {
    return Tg.sendToAdminTopic(topicType, message, reply_markup)
  }

  static async sendToAdmin(message, reply_markup) {
    return Tg.sendToAdmin(message, reply_markup)
  }

  static async sendSystemAlert(message, opts = {}) {
    return Tg.sendSystemAlertTelegram(message, opts)
  }

  /** Делегат в `notifications/telegram.service.js` (inline + `?booking=`). */
  static async sendTelegramBookingRequest(chatId, data) {
    return Tg.sendTelegramBookingRequest(chatId, data)
  }

  static async runDailyDraftDigestReminders() {
    wireHandlerDepsInner()
    return MarketingEvents.runDailyDraftDigestReminders()
  }
}

export default NotificationService
