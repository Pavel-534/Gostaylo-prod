/**
 * FunnyRent 2.1 - Homepage with Server-Side Data
 * Uses SSR to bypass Kubernetes routing issues
 */

import { getInitialPageData } from '@/lib/server-data';
import HomePageClient from './HomePageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FunnyRentHome() {
  // Fetch data server-side (bypasses Kubernetes routing)
  const initialData = await getInitialPageData();
  
  return <HomePageClient initialData={initialData} />;
}
