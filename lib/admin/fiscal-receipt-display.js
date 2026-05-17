/**
 * Human-readable fiscal receipt preview for admin sandbox (54-FZ).
 */

import { getFiscalTransitSupplierInfo, getFiscalRuPlatformInfo } from '@/lib/pricing-engine/fiscal-config.js'

/**
 * @param {object} payload — from toFiscalKassaPayload
 * @param {object} [breakdown]
 */
export function buildFiscalReceiptDisplay(payload, breakdown = null) {
  const transit = getFiscalTransitSupplierInfo()
  const ruPlatform = getFiscalRuPlatformInfo()
  const items = Array.isArray(payload?.items) ? payload.items : []

  const lines = items.map((item) => ({
    name: item.name,
    sumThb: item.sum ?? item.price,
    agentSign: item.agent_sign === 5 ? '5 (агент)' : item.agent_sign ?? '—',
    supplierInn: item.supplier_info?.inn || '—',
    supplierName: item.supplier_info?.name || '—',
  }))

  const b = breakdown || {}
  return {
    title: 'Муляж фискального чека по 54-ФЗ',
    ruAgentInn: transit.inn || ruPlatform.inn || '(не задан)',
    agentSignLabel: 'Признак агента: 5 (платёж принимается агентом)',
    tag1224KgSupplier: transit.name || '(FISCAL_KG_SUPPLIER_NAME)',
    paymentMethod: 'Полный расчёт (FFD, способ расчёта 4)',
    commissionSplit: {
      ruIpThb: Math.round(Number(b.ru_fee_thb) || 0),
      krItThb: Math.round(Number(b.kr_fee_thb) || 0),
      fxSpreadThb: Math.round(Number(b.fx_markup_thb) || 0),
      partnerTransitThb: Math.round(Number(b.total_partner_netto_thb) || 0),
      guestTotalThb: Math.round(Number(b.total_guest_payable_rounded_thb) || 0),
    },
    lines,
    rawPayload: payload,
  }
}
