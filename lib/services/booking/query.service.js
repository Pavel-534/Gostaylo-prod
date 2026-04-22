/**
 * Bookings: reads, list joins, category slug, conversation_id enrichment.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { mapPublicImageUrls, toPublicImageUrl } from '@/lib/public-image-url';
import { E2E_TEST_DATA_TAG, isMarkedE2eTestData } from '@/lib/e2e/test-data-tag';

export function mapListingStorageRow(listing) {
  if (!listing) return listing;
  return {
    ...listing,
    images: mapPublicImageUrls(listing.images || []),
    cover_image: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
  };
}

export function mapBookingListingsJoin(booking) {
  if (!booking) return booking;
  if (!booking.listings) return booking;
  return { ...booking, listings: mapListingStorageRow(booking.listings) };
}

/** First conversation id per booking (lists: link to /messages/[id]). */
export async function attachConversationIdsToBookings(admin, bookings) {
  if (!bookings?.length) return bookings || [];
  if (!admin) {
    return bookings.map((b) => ({ ...b, conversation_id: null }));
  }
  const ids = [...new Set(bookings.map((b) => b.id).filter(Boolean))];
  if (!ids.length) return bookings;
  const { data, error } = await admin.from('conversations').select('id, booking_id').in('booking_id', ids);
  if (error) {
    console.warn('[BookingQuery] attachConversationIdsToBookings', error.message);
    return bookings.map((b) => ({ ...b, conversation_id: null }));
  }
  const firstByBooking = {};
  for (const row of data || []) {
    const bid = row.booking_id;
    if (bid && firstByBooking[bid] == null) firstByBooking[bid] = row.id;
  }
  return bookings.map((b) => ({ ...b, conversation_id: firstByBooking[b.id] || null }));
}

export async function resolveListingCategorySlug(categoryId) {
  if (!categoryId) return '';
  const { data } = await supabaseAdmin
    .from('categories')
    .select('slug')
    .eq('id', categoryId)
    .maybeSingle();
  return String(data?.slug || '').toLowerCase();
}

export async function getBookings(filters = {}) {
  let query = supabaseAdmin
    .from('bookings')
    .select(`
        *,
        listings (id, title, district, images, base_price_thb),
        renter:profiles!renter_id (id, email, first_name, last_name),
        partner:profiles!partner_id (id, email, first_name, last_name)
      `)
    .order('created_at', { ascending: false });

  if (!filters.includeTestData) {
    query = query.not('special_requests', 'ilike', `%${E2E_TEST_DATA_TAG}%`);
  }

  if (filters.renterId) {
    query = query.eq('renter_id', filters.renterId);
  }
  if (filters.partnerId) {
    query = query.eq('partner_id', filters.partnerId);
  }
  if (filters.listingId) {
    query = query.eq('listing_id', filters.listingId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message, bookings: [] };
  }

  const rows = filters.includeTestData
    ? data || []
    : (data || []).filter((b) => !isMarkedE2eTestData(b));
  const withConv = await attachConversationIdsToBookings(supabaseAdmin, rows);
  return { bookings: withConv.map(mapBookingListingsJoin) };
}

export async function getBookingById(bookingId) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
        *,
        listings (id, title, district, cover_image, images, base_price_thb, owner_id, metadata, cancellation_policy),
        renter:profiles!renter_id (id, email, first_name, last_name, phone, telegram_id, language),
        partner:profiles!partner_id (id, email, first_name, last_name)
      `,
    )
    .eq('id', bookingId)
    .single();

  if (error) {
    return null;
  }

  const mapped = mapBookingListingsJoin(data);
  const [withConv] = await attachConversationIdsToBookings(supabaseAdmin, [mapped]);
  return withConv;
}
