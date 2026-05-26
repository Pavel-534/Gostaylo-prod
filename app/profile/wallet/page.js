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
import { toast } from 'sonner'
import { useWalletMeQuery, invalidateWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { useReferralMeQuery } from '@/lib/hooks/use-referral-me'
import { normalizeReferralDisplayCurrency } from '@/lib/finance/referral-display-currency'
import { REFERRAL_DISPLAY_CURRENCY_CODES } from '@/lib/finance/referral-display-currency'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

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
  const [displayCurrency, setDisplayCurrency] = useState('THB')
  const [withdrawRequesting, setWithdrawRequesting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/profile?login=true')
      return
    }
    const reportPrefs = referralData?.referralReport || {}
    setDisplayCurrency(normalizeReferralDisplayCurrency(reportPrefs?.displayCurrency || 'THB'))
  }, [authLoading, isAuthenticated, referralData, router])

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
    setDisplayCurrency(safe)
    try {
      await patchProfile({ referral_display_currency: safe })
      toast.success('Валюта статистики обновлена')
    } catch (e) {
      toast.error(e?.message || 'Не удалось сохранить валюту')
    }
  }

  function txTypeLabel(v) {
    const x = String(v || '').toLowerCase()
    if (x === 'referral_bonus') return 'Бонус за друга'
    if (x === 'referral_cashback') return 'Ваш кешбэк'
    if (x === 'welcome_bonus') return 'Приветственный бонус'
    return 'Операция'
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
      toast.error(e?.message || 'Не удалось отправить заявку')
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
  const blockers = Array.isArray(payout?.blockers) ? payout.blockers : []
  const payoutReason =
    blockers.includes('BELOW_MIN_PAYOUT')
      ? `Минимальный порог ${formatThb(payout?.minPayoutThb ?? walletData?.policy?.walletMinPayoutThb ?? 1000, locale)} THB`
      : blockers.includes('PROFILE_NOT_VERIFIED')
        ? 'Требуется KYC (верификация профиля)'
        : blockers.includes('WALLET_NOT_CLEARED_FOR_PAYOUT')
          ? 'Нужен админ-допуск: «Доступен вывод»'
          : 'Готов к выводу'

  return (
    <ProductPageShell containerClassName="space-y-8 sm:space-y-10">
      <ProfileHubNav t={t} />
      <PageSectionHeader
        title={t('stage1143_tabNavWallet')}
        subtitle={t('referralStage726_unifiedBalanceSubtitle')}
      />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className={`lg:col-span-2 ${GSL_CARD} gsl-card-hover`}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-brand" />Ваш баланс</CardTitle>
                  <CardDescription>Кошелек и контроль выплат в одном экране.</CardDescription>
                </div>
                <div className="w-full sm:w-[220px] space-y-1">
                  <Label htmlFor="referral-display-currency">Валюта статистики</Label>
                  <Select value={displayCurrency} onValueChange={(v) => void saveDisplayCurrency(v)}>
                    <SelectTrigger id="referral-display-currency"><SelectValue placeholder="THB" /></SelectTrigger>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50"><p className="text-xs text-slate-500 uppercase">Всего</p><p className="text-3xl font-black text-brand">{formatThb(balance.balance_thb, locale)} THB</p></div>
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50"><p className="text-xs text-slate-500 uppercase">Доступно к выводу</p><p className="text-3xl font-black text-brand">{formatThb(balance.withdrawable_balance_thb, locale)} THB</p></div>
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50"><p className="text-xs text-slate-500 uppercase">Статус выплат</p><p className={`text-sm font-medium ${payout?.payoutEligible ? 'text-emerald-700' : 'text-slate-700'}`}>{payout?.payoutEligible ? 'Доступен вывод' : payoutReason}</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4"><div className="flex gap-2 items-center"><TrendingUp className="h-4 w-4 text-brand" /><p className="font-medium text-sm">Финансовая аналитика</p></div><p className="text-xs text-slate-500 mt-2">Вывод из доступного баланса после всех проверок.</p></div>
                <div className="rounded-xl border border-slate-200 p-4"><div className="flex gap-2 items-center"><Clock3 className="h-4 w-4 text-brand" /><p className="font-medium text-sm">Порог вывода</p></div><p className="text-xs text-slate-500 mt-2">{formatThb(payout?.minPayoutThb ?? walletData?.policy?.walletMinPayoutThb ?? 1000, locale)} THB</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="brand"
                  disabled={!payout?.payoutEligible || withdrawRequesting || referralWithdrawRequested}
                  onClick={() => void requestReferralWithdrawal()}
                >
                  {referralWithdrawRequested
                    ? 'Заявка на вывод реферальных отправлена'
                    : withdrawRequesting
                      ? 'Отправка…'
                      : t('stage1143_oneClickWithdraw')}
                </Button>
                <Button variant="outline" onClick={() => router.push('/partner/finances')}>
                  Партнёрский вывод
                </Button>
              </div>
              {referralWithdrawRequested ? (
                <p className="text-xs text-emerald-700">
                  Статус: withdrawable_referral — оператор обработает выплату в админ-пульте.
                </p>
              ) : null}
              <Accordion type="single" collapsible className="w-full border rounded-xl px-3 bg-white">
                <AccordionItem value="rules" className="border-b-0">
                  <AccordionTrigger>Подробнее о начислениях</AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-700 space-y-2">
                    <p>«Бонус за друга» делится по правилу <code>payout_to_internal_ratio</code>.</p>
                    <p>«Ваш кешбэк» и welcome бонусы идут во внутренний баланс.</p>
                    <p>Вывод открывается при выполнении порога, KYC и админ-допуска.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card className={`${GSL_CARD} gsl-card-hover`}>
            <CardHeader><CardTitle className="text-base">Сводка</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2">
              <p>Визуал и метрики оформлены в wallet-first стиле из макета 2code.</p>
              <p>Логика выплат и ограничений сохранена без изменений.</p>
            </CardContent>
          </Card>
        </div>

        <Card className={`${GSL_CARD} gsl-card-hover`}>
          <CardHeader><CardTitle className="text-base">Последние операции</CardTitle></CardHeader>
          <CardContent>
            {!recentTransactions.length ? (
              <p className="text-sm text-slate-600">Пока нет операций.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">Тип</th>
                      <th className="py-2 pr-3 font-medium">Сумма</th>
                      <th className="py-2 font-medium">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.slice(0, 12).map((tx) => (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{txTypeLabel(tx.tx_type)}</td>
                        <td className="py-2 pr-3 tabular-nums font-medium text-brand">
                          {Number(tx.amount_thb || 0) >= 0 ? '+' : ''}
                          {formatThb(tx.amount_thb, locale)} THB
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
    </ProductPageShell>
  )
}
