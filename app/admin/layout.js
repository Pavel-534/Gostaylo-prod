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
  Home,
  ExternalLink,
  UserCog,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdmin, setOriginalAdmin] = useState(null);

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
      const storedUser = localStorage.getItem('funnyrent_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        // Allow ADMIN and MODERATOR roles
        if (parsed.role === 'ADMIN' || parsed.role === 'MODERATOR' || parsed.isModerator) {
          setUser(parsed);
          // Check for impersonation state
          if (parsed.isImpersonated) {
            setIsImpersonating(true);
            const savedAdmin = localStorage.getItem('funnyrent_original_admin');
            if (savedAdmin) {
              setOriginalAdmin(JSON.parse(savedAdmin));
            }
          }
          setLoading(false);
          return;
        }
      }
      
      router.push('/');
      return;
      
    } catch (error) {
      console.error('Failed to check admin access:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToAdmin = () => {
    if (originalAdmin) {
      localStorage.setItem('funnyrent_user', JSON.stringify(originalAdmin));
      localStorage.removeItem('funnyrent_original_admin');
      setIsImpersonating(false);
      router.push('/admin/users');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('funnyrent_user');
    localStorage.removeItem('funnyrent_original_admin');
    router.push('/');
  };

  // Menu items with access control
  // MODERATOR can only access: Dashboard, Moderation, Categories
  // NO access to: Finances, Users, Marketing, Security, Settings
  const allMenuItems = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', moderatorAccess: true },
    { href: '/admin/moderation', icon: Shield, label: 'Модерация', moderatorAccess: true },
    { href: '/admin/finances', icon: Wallet, label: 'Финансы', moderatorAccess: false },
    { href: '/admin/users', icon: Users, label: 'Пользователи', moderatorAccess: false },
    { href: '/admin/marketing', icon: TrendingUp, label: 'Маркетинг', moderatorAccess: false },
    { href: '/admin/security', icon: ShieldAlert, label: 'Безопасность', moderatorAccess: false },
    { href: '/admin/categories', icon: Layers, label: 'Категории', moderatorAccess: true },
    { href: '/admin/settings', icon: Settings, label: 'Настройки', moderatorAccess: false },
    { href: '/admin/test-db', icon: Database, label: 'Test DB', moderatorAccess: true },
  ];

  // Filter menu based on role
  const menuItems = user?.isModerator 
    ? allMenuItems.filter(item => item.moderatorAccess)
    : allMenuItems;

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Top Header - Fixed with proper spacing */}
      <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-indigo-900 to-purple-900 text-white z-40 lg:hidden">
        {/* Impersonation Banner - Mobile */}
        {isImpersonating && (
          <div className="bg-amber-500 text-amber-900 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium truncate flex-1">
              Вы как: {user?.name}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReturnToAdmin}
              className="bg-white text-amber-900 hover:bg-amber-100 h-7 px-2 text-xs ml-2 flex-shrink-0"
              data-testid="return-to-admin-mobile"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Назад
            </Button>
          </div>
        )}
        
        {/* Main Mobile Header */}
        <div className="h-14 flex items-center justify-between px-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="text-center flex-1 mx-2">
            <h1 className="text-base font-bold truncate">FunnyRent Admin</h1>
          </div>
          
          {/* Mobile Quick Actions */}
          <div className="flex items-center gap-1">
            <Link 
              href="/"
              className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
              aria-label="На сайт"
            >
              <Home className="w-5 h-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-700 rounded-lg transition-colors text-red-300"
              aria-label="Выход"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } w-64 bg-gradient-to-b from-indigo-900 via-indigo-800 to-purple-900 text-white transition-all duration-300 flex flex-col fixed h-screen z-30`}
        >
        {/* Logo */}
        <div className="p-4 lg:p-6 border-b border-indigo-700 flex items-center justify-between">
          <div className={`${!sidebarOpen && 'lg:hidden'}`}>
            <h1 className="text-xl lg:text-2xl font-bold">FunnyRent</h1>
            <p className="text-xs text-indigo-300 mt-1">
              {user?.isModerator ? 'Moderator Panel' : 'Admin Panel'}
            </p>
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
        {/* Top Action Bar - Desktop */}
        <div className="hidden lg:flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors">
              <Home className="w-4 h-4" />
              <span className="text-sm">На сайт</span>
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/" target="_blank" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors">
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm">Открыть в новой вкладке</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserCog className="w-4 h-4" />
              <span>{user?.isModerator ? 'Moderator' : 'Admin'}: {user?.name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                localStorage.removeItem('funnyrent_user');
                router.push('/');
              }}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Выход
            </Button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
