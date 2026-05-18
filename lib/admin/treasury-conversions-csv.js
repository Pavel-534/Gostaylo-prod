/**
 * Stage 101 — SSOT for treasury conversion CSV export and reconcile fingerprints.
 */

export const TREASURY_CONVERSION_CSV_DELIMITER = ';'

export const TREASURY_CONVERSION_CSV_COLUMNS = [
  'date',
  'operation_type',
  'from_currency',
  'to_currency',
  'amount_from',
  'amount_to',
  'rate_used',
  'conversion_fee_thb',
  'conversion_fee_rub',
  'conversion_loss_thb',
  'external_tx_reference',
  'comment',
  'journal_id',
]

function csvEscape(v) {
  const raw = v == null ? '' : String(v)
  if (raw.includes(';') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

/** @param {Record<string, unknown>} row */
export function mapLedgerRowToConversionDto(row) {
  const note = row.metadata?.note || row.description || ''
  return {
    id: row.id,
    journalId: row.journal_id,
    createdAt: row.created_at,
    amountThb: Number(row.amount_thb) || 0,
    fromCurrency: row.conversion_from_currency,
    toCurrency: row.conversion_to_currency,
    rateUsed: Number(row.conversion_rate_used) || 0,
    conversionFeeThb: Number(row.conversion_fee_thb) || 0,
    conversionFeeRub: Number(row.conversion_fee_rub) || 0,
    conversionLossThb: Number(row.conversion_loss_thb) || 0,
    externalTxReference: row.external_tx_reference || null,
    operationType: String(row.metadata?.operation_type || 'UNKNOWN'),
    amountFrom: Number(row.metadata?.amount_from) || null,
    amountTo: Number(row.metadata?.amount_to) || null,
    note: note || null,
  }
}

/** @param {Record<string, unknown>} row */
export function mapLedgerRowToCsvCells(row) {
  const note = row.metadata?.note || row.description || ''
  return [
    row.created_at,
    String(row.metadata?.operation_type || 'UNKNOWN'),
    row.conversion_from_currency,
    row.conversion_to_currency,
    row.metadata?.amount_from ?? '',
    row.metadata?.amount_to ?? '',
    row.conversion_rate_used ?? '',
    row.conversion_fee_thb ?? '',
    row.conversion_fee_rub ?? '',
    row.conversion_loss_thb ?? '',
    row.external_tx_reference ?? '',
    note,
    row.journal_id ?? '',
  ]
}

/** @param {Record<string, unknown>} row */
export function conversionReconcileKey(row) {
  const cells = mapLedgerRowToCsvCells(row)
  return String(cells[12] || row.journal_id || row.id)
}

/** @param {Record<string, unknown>[]} rows */
export function buildTreasuryConversionsCsv(rows) {
  const body = (rows || []).map((row) => mapLedgerRowToCsvCells(row).map(csvEscape).join(TREASURY_CONVERSION_CSV_DELIMITER))
  return ['\uFEFF' + TREASURY_CONVERSION_CSV_COLUMNS.join(TREASURY_CONVERSION_CSV_DELIMITER), ...body].join('\n')
}

/**
 * Parse exported CSV text (UTF-8 BOM, `;`) into row objects keyed by journal_id.
 * @param {string} csvText
 */
export function parseTreasuryConversionsCsv(csvText) {
  const lines = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
  if (lines.length < 2) return []

  const header = lines[0].split(TREASURY_CONVERSION_CSV_DELIMITER).map((h) => h.trim())
  const idx = (name) => header.indexOf(name)

  return lines.slice(1).map((line) => {
    const cells = line.split(TREASURY_CONVERSION_CSV_DELIMITER)
    const pick = (name) => {
      const i = idx(name)
      return i >= 0 ? cells[i]?.replace(/^"|"$/g, '').replace(/""/g, '"') : ''
    }
    return {
      journalId: pick('journal_id'),
      operationType: pick('operation_type'),
      fromCurrency: pick('from_currency'),
      toCurrency: pick('to_currency'),
      amountFrom: pick('amount_from'),
      amountTo: pick('amount_to'),
      rateUsed: pick('rate_used'),
      conversionFeeThb: pick('conversion_fee_thb'),
      conversionLossThb: pick('conversion_loss_thb'),
      externalTxReference: pick('external_tx_reference'),
    }
  })
}

/**
 * Compare ledger rows with parsed CSV rows (by journal_id + critical fields).
 * @param {Record<string, unknown>[]} ledgerRows
 * @param {ReturnType<typeof parseTreasuryConversionsCsv>} csvRows
 */
export function reconcileTreasuryConversions(ledgerRows, csvRows) {
  const ledgerByJournal = new Map()
  for (const row of ledgerRows || []) {
    const key = conversionReconcileKey(row)
    if (key) ledgerByJournal.set(key, row)
  }

  const csvByJournal = new Map()
  for (const row of csvRows || []) {
    if (row.journalId) csvByJournal.set(row.journalId, row)
  }

  const mismatches = []

  for (const [journalId, ledgerRow] of ledgerByJournal) {
    const csvRow = csvByJournal.get(journalId)
    if (!csvRow) {
      mismatches.push({ type: 'MISSING_IN_CSV', journalId })
      continue
    }
    const dto = mapLedgerRowToConversionDto(ledgerRow)
    const checks = [
      ['operation_type', dto.operationType, csvRow.operationType],
      ['from_currency', dto.fromCurrency, csvRow.fromCurrency],
      ['to_currency', dto.toCurrency, csvRow.toCurrency],
      ['conversion_fee_thb', String(dto.conversionFeeThb || 0), csvRow.conversionFeeThb],
      ['conversion_loss_thb', String(dto.conversionLossThb || 0), csvRow.conversionLossThb],
    ]
    for (const [field, ledgerVal, csvVal] of checks) {
      if (String(ledgerVal ?? '') !== String(csvVal ?? '')) {
        mismatches.push({ type: 'FIELD_MISMATCH', journalId, field, ledger: ledgerVal, csv: csvVal })
      }
    }
  }

  for (const journalId of csvByJournal.keys()) {
    if (!ledgerByJournal.has(journalId)) {
      mismatches.push({ type: 'EXTRA_IN_CSV', journalId })
    }
  }

  return {
    ledgerCount: ledgerByJournal.size,
    csvCount: csvByJournal.size,
    matched: mismatches.length === 0 && ledgerByJournal.size === csvByJournal.size,
    mismatches,
  }
}
