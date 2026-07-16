'use client'

/**
 * Checkout route client shell — i18n bootstrap + children (Stage 171.38).
 */
import { I18nSliceBootstrap } from '@/components/i18n/I18nSliceBootstrap'

export function CheckoutClientShell({ children }) {
  return (
    <>
      <I18nSliceBootstrap preset="checkout" />
      {children}
    </>
  )
}
