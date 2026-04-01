/**
 * Пост-фильтрация объявлений по полям metadata (после Supabase).
 */

/**
 * @param {import('next/server').NextRequest|URL} requestOrUrl
 */
export function buildMetadataFiltersFromSearchParams(searchParams) {
  const sp = searchParams
  const firstFloat = (...keys) => {
    for (const k of keys) {
      const v = sp.get(k)
      if (v != null && v !== '') {
        const n = parseFloat(v)
        if (Number.isFinite(n)) return n
      }
    }
    return null
  }
  const firstInt = (...keys) => {
    for (const k of keys) {
      const v = sp.get(k)
      if (v != null && v !== '') {
        const n = parseInt(v, 10)
        if (Number.isFinite(n)) return n
      }
    }
    return null
  }
  const commaList = (key) => {
    const raw = sp.get(key)
    if (!raw) return []
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  return {
    bedroomsMin: firstInt('bedrooms', 'bedrooms_min'),
    bathroomsMin: firstInt('bathrooms', 'bathrooms_min'),
    amenities: commaList('amenities').map((s) => s.toLowerCase()),
    transmission: sp.get('transmission')?.trim() || null,
    fuelType: sp.get('fuel_type')?.trim() || sp.get('fuelType')?.trim() || null,
    engineCcMin: firstFloat('engine_cc_min', 'engineCcMin'),
    nannyLangs: commaList('nanny_langs').map((s) => s.toLowerCase()),
    nannyExperienceMin: firstInt('nanny_experience_min', 'nannyExperienceMin'),
    nannySpecialization: sp.get('nanny_specialization')?.trim() || sp.get('nannySpecialization')?.trim() || null,
  }
}

export function metadataFiltersActive(f) {
  if (!f) return false
  return !!(
    f.bedroomsMin != null ||
    f.bathroomsMin != null ||
    (f.amenities && f.amenities.length) ||
    f.transmission ||
    f.fuelType ||
    f.engineCcMin != null ||
    (f.nannyLangs && f.nannyLangs.length) ||
    f.nannyExperienceMin != null ||
    f.nannySpecialization
  )
}

/**
 * @param {object} listing — raw row с metadata
 * @param {ReturnType<typeof buildMetadataFiltersFromSearchParams>} f
 */
export function listingMatchesMetadataFilters(listing, f) {
  if (!f || !metadataFiltersActive(f)) return true
  const m = listing.metadata || {}

  if (f.bedroomsMin != null) {
    const b = parseInt(m.bedrooms, 10)
    if (!Number.isFinite(b) || b < f.bedroomsMin) return false
  }
  if (f.bathroomsMin != null) {
    const b = parseInt(m.bathrooms, 10)
    if (!Number.isFinite(b) || b < f.bathroomsMin) return false
  }
  if (f.amenities?.length) {
    const listingA = Array.isArray(m.amenities)
      ? m.amenities.map((x) => String(x).toLowerCase())
      : []
    for (const a of f.amenities) {
      if (!listingA.includes(String(a).toLowerCase())) return false
    }
  }

  if (f.transmission) {
    const t = String(m.transmission || m.gearbox || '').toLowerCase()
    if (!t.includes(String(f.transmission).toLowerCase())) return false
  }
  if (f.fuelType) {
    const fu = String(m.fuel_type || m.fuel || '').toLowerCase()
    if (!fu.includes(String(f.fuelType).toLowerCase())) return false
  }
  if (f.engineCcMin != null) {
    const cc = parseFloat(m.engine_cc ?? m.engine_displacement ?? m.engine_size_cc ?? m.engine ?? 0)
    if (!Number.isFinite(cc) || cc < f.engineCcMin) return false
  }

  if (f.nannyLangs?.length) {
    const raw = m.languages ?? m.languages_spoken ?? m.language ?? ''
    const arr = Array.isArray(raw)
      ? raw.map((x) => String(x).toLowerCase())
      : String(raw)
          .split(/[,;]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
    const matchesLang = (lang) =>
      arr.some(
        (x) =>
          x.includes(String(lang).toLowerCase()) ||
          String(lang).toLowerCase().includes(x)
      )
    if (!f.nannyLangs.every((lang) => matchesLang(lang))) return false
  }
  if (f.nannyExperienceMin != null) {
    const ex = parseInt(m.experience_years ?? m.experience ?? m.years_experience, 10)
    if (!Number.isFinite(ex) || ex < f.nannyExperienceMin) return false
  }
  if (f.nannySpecialization) {
    const spec = `${m.specialization || ''} ${m.specialities || ''} ${m.specialty || ''} ${m.skills || ''}`.toLowerCase()
    if (!spec.includes(String(f.nannySpecialization).toLowerCase())) return false
  }

  return true
}
