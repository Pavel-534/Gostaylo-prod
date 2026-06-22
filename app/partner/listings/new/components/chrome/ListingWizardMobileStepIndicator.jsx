'use client'

import { cn } from '@/lib/utils'

/**
 * Airbnb-style dot progress: ● ● ○ ○ ○ + «Шаг 2 из 5».
 */
export function ListingWizardMobileStepIndicator({ steps, currentStep, stepMarkerLabel }) {
  return (
    <div
      className="flex items-center justify-center gap-2.5 border-t border-slate-100 bg-white px-3 py-2"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1" aria-hidden>
        {steps.map((step) => {
          const isComplete = currentStep > step.id
          const isActive = currentStep === step.id

          return (
            <span
              key={step.id}
              className={cn(
                'inline-flex h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                (isComplete || isActive) && 'bg-brand',
                isActive && 'ring-2 ring-brand/25 ring-offset-1',
                !isComplete && !isActive && 'border border-slate-300 bg-white',
              )}
            />
          )
        })}
      </div>
      <span className="truncate text-xs font-medium text-slate-500">{stepMarkerLabel}</span>
    </div>
  )
}
