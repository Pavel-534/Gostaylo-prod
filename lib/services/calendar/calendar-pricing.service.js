/**
 * Calendar-facing pricing / promos (Stage 70.5 — calendar-pricing layer).
 */

import { PricingService } from '@/lib/services/pricing.service';
import {
  checkApplicabilityCached,
  calculatePromoDiscountAmount,
} from '@/lib/promo/promo-engine';

export function pickBestCatalogPromoForPrice({ promoRows, listing, subtotalThb }) {
  const amount = Math.max(0, Math.round(Number(subtotalThb) || 0));
  if (amount <= 0 || !Array.isArray(promoRows) || promoRows.length === 0) return null;
  const listingId = String(listing?.id || '').trim();
  const ownerId = String(listing?.owner_id || listing?.ownerId || '').trim();
  let best = null;

  for (const promo of promoRows) {
    const applicable = checkApplicabilityCached(promo, {
      mode: 'catalog',
      listingId,
      listingOwnerId: ownerId,
      restrictPlatformGlobal: true,
    });
    if (!applicable.ok) continue;
    const discountAmount = calculatePromoDiscountAmount(promo, amount);
    if (discountAmount <= 0) continue;
    if (!best || discountAmount > best.discountAmount) {
      best = {
        code: String(promo.code || '').trim().toUpperCase(),
        discountAmount,
        isFlashSale: promo.is_flash_sale === true,
      };
    }
  }

  return best;
}

export function calculateDailyPrice(basePrice, dateStr, seasonalPrices, metadataSeasonalPricing) {
  return PricingService.calculateDailyPrice(
    basePrice,
    dateStr,
    metadataSeasonalPricing,
    seasonalPrices,
  );
}

export function resolveMarketingPromoForDay({
  promos,
  listingId,
  listingOwnerId,
  date,
  baseSeasonPrice,
}) {
  const amount = Math.max(0, Math.round(Number(baseSeasonPrice) || 0));
  if (amount <= 0 || !Array.isArray(promos) || promos.length === 0) return null;

  let best = null;
  for (const promo of promos) {
    const applicable = checkApplicabilityCached(promo, {
      mode: 'calendar',
      listingId: listingId || null,
      listingOwnerId: listingOwnerId || null,
      targetDate: date,
      requireTargetDateCoverage: true,
    });
    if (!applicable.ok) continue;
    const discountAmount = calculatePromoDiscountAmount(promo, amount);
    if (discountAmount <= 0) continue;

    if (!best || discountAmount > best.discountAmount) {
      best = {
        code: String(promo.code || '').toUpperCase(),
        promoType: String(promo.promo_type || '').toUpperCase(),
        promoValue: Number(promo.value) || 0,
        discountAmount,
        isFlashSale: promo.is_flash_sale === true,
        validUntil: promo.valid_until || null,
      };
    }
  }

  if (!best) return null;
  return {
    ...best,
    baseSeasonPrice: amount,
    guestPrice: Math.max(0, amount - best.discountAmount),
  };
}

export function getSeasonLabel(seasonType) {
  const labels = {
    LOW: 'Низкий сезон',
    NORMAL: 'Обычный',
    HIGH: 'Высокий сезон',
    PEAK: 'Пик сезона',
  };
  return labels[seasonType] || 'Base';
}

export function mapMarketingPromoToPartnerCell(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    code: p.code,
    discountAmount: p.discountAmount,
    baseSeasonPrice: p.baseSeasonPrice,
    guestPrice: p.guestPrice,
    isFlashSale: p.isFlashSale === true,
    promoType: p.promoType,
    promoValue: p.promoValue,
    validUntil: p.validUntil ?? null,
  };
}
