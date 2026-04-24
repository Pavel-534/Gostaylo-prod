/**
 * GoStayLo - Pricing Service
 * Handles seasonal pricing, duration ladder discounts, commission, and promo codes
 *
 * Seasonal rates (in order, first match wins — same as CalendarService):
 * 1) `seasonal_prices` table (price_daily / season_type)
 * 2) `listings.metadata.seasonal_pricing` (priceMultiplier or absolute priceDaily)
 *
 * Duration discounts: `listings.metadata.discounts`:
 * - `{ "weekly": 7, "monthly": 20 }` → от 7 и от 30 ночей (%)
 * - legacy: `{ "7_days": 10, "30_days": 25 }`
 * (процент с базы после ночных ставок; действует лучший подходящий уровень).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { resolveChatInvoiceRateMultiplier } from '@/lib/services/currency.service';
import { toListingDate, addListingDays } from '@/lib/listing-date';

function isTourCategorySlug(slug) {
  const s = String(slug || '').toLowerCase();
  return s === 'tours' || s.includes('tour');
}

function getSeasonTypeLabel(seasonType) {
  const labels = {
    LOW: 'Низкий сезон',
    NORMAL: 'Обычный',
    HIGH: 'Высокий сезон',
    PEAK: 'Пик сезона',
  };
  return labels[seasonType] || 'Season';
}

function normalizeCurrencyCode(currency) {
  return String(currency || 'THB').toUpperCase().trim();
}

const DEFAULT_GUEST_SERVICE_FEE_PERCENT = 5;
const DEFAULT_HOST_COMMISSION_PERCENT = 0;
const DEFAULT_INSURANCE_FUND_PERCENT = 0.5;

function parsePercent(raw, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(100, n);
}

/**
 * @param {Record<string, unknown>} [discounts]
 * @returns {{ minNights: number, percent: number }[]}
 */
export function parseDurationDiscountTiers(discounts) {
  if (!discounts || typeof discounts !== 'object' || Array.isArray(discounts)) return [];
  const rest = { ...discounts };
  const tiers = [];

  if (rest.weekly != null) {
    const pct = parseFloat(rest.weekly);
    if (Number.isFinite(pct) && pct > 0) {
      tiers.push({ minNights: 7, percent: Math.min(100, pct), sourceKey: 'weekly' });
    }
    delete rest.weekly;
  }
  if (rest.monthly != null) {
    const pct = parseFloat(rest.monthly);
    if (Number.isFinite(pct) && pct > 0) {
      tiers.push({ minNights: 30, percent: Math.min(100, pct), sourceKey: 'monthly' });
    }
    delete rest.monthly;
  }

  for (const [key, raw] of Object.entries(rest)) {
    const pct = parseFloat(raw);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    const k = String(key);
    let minNights = null;
    const mUnderscore = k.match(/^(\d+)_days?$/i);
    const mPlain = k.match(/^(\d+)$/);
    if (mUnderscore) minNights = parseInt(mUnderscore[1], 10);
    else if (mPlain) minNights = parseInt(mPlain[1], 10);
    if (!minNights || minNights < 1) continue;
    tiers.push({ minNights, percent: Math.min(100, pct), sourceKey: k });
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

/**
 * Уровень скидки за длительность, фактически применённый при расчёте (макс. % среди подходящих).
 */
export function getAppliedDurationDiscountTier(nights, tiers, appliedPercent) {
  if (!tiers?.length || !appliedPercent || nights < 1) return null;
  const qualifying = tiers.filter((t) => nights >= t.minNights && t.percent === appliedPercent);
  if (!qualifying.length) return null;
  return qualifying.reduce((a, b) => (a.minNights >= b.minNights ? a : b));
}

export function applyDurationDiscountToSubtotal(subtotalThb, nights, metadata) {
  const tiers = parseDurationDiscountTiers(metadata?.discounts);
  const pct = computeBestDurationDiscountPercent(nights, tiers);
  const originalPrice = Math.round(subtotalThb);
  const discountAmount = Math.round((originalPrice * pct) / 100);
  const discountedPrice = Math.max(0, originalPrice - discountAmount);
  const appliedTier = getAppliedDurationDiscountTier(nights, tiers, pct);
  return {
    originalPrice,
    discountedPrice,
    durationDiscountPercent: pct,
    durationDiscountAmount: discountAmount,
    durationDiscountTiers: tiers,
    durationDiscountMinNights: appliedTier?.minNights ?? null,
    durationDiscountSourceKey: appliedTier?.sourceKey ?? null,
  };
}

export class PricingService {
  static async getGeneralPricingSettings() {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'general')
      .maybeSingle();
    return data?.value || {};
  }

  static async getFeePolicy(partnerId = null) {
    const [general, partnerRes] = await Promise.all([
      this.getGeneralPricingSettings(),
      partnerId
        ? supabaseAdmin
            .from('profiles')
            .select('custom_commission_rate')
            .eq('id', partnerId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const guestServiceFeePercent = parsePercent(
      general?.guestServiceFeePercent,
      DEFAULT_GUEST_SERVICE_FEE_PERCENT
    );
    const insuranceFundPercent = parsePercent(
      general?.insuranceFundPercent,
      DEFAULT_INSURANCE_FUND_PERCENT
    );
    const hostFromGeneral = parsePercent(
      general?.hostCommissionPercent,
      DEFAULT_HOST_COMMISSION_PERCENT
    );
    const hostFromPartner = parsePercent(
      partnerRes?.data?.custom_commission_rate,
      hostFromGeneral
    );
    const hostCommissionPercent =
      partnerRes?.data?.custom_commission_rate != null ? hostFromPartner : hostFromGeneral;

    return {
      guestServiceFeePercent,
      hostCommissionPercent,
      insuranceFundPercent,
    };
  }

  static async calculateFeeSplit(subtotalThb, partnerId = null) {
    const subtotal = Math.max(0, Math.round(Number(subtotalThb) || 0));
    const policy = await this.getFeePolicy(partnerId);
    const guestServiceFeeThb = Math.round(subtotal * (policy.guestServiceFeePercent / 100));
    const hostCommissionThb = Math.round(subtotal * (policy.hostCommissionPercent / 100));
    const partnerEarningsThb = Math.max(0, subtotal - hostCommissionThb);
    const platformGrossRevenueThb = guestServiceFeeThb + hostCommissionThb;
    const insuranceReserveThb = Math.round(
      platformGrossRevenueThb * (policy.insuranceFundPercent / 100)
    );

    return {
      subtotalThb: subtotal,
      guestServiceFeePercent: policy.guestServiceFeePercent,
      guestServiceFeeThb,
      hostCommissionRate: policy.hostCommissionPercent,
      hostCommissionThb,
      partnerEarningsThb,
      platformGrossRevenueThb,
      insuranceFundPercent: policy.insuranceFundPercent,
      insuranceReserveThb,
      guestPayableThb: subtotal + guestServiceFeeThb,
    };
  }

  
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
  static async calculateBookingPrice(listingId, checkIn, checkOut, basePriceOverride = null, options = {}) {
    const checkInStr = toListingDate(checkIn);
    const checkOutStr = toListingDate(checkOut);
    if (!checkInStr || !checkOutStr || checkInStr >= checkOutStr) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }

    const listing = await this.getListingWithSeasonalPricing(listingId);
    if (!listing) {
      return { error: 'Listing not found', nights: 0, totalPrice: 0 };
    }
    const listingCategorySlug = String(options?.listingCategorySlug || '');
    const isTour = isTourCategorySlug(listingCategorySlug);
    const guestsCountRaw = Number(options?.guestsCount);
    const guestsCount = Math.max(1, Number.isFinite(guestsCountRaw) ? Math.floor(guestsCountRaw) : 1);
    if (isTour && guestsCount < 1) {
      return { error: 'Tours require guestsCount >= 1', nights: 0, totalPrice: 0 };
    }

    const basePrice = basePriceOverride || listing.basePrice;
    const seasonalPricing = listing.seasonalPricing;
    const dbSeasonalPrices = listing.dbSeasonalPrices || [];

    let subtotalBeforeDuration = 0;
    const priceBreakdown = [];
    const seasonSummary = {};
    let nights = 0;

    let night = checkInStr;
    while (night < checkOutStr) {
      const dateStr = night;
      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(
        basePrice,
        dateStr,
        seasonalPricing,
        dbSeasonalPrices
      );

      subtotalBeforeDuration += dailyPrice;
      priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel });
      nights++;

      if (!seasonSummary[seasonLabel]) {
        seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice };
      }
      seasonSummary[seasonLabel].nights++;
      seasonSummary[seasonLabel].subtotal += dailyPrice;

      night = addListingDays(night, 1);
    }

    if (nights <= 0) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }

    const dur = applyDurationDiscountToSubtotal(subtotalBeforeDuration, nights, listing.metadata);
    const partyMultiplier = isTour ? guestsCount : 1;
    const totalOriginal = Math.round(dur.originalPrice * partyMultiplier);
    const totalDiscounted = Math.round(dur.discountedPrice * partyMultiplier);
    const totalDurationDiscountAmount = Math.round(dur.durationDiscountAmount * partyMultiplier);

    return {
      nights,
      /** Subtotal from nightly rates (seasonal-aware), before duration % off */
      originalPrice: totalOriginal,
      /** After duration ladder discount (before promo codes) */
      discountedPrice: totalDiscounted,
      totalPrice: totalDiscounted,
      durationDiscountPercent: dur.durationDiscountPercent,
      durationDiscountAmount: totalDurationDiscountAmount,
      durationDiscountTiers: dur.durationDiscountTiers,
      durationDiscountMinNights: dur.durationDiscountMinNights,
      durationDiscountSourceKey: dur.durationDiscountSourceKey,
      guestsCount,
      partyMultiplier,
      basePrice,
      averageNightlyRate: Math.round(subtotalBeforeDuration / nights),
      averageNightlyAfterDiscount: Math.round(totalDiscounted / nights),
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
    metadataForDiscounts = null,
    syncOptions = null,
  ) {
    const checkInStr = toListingDate(checkIn);
    const checkOutStr = toListingDate(checkOut);
    if (!checkInStr || !checkOutStr || checkInStr >= checkOutStr) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }

    const opts = syncOptions && typeof syncOptions === 'object' ? syncOptions : {};
    const listingCategorySlug = String(opts.listingCategorySlug || '');
    const isTour = isTourCategorySlug(listingCategorySlug);
    const guestsCountRaw = Number(opts.guestsCount);
    const guestsCount = Math.max(1, Number.isFinite(guestsCountRaw) ? Math.floor(guestsCountRaw) : 1);

    let subtotal = 0;
    const priceBreakdown = [];
    const seasonSummary = {};
    let nights = 0;

    let night = checkInStr;
    while (night < checkOutStr) {
      const dateStr = night;
      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(
        basePrice,
        dateStr,
        seasonalPricing,
        dbSeasonalPrices
      );

      subtotal += dailyPrice;
      priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel });
      nights++;

      if (!seasonSummary[seasonLabel]) {
        seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice };
      }
      seasonSummary[seasonLabel].nights++;
      seasonSummary[seasonLabel].subtotal += dailyPrice;

      night = addListingDays(night, 1);
    }

    if (nights <= 0) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }

    const dur = applyDurationDiscountToSubtotal(subtotal, nights, metadataForDiscounts);
    const partyMultiplier = isTour ? guestsCount : 1;
    const totalOriginal = Math.round(dur.originalPrice * partyMultiplier);
    const totalDiscounted = Math.round(dur.discountedPrice * partyMultiplier);
    const totalDurationDiscountAmount = Math.round(dur.durationDiscountAmount * partyMultiplier);

    return {
      nights,
      originalPrice: totalOriginal,
      discountedPrice: totalDiscounted,
      totalPrice: totalDiscounted,
      durationDiscountPercent: dur.durationDiscountPercent,
      durationDiscountAmount: totalDurationDiscountAmount,
      durationDiscountMinNights: dur.durationDiscountMinNights,
      durationDiscountSourceKey: dur.durationDiscountSourceKey,
      basePrice,
      averageNightlyRate: Math.round(subtotal / nights),
      averageNightlyAfterDiscount: Math.round(totalDiscounted / nights),
      priceBreakdown,
      seasonSummary,
      guestsCount,
      partyMultiplier,
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
    listingCategorySlug = '',
    guestsCount = 1,
  }) {
    const calc = this.calculateBookingPriceSync(
      basePriceThb,
      checkIn,
      checkOut,
      seasonalPricing || [],
      dbSeasonalPrices || [],
      metadata || null,
      { listingCategorySlug, guestsCount },
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
      durationDiscountMinNights: calc.durationDiscountMinNights,
      durationDiscountSourceKey: calc.durationDiscountSourceKey,
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
   * Backward-compatible wrapper around fee split policy.
   * commissionRate = host commission rate (%),
   * commissionThb = guest service fee THB (kept in existing DB field),
   * partnerEarnings = subtotal minus host commission.
   */
  static async calculateCommission(priceThb, partnerId, _systemSettings = null) {
    const feeSplit = await this.calculateFeeSplit(priceThb, partnerId);
    const commissionRate = feeSplit.hostCommissionRate;
    const commissionThb = feeSplit.guestServiceFeeThb;
    const partnerEarnings = feeSplit.partnerEarningsThb;

    return {
      commissionRate,
      commissionThb: Math.round(commissionThb),
      partnerEarnings: Math.round(partnerEarnings),
      priceThb: Math.round(Number(priceThb) || 0),
      hostCommissionThb: feeSplit.hostCommissionThb,
      guestServiceFeePercent: feeSplit.guestServiceFeePercent,
      guestServiceFeeThb: feeSplit.guestServiceFeeThb,
      insuranceFundPercent: feeSplit.insuranceFundPercent,
      insuranceReserveThb: feeSplit.insuranceReserveThb,
      platformGrossRevenueThb: feeSplit.platformGrossRevenueThb,
      guestPayableThb: feeSplit.guestPayableThb,
    };
  }
  
  /**
   * Validate and apply promo code.
   * @param {string} code
   * @param {number} bookingAmount — субтотал до промо (THB)
   * @param {{ listingOwnerId?: string | null }} [ctx] — owner_id листинга; обязателен для партнёрских кодов
   */
  static async validatePromoCode(code, bookingAmount, ctx = {}) {
    const { data: promo, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();
    
    if (error || !promo) {
      return { valid: false, error: 'Invalid promo code' };
    }

    const ownerType = String(promo.created_by_type || 'PLATFORM').toUpperCase();
    if (ownerType === 'PARTNER') {
      const pid = promo.partner_id ? String(promo.partner_id) : '';
      if (!pid) {
        return { valid: false, error: 'Invalid promo code' };
      }
      const listingOwner = ctx.listingOwnerId != null && ctx.listingOwnerId !== '' ? String(ctx.listingOwnerId) : '';
      if (!listingOwner) {
        return { valid: false, error: 'This promo applies to a specific listing — open checkout from the listing' };
      }
      if (listingOwner !== pid) {
        return { valid: false, error: 'This promo code is not valid for this listing' };
      }
    }
    
    // Check expiration
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      return { valid: false, error: 'Promo code has expired' };
    }
    
    // Check minimum amount
    if (promo.min_amount && bookingAmount < parseFloat(promo.min_amount)) {
      return { valid: false, error: `Minimum booking amount is ${promo.min_amount} THB` };
    }
    
    // Check max uses (null max_uses = без лимита)
    if (promo.max_uses != null && Number(promo.current_uses) >= Number(promo.max_uses)) {
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
   * Get exchange rates (THB за 1 единицу валюты) — единый канон с витриной: {@link CurrencyService.getDisplayRateMap}.
   */
  static async getExchangeRates() {
    const { getDisplayRateMap } = await import('@/lib/services/currency.service.js')
    const map = await getDisplayRateMap()
    const symbol = { THB: '฿', RUB: '₽', USD: '$', USDT: '₮', EUR: '€', GBP: '£', CNY: '¥' }
    return Object.entries(map)
      .filter(([, v]) => Number.isFinite(Number(v)) && Number(v) > 0)
      .map(([code, rateToThb]) => ({
        code,
        rateToThb: Number(rateToThb),
        symbol: symbol[code] || code,
      }))
  }

  /**
   * Raw rate map without retail spread (for settlement/accounting).
   * @returns {Promise<Record<string, number>>}
   */
  static async getRawRateMap() {
    const { getDisplayRateMap } = await import('@/lib/services/currency.service.js')
    return getDisplayRateMap({ applyRetailMarkup: false })
  }

  /**
   * Checkout rate for guest payment currency.
   * Rule:
   * - if guest currency equals listing base currency => no markup (multiplier 1.0)
   * - else apply general.chatInvoiceRateMultiplier spread.
   *
   * @param {string} paymentCurrency
   * @param {string} listingBaseCurrency
   * @returns {Promise<number>} THB per 1 unit of payment currency
   */
  static async getCheckoutRateToThb(paymentCurrency = 'THB', listingBaseCurrency = 'THB') {
    const pay = normalizeCurrencyCode(paymentCurrency)
    const base = normalizeCurrencyCode(listingBaseCurrency)
    if (pay === 'THB') return 1

    const rawMap = await this.getRawRateMap()
    const rawRate = Number(rawMap?.[pay])
    if (!Number.isFinite(rawRate) || rawRate <= 0) return 1

    if (pay === base) return rawRate

    const multiplier = await resolveChatInvoiceRateMultiplier()
    const safeMultiplier = Number(multiplier)
    if (!Number.isFinite(safeMultiplier) || safeMultiplier <= 1) return rawRate
    // Same rule as display spread: lower rate_to_thb => guest pays more units.
    return rawRate / safeMultiplier
  }

  /**
   * Convert THB amount using raw direct rates (no retail spread).
   * @param {number} amountThb
   * @param {string} targetCurrency
   * @param {Record<string, number>} [rawRateMap]
   * @returns {Promise<number>}
   */
  static async convertThbToCurrencyRaw(amountThb, targetCurrency = 'THB', rawRateMap = null) {
    const target = normalizeCurrencyCode(targetCurrency)
    const thb = Number(amountThb)
    if (!Number.isFinite(thb)) return 0
    if (target === 'THB') return thb
    const map = rawRateMap || (await this.getRawRateMap())
    const rate = Number(map?.[target])
    if (!Number.isFinite(rate) || rate <= 0) return thb
    return thb / rate
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
