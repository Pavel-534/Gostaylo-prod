/**
 * Слияние ответа airbnb-preview с формами партнёра (wizard / edit).
 */

export const LISTING_AMENITY_PRESETS = [
  'Wi-Fi',
  'Pool',
  'Parking',
  'AC',
  'Kitchen',
  'Laundry',
  'Security',
  'Garden',
  'Terrace',
  'BBQ',
  'Gym',
  'Sauna',
]

/** @typedef {{ labels?: string[], codes?: string[] }} AmenityBlock */

/**
 * Сопоставить подписи/коды с чипами мастера.
 * @param {Record<string, unknown> | null | undefined} metadata
 * @returns {string[]}
 */
export function mapImportedAmenitiesToPresets(metadata) {
  const block = metadata && typeof metadata === 'object' ? metadata.amenities : null
  const labels = Array.isArray(block?.labels) ? block.labels : []
  const codes = Array.isArray(block?.codes) ? block.codes : []
  const hay = [...labels, ...codes].map((s) => String(s).toLowerCase())
  const out = new Set()

  const keywordRules = [
    [['wifi', 'wireless', 'internet', 'wi fi', 'wi-fi'], 'Wi-Fi'],
    [['pool', 'swimming'], 'Pool'],
    [['parking', 'garage', 'car park'], 'Parking'],
    [['air conditioning', 'aircon', 'a/c', 'ac '], 'AC'],
    [['kitchen', 'cooking'], 'Kitchen'],
    [['laundry', 'washer', 'washing machine', 'dryer'], 'Laundry'],
    [['security', 'cctv', 'alarm'], 'Security'],
    [['garden', 'yard', 'lawn'], 'Garden'],
    [['terrace', 'balcony', 'patio', 'deck'], 'Terrace'],
    [['bbq', 'barbecue', 'grill'], 'BBQ'],
    [['gym', 'fitness'], 'Gym'],
    [['sauna', 'steam'], 'Sauna'],
  ]

  for (const [keys, preset] of keywordRules) {
    if (!LISTING_AMENITY_PRESETS.includes(preset)) continue
    if (hay.some((h) => keys.some((k) => h.includes(k)))) out.add(preset)
  }

  for (const preset of LISTING_AMENITY_PRESETS) {
    const pl = preset.toLowerCase()
    if (hay.some((h) => h.includes(pl) || pl.includes(h))) out.add(preset)
  }

  return [...out]
}

/**
 * @param {Record<string, unknown>} prevFormData
 * @param {Record<string, unknown>} preview — ответ API preview
 * @returns {{ nextFormData: Record<string, unknown>, customDistrictsToAdd: string[] }}
 */
export function mergeAirbnbPreviewWizard(prevFormData, preview) {
  const md = preview.metadata && typeof preview.metadata === 'object' ? preview.metadata : {}
  const pi = md.property_info && typeof md.property_info === 'object' ? md.property_info : {}

  const mappedAmenities = mapImportedAmenitiesToPresets(md)
  const prevMeta = prevFormData.metadata && typeof prevFormData.metadata === 'object' ? prevFormData.metadata : {}
  const mergedAmenities = [...new Set([...(Array.isArray(prevMeta.amenities) ? prevMeta.amenities : []), ...mappedAmenities])]

  const imgs = Array.isArray(preview.images) ? preview.images.map(String) : []
  const cover = preview.coverImage ? String(preview.coverImage) : ''
  const ordered = cover ? [cover, ...imgs.filter((u) => u && u !== cover)] : imgs
  const mergedUrls = [...new Set([...ordered, ...(Array.isArray(prevFormData.images) ? prevFormData.images : [])])]

  const district = (preview.district && String(preview.district)) || (md.city && String(md.city)) || prevFormData.district

  const lat = preview.latitude != null ? Number(preview.latitude) : prevFormData.latitude
  const lng = preview.longitude != null ? Number(preview.longitude) : prevFormData.longitude

  const price =
    preview.basePriceThb != null && Number(preview.basePriceThb) > 0
      ? String(preview.basePriceThb)
      : prevFormData.basePriceThb

  const workation =
    md.is_workation_ready === true || prevMeta.is_workation_ready === true ? true : undefined

  const incomingSeo = md.seo && typeof md.seo === 'object' ? md.seo : null
  const mergedSeo = incomingSeo
    ? { ...(prevMeta.seo && typeof prevMeta.seo === 'object' ? prevMeta.seo : {}), ...incomingSeo }
    : (prevMeta.seo && typeof prevMeta.seo === 'object' ? prevMeta.seo : undefined)

  const nextFormData = {
    ...prevFormData,
    title: (preview.title && String(preview.title)) || prevFormData.title,
    description: (preview.description && String(preview.description)) || prevFormData.description,
    basePriceThb: price,
    district: district || prevFormData.district,
    latitude: lat,
    longitude: lng,
    images: mergedUrls,
    metadata: {
      ...prevMeta,
      bedrooms: pi.bedrooms != null ? Number(pi.bedrooms) || prevMeta.bedrooms : prevMeta.bedrooms,
      bathrooms: pi.bathrooms != null ? Number(pi.bathrooms) || prevMeta.bathrooms : prevMeta.bathrooms,
      max_guests: pi.max_guests != null ? Number(pi.max_guests) || prevMeta.max_guests : prevMeta.max_guests,
      area: pi.square_meters != null ? Number(pi.square_meters) || prevMeta.area : prevMeta.area,
      amenities: mergedAmenities,
      import_source_url: preview.importExternalUrl,
      import_sync_snapshot: preview.syncSettings,
      ...(mergedSeo ? { seo: mergedSeo } : {}),
      ...(workation ? { is_workation_ready: true } : {}),
    },
  }

  return {
    nextFormData,
    customDistrictsToAdd: district && String(district).trim() ? [String(district).trim()] : [],
  }
}

/**
 * @param {Record<string, unknown>} prevFormData
 * @param {Record<string, unknown>} preview
 */
export function mergeAirbnbPreviewEdit(prevFormData, preview) {
  const md = preview.metadata && typeof preview.metadata === 'object' ? preview.metadata : {}
  const pi = md.property_info && typeof md.property_info === 'object' ? md.property_info : {}

  const mappedAmenities = mapImportedAmenitiesToPresets(md)
  const prevMeta = prevFormData.metadata && typeof prevFormData.metadata === 'object' ? prevFormData.metadata : {}
  const mergedAmenities = [...new Set([...(Array.isArray(prevMeta.amenities) ? prevMeta.amenities : []), ...mappedAmenities])]

  const imgs = Array.isArray(preview.images) ? preview.images.map(String) : []
  const cover = preview.coverImage ? String(preview.coverImage) : ''
  const ordered = cover ? [cover, ...imgs.filter((u) => u && u !== cover)] : imgs
  const mergedUrls = [...new Set([...ordered, ...(Array.isArray(prevFormData.images) ? prevFormData.images : [])])]

  const district = (preview.district && String(preview.district)) || (md.city && String(md.city)) || prevFormData.district

  const lat =
    preview.latitude != null && preview.latitude !== ''
      ? String(preview.latitude)
      : prevFormData.latitude
  const lng =
    preview.longitude != null && preview.longitude !== ''
      ? String(preview.longitude)
      : prevFormData.longitude

  const price =
    preview.basePriceThb != null && Number(preview.basePriceThb) > 0
      ? String(preview.basePriceThb)
      : prevFormData.basePriceThb

  const coverIndex = ordered.length > 0 ? 0 : prevFormData.coverIndex

  const workation =
    md.is_workation_ready === true || prevMeta.is_workation_ready === true ? true : undefined

  const incomingSeo = md.seo && typeof md.seo === 'object' ? md.seo : null
  const mergedSeoEdit = incomingSeo
    ? { ...(prevMeta.seo && typeof prevMeta.seo === 'object' ? prevMeta.seo : {}), ...incomingSeo }
    : (prevMeta.seo && typeof prevMeta.seo === 'object' ? prevMeta.seo : undefined)

  return {
    nextFormData: {
      ...prevFormData,
      title: (preview.title && String(preview.title)) || prevFormData.title,
      description: (preview.description && String(preview.description)) || prevFormData.description,
      basePriceThb: price,
      district: district || prevFormData.district,
      latitude: lat,
      longitude: lng,
      images: mergedUrls,
      coverIndex,
      metadata: {
        ...prevMeta,
        bedrooms: pi.bedrooms != null ? Number(pi.bedrooms) || prevMeta.bedrooms : prevMeta.bedrooms,
        bathrooms: pi.bathrooms != null ? Number(pi.bathrooms) || prevMeta.bathrooms : prevMeta.bathrooms,
        max_guests: pi.max_guests != null ? Number(pi.max_guests) || prevMeta.max_guests : prevMeta.max_guests,
        area: pi.square_meters != null ? Number(pi.square_meters) || prevMeta.area : prevMeta.area,
        amenities: mergedAmenities,
        property_info: { ...prevMeta.property_info, ...pi },
        amenities_detail: md.amenities,
        rules: md.rules,
        import_source_url: preview.importExternalUrl,
        import_sync_snapshot: preview.syncSettings,
        ...(mergedSeoEdit ? { seo: mergedSeoEdit } : {}),
        ...(workation ? { is_workation_ready: true } : {}),
      },
    },
  }
}
