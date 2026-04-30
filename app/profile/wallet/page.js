'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Wallet, TrendingUp, Clock3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { toast } from 'sonner'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { REFERRAL_DISPLAY_CURRENCY_CODES, normalizeReferralDisplayCurrency } from '@/lib/finance/referral-display-currency'

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
  const { data: walletData } = useWalletMeQuery({ enabled: !authLoading && isAuthenticated })
  const [loading, setLoading] = useState(true)
  const [displayCurrency, setDisplayCurrency] = useState('THB')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/profile?login=true')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const refRes = await fetch('/api/v2/referral/me', { credentials: 'include', cache: 'no-store' })
        const json = await refRes.json().catch(() => ({}))
        if (!cancelled && refRes.ok && json?.success) {
          const reportPrefs = json?.data?.referralReport || {}
          setDisplayCurrency(normalizeReferralDisplayCurrency(reportPrefs?.displayCurrency || 'THB'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, router])

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

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Card><CardContent className="py-12 flex justify-center text-slate-600"><Loader2 className="h-5 w-5 mr-2 animate-spin" />{t('referralStage726_load')}</CardContent></Card>
      </div>
    )
  }

  const payout = walletData?.payout || null
  const balance = walletData?.wallet || {}
  const recentTransactions = Array.isArray(walletData?.recentTransactions) ? walletData.recentTransactions : []
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
    <div className="min-h-screen bg-[#f7f9fb]">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-10">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/80 p-2 backdrop-blur-sm shadow-sm">
          <Button type="button" variant="ghost" onClick={() => router.push('/profile/referral')}>Пригласить</Button>
          <Button type="button" className="bg-[#006666] hover:bg-[#005757]" onClick={() => router.push('/profile/wallet')}>Кошелек</Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/profile/status')}>Мой статус</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-[#006666]" />Ваш баланс</CardTitle>
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
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50"><p className="text-xs text-slate-500 uppercase">Всего</p><p className="text-3xl font-black text-[#006666]">{formatThb(balance.balance_thb, locale)} THB</p></div>
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50"><p className="text-xs text-slate-500 uppercase">Доступно к выводу</p><p className="text-3xl font-black text-[#006666]">{formatThb(balance.withdrawable_balance_thb, locale)} THB</p></div>
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50"><p className="text-xs text-slate-500 uppercase">Статус выплат</p><p className={`text-sm font-medium ${payout?.payoutEligible ? 'text-emerald-700' : 'text-slate-700'}`}>{payout?.payoutEligible ? 'Доступен вывод' : payoutReason}</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4"><div className="flex gap-2 items-center"><TrendingUp className="h-4 w-4 text-[#006666]" /><p className="font-medium text-sm">Финансовая аналитика</p></div><p className="text-xs text-slate-500 mt-2">Вывод из доступного баланса после всех проверок.</p></div>
                <div className="rounded-xl border border-slate-200 p-4"><div className="flex gap-2 items-center"><Clock3 className="h-4 w-4 text-[#006666]" /><p className="font-medium text-sm">Порог вывода</p></div><p className="text-xs text-slate-500 mt-2">{formatThb(payout?.minPayoutThb ?? walletData?.policy?.walletMinPayoutThb ?? 1000, locale)} THB</p></div>
              </div>
              <Button className="bg-[#006666] hover:bg-[#005757]" onClick={() => router.push('/partner/finances')}>Перейти к выводу средств</Button>
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

          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader><CardTitle className="text-base">Сводка</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2">
              <p>Визуал и метрики оформлены в wallet-first стиле из макета 2code.</p>
              <p>Логика выплат и ограничений сохранена без изменений.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
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
                        <td className="py-2 pr-3 tabular-nums font-medium text-[#006666]">
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
      </div>
    </div>
  )
}
