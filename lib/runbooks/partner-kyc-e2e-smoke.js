/**
 * Short E2E checklist: partner KYC → admin approve → PARTNER role (no raw SQL).
 * Shown in GET /api/v2/debug/test-telegram JSON and logged on partner application success.
 */
export const PARTNER_KYC_E2E_RUNBOOK_LINES = [
  '1) Renter: open /renter/profile → «Подать заявку» → fill phone/experience → upload KYC → submit.',
  '2) Telegram: HQ topic NEW_PARTNERS (#17) should show the application (TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_GROUP_ID).',
  '3) Admin: /admin/partners → open application → KYC opens via signed URL (ADMIN session) → Approve.',
  '4) User: refresh session (or re-login) → GET /api/v2/auth/me returns role PARTNER → /partner/dashboard loads.',
  '5) Connectivity: GET /api/v2/debug/test-telegram (ADMIN; non-prod or ENABLE_DEBUG_TELEGRAM=1) → group receives «Test OK».',
]

export function logPartnerKycE2eRunbook() {
  console.info(`[PARTNER-KYC-E2E]\n${PARTNER_KYC_E2E_RUNBOOK_LINES.join('\n')}`)
}
