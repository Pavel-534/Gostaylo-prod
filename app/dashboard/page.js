/**
 * Gostaylo - Dashboard Router
 * Redirects to appropriate dashboard based on user role
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function DashboardRouter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRoleAndRedirect();
  }, []);

  async function checkRoleAndRedirect() {
    try {
      if (!supabaseUrl || !supabaseKey) {
        router.push('/');
        return;
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role || 'RENTER';

      // Redirect based on role
      switch (role) {
        case 'ADMIN':
          router.push('/admin');
          break;
        case 'PARTNER':
          router.push('/dashboard/partner');
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
