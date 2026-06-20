'use client';

import '@/lib/translations/register-chat-slice';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Menu, X, Home, ExternalLink, UserCog, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getSiteDisplayName } from '@/lib/site-url';
import { HeaderWalletCompact } from '@/components/wallet/HeaderWalletCompact';
import { AppHeader } from '@/components/app-header/AppHeader';
import { useAuth } from '@/contexts/auth-context';
import {
  filterAdminMenuGroupsForRole,
  getAdminRestrictedPrefixesForRole,
  isAdminNavHrefActive,
  normalizeAdminRole,
  resolveAdminBreadcrumb,
} from '@/lib/admin/admin-menu';
import { resolveAdminMenuIcon } from '@/lib/admin/admin-menu-icons';
import { AdminQuickActionsBar } from '@/components/admin/AdminQuickActionsBar';
import { AdminGlobalSearch } from '@/components/admin/AdminGlobalSearch';
import {
  WORKSPACE_FRAME_CLASS,
  WORKSPACE_MAIN_CLASS,
  WORKSPACE_SCROLL_CLASS,
  WORKSPACE_SIDEBAR_CLASS,
  WORKSPACE_TOOLBAR_CLASS,
  WORKSPACE_TOOLBAR_ROW_CLASS,
} from '@/lib/layout/workspace-shell';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading: authLoading, isAuthenticated, logout, updateUser } = useAuth();
  const isImpersonating = user?.is_impersonating === true;

  const adminRole = normalizeAdminRole(user?.role);
  const visibleGroups = filterAdminMenuGroupsForRole(adminRole);
  const restrictedPrefixes = adminRole ? getAdminRestrictedPrefixesForRole(adminRole) : [];

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!adminRole || adminRole === 'ADMIN') return;
    const p = String(pathname || '');
    if (restrictedPrefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
      router.replace('/admin/dashboard');
    }
  }, [pathname, adminRole, restrictedPrefixes, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      const loc = typeof window !== 'undefined' ? window.location : null;
      const path = loc ? encodeURIComponent(`${loc.pathname || ''}${loc.search || ''}`) : '';
      router.replace(path ? `/login?redirect=${path}` : '/login');
      return;
    }
    if (typeof window !== 'undefined') {
      const savedAdmin = localStorage.getItem('gostaylo_original_admin');
      if (savedAdmin) {
        try {
          const admin = JSON.parse(savedAdmin);
          const adminRoleSaved = String(admin?.role || '').toUpperCase();
          if (['ADMIN', 'MODERATOR'].includes(adminRoleSaved)) {
            localStorage.removeItem('gostaylo_original_admin');
            localStorage.setItem('gostaylo_user', JSON.stringify(admin));
            updateUser?.(admin);
            return;
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (!adminRole) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, adminRole, router, updateUser]);

  const handleReturnToAdmin = () => router.push('/admin/users');
  const handleLogout = () => logout();

  if (authLoading) {
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
  const breadcrumb = resolveAdminBreadcrumb(pathname, visibleGroups);

  return (
    <div
      className={cn(
        'flex flex-col bg-slate-50',
        isAdminMessagesSection
          ? 'max-lg:fixed max-lg:inset-0 max-lg:z-[1] max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:overflow-hidden lg:relative lg:inset-auto lg:z-auto lg:min-h-screen lg:h-auto lg:max-h-none lg:overflow-visible'
          : 'min-h-screen',
      )}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppHeader variant="workspace" onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className={WORKSPACE_FRAME_CLASS}>
        <aside
          className={cn(
            WORKSPACE_SIDEBAR_CLASS,
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl lg:shadow-none',
          )}
        >
          <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
            <div className={`${!sidebarOpen && 'lg:hidden'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-brand/80 to-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
                  <span className="text-white text-sm font-bold">FR</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight">{getSiteDisplayName()}</h1>
                  <p className="text-[10px] text-brand/80 font-medium uppercase tracking-wider">
                    {adminRole === 'MODERATOR' ? 'Moderator' : 'Admin Panel'}
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
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-all lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
            {visibleGroups.map((group) => (
              <div key={group.key}>
                <div className="px-3 pb-2 pt-2">
                  <p
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-wider',
                      group.emphasize ? 'text-emerald-300/90' : 'text-slate-400/90',
                    )}
                  >
                    {group.title}
                  </p>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = resolveAdminMenuIcon(item.icon);
                    const active = isAdminNavHrefActive(pathname, item.href, {
                      exact: item.navExact === true,
                    });
                    const emphasized = item.emphasize === true;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          if (window.innerWidth < 1024) {
                            setSidebarOpen(false);
                          }
                        }}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                          active
                            ? 'bg-gradient-to-r from-brand to-brand-hover text-white shadow-lg shadow-brand/30'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white active:scale-[0.98]',
                          emphasized &&
                            !active &&
                            'bg-gradient-to-r from-emerald-500/15 to-brand/10 border border-emerald-400/20 text-white',
                        )}
                      >
                        <Icon
                          className={cn('w-5 h-5', active ? '' : 'opacity-70', emphasized && !active && 'opacity-90')}
                        />
                        <span className="font-medium text-sm">{item.title}</span>
                        {emphasized ? (
                          <span
                            className={cn(
                              'ml-auto text-[10px] font-bold tracking-wider',
                              active ? 'text-white/90' : 'text-emerald-200',
                            )}
                          >
                            FIN
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
                <div className="mt-4 h-px bg-white/5" />
              </div>
            ))}
          </nav>

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

        <main className={cn(WORKSPACE_MAIN_CLASS, isAdminMessagesSection && 'min-h-0')}>
          <div className={WORKSPACE_TOOLBAR_CLASS}>
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

            <div className={WORKSPACE_TOOLBAR_ROW_CLASS}>
              <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-brand transition-colors">
                  <Home className="w-4 h-4" />
                  <span className="text-sm font-medium">На сайт</span>
                </Link>
                <span className="text-slate-200">|</span>
                <Link
                  href="/"
                  target="_blank"
                  className="flex items-center gap-2 text-slate-600 hover:text-brand transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-sm">Новая вкладка</span>
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <HeaderWalletCompact />
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                  <div className="w-2 h-2 bg-brand rounded-full animate-pulse"></div>
                  <span className="font-medium">{adminRole === 'MODERATOR' ? 'Moderator' : 'Admin'}</span>
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

          <div
            className={cn(
              'w-full overflow-x-hidden',
              isAdminMessagesSection
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-0 lg:p-6'
                : WORKSPACE_SCROLL_CLASS,
            )}
          >
            <div
              className={cn(
                'w-full',
                !isAdminMessagesSection && 'mx-auto max-w-7xl',
              )}
            >
              {!isAdminMessagesSection ? (
                <div className="mb-5 space-y-3">
                  <AdminGlobalSearch className="w-full" />
                  {breadcrumb ? (
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                        <span className="font-semibold text-slate-800 truncate">{breadcrumb.group}</span>
                        <span className="text-slate-300 shrink-0">→</span>
                        <span className="text-slate-500 truncate">{breadcrumb.page}</span>
                      </div>
                      <AdminQuickActionsBar groupKey={breadcrumb.groupKey} role={adminRole} className="shrink-0" />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
