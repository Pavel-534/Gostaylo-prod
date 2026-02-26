/**
 * FunnyRent 2.1 - Pricing Service
 * Handles seasonal pricing, commission calculations, and discounts
 */

import { supabaseAdmin } from '@/lib/supabase';

export class PricingService {
  
  /**
   * Get seasonal price for a listing on specific dates
   */
  static async getSeasonalPrice(listingId, checkIn, checkOut) {
    const { data: seasonalPrices } = await supabaseAdmin
      .from('seasonal_prices')
      .select('*')
      .eq('listing_id', listingId)
      .lte('start_date', checkIn)
      .gte('end_date', checkOut)
      .order('start_date', { ascending: true });
    
    return seasonalPrices || [];
  }
  
  /**
   * Calculate total price for a booking
   */
  static async calculateBookingPrice(listingId, checkIn, checkOut, basePrice) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }
    
    // Get seasonal prices for the listing
    const { data: seasonalPrices } = await supabaseAdmin
      .from('seasonal_prices')
      .select('*')
      .eq('listing_id', listingId)
      .order('start_date', { ascending: true });
    
    let totalPrice = 0;
    const priceBreakdown = [];
    
    // Calculate price for each night
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Find applicable seasonal price
      let dailyPrice = basePrice;
      let seasonLabel = 'Base';
      
      if (seasonalPrices) {
        for (const sp of seasonalPrices) {
          if (dateStr >= sp.start_date && dateStr <= sp.end_date) {
            dailyPrice = parseFloat(sp.price_daily);
            seasonLabel = sp.label || sp.season_type;
            break;
          }
        }
      }
      
      totalPrice += dailyPrice;
      priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel });
    }
    
    return {
      nights,
      totalPrice,
      averageNightlyRate: totalPrice / nights,
      priceBreakdown
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
