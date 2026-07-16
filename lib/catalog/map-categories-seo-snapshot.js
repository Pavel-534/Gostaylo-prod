/**
 * Map server SEO categories snapshot → client `usePublicCategoriesQuery` shape.
 */

import { mapCategoriesFromApi } from '@/lib/catalog/map-categories-api'

/**
 * @param {Array<Record<string, unknown>> | null | undefined} rows
 */
export function mapCategoriesFromSeoSnapshot(rows) {
  if (!Array.isArray(rows) || !rows.length) return []
  return mapCategoriesFromApi(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      order: c.order,
      is_active: true,
      wizard_profile: c.wizard_profile ?? c.wizardProfile ?? null,
      parent_id: c.parent_id ?? c.parentId ?? null,
      name_i18n: c.name_i18n ?? c.nameI18n ?? null,
    })),
  )
}
