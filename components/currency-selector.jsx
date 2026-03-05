/**
 * FunnyRent 2.1 - Currency Selector Component
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

// Supported currencies with metadata
const CURRENCIES = [
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'USDT', symbol: '₮', name: 'Tether', flag: '💎' },
];

const STORAGE_KEY = 'gostaylo_currency';

export function CurrencySelector({ 
  value, 
  onChange, 
  className = '',
  compact = false 
}) {
  const [currency, setCurrency] = useState(value || 'THB');
  const [mounted, setMounted] = useState(false);

  // Load saved currency on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CURRENCIES.find(c => c.code === saved)) {
      setCurrency(saved);
      onChange?.(saved);
    }
  }, []);

  const handleSelect = (code) => {
    setCurrency(code);
    localStorage.setItem(STORAGE_KEY, code);
    onChange?.(code);
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('currency-change', { detail: code }));
  };

  const currentCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className={`h-9 ${className}`}>
        <span className="mr-1">฿</span>
        <span>THB</span>
        <ChevronDown className="ml-1 h-3 w-3" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`h-9 font-medium ${className}`}
          data-testid="currency-selector"
        >
          <span className="mr-1.5 text-base">{currentCurrency.flag}</span>
          {!compact && (
            <>
              <span className="font-semibold">{currentCurrency.symbol}</span>
              <span className="ml-1 text-slate-600">{currentCurrency.code}</span>
            </>
          )}
          {compact && (
            <span className="font-semibold">{currentCurrency.symbol}</span>
          )}
          <ChevronDown className="ml-1 h-3 w-3 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {CURRENCIES.map((curr) => (
          <DropdownMenuItem
            key={curr.code}
            onClick={() => handleSelect(curr.code)}
            className="flex items-center justify-between cursor-pointer"
            data-testid={`currency-option-${curr.code}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{curr.flag}</span>
              <span className="font-medium">{curr.symbol}</span>
              <span className="text-slate-600">{curr.code}</span>
            </div>
            {currency === curr.code && (
              <Check className="h-4 w-4 text-teal-600" />
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
