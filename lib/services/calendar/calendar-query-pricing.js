import { promoIsActiveAt } from '@/lib/promo/promo-engine';
import { calculateDailyPrice } from '@/lib/services/calendar/calendar-pricing.service';

export function calculateCalendarDayPrice({
  basePriceThb,
  date,
  seasonalPrices = [],
  metadataSeasonalPricing = [],
}) {
  return calculateDailyPrice(basePriceThb, date, seasonalPrices, metadataSeasonalPricing);
}

export function resolveCalendarPromoForDay({
  promos: _promos,
  listingId: _listingId,
  listingOwnerId: _listingOwnerId,
  date: _date,
  baseSeasonPrice,
}) {
  return {
    promo: null,
    effectivePriceThb: baseSeasonPrice,
    promoMeta: null,
    dayPromo: null,
  };
}

export async function resolveActiveMarketingPromosForRange(supabase) {
  const { data: promosData } = await supabase
    .from('promo_codes')
    .select(
      'code,promo_type,value,is_active,valid_until,max_uses,current_uses,created_by_type,partner_id,allowed_listing_ids,is_flash_sale',
    )
    .eq('is_active', true);
  const nowMs = Date.now();
  return (promosData || []).filter((row) => promoIsActiveAt(row, nowMs).ok);
}
