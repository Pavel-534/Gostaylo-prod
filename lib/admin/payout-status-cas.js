/**
 * AUDIT_03 C3.7 — payout admin status CAS helpers.
 */

export function resolvePayoutCasUpdatedAt(body, row) {
  const fromBody =
    body?.expectedUpdatedAt ?? body?.expected_updated_at ?? body?.updatedAt ?? body?.updated_at ?? null
  if (fromBody != null && String(fromBody).trim() !== '') {
    return String(fromBody).trim()
  }
  return row?.updated_at != null ? String(row.updated_at) : null
}

/**
 * @param {{ data: object | null, error: { message?: string } | null }} result
 * @param {string} expectedUpdatedAt
 */
export function interpretPayoutCasUpdate(result, expectedUpdatedAt) {
  if (result?.error) {
    return { ok: false, status: 500, error: result.error.message || 'update_failed' }
  }
  if (!result?.data?.id) {
    return {
      ok: false,
      status: 409,
      error: 'CONCURRENT_MODIFICATION',
      code: 'CONCURRENT_MODIFICATION',
      expectedUpdatedAt: expectedUpdatedAt || null,
    }
  }
  return { ok: true, payout: result.data }
}
