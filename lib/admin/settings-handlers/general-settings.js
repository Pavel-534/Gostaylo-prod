import { platformDefaultChatInvoiceRateMultiplier } from '@/lib/services/currency-last-resort'

import { resolveHostCommissionPercentFromGeneral } from '@/lib/services/pricing/pricing-fee-policy.js'



function parseNum(v) {

  const n = parseFloat(v)

  return Number.isFinite(n) ? n : NaN

}



function pickHostPercent(body, prev = {}) {

  const fromDedicated = parseNum(body?.hostCommissionPercent)

  if (Number.isFinite(fromDedicated) && fromDedicated >= 0 && fromDedicated <= 100) {

    return fromDedicated

  }

  const fromLegacy = parseNum(body?.defaultCommissionRate)

  if (Number.isFinite(fromLegacy) && fromLegacy >= 0 && fromLegacy <= 100) {

    return fromLegacy

  }

  return resolveHostCommissionPercentFromGeneral(prev)

}



export async function buildGeneralSettingsPatch(body, prev = {}) {

  const resolvedHost = pickHostPercent(body, prev)



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

    hostCommissionPercent: resolvedHost,

    defaultCommissionRate: resolvedHost,

    chatInvoiceRateMultiplier: resolvedChatMult,

    maintenanceMode: !!body?.maintenanceMode,

    heroTitle: body?.heroTitle || '',

    heroSubtitle: body?.heroSubtitle || '',

    sitePhone: typeof body?.sitePhone === 'string' ? body.sitePhone.trim() : '',

  }

}

