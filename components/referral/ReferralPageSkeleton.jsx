'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductPageShell } from '@/components/product/ProductPageShell'
import { GSL_CARD, GSL_SHIMMER } from '@/lib/theme/product-ui'

/**
 * Stage 114.6 / 115.0 — loading skeleton для `/profile/referral`.
 */
export function ReferralPageSkeleton() {
  return (
    <ProductPageShell>
      <div className={GSL_SHIMMER} aria-busy aria-label="Loading">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="space-y-2 mt-5">
          <Skeleton className="h-9 w-2/3 max-w-md" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl mt-5" />
        <Skeleton className="h-11 w-full max-w-lg rounded-xl mt-5" />
        <Card className={`${GSL_CARD} mt-5`}>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    </ProductPageShell>
  )
}
