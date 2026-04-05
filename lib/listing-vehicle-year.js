/**
 * Год выпуска ТС для публичного UI: отсекаем мусор и нижнюю границу «как реальный мопед/байк в аренде».
 * В БД мог остаться 1950 из старой валидации или ошибочного ввода.
 */

const MIN_MODEL_YEAR = 1985

/**
 * @param {unknown} raw — metadata.vehicle_year
 * @returns {number|null} год для отображения или null (не показывать строку)
 */
export function normalizeVehicleModelYearForDisplay(raw) {
  const cy = new Date().getFullYear()
  const maxY = cy + 1
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 4)
  if (!digits) return null
  const n = parseInt(digits, 10)
  if (!Number.isFinite(n) || n < MIN_MODEL_YEAR || n > maxY) return null
  return n
}
