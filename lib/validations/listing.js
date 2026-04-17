/**
 * Zod schemas for listing API validation
 */

import { z } from 'zod';
import { LISTING_BASE_CURRENCIES } from '@/lib/finance/currency-codes';

export const createListingSchema = z.object({
  partnerId: z.string().uuid('Invalid partner ID'),
  categoryId: z.string().uuid('Invalid category ID'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(10000).optional(),
  district: z.string().max(100).optional(),
  basePriceThb: z.coerce.number().positive('Price must be positive').max(10000000),
  baseCurrency: z.enum(LISTING_BASE_CURRENCIES).optional().default('THB'),
  images: z.array(z.string()).max(20).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({})
});
