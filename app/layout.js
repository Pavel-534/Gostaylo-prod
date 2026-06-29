import { inter, cormorant } from '@/lib/theme/app-fonts'
import './globals.css'
import { Toaster } from 'sonner'
import GeoSuggestToast from '@/components/geo/GeoSuggestToast'
import { AppHeader } from '@/components/app-header/AppHeader'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { MainContent } from '@/components/main-content'
import { AuthProvider } from '@/contexts/auth-context'
import { I18nProvider } from '@/contexts/i18n-context'
import { CurrencyProvider } from '@/contexts/currency-context'
import { ChatProvider } from '@/lib/context/ChatContext'
import { PresenceProvider } from '@/lib/context/PresenceContext'
import { SupabaseRealtimeAuthSync } from '@/components/supabase-realtime-auth-sync'
import { PushClientInit } from '@/components/push-client-init'
import { AppQueryProvider } from '@/components/providers/app-query-provider'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getSiteDisplayName } from '@/lib/site-url'
import GlobalSiteJsonLd from '@/components/seo/GlobalSiteJsonLd'
import { ProductAnalyticsInit } from '@/components/analytics/ProductAnalyticsInit'
import { PwaInstallChrome } from '@/components/pwa/PwaInstallChrome'
import { PwaInstallProvider } from '@/hooks/use-pwa-install'
import { SwRegister } from '@/components/sw-register'
import { ChunkLoadResilience } from '@/components/pwa/ChunkLoadResilience'
import { buildOgImageMetadata } from '@/lib/seo/resolve-og-image.js'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { GeoProvider } from '@/contexts/geo-context'
import { IS_RUSSIA_COOKIE, getIsRussiaFromRequest } from '@/lib/geo'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d9488',
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
    // Яндекс.Вебмастер (метод «Метатег»); файл yandex_*.html в public/ — метод «HTML-файл»
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
        {/* Минимальная подстраховка, если .css из /_next/static не загрузились (сеть / Edge). */}
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
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appleTitle} />
        <meta name="theme-color" content="#0d9488" />
        <GlobalSiteJsonLd />
      </head>
      <body className={`${inter.variable} ${cormorant.variable} font-sans`}>
        <I18nProvider>
          <CurrencyProvider>
          <GeoProvider initialIsRussia={initialIsRussia}>
          <AuthProvider>
            <AppQueryProvider>
              <PwaInstallProvider>
              <SwRegister />
              <ChunkLoadResilience />
              <SupabaseRealtimeAuthSync />
              <PushClientInit />
              <Suspense fallback={null}>
                <ProductAnalyticsInit />
              </Suspense>
              <PresenceProvider>
                <ChatProvider>
                  <AppHeader />
                  <MainContent>{children}</MainContent>
                <MobileBottomNav />
                <PwaInstallChrome />
                <GeoSuggestToast />
                <Toaster
                  position="top-center"
                  richColors
                  closeButton
                  toastOptions={{
                    classNames: {
                      toast:
                        'group rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-lg shadow-slate-900/10',
                      title: 'text-slate-900 font-semibold',
                      description: 'text-slate-600 text-sm',
                      success: 'border-emerald-200/80',
                      error: 'border-rose-200/80',
                      warning: 'border-amber-200/80',
                      info: 'border-sky-200/80',
                    },
                  }}
                />
                </ChatProvider>
              </PresenceProvider>
              </PwaInstallProvider>
            </AppQueryProvider>
          </AuthProvider>
          </GeoProvider>
          </CurrencyProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
