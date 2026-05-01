'use client'

/**
 * FooterSwitchers — компактные Language + Currency переключатели для футера.
 *
 * - Wired напрямую на SSOT контексты (useI18n + useCurrency).
 * - Пометка EXPLICIT_KEY при выборе валюты — auto-geo больше не перезапишет.
 * - Синхронизируется с хедером через общий провайдер (стейт не сбрасывается на navigation).
 *
 * @created 2026-02 Global Engagement Sprint
 */

import { Globe, ChevronUp } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { supportedLanguages } from '@/lib/translations'
import { cn } from '@/lib/utils'

const CURRENCIES = [
  { code: 'THB', symbol: '฿' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'RUB', symbol: '₽' },
  { code: 'CNY', symbol: '¥' },
]

const LANG_EMOJI = { ru: '🇷🇺', en: '🇬🇧', th: '🇹🇭', zh: '🇨🇳' }

export function FooterSwitchers({ className = '' }) {
  const { language, setLanguage } = useI18n()
  const { currency, setCurrency } = useCurrency()

  return (
    <div
      data-testid="footer-switchers"
      className={cn('flex flex-wrap items-center gap-3', className)}
    >
      {/* Language */}
      <div className="group relative">
        <button
          type="button"
          data-testid="footer-language-trigger"
          className="flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:border-teal-400/60 hover:bg-slate-800 hover:text-white"
          aria-label="Language"
        >
          <Globe className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-400 transition-colors" />
          <span className="uppercase tracking-wide">{language}</span>
          <ChevronUp className="h-3 w-3 text-slate-500" />
        </button>
        {/* Popup upwards (footer context) */}
        <div
          className="invisible absolute bottom-full left-0 mb-2 min-w-[140px] opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            {supportedLanguages.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                data-testid={`footer-language-option-${l.code}`}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                  language === l.code
                    ? 'bg-teal-500/15 text-teal-300'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white',
                )}
              >
                <span className="text-base" aria-hidden>{LANG_EMOJI[l.code] || '🌐'}</span>
                <span className="font-medium">{l.label || l.code.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Currency */}
      <div className="group relative">
        <button
          type="button"
          data-testid="footer-currency-trigger"
          className="flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:border-teal-400/60 hover:bg-slate-800 hover:text-white"
          aria-label="Currency"
        >
          <span className="text-sm leading-none text-slate-400 group-hover:text-teal-400 transition-colors">
            {CURRENCIES.find((c) => c.code === currency)?.symbol || '฿'}
          </span>
          <span className="uppercase tracking-wide">{currency}</span>
          <ChevronUp className="h-3 w-3 text-slate-500" />
        </button>
        <div
          className="invisible absolute bottom-full right-0 mb-2 min-w-[140px] opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCurrency(c.code)}
                data-testid={`footer-currency-option-${c.code}`}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                  currency === c.code
                    ? 'bg-teal-500/15 text-teal-300'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white',
                )}
              >
                <span className="w-4 text-center text-base leading-none" aria-hidden>{c.symbol}</span>
                <span className="font-medium">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FooterSwitchers
