/**
 * Stage 28.0 — единая отправка отзыва гостя (мульти-критерии + фото URL).
 */

/**
 * @param {object} params
 * @param {object} params.booking — строка брони (listing_id / listings.id)
 * @param {Record<string, number>} params.ratings — cleanliness, accuracy, …
 * @param {string} [params.comment]
 * @param {string[]} [params.photos]
 */
export async function postRenterReview({ booking, ratings, comment = '', photos = [] }) {
  const listingId = booking?.listing_id || booking?.listing?.id || booking?.listings?.id
  const bookingId = booking?.id
  if (!listingId || !bookingId) {
    throw new Error('Missing listingId or bookingId')
  }

  const res = await fetch('/api/v2/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      listingId,
      bookingId,
      ratings,
      comment: typeof comment === 'string' ? comment : '',
      ...(photos?.length ? { photos } : {}),
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || 'review_submit_failed')
  }
  if (!json.success) {
    throw new Error(json.error || 'review_submit_failed')
  }
  return json
}
