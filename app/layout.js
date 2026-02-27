import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import Link from 'next/link'
import RoleBar from '@/components/role-bar'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata = {
  title: 'FunnyRent 2.1 - Роскошная аренда на Пхукете',
  description: 'Глобальный агрегатор аренды виллы, яхт, транспорта и туров на Пхукете',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <RoleBar />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
