import { Suspense } from 'react';
import { GostayloHomeContent } from '@/components/GostayloHomeContent';
import { Loader2 } from 'lucide-react';

// Loading fallback for Suspense
function HomeLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-teal-500 mx-auto mb-4" />
        <p className="text-white text-lg">Loading Gostaylo...</p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <GostayloHomeContent />
    </Suspense>
  );
}
