'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Loader2, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { toast } from 'sonner'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { ReferralYourStatusCard } from '@/components/referral/ReferralYourStatusCard'
import { ReferralActivityFeed } from '@/components/referral/ReferralActivityFeed'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

export default function ReferralProfilePage() {
  const router = useRouter()
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale = language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const { data: walletData } = useWalletMeQuery({
    enabled: !authLoading && isAuthenticated,
  })

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
        if (!cancelled) {
          if (refRes.ok && json?.success) setData(json.data || null)
          else toast.error(json?.error || t('referralStage726_loadErr'))
        }
      } catch {
        if (!cancelled) toast.error(t('referralStage726_pageErr'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, router, t])

  async function copyText(value) {
    const v = String(value || '').trim()
    if (!v) return
    try {
      await navigator.clipboard.writeText(v)
      toast.success(t('referralStage726_linkCopied'))
    } catch {
      toast.error(t('referralStage726_copyFail'))
    }
  }

  const displayName = String(data?.marketingCard?.displayName || '').trim() || 'Ambassador'
  const brand = String(data?.brandName || '').trim() || 'Platform'
  const inviteLink = String(data?.referralLandingUrl || data?.referralLink || '').trim()
  const welcomeCode = String(data?.code || '').trim() || 'AIR-XXXXXX'

  const postTexts = useMemo(
    () => [
      {
        id: 'short',
        label: t('stage77_postTextShortLabel'),
        value: String(t('stage77_postTextShortTemplate')).replace(/\{brand\}/g, brand).replace(/\{link\}/g, inviteLink),
      },
      {
        id: 'medium',
        label: t('stage77_postTextMediumLabel'),
        value: String(t('stage77_postTextMediumTemplate'))
          .replace(/\{brand\}/g, brand)
          .replace(/\{link\}/g, inviteLink),
      },
      {
        id: 'long',
        label: t('stage77_postTextLongLabel'),
        value: String(t('stage77_postTextLongTemplate')).replace(/\{brand\}/g, brand).replace(/\{link\}/g, inviteLink),
      },
    ],
    [t, brand, inviteLink],
  )

  if (authLoading || loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="py-10 flex items-center justify-center text-slate-600">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {t('referralStage726_load')}
          </CardContent>
        </Card>
      </div>
    )
  }

  const payout = walletData?.payout || null
  const balance = walletData?.wallet || {}

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Tabs defaultValue="wallet" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="wallet">Кошелек</TabsTrigger>
          <TabsTrigger value="invite">Пригласить</TabsTrigger>
          <TabsTrigger value="status">Мой статус</TabsTrigger>
        </TabsList>

        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-teal-700" />
                Ваш баланс
              </CardTitle>
              <CardDescription>Просто и понятно: сколько у вас сейчас доступно.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Всего</p>
                  <p className="text-lg font-semibold tabular-nums">{formatThb(balance.balance_thb, locale)} THB</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Доступно к выводу</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatThb(balance.withdrawable_balance_thb, locale)} THB
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Доступен вывод</p>
                  <p className={`text-sm font-medium ${payout?.payoutEligible ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {payout?.payoutEligible ? 'Да' : 'Пока нет'}
                  </p>
                </div>
              </div>
              <Button type="button" onClick={() => router.push('/partner/finances')}>
                Перейти к выводу средств
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Пригласите друга</CardTitle>
              <CardDescription>Сначала ссылка и QR, потом все дополнительные материалы.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  {inviteLink ? (
                    <QRCodeSVG value={inviteLink} size={170} level="M" includeMargin />
                  ) : (
                    <div className="w-[170px] h-[170px] rounded bg-slate-100" />
                  )}
                </div>
                <div className="w-full space-y-2">
                  <p className="text-xs text-slate-500">Ваш код</p>
                  <Input value={welcomeCode} readOnly className="font-semibold tracking-wide" />
                  <p className="text-xs text-slate-500">Ваша ссылка</p>
                  <div className="flex gap-2">
                    <Input value={inviteLink} readOnly />
                    <Button type="button" variant="outline" onClick={() => void copyText(inviteLink)}>
                      <Copy className="h-4 w-4 mr-1" />
                      {t('referralStage726_copy')}
                    </Button>
                  </div>
                </div>
              </div>

              <Accordion type="single" collapsible className="w-full border rounded-lg px-3">
                <AccordionItem value="posts" className="border-b-0">
                  <AccordionTrigger>Готовые тексты для постов</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {postTexts.map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-medium text-slate-600">{item.label}</p>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{item.value}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => void copyText(item.value)}
                        >
                          Скопировать
                        </Button>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <ReferralYourStatusCard
            t={t}
            locale={locale}
            ambassador={data?.ambassador}
            badgesEarned={data?.referralGamification?.badgesEarned}
            statusSubtitle=""
            brandName={brand}
            displayName={displayName}
            ledgerFootnote=""
          />
          {Array.isArray(data?.teamMembers) && data.teamMembers.length > 0 ? (
            <ReferralActivityFeed />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
