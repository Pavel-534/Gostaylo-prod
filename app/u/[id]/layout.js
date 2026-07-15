import { getPublicSiteUrl } from '@/lib/site-url'
import { getUIText } from '@/lib/translations'
import { resolveOgLocale } from '@/lib/referral/resolve-og-locale.js'
import { formatAmbassadorAmountForOgLangAsync } from '@/lib/pricing/ambassador-og-amount.js'

export async function generateMetadata({ params }) {
  const { id: userId } = await params
  const uid = userId != null ? String(userId).trim() : ''
  const lang = await resolveOgLocale()

  let displayName = ''
  let notFound = false
  let description = getUIText('stage1322_uMetaDescription', lang).replace(
    '{name}',
    getUIText('stage74_4_uMetaNameFallback', lang),
  )
  if (uid) {
    try {
      const base = getPublicSiteUrl()
      const res = await fetch(`${base}/api/v2/referral/landing-meta/${encodeURIComponent(uid)}`, {
        cache: 'no-store',
      })
      if (res.status === 404) notFound = true
      else if (res.ok) {
        const j = await res.json().catch(() => ({}))
        if (j?.success && j?.data) {
          if (j.data.displayName) displayName = String(j.data.displayName).trim()
          const earned = Number(j.data.totalEarnedThb)
          if (Number.isFinite(earned) && earned > 0) {
            const earnedAmount = await formatAmbassadorAmountForOgLangAsync(earned, lang)
            description = getUIText('stage1143_uMetaDescriptionEarned', lang)
              .replace('{name}', displayName || getUIText('stage74_4_uMetaNameFallback', lang))
              .replace('{earnedAmount}', earnedAmount)
          } else if (displayName) {
            description = getUIText('stage1322_uMetaDescription', lang).replace('{name}', displayName)
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const nameForTitle = displayName || getUIText('stage74_4_uMetaNameFallback', lang)
  const titleRaw = getUIText('stage74_4_uMetaTitle', lang)
  const title = titleRaw.replace('{name}', nameForTitle)

  const metadataBase = new URL(getPublicSiteUrl())
  const ogImage = `/u/${encodeURIComponent(uid)}/opengraph-image`

  return {
    metadataBase,
    title,
    description,
    robots: notFound ? { index: false, follow: false } : { index: true, follow: true },
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

export default function PublicUserProfileLayout({ children }) {
  return children
}
