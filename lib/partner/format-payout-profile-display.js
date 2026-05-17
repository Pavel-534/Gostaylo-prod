/**
 * Human-readable payout profile lines for partner UI (Stage 100.4).
 * @param {{ channel?: string, name?: string }} method
 * @param {Record<string, unknown>} data
 * @returns {string[]}
 */
export function formatPayoutProfileLines(method, data = {}) {
  const channel = String(method?.channel || '').toUpperCase()
  const d = data && typeof data === 'object' ? data : {}

  if (channel === 'BANK') {
    const lines = []
    if (d.recipientName) lines.push(`Получатель: ${d.recipientName}`)
    if (d.inn) lines.push(`ИНН: ${d.inn}`)
    if (d.bik) lines.push(`БИК: ${d.bik}`)
    if (d.accountNumber) lines.push(`Счёт: ${d.accountNumber}`)
    if (d.bankName) lines.push(`Банк: ${d.bankName}`)
    return lines.length ? lines : ['Банковский перевод (РФ) — данные не заполнены']
  }

  if (channel === 'CRYPTO') {
    const lines = []
    if (d.network) lines.push(`Сеть: ${d.network}`)
    if (d.address) lines.push(`Кошелёк: ${d.address}`)
    return lines.length ? lines : ['USDT / крипто — укажите сеть и адрес кошелька']
  }

  const lines = []
  if (d.fullName) lines.push(`Получатель: ${d.fullName}`)
  if (d.cardNumber) {
    const last4 = String(d.cardNumber).slice(-4)
    lines.push(`Карта: •••• ${last4}`)
  }
  return lines.length ? lines : ['Карта — данные не заполнены']
}
