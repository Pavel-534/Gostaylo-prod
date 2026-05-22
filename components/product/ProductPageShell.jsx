'use client'

import { cn } from '@/lib/utils'
import { GSL_PAGE, GSL_PAGE_CONTAINER } from '@/lib/theme/product-ui'

/**
 * Stage 115.0 — оболочка страницы (surface + container).
 * @param {{ children: React.ReactNode, className?: string, containerClassName?: string, narrow?: boolean }} props
 */
export function ProductPageShell({ children, className, containerClassName, narrow = false }) {
  return (
    <div className={cn(GSL_PAGE, className)}>
      <div
        className={cn(
          narrow ? 'gsl-page-container mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-10' : GSL_PAGE_CONTAINER,
          'space-y-5 sm:space-y-6',
          containerClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
