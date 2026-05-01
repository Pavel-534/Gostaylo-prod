/**
 * MainContent wrapper — conditionally adds padding for header.
 *
 * Unified (UNIFIED_HEADER=on):
 *   - Home — hero сам padding'ует, pad=0.
 *   - /messages/* — StickyChatHeader управляет, pad=0.
 *   - Renter/Partner/Admin + public — padding = var(--app-header-height, 64px)
 *     (динамически учитывает AdminImpersonationStripe когда активна).
 *
 * Legacy (UNIFIED_HEADER=off):
 *   - Admin/Partner/Renter/Messages/Home — свой inline header, pad=0.
 *   - Остальное — pt-14 под UniversalHeader.
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
    if (isHomePage || isUnifiedMessagesHall) {
      return <>{children}</>;
    }
    // Partner/Admin сами контролируют mobile header padding через свой main.
    // Renter + public — под AppHeader, dynamic height из CSS var.
    if (isPartnerPage || isAdminPage) {
      return <>{children}</>;
    }
    return (
      <div style={{ paddingTop: 'var(--app-header-height, 64px)' }}>
        {children}
      </div>
    );
  }

  // Legacy path
  if (isAdminPage || isPartnerPage || isHomePage || isUnifiedMessagesHall || isRenterPage) {
    return <>{children}</>;
  }
  return <div className="pt-14">{children}</div>;
}

export default MainContent;
