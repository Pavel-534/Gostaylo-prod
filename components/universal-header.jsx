/**
 * FunnyRent 2.1 - Universal Navigation Header
 * Shows on ALL pages with:
 * - Burger menu (sidebar trigger)
 * - Home icon (always visible)
 * - Language selector
 * - Currency selector
 * - Admin Dashboard button (for ADMIN role only)
 * - Current user info
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, Shield, Settings, Store, User, LogOut, 
  ChevronDown, Plus, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppSidebar } from '@/components/app-sidebar';
import { CurrencySelector } from '@/components/currency-selector';

// Supported languages
const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export function UniversalHeader() {
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('THB');
  const [language, setLanguage] = useState('ru');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    loadUser();
    
    // Load currency preference
    const savedCurrency = localStorage.getItem('funnyrent_currency');
    if (savedCurrency) setCurrency(savedCurrency);
    
    // Load language preference
    const savedLang = localStorage.getItem('funnyrent_language');
    if (savedLang) setLanguage(savedLang);
    
    // Listen for auth changes
    const handleStorage = () => loadUser();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [pathname]);

  function loadUser() {
    const storedUser = localStorage.getItem('funnyrent_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem('funnyrent_user');
    localStorage.removeItem('funnyrent_auth_token');
    setUser(null);
    router.push('/');
  }

  function handleLanguageChange(langCode) {
    setLanguage(langCode);
    localStorage.setItem('funnyrent_language', langCode);
    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('languageChange', { detail: langCode }));
  }

  // Don't render on server
  if (!mounted) return null;

  const isAdmin = user?.role === 'ADMIN';
  const isPartner = user?.role === 'PARTNER';
  const isOnAdminPage = pathname?.startsWith('/admin');
  const isOnPartnerPage = pathname?.startsWith('/partner');
  const isOnDashboard = pathname?.startsWith('/dashboard');
  const isHomePage = pathname === '/';

  // Don't render on admin pages - Admin Layout has its own navigation
  if (isOnAdminPage) return null;

  // On partner pages with desktop sidebar, hide burger menu (only on lg screens)
  const showBurgerMenu = !isOnPartnerPage;

  return (
    <div className='fixed top-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm'>
      <div className='container mx-auto px-4'>
        <div className='flex items-center justify-between h-12'>
          {/* Left - Burger Menu + Home */}
          <div className='flex items-center gap-2'>
            {/* Burger Menu - always on mobile, hidden on desktop for partner pages */}
            <div className={isOnPartnerPage ? 'lg:hidden' : ''}>
              <AppSidebar />
            </div>
            
            {/* Home Icon */}
            <Link href='/' className='flex items-center gap-2 hover:opacity-80 transition-opacity'>
              <div className='w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center'>
                <Home className='h-4 w-4 text-white' />
              </div>
              <span className='font-bold text-slate-800 hidden sm:inline'>FunnyRent</span>
            </Link>
          </div>

          {/* Center - Quick Nav (for logged users) */}
          {user && (
            <div className='hidden md:flex items-center gap-1'>
              {/* Admin always sees Admin Dashboard */}
              {isAdmin && (
                <Link href='/admin'>
                  <Button 
                    variant={isOnAdminPage ? 'default' : 'ghost'} 
                    size='sm' 
                    className={isOnAdminPage ? 'bg-indigo-600 hover:bg-indigo-700' : 'text-indigo-600 hover:bg-indigo-50'}
                  >
                    <Shield className='h-4 w-4 mr-1' />
                    Admin
                  </Button>
                </Link>
              )}
              
              {/* Partner Dashboard */}
              {(isAdmin || isPartner) && (
                <Link href='/partner/dashboard'>
                  <Button 
                    variant={isOnPartnerPage ? 'default' : 'ghost'} 
                    size='sm'
                    className={isOnPartnerPage ? 'bg-teal-600 hover:bg-teal-700' : 'text-teal-600 hover:bg-teal-50'}
                  >
                    <Store className='h-4 w-4 mr-1' />
                    Partner
                  </Button>
                </Link>
              )}
              
              {/* Renter Dashboard */}
              <Link href='/dashboard/renter'>
                <Button 
                  variant={isOnDashboard && pathname.includes('renter') ? 'default' : 'ghost'} 
                  size='sm'
                  className={isOnDashboard && pathname.includes('renter') ? 'bg-slate-600 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'}
                >
                  <User className='h-4 w-4 mr-1' />
                  My Bookings
                </Button>
              </Link>
            </div>
          )}

          {/* Right - Currency + User Menu */}
          <div className='flex items-center gap-1.5 sm:gap-2'>
            {/* List Property CTA - Desktop only, for partners/admins */}
            {(isAdmin || isPartner) && !isHomePage && (
              <Button 
                asChild 
                size='sm' 
                className='hidden sm:flex bg-teal-600 hover:bg-teal-700 h-8 px-3 text-xs font-medium'
              >
                <Link href='/partner/listings/new'>
                  <Plus className='h-3.5 w-3.5 mr-1' />
                  Add Listing
                </Link>
              </Button>
            )}

            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className='h-8 w-8 p-0 border-slate-200'>
                  <span className='text-base'>{LANGUAGES.find(l => l.code === language)?.flag || '🌐'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='min-w-[140px]'>
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem 
                    key={lang.code} 
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`cursor-pointer ${language === lang.code ? 'bg-teal-50' : ''}`}
                  >
                    <span className='text-base mr-2'>{lang.flag}</span>
                    <span className='text-sm'>{lang.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Currency Selector */}
            <CurrencySelector 
              value={currency} 
              onChange={setCurrency}
            />

            {/* User Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='ghost' size='sm' className='flex items-center gap-2'>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      isAdmin ? 'bg-indigo-600' : isPartner ? 'bg-teal-600' : 'bg-slate-600'
                    }`}>
                      {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className='hidden sm:inline text-sm text-slate-700 max-w-[100px] truncate'>
                      {user.name || user.email?.split('@')[0]}
                    </span>
                    <ChevronDown className='h-3 w-3 text-slate-400' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-56'>
                  <div className='px-2 py-1.5'>
                    <p className='text-sm font-medium'>{user.name || 'User'}</p>
                    <p className='text-xs text-slate-500'>{user.email}</p>
                    <p className='text-xs text-slate-400 mt-1'>
                      Role: <span className={`font-medium ${isAdmin ? 'text-indigo-600' : isPartner ? 'text-teal-600' : 'text-slate-600'}`}>
                        {user.role || 'RENTER'}
                      </span>
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  
                  {/* Admin Quick Links */}
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href='/admin' className='cursor-pointer'>
                          <Shield className='h-4 w-4 mr-2 text-indigo-600' />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href='/admin/users' className='cursor-pointer'>
                          <User className='h-4 w-4 mr-2' />
                          Manage Users
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {/* Partner Quick Links */}
                  {(isAdmin || isPartner) && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href='/partner/dashboard' className='cursor-pointer'>
                          <Store className='h-4 w-4 mr-2 text-teal-600' />
                          Partner Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href='/partner/listings' className='cursor-pointer'>
                          <Home className='h-4 w-4 mr-2' />
                          My Listings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {/* Renter Links */}
                  <DropdownMenuItem asChild>
                    <Link href='/dashboard/renter' className='cursor-pointer'>
                      <User className='h-4 w-4 mr-2' />
                      My Bookings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href='/profile' className='cursor-pointer'>
                      <Settings className='h-4 w-4 mr-2' />
                      Profile Settings
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className='text-red-600 cursor-pointer'>
                    <LogOut className='h-4 w-4 mr-2' />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href='/?login=true'>
                <Button size='sm' className='bg-teal-600 hover:bg-teal-700'>
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UniversalHeader;
