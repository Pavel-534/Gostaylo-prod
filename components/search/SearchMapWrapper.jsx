/**
 * SearchMapWrapper Component
 * Extracted from /app/app/listings/page.js
 * Wraps InteractiveSearchMap with proper memoization
 */

'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const InteractiveSearchMap = dynamic(
  () => import('@/components/listing/InteractiveSearchMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-slate-400">Loading map...</span>
      </div>
    )
  }
);

function SearchMapWrapperComponent({ 
  listings = [],
  userBookings = [],
  userId = null,
  showMap = false,
  className
}) {
  return (
    <div className={cn(
      "lg:w-1/2 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]",
      !showMap && "hidden lg:block",
      className
    )}>
      <div className="h-[500px] lg:h-full rounded-lg overflow-hidden border border-slate-200 shadow-lg">
        <InteractiveSearchMap 
          listings={listings}
          userBookings={userBookings}
          userId={userId}
          center={[7.8804, 98.3923]} // Phuket, Thailand
          zoom={12}
        />
      </div>
    </div>
  );
}

// Memoize to prevent re-renders during list scrolling
export const SearchMapWrapper = memo(SearchMapWrapperComponent, (prevProps, nextProps) => {
  // Only re-render if listings, userBookings, userId, or showMap changed
  return (
    prevProps.listings === nextProps.listings &&
    prevProps.userBookings === nextProps.userBookings &&
    prevProps.userId === nextProps.userId &&
    prevProps.showMap === nextProps.showMap
  );
});
