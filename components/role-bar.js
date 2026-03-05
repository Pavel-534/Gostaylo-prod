/**
 * FunnyRent 2.1 - Admin/Partner Navigation Bar
 * Shows a persistent bar at the top for logged-in ADMIN or PARTNER users
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Shield, Store, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RoleBar() {
  const [user, setUser] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    // Check localStorage for logged in user
    const storedUser = localStorage.getItem('gostaylo_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.role === 'ADMIN' || parsed.role === 'PARTNER') {
          setUser(parsed);
        }
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }
  }, [pathname]);

  // Don't show on admin or partner dashboards (they have their own navigation)
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/partner')) {
    return null;
  }

  // Don't show if no user or user is a regular renter
  if (!user || (user.role !== 'ADMIN' && user.role !== 'PARTNER')) {
    return null;
  }

  const isAdmin = user.role === 'ADMIN';
  const dashboardPath = isAdmin ? '/admin/dashboard' : '/partner/dashboard';
  const dashboardLabel = isAdmin ? 'Admin Panel' : 'Partner Dashboard';
  const bgColor = isAdmin ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-gradient-to-r from-teal-600 to-emerald-600';
  const Icon = isAdmin ? Shield : Store;

  const handleLogout = () => {
    localStorage.removeItem('gostaylo_user');
    setUser(null);
    window.location.reload();
  };

  return (
    <div className={`${bgColor} text-white py-2 px-4 shadow-lg sticky top-0 z-50`} data-testid="role-bar">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-sm sm:text-base font-medium hidden sm:inline">
            {isAdmin ? 'Вы вошли как Администратор' : 'Вы вошли как Партнёр'}
          </span>
          <span className="text-sm font-medium sm:hidden">
            {isAdmin ? 'Admin' : 'Partner'}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button 
            asChild 
            variant="secondary" 
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs sm:text-sm"
            data-testid="back-to-dashboard-btn"
          >
            <Link href={dashboardPath}>
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{dashboardLabel}</span>
              <span className="sm:hidden">Dashboard</span>
            </Link>
          </Button>
          
          <div className="hidden sm:flex items-center gap-2 text-sm border-l border-white/30 pl-3">
            <User className="h-4 w-4" />
            <span className="max-w-[120px] truncate">{user.name || user.email}</span>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleLogout}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1 sm:p-2"
            data-testid="logout-btn"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
