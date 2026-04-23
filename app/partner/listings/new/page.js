'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { getUIText, DEFAULT_UI_LANGUAGE } from '@/lib/translations'
import { ListingWizardProvider } from './context/ListingWizardContext'
import { ListingWizardPageInner } from './components/ListingWizardPageInner'

function WizardShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-teal-500" />
        <p className="text-slate-600">{getUIText('wizardPageLoading', DEFAULT_UI_LANGUAGE)}</p>
      </div>
    </div>
  )
}

/**
 * Partner: new listing wizard (Stage 4.1+). SSoT: `context/ListingWizardContext.js`, steps: `components/Step*.jsx`, save: `hooks/useListingSave.js`.
 * Editing an existing listing: `app/partner/listings/[id]/page.js` reuses the same stack.
 */
export default function PartnerNewListingPage() {
  return (
    <Suspense fallback={<WizardShellFallback />}>
      <ListingWizardProvider>
        <ListingWizardPageInner />
      </ListingWizardProvider>
    </Suspense>
  )
}
