'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ListingPublishQualityChecklist } from '@/components/partner/listing/ListingPublishQualityChecklist'
import { buildListingPublishQualityChecklist } from '@/lib/partner/listing-quality-gates'
import { listingQualityInputFromPartnerListing } from '@/lib/partner/listing-quality-gates'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import Link from 'next/link'

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   listing: object | null,
 *   onRetryPublish?: () => void,
 * }} props
 */
export function PartnerListingPublishQualityModal({
  open,
  onOpenChange,
  listing,
  onRetryPublish,
}) {
  const { language } = useI18n()
  const t = (key, fb) => {
    const v = getUIText(key, language)
    if (v === key && fb) return fb
    return v
  }

  if (!listing) return null

  const checklist = buildListingPublishQualityChecklist(
    listingQualityInputFromPartnerListing(listing),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('listingQuality_publishBlocked', 'Cannot publish yet')}</DialogTitle>
          <DialogDescription>
            {t(
              'listingQuality_listPublishHint',
              'Complete the same requirements as in the listing wizard. Then submit for moderation.',
            )}
          </DialogDescription>
        </DialogHeader>

        <ListingPublishQualityChecklist checklist={checklist} t={t} />

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" className="w-full bg-teal-600 hover:bg-teal-700" asChild>
            <Link href={`/partner/listings/${listing.id}`} onClick={() => onOpenChange(false)}>
              {t('listingQuality_editListing', 'Edit listing')}
            </Link>
          </Button>
          {checklist.ok && onRetryPublish ? (
            <Button type="button" variant="secondary" className="w-full" onClick={onRetryPublish}>
              {t('listingQuality_retryPublish', 'Submit for moderation')}
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {t('common_close', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
