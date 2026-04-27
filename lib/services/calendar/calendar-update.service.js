/**
 * GoStayLo — Calendar update / batch layer (Stage 70.5)
 * Batch availability RPC + post-enrichment (promos, fees). Calendar block CRUD stays in API routes.
 */

import { OCCUPYING_BOOKING_STATUSES } from '@/lib/booking-occupancy-statuses';
import { toListingDate } from '@/lib/listing-date';
import { PricingService } from '@/lib/services/pricing.service';
import { computeRoundedGuestTotalPot } from '@/lib/booking-price-integrity.js';
import { getSupabase, groupRowsByListingId } from '@/lib/services/calendar/calendar-shared';
import { pickBestCatalogPromoForPrice } from '@/lib/services/calendar/calendar-pricing.service';

export class CalendarUpdateLayer {
  /**
   * Batch availability for search/catalog: one RPC for many listings.
   * Returns base pricing (night count * available nightly base) to avoid N+1 checks.
   *
   * @param {string[]} listingIds
   * @param {string} checkIn - YYYY-MM-DD
   * @param {string} checkOut - YYYY-MM-DD
   * @param {{ guestsCount?: number, occupyingStatusesCsv?: string|null }} [options]
   */
  static async checkBatchAvailability(listingIds, checkIn, checkOut, options = {}) {
    const ids = Array.isArray(listingIds)
      ? [...new Set(listingIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : [];
    if (ids.length === 0) {
      return { success: true, results: new Map() };
    }

    const checkInStr = toListingDate(checkIn);
    const checkOutStr = toListingDate(checkOut);
    if (!checkInStr || !checkOutStr || checkInStr >= checkOutStr) {
      return {
        success: false,
        error: 'INVALID_DATE_RANGE',
        code: 'INVALID_DATE_RANGE',
      };
    }

    const guestsCount = Math.max(
      1,
      parseInt(options.guestsCount ?? options.guests_count ?? 1, 10) || 1,
    );

    let statuses = OCCUPYING_BOOKING_STATUSES;
    if (typeof options.occupyingStatusesCsv === 'string' && options.occupyingStatusesCsv.trim()) {
      const parsed = options.occupyingStatusesCsv
        .split(',')
        .map((s) => String(s || '').trim())
        .filter(Boolean);
      if (parsed.length > 0) statuses = parsed;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('batch_check_listing_availability', {
      p_listing_ids: ids,
      p_check_in: checkInStr,
      p_check_out: checkOutStr,
      p_guests_count: guestsCount,
      p_occupying_statuses: statuses,
    });

    if (error) {
      return { success: false, error: error.message || 'BATCH_AVAILABILITY_RPC_FAILED' };
    }

    const rows = Array.isArray(data) ? data : [];
    const results = new Map();
    const availableIds = rows
      .filter((row) => row?.available === true)
      .map((row) => String(row?.listing_id || '').trim())
      .filter(Boolean);

    let listingById = new Map();
    let seasonalByListingId = new Map();
    let promoRows = [];
    let feePolicyByOwnerId = new Map();

    if (availableIds.length > 0) {
      const [{ data: listingRows, error: listingError }, { data: seasonalRows }, { data: activePromos }] =
        await Promise.all([
          supabase
            .from('listings')
            .select('id, owner_id, base_price_thb, metadata, categories(slug)')
            .in('id', availableIds),
          supabase
            .from('seasonal_prices')
            .select('*')
            .in('listing_id', availableIds)
            .gte('end_date', checkInStr)
            .lte('start_date', checkOutStr)
            .order('start_date', { ascending: true }),
          supabase
            .from('promo_codes')
            .select(
              'code, promo_type, value, created_by_type, partner_id, allowed_listing_ids, max_uses, current_uses, valid_until, is_active, is_flash_sale',
            )
            .eq('is_active', true),
        ]);

      if (listingError) {
        return { success: false, error: listingError.message || 'BATCH_PRICING_LISTINGS_FAILED' };
      }

      listingById = new Map((listingRows || []).map((row) => [String(row.id), row]));
      seasonalByListingId = groupRowsByListingId(seasonalRows || []);
      promoRows = (activePromos || []).filter((promo) => {
        if (!promo) return false;
        if (promo.is_active === false) return false;
        if (promo.max_uses != null && Number(promo.current_uses) >= Number(promo.max_uses)) return false;
        if (promo.valid_until) {
          const endMs = new Date(promo.valid_until).getTime();
          if (!Number.isFinite(endMs) || endMs <= Date.now()) return false;
        }
        return true;
      });

      const ownerIds = [
        ...new Set((listingRows || []).map((row) => String(row?.owner_id || '').trim()).filter(Boolean)),
      ];
      feePolicyByOwnerId = await PricingService.getFeePolicyBatch(ownerIds);
    }

    for (const row of rows) {
      const listingId = String(row?.listing_id || '').trim();
      if (!listingId) continue;
      const nights = Math.max(0, Number(row?.nights) || 0);
      let totalPrice = Math.max(0, Number(row?.total_price) || 0);
      let averagePerNight = nights > 0 ? Math.round(totalPrice / nights) : 0;
      const conflictsCount = Math.max(0, Number(row?.conflicts_count) || 0);
      let pricing = {
        nights,
        totalPrice,
        averagePerNight,
        is_promo_applied: false,
        isPromoApplied: false,
      };

      if (row?.available === true) {
        const listing = listingById.get(listingId);
        if (listing) {
          const categorySlug = String(listing?.categories?.slug || '').toLowerCase();
          const metadata = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {};
          const priceCalc = PricingService.calculateBookingPriceSync(
            parseFloat(listing.base_price_thb) || 0,
            checkInStr,
            checkOutStr,
            metadata.seasonal_pricing || [],
            seasonalByListingId.get(listingId) || [],
            metadata,
            { listingCategorySlug: categorySlug, guestsCount },
          );
          if (!priceCalc.error) {
            const subtotalBeforePromoThb = Math.max(0, Math.round(Number(priceCalc.totalPrice) || 0));
            const bestPromo = pickBestCatalogPromoForPrice({
              promoRows,
              listing,
              subtotalThb: subtotalBeforePromoThb,
            });
            const promoDiscountAmountThb = bestPromo?.discountAmount || 0;
            const subtotalThb = Math.max(0, subtotalBeforePromoThb - promoDiscountAmountThb);
            const feePolicy = feePolicyByOwnerId.get(String(listing.owner_id || ''));
            const feeSplit = PricingService.calculateFeeSplitWithPolicy(subtotalThb, feePolicy);
            const rounded = computeRoundedGuestTotalPot(feeSplit.guestPayableThb);
            const guestPayableRoundedThb =
              rounded?.roundedGuestTotalThb ?? Math.round(Number(feeSplit.guestPayableThb) || 0);

            totalPrice = guestPayableRoundedThb;
            averagePerNight = nights > 0 ? Math.round(subtotalThb / nights) : 0;
            pricing = {
              nights: priceCalc.nights,
              totalPrice,
              subtotalBeforePromoThb,
              subtotalThb,
              taxRatePercent: feeSplit.taxRatePercent ?? 0,
              taxAmountThb: feeSplit.taxAmountThb ?? 0,
              guestPayableThb: feeSplit.guestPayableThb,
              guestPayableRoundedThb,
              guestServiceFeeThb: feeSplit.guestServiceFeeThb,
              guestServiceFeePercent: feeSplit.guestServiceFeePercent,
              roundingDiffPotThb: rounded?.roundingDiffPotThb ?? 0,
              averagePerNight,
              averageNightlyRate: priceCalc.averageNightlyRate,
              averageNightlyAfterDiscount: priceCalc.averageNightlyAfterDiscount,
              durationDiscountPercent: priceCalc.durationDiscountPercent || 0,
              durationDiscountAmount: priceCalc.durationDiscountAmount || 0,
              promoCode: bestPromo?.code || null,
              promoDiscountAmountThb,
              promoFlashSale: bestPromo?.isFlashSale === true,
              is_promo_applied: promoDiscountAmountThb > 0,
              isPromoApplied: promoDiscountAmountThb > 0,
            };
          }
        }
      }

      results.set(listingId, {
        success: true,
        available: row?.available === true,
        conflicts_count: conflictsCount,
        min_remaining_spots: Math.max(0, Number(row?.min_remaining_spots) || 0),
        max_capacity: Math.max(1, Number(row?.max_capacity) || 1),
        required_guests: Math.max(1, Number(row?.required_guests) || guestsCount),
        pricing,
      });
    }

    return { success: true, results };
  }
}

export default CalendarUpdateLayer;
