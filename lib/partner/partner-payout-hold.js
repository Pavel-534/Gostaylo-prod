/**
 * Client-safe payout hold constants (no supabase / telemetry).
 * Keeps partner finances UI from pulling server-only `node:*` graphs.
 */

/** 24 hours — partner «Доступно к выводу» after escrow thaw */
export const PARTNER_WITHDRAWAL_HOLD_MS = 24 * 60 * 60 * 1000
