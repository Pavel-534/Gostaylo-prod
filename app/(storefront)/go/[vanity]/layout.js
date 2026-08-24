import { getPublicSiteUrl } from '@/lib/site-url'
import { getUIText } from '@/lib/translations'
import { resolveOgLocale } from '@/lib/referral/resolve-og-locale.js'
import { resolveReferrerByVanityCode } from '@/lib/services/marketing/referral-vanity.service.js'
import { formatAmbassadorAmountForOgLangAsync } from '@/lib/pricing/ambassador-og-amount.js'
import { getCachedPublicLandingMeta } from '@/lib/referral/get-cached-public-landing-meta.js'

export async function generateMetadata({ params }) {
  const vanity = String((await params)?.vanity || '').trim()
  if (!vanity) return {}

  const resolved = await resolveReferrerByVanityCode(vanity)
  if (!resolved?.data?.referrerProfile?.id) {
    return { robots: { index: false, follow: false } }
  }

  const uid = String(resolved.data.referrerProfile.id).trim()
  const lang = await resolveOgLocale()
  let displayName = ''
  let description = getUIText('stage1322_uMetaDescription', lang).replace(
    '{name}',
    getUIText('stage74_4_uMetaNameFallback', lang),
  )
  try {
    const data = await getCachedPublicLandingMeta(uid)
    if (data) {
      if (data.displayName) displayName = String(data.displayName).trim()
      const earned = Number(data.totalEarnedThb)
      if (Number.isFinite(earned) && earned > 0) {
        const earnedAmount = await formatAmbassadorAmountForOgLangAsync(earned, lang)
        description = getUIText('stage1143_uMetaDescriptionEarned', lang)
          .replace('{name}', displayName || getUIText('stage74_4_uMetaNameFallback', lang))
          .replace('{earnedAmount}', earnedAmount)
      } else if (displayName) {
        description = getUIText('stage1322_uMetaDescription', lang).replace('{name}', displayName)
      }
    }
  } catch {
    /* ignore */
  }

  const nameForTitle = displayName || getUIText('stage74_4_uMetaNameFallback', lang)
  const titleRaw = getUIText('stage74_4_uMetaTitle', lang)
  const title = titleRaw.replace('{name}', nameForTitle)

  const metadataBase = new URL(getPublicSiteUrl())
  const ogImage = `/u/${encodeURIComponent(uid)}/opengraph-image?v=20260821`

  return {
    metadataBase,
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: lang === 'ru' ? 'ru_RU' : lang === 'en' ? 'en_US' : lang === 'zh' ? 'zh_CN' : 'th_TH',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default function VanityGoLayout({ children }) {
  return children
}
