/**
 * SSOT: активные версии юр. документов (runtime из system_settings.general.legal_versions,
 * fallback — lib/config/legal-terms-version.js). Stage 102.4 — черновики и публикация.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  CURRENT_LEGAL_TERMS_VERSION,
  CURRENT_PARTNER_TERMS_VERSION,
} from '@/lib/config/legal-terms-version'
import { LEGAL_PUBLISHER_STATIC } from '@/lib/config/legal-details.js'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'

const SETTINGS_KEY = 'general'

const DOC_PAGE_PATH = {
  guest: '/legal/public-offer/',
  partner: '/legal/partner-terms/',
}

const FALLBACK = {
  guest: {
    currentVersion: CURRENT_LEGAL_TERMS_VERSION,
    publishedAt: null,
    history: [],
    draft: null,
  },
  partner: {
    currentVersion: CURRENT_PARTNER_TERMS_VERSION,
    publishedAt: null,
    history: [],
    draft: null,
  },
}

function normalizeDocSlice(raw, fallbackVersion) {
  const cur = String(raw?.currentVersion || raw?.current_version || fallbackVersion).trim()
  const history = Array.isArray(raw?.history) ? raw.history : []
  const draft = raw?.draft && typeof raw.draft === 'object' ? raw.draft : null
  return {
    currentVersion: cur || fallbackVersion,
    publishedAt: raw?.publishedAt || raw?.published_at || null,
    history: history.slice(0, 50),
    draft,
  }
}

function nextVersionString(current) {
  const today = new Date().toISOString().slice(0, 10)
  const m = String(current || '').match(/-v(\d+)$/)
  const n = m ? parseInt(m[1], 10) + 1 : 1
  return `${today}-v${n}`
}

async function loadGeneralValue() {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  if (error) {
    console.warn('[LegalVersions] load general', error.message)
    return null
  }
  return data?.value && typeof data.value === 'object' ? data.value : null
}

async function saveGeneralPatch(patchFn) {
  const general = (await loadGeneralValue()) || {}
  const merged = patchFn(general)
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      key: SETTINGS_KEY,
      value: merged,
      updated_at: now,
    },
    { onConflict: 'key' },
  )
  if (error) throw new Error(error.message || 'Failed to save settings')
  return merged
}

function getTextMeta(general) {
  const meta = general?.legal_pages_meta && typeof general.legal_pages_meta === 'object'
    ? general.legal_pages_meta
    : {}
  return {
    guest_offer: {
      textLastUpdated:
        meta.guest_offer?.textLastUpdated ||
        meta.guest?.textLastUpdated ||
        LEGAL_PUBLISHER_STATIC.lastUpdated,
      textUpdatedAt: meta.guest_offer?.textUpdatedAt || meta.guest?.textUpdatedAt || null,
      pagePath: DOC_PAGE_PATH.guest,
    },
    partner_terms: {
      textLastUpdated:
        meta.partner_terms?.textLastUpdated ||
        meta.partner?.textLastUpdated ||
        LEGAL_PUBLISHER_STATIC.lastUpdated,
      textUpdatedAt: meta.partner_terms?.textUpdatedAt || meta.partner?.textUpdatedAt || null,
      pagePath: DOC_PAGE_PATH.partner,
    },
  }
}

export class LegalVersionsService {
  static async getRegistry() {
    const general = await loadGeneralValue()
    const lv = general?.legal_versions
    return {
      guest: normalizeDocSlice(lv?.guest, FALLBACK.guest.currentVersion),
      partner: normalizeDocSlice(lv?.partner, FALLBACK.partner.currentVersion),
      textMeta: getTextMeta(general || {}),
      codeFallback: {
        guest: CURRENT_LEGAL_TERMS_VERSION,
        partner: CURRENT_PARTNER_TERMS_VERSION,
      },
    }
  }

  static async getGuestTermsVersion() {
    const reg = await this.getRegistry()
    return reg.guest.currentVersion
  }

  static async getPartnerTermsVersion() {
    const reg = await this.getRegistry()
    return reg.partner.currentVersion
  }

  /**
   * @param {'guest' | 'partner'} docKey
   * @param {{ changeSummary?: string, textLastUpdated?: string }} payload
   * @param {string | null} [adminId]
   */
  static async createOrUpdateDraft(docKey, payload = {}, adminId = null) {
    if (!['guest', 'partner'].includes(docKey)) {
      return { success: false, error: 'invalid_doc_key' }
    }
    if (!supabaseAdmin) return { success: false, error: 'no_db' }

    const changeSummary = String(payload.changeSummary || '').trim().slice(0, 4000)
    const textLastUpdated = String(payload.textLastUpdated || '').trim().slice(0, 120)
    const now = new Date().toISOString()

    const merged = await saveGeneralPatch((general) => {
      const lv =
        general.legal_versions && typeof general.legal_versions === 'object'
          ? { ...general.legal_versions }
          : {}
      const slice = normalizeDocSlice(
        lv[docKey],
        docKey === 'guest' ? FALLBACK.guest.currentVersion : FALLBACK.partner.currentVersion,
      )
      const proposedVersion = nextVersionString(slice.currentVersion)

      lv[docKey] = {
        ...slice,
        draft: {
          proposedVersion,
          changeSummary,
          textLastUpdated: textLastUpdated || null,
          createdAt: slice.draft?.createdAt || now,
          updatedAt: now,
          createdBy: slice.draft?.createdBy || adminId,
          updatedBy: adminId,
        },
      }

      const pagesMeta = { ...(general.legal_pages_meta || {}) }
      const metaKey = docKey === 'guest' ? 'guest_offer' : 'partner_terms'
      if (textLastUpdated) {
        pagesMeta[metaKey] = {
          ...(pagesMeta[metaKey] || {}),
          textLastUpdated,
          textUpdatedAt: now,
        }
      }

      return { ...general, legal_versions: lv, legal_pages_meta: pagesMeta }
    })

    const reg = await this.getRegistry()
    return {
      success: true,
      docKey,
      draft: reg[docKey].draft,
      registry: { guest: reg.guest, partner: reg.partner },
      textMeta: reg.textMeta,
    }
  }

  /**
   * @param {'guest' | 'partner'} docKey
   * @param {string | null} [adminId]
   */
  static async publishDraft(docKey, adminId = null) {
    if (!['guest', 'partner'].includes(docKey)) {
      return { success: false, error: 'invalid_doc_key' }
    }

    const reg = await this.getRegistry()
    const slice = reg[docKey]
    if (!slice?.draft?.proposedVersion) {
      return { success: false, error: 'no_draft', message: 'Сначала создайте черновик версии.' }
    }

    const draft = slice.draft
    const newVersion = draft.proposedVersion
    const publishedAt = new Date().toISOString()

    await saveGeneralPatch((general) => {
      const lv =
        general.legal_versions && typeof general.legal_versions === 'object'
          ? { ...general.legal_versions }
          : {}
      const cur = normalizeDocSlice(
        lv[docKey],
        docKey === 'guest' ? FALLBACK.guest.currentVersion : FALLBACK.partner.currentVersion,
      )

      const entry = {
        version: newVersion,
        publishedAt,
        publishedBy: adminId || null,
        previousVersion: cur.currentVersion,
        changeSummary: draft.changeSummary || null,
        textLastUpdated: draft.textLastUpdated || null,
      }

      lv[docKey] = {
        currentVersion: newVersion,
        publishedAt,
        history: [entry, ...cur.history].slice(0, 50),
        draft: null,
      }

      const pagesMeta = { ...(general.legal_pages_meta || {}) }
      const metaKey = docKey === 'guest' ? 'guest_offer' : 'partner_terms'
      pagesMeta[metaKey] = {
        ...(pagesMeta[metaKey] || {}),
        textLastUpdated: draft.textLastUpdated || pagesMeta[metaKey]?.textLastUpdated,
        textUpdatedAt: publishedAt,
        versionPublished: newVersion,
      }

      return { ...general, legal_versions: lv, legal_pages_meta: pagesMeta }
    })

    const label = docKey === 'guest' ? 'Гостевая оферта' : 'Условия партнёров'
    void sendToAdminTopic(
      'FINANCE',
      `📜 <b>Опубликована новая версия</b>\n` +
        `${label}: <code>${newVersion}</code>\n` +
        (draft.changeSummary
          ? `Изменения: ${String(draft.changeSummary).slice(0, 500)}\n`
          : '') +
        `⚠️ Все новые оплаты и акцепты — под этой версией.`,
    )

    const updated = await this.getRegistry()
    return {
      success: true,
      docKey,
      version: newVersion,
      publishedAt,
      registry: { guest: updated.guest, partner: updated.partner },
      textMeta: updated.textMeta,
    }
  }

  /**
   * @param {'guest' | 'partner'} docKey
   * @param {string | null} [adminId]
   */
  static async bumpVersion(docKey, adminId = null) {
    if (!['guest', 'partner'].includes(docKey)) {
      return { success: false, error: 'invalid_doc_key' }
    }
    if (!supabaseAdmin) {
      return { success: false, error: 'no_db' }
    }

    const reg = await this.getRegistry()
    const slice = reg[docKey]
    if (slice?.draft) {
      return this.publishDraft(docKey, adminId)
    }

    const general = (await loadGeneralValue()) || {}
    const lv = general.legal_versions && typeof general.legal_versions === 'object' ? general.legal_versions : {}
    const cur = normalizeDocSlice(
      lv[docKey],
      docKey === 'guest' ? FALLBACK.guest.currentVersion : FALLBACK.partner.currentVersion,
    )

    const newVersion = nextVersionString(cur.currentVersion)
    const publishedAt = new Date().toISOString()
    const entry = {
      version: newVersion,
      publishedAt,
      publishedBy: adminId || null,
      previousVersion: cur.currentVersion,
    }

    const updatedSlice = {
      currentVersion: newVersion,
      publishedAt,
      history: [entry, ...cur.history].slice(0, 50),
      draft: null,
    }

    const legal_versions = {
      ...lv,
      guest: docKey === 'guest' ? updatedSlice : normalizeDocSlice(lv.guest, FALLBACK.guest.currentVersion),
      partner:
        docKey === 'partner' ? updatedSlice : normalizeDocSlice(lv.partner, FALLBACK.partner.currentVersion),
    }

    await saveGeneralPatch((g) => ({ ...g, legal_versions }))

    return {
      success: true,
      docKey,
      version: newVersion,
      publishedAt,
      registry: {
        guest: legal_versions.guest,
        partner: legal_versions.partner,
      },
    }
  }
}
