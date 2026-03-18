'use client'

import { useEffect, useState } from 'react'
import { detectLanguage, getUIText, setLanguage as persistLanguage } from '@/lib/translations'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export default function RenterSettingsPage() {
  const [language, setLanguage] = useState('ru')
  const [marketing, setMarketing] = useState(false)
  const [telegram, setTelegram] = useState(true)

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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{getUIText('settings', language)}</h1>
        <p className="text-slate-500 text-sm">
          {language === 'ru' ? 'Настройки уведомлений и приватности' : 'Notifications & privacy'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'ru' ? 'Уведомления' : 'Notifications'}</CardTitle>
          <CardDescription>
            {language === 'ru' ? 'Выберите, какие уведомления получать' : 'Choose what you want to receive'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {language === 'ru' ? 'Маркетинговые рассылки' : 'Marketing emails'}
              </Label>
              <p className="text-xs text-slate-500">
                {language === 'ru' ? 'Акции и подборки от Gostaylo' : 'Promos and curated picks'}
              </p>
            </div>
            <Switch checked={marketing} onCheckedChange={setMarketing} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {language === 'ru' ? 'Telegram уведомления' : 'Telegram notifications'}
              </Label>
              <p className="text-xs text-slate-500">
                {language === 'ru' ? 'Статусы бронирований и сообщения' : 'Booking status and messages'}
              </p>
            </div>
            <Switch checked={telegram} onCheckedChange={setTelegram} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

