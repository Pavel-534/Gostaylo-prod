/**
 * Gostaylo - Pricing Service
 * Handles seasonal pricing, commission calculations, and discounts
 * 
 * IMPORTANT: Seasonal pricing is stored in listings.metadata.seasonal_pricing (JSONB)
 * Schema: [{ id, name, startDate, endDate, priceMultiplier }]
 */

import { supabaseAdmin } from '@/lib/supabase';

export class PricingService {
  
  /**
   * Get listing with seasonal pricing from metadata
   */
  static async getListingWithSeasonalPricing(listingId) {
    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .select('id, base_price_thb, metadata')
      .eq('id', listingId)
      .single();
    
    if (error || !listing) {
      return null;
    }
    
    return {
      id: listing.id,
      basePrice: parseFloat(listing.base_price_thb),
      seasonalPricing: listing.metadata?.seasonal_pricing || []
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
    
    // Filter seasonal prices that overlap with the booking dates
    return listing.seasonalPricing.filter(season => {
      const seasonStart = new Date(season.startDate);
      const seasonEnd = new Date(season.endDate);
      // Check if date ranges overlap
      return seasonStart <= checkOutDate && seasonEnd >= checkInDate;
    });
  }
  
  /**
   * Calculate price for a specific date based on seasonal pricing
   * Uses priceMultiplier from metadata (e.g., 1.3 = +30%)
   */
  static calculateDailyPrice(basePrice, dateStr, seasonalPricing) {
    let dailyPrice = basePrice;
    let seasonLabel = 'Base';
    
    if (seasonalPricing && seasonalPricing.length > 0) {
      for (const season of seasonalPricing) {
        const seasonStart = season.startDate;
        const seasonEnd = season.endDate;
        
        if (dateStr >= seasonStart && dateStr <= seasonEnd) {
          // Apply price multiplier (e.g., 1.3 = +30%, 0.8 = -20%)
          const multiplier = parseFloat(season.priceMultiplier) || 1.0;
          dailyPrice = Math.round(basePrice * multiplier);
          seasonLabel = season.name || 'Season';
          break;
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
    
    // Get listing with seasonal pricing from metadata
    const listing = await this.getListingWithSeasonalPricing(listingId);
    if (!listing) {
      return { error: 'Listing not found', nights: 0, totalPrice: 0 };
    }
    
    const basePrice = basePriceOverride || listing.basePrice;
    const seasonalPricing = listing.seasonalPricing;
    
    let totalPrice = 0;
    const priceBreakdown = [];
    const seasonSummary = {};
    
    // Calculate price for each night
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(basePrice, dateStr, seasonalPricing);
      
      totalPrice += dailyPrice;
      priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel });
      
      // Track season summary for UI display
      if (!seasonSummary[seasonLabel]) {
        seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice };
      }
      seasonSummary[seasonLabel].nights++;
      seasonSummary[seasonLabel].subtotal += dailyPrice;
    }
    
    return {
      nights,
      totalPrice,
      basePrice,
      averageNightlyRate: Math.round(totalPrice / nights),
      priceBreakdown,
      seasonSummary
    };
  }
  
  /**
   * Client-side calculation (no DB call) - for real-time UI updates
   * Use when you already have the listing data with seasonal pricing
   */
  static calculateBookingPriceSync(basePrice, checkIn, checkOut, seasonalPricing = []) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0 || isNaN(nights)) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }
    
    let totalPrice = 0;
    const priceBreakdown = [];
    const seasonSummary = {};
    
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(basePrice, dateStr, seasonalPricing);
      
      totalPrice += dailyPrice;
      priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel });
      
      if (!seasonSummary[seasonLabel]) {
        seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice };
      }
      seasonSummary[seasonLabel].nights++;
      seasonSummary[seasonLabel].subtotal += dailyPrice;
    }
    
    return {
      nights,
      totalPrice,
      basePrice,
      averageNightlyRate: Math.round(totalPrice / nights),
      priceBreakdown,
      seasonSummary
    };
  }
  
  /**
   * Calculate commission for a booking
   */
  static async calculateCommission(priceThb, partnerId, systemSettings = null) {
    // Get partner's custom commission rate
    const { data: partner } = await supabaseAdmin
      .from('profiles')
      .select('custom_commission_rate')
      .eq('id', partnerId)
      .single();
    
    // Get system default if no custom rate
    let commissionRate = 15; // Default fallback
    
    if (partner?.custom_commission_rate) {
      commissionRate = parseFloat(partner.custom_commission_rate);
    } else if (systemSettings?.defaultCommissionRate) {
      commissionRate = systemSettings.defaultCommissionRate;
    } else {
      // Fetch from system settings
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'general')
        .single();
      
      if (settings?.value?.defaultCommissionRate) {
        commissionRate = settings.value.defaultCommissionRate;
      }
    }
    
    const commissionThb = priceThb * (commissionRate / 100);
    const partnerEarnings = priceThb - commissionThb;
    
    return {
      commissionRate,
      commissionThb,
      partnerEarnings,
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
