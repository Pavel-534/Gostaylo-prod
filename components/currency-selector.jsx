/**
 * GoStayLo - Currency Selector Component
 * Dropdown to manually change currency (overrides auto-detection)
 */

'use client';

import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check } from 'lucide-react';
import { CurrencyFlag } from '@/components/flags'
import { useCurrency } from '@/contexts/currency-context'

// Supported currencies with metadata
const CURRENCIES = [
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'USDT', symbol: '₮', name: 'Tether' },
];

const STORAGE_KEY = 'gostaylo_currency';

export function CurrencySelector({ 
  value, 
  onChange, 
  className = '',
  compact = false 
}) {
  const [mounted, setMounted] = useState(false);
  // SSOT: currency из CurrencyContext, fallback на prop для backward compat
  const currencyCtx = useCurrency()
  const currency = currencyCtx?.currency || value || 'THB'
  const setCurrencyCtx = currencyCtx?.setCurrency

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelect = (code) => {
    setCurrencyCtx?.(code)
    onChange?.(code)
  };

  const currentCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  // Dense header chrome: symbol-first on narrow screens; flag/code only where space allows.
  // Avoids double-flag next to LangSwitcher and keeps the right cluster from overflowing.
  const triggerClass = [
    'h-11 min-w-[44px] rounded-full px-2 font-medium sm:h-8 sm:min-w-0',
    compact ? 'sm:px-1.5' : 'sm:px-2',
    className,
  ].filter(Boolean).join(' ')

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className={triggerClass}>
        <span className="text-sm font-semibold">฿</span>
        <ChevronDown className="ml-0.5 hidden h-3 w-3 sm:inline" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={triggerClass}
          data-testid="currency-selector"
          aria-label={`Currency ${currentCurrency.code}`}
        >
          <span className="mr-1 hidden sm:inline"><CurrencyFlag code={currentCurrency.code} /></span>
          <span className="font-semibold text-sm">{currentCurrency.symbol}</span>
          {!compact && (
            <span className="ml-0.5 hidden text-xs text-slate-600 md:inline">{currentCurrency.code}</span>
          )}
          <ChevronDown className="ml-0.5 hidden h-3 w-3 text-slate-400 sm:inline" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[220] w-48">
        {CURRENCIES.map((curr) => (
          <DropdownMenuItem
            key={curr.code}
            onClick={() => handleSelect(curr.code)}
            className="flex items-center justify-between cursor-pointer"
            data-testid={`currency-option-${curr.code}`}
          >
            <div className="flex items-center gap-2">
              <CurrencyFlag code={curr.code} />
              <span className="font-medium">{curr.symbol}</span>
              <span className="text-slate-600">{curr.code}</span>
            </div>
            {currency === curr.code && (
              <Check className="h-4 w-4 text-brand" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook to get current currency from anywhere
export function useSelectedCurrency() {
  const [currency, setCurrency] = useState('THB');

  useEffect(() => {
    // Load initial value
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setCurrency(saved);

    // Listen for changes
    const handleChange = (e) => {
      setCurrency(e.detail);
    };

    window.addEventListener('currency-change', handleChange);
    return () => window.removeEventListener('currency-change', handleChange);
  }, []);

  return currency;
}

export default CurrencySelector;
