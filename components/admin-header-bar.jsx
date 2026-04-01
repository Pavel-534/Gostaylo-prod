/**
 * GoStayLo - Admin Header Bar
 * Persistent "Back to Admin" navigation for ADMIN role
 * Shows on all pages when logged in as Admin
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, ArrowLeft, Home, Users, Building2, CreditCard, MessageSquare, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function AdminHeaderBar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    checkAdminRole();
  }, []);

  async function checkAdminRole() {
    try {
      if (!supabaseUrl || !supabaseKey) {
        setLoading(false);
        return;
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.role === 'ADMIN');
    } catch (error) {
      console.error('[ADMIN CHECK]', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  // Don't show if not admin or still loading
  if (loading || !isAdmin) return null;

  // Don't show on admin pages (already there)
  const isOnAdminPage = pathname?.startsWith('/admin');
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-10">
          {/* Left - Admin Badge */}
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Admin Mode</span>
          </div>

          {/* Center - Quick Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/admin">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 text-white hover:bg-white/20 ${isOnAdminPage && pathname === '/admin' ? 'bg-white/20' : ''}`}
              >
                <Home className="h-3 w-3 mr-1" />
                Dashboard
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-white hover:bg-white/20"
              >
                <Users className="h-3 w-3 mr-1" />
                Users
              </Button>
            </Link>
            <Link href="/admin/listings">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-white hover:bg-white/20"
              >
                <Building2 className="h-3 w-3 mr-1" />
                Listings
              </Button>
            </Link>
            <Link href="/admin/finance">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-white hover:bg-white/20"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Finance
              </Button>
            </Link>
            <Link href="/admin/messages/">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-white hover:bg-white/20"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Messages
              </Button>
            </Link>
          </div>

          {/* Right - Back to Admin Button */}
          {!isOnAdminPage && (
            <Link href="/admin">
              <Button 
                size="sm" 
                className="h-7 bg-white text-indigo-600 hover:bg-indigo-50"
                data-testid="back-to-admin-btn"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back to Admin
              </Button>
            </Link>
          )}
          
          {isOnAdminPage && (
            <Link href="/">
              <Button 
                variant="ghost"
                size="sm" 
                className="h-7 text-white hover:bg-white/20"
              >
                View Site →
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminHeaderBar;
