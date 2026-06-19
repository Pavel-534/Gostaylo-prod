'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'

export function PrivacyDataRightsCard() {
  const { language } = useI18n()
  const [exporting, setExporting] = useState(false)
  const [erasureLoading, setErasureLoading] = useState(true)
  const [erasureStatus, setErasureStatus] = useState(null)
  const [erasureBusy, setErasureBusy] = useState(false)

  async function loadErasureStatus() {
    setErasureLoading(true)
    try {
      const res = await fetch('/api/v2/me/request-erasure', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setErasureStatus(data.data)
    } catch {
      setErasureStatus(null)
    } finally {
      setErasureLoading(false)
    }
  }

  useEffect(() => {
    void loadErasureStatus()
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/v2/me/data-export', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || getUIText('privacyExportFailed', language))
        return
      }
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(getUIText('privacyExportSuccess', language))
    } catch {
      toast.error(getUIText('privacyExportFailed', language))
    } finally {
      setExporting(false)
    }
  }

  async function handleRequestErasure() {
    if (!window.confirm(getUIText('privacyErasureConfirm', language))) return
    setErasureBusy(true)
    try {
      const res = await fetch('/api/v2/me/request-erasure', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.detail || data.error || getUIText('privacyErasureFailed', language))
        return
      }
      toast.success(getUIText('privacyErasureRequested', language))
      await loadErasureStatus()
    } catch {
      toast.error(getUIText('privacyErasureFailed', language))
    } finally {
      setErasureBusy(false)
    }
  }

  async function handleCancelErasure() {
    setErasureBusy(true)
    try {
      const res = await fetch('/api/v2/me/request-erasure', {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || getUIText('privacyErasureFailed', language))
        return
      }
      toast.success(getUIText('privacyErasureCancelled', language))
      await loadErasureStatus()
    } finally {
      setErasureBusy(false)
    }
  }

  const active = erasureStatus?.active_request

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getUIText('privacyDataRightsTitle', language)}</CardTitle>
        <CardDescription>{getUIText('privacyDataRightsDesc', language)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {getUIText('privacyDownloadData', language)}
          </Button>
        </div>

        {erasureLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : active ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-3">
            <p>{getUIText('privacyErasurePending', language)}</p>
            <p className="text-xs text-amber-800">
              {getUIText('privacyErasureScheduled', language)}:{' '}
              {active.scheduled_for?.slice(0, 10)}
            </p>
            <Button variant="outline" size="sm" disabled={erasureBusy} onClick={handleCancelErasure}>
              {getUIText('privacyErasureCancel', language)}
            </Button>
          </div>
        ) : erasureStatus?.completed_at ? (
          <p className="text-sm text-slate-500">{getUIText('privacyErasureCompleted', language)}</p>
        ) : (
          <Button variant="destructive" disabled={erasureBusy} onClick={handleRequestErasure}>
            {erasureBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {getUIText('privacyRequestErasure', language)}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
