/**
 * GoStayLo - Promo Code Validation API (v2)
 * POST /api/v2/promo-codes/validate — ошибки: `error_code` (`PROMO_*`), без локализованного `error`.
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { PricingService } from '@/lib/services/pricing.service';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimitCheck } from '@/lib/rate-limit';
import { PromoErrorCode, promoErrorJson } from '@/lib/promo/promo-error-codes';

export async function POST(request) {
  try {
    const limited = await rateLimitCheck(request, 'promo_validate');
    if (limited) {
      return promoErrorJson(PromoErrorCode.PROMO_RATE_LIMITED, limited.status, {
        retryAfter: limited.body.retryAfter,
      });
    }

    const body = await request.json();
    const { code, amount, bookingAmount, listingId } = body;

    const rawCode = code != null ? String(code).trim() : '';
    if (!rawCode) {
      return promoErrorJson(PromoErrorCode.PROMO_CODE_REQUIRED, 400);
    }

    const rawAmount = amount ?? bookingAmount;
    const bookingAmountNum = parseFloat(rawAmount) || 0;

    let listingOwnerId = null;
    const lid = listingId != null && listingId !== '' ? String(listingId).trim() : '';
    if (lid && supabaseAdmin) {
      const { data: listingRow } = await supabaseAdmin
        .from('listings')
        .select('owner_id')
        .eq('id', lid)
        .maybeSingle();
      listingOwnerId = listingRow?.owner_id ?? null;
    }

    const result = await PricingService.validatePromoCode(rawCode, bookingAmountNum, {
      listingOwnerId,
      listingId: lid || null,
    });

    if (!result.valid) {
      const extra = {};
      if (result.min_amount_thb != null) extra.min_amount_thb = result.min_amount_thb;
      return promoErrorJson(result.error_code || PromoErrorCode.PROMO_INVALID, 400, extra);
    }

    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        code: result.code,
        type: result.type,
        value: result.value,
        discountAmount: result.discountAmount,
        newTotal: result.newTotal,
        flashSale: Boolean(result.flashSale),
        promoEndsAt: result.promoEndsAt ?? null,
        secondsRemaining:
          result.secondsRemaining != null && Number.isFinite(Number(result.secondsRemaining))
            ? Number(result.secondsRemaining)
            : null,
      },
    });
  } catch (error) {
    console.error('[PROMO VALIDATION ERROR]', error);
    return promoErrorJson(PromoErrorCode.PROMO_INTERNAL, 500);
  }
}
