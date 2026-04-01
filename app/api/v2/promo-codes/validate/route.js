/**
 * GoStayLo - Promo Code Validation API (v2)
 * POST /api/v2/promo-codes/validate - Validate a promo code
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { PricingService } from '@/lib/services/pricing.service';

export async function POST(request) {
  try {
    const body = await request.json();
    const { code, amount } = body;
    
    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Promo code is required' 
      }, { status: 400 });
    }
    
    const bookingAmount = parseFloat(amount) || 0;
    
    const result = await PricingService.validatePromoCode(code, bookingAmount);
    
    if (!result.valid) {
      return NextResponse.json({ 
        success: false, 
        valid: false,
        error: result.error 
      }, { status: 400 });
    }
    
    console.log(`[PROMO] Code validated: ${code} - Discount: ${result.discountAmount} THB`);
    
    return NextResponse.json({ 
      success: true, 
      valid: true,
      data: {
        code: result.code,
        type: result.type,
        value: result.value,
        discountAmount: result.discountAmount,
        newTotal: result.newTotal
      }
    });
    
  } catch (error) {
    console.error('[PROMO VALIDATION ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
