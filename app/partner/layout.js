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
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isImpersonating, setIsImpersonating] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setUser(parsed)
      setIsImpersonating(!!parsed.isImpersonated)
    }
  }, [pathname])

  const handleReturnToAdmin = () => {
    const savedAdmin = localStorage.getItem('gostaylo_original_admin')
    if (savedAdmin) {
      localStorage.setItem('gostaylo_user', savedAdmin)
      localStorage.removeItem('gostaylo_original_admin')
      router.push('/admin/users')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('gostaylo_user')
    localStorage.removeItem('gostaylo_original_admin')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" richColors />
      
      {/* Desktop sidebar - Only visible on lg screens */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:top-12 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 border-r border-slate-200 bg-white">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold">GS</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Gostaylo</h1>
                <p className="text-xs text-teal-600">Partner Portal</p>
              </div>
            </Link>
            <NotificationBell userId="partner-1" userRole="PARTNER" />
          </div>

          {/* User info */}
          <div className="p-3 border-b bg-slate-50">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-teal-100 text-teal-700 text-sm">
                  {user?.name?.[0]?.toUpperCase() || 'P'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user?.name || 'Partner'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t">
            <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Выход
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-amber-900 px-4 py-2 flex items-center justify-between">
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
              data-testid="return-to-admin-partner"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться
            </Button>
          </div>
        )}

        {/* Page content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
