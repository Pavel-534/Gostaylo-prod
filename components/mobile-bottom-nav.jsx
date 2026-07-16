/**
 * Mobile Bottom Navigation Bar (ADR-100 / Stage 189.3).
 *
 * Fixed bottom nav for mobile (< md). ResizeObserver → --app-bottom-nav-height on <html>
 * (height already includes safe-area padding on the nav itself — do not add inset again in shell).
 * Hidden while soft keyboard is open (visualViewport).
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, MessageCircle, User } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useChatUnreadBadge } from '@/lib/context/ChatUnreadBadgeContext';
import { useI18n } from '@/contexts/i18n-context';
import { getUIText } from '@/lib/translations';
import {
  dispatchMobileSearchTabAction,
  isMobileSearchTabInterceptPath,
} from '@/lib/search/mobile-search-tab-action';

const NAV_ITEMS = [
  {
    href: '/',
    icon: Home,
    labelKey: 'mobileNavHome',
    activeExact: true,
  },
  {
    href: '/listings',
    icon: Search,
    labelKey: 'mobileNavSearch',
    activeMatches: ['/listings', '/search'],
    interceptSearchTab: true,
  },
  {
    href: '/messages',
    icon: MessageCircle,
    labelKey: 'mobileNavMessages',
    activeMatches: ['/messages'],
    requiresAuth: true,
  },
  {
    href: '/renter/profile',
    icon: User,
    labelKey: 'mobileNavProfile',
    activeMatches: [
      '/renter/profile',
      '/my-bookings',
      '/renter/bookings',
      '/renter/favorites',
      '/profile',
      '/settings',
    ],
    requiresAuth: true,
  },
];

/** Soft keyboard typically shrinks visualViewport vs layout viewport. */
const KEYBOARD_VIEWPORT_SHRINK_PX = 120;

function shouldRenderBottomNav(pathname) {
  if (!pathname) return false;
  if (pathname.startsWith('/partner') || pathname.startsWith('/admin')) return false;
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/messages') return false;
  if (/^\/messages\/.+/.test(normalized)) return false;
  /** PDP — booking CTA bar owns the bottom chrome (Stage 170.3) */
  if (/^\/listings\/[^/]+$/.test(normalized)) return false;
  return true;
}

export function MobileBottomNav() {
  const [mounted, setMounted] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const navRef = useRef(null);
  const pathname = usePathname();
  const { user, openLoginModal } = useAuth();
  const { totalUnread } = useChatUnreadBadge();
  const { language } = useI18n();

  const routeAllowsNav = useMemo(
    () => mounted && shouldRenderBottomNav(pathname),
    [mounted, pathname],
  );

  const navVisible = routeAllowsNav && !keyboardOpen;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncKeyboard = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setKeyboardOpen(false);
        return;
      }
      const shrink = window.innerHeight - vv.height;
      setKeyboardOpen(shrink > KEYBOARD_VIEWPORT_SHRINK_PX);
    };

    syncKeyboard();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncKeyboard);
    vv?.addEventListener('scroll', syncKeyboard);
    window.addEventListener('focusin', syncKeyboard);
    window.addEventListener('focusout', syncKeyboard);

    return () => {
      vv?.removeEventListener('resize', syncKeyboard);
      vv?.removeEventListener('scroll', syncKeyboard);
      window.removeEventListener('focusin', syncKeyboard);
      window.removeEventListener('focusout', syncKeyboard);
    };
  }, []);

  // ADR-100: --app-bottom-nav-height includes safe-area (measured from nav with .safe-area-pb)
  useEffect(() => {
    const root = document.documentElement;
    if (!navVisible || !navRef.current) {
      root.style.setProperty('--app-bottom-nav-height', '0px');
      return undefined;
    }
    const el = navRef.current;
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty('--app-bottom-nav-height', `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--app-bottom-nav-height', '0px');
    };
  }, [navVisible, pathname]);

  if (!navVisible) return null;

  const handleNavClick = (item, e) => {
    if (item.requiresAuth && !user) {
      e.preventDefault();
      openLoginModal?.('login');
      return;
    }

    if (item.interceptSearchTab && isMobileSearchTabInterceptPath(pathname)) {
      e.preventDefault();
      dispatchMobileSearchTabAction({ source: 'bottom-nav' });
    }
  };

  const isActive = (item) => {
    if (!pathname) return false;

    if (item.activeExact) {
      return pathname === item.href;
    }

    if (item.activeMatches) {
      return item.activeMatches.some(
        (match) => pathname === match || pathname.startsWith(`${match}/`),
      );
    }

    return pathname.startsWith(item.href);
  };

  return (
    <nav
      ref={navRef}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 rounded-t-2xl shadow-[0_-4px_12px_rgba(0,102,102,0.04)] safe-area-pb"
      aria-label="Mobile navigation"
    >
      <div className="flex h-16 items-center justify-around px-2 min-[375px]:h-20 min-[375px]:px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          const href = item.requiresAuth && !user ? '#' : item.href;

          const showBadge = item.href === '/messages' && totalUnread > 0;
          const badgeLabel = totalUnread > 99 ? '99+' : String(totalUnread);

          return (
            <Link
              key={item.href}
              href={href}
              onClick={(e) => handleNavClick(item, e)}
              data-testid={item.interceptSearchTab ? 'mobile-nav-search' : undefined}
              className={`flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
                active
                  ? 'text-brand bg-brand/10 shadow-[inset_0_0_0_1px_rgba(0,102,102,0.12)]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="relative inline-flex">
                <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                {showBadge && (
                  <span
                    className="absolute -top-2 -right-2 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-1 ring-white"
                    aria-label={`Непрочитанных: ${totalUnread}`}
                  >
                    {badgeLabel}
                  </span>
                )}
              </span>
              <span className={`mt-1 text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {getUIText(item.labelKey, language)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
