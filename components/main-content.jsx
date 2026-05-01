/**
 * MainContent wrapper — conditionally adds padding for header.
 *
 * Legacy (UNIFIED_HEADER=off):
 *   - Admin/Partner/Renter/Messages — свой inline header, pad=0.
 *   - Home — hero сам padding'ует, pad=0.
 *   - Остальное — pt-14 под UniversalHeader (56px).
 *
 * Unified (UNIFIED_HEADER=on):
 *   - Admin/Partner — свой sidebar layout обрабатывает header, pad=0.
 *   - Home — hero сам padding'ует, pad=0.
 *   - Messages — StickyChatHeader управляет, pad=0.
 *   - Renter + остальные — pt-16 под AppHeader (64px).
 */

'use client';

import { usePathname } from 'next/navigation';
import { UNIFIED_HEADER_ENABLED } from '@/lib/feature-flags';

export function MainContent({ children }) {
  const pathname = usePathname();

  const isAdminPage = pathname?.startsWith('/admin');
  const isPartnerPage = pathname?.startsWith('/partner');
  const isHomePage = pathname === '/';
  const isUnifiedMessagesHall = pathname?.startsWith('/messages');
  const isRenterPage = pathname?.startsWith('/renter');

  if (UNIFIED_HEADER_ENABLED) {
    // AppHeader рендерится во всех workspace режимах → renter нуждается в padding.
    // Partner/Admin пока оставляют свои layouts (mobile inline header) — их мигрируем позже.
    if (isAdminPage || isPartnerPage || isHomePage || isUnifiedMessagesHall) {
      return <>{children}</>;
    }
    // Renter + public (кроме /) — AppHeader h-16 → pt-16
    return <div className="pt-16">{children}</div>;
  }

  // Legacy path
  if (isAdminPage || isPartnerPage || isHomePage || isUnifiedMessagesHall || isRenterPage) {
    return <>{children}</>;
  }
  return <div className="pt-14">{children}</div>;
}

export default MainContent;
