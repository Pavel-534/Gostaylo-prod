import { platformDefaultChatInvoiceRateMultiplier } from '@/lib/services/currency-last-resort'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'

function parseNum(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : NaN
}

export async function buildGeneralSettingsPatch(body, prev = {}) {
  const parsedPut = parseNum(body?.defaultCommissionRate)
  const resolvedComm =
    Number.isFinite(parsedPut) && parsedPut >= 0 ? parsedPut : await resolveDefaultCommissionPercent()

  const parsedChat =
    body?.chatInvoiceRateMultiplier != null && body?.chatInvoiceRateMultiplier !== ''
      ? parseNum(body.chatInvoiceRateMultiplier)
      : NaN
  const existingChat = parseNum(prev?.chatInvoiceRateMultiplier)
  const resolvedChatMult =
    Number.isFinite(parsedChat) && parsedChat >= 1 && parsedChat <= 1.5
      ? parsedChat
      : Number.isFinite(existingChat) && existingChat >= 1 && existingChat <= 1.5
        ? existingChat
        : platformDefaultChatInvoiceRateMultiplier()

  return {
    defaultCommissionRate: resolvedComm,
    chatInvoiceRateMultiplier: resolvedChatMult,
    maintenanceMode: !!body?.maintenanceMode,
    heroTitle: body?.heroTitle || '',
    heroSubtitle: body?.heroSubtitle || '',
    sitePhone: typeof body?.sitePhone === 'string' ? body.sitePhone.trim() : '',
  }
}
