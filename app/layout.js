import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { UniversalHeader } from '@/components/universal-header'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { MainContent } from '@/components/main-content'
import { AuthProvider } from '@/contexts/auth-context'
import { I18nProvider } from '@/contexts/i18n-context'
import { ChatProvider } from '@/lib/context/ChatContext'
import { PresenceProvider } from '@/lib/context/PresenceContext'
import { SupabaseRealtimeAuthSync } from '@/components/supabase-realtime-auth-sync'
import { PushClientInit } from '@/components/push-client-init'
import { AppQueryProvider } from '@/components/providers/app-query-provider'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getSiteDisplayName } from '@/lib/site-url'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

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
  const title = `${brand} - Premium Global Rentals`
  const description = `Premium villas, yachts, transport and tours worldwide. Book your perfect stay with ${brand}.`
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords: 'rentals, villas, yachts, phuket, thailand, luxury, vacation, holiday',
    authors: [{ name: brand }],
    openGraph: {
      title,
      description: `Premium villas, yachts, transport and tours worldwide. Book your perfect stay.`,
      url: siteUrl,
      siteName: brand,
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: 'Premium villas, yachts, transport and tours worldwide.',
      images: ['/og-image.png'],
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
      </head>
      <body className={inter.className}>
        <I18nProvider>
          <AuthProvider>
            <AppQueryProvider>
              <SupabaseRealtimeAuthSync />
              <PushClientInit />
              <PresenceProvider>
                <ChatProvider>
                  <UniversalHeader />
                  <MainContent>{children}</MainContent>
                <MobileBottomNav />
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
            </AppQueryProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
