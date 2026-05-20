/**
 * Stage 106.5 — человекочитаемые подписи для журнала движений (режим владельца).
 */

export const MOVEMENT_KIND_LABEL_RU = {
  CONVERSION: 'Конвертация валют',
  PAYOUT_BATCH: 'Пул выплат',
  LEDGER: 'Оплата гостя',
  FISCAL: 'Чек для гостя',
}

/**
 * @param {string | null | undefined} kind
 * @param {boolean} [ownerFriendly]
 */
export function movementKindLabel(kind, ownerFriendly = true) {
  const k = String(kind || '')
  if (ownerFriendly && MOVEMENT_KIND_LABEL_RU[k]) return MOVEMENT_KIND_LABEL_RU[k]
  return k || '—'
}
