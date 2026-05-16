/**
 * Fiscal (54-FZ) supplier tags — Stage 97.0.6
 *
 * Transit (agent_sign=5): `name` = KG ОсОО, `inn` = ИНН РФ (агент).
 * KG IT fee ledger line = IT/support, not royalty.
 */

/**
 * Principal supplier for transit lines (FFD agent_sign = 5).
 * @returns {{ name: string, inn: string, phones: string[] }}
 */
export function getFiscalTransitSupplierInfo() {
  const phonesRaw = String(process.env.FISCAL_KG_SUPPLIER_PHONES || '').trim()
  const phones = phonesRaw
    ? phonesRaw.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
    : []
  return {
    name: String(
      process.env.FISCAL_KG_SUPPLIER_NAME || 'ОсОО «Gostaylo KG Service»',
    ).trim(),
    inn: String(
      process.env.FISCAL_RU_AGENT_INN ||
        process.env.FISCAL_RU_SUPPLIER_INN ||
        process.env.FISCAL_SUPPLIER_INN ||
        '',
    ).trim(),
    phones,
  }
}

/** @deprecated use getFiscalTransitSupplierInfo */
export function getDefaultKgSupplierInfo() {
  return getFiscalTransitSupplierInfo()
}

/**
 * Platform RU entity (direct service lines — 7%, no agent).
 */
export function getFiscalRuPlatformInfo() {
  return {
    name: String(process.env.FISCAL_RU_PLATFORM_NAME || 'Gostaylo RU').trim(),
    inn: String(
      process.env.FISCAL_RU_AGENT_INN ||
        process.env.FISCAL_RU_PLATFORM_INN ||
        '',
    ).trim(),
  }
}

export function isFiscalSandboxEnabled() {
  const v = String(process.env.FISCAL_SANDBOX || '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}
