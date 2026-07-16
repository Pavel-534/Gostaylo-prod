'use client'

import { GuestListingBodyBlock } from '@/components/listing/ListingInfo'

/**
 * Long description, cancellation, host.
 */
export default function ListingDescription({ listing, language }) {
  return <GuestListingBodyBlock listing={listing} language={language} />
}
