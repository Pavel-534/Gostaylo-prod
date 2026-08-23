/**
 * Stage 200 — Operational cron registry (Hobby + cron-job.org).
 *
 * Vercel Hobby: at most one invocation/day per expression — never put hourly here.
 * Money-critical hourly jobs run via cron-job.org → same `/api/cron/*` + CRON_SECRET.
 *
 * @see docs/CRON_EXTERNAL_FINANCIAL.md
 */

/** @typedef {'vercel_daily' | 'external_hourly' | 'external_custom' | 'manual_only'} CronScheduler */

/**
 * @typedef {{
 *   path: string
 *   jobName: string
 *   critical: boolean
 *   vercelJson: boolean
 *   scheduler: CronScheduler
 *   recommendedExternalSchedule: string | null
 *   notes: string
 * }} CronRegistryEntry
 */

/** @type {readonly CronRegistryEntry[]} */
export const CRON_REGISTRY = Object.freeze([
  {
    path: '/api/cron/escrow-thaw',
    jobName: 'escrow-thaw',
    critical: true,
    vercelJson: true,
    scheduler: 'external_hourly',
    recommendedExternalSchedule: '0 * * * *',
    notes: 'Vercel daily fallback; production hourly via cron-job.org',
  },
  {
    path: '/api/cron/reconcile-confirmed-payments',
    jobName: 'reconcile-confirmed-payments',
    critical: true,
    vercelJson: true,
    scheduler: 'external_hourly',
    recommendedExternalSchedule: '0 * * * *',
    notes:
      'AUDIT_03 C3.4 + MONEY_FLOW_04 — heal payments CONFIRMED / intents PAID / CRYPTO+txid without escrow; Vercel daily fallback; Hobby → cron-job.org hourly (POST + CRON_SECRET)',
  },
  {
    path: '/api/cron/promote-ready-for-payout',
    jobName: 'promote-ready-for-payout',
    critical: true,
    vercelJson: false,
    scheduler: 'external_hourly',
    recommendedExternalSchedule: '0 * * * *',
    notes: 'Not in vercel.json on Hobby — external only (status promote; Concierge payouts stay manual)',
  },
  {
    path: '/api/cron/payout-batch-pools',
    jobName: 'payout-batch-pools',
    critical: true,
    vercelJson: false,
    scheduler: 'external_custom',
    recommendedExternalSchedule: '0 7 * * 1,4',
    notes: 'Draft pools Mon/Thu — does not auto-send bank payouts',
  },
  {
    path: '/api/cron/financial-health-monitor',
    jobName: 'financial-health-monitor',
    critical: true,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: '30 6 * * *',
    notes: 'Optional external duplicate',
  },
  {
    path: '/api/cron/ledger-shadow-reconcile',
    jobName: 'ledger_shadow_reconcile',
    critical: true,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: '45 6 * * *',
    notes:
      'ADR-203 Phase 1 — status vs ledger shadow; ops_job_runs.zeroDrift; hard gate 30 consecutive days before SoT flip; does not change getPartnerBalance',
  },
  {
    path: '/api/cron/cleanup-critical-signals',
    jobName: 'cleanup-critical-signals',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: '0 5 * * *',
    notes: 'AUDIT_03 M3.6 — delete critical_signal_events older than 90d; idempotent',
  },
  {
    path: '/api/cron/exchange-rates-refresh',
    jobName: 'exchange-rates-refresh',
    critical: true,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: '0 */6 * * *',
    notes: 'External every 6h; HTTP 200 on keptExisting (201.113); free FX API ~daily',
  },
  {
    path: '/api/cron/ical-sync',
    jobName: 'ical-sync',
    critical: true,
    vercelJson: true,
    scheduler: 'external_custom',
    recommendedExternalSchedule: '*/30 * * * *',
    notes: 'Vercel daily fallback; prefer ~30m external',
  },
  {
    path: '/api/cron/notification-outbox',
    jobName: 'notification-outbox',
    critical: true,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: 'Outbox drain — raise frequency externally if lag',
  },
  {
    path: '/api/cron/unpaid-checkout-nudge',
    jobName: 'unpaid-checkout-nudge',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: 'Guest unpaid checkout nudges',
  },
  {
    path: '/api/cron/push-sweeper',
    jobName: 'push-sweeper',
    critical: false,
    vercelJson: false,
    scheduler: 'external_custom',
    recommendedExternalSchedule: '0 */6 * * *',
    notes: 'Push queue sweeper — external if needed',
  },
  {
    path: '/api/cron/push-token-hygiene',
    jobName: 'push-token-hygiene',
    critical: false,
    vercelJson: false,
    scheduler: 'external_custom',
    recommendedExternalSchedule: '0 4 * * 0',
    notes: 'FCM token hygiene — weekly external optional',
  },
  {
    path: '/api/cron/checkin-reminder',
    jobName: 'checkin-reminder',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/review-reminder',
    jobName: 'review-reminder',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/partner-client-review-invite',
    jobName: 'partner-client-review-invite',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/cleanup-drafts',
    jobName: 'cleanup-drafts',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: 'Stage 200.22: empty wizard orphans 7d (DRAFT_CLEANUP_EMPTY_DAYS); contentful drafts 30d (DRAFT_CLEANUP_DAYS)',
  },
  {
    path: '/api/cron/draft-digest',
    jobName: 'draft-digest',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/partner-sla-telegram-nudge',
    jobName: 'partner-sla-telegram-nudge',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: '*/10 * * * *',
    notes: 'Prefer ~10m external for SLA; Vercel daily is weak fallback',
  },
  {
    path: '/api/cron/dispute-mediation-monitor',
    jobName: 'dispute-mediation-monitor',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/flash-sale-reminder',
    jobName: 'flash-sale-reminder',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/wallet-welcome-expiry',
    jobName: 'wallet-welcome-expiry',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/referral-reconciliation',
    jobName: 'referral-reconciliation',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/referral-unlock',
    jobName: 'referral-unlock',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/owner-marketing-digest',
    jobName: 'owner-marketing-digest',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: 'Weekly expression in vercel.json',
  },
  {
    path: '/api/cron/referral-team-weekly-digest',
    jobName: 'referral-team-weekly-digest',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: 'Weekly expression in vercel.json',
  },
  {
    path: '/api/cron/referral-program-stats-quarterly',
    jobName: 'referral-program-stats-quarterly',
    critical: false,
    vercelJson: true,
    scheduler: 'external_custom',
    recommendedExternalSchedule: '0 3 1 1,4,7,10 *',
    notes: 'Quarterly avg earnings per active ambassador for offer disclosure (ADR-131A §9.6).',
  },
  {
    path: '/api/cron/partner-host-retention',
    jobName: 'partner-host-retention',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/process-data-erasure',
    jobName: 'process-data-erasure',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: null,
    notes: '',
  },
  {
    path: '/api/cron/cleanup-storage',
    jobName: 'cleanup-storage',
    critical: false,
    vercelJson: false,
    scheduler: 'manual_only',
    recommendedExternalSchedule: null,
    notes: 'Ops/manual or external when needed',
  },
  {
    path: '/api/cron/cleanup-test-data',
    jobName: 'cleanup-test-data',
    critical: false,
    vercelJson: true,
    scheduler: 'vercel_daily',
    recommendedExternalSchedule: '20 4 * * *',
    notes: 'Stage 201.09 — E2E/smoke listings+users; purge_test_ledger_rows(markers); never-paid bookings',
  },
  {
    path: '/api/cron/geo-drift-detector',
    jobName: 'geo-drift-detector',
    critical: false,
    vercelJson: false,
    scheduler: 'external_custom',
    recommendedExternalSchedule: '0 3 * * *',
    notes: 'Optional geo quality monitor',
  },
])

export function listCriticalCronJobs() {
  return CRON_REGISTRY.filter((e) => e.critical)
}

export function listExternalRequiredCronJobs() {
  return CRON_REGISTRY.filter(
    (e) => e.scheduler === 'external_hourly' || (e.critical && !e.vercelJson),
  )
}

export function getCronEntryByJobName(jobName) {
  const key = String(jobName || '').trim()
  return CRON_REGISTRY.find((e) => e.jobName === key) || null
}
