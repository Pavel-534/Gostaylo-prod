'use client'

import { AdminFinTechConsole } from '@/components/admin/finances/AdminFinTechConsole'

/** FinTech control panel — ADMIN only (layout restricts moderators from /admin/settings). */
export default function AdminFinTechSettingsPage() {
  return <AdminFinTechConsole />
}
