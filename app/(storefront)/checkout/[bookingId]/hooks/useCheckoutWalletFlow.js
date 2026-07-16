import { useState, useEffect, useCallback } from 'react'
import { invalidateWalletMeQuery } from '@/lib/hooks/use-wallet-me'

export function useCheckoutWalletFlow({ user, booking, queryClient }) {
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletBalanceThb, setWalletBalanceThb] = useState(0)
  const [walletMaxDiscountPercent, setWalletMaxDiscountPercent] = useState(30)
  const [useWalletBonuses, setUseWalletBonuses] = useState(false)
  const [walletUseThb, setWalletUseThb] = useState(0)
  const [checkoutLegalConsent, setCheckoutLegalConsent] = useState(false)

  /** Stage 102.1: чекбокс оферты обязателен на каждой оплате (акцепт пишется в booking + profile). */
  const checkoutNeedsLegalConsent = Boolean(user?.id)

  useEffect(() => {
    if (!user?.id) setCheckoutLegalConsent(false)
  }, [user?.id])

  const loadWalletState = useCallback(async () => {
    setWalletLoading(true)
    try {
      const res = await fetch('/api/v2/wallet/me', {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await res.json()
      if (res.ok && data?.success) {
        const balance = Math.max(
          0,
          Math.round(
            Number(
              data?.data?.balances?.internalCreditsThb ??
                data?.data?.wallet?.internal_credits_thb ??
                data?.data?.wallet?.balance_thb ??
                0,
            ),
          ),
        )
        const maxDiscount = Number(data?.data?.policy?.walletMaxDiscountPercent || 30)
        setWalletBalanceThb(balance)
        setWalletMaxDiscountPercent(Number.isFinite(maxDiscount) ? Math.max(0, Math.min(100, maxDiscount)) : 30)
      } else {
        setWalletBalanceThb(0)
      }
    } catch {
      setWalletBalanceThb(0)
    } finally {
      setWalletLoading(false)
    }
  }, [])

  const refreshWalletEverywhere = useCallback(async () => {
    await invalidateWalletMeQuery(queryClient)
    await loadWalletState()
  }, [queryClient, loadWalletState])

  useEffect(() => {
    loadWalletState()
  }, [loadWalletState])

  useEffect(() => {
    if (!booking) return
    const total = Math.round(
      Number(booking?.priceThb || 0) + Number(booking?.commissionThb || 0) + Number(booking?.roundingDiffPot || 0),
    )
    const maxByPercent = Math.round((total * walletMaxDiscountPercent) / 100)
    const maxByPlatformFee = Math.max(0, Math.round(Number(booking?.commissionThb || 0)))
    const cap = Math.max(0, Math.min(walletBalanceThb, maxByPercent, maxByPlatformFee))
    setWalletUseThb(useWalletBonuses ? cap : 0)
  }, [booking, walletBalanceThb, walletMaxDiscountPercent, useWalletBonuses])

  const acceptedLegalTermsForPayment = checkoutLegalConsent

  return {
    walletLoading,
    walletBalanceThb,
    walletMaxDiscountPercent,
    useWalletBonuses,
    setUseWalletBonuses,
    walletUseThb,
    setWalletUseThb,
    checkoutNeedsLegalConsent,
    checkoutLegalConsent,
    setCheckoutLegalConsent,
    acceptedLegalTermsForPayment,
    loadWalletState,
    refreshWalletEverywhere,
  }
}

export default useCheckoutWalletFlow
