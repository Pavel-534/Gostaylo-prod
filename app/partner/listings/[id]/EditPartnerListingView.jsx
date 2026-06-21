'use client'

import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useListingWizard } from '../new/context/ListingWizardContext'
import { ListingWizardPageInner } from '../new/components/ListingWizardPageInner'

function EditViewLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
    </div>
  )
}

/**
 * Edit route shell — auth gates only. Wizard + calendar SSOT: ListingWizardPageInner (Stage 171.7).
 */
export function EditPartnerListingView() {
  const { loading: authLoading, isAuthenticated } = useAuth()
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
  const { loading, listingNotFound } = useListingWizard()

  if (authLoading) {
    return <EditViewLoading />
  }
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-slate-50 p-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-slate-900">{t('partnerEdit_loginTitle')}</h2>
        <p className="mb-6 text-center text-slate-500">{t('partnerEdit_loginSubtitle')}</p>
        <Button
          variant="brand"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('open-login-modal', { detail: { mode: 'login' } }))
            }
          }}
        >
          {t('partnerEdit_loginCta')}
        </Button>
      </div>
    )
  }
  if (loading) {
    return <EditViewLoading />
  }
  if (listingNotFound) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <p className="mb-4 text-slate-600">{t('partnerEdit_notFound')}</p>
        <Button asChild variant="brand">
          <Link href="/partner/listings">{t('partnerEdit_backToListings')}</Link>
        </Button>
      </div>
    )
  }

  return <ListingWizardPageInner />
}
