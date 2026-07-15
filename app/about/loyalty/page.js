import { cookies, headers } from 'next/headers'
import { getUIText, getLangFromRequest } from '@/lib/translations'
import { Suspense } from 'react'
import { getSiteDisplayName } from '@/lib/site-url'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getCachedWelcomeBonusAmountThb } from '@/lib/server/welcome-bonus-public'
import { AboutLoyaltyClient } from '@/components/about/AboutLoyaltyClient'
import { normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver'
import { formatAmbassadorAmountForOgLangAsync } from '@/lib/pricing/ambassador-og-amount.js'

export const dynamic = 'force-dynamic'

const OG_LOCALE_BY_LANG = {
  ru: 'ru_RU',
  en: 'en_US',
  zh: 'zh_CN',
  th: 'th_TH',
}

const HREFLANG_BY_LANG = {
  ru: 'ru-RU',
  en: 'en-US',
  zh: 'zh-CN',
  th: 'th-TH',
}

function formatWelcomeForMeta(n) {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? String(v) : '0'
}

async function buildLoyaltySeoCtx(lang, welcomeBonusThb) {
  const welcomeAmount = await formatAmbassadorAmountForOgLangAsync(welcomeBonusThb, lang)
  return { welcomeAmount, welcomeThb: formatWelcomeForMeta(welcomeBonusThb) }
}

function readLangQuery(searchParams) {
  if (!searchParams) return null
  const raw =
    typeof searchParams.get === 'function'
      ? searchParams.get('lang')
      : searchParams.lang != null
        ? String(searchParams.lang)
        : null
  if (raw == null || raw === '') return null
  const first = Array.isArray(raw) ? raw[0] : raw
  return normalizeUiLocaleCode(first)
}

export async function generateMetadata({ searchParams }) {
  const cookieStore = await cookies()
  const headersList = await headers()
  const urlLang = readLangQuery(searchParams)
  const lang = urlLang || getLangFromRequest(cookieStore, headersList)
  const welcomeBonusThb = await getCachedWelcomeBonusAmountThb()
  const ctx = await buildLoyaltySeoCtx(lang, welcomeBonusThb)
  const title = getUIText('seo_loyalty_title', lang, ctx)
  const description = getUIText('seo_loyalty_description', lang, ctx)
  const ogLocale = OG_LOCALE_BY_LANG[lang] || 'en_US'
  const siteUrl = (await getRequestSiteUrl()).replace(/\/$/, '')
  const canonical = `${siteUrl}/about/loyalty`
  const languages = {
    'x-default': canonical,
    ...Object.fromEntries(
      ['ru', 'en', 'zh', 'th'].map((code) => {
        const tag = HREFLANG_BY_LANG[code] || code
        const qs = code === 'ru' ? '' : `?lang=${encodeURIComponent(code)}`
        return [tag, `${canonical}${qs}`]
      }),
    ),
  }

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: { title, description, type: 'website', locale: ogLocale, url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function AboutLoyaltyPage() {
  const welcomeBonusThb = await getCachedWelcomeBonusAmountThb()
  const brandDisplayName = getSiteDisplayName()
  return (
    <Suspense fallback={<div className="min-h-[40vh] bg-brand-surface" aria-hidden />}>
      <AboutLoyaltyClient welcomeBonusThb={welcomeBonusThb} brandDisplayName={brandDisplayName} />
    </Suspense>
  )
}
