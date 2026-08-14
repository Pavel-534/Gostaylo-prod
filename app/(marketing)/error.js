'use client'

/**
 * Stage 201.15 — marketing segment error boundary (keeps MarketingAppShell chrome when page throws).
 */

import { AppErrorBoundaryView } from '@/components/product/AppErrorBoundaryView'

export default function MarketingError({ error, reset }) {
  return <AppErrorBoundaryView error={error} reset={reset} logLabel="[Marketing Error]" />
}
