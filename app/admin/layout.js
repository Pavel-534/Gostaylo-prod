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
  Server,
  MessageSquare,
  FileDown,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MODERATOR_RESTRICTED_PREFIXES = [
  '/admin/finances',
  '/admin/users',
  '/admin/marketing',
  '/admin/security',
  '/admin/settings',
  '/admin/audit-export',
  '/admin/ai-usage',
  '/admin/system/ai',
];

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
    if (!user?.isModerator) return;
    if (MODERATOR_RESTRICTED_PREFIXES.some((path) => pathname.startsWith(path))) {
      router.replace('/admin/dashboard');
    }
  }, [pathname, user?.isModerator, router]);

  useEffect(() => {
    checkAdminAccess();
    // Set initial sidebar state based on screen width
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);

  const checkAdminAccess = async () => {
    try {
      const storedUser = localStorage.getItem('gostaylo_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        // Check if user has moderator marker in lastName
        const isModerator = parsed.isModerator || (parsed.lastName && parsed.lastName.includes('[MODERATOR]'));
        
        // Allow ADMIN and MODERATOR roles
        if (parsed.role === 'ADMIN' || parsed.role === 'MODERATOR' || isModerator) {
          // Update user state with correct isModerator flag
          const userWithModerator = { ...parsed, isModerator };
          setUser(userWithModerator);
          
          // HARD-BLOCK: If moderator tries to access restricted pages via URL
          if (isModerator) {
            const currentPath = window.location.pathname;
            if (MODERATOR_RESTRICTED_PREFIXES.some((path) => currentPath.startsWith(path))) {
              // Redirect moderator away from restricted pages
              window.location.href = '/admin/dashboard';
              return;
            }
          }
          
          // Check for impersonation state
          if (parsed.isImpersonated) {
            setIsImpersonating(true);
            const savedAdmin = localStorage.getItem('gostaylo_original_admin');
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
      localStorage.setItem('gostaylo_user', JSON.stringify(originalAdmin));
      localStorage.removeItem('gostaylo_original_admin');
      // Force full page reload to update all UI state
      window.location.href = '/admin/users';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gostaylo_user');
    localStorage.removeItem('gostaylo_original_admin');
    // Force full page reload
    window.location.href = '/';
  };

  // Menu items with access control
  // MODERATOR can only access: Dashboard, Moderation, Categories
  // NO access to: Finances, Users, Marketing, Security, Settings
  const allMenuItems = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', moderatorAccess: true },
    { href: '/admin/system', icon: Server, label: 'System', moderatorAccess: false },
    { href: '/admin/moderation', icon: Shield, label: 'Модерация', moderatorAccess: true },
    { href: '/admin/partners', icon: UserCog, label: 'Заявки партнёров', moderatorAccess: false },
    { href: '/admin/messages/', icon: MessageSquare, label: 'Сообщения', moderatorAccess: true },
    { href: '/admin/finances', icon: Wallet, label: 'Финансы', moderatorAccess: false },
    { href: '/admin/users', icon: Users, label: 'Пользователи', moderatorAccess: false },
    { href: '/admin/marketing', icon: TrendingUp, label: 'Маркетинг', moderatorAccess: false },
    { href: '/admin/security', icon: ShieldAlert, label: 'Безопасность', moderatorAccess: false },
    { href: '/admin/audit-export', icon: FileDown, label: 'Выгрузки', moderatorAccess: false },
    { href: '/admin/categories', icon: Layers, label: 'Категории', moderatorAccess: true },
    { href: '/admin/ai-usage', icon: Sparkles, label: 'Расходы AI', moderatorAccess: false },
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

  const isAdminMessagesSection = pathname?.startsWith('/admin/messages');

  return (
    <div
      className={cn(
        'flex flex-col bg-slate-50',
        isAdminMessagesSection
          ? 'max-lg:fixed max-lg:inset-0 max-lg:z-[1] max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:overflow-hidden lg:relative lg:inset-auto lg:z-auto lg:min-h-screen lg:h-auto lg:max-h-none lg:overflow-visible'
          : 'min-h-screen',
      )}
    >
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Top Header - Premium Deep Sea Design */}
      <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white z-30 lg:hidden shadow-lg">
        {/* Impersonation Banner - Mobile */}
        {isImpersonating && (
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium truncate flex-1">
              👤 Режим: {user?.name}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReturnToAdmin}
              className="bg-white text-amber-900 hover:bg-amber-100 h-7 px-2 text-xs ml-2 flex-shrink-0 shadow-sm"
              data-testid="return-to-admin-mobile"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Назад
            </Button>
          </div>
        )}
        
        {/* Main Mobile Header */}
        <div className="h-14 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-95"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="text-center flex-1 mx-3">
            <div className="flex items-center justify-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white text-xs font-bold">FR</span>
              </div>
              <h1 className="text-sm font-bold tracking-tight">GoStayLo Admin</h1>
            </div>
          </div>
          
          {/* Mobile Quick Actions */}
          <div className="flex items-center gap-1">
            <Link 
              href="/"
              className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-95"
              aria-label="На сайт"
            >
              <Home className="w-5 h-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="p-2.5 hover:bg-red-500/20 rounded-xl transition-all active:scale-95 text-red-400"
              aria-label="Выход"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area — min-h-0: дочерний main может сжиматься, скролл остаётся внутри чата */}
      <div className={cn('flex min-h-0 flex-1', isAdminMessagesSection && 'overflow-hidden')}>
        {/* Sidebar - Premium Deep Sea Design */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white transition-all duration-300 ease-out flex flex-col fixed h-screen z-50 lg:z-30 shadow-2xl`}
        >
        {/* Logo */}
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <div className={`${!sidebarOpen && 'lg:hidden'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                <span className="text-white text-sm font-bold">FR</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">GoStayLo</h1>
                <p className="text-[10px] text-teal-400 font-medium uppercase tracking-wider">
                  {user?.isModerator ? 'Moderator' : 'Admin Panel'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all hidden lg:block"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white active:scale-[0.98]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? '' : 'opacity-70'}`} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Выход
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'w-full max-w-full flex-1 overflow-x-hidden pt-14 lg:ml-64 lg:pt-0',
          isAdminMessagesSection &&
            'flex min-h-0 flex-col overflow-hidden max-lg:flex-1'
        )}
      >
        {/* Desktop Top Bar with Impersonation */}
        <div className="hidden lg:block sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200/50 z-10">
          {/* Impersonation Banner - Desktop */}
          {isImpersonating && (
            <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 px-6 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCog className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Режим просмотра: <strong>{user?.name}</strong> ({user?.role})
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleReturnToAdmin}
                className="bg-white text-amber-900 hover:bg-amber-100 shadow-sm"
                data-testid="return-to-admin-desktop"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Вернуться в Admin
              </Button>
            </div>
          )}
          
          {/* Normal Top Bar */}
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors">
                <Home className="w-4 h-4" />
                <span className="text-sm font-medium">На сайт</span>
              </Link>
              <span className="text-slate-200">|</span>
              <Link href="/" target="_blank" className="flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors">
                <ExternalLink className="w-4 h-4" />
                <span className="text-sm">Новая вкладка</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                <span className="font-medium">{user?.isModerator ? 'Moderator' : 'Admin'}</span>
                <span className="text-slate-400">•</span>
                <span>{user?.name}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Выход
              </Button>
            </div>
          </div>
        </div>
        
        {/* Page Content with proper padding */}
        <div
          className={cn(
            'max-w-full overflow-x-hidden p-4 lg:p-8',
            isAdminMessagesSection &&
              'flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0 lg:p-6'
          )}
        >
          {children}
        </div>
      </main>
      </div>
    </div>
  );
}
