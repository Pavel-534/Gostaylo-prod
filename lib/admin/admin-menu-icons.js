/**
 * Stage 118.3 — Lucide icons for admin menu (client components only).
 */
import {
  LayoutDashboard,
  Shield,
  Wallet,
  Users,
  Landmark,
  Settings,
  Layers,
  TrendingUp,
  ShieldAlert,
  Database,
  UserCog,
  Server,
  MessageSquare,
  FileDown,
  Sparkles,
  Activity,
  Scale,
  BadgeCheck,
  Gavel,
  Ticket,
  Mail,
  Globe2,
} from 'lucide-react'

/** @type {Record<string, import('lucide-react').LucideIcon>} */
export const ADMIN_MENU_ICON_MAP = {
  LayoutDashboard,
  Shield,
  Wallet,
  Users,
  Landmark,
  Settings,
  Layers,
  TrendingUp,
  ShieldAlert,
  Database,
  UserCog,
  Server,
  MessageSquare,
  FileDown,
  Sparkles,
  Activity,
  Scale,
  BadgeCheck,
  Gavel,
  Ticket,
  Mail,
  Globe2,
}

/**
 * @param {string} key
 */
export function resolveAdminMenuIcon(key) {
  return ADMIN_MENU_ICON_MAP[key] || LayoutDashboard
}
