/**
 * GoStayLo - App Sidebar Navigation
 * Based on ARCHITECTURAL_PASSPORT.md requirements:
 * - System Settings (TG Bot, Webhooks, Maintenance, Commission)
 * - Finance Hub (Real-time rates, live finance insights)
 * - Messages (Telegram Thread 18)
 * - Admin Moderation (Listings + Partner Applications)
 * - Role-based filtering (PENDING_PARTNER, INACTIVE listings)
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, Home, Users, Building2, Calendar, MessageSquare, 
  CreditCard, Settings, Shield, Store, BarChart3,
  Wallet, UserCheck, ChevronRight, DollarSign, 
  Power, Bot, Globe, FileCheck, ListChecks, Star
} from 'lucide-react';
import { getSiteDisplayName } from '@/lib/site-url';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { useChatContext } from '@/lib/context/ChatContext';

// Admin navigation items - Full Control Panel per ARCHITECTURAL_PASSPORT
const ADMIN_NAV = [
  { 
    label: 'Dashboard', 
    href: '/admin', 
    icon: BarChart3,
    description: 'Overview & Stats'
  },
  { 
    label: 'Users', 
    href: '/admin/users', 
    icon: Users,
    description: 'Manage all users'
  },
  { 
    label: 'Partner Applications', 
    href: '/admin/moderation?tab=partners', 
    icon: UserCheck,
    description: 'PENDING_PARTNER moderation',
    badge: 'NEW'
  },
  { 
    label: 'Listing Moderation', 
    href: '/admin/moderation', 
    icon: FileCheck,
    description: 'PENDING listings'
  },
  { 
    label: 'All Bookings', 
    href: '/admin/dashboard', 
    icon: Calendar,
    description: 'Reservations overview'
  },
  { 
    label: 'Messages', 
    href: '/admin/messages/', 
    icon: MessageSquare,
    description: 'TG Thread 18 Bridge'
  },
  { 
    label: 'Finance Hub', 
    href: '/admin/finances', 
    icon: DollarSign,
    description: 'Real-time rates • Live finance',
    badge: 'LIVE'
  },
  { 
    label: 'System Settings', 
    href: '/admin/settings', 
    icon: Settings,
    description: 'TG Bot • Webhooks • Commission'
  },
];

// Partner navigation items - Full Partner Portal menu
const PARTNER_NAV = [
  { 
    label: 'Панель управления', 
    href: '/partner/dashboard', 
    icon: BarChart3,
    description: 'Ваш обзор'
  },
  { 
    label: 'Мои листинги', 
    href: '/partner/listings', 
    icon: Building2,
    description: 'ACTIVE + INACTIVE'
  },
  { 
    label: 'Бронирования', 
    href: '/partner/bookings', 
    icon: Calendar,
    description: 'Резервации'
  },
  { 
    label: 'Отзывы', 
    href: '/partner/reviews', 
    icon: Star,
    description: 'Управление отзывами'
  },
  { 
    label: 'Сообщения', 
    href: '/messages', 
    icon: MessageSquare,
    description: 'Чат с гостями'
  },
  { 
    label: 'Финансы', 
    href: '/partner/finances', 
    icon: Wallet,
    description: 'Доход & Escrow'
  },
  { 
    label: 'Настройки', 
    href: '/partner/settings', 
    icon: Settings,
    description: 'Профиль партнёра'
  },
];

// Renter navigation items
const RENTER_NAV = [
  { 
    label: 'My Bookings', 
    href: '/renter/bookings', 
    icon: Calendar,
    description: 'Your reservations'
  },
  { 
    label: 'Messages', 
    href: '/messages', 
    icon: MessageSquare,
    description: 'Chat with hosts'
  },
  { 
    label: 'Browse', 
    href: '/listings', 
    icon: Home,
    description: 'Find properties'
  },
];

export function AppSidebar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  
  // Get auth context
  let authContext = null;
  try {
    authContext = useAuth();
  } catch (e) {
    // Context not available, fallback to localStorage
  }
  
  const { totalUnread } = useChatContext();
  const [user, setUser] = useState(authContext?.user || null);
  
  useEffect(() => {
    setMounted(true);
    // Load user from localStorage as fallback
    if (!authContext) {
      const storedUser = localStorage.getItem('gostaylo_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          setUser(null);
        }
      }
    } else {
      setUser(authContext.user);
    }
    
    // Listen for auth changes
    const handleAuthChange = (e) => {
      setUser(e.detail);
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, [pathname, authContext?.user]);

  const handleLoginClick = () => {
    setOpen(false);
    if (authContext?.openLoginModal) {
      authContext.openLoginModal();
    } else {
      // Fallback - redirect to home with login param
      window.location.href = '/?login=true';
    }
  };

  if (!mounted) return null;

  const isAdmin = user?.role === 'ADMIN';
  const isPartner = user?.role === 'PARTNER';
  const isOnAdminPage = pathname?.startsWith('/admin');
  const isOnPartnerPage = pathname?.startsWith('/partner');

  // Determine which nav to show based on role and current page
  const getNavItems = () => {
    // Admin sees admin nav when on admin pages
    if (isOnAdminPage && isAdmin) return ADMIN_NAV;
    // Partners/Admin see partner nav on partner pages
    if (isOnPartnerPage && (isAdmin || isPartner)) return PARTNER_NAV;
    // Admin gets choice of all panels
    if (isAdmin) return ADMIN_NAV;
    // Partner gets partner nav
    if (isPartner) return PARTNER_NAV;
    // Everyone else (renters, guests) gets renter nav
    return RENTER_NAV;
  };

  const navItems = getNavItems();
  const currentSection = isOnAdminPage ? 'Admin Panel' : 
                         isOnPartnerPage ? 'Partner Panel' : 
                         isAdmin ? 'Control Center' : 
                         isPartner ? 'Partner Hub' : 'My Account';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant='ghost' 
          size='icon' 
          className='h-9 w-9 hover:bg-slate-100'
          data-testid='sidebar-trigger'
        >
          <Menu className='h-5 w-5 text-slate-700' />
        </Button>
      </SheetTrigger>
      <SheetContent side='left' className='w-full sm:w-[320px] p-0 border-r-0 sm:border-r'>
        <SheetHeader className='p-4 border-b bg-gradient-to-r from-slate-50 to-white'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center'>
              <Home className='h-5 w-5 text-white' />
            </div>
            <div>
              <SheetTitle className='text-left'>{getSiteDisplayName()}</SheetTitle>
              <p className='text-xs text-slate-500'>{currentSection}</p>
            </div>
          </div>
        </SheetHeader>

        <div className='py-2 overflow-y-auto max-h-[calc(100vh-80px)]'>
          {/* User Info */}
          {user && (
            <div className='px-4 py-3 bg-slate-50 mx-2 rounded-lg mb-2'>
              <div className='flex items-center gap-3'>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  isAdmin ? 'bg-indigo-600' : isPartner ? 'bg-teal-600' : 'bg-slate-600'
                }`}>
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='font-medium text-slate-900 truncate'>{user.name || 'User'}</p>
                  <p className='text-xs text-slate-500 truncate'>{user.email}</p>
                  <Badge variant='outline' className={`mt-1 text-xs ${
                    isAdmin ? 'border-indigo-300 text-indigo-700' : 
                    isPartner ? 'border-teal-300 text-teal-700' : 
                    'border-slate-300'
                  }`}>
                    {user.role || 'RENTER'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Quick Switch for Admin - Panel Selector */}
          {isAdmin && (
            <div className='px-2 mb-2'>
              <p className='text-xs text-slate-400 uppercase tracking-wider px-3 mb-2'>Switch Panel</p>
              <div className='flex gap-1'>
                <Link href='/admin' className='flex-1' onClick={() => setOpen(false)}>
                  <Button 
                    variant={isOnAdminPage ? 'default' : 'outline'} 
                    size='sm' 
                    className={`w-full ${isOnAdminPage ? 'bg-indigo-600' : ''}`}
                  >
                    <Shield className='h-3 w-3 mr-1' />
                    Admin
                  </Button>
                </Link>
                <Link href='/partner/dashboard' className='flex-1' onClick={() => setOpen(false)}>
                  <Button 
                    variant={isOnPartnerPage ? 'default' : 'outline'} 
                    size='sm' 
                    className={`w-full ${isOnPartnerPage ? 'bg-teal-600' : ''}`}
                  >
                    <Store className='h-3 w-3 mr-1' />
                    Partner
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <Separator className='my-2' />

          {/* Navigation Links */}
          <nav className='px-2 space-y-1'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/messages'
                  ? pathname === '/messages' ||
                    pathname?.startsWith('/messages/')
                  : pathname === item.href ||
                    (item.href !== '/' && pathname?.startsWith(item.href.split('?')[0]));
              const isMessagesLink =
                item.href === '/messages' ||
                item.href === '/admin/messages/';
              const showUnreadBadge = isMessagesLink && totalUnread > 0 && !isActive;
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}>
                    <span className='relative flex-shrink-0'>
                      <Icon className={`h-5 w-5 ${isActive ? 'text-teal-600' : 'text-slate-500'}`} />
                      {showUnreadBadge && (
                        <span className='absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white' />
                      )}
                    </span>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <p className='font-medium text-sm truncate'>{item.label}</p>
                        {showUnreadBadge && (
                          <Badge variant='destructive' className='text-[10px] px-1.5 py-0 h-4'>
                            {totalUnread > 99 ? '99+' : totalUnread}
                          </Badge>
                        )}
                        {item.badge && !showUnreadBadge && (
                          <Badge 
                            variant='secondary' 
                            className={`text-[10px] px-1.5 py-0 ${
                              item.badge === 'LIVE' ? 'bg-green-100 text-green-700' :
                              item.badge === 'NEW' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100'
                            }`}
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className='text-xs text-slate-500 truncate'>{item.description}</p>
                    </div>
                    {isActive && <ChevronRight className='h-4 w-4 text-teal-500 flex-shrink-0' />}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Not logged in */}
          {!user && (
            <div className='px-4 py-6 text-center'>
              <p className='text-slate-600 mb-3'>Sign in to access your dashboard</p>
              <Button 
                className='bg-teal-600 hover:bg-teal-700'
                onClick={handleLoginClick}
              >
                Login / Register
              </Button>
            </div>
          )}

          <Separator className='my-2' />

          {/* Quick Links at Bottom */}
          <div className='px-2 space-y-1'>
            {/* System Status - Admin Only */}
            {isAdmin && (
              <Link href='/admin/system' onClick={() => setOpen(false)}>
                <div className='flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700'>
                  <Globe className='h-5 w-5 text-slate-500' />
                  <div className='flex-1'>
                    <p className='font-medium text-sm'>System Status</p>
                    <p className='text-xs text-slate-500'>DB • Webhooks • APIs</p>
                  </div>
                  <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
                </div>
              </Link>
            )}

            {/* Home Link */}
            <Link href='/' onClick={() => setOpen(false)}>
              <div className='flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700'>
                <Home className='h-5 w-5 text-slate-500' />
                <div className='flex-1'>
                  <p className='font-medium text-sm'>Home</p>
                  <p className='text-xs text-slate-500'>Back to main site</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AppSidebar;
