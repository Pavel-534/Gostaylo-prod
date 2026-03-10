import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { UniversalHeader } from '@/components/universal-header'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { MainContent } from '@/components/main-content'
import { AuthProvider } from '@/contexts/auth-context'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

// Base URL for meta tags (falls back to production domain)
const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gostaylo.com';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d9488',
}

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Gostaylo - Premium Global Rentals',
  description: 'Premium villas, yachts, transport and tours worldwide. Book your perfect stay with Gostaylo.',
  manifest: '/manifest.json',
  keywords: 'rentals, villas, yachts, phuket, thailand, luxury, vacation, holiday',
  authors: [{ name: 'Gostaylo' }],
  openGraph: {
    title: 'Gostaylo - Premium Global Rentals',
    description: 'Premium villas, yachts, transport and tours worldwide. Book your perfect stay.',
    url: siteUrl,
    siteName: 'Gostaylo',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Gostaylo - Premium Global Rentals',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gostaylo - Premium Global Rentals',
    description: 'Premium villas, yachts, transport and tours worldwide.',
    images: [`${siteUrl}/og-image.png`],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Gostaylo'
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Gostaylo" />
        <meta name="theme-color" content="#0d9488" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <UniversalHeader />
          <MainContent>{children}</MainContent>
          <MobileBottomNav />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
