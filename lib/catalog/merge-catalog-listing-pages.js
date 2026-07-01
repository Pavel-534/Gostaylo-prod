/**
 * Stage 177.2 — flatten cursor pages with stable id dedupe (catalog infinite scroll).
 */

/**
 * @param {object[][]} pages
 * @returns {object[]}
 */
export function mergeCatalogListingPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return []

  const seen = new Set()
  const out = []

  for (const page of pages) {
    if (!Array.isArray(page)) continue
    for (const row of page) {
      const id = row?.id != null ? String(row.id).trim() : ''
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(row)
    }
  }

  return out
}
