import { cookies } from 'next/headers'
import { getPublicSiteUrl } from '@/lib/site-url'
import { getUIText, DEFAULT_UI_LANGUAGE } from '@/lib/translations'
import { normalizeUiLocaleCode } from '@/lib/i18n/locale-resolver'

export async function generateMetadata({ params }) {
  const { id: userId } = await params
  const uid = userId != null ? String(userId).trim() : ''
  const jar = cookies()
  const lang = normalizeUiLocaleCode(jar.get('gostaylo_language')?.value || DEFAULT_UI_LANGUAGE)

  let displayName = ''
  let notFound = false
  if (uid) {
    try {
      const base = getPublicSiteUrl()
      const res = await fetch(`${base}/api/v2/referral/landing-meta/${encodeURIComponent(uid)}`, {
        cache: 'no-store',
      })
      if (res.status === 404) notFound = true
      else if (res.ok) {
        const j = await res.json().catch(() => ({}))
        if (j?.success && j?.data?.displayName) displayName = String(j.data.displayName).trim()
      }
    } catch {
      /* ignore */
    }
  }

  const nameForTitle = displayName || getUIText('stage74_4_uMetaNameFallback', lang)
  const titleRaw = getUIText('stage74_4_uMetaTitle', lang)
  const title = titleRaw.replace('{name}', nameForTitle)
  const description = getUIText('stage74_4_uMetaDescription', lang)

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
