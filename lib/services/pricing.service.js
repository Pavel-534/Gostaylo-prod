/**
 * GoStayLo - Pricing Service
 * Handles seasonal pricing, duration ladder discounts, commission, and promo codes
 *
 * Seasonal rates (in order, first match wins — same as CalendarService):
 * 1) `seasonal_prices` table (price_daily / season_type)
 * 2) `listings.metadata.seasonal_pricing` (priceMultiplier or absolute priceDaily)
 *
 * Duration discounts: `listings.metadata.discounts` e.g. `{ "7_days": 10, "30_days": 25 }`
 * (percent off the stay subtotal after nightly rates; best qualifying tier wins).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service';

function getSeasonTypeLabel(seasonType) {
  const labels = {
    LOW: 'Низкий сезон',
    NORMAL: 'Обычный',
    HIGH: 'Высокий сезон',
    PEAK: 'Пик сезона',
  };
  return labels[seasonType] || 'Season';
}

/**
 * @param {Record<string, unknown>} [discounts]
 * @returns {{ minNights: number, percent: number }[]}
 */
export function parseDurationDiscountTiers(discounts) {
  if (!discounts || typeof discounts !== 'object' || Array.isArray(discounts)) return [];
  const tiers = [];
  for (const [key, raw] of Object.entries(discounts)) {
    const pct = parseFloat(raw);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    const k = String(key);
    let minNights = null;
    const mUnderscore = k.match(/^(\d+)_days?$/i);
    const mPlain = k.match(/^(\d+)$/);
    if (mUnderscore) minNights = parseInt(mUnderscore[1], 10);
    else if (mPlain) minNights = parseInt(mPlain[1], 10);
    if (!minNights || minNights < 1) continue;
    tiers.push({ minNights, percent: Math.min(100, pct) });
  }
  tiers.sort((a, b) => a.minNights - b.minNights);
  return tiers;
}

/**
 * Highest percent among tiers where nights >= minNights.
 */
export function computeBestDurationDiscountPercent(nights, tiers) {
  if (!tiers?.length || nights < 1) return 0;
  let best = 0;
  for (const t of tiers) {
    if (nights >= t.minNights) best = Math.max(best, t.percent);
  }
  return best;
}

export function applyDurationDiscountToSubtotal(subtotalThb, nights, metadata) {
  const tiers = parseDurationDiscountTiers(metadata?.discounts);
  const pct = computeBestDurationDiscountPercent(nights, tiers);
  const originalPrice = Math.round(subtotalThb);
  const discountAmount = Math.round((originalPrice * pct) / 100);
  const discountedPrice = Math.max(0, originalPrice - discountAmount);
  return {
    originalPrice,
    discountedPrice,
    durationDiscountPercent: pct,
    durationDiscountAmount: discountAmount,
    durationDiscountTiers: tiers,
  };
}

export class PricingService {
  
  /**
   * Listing row + DB seasonal rows + metadata seasonal + duration discount config
   */
  static async getListingWithSeasonalPricing(listingId) {
    const [{ data: listing, error }, { data: dbSeasonal }] = await Promise.all([
      supabaseAdmin
        .from('listings')
        .select('id, base_price_thb, metadata')
        .eq('id', listingId)
        .single(),
      supabaseAdmin
        .from('seasonal_prices')
        .select('*')
        .eq('listing_id', listingId)
        .order('start_date', { ascending: true }),
    ]);

    if (error || !listing) {
      return null;
    }

    return {
      id: listing.id,
      basePrice: parseFloat(listing.base_price_thb),
      dbSeasonalPrices: dbSeasonal || [],
      seasonalPricing: listing.metadata?.seasonal_pricing || [],
      metadata: listing.metadata || {},
    };
  }
  
  /**
   * Get seasonal price for a listing on specific dates
   * Returns applicable seasonal pricing rules from metadata
   */
  static async getSeasonalPrice(listingId, checkIn, checkOut) {
    const listing = await this.getListingWithSeasonalPricing(listingId);
    if (!listing) return [];

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const fromDb = (listing.dbSeasonalPrices || []).filter((season) => {
      const seasonStart = new Date(season.start_date);
      const seasonEnd = new Date(season.end_date);
      return seasonStart <= checkOutDate && seasonEnd >= checkInDate;
    });
    const fromMeta = (listing.seasonalPricing || []).filter((season) => {
      const seasonStart = new Date(season.startDate || season.start_date);
      const seasonEnd = new Date(season.endDate || season.end_date);
      return seasonStart <= checkOutDate && seasonEnd >= checkInDate;
    });
    return [...fromDb, ...fromMeta];
  }

  /**
   * One night: DB `seasonal_prices` first, then metadata `seasonal_pricing` (aligned with CalendarService).
   */
  static calculateDailyPrice(basePrice, dateStr, seasonalPricing, dbSeasonalPrices = []) {
    let dailyPrice = basePrice;
    let seasonLabel = 'Base';

    if (dbSeasonalPrices && dbSeasonalPrices.length > 0) {
      for (const season of dbSeasonalPrices) {
        const startDate = season.start_date;
        const endDate = season.end_date;
        if (dateStr >= startDate && dateStr <= endDate) {
          dailyPrice = Math.round(parseFloat(season.price_daily) || basePrice);
          seasonLabel = season.label || getSeasonTypeLabel(season.season_type);
          return { dailyPrice, seasonLabel };
        }
      }
    }

    if (seasonalPricing && seasonalPricing.length > 0) {
      for (const season of seasonalPricing) {
        const seasonStart = season.startDate || season.start_date;
        const seasonEnd = season.endDate || season.end_date;
        if (!seasonStart || !seasonEnd) continue;

        if (dateStr >= seasonStart && dateStr <= seasonEnd) {
          const abs = season.priceDaily ?? season.price_daily;
          if (abs != null && abs !== '' && !Number.isNaN(parseFloat(abs))) {
            dailyPrice = Math.round(parseFloat(abs));
            seasonLabel = season.label || season.name || season.seasonType || 'Season';
          } else {
            const multiplier = parseFloat(season.priceMultiplier) || 1.0;
            dailyPrice = Math.round(basePrice * multiplier);
            seasonLabel = season.label || season.name || 'Season';
          }
          return { dailyPrice, seasonLabel };
        }
      }
    }

    return { dailyPrice, seasonLabel };
  }
  
  /**
   * Calculate total price for a booking
   * Fetches seasonal pricing from listings.metadata.seasonal_pricing
   */
  static async calculateBookingPrice(listingId, checkIn, checkOut, basePriceOverride = null) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }

    const listing = await this.getListingWithSeasonalPricing(listingId);
    if (!listing) {
      return { error: 'Listing not found', nights: 0, totalPrice: 0 };
    }

    const basePrice = basePriceOverride || listing.basePrice;
    const seasonalPricing = listing.seasonalPricing;
    const dbSeasonalPrices = listing.dbSeasonalPrices || [];

    let subtotalBeforeDuration = 0;
    const priceBreakdown = [];
    const seasonSummary = {};

    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(
        basePrice,
        dateStr,
        seasonalPricing,
        dbSeasonalPrices
      );

      subtotalBeforeDuration += dailyPrice;
      priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel });

      if (!seasonSummary[seasonLabel]) {
        seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice };
      }
      seasonSummary[seasonLabel].nights++;
      seasonSummary[seasonLabel].subtotal += dailyPrice;
    }

    const dur = applyDurationDiscountToSubtotal(subtotalBeforeDuration, nights, listing.metadata);

    return {
      nights,
      /** Subtotal from nightly rates (seasonal-aware), before duration % off */
      originalPrice: dur.originalPrice,
      /** After duration ladder discount (before promo codes) */
      discountedPrice: dur.discountedPrice,
      totalPrice: dur.discountedPrice,
      durationDiscountPercent: dur.durationDiscountPercent,
      durationDiscountAmount: dur.durationDiscountAmount,
      durationDiscountTiers: dur.durationDiscountTiers,
      basePrice,
      averageNightlyRate: Math.round(subtotalBeforeDuration / nights),
      averageNightlyAfterDiscount: Math.round(dur.discountedPrice / nights),
      priceBreakdown,
      seasonSummary,
    };
  }
  
  /**
   * Client-side calculation (no DB call) - for real-time UI updates
   * Use when you already have the listing data with seasonal pricing
   */
  static calculateBookingPriceSync(
    basePrice,
    checkIn,
    checkOut,
    seasonalPricing = [],
    dbSeasonalPrices = [],
    metadataForDiscounts = null
  ) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    if (nights <= 0 || isNaN(nights)) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }

    let subtotal = 0;
    const priceBreakdown = [];
    const seasonSummary = {};

    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(
        basePrice,
        dateStr,
        seasonalPricing,
        dbSeasonalPrices
      );

      subtotal += dailyPrice;
      priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel });

      if (!seasonSummary[seasonLabel]) {
        seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice };
      }
      seasonSummary[seasonLabel].nights++;
      seasonSummary[seasonLabel].subtotal += dailyPrice;
    }

    const dur = applyDurationDiscountToSubtotal(subtotal, nights, metadataForDiscounts);

    return {
      nights,
      originalPrice: dur.originalPrice,
      discountedPrice: dur.discountedPrice,
      totalPrice: dur.discountedPrice,
      durationDiscountPercent: dur.durationDiscountPercent,
      durationDiscountAmount: dur.durationDiscountAmount,
      basePrice,
      averageNightlyRate: Math.round(subtotal / nights),
      averageNightlyAfterDiscount: Math.round(dur.discountedPrice / nights),
      priceBreakdown,
      seasonSummary,
    };
  }

  /**
   * Wrapper method for compatibility with Premium Listing Page
   * Accepts currency and exchange rates for multi-currency support
   */
  static calculatePrice({
    basePriceThb,
    seasonalPricing,
    dbSeasonalPrices,
    metadata,
    checkIn,
    checkOut,
    currency = 'THB',
    exchangeRates = {},
  }) {
    const calc = this.calculateBookingPriceSync(
      basePriceThb,
      checkIn,
      checkOut,
      seasonalPricing || [],
      dbSeasonalPrices || [],
      metadata || null
    )
    
    if (calc.error) {
      return calc
    }
    
    // Apply currency conversion if needed
    const rate = exchangeRates[currency] || 1
    const convertPrice = (priceThb) => currency === 'THB' ? priceThb : Math.round(priceThb / rate)
    
    // Extract seasonal adjustments
    let discountAmount = 0
    let surchargeAmount = 0
    
    if (calc.priceBreakdown) {
      calc.priceBreakdown.forEach((day) => {
        const diff = day.price - basePriceThb;
        if (diff < 0) discountAmount += Math.abs(diff);
        if (diff > 0) surchargeAmount += diff;
      });
    }

    return {
      nights: calc.nights,
      originalPrice: calc.originalPrice,
      discountedPrice: calc.discountedPrice,
      durationDiscountPercent: calc.durationDiscountPercent,
      durationDiscountAmount: calc.durationDiscountAmount,
      baseSubtotal: calc.originalPrice,
      avgPricePerNight: calc.averageNightlyRate,
      totalPrice: calc.totalPrice,
      discountAmount,
      surchargeAmount,
      priceBreakdown: calc.priceBreakdown,
      seasonSummary: calc.seasonSummary,
    };
  }

  
  /**
   * Calculate commission for a booking
   * HIERARCHY:
   * 1. User's custom_commission_rate in profiles table
   * 2. Global platform_commission from settings table (key: 'general')
   * 3. Fallback: CurrencyService (system_settings → env → single emergency default)
   */
  static async calculateCommission(priceThb, partnerId, systemSettings = null) {
    let commissionRate = await resolveDefaultCommissionPercent();

    // Priority 1: Check partner's custom commission rate
    const { data: partner } = await supabaseAdmin
      .from('profiles')
      .select('custom_commission_rate')
      .eq('id', partnerId)
      .single();
    
    if (partner?.custom_commission_rate !== null && partner?.custom_commission_rate !== undefined) {
      commissionRate = parseFloat(partner.custom_commission_rate);
      console.log(`[COMMISSION] Using partner custom rate: ${commissionRate}% for ${partnerId}`);
    } else {
      // Priority 2: Check global platform commission from settings
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'general')
        .single();
      
      if (settings?.value?.defaultCommissionRate) {
        commissionRate = parseFloat(settings.value.defaultCommissionRate);
        console.log(`[COMMISSION] Using global platform rate: ${commissionRate}%`);
      } else {
        console.log(`[COMMISSION] Using fallback rate: ${commissionRate}%`);
      }
    }
    
    const commissionThb = priceThb * (commissionRate / 100);
    const partnerEarnings = priceThb - commissionThb;
    
    return {
      commissionRate,
      commissionThb: Math.round(commissionThb),
      partnerEarnings: Math.round(partnerEarnings),
      priceThb
    };
  }
  
  /**
   * Validate and apply promo code
   */
  static async validatePromoCode(code, bookingAmount) {
    const { data: promo, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();
    
    if (error || !promo) {
      return { valid: false, error: 'Invalid promo code' };
    }
    
    // Check expiration
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      return { valid: false, error: 'Promo code has expired' };
    }
    
    // Check minimum amount
    if (promo.min_amount && bookingAmount < parseFloat(promo.min_amount)) {
      return { valid: false, error: `Minimum booking amount is ${promo.min_amount} THB` };
    }
    
    // Check max uses
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return { valid: false, error: 'Promo code usage limit reached' };
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (promo.promo_type === 'PERCENTAGE') {
      discountAmount = bookingAmount * (parseFloat(promo.value) / 100);
    } else if (promo.promo_type === 'FIXED') {
      discountAmount = parseFloat(promo.value);
    }
    
    // Ensure discount doesn't exceed booking amount
    discountAmount = Math.min(discountAmount, bookingAmount);
    
    return {
      valid: true,
      code: promo.code,
      type: promo.promo_type,
      value: parseFloat(promo.value),
      discountAmount,
      newTotal: bookingAmount - discountAmount
    };
  }
  
  /**
   * Get exchange rates
   */
  static async getExchangeRates() {
    const { data: rates } = await supabaseAdmin
      .from('exchange_rates')
      .select('*');
    
    return rates?.map(r => ({
      code: r.currency_code,
      rateToThb: parseFloat(r.rate_to_thb),
      symbol: { THB: '฿', RUB: '₽', USD: '$', USDT: '₮' }[r.currency_code] || r.currency_code
    })) || [];
  }
  
  /**
   * Convert price between currencies
   */
  static async convertPrice(amountThb, targetCurrency) {
    const rates = await this.getExchangeRates();
    const rate = rates.find(r => r.code === targetCurrency);
    
    if (!rate) {
      return { amount: amountThb, currency: 'THB' };
    }
    
    return {
      amount: amountThb / rate.rateToThb,
      currency: targetCurrency,
      rate: rate.rateToThb
    };
  }
}

export default PricingService;
