'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, ExternalLink, Bell, Mail, MessageSquare, Shield, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function PartnerSettings() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Settings state - loaded from user profile
  const [settings, setSettings] = useState({
    agencyName: '',
    email: '',
    phone: '',
    notifyTelegram: true,
    notifyEmail: true,
    notifyNewBooking: true,
    notifyNewMessage: true,
    notifyStatusChange: true,
  })

  // Telegram connection status
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [telegramUsername, setTelegramUsername] = useState('')

  // Load user data on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
        
        // Set settings from user profile
        setSettings(prev => ({
          ...prev,
          agencyName: `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim() || parsed.name || '',
          email: parsed.email || '',
          phone: parsed.phone || '',
          notifyTelegram: parsed.notificationPreferences?.telegram ?? true,
          notifyEmail: parsed.notificationPreferences?.email ?? true,
        }))
        
        // Check Telegram connection status
        if (parsed.telegramId || parsed.telegram_id) {
          setTelegramLinked(true)
          setTelegramUsername(parsed.telegramUsername || parsed.telegram_username || '')
        }
      } catch (e) {
        console.error('Failed to parse user:', e)
      }
    }
    setLoading(false)
  }, [])

  async function handleSaveSettings() {
    if (!user?.id) {
      toast.error('Пользователь не авторизован')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/v2/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: settings.phone,
          notification_preferences: {
            telegram: settings.notifyTelegram,
            email: settings.notifyEmail,
          }
        })
      })
      
      if (res.ok) {
        toast.success('Настройки сохранены!')
        
        // Update localStorage
        const updatedUser = {
          ...user,
          phone: settings.phone,
          notificationPreferences: {
            telegram: settings.notifyTelegram,
            email: settings.notifyEmail,
          }
        }
        localStorage.setItem('gostaylo_user', JSON.stringify(updatedUser))
        setUser(updatedUser)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Ошибка сохранения')
      }
    } catch (error) {
      toast.error('Ошибка: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Настройки</h1>
        <p className="text-slate-600 mt-1">
          Управление профилем и уведомлениями
        </p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Информация о профиле</CardTitle>
          <CardDescription>
            Основные данные вашего аккаунта
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agencyName">Имя / Название агентства</Label>
            <Input
              id="agencyName"
              value={settings.agencyName}
              onChange={(e) => setSettings({ ...settings, agencyName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                disabled
                className="bg-slate-50"
              />
              <p className="text-xs text-slate-500">Email нельзя изменить</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="+66 XXX XXX XXXX"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            Telegram
          </CardTitle>
          <CardDescription>
            Статус подключения к Telegram боту
          </CardDescription>
        </CardHeader>
        <CardContent>
          {telegramLinked ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-600 rounded-full p-2">
                  <Check className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">Telegram подключён</p>
                  {telegramUsername && (
                    <p className="text-sm text-green-700">@{telegramUsername}</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-green-700 mt-3">
                Вы получаете уведомления о бронированиях и сообщениях через Telegram.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Для отключения перейдите в <a href="/profile" className="text-teal-600 hover:underline">профиль</a>
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-300 rounded-full p-2">
                  <MessageSquare className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Telegram не подключён</p>
                  <p className="text-sm text-slate-600">Подключите для получения уведомлений</p>
                </div>
              </div>
              <Button asChild className="mt-4 bg-teal-600 hover:bg-teal-700">
                <a href="/profile">
                  Подключить в профиле
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-600" />
            Настройки уведомлений
          </CardTitle>
          <CardDescription>
            Выберите, какие уведомления вы хотите получать
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Channels */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">Каналы уведомлений</h4>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Telegram</p>
                  <p className="text-sm text-slate-600">Мгновенные push-уведомления</p>
                </div>
              </div>
              <Switch
                checked={settings.notifyTelegram}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyTelegram: checked })
                }
                disabled={!telegramLinked}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Email</p>
                  <p className="text-sm text-slate-600">Ежедневная сводка</p>
                </div>
              </div>
              <Switch
                checked={settings.notifyEmail}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyEmail: checked })
                }
              />
            </div>
          </div>

          <Separator />

          {/* Event Types */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">События</h4>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Новые бронирования</p>
                <p className="text-sm text-slate-600">Запросы на бронирование</p>
              </div>
              <Switch
                checked={settings.notifyNewBooking}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyNewBooking: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Новые сообщения</p>
                <p className="text-sm text-slate-600">Сообщения в чате</p>
              </div>
              <Switch
                checked={settings.notifyNewMessage}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyNewMessage: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Изменение статуса</p>
                <p className="text-sm text-slate-600">Подтверждения и отмены</p>
              </div>
              <Switch
                checked={settings.notifyStatusChange}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyStatusChange: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            'Сохранить изменения'
          )}
        </Button>
      </div>
    </div>
  )
}
