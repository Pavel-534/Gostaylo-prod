import { Suspense } from 'react';
import { PlatformHomeContent } from '@/components/PlatformHomeContent';
import { HomePageSkeleton } from '@/components/home-page-skeleton';

/** Статическая оболочка: данные тянет клиент (`PlatformHomeContent`); без `force-dynamic` — ниже TTFB. */

export default function Page() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <PlatformHomeContent />
    </Suspense>
  );
}
