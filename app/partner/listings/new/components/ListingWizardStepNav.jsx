'use client'

import { cn } from '@/lib/utils'

/**
 * Minimal step tracker for listing wizard header.
 */
export function ListingWizardStepNav({ steps, currentStep, onStepSelect }) {
  return (
    <nav
      aria-label="Listing wizard steps"
      className="flex max-h-16 gap-1 overflow-x-auto pt-2 scrollbar-none"
    >
      {steps.map((step) => {
        const isActive = currentStep === step.id
        const isComplete = currentStep > step.id
        const canSelect = isComplete || isActive

        return (
          <button
            key={step.id}
            type="button"
            disabled={!canSelect}
            onClick={() => canSelect && onStepSelect?.(step.id)}
            className={cn(
              'relative shrink-0 px-2.5 pb-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
              isActive && 'text-brand',
              !isActive && isComplete && 'text-slate-700 hover:text-brand',
              !isActive && !isComplete && 'cursor-default text-slate-400',
            )}
          >
            <span className="whitespace-nowrap">{step.label}</span>
            {isActive ? (
              <span
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand"
                aria-hidden
              />
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}

/** 2px progress thread — pinned to bottom edge of wizard chrome. */
export function ListingWizardProgressTrack({ steps, currentStep, isScrolled = false }) {
  const progressPct = steps.length > 1 ? ((currentStep - 1) / (steps.length - 1)) * 100 : 0

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-10',
        isScrolled ? 'h-0.5 bg-brand-mint' : 'h-0.5 bg-slate-100',
      )}
      aria-hidden
    >
      <div
        className="h-full bg-brand transition-[width] duration-300 ease-out"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  )
}
