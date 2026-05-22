'use client'

import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProductPageShell } from '@/components/product/ProductPageShell'
import { GSL_CARD } from '@/lib/theme/product-ui'

/**
 * Stage 115.0 — единый loading для profile/partner hubs.
 * @param {{ label?: string, variant?: 'card' | 'inline' }} props
 */
export function LoadingPageShell({ label = 'Loading…', variant = 'card' }) {
  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-600" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
        <span className="text-sm">{label}</span>
      </div>
    )
  }

  return (
    <ProductPageShell>
      <Card className={GSL_CARD}>
        <CardContent className="py-14 flex flex-col items-center justify-center gap-3 text-slate-600" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
          <p className="text-sm font-medium">{label}</p>
        </CardContent>
      </Card>
    </ProductPageShell>
  )
}
