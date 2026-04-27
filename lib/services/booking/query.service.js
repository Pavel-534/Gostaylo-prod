/**
 * Bookings: reads, list joins, category slug, conversation_id enrichment.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { mapPublicImageUrls, toPublicImageUrl } from '@/lib/public-image-url';
import { E2E_TEST_DATA_TAG, isMarkedE2eTestData } from '@/lib/e2e/test-data-tag';
import { attachPartnerTrustToBookings } from '@/lib/booking/attach-partner-trust-to-bookings';

export function mapListingStorageRow(listing) {
  if (!listing) return listing;
  return {
    ...listing,
    images: mapPublicImageUrls(listing.images || []),
    cover_image: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
  };
}

/**
 * Embed из PostgREST с алиасом `listing:listings` кладётся в `booking.listing`, не в `listings`.
 * Плюс выставляет **`listings.category_slug`** из **`categories.slug`** / metadata (как в `mapBookingListingsJoin`).
 */
export function normalizeEmbeddedListingBooking(booking) {
  if (!booking || typeof booking !== 'object') return booking
  const embedded = booking.listing || booking.listings
  if (!embedded) return booking
  return mapBookingListingsJoin({ ...booking, listings: embedded })
}

export function mapBookingListingsJoin(booking) {
  if (!booking) return booking;
  if (!booking.listings) return booking;
  const row = mapListingStorageRow(booking.listings);
  const cat = row.categories;
  let slugFromRel = '';
  if (cat && typeof cat === 'object') {
    if (Array.isArray(cat)) {
      slugFromRel = String(cat[0]?.slug || '').toLowerCase();
    } else {
      slugFromRel = String(cat.slug || '').toLowerCase();
    }
  }
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {};
  const slugMeta = String(meta.category_slug || meta.categorySlug || '').toLowerCase();
  const category_slug = slugFromRel || slugMeta || (row.category_slug ? String(row.category_slug).toLowerCase() : '');
  const { categories, ...listingRest } = row;
  return {
    ...booking,
    listings: {
      ...listingRest,
      ...(category_slug ? { category_slug } : {}),
    },
  };
}

/** First conversation id per booking (lists: link to /messages/[id]). */
function formatRpcLastMessagePreview(row) {
  if (!row || typeof row !== 'object') return null;
  const type = String(row.type || '').toLowerCase();
  if (type === 'image') return '📷';
  if (type === 'invoice' || type === 'payment_request') return '📄';
  const body = row.content || row.message_body || row.message || '';
  const t = String(body || '').trim();
  if (!t) return type ? `[${type}]` : null;
  return t.length > 280 ? `${t.slice(0, 277)}…` : t;
}

function lastMessageIsUnreadForViewer(m, booking, viewerUid) {
  if (!m || !viewerUid) return false;
  if (String(m.sender_id || '') === String(viewerUid)) return false;
  const rid = String(booking.renter_id || '');
  const pid = String(booking.partner_id || '');
  const listing = booking.listings || booking.listing || {};
  const oid = String(listing.owner_id || '');
  const uid = String(viewerUid);
  const isRenter = rid === uid;
  const isHostSide = pid === uid || oid === uid;
  if (isRenter) return m.read_at_renter == null;
  if (isHostSide) return m.read_at_partner == null;
  return m.is_read === false;
}

/** Last message preview + unread strip flags (RPC `booking_conversation_last_messages`). */
export async function attachBookingConversationPreviews(admin, bookings, { viewerUserId } = {}) {
  if (!bookings?.length) return bookings || [];
  if (!admin) return bookings;
  const withConv = bookings.filter((b) => b.conversation_id);
  if (!withConv.length) return bookings;

  const convIds = [...new Set(withConv.map((b) => String(b.conversation_id)).filter(Boolean))];
  const { data, error } = await admin.rpc('booking_conversation_last_messages', {
    p_conversation_ids: convIds,
  });
  if (error) {
    console.warn('[BookingQuery] attachBookingConversationPreviews', error.message);
    return bookings;
  }

  const byConv = new Map();
  for (const row of data || []) {
    const cid = String(row.conversation_id || '');
    if (cid) byConv.set(cid, row);
  }

  const viewer = viewerUserId ? String(viewerUserId) : '';

  return bookings.map((b) => {
    const cid = b.conversation_id ? String(b.conversation_id) : '';
    if (!cid) return b;
    const mrow = byConv.get(cid);
    const preview = formatRpcLastMessagePreview(mrow);
    const unread = lastMessageIsUnreadForViewer(mrow, b, viewer) ? 1 : 0;
    return {
      ...b,
      conversationLastMessage: preview,
      conversation_last_message_at: mrow?.created_at ?? null,
      conversationUnreadCount: unread,
      conversation_unread_count: unread,
    };
  });
}

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
        listings (
          id, title, district, images, base_price_thb, category_id, metadata, owner_id,
          categories ( slug )
        ),
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
  const mapped = withConv.map(mapBookingListingsJoin);
  const withTrust = await attachPartnerTrustToBookings(mapped);
  const viewerUserId = filters.renterId || filters.partnerId || null;
  const withPreview = await attachBookingConversationPreviews(supabaseAdmin, withTrust, {
    viewerUserId,
  });
  return { bookings: withPreview };
}

export async function getBookingById(bookingId, options = {}) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
        *,
        listings (
          id, title, district, cover_image, images, base_price_thb, owner_id, metadata, cancellation_policy, category_id,
          categories ( slug )
        ),
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
  const [withTrust] = await attachPartnerTrustToBookings([withConv]);
  const viewerUserId = options.viewerUserId != null ? String(options.viewerUserId) : '';
  const [withPreview] = await attachBookingConversationPreviews(supabaseAdmin, [withTrust], {
    viewerUserId,
  });
  return withPreview;
}
