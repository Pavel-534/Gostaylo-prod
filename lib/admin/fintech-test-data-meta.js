/**
 * Stage 106.4b — единый маркер is_test_data для smoke/E2E в FinTech.
 */

export const FINTECH_TEST_DATA_FLAG = 'is_test_data'

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 * @returns {Record<string, unknown>}
 */
export function withFintechTestDataMeta(metadata = {}) {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {}
  return { ...base, [FINTECH_TEST_DATA_FLAG]: true }
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function hasFintechTestDataFlag(row) {
  if (!row || typeof row !== 'object') return false
  if (row[FINTECH_TEST_DATA_FLAG] === true) return true
  const meta = row.metadata
  if (meta && typeof meta === 'object' && meta[FINTECH_TEST_DATA_FLAG] === true) return true
  return false
}
