/**
 * GoStayLo - Dashboard Router
 * Redirects to appropriate dashboard based on user role
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DashboardRouter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRoleAndRedirect();
  }, []);

  async function checkRoleAndRedirect() {
    try {
      const res = await fetch('/api/v2/auth/me', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({}));

      if (res.status === 401 || !payload?.success || !payload?.user) {
        router.push('/login');
        return;
      }

      const role = String(payload.user.role || 'RENTER').toUpperCase();

      switch (role) {
        case 'ADMIN':
        case 'MODERATOR':
          router.push('/admin');
          break;
        case 'PARTNER':
          router.push('/partner/dashboard');
          break;
        case 'RENTER':
        default:
          router.push('/renter/dashboard');
          break;
      }
    } catch (error) {
      console.error('[DASHBOARD] Error:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto" />
          <p className="mt-2 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return null;
}
