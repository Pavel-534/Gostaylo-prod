'use client'

import { Button } from '@/components/ui/button'

/**
 * Stage 200.21 P1a — compact resume vs start-fresh when localStorage draft exists.
 */
export function WizardResumeDraftBanner({
  title,
  categoryLabel,
  onContinue,
  onCreateNew,
  t,
}) {
  const name = String(title || '').trim()
  const cat = String(categoryLabel || '').trim()
  const label = [name, cat].filter(Boolean).join(' · ') || t('wizardResumeDraftFallback')

  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
      data-testid="wizard-resume-draft-banner"
      role="status"
    >
      <p className="text-sm leading-snug text-slate-800">
        {t('wizardResumeDraftPrompt').replace('{label}', label)}
      </p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:shrink-0">
        <Button
          type="button"
          variant="brand"
          className="min-h-[44px] w-full sm:w-auto"
          onClick={onContinue}
          data-testid="wizard-resume-continue-btn"
        >
          {t('wizardResumeDraftContinue')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full sm:w-auto"
          onClick={onCreateNew}
          data-testid="wizard-resume-create-new-btn"
        >
          {t('wizardResumeDraftCreateNew')}
        </Button>
      </div>
    </div>
  )
}
