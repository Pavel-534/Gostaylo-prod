'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

function formatWhen(iso, locale) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ReferralActivityFeed() {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale =
    language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/referral/activity?limit=20', {
          credentials: 'include',
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!cancelled && res.ok && json?.success && Array.isArray(json?.data?.items)) {
          setItems(json.data.items)
        } else if (!cancelled) {
          setItems([])
        }
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const lines = useMemo(() => {
    return items.map((ev) => {
      const name = String(ev.displayName || '').trim() || t('referralFeed_anonymous')
      let text = ''
      if (ev.type === 'teammate_joined') {
        text = t('referralFeed_joined').replace('{name}', name)
      } else if (ev.type === 'teammate_first_stay') {
        const bonus = Number(ev.meta?.bonusThb ?? 0)
        text = t('referralFeed_firstStay')
          .replace('{name}', name)
          .replace('{amount}', bonus.toLocaleString(locale, { maximumFractionDigits: 2 }))
      } else if (ev.type === 'teammate_new_listing') {
        text = t('referralFeed_newListing').replace('{name}', name)
      } else {
        text = name
      }
      return { key: `${ev.type}:${ev.refereeId}:${ev.at}`, text, when: formatWhen(ev.at, locale) }
    })
  }, [items, t, locale])

  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-teal-700" />
          {t('referralFeed_title')}
        </CardTitle>
        <CardDescription>{t('referralFeed_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-600 text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('referralFeed_loading')}
          </div>
        ) : !lines.length ? (
          <p className="text-sm text-slate-600 py-2">{t('referralFeed_empty')}</p>
        ) : (
          <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {lines.map((row) => (
              <li key={row.key} className="text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                <p className="text-slate-800">{row.text}</p>
                {row.when ? <p className="text-xs text-slate-500 mt-0.5">{row.when}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
