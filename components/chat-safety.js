'use client'

import { AlertTriangle, Shield, X } from 'lucide-react'
import { useState } from 'react'
import { detectContactSafety } from '@/lib/chat/contact-safety-detection'
import { getSiteDisplayName } from '@/lib/site-url'

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
    patterns
  }
}

/**
 * Safety Banner Component
 * Shows when risky patterns are detected in messages
 */
export function SafetyBanner({ patterns = [], onDismiss, lang = 'ru' }) {
  const [dismissed, setDismissed] = useState(false)
  
  if (dismissed || patterns.length === 0) return null
  
  const brand = getSiteDisplayName()
  const texts = {
    ru: {
      title: 'Безопасность превыше всего',
      body: `Мы обнаружили контактные данные в сообщении. Всегда оплачивайте через ${brand} для защиты ваших средств. Избегайте прямых переводов незнакомым людям.`,
      dismiss: 'Понятно',
    },
    en: {
      title: 'Safety First',
      body: `We detected contact information in the message. Always pay through ${brand} to protect your funds. Avoid direct transfers to strangers.`,
      dismiss: 'Got it',
    },
  }

  const t = texts[lang] || texts.en
  
  return (
    <div className='mx-4 mb-3 animate-in slide-in-from-top-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:mx-5'>
      <div className='flex items-start gap-3'>
        <Shield className='mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600' />
        <div className='flex-1'>
          <h4 className='text-sm font-medium text-slate-900'>{t.title}</h4>
          <p className='mt-1 text-xs text-slate-600'>{t.body}</p>
        </div>
        <button 
          onClick={() => { setDismissed(true); onDismiss?.() }}
          className='p-1 text-slate-500 hover:text-slate-700'
        >
          <X className='h-4 w-4' />
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
  
  const tooltip = lang === 'ru' 
    ? 'Обнаружены контактные данные'
    : 'Contact info detected'
  
  return (
    <div 
      className='inline-flex items-center gap-1 text-amber-600 text-xs ml-2'
      title={tooltip}
    >
      <AlertTriangle className='h-3 w-3' />
    </div>
  )
}

export default { detectUnsafePatterns, SafetyBanner, RiskIndicator }
