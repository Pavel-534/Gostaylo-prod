'use client'

/**
 * Stage 202.0 — open ProductFeedbackDialog from Home footer / Help contact.
 * Auth rules unchanged (200.137): dialog requires session on submit.
 */

import { useState } from 'react'
import { ProductFeedbackDialog } from '@/components/product-feedback-dialog'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/**
 * @param {{
 *   language?: string,
 *   className?: string,
 *   variant?: 'footer-link' | 'button',
 * }} props
 */
export function ProductFeedbackCta({ language = 'ru', className, variant = 'footer-link' }) {
  const [open, setOpen] = useState(false)
  const label = getUIText('profileReportProblem', language)
  const isRu = language !== 'en'
  const ideaHint = isRu ? ' / Идея' : ' / Idea'
  const fullLabel = `${label}${ideaHint}`

  return (
    <>
      {variant === 'button' ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={cn('min-h-[44px] px-7 text-sm font-semibold', className)}
          onClick={() => setOpen(true)}
        >
          {fullLabel}
        </Button>
      ) : (
        <button
          type="button"
          className={cn(
            'min-h-[44px] text-left hover:text-brand/80 transition-colors',
            className,
          )}
          onClick={() => setOpen(true)}
        >
          {fullLabel}
        </button>
      )}
      <ProductFeedbackDialog open={open} onOpenChange={setOpen} language={language} />
    </>
  )
}
