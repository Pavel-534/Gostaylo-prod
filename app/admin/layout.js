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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      // In real app, get from auth session
      const res = await fetch('/api/profile?userId=admin-777');
      if (res.ok) {
        const data = await res.json();
        if (data.data.role !== 'ADMIN') {
          router.push('/');
          return;
        }
        setUser(data.data);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to check admin access:', error);
      router.push('/');
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
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-indigo-900 via-indigo-800 to-purple-900 text-white transition-all duration-300 flex flex-col fixed h-screen z-30`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-indigo-700 flex items-center justify-between">
          {sidebarOpen && (
            <div>
              <h1 className="text-2xl font-bold">FunnyRent</h1>
              <p className="text-xs text-indigo-300 mt-1">Admin Panel</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-indigo-900 shadow-lg'
                    : 'text-indigo-100 hover:bg-indigo-700'
                } ${!sidebarOpen && 'justify-center'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-indigo-700">
          {sidebarOpen ? (
            <div>
              <p className="text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-indigo-300">{user.email}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-red-300 hover:text-red-200 hover:bg-red-900/20"
                onClick={() => router.push('/')}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Выход
              </Button>
            </div>
          ) : (
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-red-900/20 rounded-lg transition-colors w-full flex justify-center"
            >
              <LogOut className="w-5 h-5 text-red-300" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        } transition-all duration-300 p-8`}
      >
        {children}
      </main>
    </div>
  );
}
