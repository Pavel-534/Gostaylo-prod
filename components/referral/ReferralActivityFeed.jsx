'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Loader2, UserPlus, Coins, KeyRound, Home } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { isUuidLike } from '@/lib/referral/uuid-like'
import { formatReferralDateTimeDdMmYyyyHm } from '@/lib/referral/format-referral-datetime'

const PAGE_LIMIT = 15

function formatWhen(iso) {
  if (!iso) return ''
  return formatReferralDateTimeDdMmYyyyHm(iso)
}

function EventIcon({ type }) {
  const wrap = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 border border-teal-100 text-teal-700'
  if (type === 'teammate_joined') {
    return (
      <span className={wrap} aria-hidden>
        <UserPlus className="h-4 w-4" />
      </span>
    )
  }
  if (type === 'referral_bonus_earned') {
    return (
      <span className={wrap} aria-hidden>
        <Coins className="h-4 w-4" />
      </span>
    )
  }
  if (type === 'teammate_first_stay') {
    return (
      <span className={wrap} aria-hidden>
        <KeyRound className="h-4 w-4" />
      </span>
    )
  }
  if (type === 'teammate_new_listing') {
    return (
      <span className={wrap} aria-hidden>
        <Home className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span className={wrap} aria-hidden>
      <Activity className="h-4 w-4" />
    </span>
  )
}

export function ReferralActivityFeed() {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale =
    language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [items, setItems] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [total, setTotal] = useState(0)

  const fetchPage = useCallback(
    async (cursor) => {
      const qs = new URLSearchParams({ limit: String(PAGE_LIMIT) })
      if (cursor) qs.set('cursor', cursor)
      const res = await fetch(`/api/v2/referral/activity?${qs.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) return { ok: false, items: [], nextCursor: null, total: 0 }
      return {
        ok: true,
        items: Array.isArray(json?.data?.items) ? json.data.items : [],
        nextCursor: json?.data?.nextCursor ?? null,
        total: Number(json?.data?.total) || 0,
      }
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetchPage(null)
        if (!cancelled && r.ok) {
          setItems(r.items)
          setNextCursor(r.nextCursor)
          setTotal(r.total)
        } else if (!cancelled) {
          setItems([])
          setNextCursor(null)
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const r = await fetchPage(nextCursor)
      if (r.ok) {
        setItems((prev) => {
          const keys = new Set(prev.map((x) => `${x.type}:${x.refereeId}:${x.at}`))
          const merged = [...prev]
          for (const ev of r.items) {
            const k = `${ev.type}:${ev.refereeId}:${ev.at}`
            if (!keys.has(k)) {
              keys.add(k)
              merged.push(ev)
            }
          }
          return merged
        })
        setNextCursor(r.nextCursor)
      }
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, loadingMore, fetchPage])

  const lines = useMemo(() => {
    return items.map((ev) => {
      const rawName = String(ev.displayName || '').trim()
      const name =
        rawName && !isUuidLike(rawName) && rawName !== String(ev.refereeId || '').trim()
          ? rawName
          : t('referralFeed_anonymous')
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
      } else if (ev.type === 'referral_bonus_earned') {
        const amount = Number(ev.meta?.amountThb ?? ev.meta?.amount_thb ?? 0)
        const rt = String(ev.meta?.referralType || '')
        let kindKey = 'referralFeed_bonusKind_other'
        if (rt === 'guest_booking') kindKey = 'referralFeed_bonusKind_guest_booking'
        else if (rt === 'host_activation') kindKey = 'referralFeed_bonusKind_host_activation'
        text = t('referralFeed_bonusEarned')
          .replace('{amount}', amount.toLocaleString(locale, { maximumFractionDigits: 2 }))
          .replace('{kind}', t(kindKey))
      } else {
        text = name
      }
      const partnerStatus =
        ev.type === 'teammate_first_stay'
          ? t('stage77_partnerStatusActive')
          : ev.type === 'teammate_joined'
            ? t('stage77_partnerStatusRegistered')
            : ''
      return {
        key: `${ev.type}:${ev.refereeId}:${ev.at}`,
        type: ev.type,
        text,
        when: formatWhen(ev.at),
        partnerStatus,
      }
    })
  }, [items, t, locale])

  const showLoadMore = Boolean(nextCursor)

  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-teal-700" />
          {t('referralFeed_title')}
        </CardTitle>
        <CardDescription>{t('referralFeed_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-600 text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('referralFeed_loading')}
          </div>
        ) : !lines.length ? (
          <p className="text-sm text-slate-600 py-2">{t('referralFeed_empty')}</p>
        ) : (
          <>
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {lines.map((row) => (
                <li
                  key={row.key}
                  className="text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0 flex gap-3"
                >
                  <EventIcon type={row.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800">{row.text}</p>
                    {row.partnerStatus ? (
                      <span className="inline-flex mt-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                        {row.partnerStatus}
                      </span>
                    ) : null}
                    {row.when ? <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{row.when}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            {total > 0 ? (
              <p className="text-xs text-slate-500">
                {t('referralFeed_shownOf').replace('{shown}', String(lines.length)).replace('{total}', String(total))}
              </p>
            ) : null}
            {showLoadMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('referralFeed_loading')}
                  </>
                ) : (
                  t('referralFeed_loadMore')
                )}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
