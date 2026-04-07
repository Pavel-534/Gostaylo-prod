'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Check, ExternalLink, Bell, Mail, MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { toPublicImageUrl } from '@/lib/public-image-url'

export default function PartnerSettings() {
  const { language } = useI18n()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarRaw, setAvatarRaw] = useState(null)
  const fileRef = useRef(null)

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

  const [telegramLinked, setTelegramLinked] = useState(false)
  const [telegramUsername, setTelegramUsername] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data.success && data.user) {
          const u = data.user
          setUser(u)
          setAvatarRaw(u.avatar && String(u.avatar).trim() ? String(u.avatar).trim() : null)
          setSettings((prev) => ({
            ...prev,
            agencyName:
              `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || prev.agencyName,
            email: u.email || '',
            phone: u.phone || '',
            notifyTelegram: u.notificationPreferences?.telegram ?? true,
            notifyEmail: u.notificationPreferences?.email ?? true,
          }))
          setTelegramLinked(!!(u.telegram_id || u.telegram_username))
          setTelegramUsername(u.telegram_username || '')
          try {
            localStorage.setItem('gostaylo_user', JSON.stringify(u))
          } catch {
            /* ignore */
          }
        } else {
          const storedUser = localStorage.getItem('gostaylo_user')
          if (storedUser) {
            const parsed = JSON.parse(storedUser)
            setUser(parsed)
            setAvatarRaw(parsed.avatar && String(parsed.avatar).trim() ? String(parsed.avatar).trim() : null)
            setSettings((prev) => ({
              ...prev,
              agencyName:
                `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim() || parsed.name || '',
              email: parsed.email || '',
              phone: parsed.phone || '',
              notifyTelegram: parsed.notificationPreferences?.telegram ?? true,
              notifyEmail: parsed.notificationPreferences?.email ?? true,
            }))
            if (parsed.telegramId || parsed.telegram_id) {
              setTelegramLinked(true)
              setTelegramUsername(parsed.telegramUsername || parsed.telegram_username || '')
            }
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleAvatarFile(e) {
    const file = e.target?.files?.[0]
    if (!file || !user?.id) {
      if (!user?.id) toast.error(getUIText('renterSettingsUnauthorized', language))
      return
    }
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'listing-images')
      fd.append('folder', `avatars/${user.id}`)
      const res = await fetch('/api/v2/upload', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || getUIText('renterSettingsUploadFailed', language))
        return
      }
      const storeUrl = data.publicUrl && String(data.publicUrl).trim()
      if (!storeUrl) {
        toast.error(getUIText('renterSettingsUploadFailed', language))
        return
      }
      setAvatarRaw(storeUrl)
      const patchRes = await fetch('/api/v2/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatar: storeUrl }),
      })
      const patchData = await patchRes.json()
      if (patchRes.ok && patchData.success && patchData.user) {
        setUser(patchData.user)
        try {
          localStorage.setItem('gostaylo_user', JSON.stringify(patchData.user))
        } catch {
          /* ignore */
        }
        window.dispatchEvent(new CustomEvent('gostaylo-refresh-session'))
        toast.success(getUIText('renterSettingsSaved', language))
      } else {
        toast.error(patchData.error || getUIText('renterSettingsError', language))
      }
    } catch (err) {
      console.error(err)
      toast.error(getUIText('renterSettingsUploadFailed', language))
    } finally {
      setUploadingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSaveSettings() {
    if (!user?.id) {
      toast.error(getUIText('partnerSettingsUnauthorized', language))
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
          avatar: avatarRaw,
          notification_preferences: {
            telegram: settings.notifyTelegram,
            email: settings.notifyEmail,
          },
        }),
      })

      const data = await res.json()

      if (res.ok && data.success && data.user) {
        toast.success(getUIText('partnerSettingsSaved', language))
        localStorage.setItem('gostaylo_user', JSON.stringify(data.user))
        setUser(data.user)
        setAvatarRaw(
          data.user.avatar && String(data.user.avatar).trim() ? String(data.user.avatar).trim() : null
        )
        setSettings((prev) => ({
          ...prev,
          agencyName:
            `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim() ||
            data.user.name ||
            prev.agencyName,
          email: data.user.email || prev.email,
          phone: data.user.phone || prev.phone,
          notifyTelegram: data.user.notificationPreferences?.telegram ?? prev.notifyTelegram,
          notifyEmail: data.user.notificationPreferences?.email ?? prev.notifyEmail,
        }))
        window.dispatchEvent(new CustomEvent('gostaylo-refresh-session'))
      } else if (res.ok) {
        toast.success(getUIText('partnerSettingsSaved', language))
      } else {
        toast.error(data.error || 'Ошибка сохранения')
      }
    } catch (error) {
      toast.error(`${getUIText('partnerSettingsSaveFailed', language)} ${error.message}`)
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

  const initial =
    (settings.agencyName?.charAt(0) || user?.email?.charAt(0) || 'P').toUpperCase()

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Настройки</h1>
        <p className="text-slate-600 mt-1">Управление профилем и уведомлениями</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Информация о профиле</CardTitle>
          <CardDescription>Основные данные вашего аккаунта</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="h-24 w-24 border border-slate-200">
              {avatarRaw ? (
                <AvatarImage src={toPublicImageUrl(avatarRaw)} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-teal-100 text-teal-800 text-2xl font-semibold">{initial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingAvatar || !user?.id}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {getUIText('renterSettingsChoosePhoto', language)}
              </Button>
              {avatarRaw ? (
                <Button type="button" variant="ghost" className="text-slate-600" onClick={() => setAvatarRaw(null)}>
                  {getUIText('renterSettingsRemoveAvatar', language)}
                </Button>
              ) : null}
              <p className="text-xs text-slate-500 max-w-sm">{getUIText('renterSettingsProfileCardDesc', language)}</p>
            </div>
          </div>

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
              <Input id="email" type="email" value={settings.email} disabled className="bg-slate-50" />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            Telegram
          </CardTitle>
          <CardDescription>Статус подключения к Telegram боту</CardDescription>
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
                  {telegramUsername && <p className="text-sm text-green-700">@{telegramUsername}</p>}
                </div>
              </div>
              <p className="text-sm text-green-700 mt-3">
                Вы получаете уведомления о бронированиях и сообщениях через Telegram.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Для отключения перейдите в{' '}
                <a href="/profile" className="text-teal-600 hover:underline">
                  профиль
                </a>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-600" />
            Настройки уведомлений
          </CardTitle>
          <CardDescription>Выберите, какие уведомления вы хотите получать</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                onCheckedChange={(checked) => setSettings({ ...settings, notifyTelegram: checked })}
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
                onCheckedChange={(checked) => setSettings({ ...settings, notifyEmail: checked })}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">События</h4>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Новые бронирования</p>
                <p className="text-sm text-slate-600">Запросы на бронирование</p>
              </div>
              <Switch
                checked={settings.notifyNewBooking}
                onCheckedChange={(checked) => setSettings({ ...settings, notifyNewBooking: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Новые сообщения</p>
                <p className="text-sm text-slate-600">Сообщения в чате</p>
              </div>
              <Switch
                checked={settings.notifyNewMessage}
                onCheckedChange={(checked) => setSettings({ ...settings, notifyNewMessage: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Изменение статуса</p>
                <p className="text-sm text-slate-600">Подтверждения и отмены</p>
              </div>
              <Switch
                checked={settings.notifyStatusChange}
                onCheckedChange={(checked) => setSettings({ ...settings, notifyStatusChange: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {getUIText('renterSettingsSaving', language)}
            </>
          ) : (
            getUIText('partnerSettingsSaveChanges', language)
          )}
        </Button>
      </div>
    </div>
  )
}
