/** Stage 142 / 153.3 — keys surfaced on /admin/health critical signals panel. */
export const CRITICAL_SIGNAL_KEYS = [
  'PRICE_TAMPERING',
  'CONTACT_LEAK_ATTEMPT',
  'FCM_TOKEN_CLEANED',
  'REFERRAL_RECONCILIATION_MISMATCH',
  'REFERRAL_SHADOW_PAYMENT_INSTRUMENT',
  'SYSTEM_AUTO_VERIFICATION',
  'ADMIN_AUDIT_WRITE_FAILED',
  'DISPUTE_RESOLUTION_SAGA_GAP',
  'POST_DISPUTE_BUCKET_DRIFT',
  'PENDING_FISCAL_BACKLOG',
  'GATEWAY_LEDGER_DRIFT',
  'LEDGER_DRIFT',
]

export const CRITICAL_SIGNAL_LABELS = {
  PRICE_TAMPERING: 'Подмена цены',
  CONTACT_LEAK_ATTEMPT: 'Увод с платформы',
  FCM_TOKEN_CLEANED: 'FCM токен очищен',
  REFERRAL_RECONCILIATION_MISMATCH: 'Referral mismatch',
  REFERRAL_SHADOW_PAYMENT_INSTRUMENT: 'Referral: коллизия платёжного инструмента',
  SYSTEM_AUTO_VERIFICATION: 'Auto-verify',
  ADMIN_AUDIT_WRITE_FAILED: 'Сбой audit log',
  DISPUTE_RESOLUTION_SAGA_GAP: 'Saga-gap спора (ledger vs статус)',
  POST_DISPUTE_BUCKET_DRIFT: 'Drift кошелька после арбитража',
  PENDING_FISCAL_BACKLOG: 'Очередь PENDING_FISCAL',
  GATEWAY_LEDGER_DRIFT: 'Gateway vs Ledger (24h)',
  LEDGER_DRIFT: 'Ledger drift (партнёры)',
}
