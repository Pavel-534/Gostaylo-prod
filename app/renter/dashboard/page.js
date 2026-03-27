'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Home, Calendar, MessageSquare, Heart, User, Settings } from 'lucide-react'
import { detectLanguage, getUIText, setLanguage as persistLanguage } from '@/lib/translations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const ACTIONS = [
  { href: '/renter/bookings', icon: Calendar, key: 'bookings' },
  { href: '/messages', icon: MessageSquare, key: 'messages' },
  { href: '/renter/favorites', icon: Heart, key: 'favorites' },
  { href: '/renter/profile', icon: User, key: 'profile' },
  { href: '/renter/settings', icon: Settings, key: 'settings' },
]

export default function RenterDashboard() {
  const [language, setLanguage] = useState('ru')

  useEffect(() => {
    const initial = detectLanguage()
    setLanguage(initial)
    persistLanguage(initial)
    document.documentElement.lang = initial

    const handleLang = (e) => {
      const next = e?.detail
      if (!next) return
      setLanguage(next)
      persistLanguage(next)
      document.documentElement.lang = next
    }

    window.addEventListener('language-change', handleLang)
    window.addEventListener('languageChange', handleLang)
    return () => {
      window.removeEventListener('language-change', handleLang)
      window.removeEventListener('languageChange', handleLang)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center">
          <Home className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{getUIText('dashboard', language)}</h1>
          <p className="text-slate-500 text-sm">{language === 'ru' ? 'Быстрые действия и разделы' : 'Quick actions & sections'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACTIONS.map(({ href, icon: Icon, key }) => (
          <Link key={href} href={href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-teal-600" />
                  {getUIText(key, language)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  {language === 'ru' ? 'Открыть' : 'Open'}
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

