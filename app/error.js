'use client'

/**
 * Stage 200.75 — root App Router error boundary (inside root layout).
 */

import { AppErrorBoundaryView } from '@/components/product/AppErrorBoundaryView'

export default function RootError({ error, reset }) {
  return <AppErrorBoundaryView error={error} reset={reset} logLabel="[Root Error]" />
}
