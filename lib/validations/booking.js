/**
 * Zod schemas for booking API validation
 */

import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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
  guestName: z.string().min(1).max(200).optional(),
  guestPhone: z.string().max(50).optional(),
  guestEmail: z.union([z.string().email(), z.literal('')]).optional(),
  specialRequests: z.string().max(2000).optional(),
  currency: z.enum(['THB', 'USD', 'RUB', 'CNY']).optional().default('THB'),
  promoCode: z.string().max(50).optional()
}).refine(
  (data) => new Date(data.checkOut) > new Date(data.checkIn),
  { message: 'checkOut must be after checkIn', path: ['checkOut'] }
);
