/** Единый маркер тестовых сущностей для фикстур, сидов и очистки БД. */
export const E2E_TEST_DATA_TAG = '[E2E_TEST_DATA]'

/**
 * Best-effort detector for test-only entities.
 * Accepts listing/booking/message-like objects.
 * Брони: в прод-схеме нет `bookings.metadata` — для маркировки используйте `special_requests` / `guest_name`.
 * @param {Record<string, any> | null | undefined} row
 */
export function isMarkedE2eTestData(row) {
  if (!row || typeof row !== 'object') return false
  const hay = [
    row.title,
    row.description,
    row.special_requests,
    row.specialRequests,
    row.guest_name,
    row.guestName,
    row.content,
    row.message,
    row?.metadata?.test_data_tag,
    row?.metadata?.e2e_tag,
  ]
    .filter(Boolean)
    .join('\n')
  return hay.includes(E2E_TEST_DATA_TAG)
}

