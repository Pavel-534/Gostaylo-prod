'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tag, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'

export default function PartnerPromoPage() {
  const { language } = useI18n()
  const t = useCallback((key) => getUIText(key, language), [language])

  const [partnerId, setPartnerId] = useState(null)
  const [listings, setListings] = useState([])
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingListings, setLoadingListings] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedListingIds, setSelectedListingIds] = useState(() => new Set())

  const [form, setForm] = useState({
    code: '',
    type: 'PERCENT',
    value: '',
    expiryDate: '',
    usageLimit: '',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingSession(true)
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success || !json.user?.id) {
          if (!cancelled) setPartnerId(null)
          return
        }
        if (!cancelled) setPartnerId(String(json.user.id))
      } catch {
        if (!cancelled) setPartnerId(null)
      } finally {
        if (!cancelled) setLoadingSession(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!partnerId) return
    let cancelled = false
    async function loadListings() {
      setLoadingListings(true)
      try {
        const res = await fetch(`/api/v2/partner/listings?partnerId=${encodeURIComponent(partnerId)}`, {
          credentials: 'include',
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success) {
          if (!cancelled) setListings([])
          return
        }
        if (!cancelled) setListings(Array.isArray(json.data) ? json.data : [])
      } catch {
        if (!cancelled) setListings([])
      } finally {
        if (!cancelled) setLoadingListings(false)
      }
    }
    void loadListings()
    return () => {
      cancelled = true
    }
  }, [partnerId])

  const toggleListing = (id) => {
    setSelectedListingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.code || !form.value || !form.expiryDate || !form.usageLimit) {
      toast.error(t('partnerPromo_fillAll'))
      return
    }
    setSubmitting(true)
    try {
      const listingIds = selectedListingIds.size > 0 ? [...selectedListingIds] : undefined
      const res = await fetch('/api/v2/partner/promo-codes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: form.value,
          expiryDate: form.expiryDate,
          usageLimit: form.usageLimit,
          ...(listingIds ? { listingIds } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        toast.success(t('partnerPromo_success'))
        setForm({ code: '', type: 'PERCENT', value: '', expiryDate: '', usageLimit: '' })
        setSelectedListingIds(new Set())
      } else {
        toast.error(json.error || t('partnerPromo_error'))
      }
    } catch {
      toast.error(t('partnerPromo_error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingSession) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!partnerId) {
    return (
      <Card className="max-w-lg border-amber-200 bg-amber-50/80">
        <CardHeader>
          <CardTitle>{t('partnerPromo_authTitle')}</CardTitle>
          <CardDescription>{t('partnerPromo_authBody')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-slate-600">
        <Link href="/partner/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('partnerPromo_backDashboard')}
        </Link>
      </Button>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Tag className="h-7 w-7 text-teal-600" />
          {t('partnerPromo_pageTitle')}
        </h1>
        <p className="mt-1 text-slate-600">{t('partnerPromo_pageSubtitle')}</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('partnerPromo_formTitle')}</CardTitle>
          <CardDescription>{t('partnerPromo_scopeHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t('partnerPromo_fieldCode')}</Label>
              <Input
                className="mt-2 font-mono uppercase"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER2026"
              />
            </div>
            <div>
              <Label>{t('partnerPromo_fieldType')}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">{t('partnerPromo_typePercent')}</SelectItem>
                  <SelectItem value="FIXED">{t('partnerPromo_typeFixed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('partnerPromo_fieldValue')}</Label>
              <Input
                type="number"
                className="mt-2"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'PERCENT' ? '10' : '500'}
              />
            </div>
            <div>
              <Label>{t('partnerPromo_fieldExpiry')}</Label>
              <Input
                type="date"
                className="mt-2"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('partnerPromo_fieldLimit')}</Label>
              <Input
                type="number"
                min={1}
                className="mt-2"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="100"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-800">{t('partnerPromo_listingsSection')}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{t('partnerPromo_listingsHelp')}</p>
              {loadingListings ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('partnerPromo_loadingListings')}
                </div>
              ) : listings.length === 0 ? (
                <p className="text-sm text-slate-500">{t('partnerPromo_noListings')}</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {listings.map((l) => (
                    <li key={l.id} className="flex items-start gap-3 rounded-md bg-white px-2 py-2 border border-slate-100">
                      <Checkbox
                        id={`listing-${l.id}`}
                        checked={selectedListingIds.has(l.id)}
                        onCheckedChange={() => toggleListing(l.id)}
                      />
                      <label htmlFor={`listing-${l.id}`} className="text-sm leading-snug cursor-pointer flex-1 min-w-0">
                        <span className="font-medium text-slate-900 line-clamp-2">{l.title || l.id}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{l.status}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('partnerPromo_submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
