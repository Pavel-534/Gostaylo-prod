'use client'

import { GuestListingTitleBlock } from '@/components/listing/ListingInfo'

/**
 * Title, rating, location, spec row (above description).
 */
export default function ListingHeader({ listing, language }) {
  return <GuestListingTitleBlock listing={listing} language={language} />
}
