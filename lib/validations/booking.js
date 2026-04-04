/**
 * Zod schemas for booking API validation
 */

import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/** JSON often sends `null` for empty optional fields; Zod's `.optional()` only allows `undefined`. */
function nullishToUndef(schema) {
  return z.preprocess((v) => (v === null ? undefined : v), schema);
}

/** Listing primary keys may be UUID or custom text slugs (e.g. lst-test-final-…). */
/** Renter profile IDs are TEXT in DB (not necessarily RFC-4122 UUID). */
export const createBookingSchema = z.object({
  listingId: z.string().min(1, 'Invalid listing ID').max(200),
  renterId: z.preprocess(
    (v) => (v === '' ? null : v),
    z.union([z.string().min(1, 'Invalid renter ID').max(200), z.null()]).optional()
  ),
  checkIn: z.string().regex(dateRegex, 'checkIn must be YYYY-MM-DD'),
  checkOut: z.string().regex(dateRegex, 'checkOut must be YYYY-MM-DD'),
  guestsCount: z.coerce.number().int().min(1).max(500).optional().default(1),
  guestName: nullishToUndef(z.string().min(1).max(200).optional()),
  guestPhone: nullishToUndef(z.string().max(50).optional()),
  guestEmail: nullishToUndef(z.union([z.string().email(), z.literal('')]).optional()),
  specialRequests: nullishToUndef(z.string().max(2000).optional()),
  currency: z.enum(['THB', 'USD', 'RUB', 'CNY']).optional().default('THB'),
  promoCode: nullishToUndef(z.string().max(50).optional()),
  /** Private / exclusive trip → INQUIRY flow (chat quote), no instant confirm */
  privateTrip: z.boolean().optional().default(false),
  /** Custom / special price quote via chat + INQUIRY */
  negotiationRequest: z.boolean().optional().default(false),
}).refine(
  (data) => new Date(data.checkOut) > new Date(data.checkIn),
  { message: 'checkOut must be after checkIn', path: ['checkOut'] }
);
