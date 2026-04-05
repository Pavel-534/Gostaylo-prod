'use client'

import { useEffect, useState, useRef } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { getUIText } from '@/lib/translations'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { toPublicImageUrl } from '@/lib/public-image-url'

export default function RenterSettingsPage() {
  const { language } = useI18n()
  const { refreshUserFromServer } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  /** Raw URL stored in profiles.avatar (Supabase public URL or existing DB value) */
  const [avatarRaw, setAvatarRaw] = useState(null)
  const [marketing, setMarketing] = useState(false)
  const [telegramPref, setTelegramPref] = useState(true)
  const [userId, setUserId] = useState(null)
  const fileRef = useRef(null)

  async function loadProfile() {
    setLoading(true)
    try {
      const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
      const data = await res.json()
      if (!data.success || !data.user) {
        toast.error(getUIText('renterSettingsUnauthorized', language))
        setFirstName('')
        setLastName('')
        setAvatarRaw(null)
        return
      }
      const u = data.user
      setUserId(u.id || null)
      setFirstName(u.first_name || u.firstName || '')
      setLastName(u.last_name || u.lastName || '')
      setAvatarRaw(u.avatar && String(u.avatar).trim() ? String(u.avatar).trim() : null)
      const prefs = u.notification_preferences || u.notificationPreferences || {}
      setMarketing(!!prefs.marketing)
      setTelegramPref(prefs.telegram !== false)
    } catch (e) {
      console.error('[renter/settings]', e)
      toast.error(getUIText('renterSettingsLoadFailed', language))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  async function handleAvatarFile(e) {
    const file = e.target?.files?.[0]
    if (!file) return
    if (!userId) {
      toast.error(getUIText('renterSettingsUnauthorized', language))
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'listing-images')
      fd.append('folder', `avatars/${userId}`)
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
        try {
          localStorage.setItem('gostaylo_user', JSON.stringify(patchData.user))
        } catch {
          /* ignore */
        }
        await refreshUserFromServer()
        window.dispatchEvent(new CustomEvent('gostaylo-refresh-session'))
      }
    } catch (err) {
      console.error(err)
      toast.error(getUIText('renterSettingsUploadFailed', language))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/v2/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          avatar: avatarRaw,
          notification_preferences: {
            marketing,
            telegram: telegramPref,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || getUIText('renterSettingsError', language))
        return
      }
      if (data.user) {
        try {
          localStorage.setItem('gostaylo_user', JSON.stringify(data.user))
        } catch {
          /* ignore quota */
        }
      }
      await refreshUserFromServer()
      window.dispatchEvent(new CustomEvent('gostaylo-refresh-session'))
      toast.success(getUIText('renterSettingsSaved', language))
    } catch (e) {
      console.error(e)
      toast.error(getUIText('renterSettingsError', language))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    )
  }

  const initial =
    (firstName?.charAt(0) || lastName?.charAt(0) || '?').toUpperCase()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{getUIText('renterSettingsPageTitle', language)}</h1>
        <p className="text-slate-500 text-sm mt-1">{getUIText('renterSettingsPageDesc', language)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{getUIText('renterSettingsProfileCardTitle', language)}</CardTitle>
          <CardDescription>{getUIText('renterSettingsProfileCardDesc', language)}</CardDescription>
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
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {getUIText('renterSettingsChoosePhoto', language)}
              </Button>
              {avatarRaw ? (
                <Button type="button" variant="ghost" className="text-slate-600" onClick={() => setAvatarRaw(null)}>
                  {getUIText('renterSettingsRemoveAvatar', language)}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="r-first">{getUIText('renterSettingsFirstName', language)}</Label>
              <Input id="r-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-last">{getUIText('renterSettingsLastName', language)}</Label>
              <Input id="r-last" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'ru' ? 'Уведомления' : 'Notifications'}</CardTitle>
          <CardDescription>
            {language === 'ru' ? 'Сохраняются в вашем профиле' : 'Stored on your profile'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {language === 'ru' ? 'Маркетинговые рассылки' : 'Marketing emails'}
              </Label>
              <p className="text-xs text-slate-500">
                {language === 'ru' ? 'Акции и подборки от GoStayLo' : 'Promos and curated picks from GoStayLo'}
              </p>
            </div>
            <Switch checked={marketing} onCheckedChange={setMarketing} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {language === 'ru' ? 'Уведомления в Telegram' : 'Telegram notifications'}
              </Label>
              <p className="text-xs text-slate-500">
                {language === 'ru' ? 'Если Telegram привязан к аккаунту' : 'When Telegram is linked to your account'}
              </p>
            </div>
            <Switch checked={telegramPref} onCheckedChange={setTelegramPref} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {saving ? getUIText('renterSettingsSaving', language) : getUIText('renterSettingsSave', language)}
        </Button>
      </div>
    </div>
  )
}
