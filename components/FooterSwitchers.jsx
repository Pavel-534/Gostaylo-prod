'use client'

/**
 * FooterSwitchers — thin footer chrome for Language + Currency.
 * SSOT controls: LangSwitcher + CurrencySelector (variant="footer").
 * Stage 200.3 — no duplicate emoji lists / hover menus.
 */

import { LangSwitcher } from '@/components/app-header/LangSwitcher'
import { CurrencySelector } from '@/components/currency-selector'
import { cn } from '@/lib/utils'

export function FooterSwitchers({ className = '' }) {
  return (
    <div
      data-testid="footer-switchers"
      className={cn('flex flex-wrap items-center gap-3', className)}
    >
      <LangSwitcher variant="footer" testid="footer-language-trigger" />
      <CurrencySelector variant="footer" compact testid="footer-currency-trigger" />
    </div>
  )
}

export default FooterSwitchers
