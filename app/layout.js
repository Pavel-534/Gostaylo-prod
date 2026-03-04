import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { UniversalHeader } from '@/components/universal-header'
import { MainContent } from '@/components/main-content'
import { AuthProvider } from '@/contexts/auth-context'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata = {
  title: 'FunnyRent 2.1 - Роскошная аренда на Пхукете',
  description: 'Глобальный агрегатор аренды виллы, яхт, транспорта и туров на Пхукете',
  manifest: '/manifest.json',
  themeColor: '#0d9488',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FunnyRent'
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FunnyRent" />
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
