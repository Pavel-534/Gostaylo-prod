/**
 * Stage 118.5 — SSOT админки: меню, RBAC (UI + API), breadcrumbs, quick actions.
 * Иконки: ключ `icon` → `lib/admin/admin-menu-icons.js` (client-only).
 * API RBAC: `lib/admin/admin-api-access.ts` + `requireAdminStaff(request)` на `/api/admin/*` и `/api/v2/admin/*`.
 */

export const ADMIN_ROLES = ['ADMIN', 'MODERATOR'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export type AdminMenuIconKey =
  | 'LayoutDashboard'
  | 'Shield'
  | 'Wallet'
  | 'Users'
  | 'Landmark'
  | 'Settings'
  | 'Layers'
  | 'TrendingUp'
  | 'ShieldAlert'
  | 'Database'
  | 'UserCog'
  | 'Server'
  | 'MessageSquare'
  | 'FileDown'
  | 'Sparkles'
  | 'Activity'
  | 'Scale'
  | 'BadgeCheck'
  | 'Gavel'
  | 'Ticket'
  | 'Mail'
  | 'Globe2'
  | 'Megaphone'

export type AdminMenuItem = {
  title: string
  href: string
  icon: AdminMenuIconKey
  allowedRoles: AdminRole[]
  emphasize?: boolean
  navExact?: boolean
}

export type AdminMenuGroup = {
  key: string
  title: string
  emphasize?: boolean
  items: AdminMenuItem[]
  quickActions?: AdminQuickActionDef[]
}

export type AdminQuickActionKind =
  | 'link'
  | 'smoke-financial'
  | 'prepare-pause'
  | 'router-refresh'
  | 'scroll-top'

export type AdminQuickActionDef = {
  id: string
  label: string
  kind: AdminQuickActionKind
  href?: string
  variant?: 'default' | 'outline' | 'brand' | 'secondary'
  /** Если не задано — только ADMIN (smoke, pause). */
  allowedRoles?: AdminRole[]
}

export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    quickActions: [
      { id: 'dash-fintech', label: 'FinTech-пульт', kind: 'link', href: '/admin/settings/finances', variant: 'brand', allowedRoles: ['ADMIN'] },
      { id: 'dash-moderation', label: 'Модерация', kind: 'link', href: '/admin/moderation', variant: 'outline' },
    ],
    items: [
      {
        title: 'Главная панель',
        href: '/admin/dashboard',
        icon: 'LayoutDashboard',
        allowedRoles: ['ADMIN', 'MODERATOR'],
      },
    ],
  },
  {
    key: 'ops',
    title: 'Операции',
    quickActions: [
      { id: 'ops-moderation', label: 'Очередь модерации', kind: 'link', href: '/admin/moderation', variant: 'brand' },
      { id: 'ops-messages', label: 'Сообщения', kind: 'link', href: '/admin/messages/', variant: 'outline' },
      { id: 'ops-disputes', label: 'Споры', kind: 'link', href: '/admin/disputes', variant: 'outline' },
    ],
    items: [
      {
        title: 'Модерация объявлений',
        href: '/admin/moderation',
        icon: 'Shield',
        allowedRoles: ['ADMIN', 'MODERATOR'],
      },
      {
        title: 'Заявки на партнёрство',
        href: '/admin/partners',
        icon: 'UserCog',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Брони по ID',
        href: '/admin/bookings',
        icon: 'Ticket',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Сообщения',
        href: '/admin/messages/',
        icon: 'MessageSquare',
        allowedRoles: ['ADMIN', 'MODERATOR'],
      },
      {
        title: 'Споры',
        href: '/admin/disputes',
        icon: 'Gavel',
        allowedRoles: ['ADMIN', 'MODERATOR'],
      },
      {
        title: 'Marketplace Health',
        href: '/admin/marketplace-health',
        icon: 'Globe2',
        allowedRoles: ['ADMIN', 'MODERATOR'],
      },
    ],
  },
  {
    key: 'users',
    title: 'Пользователи',
    quickActions: [
      { id: 'users-refresh', label: 'Обновить список', kind: 'router-refresh', variant: 'outline' },
      { id: 'users-payout-verify', label: 'Верификация реквизитов', kind: 'link', href: '/admin/payout-verification', variant: 'outline', allowedRoles: ['ADMIN'] },
    ],
    items: [
      {
        title: 'Все пользователи',
        href: '/admin/users',
        icon: 'Users',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Waitlist',
        href: '/admin/waitlist',
        icon: 'Mail',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Верификация реквизитов',
        href: '/admin/payout-verification',
        icon: 'BadgeCheck',
        allowedRoles: ['ADMIN'],
      },
    ],
  },
  {
    key: 'fin',
    title: 'Финансы',
    emphasize: true,
    quickActions: [
      { id: 'fin-console', label: 'FinTech-пульт', kind: 'link', href: '/admin/settings/finances', variant: 'brand', allowedRoles: ['ADMIN'] },
      { id: 'fin-smoke', label: 'Запустить smoke', kind: 'smoke-financial', variant: 'outline', allowedRoles: ['ADMIN'] },
      { id: 'fin-pause', label: 'Подготовить к паузе', kind: 'prepare-pause', variant: 'outline', allowedRoles: ['ADMIN'] },
    ],
    items: [
      {
        title: 'FinTech-пульт',
        href: '/admin/settings/finances',
        icon: 'Landmark',
        allowedRoles: ['ADMIN'],
        emphasize: true,
      },
      {
        title: 'Платежи',
        href: '/admin/finances',
        icon: 'Wallet',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Ledger / Финансовое здоровье',
        href: '/admin/financial-health',
        icon: 'Scale',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Способы выплат',
        href: '/admin/payout-methods',
        icon: 'Landmark',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Реф. бюджет',
        href: '/admin/marketing/budget',
        icon: 'Wallet',
        allowedRoles: ['ADMIN'],
      },
    ],
  },
  {
    key: 'growth',
    title: 'Маркетинг & Промо',
    quickActions: [],
    items: [
      {
        title: 'Обзор',
        href: '/admin/marketing',
        icon: 'LayoutDashboard',
        allowedRoles: ['ADMIN'],
        navExact: true,
      },
      {
        title: 'Кампании',
        href: '/admin/marketing/campaigns',
        icon: 'Megaphone',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Аналитика',
        href: '/admin/marketing/attribution',
        icon: 'Activity',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Правила и настройки',
        href: '/admin/marketing/rules',
        icon: 'Sparkles',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Фрод-очередь',
        href: '/admin/marketing/fraud-queue',
        icon: 'ShieldAlert',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Бюджет и аудит',
        href: '/admin/marketing/budget',
        icon: 'Wallet',
        allowedRoles: ['ADMIN'],
      },
    ],
  },
  {
    key: 'control',
    title: 'Контроль & Безопасность',
    quickActions: [
      { id: 'ctrl-security', label: 'Безопасность контактов', kind: 'link', href: '/admin/security', variant: 'outline', allowedRoles: ['ADMIN'] },
      { id: 'ctrl-health', label: 'System Health', kind: 'link', href: '/admin/health', variant: 'outline', allowedRoles: ['ADMIN'] },
    ],
    items: [
      {
        title: 'Безопасность контактов',
        href: '/admin/security',
        icon: 'ShieldAlert',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'System Health',
        href: '/admin/health',
        icon: 'Activity',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Расходы AI',
        href: '/admin/ai-usage',
        icon: 'Sparkles',
        allowedRoles: ['ADMIN'],
      },
    ],
  },
  {
    key: 'settings',
    title: 'Настройки',
    quickActions: [
      { id: 'set-global', label: 'Глобальные настройки', kind: 'link', href: '/admin/settings', variant: 'outline', allowedRoles: ['ADMIN'] },
      { id: 'set-export', label: 'Выгрузки', kind: 'link', href: '/admin/audit-export', variant: 'outline', allowedRoles: ['ADMIN'] },
      { id: 'set-system', label: 'Advanced: System', kind: 'link', href: '/admin/system', variant: 'outline', allowedRoles: ['ADMIN'] },
    ],
    items: [
      {
        title: 'Глобальные настройки',
        href: '/admin/settings',
        icon: 'Settings',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Категории',
        href: '/admin/categories',
        icon: 'Layers',
        allowedRoles: ['ADMIN', 'MODERATOR'],
      },
      {
        title: 'Выгрузки / Отчёты',
        href: '/admin/audit-export',
        icon: 'FileDown',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Advanced: System',
        href: '/admin/system',
        icon: 'Server',
        allowedRoles: ['ADMIN'],
      },
      {
        title: 'Advanced: Test DB',
        href: '/admin/test-db',
        icon: 'Database',
        allowedRoles: ['ADMIN'],
      },
    ],
  },
]

/**
 * @param {string | null | undefined} role
 * @returns {AdminRole | null}
 */
export function normalizeAdminRole(role) {
  const r = String(role || '').toUpperCase()
  if (r === 'ADMIN' || r === 'MODERATOR') return r
  return null
}

/**
 * @param {AdminMenuItem} item
 * @param {AdminRole | null} role
 */
export function adminMenuItemAllowed(item, role) {
  if (!role) return false
  return (item.allowedRoles || []).includes(role)
}

/**
 * @param {AdminRole | null} role
 */
export function filterAdminMenuGroupsForRole(role) {
  return ADMIN_MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => adminMenuItemAllowed(item, role)),
  })).filter((group) => group.items.length > 0)
}

/**
 * Префиксы маршрутов, недоступные роли (для redirect-guard в layout).
 * @param {AdminRole} role
 */
export function getAdminRestrictedPrefixesForRole(role) {
  if (role === 'ADMIN') return []
  const allowedPrefixes: string[] = []
  for (const group of ADMIN_MENU_GROUPS) {
    for (const item of group.items) {
      if (adminMenuItemAllowed(item, role)) {
        allowedPrefixes.push(String(item.href).replace(/\/+$/, ''))
      }
    }
  }
  const allPrefixes = new Set<string>()
  for (const group of ADMIN_MENU_GROUPS) {
    for (const item of group.items) {
      allPrefixes.add(String(item.href).replace(/\/+$/, ''))
    }
  }
  const restricted: string[] = []
  for (const prefix of Array.from(allPrefixes)) {
    const ok = allowedPrefixes.some((a) => prefix === a || prefix.startsWith(`${a}/`))
    if (!ok) restricted.push(prefix)
  }
  return Array.from(new Set(restricted)).sort((a, b) => b.length - a.length)
}

export function isAdminNavHrefActive(
  pathname: string,
  href: string,
  options: { exact?: boolean } = {},
) {
  const clean = String(href || '').replace(/\/+$/, '')
  const p = String(pathname || '').replace(/\/+$/, '')
  const exact = options.exact === true
  if (!clean) return false
  if (p === clean) return true
  if (exact) return false
  if (clean === '/admin/dashboard') return false
  return p.startsWith(`${clean}/`)
}

/**
 * @param {string} pathname
 * @param {AdminMenuGroup[]} [groups]
 * @returns {{ groupKey: string, group: string, page: string } | null}
 */
export function resolveAdminBreadcrumb(pathname, groups = ADMIN_MENU_GROUPS) {
  const p = String(pathname || '')
  /** Longest-prefix match — корректно для /admin/marketing/* vs /admin/marketing. */
  let best = null
  let bestLen = -1
  for (const g of groups) {
    for (const it of g.items) {
      if (isAdminNavHrefActive(p, it.href, { exact: it.navExact === true })) {
        const len = String(it.href || '').length
        if (len > bestLen) {
          bestLen = len
          best = { groupKey: g.key, group: g.title, page: it.title }
        }
      }
    }
  }
  if (best) return best
  if (p.startsWith('/admin/messages')) {
    return { groupKey: 'ops', group: 'Операции', page: 'Сообщения' }
  }
  if (p.startsWith('/admin/settings/legal')) {
    return { groupKey: 'settings', group: 'Настройки', page: 'Юридические документы' }
  }
  if (p.startsWith('/admin/marketing/promos')) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'Промокоды' }
  }
  if (p.startsWith('/admin/marketing/rules') || p.startsWith('/admin/marketing/reward-rules')) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'Правила и настройки' }
  }
  if (p.startsWith('/admin/marketing/settings') && !p.includes('/admin/marketing/settings/')) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'Глобальные настройки' }
  }
  if (p.startsWith('/admin/marketing/budget')) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'Бюджет и аудит' }
  }
  if (p.startsWith('/admin/marketing/analytics')) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'ROI & когорты' }
  }
  if (p.startsWith('/admin/marketing/payouts')) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'Referral Payouts' }
  }
  if (p.startsWith('/admin/marketing/wallet-audit')) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'Wallet Audit' }
  }
  if (p.startsWith('/admin/marketing/audit')) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'Promo Tank Audit' }
  }
  if (p.match(/^\/admin\/marketing\/campaigns\/[^/]+/)) {
    return { groupKey: 'growth', group: 'Маркетинг & Промо', page: 'Кампания' }
  }
  return null
}

/**
 * @param {string | null | undefined} groupKey
 * @param {AdminRole | null} role
 */
export function resolveAdminQuickActions(groupKey: string | null | undefined, role: AdminRole | null) {
  if (!groupKey || !role) return []
  const group = ADMIN_MENU_GROUPS.find((g) => g.key === groupKey)
  const defs = group?.quickActions || []
  return defs.filter((action) => {
    if (action.allowedRoles?.length) {
      return action.allowedRoles.includes(role)
    }
    if (role === 'ADMIN') return true
    return action.kind === 'link' || action.kind === 'router-refresh'
  })
}
