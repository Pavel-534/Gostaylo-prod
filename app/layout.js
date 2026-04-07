import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css' // Leaflet map styles
import { Toaster } from 'sonner'
import { UniversalHeader } from '@/components/universal-header'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { MainContent } from '@/components/main-content'
import { AuthProvider } from '@/contexts/auth-context'
import { I18nProvider } from '@/contexts/i18n-context'
import { ChatProvider } from '@/lib/context/ChatContext'
import { getRequestSiteUrl } from '@/lib/server-site-url'

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
  return {
    metadataBase: new URL(siteUrl),
    title: 'GoStayLo - Premium Global Rentals',
    description:
      'Premium villas, yachts, transport and tours worldwide. Book your perfect stay with GoStayLo.',
    manifest: '/manifest.json',
    keywords: 'rentals, villas, yachts, phuket, thailand, luxury, vacation, holiday',
    authors: [{ name: 'GoStayLo' }],
    openGraph: {
      title: 'GoStayLo - Premium Global Rentals',
      description: 'Premium villas, yachts, transport and tours worldwide. Book your perfect stay.',
      url: siteUrl,
      siteName: 'GoStayLo',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'GoStayLo - Premium Global Rentals',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'GoStayLo - Premium Global Rentals',
      description: 'Premium villas, yachts, transport and tours worldwide.',
      images: ['/og-image.png'],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'GoStayLo',
    },
    // Яндекс.Вебмастер (метод «Метатег»); файл yandex_*.html в public/ — метод «HTML-файл»
    verification: {
      yandex: '2a8838b0c4b76c2d',
    },
  }
}

export default async function RootLayout({ children }) {
  return (
    <html lang="en">
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
        <meta name="apple-mobile-web-app-title" content="GoStayLo" />
        <meta name="theme-color" content="#0d9488" />
      </head>
      <body className={inter.className}>
        <I18nProvider>
          <AuthProvider>
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
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
