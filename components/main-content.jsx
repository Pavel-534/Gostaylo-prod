/**
 * MainContent — App Shell body insets (ADR-100).
 * Top/bottom padding from --app-header-height / --app-bottom-nav-height (see globals.css).
 */

'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Declarative bypass matrix: routes that own their own shell insets.
 * @type {Array<{ prefix: string, skipTop?: boolean, skipBottom?: boolean, exact?: boolean }>}
 */
const SHELL_INSET_BYPASS = [
  { prefix: '/', exact: true, skipTop: true },
  /** ADR-101 Wave 2 — catalog owns top inset via PublicSearchChrome */
  { prefix: '/listings', exact: true, skipTop: true },
  { prefix: '/messages', skipTop: true, skipBottom: true },
  { prefix: '/admin', skipTop: true, skipBottom: true },
  { prefix: '/partner', skipTop: true, skipBottom: true },
  /** Own AppHeader + pb-bottom-nav in app/renter/layout.js */
  { prefix: '/renter', skipTop: true, skipBottom: true },
];

function matchesRoute(pathname, rule) {
  if (!pathname) return false;
  if (rule.exact) return pathname === rule.prefix;
  return pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
}

function resolveShellInsets(pathname) {
  let skipTop = false;
  let skipBottom = false;
  for (const rule of SHELL_INSET_BYPASS) {
    if (!matchesRoute(pathname, rule)) continue;
    if (rule.skipTop) skipTop = true;
    if (rule.skipBottom) skipBottom = true;
  }
  return { skipTop, skipBottom };
}

export function MainContent({ children }) {
  const pathname = usePathname();
  const { skipTop, skipBottom } = resolveShellInsets(pathname);

  if (skipTop && skipBottom) {
    return <>{children}</>;
  }

  const shellClass = cn(
    !skipTop && !skipBottom && 'app-shell-main',
    skipTop && !skipBottom && 'app-shell-main-bottom-only',
    skipBottom && !skipTop && 'app-shell-main-top-only',
  );

  return <div className={shellClass}>{children}</div>;
}

export default MainContent;
