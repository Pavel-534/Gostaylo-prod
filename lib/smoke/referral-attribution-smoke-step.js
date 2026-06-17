/**
 * Stage 120.1 — smoke: полная цепочка click → signup → booking → ledger attribution_id.
 */
import { runStage120AttributionChainFixture } from '@/lib/e2e/stage120-attribution-chain-fixture.js';

function step(name) {
  return { name, ok: false, detail: '', durationMs: 0 };
}

function markDuration(s, t0) {
  s.durationMs = Math.max(0, Date.now() - t0);
}

function pass(s, detail, t0) {
  s.ok = true;
  s.detail = detail;
  markDuration(s, t0);
  return s;
}

function fail(s, detail, t0) {
  s.ok = false;
  s.detail = String(detail || 'failed').slice(0, 500);
  markDuration(s, t0);
  return s;
}

/**
 * @param {{ categoryId?: string }} [options]
 * @returns {Promise<{ name: string, ok: boolean, detail: string, durationMs: number }>}
 */
export async function runReferralAttributionSmokeStep(options = {}) {
  const s = step('Referral 120.1 attribution chain');
  const t0 = Date.now();
  try {
    const result = await runStage120AttributionChainFixture(options);
    if (!result?.success) {
      return fail(s, result?.error || 'fixture_failed', t0);
    }
    const d = result.data || {};
    return pass(
      s,
      `click=${d.clickId?.slice(0, 12)}… attr=${String(d.attributionId || '').slice(0, 12)}… ` +
        `ledgerRows=${d.ledgerRowCount}`,
      t0,
    );
  } catch (e) {
    return fail(s, e?.message || String(e), t0);
  }
}
