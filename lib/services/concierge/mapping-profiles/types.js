/**
 * ADR-210 Slice 6 — MappingProfile contract (JSDoc).
 *
 * A profile normalizes heterogeneous partner rate cards (PDF/Excel/Sheets extract)
 * into the Concierge ingest listing shape used by `ingestConciergeListings`.
 *
 * @typedef {{
 *   startDate: string,
 *   endDate: string,
 *   priceDaily: number,
 *   priceMonthly?: number|null,
 *   label?: string|null,
 *   seasonType?: string|null,
 * }} ConciergeSeasonInput
 *
 * @typedef {{
 *   lat?: number|null,
 *   lng?: number|null,
 *   addressText?: string|null,
 *   countryCode?: string|null,
 *   cityCode?: string|null,
 * }} ConciergeGeoInput
 *
 * @typedef {{
 *   externalId: string,
 *   title: string,
 *   description?: string,
 *   categorySlug?: string,
 *   bedrooms?: number|null,
 *   bathrooms?: number|null,
 *   maxGuests?: number|null,
 *   sqm?: number|null,
 *   geo?: ConciergeGeoInput,
 *   basePriceThb: number,
 *   currency?: string,
 *   seasons?: ConciergeSeasonInput[],
 *   images?: string[],
 *   amenities?: string[]|Record<string, boolean>,
 *   icalUrl?: string,
 * }} ConciergeRawListing
 *
 * @typedef {{
 *   ok: true,
 *   listing: object,
 *   warnings: Array<{ code: string, message: string, field?: string }>,
 * } | {
 *   ok: false,
 *   error: string,
 *   code: string,
 *   field?: string,
 * }} MappingNormalizeResult
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   description: string,
 *   normalizeListing: (raw: ConciergeRawListing, opts?: object) => MappingNormalizeResult,
 *   validatePackage?: (listings: ConciergeRawListing[], opts?: object) => {
 *     ok: boolean,
 *     errors: Array<{ externalId?: string, code: string, message: string }>,
 *     warnings: Array<{ externalId?: string, code: string, message: string }>,
 *   },
 * }} MappingProfile
 */

export const MAPPING_PROFILE_IDS = Object.freeze({
  GENERIC: 'generic_concierge_v1',
  SHOW_PROPERTY: 'show_property_v1',
})
