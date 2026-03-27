/**
 * MainContent wrapper - conditionally adds padding for UniversalHeader
 * No padding on /admin pages (they have their own layout)
 * Partner pages have their own layout with sidebar
 */

'use client';

import { usePathname } from 'next/navigation';

export function MainContent({ children }) {
  const pathname = usePathname();
  
  // Admin pages have their own layout with sidebar, no padding needed
  const isAdminPage = pathname?.startsWith('/admin');
  
  // Partner pages have their own layout (sidebar handles header)
  const isPartnerPage = pathname?.startsWith('/partner');
  
  // Home page handles its own header spacing in Hero section
  const isHomePage = pathname === '/';

  // Единый холл /messages — своя шапка, без отступа под UniversalHeader
  const isUnifiedMessagesHall = pathname?.startsWith('/messages');
  
  if (isAdminPage || isPartnerPage || isHomePage || isUnifiedMessagesHall) {
    return <>{children}</>;
  }
  
  // All other pages need padding for UniversalHeader (h-14 = 56px = pt-14)
  return (
    <div className='pt-14'>
      {children}
    </div>
  );
}

export default MainContent;
