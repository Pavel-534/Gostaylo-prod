'use client'

import { AlertTriangle, Shield, X } from 'lucide-react'
import { useState } from 'react'
import { detectContactSafety } from '@/lib/chat/contact-safety-detection'
import {
  getContactSafetyWarningCopy,
  getContactSafetyWarningTitle,
  shouldShowContactSafetyWarning,
} from '@/lib/chat/show-contact-safety-warning'

/**
 * Detects potentially unsafe patterns in messages:
 * - Phone numbers
 * - Telegram handles (@username)
 * - URLs/links
 * - WhatsApp patterns
 * - Payment mentions
 */
export function detectUnsafePatterns(text) {
  const det = detectContactSafety(text)
  const patterns = det.matches.map((m) => ({ type: m.kind, value: m.value }))
  return {
    hasRisk: det.hasSafetyTrigger,
    patterns,
  }
}

/**
 * Safety Banner Component
 * Shows when risky patterns are detected in messages (pre-payment only).
 */
export function SafetyBanner({
  patterns = [],
  onDismiss,
  lang = 'ru',
  bookingStatus = null,
}) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || patterns.length === 0) return null
  if (!shouldShowContactSafetyWarning(bookingStatus)) return null

  const title = getContactSafetyWarningTitle(lang)
  const body = getContactSafetyWarningCopy(lang)
  const dismiss =
    lang === 'en' ? 'Understood' : lang === 'zh' ? '知道了' : lang === 'th' ? 'รับทราบ' : 'Понятно'

  return (
    <div className="mx-4 mb-3 animate-in slide-in-from-top-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 sm:mx-5">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-amber-950">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">{body}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            onDismiss?.()
          }}
          className="p-1 text-amber-700 hover:text-amber-900"
          aria-label={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Inline Risk Indicator
 * Small indicator shown next to messages with detected patterns
 */
export function RiskIndicator({ patterns = [], lang = 'ru' }) {
  if (patterns.length === 0) return null

  const tooltip =
    lang === 'ru'
      ? 'Обнаружены контактные данные'
      : lang === 'zh'
        ? '检测到联系方式'
        : lang === 'th'
          ? 'พบข้อมูลติดต่อ'
          : 'Contact info detected'

  return (
    <div className="inline-flex items-center gap-1 text-amber-600 text-xs ml-2" title={tooltip}>
      <AlertTriangle className="h-3 w-3" aria-hidden />
    </div>
  )
}

export default { detectUnsafePatterns, SafetyBanner, RiskIndicator }
