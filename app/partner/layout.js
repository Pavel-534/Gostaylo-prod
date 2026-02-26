'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Home, 
  Calendar, 
  MessageSquare, 
  DollarSign, 
  Settings, 
  Menu, 
  X, 
  LogOut,
  Users,
  Star,
  ArrowLeft,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Toaster } from 'sonner'
import { NotificationBell } from '@/components/notification-bell'

const navigation = [
  { name: 'Панель управления', href: '/partner/dashboard', icon: LayoutDashboard },
  { name: 'Мои листинги', href: '/partner/listings', icon: Home },
  { name: 'Бронирования', href: '/partner/bookings', icon: Calendar },
  { name: 'Реферальная программа', href: '/partner/referrals', icon: Users },
  { name: 'Сообщения', href: '/partner/messages', icon: MessageSquare },
  { name: 'Отзывы', href: '/partner/reviews', icon: Star },
  { name: 'Финансы', href: '/partner/finances', icon: DollarSign },
  { name: 'Настройки', href: '/partner/settings', icon: Settings },
]

export default function PartnerLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isImpersonating, setIsImpersonating] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('funnyrent_user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setUser(parsed)
      setIsImpersonating(!!parsed.isImpersonated)
    }
  }, [pathname])

  const handleReturnToAdmin = () => {
    const savedAdmin = localStorage.getItem('funnyrent_original_admin')
    if (savedAdmin) {
      localStorage.setItem('funnyrent_user', savedAdmin)
      localStorage.removeItem('funnyrent_original_admin')
      router.push('/admin/users')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('funnyrent_user')
    localStorage.removeItem('funnyrent_original_admin')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" richColors />
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${
        sidebarOpen ? 'block' : 'hidden'
      }`}>
        <div className="fixed inset-0 bg-slate-900/80" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">FR</span>
              </div>
              <span className="font-bold text-slate-900">FunnyRent</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-1 border-r border-slate-200 bg-white">
          <div className="flex items-center justify-between p-6 border-b">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">FR</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">FunnyRent</h1>
                <p className="text-xs text-teal-600">Partner Portal</p>
              </div>
            </Link>
            <NotificationBell userId="partner-1" userRole="PARTNER" />
          </div>

          {/* User info */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-teal-100 text-teal-700">ИП</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  Иван Партнёров
                </p>
                <p className="text-xs text-slate-500">partner@funnyrent.com</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">
                <LogOut className="h-4 w-4 mr-2" />
                Выход
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Impersonation Banner - Desktop */}
        {isImpersonating && (
          <div className="hidden lg:flex bg-amber-500 text-amber-900 px-4 py-2 items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">
                Режим просмотра: <strong>{user?.name}</strong>
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReturnToAdmin}
              className="bg-white text-amber-900 hover:bg-amber-100"
              data-testid="return-to-admin-partner-desktop"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться в Admin
            </Button>
          </div>
        )}

        {/* Mobile header */}
        <div className="sticky top-0 z-40 lg:hidden bg-white border-b border-slate-200 shadow-sm">
          {/* Impersonation Banner - Mobile */}
          {isImpersonating && (
            <div className="bg-amber-500 text-amber-900 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-medium truncate flex-1">
                Как: {user?.name}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleReturnToAdmin}
                className="bg-white text-amber-900 hover:bg-amber-100 h-7 px-2 text-xs ml-2"
                data-testid="return-to-admin-partner-mobile"
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Admin
              </Button>
            </div>
          )}
          
          {/* Regular Mobile Header */}
          <div className="flex items-center justify-between px-3 py-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-semibold text-slate-900 truncate">Partner</h1>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-red-500">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Page content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}