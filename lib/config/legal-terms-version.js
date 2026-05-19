/**
 * Fallback-версии юр. документов (код), если в БД ещё нет `system_settings.general.legal_versions`.
 * Runtime SSOT: `LegalVersionsService` (Stage 102.3) — админка `/admin/settings/legal`.
 * При существенных изменениях текста на сайте — новая версия через админку + обновить legal-details.
 */
export const CURRENT_LEGAL_TERMS_VERSION = '2026-05-18-v1'

/** Условия для партнёров — `/legal/partner-terms/` (Stage 102.2). */
export const CURRENT_PARTNER_TERMS_VERSION = '2026-05-19-v1'
