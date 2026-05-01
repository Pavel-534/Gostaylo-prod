/**
 * MainContent wrapper — top offset under AppHeader.
 * Home and messages own their own top layout and do not need extra padding.
 */

'use client';

import { usePathname } from 'next/navigation';

export function MainContent({ children }) {
  const pathname = usePathname();

  const isAdminPage = pathname?.startsWith('/admin');
  const isPartnerPage = pathname?.startsWith('/partner');
  const isHomePage = pathname === '/';
  const isUnifiedMessagesHall = pathname?.startsWith('/messages');
  if (isAdminPage || isPartnerPage || isHomePage || isUnifiedMessagesHall) {
    return <>{children}</>;
  }
  return <div style={{ paddingTop: 'var(--app-header-height, 64px)' }}>{children}</div>;
}

export default MainContent;
