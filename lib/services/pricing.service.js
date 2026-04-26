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
import {
  checkApplicabilityCached,
  calculatePromoDiscountAmount,
} from '@/lib/promo/promo-engine';
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js';
import { toListingDate, addListingDays } from '@/lib/listing-date';
import { applyDurationDiscountToSubtotal } from '@/lib/listing/duration-discount-tiers.js';
import {
  calculateDailyPrice as syncCalculateDailyPrice,
  calculateBookingPriceSync as syncCalculateBookingPriceSync,
  calculatePrice as syncCalculateListingPrice,
  isTourCategorySlug,
} from '@/lib/listing/listing-price-sync.js';

export {
  parseDurationDiscountTiers,
  computeBestDurationDiscountPercent,
  getAppliedDurationDiscountTier,
  applyDurationDiscountToSubtotal,
} from '@/lib/listing/duration-discount-tiers.js';

function normalizeCurrencyCode(currency) {
  return String(currency || 'THB').toUpperCase().trim();
}

function parsePercent(raw, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(100, n);
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
      PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent
    );
    const insuranceFundPercent = parsePercent(
      general?.insuranceFundPercent,
      PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent
    );
    const hostFromGeneral = parsePercent(
      general?.hostCommissionPercent,
      PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral
    );
    const hostFromPartner = parsePercent(
      partnerRes?.data?.custom_commission_rate,
      hostFromGeneral
    );
    const hostCommissionPercent =
      partnerRes?.data?.custom_commission_rate != null ? hostFromPartner : hostFromGeneral;

    // guestServiceFeePercent: % от субтотала — сервисный сбор с гостя (не доля хоста).
    // hostCommissionPercent: % от субтотала — комиссия платформы с партнёра.
    // insuranceFundPercent: % резерва от валовой маржи платформы (guest+host THB), не комиссия хоста.
    /** Stage 56.0 — VAT/sales tax % on accommodation subtotal (default 0; `system_settings.general.taxRatePercent`). */
    const taxRatePercent = parsePercent(general?.taxRatePercent, 0);
    return {
      guestServiceFeePercent,
      hostCommissionPercent,
      insuranceFundPercent,
      taxRatePercent,
    };
  }

  /**
   * Batch fee policies for search/catalog pricing. Keeps formulas identical to `getFeePolicy`
   * without one `system_settings` + one `profiles` query per listing.
   * @param {string[]} partnerIds
   * @returns {Promise<Map<string, { guestServiceFeePercent: number, hostCommissionPercent: number, insuranceFundPercent: number, taxRatePercent: number }>>}
   */
  static async getFeePolicyBatch(partnerIds = []) {
    const ids = [...new Set((partnerIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    const general = await this.getGeneralPricingSettings();
    const guestServiceFeePercent = parsePercent(
      general?.guestServiceFeePercent,
      PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent
    );
    const insuranceFundPercent = parsePercent(
      general?.insuranceFundPercent,
      PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent
    );
    const hostFromGeneral = parsePercent(
      general?.hostCommissionPercent,
      PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral
    );

    const taxRatePercent = parsePercent(general?.taxRatePercent, 0);

    const policies = new Map();
    for (const id of ids) {
      policies.set(id, {
        guestServiceFeePercent,
        hostCommissionPercent: hostFromGeneral,
        insuranceFundPercent,
        taxRatePercent,
      });
    }

    if (ids.length > 0) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, custom_commission_rate')
        .in('id', ids);
      for (const row of data || []) {
        const id = String(row?.id || '').trim();
        if (!id || !policies.has(id)) continue;
        const custom = row?.custom_commission_rate;
        policies.set(id, {
          guestServiceFeePercent,
          hostCommissionPercent:
            custom != null ? parsePercent(custom, hostFromGeneral) : hostFromGeneral,
          insuranceFundPercent,
          taxRatePercent,
        });
      }
    }

    return policies;
  }

  static calculateFeeSplitWithPolicy(subtotalThb, policy) {
    const subtotal = Math.max(0, Math.round(Number(subtotalThb) || 0));
    const p = policy || {
      guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
      hostCommissionPercent: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
      insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
      taxRatePercent: 0,
    };
    const taxRatePercent = parsePercent(p.taxRatePercent, 0);
    /** Stage 56.0 — tax on accommodation subtotal (THB); default 0. */
    const taxAmountThb = Math.round(subtotal * (taxRatePercent / 100));
    const guestServiceFeeThb = Math.round(subtotal * (p.guestServiceFeePercent / 100));
    const hostCommissionThb = Math.round(subtotal * (p.hostCommissionPercent / 100));
    const partnerEarningsThb = Math.max(0, subtotal - hostCommissionThb);
    /** Валовая маржа платформы по брони (THB), от неё считается резервный фонд — не субтотал листинга. */
    const platformGrossRevenueThb = guestServiceFeeThb + hostCommissionThb;
    /** Резервный (страховой) фонд в THB: `insuranceFundPercent` от `platformGrossRevenueThb`. */
    const insuranceReserveThb = Math.round(
      platformGrossRevenueThb * (p.insuranceFundPercent / 100)
    );

    return {
      subtotalThb: subtotal,
      guestServiceFeePercent: p.guestServiceFeePercent,
      guestServiceFeeThb,
      hostCommissionRate: p.hostCommissionPercent,
      hostCommissionThb,
      partnerEarningsThb,
      platformGrossRevenueThb,
      /** % резерва от `platformGrossRevenueThb` (не комиссия хоста). */
      insuranceFundPercent: p.insuranceFundPercent,
      insuranceReserveThb,
      taxRatePercent,
      taxAmountThb,
      guestPayableThb: subtotal + taxAmountThb + guestServiceFeeThb,
    };
  }

  static async calculateFeeSplit(subtotalThb, partnerId = null) {
    const policy = await this.getFeePolicy(partnerId);
    return this.calculateFeeSplitWithPolicy(subtotalThb, policy);
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
    return syncCalculateDailyPrice(basePrice, dateStr, seasonalPricing, dbSeasonalPrices);
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
      const { dailyPrice, seasonLabel } = syncCalculateDailyPrice(
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

    const generalTax = await this.getGeneralPricingSettings();
    const taxRate = parsePercent(generalTax?.taxRatePercent, 0);
    const taxAmountThb = Math.round(totalDiscounted * (taxRate / 100));

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
      /** Stage 56.0 — same basis as fee split (`taxRatePercent` / `taxAmountThb` on accommodation line). */
      taxRate,
      taxAmountThb,
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
    return syncCalculateBookingPriceSync(
      basePrice,
      checkIn,
      checkOut,
      seasonalPricing,
      dbSeasonalPrices,
      metadataForDiscounts,
      syncOptions,
    );
  }

  /**
   * Wrapper method for compatibility with Premium Listing Page
   * Accepts currency and exchange rates for multi-currency support
   */
  static calculatePrice(opts) {
    return syncCalculateListingPrice(opts);
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
      taxRatePercent: feeSplit.taxRatePercent ?? 0,
      taxAmountThb: feeSplit.taxAmountThb ?? 0,
    };
  }
  
  /**
   * Validate and apply promo code.
   * @param {string} code
   * @param {number} bookingAmount — субтотал до промо (THB)
   * @param {{ listingOwnerId?: string | null, listingId?: string | null }} [ctx] — owner_id листинга; listingId для allowlist (Stage 33)
   */
  static async validatePromoCode(code, bookingAmount, ctx = {}) {
    const normalizedCode = String(code || '').trim().toUpperCase()
    const { data: promo, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .single();
    
    if (error || !promo) {
      return { valid: false, error: 'Invalid promo code' };
    }

    const applicability = checkApplicabilityCached(promo, {
      mode: 'booking',
      listingId: ctx.listingId ?? null,
      listingOwnerId: ctx.listingOwnerId ?? null,
    })
    if (!applicability.ok) {
      switch (applicability.reason) {
        case 'LISTING_REQUIRED_FOR_ALLOWLIST':
          return {
            valid: false,
            error: 'This promo applies to selected listings — open checkout from the listing page',
          };
        case 'LISTING_OWNER_REQUIRED':
          return {
            valid: false,
            error: 'This promo applies to a specific listing — open checkout from the listing',
          };
        case 'EXPIRED':
          return { valid: false, error: 'Promo code has expired' };
        case 'USAGE_LIMIT_REACHED':
          return { valid: false, error: 'Promo code usage limit reached' };
        case 'LISTING_NOT_ALLOWED':
        case 'LISTING_OWNER_MISMATCH':
          return { valid: false, error: 'This promo code is not valid for this listing' };
        default:
          return { valid: false, error: 'Invalid promo code' };
      }
    }

    // Check minimum amount
    if (promo.min_amount && bookingAmount < parseFloat(promo.min_amount)) {
      return { valid: false, error: `Minimum booking amount is ${promo.min_amount} THB` };
    }

    const discountAmount = calculatePromoDiscountAmount(promo, bookingAmount);

    const flashSale = promo.is_flash_sale === true;
    let promoEndsAt = null;
    let secondsRemaining = null;
    if (flashSale && promo.valid_until) {
      const endMs = new Date(promo.valid_until).getTime();
      if (Number.isFinite(endMs)) {
        promoEndsAt = new Date(promo.valid_until).toISOString();
        secondsRemaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      }
    }

    return {
      valid: true,
      code: promo.code,
      type: promo.promo_type,
      value: parseFloat(promo.value),
      discountAmount,
      newTotal: bookingAmount - discountAmount,
      flashSale,
      promoEndsAt: flashSale ? promoEndsAt : null,
      secondsRemaining: flashSale ? secondsRemaining : null,
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

    const { resolveChatInvoiceRateMultiplier } = await import('@/lib/services/currency.service.js')
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
