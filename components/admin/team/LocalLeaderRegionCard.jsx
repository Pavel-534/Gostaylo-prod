'use client'

import '@/lib/translations/register-admin-local-leader'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

/**
 * @param {{
 *  userId: string,
 *  regionId: string | null,
 *  onUpdated?: (nextRegionId: string | null) => void,
 * }} props
 */
export function LocalLeaderRegionCard({ userId, regionId = null, onUpdated }) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const [regions, setRegions] = useState([])
  const [selectedRegion, setSelectedRegion] = useState(String(regionId || ''))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelectedRegion(String(regionId || ''))
  }, [regionId])

  useEffect(() => {
    let disposed = false
    async function loadRegions() {
      try {
        const res = await fetch('/api/v2/admin/local-leader/regions', {
          credentials: 'include',
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.success !== true) throw new Error(json.error || 'LOAD_REGIONS_FAILED')
        if (disposed) return
        setRegions(Array.isArray(json.data?.regions) ? json.data.regions : [])
      } catch {
        if (!disposed) toast.error(t('adminLocalLeader_errorLoadRegions'))
      }
    }
    void loadRegions()
    return () => {
      disposed = true
    }
  }, [t])

  async function submit(regionIdValue) {
    const isClear = !regionIdValue
    const accepted = window.confirm(
      isClear ? t('adminLocalLeader_confirmClear') : t('adminLocalLeader_confirmAssign'),
    )
    if (!accepted) return

    setBusy(true)
    try {
      const idempotencyKey = `local-leader-${userId}-${regionIdValue || 'clear'}-${Date.now()}`
      const res = await fetch('/api/v2/admin/local-leader/assignment', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ userId, regionId: regionIdValue || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success !== true) {
        throw new Error(json.error || 'LOCAL_LEADER_ASSIGNMENT_FAILED')
      }
      const next = String(json.data?.regionId || '') || null
      setSelectedRegion(next || '')
      onUpdated?.(next)
      toast.success(isClear ? t('adminLocalLeader_successClear') : t('adminLocalLeader_successAssign'))
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg === 'INVALID_REGION_ID' || msg === 'USER_ID_REQUIRED') {
        toast.error(t('adminLocalLeader_errorInvalid'))
      } else {
        toast.error(msg || 'Error')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('adminLocalLeader_title')}</CardTitle>
        <CardDescription>{t('adminLocalLeader_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <span className="text-sm text-slate-600">{t('adminLocalLeader_current')}</span>
          {regionId ? (
            <Badge variant="outline">{t(`leaderRegions_${regionId}`)}</Badge>
          ) : (
            <Badge variant="secondary">{t('adminLocalLeader_notAssigned')}</Badge>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={selectedRegion || ''} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('adminLocalLeader_selectRegion')} />
            </SelectTrigger>
            <SelectContent>
              {regions.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {t(row.i18nKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={busy || !selectedRegion}
            onClick={() => void submit(selectedRegion)}
          >
            {t('adminLocalLeader_assign')}
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          disabled={busy || !regionId}
          onClick={() => void submit(null)}
        >
          {t('adminLocalLeader_clear')}
        </Button>
      </CardContent>
    </Card>
  )
}

export default LocalLeaderRegionCard

