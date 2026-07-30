/**
 * CurrencySelector — SSOT storefront currency switcher (header + footer).
 *
 * Trigger/menu: symbol + ISO code only (no country flags — Stage 200.3).
 * List: UI_SWITCHER_CURRENCIES from lib/currency.js.
 */

'use client'

import { useState, useEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useCurrency } from '@/contexts/currency-context'
import { UI_SWITCHER_CURRENCIES } from '@/lib/currency'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'gostaylo_currency'

export function CurrencySelector({
  value,
  onChange,
  className = '',
  compact = false,
  variant = 'header',
  testid = 'currency-selector',
}) {
  const [mounted, setMounted] = useState(false)
  const currencyCtx = useCurrency()
  const currency = currencyCtx?.currency || value || 'THB'
  const setCurrencyCtx = currencyCtx?.setCurrency
  const isFooter = variant === 'footer'
  const Chevron = isFooter ? ChevronUp : ChevronDown

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelect = (code) => {
    setCurrencyCtx?.(code)
    onChange?.(code)
  }

  const currentCurrency =
    UI_SWITCHER_CURRENCIES.find((c) => c.code === currency) || UI_SWITCHER_CURRENCIES[0]

  const headerTriggerClass = cn(
    'h-11 min-w-[44px] rounded-full border-slate-200 px-2 font-medium sm:h-8 sm:min-w-0',
    compact ? 'sm:px-1.5' : 'sm:px-2',
    className,
  )

  if (!mounted) {
    if (isFooter) {
      return (
        <button
          type="button"
          className={cn(
            'flex min-h-[44px] items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-200',
            className,
          )}
          aria-hidden
        >
          <span>฿</span>
          <span className="uppercase tracking-wide">THB</span>
        </button>
      )
    }
    return (
      <Button variant="outline" size="sm" className={headerTriggerClass}>
        <span className="text-sm font-semibold">฿</span>
        <ChevronDown className="ml-0.5 hidden h-3 w-3 sm:inline" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isFooter ? (
          <button
            type="button"
            data-testid={testid}
            aria-label={`Currency ${currentCurrency.code}`}
            className={cn(
              'flex min-h-[44px] items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:border-brand/40 hover:bg-slate-800 hover:text-white',
              className,
            )}
          >
            <span className="text-sm leading-none text-slate-400">{currentCurrency.symbol}</span>
            <span className="uppercase tracking-wide">{currentCurrency.code}</span>
            <Chevron className="h-3 w-3 shrink-0 text-slate-500" />
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={headerTriggerClass}
            data-testid={testid}
            aria-label={`Currency ${currentCurrency.code}`}
          >
            <span className="font-semibold text-sm">{currentCurrency.symbol}</span>
            {!compact && (
              <span className="ml-0.5 hidden text-xs text-slate-600 md:inline">
                {currentCurrency.code}
              </span>
            )}
            <Chevron className="ml-0.5 hidden h-3 w-3 text-slate-400 sm:inline" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isFooter ? 'end' : 'end'}
        side={isFooter ? 'top' : 'bottom'}
        className={cn(
          'z-[220] w-44',
          isFooter && 'border-slate-700 bg-slate-900 text-slate-100',
        )}
      >
        {UI_SWITCHER_CURRENCIES.map((curr) => (
          <DropdownMenuItem
            key={curr.code}
            onClick={() => handleSelect(curr.code)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-2',
              isFooter && 'focus:bg-slate-800 focus:text-white',
              currency === curr.code &&
                (isFooter ? 'bg-brand/15 text-brand/70' : undefined),
            )}
            data-testid={`currency-option-${curr.code}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-4 text-center text-base font-medium leading-none">
                {curr.symbol}
              </span>
              <span className={cn('font-medium', !isFooter && 'text-slate-600')}>{curr.code}</span>
            </div>
            {currency === curr.code ? (
              <Check className={cn('h-4 w-4', isFooter ? 'text-brand/70' : 'text-brand')} />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** @deprecated Prefer useCurrency() from CurrencyContext */
export function useSelectedCurrency() {
  const [currency, setCurrency] = useState('THB')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setCurrency(saved)

    const handleChange = (e) => {
      setCurrency(e.detail)
    }

    window.addEventListener('currency-change', handleChange)
    return () => window.removeEventListener('currency-change', handleChange)
  }, [])

  return currency
}

export default CurrencySelector
