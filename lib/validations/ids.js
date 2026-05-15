/**
 * App TEXT ids (profiles `user-…`, listings `lst-…`, categories numeric/slug keys in DB).
 * Do not use z.string().uuid() for runtime entities.
 */

import { z } from 'zod'

/** @param {string} [label] */
export function profileIdSchema(label = 'Invalid profile ID') {
  return z.string().min(1, label).max(200)
}

/** @param {string} [label] */
export function listingIdSchema(label = 'Invalid listing ID') {
  return z.string().min(1, label).max(200)
}

/** @param {string} [label] */
export function categoryIdSchema(label = 'Invalid category ID') {
  return z.string().min(1, label).max(200)
}
