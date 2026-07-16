'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Wallet, TrendingUp, Clock3 } from 'lucide-react'
import { ProfileHubNav } from '@/components/product/ProfileHubNav'
import { ProductPageShell } from '@/components/product/ProductPageShell'
import { LoadingPageShell } from '@/components/product/LoadingPageShell'
import { PageSectionHeader } from '@/components/product/PageSectionHeader'
import { GSL_CARD } from '@/lib/theme/product-ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useWalletMeQuery, invalidateWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { useReferralMeQuery } from '@/lib/hooks/use-referral-me'
import { normalizeReferralDisplayCurrency, REFERRAL_DISPLAY_CURRENCY_CODES } from '@/lib/finance/referral-display-currency'
import { ReferralBalanceBreakdown } from '@/components/referral/ReferralBalanceBreakdown'
import { ReferralPayoutBlockers } from '@/components/referral/ReferralPayoutBlockers'
import { ReferralWithdrawalWaterfall } from '@/components/referral/ReferralWithdrawalWaterfall'
import { ReferralWithdrawalHistory } from '@/components/referral/ReferralWithdrawalHistory'
import { ReferralWithdrawalStatusBanner } from '@/components/referral/ReferralWithdrawalStatusBanner'
import { ReferralWalletStickyWithdraw } from '@/components/referral/ReferralWalletStickyWithdraw'
import { useCurrency } from '@/contexts/currency-context'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'

export default function ProfileWalletPage() {
  const router = useRouter()
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale = language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const { isAuthenticated, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const { data: walletData, isLoading: walletLoading, refetch: refetchWallet } = useWalletMeQuery({
    enabled: !authLoading && isAuthenticated,
  })
  const { data: referralData, isLoading: referralLoading } = useReferralMeQuery({
    enabled: !authLoading && isAuthenticated,
  })
  const { currency, setCurrency } = useCurrency()
  const { formatLedgerWithApprox, formatMinPayoutThreshold } = useReferralLedgerDisplay()
  const [withdrawRequesting, setWithdrawRequesting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/profile?login=true')
      return
    }
    const reportPrefs = referralData?.referralReport || {}
    const saved = normalizeReferralDisplayCurrency(reportPrefs?.displayCurrency || '')
    const headerExplicit =
      typeof window !== 'undefined' && localStorage.getItem('gostaylo_currency_explicit') === '1'
    if (saved && saved !== currency && !headerExplicit) setCurrency(saved)
  }, [authLoading, isAuthenticated, referralData, router, currency, setCurrency])

  async function patchProfile(payload) {
    const res = await fetch('/api/v2/profile/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.success) throw new Error(json?.error || 'PROFILE_PATCH_FAILED')
  }

  async function saveDisplayCurrency(nextCur) {
    const safe = normalizeReferralDisplayCurrency(nextCur)
    setCurrency(safe)
    try {
      await patchProfile({ referral_display_currency: safe })
      toast.success(t('stage1321_walletCurrencySaved'))
    } catch (e) {
      toast.error(e?.message || t('stage1321_walletCurrencySaveErr'))
    }
  }

  function txTypeLabel(v) {
    const x = String(v || '').toLowerCase()
    if (x === 'referral_bonus') return t('stage1321_walletTxReferralBonus')
    if (x === 'referral_cashback') return t('stage1321_walletTxCashback')
    if (x === 'welcome_bonus') return t('stage1321_walletTxWelcome')
    return t('stage1321_walletTxOther')
  }

  async function requestReferralWithdrawal() {
    setWithdrawRequesting(true)
    try {
      const res = await fetch('/api/v2/wallet/referral-withdrawal-request', {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        const blockers = Array.isArray(json?.blockers) ? json.blockers.join(', ') : ''
        throw new Error(json?.error || blockers || 'REFERRAL_WITHDRAWAL_REQUEST_FAILED')
      }
      toast.success(t('stage1143_oneClickSuccess'))
      await invalidateWalletMeQuery(queryClient)
      await refetchWallet()
    } catch (e) {
      toast.error(e?.message || t('stage1321_walletWithdrawErr'))
    } finally {
      setWithdrawRequesting(false)
    }
  }

  if (authLoading || walletLoading || referralLoading) {
    return <LoadingPageShell label={t('referralStage726_load')} />
  }

  const payout = walletData?.payout || null
  const balance = walletData?.wallet || {}
  const recentTransactions = Array.isArray(walletData?.recentTransactions) ? walletData.recentTransactions : []
  const referralWithdrawRequested = payout?.referralWithdrawalStatus === 'withdrawable_referral'
  const blockerDetails = Array.isArray(payout?.blockerDetails) ? payout.blockerDetails : []
  const payoutStatusLabel = (() => {
    if (payout?.payoutEligible) return t('stage1321_walletPayoutEligible')
    if (referralWithdrawRequested) return t('stage1321_walletPayoutRequested')
    const first = blockerDetails[0]
    if (first?.messageKey === 'stage1322_blockerBelowMin' || first?.code === 'BELOW_MIN_PAYOUT') {
      const minThb = Number(first?.messageCtx?.minPayoutThb ?? payout?.minPayoutThb ?? 1000)
      return t('stage1322_blockerBelowMin', { minAmount: formatMinPayoutThreshold(minThb) })
    }
    if (first?.messageKey) {
      return t(first.messageKey, first.messageCtx || {})
    }
    return t('stage1321_walletPayoutBlocked')
  })()

  const withdrawableThb = Number(balance.withdrawable_balance_thb ?? 0)
  const minPayoutThb = (() => {
    const n = Number(payout?.minPayoutThb ?? walletData?.policy?.walletMinPayoutThb)
    return Number.isFinite(n) && n > 0 ? n : 1000
  })()
  const stickyVisible =
    payout?.payoutEligible === true ||
    referralWithdrawRequested ||
    withdrawableThb >= minPayoutThb
  const stickyAmountLabel = withdrawableThb > 0 ? formatLedgerWithApprox(withdrawableThb) : ''
  const stickyDisabled =
    !payout?.payoutEligible ||
    referralWithdrawRequested ||
    withdrawRequesting ||
    blockerDetails.some((b) =>
      String(b?.code || '').startsWith('REFERRAL_RU_PAYOUT_PROFILE'),
    )

  return (
    <ProductPageShell
      containerClassName={cn(
        'space-y-8 sm:space-y-10',
        stickyVisible && 'app-shell-secondary-chrome-pad',
      )}
    >
      <ProfileHubNav t={t} />
      <PageSectionHeader
        title={t('stage1143_tabNavWallet')}
        subtitle={t('referralStage726_unifiedBalanceSubtitle')}
      />

      <ReferralBalanceBreakdown
        walletData={walletData}
        referralData={referralData}
        locale={locale}
        variant="full"
      />

      <ReferralWithdrawalStatusBanner
        walletData={walletData}
        locale={locale}
        onRetry={requestReferralWithdrawal}
        retryLoading={withdrawRequesting}
      />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className={`lg:col-span-2 ${GSL_CARD} gsl-card-hover`}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-brand" />
                    {t('stage1321_walletPayoutTitle')}
                  </CardTitle>
                  <CardDescription>{t('stage1321_walletPayoutSubtitle')}</CardDescription>
                </div>
                <div className="w-full sm:w-[220px] space-y-1">
                  <Label htmlFor="referral-display-currency">{t('stage1321_walletDisplayCurrency')}</Label>
                  <Select value={currency} onValueChange={(v) => void saveDisplayCurrency(v)}>
                    <SelectTrigger id="referral-display-currency"><SelectValue placeholder={currency} /></SelectTrigger>
                    <SelectContent>
                      {REFERRAL_DISPLAY_CURRENCY_CODES.map((code) => (
                        <SelectItem key={code} value={code}>{code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/80">
                <p className="text-xs text-slate-500 uppercase">{t('stage1321_walletPayoutStatusLabel')}</p>
                <p className={`text-sm font-medium mt-1 ${payout?.payoutEligible ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {payoutStatusLabel}
                </p>
              </div>

              {!payout?.payoutEligible && !referralWithdrawRequested ? (
                <ReferralPayoutBlockers blockerDetails={blockerDetails} />
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex gap-2 items-center">
                    <TrendingUp className="h-4 w-4 text-brand" />
                    <p className="font-medium text-sm">{t('stage1321_walletAnalyticsTitle')}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{t('stage1321_walletAnalyticsHint')}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex gap-2 items-center">
                    <Clock3 className="h-4 w-4 text-brand" />
                    <p className="font-medium text-sm">{t('stage1321_walletMinPayoutTitle')}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 break-words tabular-nums">
                    {formatMinPayoutThreshold(minPayoutThb)}
                  </p>
                </div>
              </div>
              <ReferralWithdrawalWaterfall
                maxWithdrawableThb={Number(balance.withdrawable_balance_thb ?? 0)}
                minPayoutThb={minPayoutThb}
                payoutEligible={payout?.payoutEligible === true}
                referralWithdrawRequested={referralWithdrawRequested}
                withdrawRequesting={withdrawRequesting}
                onRequestWithdraw={requestReferralWithdrawal}
                blockerDetails={blockerDetails}
                locale={locale}
                className="w-full max-w-full overflow-hidden"
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" onClick={() => router.push('/partner/finances')}>
                  {t('stage1321_walletPartnerPayoutCta')}
                </Button>
              </div>
              {referralWithdrawRequested ? (
                <p className="text-xs text-emerald-700">{t('stage1321_walletReferralQueued')}</p>
              ) : null}
              <Accordion type="single" collapsible className="w-full border rounded-xl px-3 bg-white">
                <AccordionItem value="rules" className="border-b-0">
                  <AccordionTrigger>{t('stage1321_walletAccrualRules')}</AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-700 space-y-2">
                    <p>{t('stage1321_walletAccrualRule1')}</p>
                    <p>{t('stage1321_walletAccrualRule2')}</p>
                    <p>{t('stage1321_walletAccrualRule3')}</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card className={`${GSL_CARD} gsl-card-hover`}>
            <CardHeader><CardTitle className="text-base">{t('stage1321_walletSummaryTitle')}</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2">
              <p>{t('stage1321_walletSummaryLine1')}</p>
              <p>{t('stage1321_walletSummaryLine2')}</p>
            </CardContent>
          </Card>
        </div>

        <ReferralWithdrawalHistory walletData={walletData} t={t} locale={locale} />

        <Card className={`${GSL_CARD} gsl-card-hover`}>
          <CardHeader><CardTitle className="text-base">{t('stage1321_walletRecentOpsTitle')}</CardTitle></CardHeader>
          <CardContent>
            {!recentTransactions.length ? (
              <p className="text-sm text-slate-600">{t('stage1321_walletRecentOpsEmpty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">{t('stage1321_walletTxTypeCol')}</th>
                      <th className="py-2 pr-3 font-medium">{t('stage1321_walletTxAmountCol')}</th>
                      <th className="py-2 font-medium">{t('stage1321_walletTxDateCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.slice(0, 12).map((tx) => (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{txTypeLabel(tx.tx_type)}</td>
                        <td className="py-2 pr-3 tabular-nums font-medium text-brand break-words">
                          {Number(tx.amount_thb || 0) >= 0 ? '+' : ''}
                          <ReferralLedgerAmount thb={tx.amount_thb} />
                        </td>
                        <td className="py-2 tabular-nums text-slate-500">{tx.created_at ? new Date(tx.created_at).toLocaleDateString(locale) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      <ReferralWalletStickyWithdraw
        visible={stickyVisible}
        disabled={stickyDisabled}
        loading={withdrawRequesting}
        requested={referralWithdrawRequested}
        amountLabel={stickyAmountLabel}
        onWithdraw={requestReferralWithdrawal}
      />
    </ProductPageShell>
  )
}
