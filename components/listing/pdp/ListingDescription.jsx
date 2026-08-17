'use client'

/**
 * PDP story blocks: description → policies → fees → host.
 * Mobile dates + amenities are composed by `ListingPdpDetailsColumn` (Stage 201.85)
 * so responsive `lg:hidden` nodes never sit inside `divide-y` (orphan rules).
 * Stage 201.86 — guest fee hints section when cleaning/deposit/fuel apply.
 */
import {
  GuestListingDescriptionSection,
  GuestListingHostSection,
  GuestListingPoliciesSection,
} from '@/components/listing/ListingInfo'
import {
  ListingGuestFeeHints,
  listingHasGuestFeeHints,
} from '@/components/listing/ListingGuestFeeHints'
import { listingHasGuestPolicies } from '@/lib/listing/listing-good-to-know'
import { ListingPdpSection } from '@/components/listing/pdp/ListingPdpSection'

export function ListingDescription({ listing, language, currency, exchangeRates }) {
  const hasPolicies = listingHasGuestPolicies(listing)
  const hasFees = listingHasGuestFeeHints(listing)

  return (
    <>
      <ListingPdpSection>
        <GuestListingDescriptionSection listing={listing} language={language} />
      </ListingPdpSection>
      {hasPolicies ? (
        <ListingPdpSection>
          <GuestListingPoliciesSection listing={listing} language={language} />
        </ListingPdpSection>
      ) : null}
      {hasFees ? (
        <ListingPdpSection>
          <ListingGuestFeeHints
            listing={listing}
            language={language}
            currency={currency}
            exchangeRates={exchangeRates}
          />
        </ListingPdpSection>
      ) : null}
      {listing?.owner ? (
        <ListingPdpSection>
          <GuestListingHostSection listing={listing} language={language} />
        </ListingPdpSection>
      ) : null}
    </>
  )
}
