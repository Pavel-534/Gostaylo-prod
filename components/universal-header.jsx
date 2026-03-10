/**
 * Gostaylo - Universal Navigation Header (World-Class UX)
 * 
 * Structure:
 * - Left: Logo only
 * - Right: Language, Currency, Avatar/Login
 * 
 * Clean & minimal design following Airbnb/Booking standards
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  User, LogOut, ChevronDown, Heart, CalendarDays,
  Briefcase, Settings, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CurrencySelector } from '@/components/currency-selector';
import { useAuth } from '@/contexts/auth-context';

// Supported languages
const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
];

export function UniversalHeader() {
  const [mounted, setMounted] = useState(false);
  const [currency, setCurrency] = useState('THB');
  const [language, setLanguage] = useState('ru');
  const pathname = usePathname();
  const router = useRouter();
  
  const { user, logout, openLoginModal, isAdmin, isPartner } = useAuth();

  useEffect(() => {
    setMounted(true);
    const savedCurrency = localStorage.getItem('gostaylo_currency');
    if (savedCurrency) setCurrency(savedCurrency);
    const savedLang = localStorage.getItem('gostaylo_language');
    if (savedLang) setLanguage(savedLang);
  }, [pathname]);

  function handleLanguageChange(langCode) {
    setLanguage(langCode);
    localStorage.setItem('gostaylo_language', langCode);
    window.dispatchEvent(new CustomEvent('languageChange', { detail: langCode }));
  }

  if (!mounted) return null;

  const isOnAdminPage = pathname?.startsWith('/admin');
  const isOnPartnerPage = pathname?.startsWith('/partner');

  // Don't render on admin pages (Admin has its own header)
  if (isOnAdminPage) return null;

  // Don't render on partner pages (Partner has its own sidebar layout)
  if (isOnPartnerPage) return null;

  return (
    <header className='fixed top-0 left-0 right-0 z-[100] bg-white border-b border-slate-200'>
      <div className='container mx-auto px-3 sm:px-4'>
        <div className='flex items-center justify-between h-14'>
          {/* Left - Logo */}
          <Link href='/' className='flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0'>
            <div className='w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm'>
              <span className='text-white font-bold text-sm sm:text-base'>G</span>
            </div>
            <span className='font-bold text-lg sm:text-xl text-slate-800 tracking-tight'>Gostaylo</span>
          </Link>

          {/* Right - Controls */}
          <div className='flex items-center gap-1 sm:gap-2'>
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='sm' className='h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full hover:bg-slate-100'>
                  <span className='text-base sm:text-lg'>{LANGUAGES.find(l => l.code === language)?.flag || '🌐'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='min-w-[140px]'>
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem 
                    key={lang.code} 
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`cursor-pointer ${language === lang.code ? 'bg-teal-50 text-teal-700' : ''}`}
                  >
                    <span className='text-base mr-2'>{lang.flag}</span>
                    <span className='text-sm'>{lang.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Currency Selector */}
            <CurrencySelector value={currency} onChange={setCurrency} />

            {/* User Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='ghost' size='sm' className='flex items-center gap-1 sm:gap-2 h-8 sm:h-9 px-1.5 sm:px-2 rounded-full hover:bg-slate-100 border border-slate-200'>
                    <Avatar className='h-6 w-6 sm:h-7 sm:w-7'>
                      <AvatarFallback className={`text-xs font-semibold text-white ${
                        isAdmin ? 'bg-indigo-600' : isPartner ? 'bg-teal-600' : 'bg-slate-500'
                      }`}>
                        {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className='h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-500' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-60'>
                  {/* User Info Header */}
                  <div className='px-3 py-2.5 border-b border-slate-100'>
                    <p className='font-semibold text-slate-900 truncate'>{user.name || 'Пользователь'}</p>
                    <p className='text-xs text-slate-500 truncate'>{user.email}</p>
                  </div>
                  
                  {/* Main Navigation */}
                  <div className='py-1'>
                    <DropdownMenuItem asChild className='cursor-pointer py-2.5'>
                      <Link href='/profile'>
                        <User className='h-4 w-4 mr-3 text-slate-400' />
                        <span>Профиль</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className='cursor-pointer py-2.5'>
                      <Link href='/my-bookings'>
                        <CalendarDays className='h-4 w-4 mr-3 text-slate-400' />
                        <span>Мои бронирования</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className='cursor-pointer py-2.5'>
                      <Link href='/favorites'>
                        <Heart className='h-4 w-4 mr-3 text-slate-400' />
                        <span>Избранное</span>
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  
                  {/* Partner Section */}
                  {(isAdmin || isPartner) && (
                    <>
                      <DropdownMenuSeparator />
                      <div className='py-1'>
                        <DropdownMenuItem asChild className='cursor-pointer py-2.5'>
                          <Link href='/partner/dashboard'>
                            <Briefcase className='h-4 w-4 mr-3 text-teal-600' />
                            <span className='text-teal-700 font-medium'>Панель партнёра</span>
                          </Link>
                        </DropdownMenuItem>
                      </div>
                    </>
                  )}
                  
                  {/* Admin Section */}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <div className='py-1'>
                        <DropdownMenuItem asChild className='cursor-pointer py-2.5'>
                          <Link href='/admin'>
                            <Shield className='h-4 w-4 mr-3 text-indigo-600' />
                            <span className='text-indigo-700 font-medium'>Админ-панель</span>
                          </Link>
                        </DropdownMenuItem>
                      </div>
                    </>
                  )}
                  
                  {/* Logout */}
                  <DropdownMenuSeparator />
                  <div className='py-1'>
                    <DropdownMenuItem 
                      onClick={logout} 
                      className='cursor-pointer py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50'
                    >
                      <LogOut className='h-4 w-4 mr-3' />
                      <span>Выйти</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                size='sm' 
                className='bg-teal-600 hover:bg-teal-700 h-9 px-4 rounded-full font-medium'
                onClick={openLoginModal}
              >
                Войти
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default UniversalHeader;
