'use client'

import { Card, CardContent } from '@/components/ui/card'
import { useListingWizard } from '../../context/ListingWizardContext'
import { ListingWizardPreviewContent } from './ListingWizardPreviewContent'

/**
 * Desktop/tablet sticky preview column (hidden below sm).
 */
export function ListingWizardPreviewPanel({ previewStickyTop }) {
  const { t } = useListingWizard()

  return (
    <div className="hidden sm:block lg:col-span-1">
      <div
        className="sticky z-10 isolate transition-[top] duration-300 ease-in-out sm:[top:var(--preview-sticky-top)]"
        style={{ '--preview-sticky-top': previewStickyTop }}
      >
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800 sm:text-base">
          {t('livePreview')}
        </h3>
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <ListingWizardPreviewContent />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
