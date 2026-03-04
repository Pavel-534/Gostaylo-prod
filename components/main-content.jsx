/**
 * MainContent wrapper - conditionally adds padding for UniversalHeader
 * No padding on /admin pages (they have their own layout)
 */

'use client';

import { usePathname } from 'next/navigation';

export function MainContent({ children }) {
  const pathname = usePathname();
  
  // Admin pages have their own layout with sidebar, no padding needed
  const isAdminPage = pathname?.startsWith('/admin');
  
  if (isAdminPage) {
    return <>{children}</>;
  }
  
  // All other pages need padding for UniversalHeader (h-12 = 48px = pt-12)
  return (
    <div className='pt-12'>
      {children}
    </div>
  );
}

export default MainContent;
