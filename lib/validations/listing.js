/**
 * Zod schemas for listing API validation
 */

import { z } from 'zod';
import { LISTING_BASE_CURRENCIES } from '@/lib/finance/currency-codes';
import { categoryIdSchema, profileIdSchema } from '@/lib/validations/ids';

/** Reused by POST create and PATCH price updates (Stage 149.1 / 200.86).
 * Drafts may be 0 until Pricing step; publish gates still require a real price.
 */
export const listingBasePriceSchema = z.coerce
  .number()
  .min(0, 'Price must be non-negative')
  .max(10000000);

export const createListingSchema = z.object({
  partnerId: profileIdSchema('Invalid partner ID'),
  categoryId: categoryIdSchema('Invalid category ID'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(10000).optional(),
  district: z.string().max(100).optional(),
  country: z.string().max(8).optional(),
  region: z.string().max(16).optional(),
  city: z.string().max(64).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  basePriceThb: listingBasePriceSchema,
  baseCurrency: z.enum(LISTING_BASE_CURRENCIES).optional().default('THB'),
  instantBooking: z.boolean().optional(),
  instant_booking: z.boolean().optional(),
  images: z.array(z.string()).max(20).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({})
});
