/**
 * Popular destinations — единый список для quick-chips на главной и в mobile bottom sheet.
 *
 * Структура подготовлена под глобальный агрегатор: country (для группировки)
 * + value (canonical slug, должен совпадать с where-options для маппинга на каталог).
 *
 * Локализация — labels по языкам (ru/en/zh/th).
 *
 * @created 2026-02 Global Pivot — переход с phuket-only на мировой список
 */

export const POPULAR_DESTINATION_GROUPS = [
  {
    id: 'russia',
    flag: '🇷🇺',
    titles: { ru: 'Россия', en: 'Russia', zh: '俄罗斯', th: 'รัสเซีย' },
    items: [
      { value: 'moscow',   labels: { ru: 'Москва',          en: 'Moscow',         zh: '莫斯科',     th: 'มอสโก' } },
      { value: 'spb',      labels: { ru: 'Санкт-Петербург', en: 'Saint Petersburg', zh: '圣彼得堡', th: 'เซนต์ปีเตอร์สเบิร์ก' } },
      { value: 'sochi',    labels: { ru: 'Сочи',            en: 'Sochi',          zh: '索契',        th: 'โซชี' } },
      { value: 'kazan',    labels: { ru: 'Казань',          en: 'Kazan',          zh: '喀山',        th: 'คาซาน' } },
    ],
  },
  {
    id: 'thailand',
    flag: '🇹🇭',
    titles: { ru: 'Таиланд', en: 'Thailand', zh: '泰国', th: 'ประเทศไทย' },
    items: [
      { value: 'phuket',   labels: { ru: 'Пхукет',  en: 'Phuket',  zh: '普吉岛',  th: 'ภูเก็ต' } },
      { value: 'bangkok',  labels: { ru: 'Бангкок', en: 'Bangkok', zh: '曼谷',    th: 'กรุงเทพ' } },
      { value: 'samui',    labels: { ru: 'Самуи',   en: 'Koh Samui', zh: '苏梅岛', th: 'เกาะสมุย' } },
      { value: 'pattaya',  labels: { ru: 'Паттайя', en: 'Pattaya', zh: '芭提雅',  th: 'พัทยา' } },
      { value: 'krabi',    labels: { ru: 'Краби',   en: 'Krabi',   zh: '甲米',    th: 'กระบี่' } },
    ],
  },
  {
    id: 'world',
    flag: '🌍',
    titles: { ru: 'Мир', en: 'World', zh: '世界', th: 'โลก' },
    items: [
      { value: 'bali',      labels: { ru: 'Бали',      en: 'Bali',      zh: '巴厘岛',  th: 'บาหลี' } },
      { value: 'dubai',     labels: { ru: 'Дубай',     en: 'Dubai',     zh: '迪拜',    th: 'ดูไบ' } },
      { value: 'istanbul',  labels: { ru: 'Стамбул',   en: 'Istanbul',  zh: '伊斯坦布尔', th: 'อิสตันบูล' } },
      { value: 'barcelona', labels: { ru: 'Барселона', en: 'Barcelona', zh: '巴塞罗那', th: 'บาร์เซโลนา' } },
    ],
  },
]

/** Уплощённый массив для places, где не нужна группировка */
export const POPULAR_DESTINATIONS_FLAT = POPULAR_DESTINATION_GROUPS.flatMap((g) => g.items)

export function getDestinationLabel(value, language = 'ru') {
  const item = POPULAR_DESTINATIONS_FLAT.find((d) => d.value === value)
  return item ? item.labels[language] || item.labels.en : value
}
