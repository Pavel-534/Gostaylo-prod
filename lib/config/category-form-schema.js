/**
 * Stage 64.0–65.0 — SSOT: поля metadata партнёрского визарда по категории / подтипу.
 * Рендер: `components/partner/WizardSchemaFields.jsx`; нормализация: `normalizePartnerListingMetadata`.
 */

import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
} from '@/lib/listing-category-slug'
import { isPartnerListingHousingCategory } from '@/lib/partner/partner-listing-housing-category'
import { inferListingServiceTypeFromRegistry } from '@/lib/config/category-behavior'

/** @typedef {'number'|'string'|'text'|'boolean'|'select'|'languages_multi'} WizardFieldType */

/**
 * @typedef {{
 *   key: string,
 *   type: WizardFieldType,
 *   labelKey: string,
 *   required: boolean,
 *   min?: number,
 *   max?: number,
 *   placeholderKey?: string,
 *   options?: { value: string, labelKey: string }[],
 *   gridSpan?: 1 | 2,
 *   yearBlur?: boolean,
 *   optionalEmpty?: boolean,
 * }} WizardFormFieldDef */

/** Ключи, которые не выводятся из схемы визарда, но должны сохраняться в metadata. */
export const METADATA_KEYS_ALWAYS_ALLOWED = new Set([
  'timezone',
  'check_in_instructions',
  'check_in_photos',
  'amenities',
  'description_translations',
  'seo',
  'seo_title',
  'seo_description',
  'property_type',
  'rent_entire_unit',
  'category_slug',
  'categorySlug',
  'fuel_policy',
  'discounts',
  'cleaning_fee_thb',
  'security_deposit_thb',
  'is_draft',
  'published_at',
  'source',
  'submitted_from',
  'import_source',
])

/** @type {WizardFormFieldDef[]} */
const STAY_SEARCH_FIELDS = [
  { key: 'bedrooms', type: 'number', labelKey: 'fieldBedrooms', required: false, min: 0, max: 99 },
  { key: 'bathrooms', type: 'number', labelKey: 'fieldBathrooms', required: false, min: 0, max: 99 },
  { key: 'max_guests', type: 'number', labelKey: 'fieldMaxGuests', required: false, min: 1, max: 999 },
  { key: 'area', type: 'number', labelKey: 'fieldAreaSqm', required: false, min: 0, max: 9_999_999 },
  {
    key: 'cleaning_fee_thb',
    type: 'number',
    labelKey: 'fieldCleaningFeeThb',
    required: false,
    min: 0,
    max: 9_999_999,
    optionalEmpty: true,
  },
  {
    key: 'security_deposit_thb',
    type: 'number',
    labelKey: 'fieldDepositThb',
    required: false,
    min: 0,
    max: 9_999_999,
    optionalEmpty: true,
  },
]

/** @type {WizardFormFieldDef[]} */
const TRANSPORT_VEHICLE_FIELDS = [
  { key: 'vehicle_year', type: 'number', labelKey: 'fieldVehicleYear', required: false, min: 1985, max: 2100, yearBlur: true },
  { key: 'seats', type: 'number', labelKey: 'fieldVehicleSeats', required: false, min: 1, max: 99, optionalEmpty: true },
  {
    key: 'engine_cc',
    type: 'number',
    labelKey: 'fieldEngineCc',
    required: false,
    min: 0,
    max: 500_000,
    optionalEmpty: true,
  },
  {
    key: 'transmission',
    type: 'select',
    labelKey: 'fieldTransmission',
    required: false,
    options: [
      { value: 'unset', labelKey: 'transmissionUnset' },
      { value: 'automatic', labelKey: 'transmissionAuto' },
      { value: 'manual', labelKey: 'transmissionManual' },
      { value: 'cvt', labelKey: 'transmissionCvt' },
    ],
  },
  {
    key: 'fuel_type',
    type: 'select',
    labelKey: 'fieldFuelType',
    required: false,
    options: [
      { value: 'unset', labelKey: 'fuelUnset' },
      { value: 'petrol', labelKey: 'fuelPetrol' },
      { value: 'diesel', labelKey: 'fuelDiesel' },
      { value: 'electric', labelKey: 'fuelElectric' },
      { value: 'hybrid', labelKey: 'fuelHybrid' },
    ],
  },
  {
    key: 'fuel_policy',
    type: 'select',
    labelKey: 'fieldFuelPolicy',
    required: false,
    gridSpan: 2,
    options: [
      { value: 'unset', labelKey: 'fieldFuelPolicyUnset' },
      { value: 'full_to_full', labelKey: 'fieldFuelPolicyFull' },
      { value: 'other', labelKey: 'fieldFuelPolicyOther' },
    ],
  },
]

/** Поля премиум-сегмента (вертолёт + яхта). */
/** @type {WizardFormFieldDef[]} */
const PREMIUM_AIR_OR_SEA_FIELDS = [
  { key: 'crew_included', type: 'boolean', labelKey: 'partnerWizard_crewIncluded', required: false },
  { key: 'catering_available', type: 'boolean', labelKey: 'partnerWizard_cateringAvailable', required: false },
  {
    key: 'flight_rules',
    type: 'text',
    labelKey: 'partnerWizard_flightRules',
    required: false,
    gridSpan: 2,
    placeholderKey: 'partnerWizard_flightRulesPlaceholder',
  },
]

/** @type {WizardFormFieldDef[]} */
const YACHT_FIELDS = [
  { key: 'passengers', type: 'number', labelKey: 'fieldPassengers', required: false, min: 1, max: 999 },
  {
    key: 'engine',
    type: 'string',
    labelKey: 'fieldEngineType',
    required: false,
    placeholderKey: 'fieldEnginePlaceholder',
    gridSpan: 2,
  },
  ...PREMIUM_AIR_OR_SEA_FIELDS,
]

/** @type {WizardFormFieldDef[]} */
const TOUR_SPECS_FIELDS = [
  {
    key: 'duration',
    type: 'string',
    labelKey: 'fieldDuration',
    required: false,
    placeholderKey: 'fieldDurationPlaceholder',
    gridSpan: 2,
  },
]

/** База маркетплейса услуг (няня / повар / массаж / прочие услуги). */
/** @type {WizardFormFieldDef[]} */
const SERVICE_MARKET_BASE_FIELDS = [
  {
    key: 'languages',
    type: 'languages_multi',
    labelKey: 'partnerWizard_serviceLanguages',
    required: false,
    gridSpan: 2,
  },
  {
    key: 'experience_years',
    type: 'number',
    labelKey: 'partnerWizard_serviceExperienceYears',
    required: false,
    min: 0,
    max: 80,
    optionalEmpty: true,
  },
  {
    key: 'certifications',
    type: 'text',
    labelKey: 'partnerWizard_certifications',
    required: false,
    gridSpan: 2,
    placeholderKey: 'partnerWizard_certificationsPlaceholder',
  },
]

/** @type {WizardFormFieldDef[]} */
const NANNY_SPECIFIC_FIELDS = [
  {
    key: 'age_groups',
    type: 'string',
    labelKey: 'partnerWizard_ageGroups',
    required: false,
    placeholderKey: 'partnerWizard_ageGroupsPlaceholder',
    gridSpan: 2,
  },
  { key: 'live_in_option', type: 'boolean', labelKey: 'partnerWizard_liveInOption', required: false },
]

/** Няня: база + специализация + возрастные группы / проживание. */
/** @type {WizardFormFieldDef[]} */
const NANNY_MARKETPLACE_FIELDS = [
  ...SERVICE_MARKET_BASE_FIELDS,
  {
    key: 'specialization',
    type: 'string',
    labelKey: 'fieldSpecialization',
    required: false,
    placeholderKey: 'fieldSpecializationPh',
    gridSpan: 2,
  },
  ...NANNY_SPECIFIC_FIELDS,
]

/** @type {WizardFormFieldDef[]} */
const CHEF_SPECIFIC_FIELDS = [
  {
    key: 'cuisine_types',
    type: 'string',
    labelKey: 'partnerWizard_cuisineTypes',
    required: false,
    placeholderKey: 'partnerWizard_cuisineTypesPlaceholder',
    gridSpan: 2,
  },
  {
    key: 'min_persons',
    type: 'number',
    labelKey: 'partnerWizard_minPersons',
    required: false,
    min: 1,
    max: 999,
    optionalEmpty: true,
  },
]

/** @type {WizardFormFieldDef[]} */
const MASSAGE_SPECIFIC_FIELDS = [
  {
    key: 'massage_types',
    type: 'text',
    labelKey: 'partnerWizard_massageTypes',
    required: false,
    gridSpan: 2,
    placeholderKey: 'partnerWizard_massageTypesPlaceholder',
  },
  { key: 'home_visit', type: 'boolean', labelKey: 'partnerWizard_homeVisit', required: false },
]

function isChefCategorySlug(slug) {
  const s = String(slug || '').toLowerCase().trim()
  return s === 'chef' || s === 'chefs' || s.includes('chef')
}

function isMassageCategorySlug(slug) {
  const s = String(slug || '').toLowerCase().trim()
  return s === 'massage' || s === 'massages' || s.includes('massage')
}

function isHelicopterSlug(slug) {
  const s = String(slug || '').toLowerCase().trim()
  return s === 'helicopter' || s === 'helicopters'
}

/**
 * Профиль формы (для allowed keys + плейсментов).
 * @typedef {'stay'|'transport'|'transport_helicopter'|'yacht'|'tour'|'nanny'|'chef'|'massage'|'service_generic'|'none'} WizardFormProfile
 */

/**
 * @param {string} categorySlug
 * @param {string} [categoryNameFallback]
 * @returns {WizardFormProfile}
 */
export function resolveWizardFormProfile(categorySlug, categoryNameFallback = '') {
  const slug = String(categorySlug || '').toLowerCase().trim()
  const name = String(categoryNameFallback || '')

  if (slug === 'nanny' || slug === 'babysitter' || /nanny|нян|babysit/i.test(name)) return 'nanny'
  /** Сначала massage — иначе slug вроде `massage-chef` попадёт в chef по подстроке `chef`. */
  if (isMassageCategorySlug(slug) || /massage|массаж|spa/i.test(name)) return 'massage'
  if (isChefCategorySlug(slug) || /chef|повар|cook|кух/i.test(name)) return 'chef'
  if (isYachtLikeCategory(slug)) return 'yacht'
  if (isTourListingCategory(slug)) return 'tour'
  if (isTransportListingCategory(slug)) {
    return isHelicopterSlug(slug) ? 'transport_helicopter' : 'transport'
  }
  if (isPartnerListingHousingCategory(slug, categoryNameFallback)) return 'stay'

  const s = slug
  if (s === 'services' || s === 'service' || s.includes('service')) return 'service_generic'
  if (inferListingServiceTypeFromRegistry(slug) === 'service') return 'service_generic'
  return 'none'
}

/**
 * Как {@link resolveWizardFormProfile}, плюс эвристика по названию категории (legacy deep links).
 * @param {string} categorySlug
 * @param {string} [categoryNameFallback]
 * @returns {WizardFormProfile}
 */
export function resolveWizardFormProfileWithLegacyName(categorySlug, categoryNameFallback = '') {
  const base = resolveWizardFormProfile(categorySlug, categoryNameFallback)
  if (base !== 'none') return base
  const n = String(categoryNameFallback || '')
  if (/vehicle|транспорт|bike|moto|car|авто|байк|мото/i.test(n)) return 'transport'
  if (/massage|массаж|spa/i.test(n)) return 'massage'
  if (/chef|повар|cook|кух/i.test(n)) return 'chef'
  return 'none'
}

/**
 * Поля для блока «шаг 1» (только транспорт: авто / вертолёт).
 * @param {string} categorySlug
 * @returns {WizardFormFieldDef[]}
 */
export function getWizardStep1TransportFields(categorySlug) {
  const profile = resolveWizardFormProfile(categorySlug, '')
  if (profile !== 'transport' && profile !== 'transport_helicopter') return []
  const base = [...TRANSPORT_VEHICLE_FIELDS]
  if (profile === 'transport_helicopter') {
    return [...base, ...PREMIUM_AIR_OR_SEA_FIELDS]
  }
  return base
}

/**
 * Поля для секции спецификаций визарда (шаг 1 нижний блок), без дублирования транспорта.
 * @param {string} categorySlug
 * @param {string} [categoryNameFallback]
 * @returns {WizardFormFieldDef[]}
 */
export function getWizardSpecsSectionFields(categorySlug, categoryNameFallback = '') {
  const profile = resolveWizardFormProfile(categorySlug, categoryNameFallback)
  switch (profile) {
    case 'stay':
      return [...STAY_SEARCH_FIELDS]
    case 'yacht':
      return [...YACHT_FIELDS]
    case 'tour':
      return [...TOUR_SPECS_FIELDS]
    case 'nanny':
      return [...NANNY_MARKETPLACE_FIELDS]
    case 'chef':
      return [...SERVICE_MARKET_BASE_FIELDS, ...CHEF_SPECIFIC_FIELDS]
    case 'massage':
      return [...SERVICE_MARKET_BASE_FIELDS, ...MASSAGE_SPECIFIC_FIELDS]
    case 'service_generic':
      return [...SERVICE_MARKET_BASE_FIELDS]
    case 'transport':
    case 'transport_helicopter':
      return []
    default:
      return []
  }
}

/**
 * Все поля из схемы для партнёрского блока «поисковые metadata» (edit + wizard housing path).
 * @param {string} categorySlug
 * @param {string} [categoryNameFallback]
 * @returns {WizardFormFieldDef[]}
 */
export function getAllPartnerSearchMetadataFields(categorySlug, categoryNameFallback = '') {
  return getAllPartnerSearchMetadataFieldsForProfile(profileFromSlugAndName(categorySlug, categoryNameFallback))
}

/**
 * Разрешённые ключи metadata для категории (схема + системные).
 * @param {string} categorySlug
 * @param {string} [categoryNameFallback]
 * @returns {Set<string>}
 */
export function getAllowedWizardMetadataKeys(categorySlug, categoryNameFallback = '') {
  const keys = new Set(METADATA_KEYS_ALWAYS_ALLOWED)
  const profile = resolveWizardFormProfileWithLegacyName(categorySlug, categoryNameFallback)
  const fields = getAllPartnerSearchMetadataFieldsForProfile(profile)
  for (const f of fields) keys.add(f.key)
  if (profile === 'tour') {
    keys.add('group_size_min')
    keys.add('group_size_max')
  }
  return keys
}

/**
 * @param {WizardFormProfile} profile
 * @returns {WizardFormFieldDef[]}
 */
export function getAllPartnerSearchMetadataFieldsForProfile(profile) {
  switch (profile) {
    case 'stay':
      return [...STAY_SEARCH_FIELDS]
    case 'transport':
      return [...TRANSPORT_VEHICLE_FIELDS]
    case 'transport_helicopter':
      return [...TRANSPORT_VEHICLE_FIELDS, ...PREMIUM_AIR_OR_SEA_FIELDS]
    case 'yacht':
      return [...YACHT_FIELDS]
    case 'tour':
      return [...TOUR_SPECS_FIELDS]
    case 'nanny':
      return [...NANNY_MARKETPLACE_FIELDS]
    case 'chef':
      return [...SERVICE_MARKET_BASE_FIELDS, ...CHEF_SPECIFIC_FIELDS]
    case 'massage':
      return [...SERVICE_MARKET_BASE_FIELDS, ...MASSAGE_SPECIFIC_FIELDS]
    case 'service_generic':
      return [...SERVICE_MARKET_BASE_FIELDS]
    default:
      return []
  }
}

function profileFromSlugAndName(categorySlug, categoryNameFallback) {
  return resolveWizardFormProfileWithLegacyName(categorySlug, categoryNameFallback)
}

/**
 * Поля жилья для карточки партнёра: в мастере при `showWizardExtraHousingFields === false` только спальни/ванные.
 * @param {'wizard'|'edit'} variant
 * @param {boolean} showWizardExtraHousingFields
 * @returns {WizardFormFieldDef[]}
 */
export function getPartnerListingHousingMetadataFieldsForVariant(variant, showWizardExtraHousingFields) {
  if (variant === 'edit') {
    return STAY_SEARCH_FIELDS.filter((f) => f.key === 'bedrooms' || f.key === 'bathrooms')
  }
  if (showWizardExtraHousingFields) return [...STAY_SEARCH_FIELDS]
  return STAY_SEARCH_FIELDS.filter((f) => f.key === 'bedrooms' || f.key === 'bathrooms')
}
