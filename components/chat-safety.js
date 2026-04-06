'use client'

import { AlertTriangle, Shield, X } from 'lucide-react'
import { useState } from 'react'

/**
 * Detects potentially unsafe patterns in messages:
 * - Phone numbers
 * - Telegram handles (@username)
 * - URLs/links
 * - WhatsApp patterns
 * - Payment mentions
 */
export function detectUnsafePatterns(text) {
  if (!text || typeof text !== 'string') return { hasRisk: false, patterns: [] }
  
  const patterns = []
  
  // Phone numbers (various formats)
  const phoneRegex = /(\+?[0-9]{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g
  const phones = text.match(phoneRegex)
  if (phones) {
    phones.forEach(p => {
      // Filter out short numbers that might be prices
      if (p.replace(/\D/g, '').length >= 8) {
        patterns.push({ type: 'phone', value: p })
      }
    })
  }
  
  // Telegram handles
  const telegramRegex = /@[a-zA-Z0-9_]{4,32}/g
  const telegrams = text.match(telegramRegex)
  if (telegrams) {
    telegrams.forEach(t => patterns.push({ type: 'telegram', value: t }))
  }
  
  // URLs
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi
  const urls = text.match(urlRegex)
  if (urls) {
    urls.forEach(u => patterns.push({ type: 'url', value: u }))
  }
  
  // WhatsApp patterns
  const whatsappRegex = /whatsapp|wa\.me|ватсап|вотсап/gi
  if (whatsappRegex.test(text)) {
    patterns.push({ type: 'whatsapp', value: 'WhatsApp mention' })
  }
  
  // Direct payment mentions (could indicate scam attempt)
  const paymentRegex = /перевод|переведи|карт[аеу]|счёт|сбербанк|тинькофф|transfer|bank|card/gi
  if (paymentRegex.test(text)) {
    patterns.push({ type: 'payment', value: 'Direct payment mention' })
  }
  
  return {
    hasRisk: patterns.length > 0,
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
  
  const texts = {
    ru: {
      title: 'Безопасность превыше всего',
      body: 'Мы обнаружили контактные данные в сообщении. Всегда оплачивайте через GoStayLo для защиты ваших средств. Избегайте прямых переводов незнакомым людям.',
      dismiss: 'Понятно'
    },
    en: {
      title: 'Safety First',
      body: 'We detected contact information in the message. Always pay through GoStayLo to protect your funds. Avoid direct transfers to strangers.',
      dismiss: 'Got it'
    }
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
