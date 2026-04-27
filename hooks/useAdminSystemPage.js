'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { getAdminDiagnosticsUserAgent } from '@/lib/http-client-identity'

export function useAdminSystemPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [webhookStatus, setWebhookStatus] = useState(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const [icalSyncStatus, setIcalSyncStatus] = useState(null)
  const [icalSyncFrequency, setIcalSyncFrequency] = useState('1h')
  const [icalSyncing, setIcalSyncing] = useState(false)

  const [outboxWorkerLoading, setOutboxWorkerLoading] = useState(false)
  const [outboxLastResult, setOutboxLastResult] = useState(null)
  const [outboxStats, setOutboxStats] = useState(null)

  const checkWebhookStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/admin/telegram')
      const data = await res.json()

      if (data.success && data.webhook) {
        const hasRecentError =
          data.webhook.lastErrorDate &&
          Date.now() - new Date(data.webhook.lastErrorDate).getTime() < 300000

        setWebhookStatus({
          url: data.webhook.url,
          isActive: data.webhook.active,
          hasError: hasRecentError,
          pendingUpdates: data.webhook.pendingUpdateCount || 0,
          lastError: data.webhook.lastErrorMessage || null,
          lastErrorDate: data.webhook.lastErrorDate ? new Date(data.webhook.lastErrorDate) : null,
          botUsername: data.bot?.username,
          botLink: data.bot?.link,
        })
      } else {
        setWebhookStatus({
          isActive: false,
          error: data.error || 'Failed to get status',
          url: null,
        })
      }
    } catch (error) {
      console.error('Failed to check webhook:', error)
      setWebhookStatus({ isActive: false, error: error.message })
    }
  }, [])

  const loadIcalSyncStatus = useCallback(async () => {
    try {
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const statusRes = await fetch(`/_db/system_settings?key=eq.ical_sync_status`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      })
      const statusData = await statusRes.json()
      if (statusData?.[0]?.value) {
        setIcalSyncStatus(statusData[0].value)
      }

      const settingsRes = await fetch(`/_db/system_settings?key=eq.ical_sync_settings`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      })
      const settingsData = await settingsRes.json()
      if (settingsData?.[0]?.value?.frequency) {
        setIcalSyncFrequency(settingsData[0].value.frequency)
      }
    } catch (error) {
      console.error('Failed to load iCal sync status:', error)
    }
  }, [])

  const loadSystemStatus = useCallback(async () => {
    try {
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const settingsRes = await fetch(`/_db/system_settings?key=eq.maintenance_mode`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      })
      const settings = await settingsRes.json()
      if (settings?.[0]) {
        setMaintenanceMode(settings[0].value === 'true' || settings[0].value === true)
      }

      await checkWebhookStatus()

      const activityRes = await fetch(`/_db/activity_log?order=created_at.desc&limit=10`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      })
      const activityData = await activityRes.json()
      setRecentActivity(Array.isArray(activityData) ? activityData : [])

      await loadIcalSyncStatus()
    } catch (error) {
      console.error('Failed to load system status:', error)
    } finally {
      setLoading(false)
    }
  }, [checkWebhookStatus, loadIcalSyncStatus])

  const logActivity = useCallback(
    async (action, details) => {
      try {
        const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        await fetch(`/_db/activity_log`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            details,
            ip_address: 'admin-panel',
            user_agent: getAdminDiagnosticsUserAgent(),
          }),
        })

        await loadSystemStatus()
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
    },
    [loadSystemStatus],
  )

  useEffect(() => {
    loadSystemStatus()
  }, [loadSystemStatus])

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch('/api/admin/notification-outbox/stats', { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && data.success) setOutboxStats(data)
      } catch {
        if (!cancelled) setOutboxStats(null)
      }
    }
    tick()
    const id = setInterval(tick, 25000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const handleGlobalIcalSync = async () => {
    setIcalSyncing(true)
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(
          `✅ Синхронизировано ${data.listingsSynced || 0} объявлений, ${data.eventsProcessed || 0} событий`,
        )
        await loadIcalSyncStatus()
        await logActivity('ICAL_GLOBAL_SYNC', `Синхронизировано ${data.listingsSynced || 0} объявлений`)
      } else {
        toast.error(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      console.error('Global sync error:', error)
      toast.error('Ошибка глобальной синхронизации')
    }
    setIcalSyncing(false)
  }

  const handleIcalFrequencyChange = async (frequency) => {
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    try {
      await fetch(`/_db/system_settings?key=eq.ical_sync_settings`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      })

      await fetch(`/_db/system_settings`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'ical_sync_settings',
          value: { frequency, enabled: true },
        }),
      })

      setIcalSyncFrequency(frequency)
      toast.success(`Частота синхронизации: ${frequency}`)
    } catch {
      toast.error('Ошибка сохранения настроек')
    }
  }

  const handleMaintenanceToggle = async (enabled) => {
    try {
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      await fetch(`/_db/system_settings?key=eq.maintenance_mode`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      })

      await fetch(`/_db/system_settings`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'maintenance_mode',
          value: String(enabled),
          description: 'Global maintenance mode toggle',
        }),
      })

      setMaintenanceMode(enabled)
      toast.success(enabled ? '🔴 Режим обслуживания ВКЛЮЧЁН' : '🟢 Режим обслуживания ВЫКЛЮЧЕН')
      await logActivity(enabled ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF', 'Переключен режим обслуживания')
    } catch (error) {
      console.error('Failed to toggle maintenance:', error)
      toast.error('Ошибка обновления режима обслуживания')
    }
  }

  const handleRelinkWebhook = async () => {
    setWebhookLoading(true)
    try {
      const res = await fetch('/api/v2/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setWebhook' }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('✅ Вебхук успешно переподключён!')
        await checkWebhookStatus()
        await logActivity('WEBHOOK_RELINK', `URL: ${data.webhookUrl}`)
      } else {
        toast.error('Ошибка: ' + (data.message || data.error))
      }
    } catch (error) {
      console.error('Failed to relink webhook:', error)
      toast.error('Ошибка переподключения вебхука')
    } finally {
      setWebhookLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    try {
      const res = await fetch('/api/v2/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testMessage' }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('✅ Подключение работает! Сообщение отправлено.')
        await logActivity('CONNECTION_TEST', 'Тест пройден успешно')
        await checkWebhookStatus()
      } else {
        toast.error('❌ Ошибка: ' + (data.message || data.error))
      }
    } catch (error) {
      toast.error('❌ Ошибка теста: ' + error.message)
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSendAloha = async () => {
    try {
      const res = await fetch('/api/v2/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testMessage' }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('🌴 Сообщение отправлено!')
        await logActivity('ALOHA_SENT', 'Отправлено тестовое сообщение')
      } else {
        toast.error('Ошибка: ' + (data.message || data.error))
      }
    } catch {
      toast.error('Ошибка отправки')
    }
  }

  const loadOutboxStats = async () => {
    try {
      const res = await fetch('/api/admin/notification-outbox/stats', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) setOutboxStats(data)
    } catch {
      setOutboxStats(null)
    }
  }

  const handleProcessNotificationOutbox = async () => {
    setOutboxWorkerLoading(true)
    try {
      const res = await fetch('/api/admin/notification-outbox/process', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setOutboxLastResult(data)
        const rc =
          data.reclaimed != null && data.reclaimed > 0 ? `, возврат из processing: ${data.reclaimed}` : ''
        toast.success(
          `Очередь: обработано ${data.claimed ?? 0}, отправлено ${data.sent ?? 0}, повтор ${data.failed ?? 0}, фатально ${data.permanentFailure ?? 0}${rc}`,
        )
        await logActivity('NOTIFICATION_OUTBOX_RUN', JSON.stringify(data))
        await loadOutboxStats()
      } else {
        toast.error(data.error || 'Не удалось обработать очередь')
      }
    } catch (e) {
      toast.error(e?.message || 'Ошибка запроса')
    } finally {
      setOutboxWorkerLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword || newPassword.length < 8) {
      toast.error('Проверьте правильность пароля')
      return
    }

    setChangingPassword(true)
    try {
      const { updatePassword } = await import('@/lib/auth')
      const result = await updatePassword(newPassword)

      if (result.success) {
        toast.success('✅ Пароль успешно обновлён!')
        setNewPassword('')
        setConfirmPassword('')
        await logActivity('PASSWORD_CHANGE', 'Пароль администратора обновлён')
      } else {
        toast.error('❌ Ошибка: ' + (result.error || 'Не удалось обновить пароль'))
      }
    } catch (error) {
      console.error('Password change error:', error)
      toast.error('❌ Ошибка обновления пароля')
    } finally {
      setChangingPassword(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return 'Н/Д'
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return {
    loading,
    maintenanceMode,
    webhookStatus,
    webhookLoading,
    testingConnection,
    recentActivity,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showNewPassword,
    setShowNewPassword,
    changingPassword,
    icalSyncStatus,
    icalSyncFrequency,
    icalSyncing,
    outboxWorkerLoading,
    outboxLastResult,
    outboxStats,
    loadSystemStatus,
    checkWebhookStatus,
    loadIcalSyncStatus,
    handleGlobalIcalSync,
    handleIcalFrequencyChange,
    handleMaintenanceToggle,
    handleRelinkWebhook,
    handleTestConnection,
    handleSendAloha,
    handleProcessNotificationOutbox,
    handlePasswordChange,
    formatDate,
  }
}
