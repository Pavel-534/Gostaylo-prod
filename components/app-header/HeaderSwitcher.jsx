'use client'

/**
 * HeaderSwitcher — выбирает между legacy <UniversalHeader> и новым <AppHeader>
 * в зависимости от feature flag NEXT_PUBLIC_UNIFIED_HEADER.
 *
 * Контракт при UNIFIED_HEADER_ENABLED:
 *   - / /listings /help /about /u/* — root-level <AppHeader> (Mode A public).
 *   - /renter/* /partner/* /admin/* — НЕ рендерим тут. Эти разделы имеют
 *     свой layout, который сам монтирует <AppHeader variant="workspace" centerSlot=...>
 *     с доступом к navItems / sidebar state.
 *   - /messages/* — <AppHeader> возвращает null сам (chat mode handles via StickyChatHeader).
 *
 * Это делает контракт явным: секция владеет своим хедером, root не конкурирует.
 */

import { usePathname } from 'next/navigation'
import { UNIFIED_HEADER_ENABLED } from '@/lib/feature-flags'
import { UniversalHeader } from '@/components/universal-header'
import { AppHeader } from '@/components/app-header/AppHeader'

const SECTION_OWNS_HEADER = ['/renter', '/partner', '/admin']

export function HeaderSwitcher() {
  const pathname = usePathname()

  if (!UNIFIED_HEADER_ENABLED) return <UniversalHeader />

  // Workspace sections мигрируются по одному — каждый сам монтирует AppHeader.
  // Root не конкурирует: возвращаем null, чтобы избежать двойного рендера.
  if (pathname && SECTION_OWNS_HEADER.some((p) => pathname.startsWith(p))) {
    return null
  }

  return <AppHeader />
}

export default HeaderSwitcher
