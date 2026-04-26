/**
 * Stage 69.2 — SEO `/listings` (metadata): шаблоны в i18n SSOT.
 * Ключи: `catalogSeo_{profile}_{title|description}` + вспомогательные `catalogSeo_place_*`, `catalogSeo_count_*`.
 * Плейсхолдеры: `{categoryName}`, `{location}`, `{count}`, `{where}`, `{brand}` ({brand} подставляет getUIText через injectBrand).
 */

/** @type {Record<string, Record<string, string>>} */
export const catalogSeoUi = {
  ru: {
    /** Имя по умолчанию, если нет slug/name (редко) */
    catalogSeo_fallback_categoryName: 'Аренда и услуги',
    catalogSeo_place_title_default: 'на Пхукете',
    catalogSeo_place_title_where: 'в {where}, на Пхукете',
    catalogSeo_place_desc_default: 'на Пхукете',
    catalogSeo_place_desc_where: 'в районе {where} на Пхукете',
    catalogSeo_count_zero: 'В этой категории пока нет объявлений. ',
    catalogSeo_count_ru_one: '{count} объявление. ',
    catalogSeo_count_ru_few: '{count} объявления. ',
    catalogSeo_count_ru_many: '{count} объявлений. ',
    catalogSeo_stay_title: '«{categoryName}» — жильё {location} | {brand}',
    catalogSeo_stay_description:
      '{count}Раздел «{categoryName}», {location}: фото, цены и бронирование на {brand}.',
    catalogSeo_transport_title: '«{categoryName}» — транспорт {location} | {brand}',
    catalogSeo_transport_description:
      '{count}«{categoryName}» {location}: цены, фото, отзывы — бронирование на {brand}.',
    catalogSeo_service_title: '«{categoryName}» — услуги {location} | {brand}',
    catalogSeo_service_description:
      '{count}«{categoryName}» {location}: проверенные объявления и отзывы на {brand}.',
    catalogSeo_nanny_title: 'Няни и ситтеры {location} | {brand}',
    catalogSeo_nanny_description:
      '{count}«{categoryName}» {location}: опыт, языки, форматы — каталог на {brand}.',
    catalogSeo_chef_title: 'Повара на дом {location} | {brand}',
    catalogSeo_chef_description:
      '{count}«{categoryName}» {location}: выезд и мероприятия — на {brand}.',
    catalogSeo_tour_title: 'Туры и впечатления {location} | {brand}',
    catalogSeo_tour_description:
      '{count}«{categoryName}» {location}: экскурсии и активности на {brand}.',
    catalogSeo_default_title: '«{categoryName}» {location} | {brand}',
    catalogSeo_default_description: '{count}«{categoryName}» {location} — каталог на {brand}.',
  },
  en: {
    catalogSeo_fallback_categoryName: 'Rentals & services',
    catalogSeo_place_title_default: 'in Phuket',
    catalogSeo_place_title_where: 'in {where}, Phuket',
    catalogSeo_place_desc_default: 'in Phuket',
    catalogSeo_place_desc_where: 'around {where}, Phuket',
    catalogSeo_count_zero: 'No listings in this category yet. ',
    catalogSeo_count_en_one: '{count} listing. ',
    catalogSeo_count_en_other: '{count} listings. ',
    catalogSeo_stay_title: '«{categoryName}» — stays {location} | {brand}',
    catalogSeo_stay_description:
      '{count}«{categoryName}» {location}: photos, prices, book on {brand}.',
    catalogSeo_transport_title: '«{categoryName}» — rent {location} | {brand}',
    catalogSeo_transport_description:
      '{count}«{categoryName}» {location}: prices, photos & reviews on {brand}.',
    catalogSeo_service_title: '«{categoryName}» — book online {location} | {brand}',
    catalogSeo_service_description:
      '{count}«{categoryName}» {location}: vetted listings on {brand}.',
    catalogSeo_nanny_title: 'Nannies & sitters {location} | {brand}',
    catalogSeo_nanny_description:
      '{count}«{categoryName}» {location}: experience & formats on {brand}.',
    catalogSeo_chef_title: 'Private chefs {location} | {brand}',
    catalogSeo_chef_description:
      '{count}«{categoryName}» {location}: dining & events on {brand}.',
    catalogSeo_tour_title: 'Tours & experiences {location} | {brand}',
    catalogSeo_tour_description:
      '{count}«{categoryName}» {location}: activities on {brand}.',
    catalogSeo_default_title: '«{categoryName}» {location} | {brand}',
    catalogSeo_default_description: '{count}«{categoryName}» {location} — {brand}.',
  },
  zh: {
    catalogSeo_fallback_categoryName: '租赁与服务',
    catalogSeo_place_title_default: '普吉岛',
    catalogSeo_place_title_where: '{where} · 普吉岛',
    catalogSeo_place_desc_default: '普吉岛',
    catalogSeo_place_desc_where: '普吉岛 · {where} 一带',
    catalogSeo_count_zero: '该分类下暂无房源。 ',
    catalogSeo_count_zh: '共 {count} 条。 ',
    catalogSeo_stay_title: '「{categoryName}」住宿 {location} | {brand}',
    catalogSeo_stay_description: '{count}「{categoryName}」{location}：照片、价格，{brand} 在线预订。',
    catalogSeo_transport_title: '「{categoryName}」交通租赁 {location} | {brand}',
    catalogSeo_transport_description: '{count}「{categoryName}」{location}：价格与评价，{brand}。',
    catalogSeo_service_title: '「{categoryName}」服务 {location} | {brand}',
    catalogSeo_service_description: '{count}「{categoryName}」{location}：精选信息，{brand}。',
    catalogSeo_nanny_title: '保姆与临时看护 {location} | {brand}',
    catalogSeo_nanny_description: '{count}「{categoryName}」{location}：{brand}。',
    catalogSeo_chef_title: '私厨上门 {location} | {brand}',
    catalogSeo_chef_description: '{count}「{categoryName}」{location}：{brand}。',
    catalogSeo_tour_title: '行程与体验 {location} | {brand}',
    catalogSeo_tour_description: '{count}「{categoryName}」{location}：{brand}。',
    catalogSeo_default_title: '「{categoryName}」{location} | {brand}',
    catalogSeo_default_description: '{count}「{categoryName}」{location} — {brand}。',
  },
  th: {
    catalogSeo_fallback_categoryName: 'เช่าและบริการ',
    catalogSeo_place_title_default: 'ในภูเก็ต',
    catalogSeo_place_title_where: 'ที่ {where} ภูเก็ต',
    catalogSeo_place_desc_default: 'ในภูเก็ต',
    catalogSeo_place_desc_where: 'บริเวณ {where} ภูเก็ต',
    catalogSeo_count_zero: 'ยังไม่มีประกาศในหมวดนี้ ',
    catalogSeo_count_th: '{count} รายการ ',
    catalogSeo_stay_title: '«{categoryName}» ที่พัก {location} | {brand}',
    catalogSeo_stay_description: '{count}«{categoryName}» {location}: ราคา ภาพ จองที่ {brand}',
    catalogSeo_transport_title: '«{categoryName}» เช่า {location} | {brand}',
    catalogSeo_transport_description: '{count}«{categoryName}» {location}: รีวิวและราคา — {brand}',
    catalogSeo_service_title: '«{categoryName}» บริการ {location} | {brand}',
    catalogSeo_service_description: '{count}«{categoryName}» {location}: คัดแล้วบน {brand}',
    catalogSeo_nanny_title: 'พี่เลี้ง/พี่เลี้งเด็ก {location} | {brand}',
    catalogSeo_nanny_description: '{count}«{categoryName}» {location}: ดูที่ {brand}',
    catalogSeo_chef_title: 'เชฟมาทำที่บ้าน {location} | {brand}',
    catalogSeo_chef_description: '{count}«{categoryName}» {location}: {brand}',
    catalogSeo_tour_title: 'ทัวร์และกิจกรรม {location} | {brand}',
    catalogSeo_tour_description: '{count}«{categoryName}» {location}: {brand}',
    catalogSeo_default_title: '«{categoryName}» {location} | {brand}',
    catalogSeo_default_description: '{count}«{categoryName}» {location} — {brand}',
  },
}
