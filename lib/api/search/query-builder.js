import { buildSmartWhereOrClause } from '@/lib/api/search/location-filter'

export const LISTINGS_SELECT = `
        id,
        owner_id,
        category_id,
        status,
        title,
        description,
        district,
        metadata,
        latitude,
        longitude,
        instant_booking,
        base_price_thb,
        commission_rate,
        images,
        cover_image,
        max_capacity,
        bedrooms_count,
        bathrooms_count,
        is_featured,
        views,
        bookings_count,
        rating,
        avg_rating,
        reviews_count,
        created_at,
        available,
        categories (id, name, slug, icon, wizard_profile, parent_id, name_i18n),
        owner:profiles!owner_id (id, first_name, last_name, is_verified)
      `

export async function buildListingsQuery({
  supabaseAdmin,
  filters,
  fetchLimit,
  textOrClause,
  categoryIds,
  bbox,
  centerBbox,
  includeTextSearchOr,
  /** @type {string} [listingsSelect] — default LISTINGS_SELECT; lite profile omits description */
  listingsSelect = LISTINGS_SELECT,
}) {
  let q = supabaseAdmin
    .from('listings')
    .select(listingsSelect)
    .eq('status', 'ACTIVE')

  if (filters.featured) {
    q = q.order('is_featured', { ascending: false })
  }
  q = q.order('created_at', { ascending: false })
  q = q.limit(fetchLimit)

  if (includeTextSearchOr && textOrClause) {
    q = q.or(textOrClause)
  }

  if (filters.where && filters.where !== 'all') {
    const whereOrClause = await buildSmartWhereOrClause(filters.where)
    if (whereOrClause) q = q.or(whereOrClause)
  } else {
    if (filters.city && filters.city !== 'all') {
      q = q.contains('metadata', { city: filters.city })
    }
    if (filters.location && filters.location !== 'all') {
      q = q.ilike('district', `%${filters.location}%`)
    }
  }

  if (categoryIds?.length) {
    q = categoryIds.length === 1 ? q.eq('category_id', categoryIds[0]) : q.in('category_id', categoryIds)
  }
  const dbBbox = bbox || centerBbox
  if (dbBbox) {
    q = q
      .gte('latitude', dbBbox.south)
      .lte('latitude', dbBbox.north)
      .gte('longitude', dbBbox.west)
      .lte('longitude', dbBbox.east)
  }

  /** При заданном диапазоне дат цена фильтруется по календарю после availability (не по сырой колонке). */
  const skipSqlPriceBecauseCalendar =
    filters.checkIn &&
    filters.checkOut &&
    String(filters.checkIn) < String(filters.checkOut)

  if (!skipSqlPriceBecauseCalendar && filters.minPrice) {
    q = q.gte('base_price_thb', filters.minPrice)
  }
  if (!skipSqlPriceBecauseCalendar && filters.maxPrice) {
    q = q.lte('base_price_thb', filters.maxPrice)
  }
  if (filters.instantBookingOnly) {
    q = q.eq('instant_booking', true)
  }
  if (Number.isFinite(filters.bedroomsMin) && filters.bedroomsMin > 0) {
    q = q.gte('bedrooms_count', filters.bedroomsMin)
  }
  if (Number.isFinite(filters.bathroomsMin) && filters.bathroomsMin > 0) {
    q = q.gte('bathrooms_count', filters.bathroomsMin)
  }
  if (filters.amenities?.length) {
    for (const amenitySlug of filters.amenities) {
      q = q.contains('metadata', { amenities: [amenitySlug] })
    }
  }

  return q
}
