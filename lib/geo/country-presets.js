/**
 * Geographic presets for listing form (Country → Region → City → District).
 *
 * STUB: this is a frontend-only static config to prepare UI for the global pivot.
 * Backend schema migration to support these as proper FK relations is planned next.
 *
 * Structure: каскадные опции (RU/EN/ZH/TH)
 *
 * @created 2026-02 Global Pivot — Listing form schema prep
 */

export const COUNTRY_PRESETS = [
  {
    code: 'TH',
    flag: '🇹🇭',
    labels: { ru: 'Таиланд', en: 'Thailand', zh: '泰国', th: 'ประเทศไทย' },
    regions: [
      {
        code: 'TH-PHK',
        labels: { ru: 'Пхукет', en: 'Phuket', zh: '普吉府', th: 'ภูเก็ต' },
        cities: [
          {
            code: 'phuket-city',
            labels: { ru: 'Пхукет', en: 'Phuket', zh: '普吉镇', th: 'เมืองภูเก็ต' },
            districts: [
              'Patong', 'Kamala', 'Bang Tao', 'Surin', 'Kata', 'Karon',
              'Rawai', 'Nai Harn', 'Chalong', 'Panwa', 'Mai Khao', 'Nai Yang',
            ],
          },
        ],
      },
      {
        code: 'TH-BKK',
        labels: { ru: 'Бангкок', en: 'Bangkok', zh: '曼谷', th: 'กรุงเทพ' },
        cities: [
          {
            code: 'bangkok',
            labels: { ru: 'Бангкок', en: 'Bangkok', zh: '曼谷', th: 'กรุงเทพ' },
            districts: ['Sukhumvit', 'Silom', 'Sathorn', 'Chinatown', 'Riverside', 'Khaosan'],
          },
        ],
      },
      {
        code: 'TH-SUR',
        labels: { ru: 'Сурат-Тани', en: 'Surat Thani', zh: '素叻府', th: 'สุราษฎร์ธานี' },
        cities: [
          {
            code: 'samui',
            labels: { ru: 'Самуи', en: 'Koh Samui', zh: '苏梅岛', th: 'เกาะสมุย' },
            districts: ['Chaweng', 'Lamai', 'Bophut', 'Maenam', 'Bangrak'],
          },
        ],
      },
      {
        code: 'TH-KRA',
        labels: { ru: 'Краби', en: 'Krabi', zh: '甲米府', th: 'กระบี่' },
        cities: [
          {
            code: 'krabi-city',
            labels: { ru: 'Краби', en: 'Krabi', zh: '甲米', th: 'กระบี่' },
            districts: ['Ao Nang', 'Klong Muang', 'Tubkaek', 'Railay'],
          },
        ],
      },
    ],
  },
  {
    code: 'RU',
    flag: '🇷🇺',
    labels: { ru: 'Россия', en: 'Russia', zh: '俄罗斯', th: 'รัสเซีย' },
    regions: [
      {
        code: 'RU-MOW',
        labels: { ru: 'Москва', en: 'Moscow', zh: '莫斯科市', th: 'มอสโก' },
        cities: [
          {
            code: 'moscow',
            labels: { ru: 'Москва', en: 'Moscow', zh: '莫斯科', th: 'มอสโก' },
            districts: ['Центр', 'Арбат', 'Тверская', 'Хамовники', 'Замоскворечье', 'Пресня'],
          },
        ],
      },
      {
        code: 'RU-SPB',
        labels: { ru: 'Санкт-Петербург', en: 'Saint Petersburg', zh: '圣彼得堡市', th: 'เซนต์ปีเตอร์สเบิร์ก' },
        cities: [
          {
            code: 'spb',
            labels: { ru: 'Санкт-Петербург', en: 'Saint Petersburg', zh: '圣彼得堡', th: 'เซนต์ปีเตอร์สเบิร์ก' },
            districts: ['Центральный', 'Адмиралтейский', 'Петроградский', 'Васильевский', 'Невский'],
          },
        ],
      },
      {
        code: 'RU-KDA',
        labels: { ru: 'Краснодарский край', en: 'Krasnodar Krai', zh: '克拉斯诺达尔', th: 'ครัสโนดาร์' },
        cities: [
          {
            code: 'sochi',
            labels: { ru: 'Сочи', en: 'Sochi', zh: '索契', th: 'โซชี' },
            districts: ['Центральный', 'Адлерский', 'Хостинский', 'Лазаревский'],
          },
        ],
      },
    ],
  },
  {
    code: 'ID',
    flag: '🇮🇩',
    labels: { ru: 'Индонезия', en: 'Indonesia', zh: '印度尼西亚', th: 'อินโดนีเซีย' },
    regions: [
      {
        code: 'ID-BA',
        labels: { ru: 'Бали', en: 'Bali', zh: '巴厘省', th: 'บาหลี' },
        cities: [
          {
            code: 'denpasar',
            labels: { ru: 'Денпасар', en: 'Denpasar', zh: '登巴萨', th: 'เดนปาซาร์' },
            districts: ['Seminyak', 'Canggu', 'Ubud', 'Uluwatu', 'Sanur', 'Kuta'],
          },
        ],
      },
    ],
  },
  {
    code: 'AE',
    flag: '🇦🇪',
    labels: { ru: 'ОАЭ', en: 'UAE', zh: '阿联酋', th: 'ยูเออี' },
    regions: [
      {
        code: 'AE-DU',
        labels: { ru: 'Дубай', en: 'Dubai', zh: '迪拜', th: 'ดูไบ' },
        cities: [
          {
            code: 'dubai',
            labels: { ru: 'Дубай', en: 'Dubai', zh: '迪拜', th: 'ดูไบ' },
            districts: ['Marina', 'Downtown', 'JBR', 'Palm Jumeirah', 'Business Bay'],
          },
        ],
      },
    ],
  },
]

export function findCountry(code) {
  return COUNTRY_PRESETS.find((c) => c.code === code) || null
}
export function findRegion(countryCode, regionCode) {
  return findCountry(countryCode)?.regions.find((r) => r.code === regionCode) || null
}
export function findCity(countryCode, regionCode, cityCode) {
  return findRegion(countryCode, regionCode)?.cities.find((c) => c.code === cityCode) || null
}
export function getLabel(item, lang = 'ru') {
  if (!item) return ''
  return item.labels?.[lang] || item.labels?.en || item.code || ''
}
