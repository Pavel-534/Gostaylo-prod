/**
 * Gostaylo - Mobile Bottom Navigation Bar
 * 
 * Fixed bottom nav for mobile devices with icons:
 * Home, Search, Messages, Profile
 * 
 * Only visible on mobile (< 768px) and on main site pages
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, MessageCircle, User } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

const NAV_ITEMS = [
  { 
    href: '/', 
    icon: Home, 
    label: 'Главная',
    activeExact: true 
  },
  { 
    href: '/listings', 
    icon: Search, 
    label: 'Поиск',
    activeExact: false 
  },
  { 
    href: '/renter/messages', 
    icon: MessageCircle, 
    label: 'Сообщения',
    activeExact: false,
    requiresAuth: true
  },
  { 
    href: '/profile', 
    icon: User, 
    label: 'Профиль',
    activeExact: false,
    requiresAuth: true,
    fallbackHref: '/?login=true'
  },
];

export function MobileBottomNav() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { user, openLoginModal } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Don't show on partner or admin pages
  const isOnPartnerPage = pathname?.startsWith('/partner');
  const isOnAdminPage = pathname?.startsWith('/admin');
  
  if (isOnPartnerPage || isOnAdminPage) return null;

  const handleNavClick = (item, e) => {
    if (item.requiresAuth && !user) {
      e.preventDefault();
      openLoginModal('login');
    }
  };

  const isActive = (item) => {
    if (item.activeExact) {
      return pathname === item.href;
    }
    return pathname?.startsWith(item.href);
  };

  return (
    <nav className='md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-200 safe-area-pb'>
      <div className='flex items-center justify-around h-16 px-2'>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          const href = item.requiresAuth && !user ? '#' : item.href;
          
          return (
            <Link
              key={item.href}
              href={href}
              onClick={(e) => handleNavClick(item, e)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active 
                  ? 'text-teal-600' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className={`text-[10px] mt-1 ${active ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
