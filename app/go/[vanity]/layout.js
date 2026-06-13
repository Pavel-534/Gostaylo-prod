import { cookies } from 'next/headers'
import { getPublicSiteUrl } from '@/lib/site-url'
import { getUIText, DEFAULT_UI_LANGUAGE } from '@/lib/translations'
import { normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver'
import { resolveReferrerByVanityCode } from '@/lib/services/marketing/referral-vanity.service.js'

export async function generateMetadata({ params }) {
  const vanity = String((await params)?.vanity || '').trim()
  if (!vanity) return {}

  const resolved = await resolveReferrerByVanityCode(vanity)
  if (!resolved?.data?.referrerProfile?.id) {
    return { robots: { index: false, follow: false } }
  }

  const uid = String(resolved.data.referrerProfile.id).trim()
  const jar = cookies()
  const lang = normalizeUiLocaleCode(jar.get('gostaylo_language')?.value || DEFAULT_UI_LANGUAGE)

  let displayName = ''
  let description = getUIText('stage74_4_uMetaDescription', lang)
  try {
    const base = getPublicSiteUrl()
    const res = await fetch(`${base}/api/v2/referral/landing-meta/${encodeURIComponent(uid)}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const j = await res.json().catch(() => ({}))
      if (j?.success && j?.data) {
        if (j.data.displayName) displayName = String(j.data.displayName).trim()
        const earned = Number(j.data.totalEarnedThb)
        if (Number.isFinite(earned) && earned > 0) {
          const earnedLabel = earned.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
          description = getUIText('stage1143_uMetaDescriptionEarned', lang)
            .replace('{name}', displayName || getUIText('stage74_4_uMetaNameFallback', lang))
            .replace('{earned}', earnedLabel)
        }
      }
    }
  } catch {
    /* ignore */
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
