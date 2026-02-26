'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Shield,
  Wallet,
  Users,
  Settings,
  Layers,
  TrendingUp,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed on mobile

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    checkAdminAccess();
    // Set initial sidebar state based on screen width
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);

  const checkAdminAccess = async () => {
    try {
      // First check localStorage for logged in user
      const storedUser = localStorage.getItem('funnyrent_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.role === 'ADMIN') {
          setUser(parsed);
          setLoading(false);
          return;
        }
      }
      
      // Fallback: Direct Supabase check for admin-777
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.admin-777`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0 && data[0].role === 'ADMIN') {
          // Check if this is a MODERATOR (marked in last_name)
          const isModerator = data[0].last_name?.includes('[MODERATOR]');
          const adminUser = {
            id: data[0].id,
            email: data[0].email,
            role: isModerator ? 'MODERATOR' : data[0].role,
            firstName: data[0].first_name,
            lastName: data[0].last_name?.replace(' [MODERATOR]', ''),
            name: `${data[0].first_name || ''} ${(data[0].last_name || '').replace(' [MODERATOR]', '')}`.trim(),
            isModerator
          };
          setUser(adminUser);
          // Also store in localStorage
          localStorage.setItem('funnyrent_user', JSON.stringify(adminUser));
        } else {
          router.push('/');
          return;
        }
      } else {
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Failed to check admin access:', error);
      // Allow access during development
      setUser({
        id: 'admin-777',
        email: 'admin@funnyrent.com',
        role: 'ADMIN',
        name: 'Pavel B.'
      });
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/moderation', icon: Shield, label: 'Модерация' },
    { href: '/admin/finances', icon: Wallet, label: 'Финансы' },
    { href: '/admin/users', icon: Users, label: 'Пользователи' },
    { href: '/admin/marketing', icon: TrendingUp, label: 'Маркетинг' },
    { href: '/admin/security', icon: ShieldAlert, label: 'Безопасность' },
    { href: '/admin/categories', icon: Layers, label: 'Категории' },
    { href: '/admin/settings', icon: Settings, label: 'Настройки' },
    { href: '/admin/test-db', icon: Database, label: 'Test DB' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-indigo-900 to-purple-900 text-white flex items-center justify-between px-4 z-40 lg:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold">FunnyRent</h1>
          <p className="text-xs text-indigo-300">Admin</p>
        </div>
        <div className="w-10" /> {/* Spacer for balance */}
      </header>

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          sidebarOpen ? 'w-64' : 'lg:w-20'
        } bg-gradient-to-b from-indigo-900 via-indigo-800 to-purple-900 text-white transition-all duration-300 flex flex-col fixed h-screen z-30 lg:w-64`}
      >
        {/* Logo */}
        <div className="p-4 lg:p-6 border-b border-indigo-700 flex items-center justify-between">
          <div className={`${!sidebarOpen && 'lg:hidden'}`}>
            <h1 className="text-xl lg:text-2xl font-bold">FunnyRent</h1>
            <p className="text-xs text-indigo-300 mt-1">Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-indigo-700 rounded-lg transition-colors hidden lg:block"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-indigo-700 rounded-lg transition-colors lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  // Close sidebar on mobile after navigation
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(false);
                  }
                }}
                className={`flex items-center gap-3 p-3 lg:p-3 rounded-lg transition-all min-h-[48px] ${
                  isActive
                    ? 'bg-white text-indigo-900 shadow-lg'
                    : 'text-indigo-100 hover:bg-indigo-700 active:bg-indigo-600'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-3 lg:p-4 border-t border-indigo-700">
          <div>
            <p className="text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-indigo-300 truncate">{user.email}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-red-300 hover:text-red-200 hover:bg-red-900/20 min-h-[44px]"
              onClick={() => {
                localStorage.removeItem('funnyrent_user');
                router.push('/');
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Выход
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 pt-20 lg:pt-0 px-3 pb-6 lg:p-8 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        } lg:ml-64`}
      >
        {children}
      </main>
    </div>
  );
}
