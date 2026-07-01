import { buildSmartWhereOrClause } from '@/lib/api/search/location-filter'

/** Full row for service_role search (spatial/PostGIS needs true coords; fuzz on response via ADR-163).
 *  PostgREST anon/authenticated catalog: `listings_public_catalog` view (Stage 168.0). */

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
  /** @type {string[] | null | undefined} spatialListingIds — PostGIS RPC ids; null = no filter */
  spatialListingIds = null,
  /** @type {string} [listingsSelect] — default LISTINGS_SELECT; lite profile omits description */
  listingsSelect = LISTINGS_SELECT,
  /** @type {'legacy'|'unified'} [amenitiesMode] — unified: single metadata @> with all slugs */
  amenitiesMode = 'legacy',
  /** @type {boolean} [deferOrderAndLimit] — cursor path applies order/limit via discovery-cursor-sql */
  deferOrderAndLimit = false,
  /** @type {import('@/lib/search/filter-registry').DiscoveryQueryPlan|null} [discoveryPlan] — unified path: skip legacy scalar/amenities */
  discoveryPlan = null,
}) {
  const useUnifiedPlan = Boolean(discoveryPlan)
  let q = supabaseAdmin
    .from('listings')
    .select(listingsSelect)
    .eq('status', 'ACTIVE')

  if (!deferOrderAndLimit) {
    if (filters.featured) {
      q = q.order('is_featured', { ascending: false })
    }
    q = q.order('created_at', { ascending: false })
    q = q.limit(fetchLimit)
  }

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

  if (spatialListingIds != null) {
    if (spatialListingIds.length === 0) {
      q = q.in('id', ['__spatial_empty__'])
    } else if (spatialListingIds.length === 1) {
      q = q.eq('id', spatialListingIds[0])
    } else {
      q = q.in('id', spatialListingIds)
    }
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
  if (!useUnifiedPlan) {
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
      if (amenitiesMode === 'unified') {
        q = q.contains('metadata', { amenities: [...filters.amenities] })
      } else {
        for (const amenitySlug of filters.amenities) {
          q = q.contains('metadata', { amenities: [amenitySlug] })
        }
      }
    }
  }

  /** Non-thenable wrapper — async return of PostgREST chain would execute the query early. */
  return { query: q }
}
