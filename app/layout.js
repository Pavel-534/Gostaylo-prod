import { inter, cormorant } from '@/lib/theme/app-fonts'
import { RootClientProviders } from '@/components/providers/RootClientProviders'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getSiteDisplayName } from '@/lib/site-url'
import GlobalSiteJsonLd from '@/components/seo/GlobalSiteJsonLd'
import { buildOgImageMetadata } from '@/lib/seo/resolve-og-image.js'
import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { IS_RUSSIA_COOKIE, getIsRussiaFromRequest } from '@/lib/geo'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d9488',
  /** Stage 171.42 — iOS standalone safe-area (notch / home indicator). */
  viewportFit: 'cover',
}

export async function generateMetadata() {
  const siteUrl = await getRequestSiteUrl()
  const brand = getSiteDisplayName()
  const cookieStore = await cookies()
  const headersList = await headers()
  const lang = getLangFromRequest(cookieStore, headersList)
  const title =
    lang === 'ru' ? `${brand} — аренда по всему миру` : `${brand} - Rentals Worldwide`
  const description =
    lang === 'ru'
      ? `${brand} — бронирование жилья, транспорта, яхт и туров с онлайн-предоплатой и защитой эскроу до заселения.`
      : `${brand} — book homes, transport, yachts and tours with secure online prepayment and escrow until check-in.`
  const ogDescription =
    lang === 'ru'
      ? `Аренда с онлайн-бронированием и безопасной предоплатой (эскроу).`
      : `Rentals with online booking and secure prepayment (escrow).`
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords:
      'бронирование, аренда жилья, транспорт, яхты, онлайн оплата, эскроу, rentals, villas, yachts, booking, escrow',
    authors: [{ name: brand }],
    openGraph: {
      title,
      description: ogDescription,
      url: siteUrl,
      siteName: brand,
      locale: 'en_US',
      type: 'website',
      images: buildOgImageMetadata(null, siteUrl, title),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ogDescription,
      images: buildOgImageMetadata(null, siteUrl, title).map((i) => i.url),
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: brand,
    },
    verification: {
      yandex: '2a8838b0c4b76c2d',
    },
  }
}

export default async function RootLayout({ children }) {
  const appleTitle = getSiteDisplayName()
  const cookieStore = await cookies()
  const headersList = await headers()
  const initialIsRussia = getIsRussiaFromRequest({
    headers: headersList,
    cookieValue: cookieStore.get(IS_RUSSIA_COOKIE)?.value,
  })
  return (
    <html lang="ru">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
:root{color-scheme:light}
html{line-height:1.5;-webkit-text-size-adjust:100%}
body{margin:0;background:#f8fafc;color:#0f172a}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
a{color:#0d9488}
img,svg,video{max-width:100%;height:auto}
button{font:inherit}
`,
          }}
        />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
        <link rel="apple-touch-icon" href="/icons/icon-180x180.png" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appleTitle} />
        <meta name="theme-color" content="#0d9488" />
        <GlobalSiteJsonLd />
      </head>
      <body className={`${inter.variable} ${cormorant.variable} font-sans`}>
        <RootClientProviders initialIsRussia={initialIsRussia}>{children}</RootClientProviders>
      </body>
    </html>
  )
}
