/**
 * Нормализация ответа GET /api/v2/categories для UI (главная, каталог).
 */

/** @param {unknown} data */
export function mapCategoriesFromApi(data) {
  if (!Array.isArray(data)) return []
  return data
    .filter((c) => c && (c.isActive === true || c.is_active === true))
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      order: c.order,
      isActive: c.isActive ?? true,
      isComingSoon: c.isComingSoon === true,
      isPreviewOnly: c.isPreviewOnly === true,
      isPreview: c.isPreview === true,
      wizardProfile: c.wizardProfile ?? c.wizard_profile ?? null,
      parentId: c.parentId ?? c.parent_id ?? null,
      nameI18n: c.nameI18n ?? c.name_i18n ?? null,
    }))
}
