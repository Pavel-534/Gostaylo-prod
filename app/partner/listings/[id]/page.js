'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getUIText, DEFAULT_UI_LANGUAGE } from '@/lib/translations'
import { ListingWizardProvider } from '../new/context/ListingWizardContext'
import { EditPartnerListingView } from './EditPartnerListingView'

function ShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      <span className="ml-3 text-slate-600">{getUIText('wizardPageLoading', DEFAULT_UI_LANGUAGE)}</span>
    </div>
  )
}

function EditWithProvider() {
  const params = useParams()
  const id = String(params?.id || '')
  return (
    <ListingWizardProvider mode="edit" initialListingId={id}>
      <EditPartnerListingView />
    </ListingWizardProvider>
  )
}

/**
 * Partner listing edit: shared SSoT and step components with `app/partner/listings/new/`.
 * See `docs/ARCHITECTURAL_PASSPORT.md` (Stage 4.2).
 */
export default function PartnerEditListingPage() {
  return (
    <Suspense fallback={<ShellFallback />}>
      <EditWithProvider />
    </Suspense>
  )
}
