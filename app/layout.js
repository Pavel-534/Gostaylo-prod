import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { UniversalHeader } from '@/components/universal-header'
import { MainContent } from '@/components/main-content'
import { AuthProvider } from '@/contexts/auth-context'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata = {
  title: 'Gostaylo - Premium Global Rentals',
  description: 'Premium villas, yachts, transport and tours worldwide. Book your perfect stay with Gostaylo.',
  manifest: '/manifest.json',
  themeColor: '#0d9488',
  keywords: 'rentals, villas, yachts, phuket, thailand, luxury, vacation, holiday',
  authors: [{ name: 'Gostaylo' }],
  openGraph: {
    title: 'Gostaylo - Premium Global Rentals',
    description: 'Premium villas, yachts, transport and tours worldwide. Book your perfect stay.',
    url: 'https://www.gostaylo.com',
    siteName: 'Gostaylo',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
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
    images: ['/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Gostaylo'
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
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
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
