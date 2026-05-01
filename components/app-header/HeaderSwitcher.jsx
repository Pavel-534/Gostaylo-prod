'use client'

/**
 * HeaderSwitcher — выбирает между legacy <UniversalHeader> и новым <AppHeader>
 * в зависимости от feature flag NEXT_PUBLIC_UNIFIED_HEADER.
 *
 * Позволяет параллельное тестирование без deployment.
 */

import { UNIFIED_HEADER_ENABLED } from '@/lib/feature-flags'
import { UniversalHeader } from '@/components/universal-header'
import { AppHeader } from '@/components/app-header/AppHeader'

export function HeaderSwitcher() {
  if (UNIFIED_HEADER_ENABLED) return <AppHeader />
  return <UniversalHeader />
}

export default HeaderSwitcher
