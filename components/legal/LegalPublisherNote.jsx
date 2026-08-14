import { getLegalPublisherDetails } from '@/lib/config/legal-details'
import { cn } from '@/lib/utils'

/**
 * Stage 201.26 — ZoZPP operator line (SSOT `getLegalPublisherDetails`).
 * @param {{ className?: string, tone?: 'muted' | 'onDark' }} props
 */
export function LegalPublisherNote({ className, tone = 'muted' }) {
  const p = getLegalPublisherDetails()
  return (
    <p
      className={cn(
        'text-xs leading-relaxed',
        tone === 'onDark' ? 'text-slate-500' : 'text-slate-500',
        className,
      )}
    >
      {p.companyName}
      {' · '}
      ИНН {p.inn}
      {' · '}
      ОГРНИП {p.ogrnip}
    </p>
  )
}
