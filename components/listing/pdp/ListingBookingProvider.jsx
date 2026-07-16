'use client'

/**
 * PDP booking island context — wraps `useListingBookingFlow` for calendar, pricing, modal.
 * Stage 171.24 (PR-5) — removes prop drill to `ListingBookingSection` / `ListingMobileActions`.
 */

import { createContext, useContext, useMemo } from 'react'
import { useListingBookingFlow } from '@/hooks/useListingBookingFlow'

/** @type {React.Context<null | ReturnType<typeof useListingBookingFlow> & ListingBookingProviderExtras>} */
const ListingBookingContext = createContext(null)

/**
 * @typedef {Object} ListingBookingProviderExtras
 * @property {object | null} listing
 * @property {object | null} user
 * @property {() => void} openLoginModal
 * @property {string} language
 * @property {string} currency
 * @property {object} exchangeRates
 */

/**
 * @param {object} props
 * @param {object | null} props.listing
 * @param {object | null} props.user
 * @param {() => void} props.openLoginModal
 * @param {string} props.language
 * @param {string} props.currency
 * @param {object} props.exchangeRates
 * @param {React.ReactNode} props.children
 */
export function ListingBookingProvider({
  listing,
  user,
  openLoginModal,
  language,
  currency,
  exchangeRates,
  children,
}) {
  const booking = useListingBookingFlow({
    listing,
    user,
    openLoginModal,
    language,
    currency,
    exchangeRates,
  })

  const value = useMemo(
    () => ({
      ...booking,
      listing,
      user,
      openLoginModal,
      language,
      currency,
      exchangeRates,
    }),
    [booking, listing, user, openLoginModal, language, currency, exchangeRates],
  )

  return (
    <ListingBookingContext.Provider value={value}>{children}</ListingBookingContext.Provider>
  )
}

/** @returns {ReturnType<typeof useListingBookingFlow> & ListingBookingProviderExtras} */
export function useListingBooking() {
  const ctx = useContext(ListingBookingContext)
  if (!ctx) {
    throw new Error('useListingBooking must be used within ListingBookingProvider')
  }
  return ctx
}
