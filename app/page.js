import { Suspense } from 'react';
import { GostayloHomeContent } from '@/components/GostayloHomeContent';
import { HomePageSkeleton } from '@/components/home-page-skeleton';

/** Статическая оболочка: данные тянет клиент (`GostayloHomeContent`); без `force-dynamic` — ниже TTFB. */

export default function Page() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <GostayloHomeContent />
    </Suspense>
  );
}
