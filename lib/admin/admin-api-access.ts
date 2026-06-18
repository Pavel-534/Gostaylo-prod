/**
 * Stage 118.5 — RBAC для `/api/admin/**` и `/api/v2/admin/**` из SSOT меню (`admin-menu.ts`).
 *
 * Stage 153.1 — финансовые рычаги споров (`force_refund`, `split`, `freeze_payment`, `close_dispute`)
 * дополнительно ограничены ролью **ADMIN** в обработчике
 * `POST /api/v2/admin/disputes/[id]/action` (`denyUnlessAdminFinancialRole`).
 * MODERATOR: чтение, `take_in_review`, сбор улик, комментарии — без денежных мутаций.
 */
import {
  ADMIN_MENU_GROUPS,
  type AdminRole,
  normalizeAdminRole,
} from '@/lib/admin/admin-menu'

export type AdminApiAccessRule = {
  prefix: string
  allowedRoles: AdminRole[]
}

/** API-only префиксы без прямого пункта меню (`/api/admin`). */
const ADMIN_API_EXTRA_RULES: AdminApiAccessRule[] = [
  { prefix: '/api/admin/smoke', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/clean-test-data', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/blacklist', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/promo-codes', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/activity', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/metrics', allowedRoles: ['ADMIN', 'MODERATOR'] },
  { prefix: '/api/admin/notification-outbox', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/revalidate', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/fix-enum', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/system-settings', allowedRoles: ['ADMIN'] },
  { prefix: '/api/admin/search', allowedRoles: ['ADMIN', 'MODERATOR'] },
]

/**
 * V2 API prefix → href админ-UI для lookup `allowedRoles`.
 * Длинные префиксы должны быть зарегистрированы явно (longest-prefix match).
 */
const ADMIN_V2_PREFIX_MENU_HREF: Record<string, string> = {
  '/api/v2/admin/stats': '/admin/dashboard',
  '/api/v2/admin/partners': '/admin/partners',
  '/api/v2/admin/bookings': '/admin/bookings',
  '/api/v2/admin/disputes': '/admin/disputes',
  '/api/v2/admin/waitlist': '/admin/waitlist',
  '/api/v2/admin/users/ban': '/admin/users',
  '/api/v2/admin/users': '/admin/users',
  '/api/v2/admin/audit/impersonation': '/admin/users',
  '/api/v2/admin/partner-payout-profiles': '/admin/payout-verification',
  '/api/v2/admin/verification-doc': '/admin/payout-verification',
  '/api/v2/admin/payment-adapters/health': '/admin/finances',
  '/api/v2/admin/ledger-balances': '/admin/financial-health',
  '/api/v2/admin/ledger-reconciliation': '/admin/financial-health',
  '/api/v2/admin/payouts/tbank-registry': '/admin/marketing/referral-payouts',
  '/api/v2/admin/payouts': '/admin/financial-health',
  '/api/v2/admin/payout-methods': '/admin/payout-methods',
  '/api/v2/admin/wallet/payouts/referral-bulk': '/admin/marketing/referral-payouts',
  '/api/v2/admin/wallet/payouts': '/admin/marketing/referral-payouts',
  '/api/v2/admin/wallet/transactions': '/admin/marketing/wallet-audit',
  '/api/v2/admin/referral/analytics': '/admin/marketing/analytics',
  '/api/v2/admin/referral/leaderboard': '/admin/marketing/analytics',
  '/api/v2/admin/referral/pnl-monitor': '/admin/marketing/settings',
  '/api/v2/admin/referral/payout-stats': '/admin/marketing/settings',
  '/api/v2/admin/referral/retry-host-activation': '/admin/marketing/settings',
  '/api/v2/admin/referral': '/admin/marketing',
  '/api/v2/admin/contact-leak-dashboard': '/admin/security',
  '/api/v2/admin/marketplace-health': '/admin/marketplace-health',
  '/api/v2/admin/locations': '/admin/locations/suggestions',
  '/api/v2/admin/health': '/admin/health',
  '/api/v2/admin/exchange-rates-health': '/admin/health',
  '/api/v2/admin/ai-usage': '/admin/ai-usage',
  '/api/v2/admin/categories': '/admin/categories',
  '/api/v2/admin/export': '/admin/audit-export',
  '/api/v2/admin/system/ai': '/admin/system/ai',
  '/api/v2/admin/system': '/admin/system',
  '/api/v2/admin/ical': '/admin/system/ical',
  '/api/v2/admin/telegram': '/admin/system',
  '/api/v2/admin/geo-schema-refresh': '/admin/system',
}

/**
 * @param {string} href — `/admin/...`
 */
export function adminHrefToApiPrefix(href: string): string {
  const clean = String(href || '').replace(/\/+$/, '')
  const suffix = clean.replace(/^\/admin/, '') || ''
  return `/api/admin${suffix}`
}

function normalizeHref(href: string): string {
  return String(href || '').replace(/\/+$/, '')
}

/**
 * @param {string} href
 * @param {typeof ADMIN_MENU_GROUPS} [groups]
 */
export function getAllowedRolesForMenuHref(href: string, groups = ADMIN_MENU_GROUPS): AdminRole[] {
  const target = normalizeHref(href)
  for (const group of groups) {
    for (const item of group.items) {
      const itemHref = normalizeHref(item.href)
      if (itemHref === target || target.startsWith(`${itemHref}/`)) {
        return (item.allowedRoles || ['ADMIN']) as AdminRole[]
      }
    }
  }
  return ['ADMIN']
}

function mergeRoles(into: Map<string, AdminRole[]>, prefix: string, roles: AdminRole[]) {
  const existing = into.get(prefix)
  if (!existing) {
    into.set(prefix, [...roles])
    return
  }
  into.set(prefix, Array.from(new Set<AdminRole>([...existing, ...roles])))
}

/**
 * @param {typeof ADMIN_MENU_GROUPS} [groups]
 */
export function buildAdminApiAccessRules(groups = ADMIN_MENU_GROUPS): AdminApiAccessRule[] {
  const byPrefix = new Map<string, AdminRole[]>()

  for (const group of groups) {
    for (const item of group.items) {
      const roles = (item.allowedRoles || ['ADMIN']) as AdminRole[]
      mergeRoles(byPrefix, adminHrefToApiPrefix(item.href), roles)
    }
  }

  for (const [v2Prefix, menuHref] of Object.entries(ADMIN_V2_PREFIX_MENU_HREF)) {
    mergeRoles(byPrefix, v2Prefix, getAllowedRolesForMenuHref(menuHref, groups))
  }

  for (const extra of ADMIN_API_EXTRA_RULES) {
    mergeRoles(byPrefix, extra.prefix, extra.allowedRoles)
  }

  return Array.from(byPrefix.entries())
    .map(([prefix, allowedRoles]) => ({ prefix, allowedRoles }))
    .sort((a, b) => b.prefix.length - a.prefix.length)
}

/** Кэш правил (стабильный конфиг на рантайме). */
let cachedRules: AdminApiAccessRule[] | null = null

export function getAdminApiAccessRules(): AdminApiAccessRule[] {
  if (!cachedRules) cachedRules = buildAdminApiAccessRules()
  return cachedRules
}

function normalizeApiPath(path: string): string {
  return String(path || '').split('?')[0].replace(/\/+$/, '') || '/'
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function isAdminApiNamespace(path: string): boolean {
  return path.startsWith('/api/admin') || path.startsWith('/api/v2/admin')
}

/**
 * Роли для пути admin API. Неизвестный путь — только ADMIN (fail-closed).
 */
export function getAllowedRolesForAdminApiPath(apiPath: string): AdminRole[] {
  const path = normalizeApiPath(apiPath)
  if (!isAdminApiNamespace(path)) return ['ADMIN']

  if (path.includes('/contact-strikes')) {
    return getAllowedRolesForMenuHref('/admin/security')
  }

  const rules = getAdminApiAccessRules()
  let bestLen = -1
  let roles: AdminRole[] | null = null

  for (const rule of rules) {
    if (pathMatchesPrefix(path, rule.prefix) && rule.prefix.length > bestLen) {
      bestLen = rule.prefix.length
      roles = rule.allowedRoles
    }
  }

  return roles || ['ADMIN']
}

/**
 * @param {string} apiPath
 * @param {string | null | undefined} role
 */
export function isAdminApiPathAllowedForRole(apiPath: string, role: string | null | undefined): boolean {
  const normalized = normalizeAdminRole(role)
  if (!normalized) return false
  const allowed = getAllowedRolesForAdminApiPath(apiPath)
  return allowed.includes(normalized)
}

/** Для отчётов / smoke: число зарегистрированных префиксов. */
export function getAdminApiAccessRuleCount(): number {
  return getAdminApiAccessRules().length
}
