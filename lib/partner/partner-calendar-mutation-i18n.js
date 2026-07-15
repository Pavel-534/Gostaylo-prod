/**
 * Partner calendar mutation toasts — i18n SSOT (Stage 188.0).
 */

import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

export function calToast(key, language = 'ru', vars = {}) {
  let msg = getUIText(key, language) || key
  for (const [k, v] of Object.entries(vars || {})) {
    msg = msg.split(`{{${k}}}`).join(String(v))
  }
  return msg
}

export function showCalendarBlockSuccess(language) {
  toast.success(calToast('partnerCal_toast_blockSuccess', language))
}

export function showCalendarBlockError(language, message) {
  toast.error(message || calToast('partnerCal_toast_blockError', language))
}

export function showCalendarUnblockSuccess(language) {
  toast.success(calToast('partnerCal_toast_unblockSuccess', language))
}

export function showCalendarUnblockError(language, message) {
  toast.error(message || calToast('partnerCal_toast_unblockError', language))
}

export function showCalendarBookingSuccess(language) {
  toast.success(calToast('partnerCal_toast_bookingSuccess', language))
}

export function showCalendarBookingError(language, message) {
  toast.error(message || calToast('partnerCal_toast_bookingError', language))
}

export function showSeasonalPriceSuccess(language, conflictsResolved) {
  const c = conflictsResolved
  if (c && (c.deleted > 0 || c.updated > 0)) {
    toast.success(
      calToast('partnerCal_toast_seasonConflictResolved', language, {
        count: String((c.deleted || 0) + (c.updated || 0)),
      }),
    )
    return
  }
  toast.success(calToast('partnerCal_toast_seasonSuccess', language))
}

export function showSeasonalPriceError(language, message) {
  toast.error(message || calToast('partnerCal_toast_seasonError', language))
}

export function showSeasonalPriceDeleteSuccess(language) {
  toast.success(calToast('partnerCal_toast_seasonDeleteSuccess', language))
}

export function showSeasonalPriceDeleteError(language, message) {
  toast.error(message || calToast('partnerCal_toast_seasonDeleteError', language))
}

const BULK_TOAST_ID = 'partner-cal-bulk-prices'

export function showBulkSeasonalProgress(language, current, total) {
  toast.loading(calToast('partnerCal_batchPricesProgress', language, { current, total }), {
    id: BULK_TOAST_ID,
  })
}

export function dismissBulkSeasonalProgress() {
  toast.dismiss(BULK_TOAST_ID)
}

/**
 * @param {{ succeeded: number, failed: number, total?: number, results: Array<{ ok?: boolean, listingTitle?: string, error?: string }> }} summary
 */
export function showBulkSeasonalSummary(summary, language) {
  dismissBulkSeasonalProgress()
  const { succeeded = 0, failed = 0, total = 0, results = [] } = summary
  const failRows = results.filter((r) => !r.ok)

  if (failed === 0 && succeeded > 0) {
    toast.success(
      calToast('partnerCal_batchPricesAllSuccess', language, {
        success: String(succeeded),
        total: String(total || succeeded),
      }),
    )
    return
  }

  if (succeeded === 0 && failed > 0) {
    const first = failRows[0]
    toast.error(
      calToast('partnerCal_batchPricesPartialDetail', language, {
        success: '0',
        total: String(total || failed),
        name: first?.listingTitle || '—',
        error: first?.error || calToast('partnerCal_toast_seasonError', language),
      }),
    )
    return
  }

  if (succeeded > 0 && failed > 0) {
    const first = failRows[0]
    toast.warning(
      calToast('partnerCal_batchPricesPartialDetail', language, {
        success: String(succeeded),
        total: String(total || succeeded + failed),
        name: first?.listingTitle || '—',
        error: first?.error || calToast('partnerCal_toast_seasonError', language),
      }),
    )
  }
}
