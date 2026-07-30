import { ListingGridSkeleton } from '@/components/listing-card-skeleton'

/** Stage 200.16 — instant favorites shell. */
export default function RenterFavoritesLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <ListingGridSkeleton count={6} />
    </div>
  )
}
