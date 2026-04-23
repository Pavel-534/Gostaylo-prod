'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import CalendarSyncManager from '@/components/calendar-sync-manager'
import AvailabilityCalendar from '@/components/availability-calendar'
import SeasonalPriceManager from '@/components/seasonal-price-manager'
import { useListingWizard } from '../new/context/ListingWizardContext'
import { ListingWizardPageInner } from '../new/components/ListingWizardPageInner'

export function EditPartnerListingView() {
  const { loading: authLoading, isAuthenticated } = useAuth()
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
  const w = useListingWizard()
  const { editId, loading, listingNotFound, serverListing, formData, listingCategorySlug } = w
  const transport = isTransportListingCategory(listingCategorySlug)
  const showExternalCalendarSync = !transport
  const basePrice = parseFloat(String(formData?.basePriceThb || '').replace(',', '.')) || 0

  useEffect(() => {
    if (typeof window === 'undefined' || !serverListing) return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('highlight') !== 'calendar') return
    const timer = setTimeout(() => {
      document.getElementById('partner-calendar-sync')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      toast.success(getUIText('partnerCal_toastScroll', language))
      window.history.replaceState({}, '', window.location.pathname)
    }, 600)
    return () => clearTimeout(timer)
  }, [serverListing, language])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-slate-900">{t('partnerEdit_loginTitle')}</h2>
        <p className="mb-6 text-center text-slate-500">{t('partnerEdit_loginSubtitle')}</p>
        <Button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('open-login-modal', { detail: { mode: 'login' } }))
            }
          }}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {t('partnerEdit_loginCta')}
        </Button>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }
  if (listingNotFound) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <p className="mb-4 text-slate-600">{t('partnerEdit_notFound')}</p>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href="/partner/listings">{t('partnerEdit_backToListings')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <ListingWizardPageInner />
      {editId && serverListing ? (
        <div className="container mx-auto max-w-4xl space-y-5 px-3 py-5 sm:px-4 lg:space-y-8 lg:py-8">
          {showExternalCalendarSync ? <CalendarSyncManager listingId={editId} onSync={() => {}} /> : null}
          <AvailabilityCalendar listingId={editId} syncErrors={[]} />
          <SeasonalPriceManager listingId={editId} basePriceThb={basePrice} />
        </div>
      ) : null}
    </div>
  )
}
