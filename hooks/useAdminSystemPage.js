'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { getAdminDiagnosticsUserAgent } from '@/lib/http-client-identity'

async function fetchSystemSettingsByKeys(keys) {
  const q = encodeURIComponent(keys.join(','))
  const res = await fetch(`/api/admin/system-settings?keys=${q}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.success) {
    throw new Error(j.error || 'system_settings')
  }
  return j.data?.byKey || {}
}

function parseMaintenanceValue(raw) {
  if (raw === true || raw === 'true') return true
  if (raw === false || raw === 'false') return false
  return String(raw ?? '').toLowerCase() === 'true'
}

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
      const res = await fetch('/api/v2/admin/telegram', {
        credentials: 'include',
        cache: 'no-store',
      })
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
      const byKey = await fetchSystemSettingsByKeys(['ical_sync_status', 'ical_sync_settings'])
      const st = byKey.ical_sync_status?.value
      if (st != null) setIcalSyncStatus(st)
      const freq = byKey.ical_sync_settings?.value?.frequency
      if (freq) setIcalSyncFrequency(freq)
    } catch (error) {
      console.error('Failed to load iCal sync status:', error)
    }
  }, [])

  const loadSystemStatus = useCallback(async () => {
    try {
      const byKey = await fetchSystemSettingsByKeys([
        'maintenance_mode',
        'ical_sync_status',
        'ical_sync_settings',
      ])
      const mm = byKey.maintenance_mode?.value
      if (mm !== undefined) setMaintenanceMode(parseMaintenanceValue(mm))

      const st = byKey.ical_sync_status?.value
      if (st != null) setIcalSyncStatus(st)
      const freq = byKey.ical_sync_settings?.value?.frequency
      if (freq) setIcalSyncFrequency(freq)

      await checkWebhookStatus()

      const activityRes = await fetch(`/api/admin/activity/recent?limit=10`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const activityJson = await activityRes.json().catch(() => ({}))
      const activityRows = activityJson.success && Array.isArray(activityJson.data) ? activityJson.data : []
      const activityData = activityRows.map((row) => ({
        id: row.id,
        action: row.activity_type,
        details: row.description,
        created_at: row.created_at,
      }))
      setRecentActivity(activityData)
    } catch (error) {
      console.error('Failed to load system status:', error)
    } finally {
      setLoading(false)
    }
  }, [checkWebhookStatus])

  const logActivity = useCallback(
    async (action, details) => {
      try {
        await fetch(`/api/admin/activity`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            activity_type: String(action).slice(0, 50),
            description: typeof details === 'string' ? details : JSON.stringify(details ?? {}),
            metadata: {
              ip_address: 'admin-panel',
              user_agent: getAdminDiagnosticsUserAgent(),
            },
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
        credentials: 'include',
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
    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ical_sync_settings',
          value: { frequency, enabled: true },
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.success) {
        throw new Error(j.error || 'save')
      }
      setIcalSyncFrequency(frequency)
      toast.success(`Частота синхронизации: ${frequency}`)
    } catch {
      toast.error('Ошибка сохранения настроек')
    }
  }

  const handleMaintenanceToggle = async (enabled) => {
    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'maintenance_mode',
          value: enabled,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.success) {
        throw new Error(j.error || 'maintenance')
      }
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
        credentials: 'include',
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
        credentials: 'include',
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
        credentials: 'include',
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
