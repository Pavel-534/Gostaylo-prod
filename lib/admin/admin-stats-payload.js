/**
 * Aggregated admin metrics (service_role only).
 * Shared by GET /api/v2/admin/stats and GET /api/admin/metrics/overview.
 */

import {
  ADMIN_STATS_ACTIVE_PIPELINE_STATUSES,
  ADMIN_STATS_REVENUE_BOOKING_STATUSES,
} from '@/lib/booking/status-sets.js'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @returns {Promise<object>}
 */
export async function buildAdminStatsPayload(admin) {
  const { data: profiles } = await admin.from('profiles').select('role')

  const userCounts = {
    total: profiles?.length || 0,
    partners: profiles?.filter((p) => p.role === 'PARTNER').length || 0,
    renters: profiles?.filter((p) => p.role === 'RENTER').length || 0,
    admins: profiles?.filter((p) => p.role === 'ADMIN').length || 0,
    moderators: profiles?.filter((p) => p.role === 'MODERATOR').length || 0,
  }

  const { data: listings } = await admin.from('listings').select('id, status, category_id, base_price_thb')

  const listingCounts = {
    total: listings?.length || 0,
    active: listings?.filter((l) => l.status === 'ACTIVE').length || 0,
    pending: listings?.filter((l) => l.status === 'PENDING').length || 0,
  }

  /** @type {Record<string, number>} */
  const listingCountByCategoryId = {}
  for (const l of listings || []) {
    const k = String(l.category_id ?? '')
    listingCountByCategoryId[k] = (listingCountByCategoryId[k] || 0) + 1
  }

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, status, price_thb, commission_thb, created_at, listing_id')

  const bookingStats = {
    total: bookings?.length || 0,
    pending: bookings?.filter((b) => b.status === 'PENDING').length || 0,
    confirmed: bookings?.filter((b) => b.status === 'CONFIRMED').length || 0,
    paid: bookings?.filter((b) => b.status === 'PAID').length || 0,
    completed: bookings?.filter((b) => b.status === 'COMPLETED').length || 0,
    /** P0 dashboard «активные» брони (без финального COMPLETED). */
    activePipeline:
      (bookings?.filter((b) => ADMIN_STATS_ACTIVE_PIPELINE_STATUSES.has(b.status)).length || 0),
  }

  const completedBookings =
    bookings?.filter((b) => ADMIN_STATS_REVENUE_BOOKING_STATUSES.has(b.status)) || []
  const totalRevenue = completedBookings.reduce((sum, b) => sum + parseFloat(b.price_thb || 0), 0)
  const totalCommission = completedBookings.reduce(
    (sum, b) => sum + parseFloat(b.commission_thb || 0),
    0,
  )

  const monthlyRevenue = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthStr = month.toISOString().slice(0, 7)
    const monthName = month.toLocaleDateString('ru-RU', { month: 'short' })

    const monthBookings = completedBookings.filter((b) => b.created_at?.startsWith(monthStr))

    monthlyRevenue.push({
      month: monthName,
      revenue: monthBookings.reduce((sum, b) => sum + parseFloat(b.price_thb || 0), 0),
    })
  }

  const { data: categories } = await admin.from('categories').select('id, name')

  const categoryRevenue =
    categories?.map((cat) => {
      const catListings = listings?.filter((l) => l.category_id === cat.id).map((l) => l.id) || []
      const catBookings = bookings?.filter((b) => catListings.includes(b.listing_id)) || []
      const revenue = catBookings.reduce((sum, b) => sum + parseFloat(b.price_thb || 0), 0)

      return {
        id: cat.id,
        name: cat.name,
        revenue,
        percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
      }
    }) || []

  const { data: settings } = await admin.from('system_settings').select('value').eq('key', 'general').single()

  return {
    users: userCounts,
    listings: listingCounts,
    bookings: bookingStats,
    revenue: {
      total: totalRevenue,
      commission: totalCommission,
      partnerEarnings: totalRevenue - totalCommission,
    },
    monthlyRevenue,
    categoryRevenue,
    listingCountByCategoryId,
    settings: settings?.value || {},
  }
}

/**
 * Exact row counts per table (service_role). For admin diagnostics only.
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 */
export async function buildAdminTableCounts(admin) {
  const tables = [
    'profiles',
    'categories',
    'listings',
    'bookings',
    'promo_codes',
    'exchange_rates',
    'system_settings',
  ]
  /** @type {Record<string, number | 'error'>} */
  const counts = {}

  for (const table of tables) {
    try {
      const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
      if (error) {
        counts[table] = 'error'
      } else {
        counts[table] = count ?? 0
      }
    } catch {
      counts[table] = 'error'
    }
  }

  return counts
}
