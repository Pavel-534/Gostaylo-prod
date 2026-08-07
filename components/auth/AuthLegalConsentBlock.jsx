'use client'

import { LegalConsentCheckboxRow } from '@/components/legal/LegalConsentCheckboxRow'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_NESTED_PANEL_CLASS } from '@/lib/ui/mobile-flat-canvas'

/**
 * Stage 189.1 — single legal consent block for fullscreen auth (SSOT under forms).
 * Stage 200.57 — max-sm nested panel flat (MOBILE_FLAT_*).
 */
export function AuthLegalConsentBlock({
  checked,
  onCheckedChange,
  showError = false,
  id = 'auth-legal-consent',
  className,
}) {
  const { language } = useI18n()

  return (
    <div className={cn('space-y-2', className)}>
      <LegalConsentCheckboxRow
        language={language}
        checked={checked}
        onCheckedChange={onCheckedChange}
        id={id}
        className={cn(
          MOBILE_FLAT_NESTED_PANEL_CLASS,
          'px-3 py-2.5 sm:border-slate-100 sm:bg-white',
        )}
      />
      {showError ? (
        <p className="text-sm text-red-500">{getUIText('auth_registerLegalRequired', language)}</p>
      ) : null}
    </div>
  )
}

export default AuthLegalConsentBlock
