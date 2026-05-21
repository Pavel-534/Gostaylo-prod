/**
 * Stage 109.2 — dispute resolution (unfreeze, notify parties).
 */
import { PushService } from '@/lib/services/push.service'
import { NotificationService } from '@/lib/services/notification.service'
import { getSiteDisplayName } from '@/lib/site-url'
import { trimReason, getProfileSafe } from '@/lib/services/dispute/dispute-shared.js'

export async function finalizeDisputePaymentUnfreeze({ bookingId, disputeId, resolutionReason }) {
const { releaseDisputePayoutFreeze } = await import('@/lib/services/dispute/dispute-payout-freeze.js')
    return releaseDisputePayoutFreeze({ bookingId, disputeId, resolutionReason })
}

export async function notifyPartiesDisputeResolved({ bookingId, resolutionReason, renterId, partnerId, conversationId }) {
const bid = String(bookingId || '').trim()
    const rid = String(renterId || '').trim()
    const pid = String(partnerId || '').trim()
    const summaryPush = trimReason(resolutionReason, 200) || '—'
    const conv = conversationId ? String(conversationId).trim() : ''
    const linkForUser = (uid) => {
      if (conv) return `/messages/${encodeURIComponent(conv)}`
      if (String(uid) === rid) return `/renter/bookings?booking=${encodeURIComponent(bid)}`
      return `/partner/bookings?booking=${encodeURIComponent(bid)}`
    }
    const bodyEmail = trimReason(resolutionReason, 2000) || '—'
    const sendPush = async (uid) => {
      if (!uid) return
      await PushService.sendToUser(uid, 'DISPUTE_RESOLVED', {
        bookingId: bid,
        summary: summaryPush,
        link: linkForUser(uid),
      })
    }
    await sendPush(rid)
    await sendPush(pid)

    const sendMail = async (profile) => {
      if (!profile?.email || !bid) return
      const lang = profile.language || 'ru'
      const isRu = lang !== 'en'
      if (isRu) {
        await NotificationService.sendEmail(
          profile.email,
          `Спор по заказу #${bid} закрыт`,
          `Арбитраж по заказу #${bid} завершён.\n\nРешение поддержки:\n${bodyEmail}\n\n— ${getSiteDisplayName()}`,
        )
      } else {
        await NotificationService.sendEmail(
          profile.email,
          `Dispute closed — booking #${bid}`,
          `The dispute for booking #${bid} has been closed.\n\nResolution:\n${bodyEmail}\n\n— ${getSiteDisplayName()}`,
        )
      }
    }
    const [rProf, pProf] = await Promise.all([getProfileSafe(rid), getProfileSafe(pid)])
    await sendMail(rProf)
    await sendMail(pProf)
}

