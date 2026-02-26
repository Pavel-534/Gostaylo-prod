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
        
        {/* Global Footer */}
        <footer className="bg-slate-900 text-white py-8 mt-16">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">FR</span>
                </div>
                <span className="font-semibold">FunnyRent 2.1</span>
              </div>
              
              <div className="flex items-center gap-6 text-sm">
                <Link 
                  href="/" 
                  className="hover:text-teal-400 transition"
                >
                  О платформе
                </Link>
                <Link 
                  href="https://t.me" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-400 transition flex items-center gap-2"
                >
                  <span>💬</span>
                  Связаться с поддержкой
                </Link>
              </div>
              
              <p className="text-xs text-slate-400">
                © 2025 FunnyRent. Все права защищены.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
