/**
 * Geographic presets for listing form (Country → Region → City → District).
 *
 * SSOT districts (Phuket): `lib/locations/phuket-districts-canonical.js`
 * DB FK target: `geo_locations` (see supabase/migrations/20260201_global_pivot.sql)
 *
 * @created 2026-02 Global Pivot — Listing form schema prep
 */

import { PHUKET_DISTRICTS_CANON } from '@/lib/locations/phuket-districts-canonical'

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
            districts: [...PHUKET_DISTRICTS_CANON],
          },
        ],
      },
      {
        code: 'TH-PTY',
        labels: { ru: 'Паттайя', en: 'Pattaya', zh: '芭堤雅', th: 'พัทยา' },
        cities: [
          {
            code: 'pattaya',
            labels: { ru: 'Паттайя', en: 'Pattaya', zh: '芭堤雅', th: 'พัทยา' },
            districts: ['Jomtien', 'Naklua', 'Central Pattaya', 'Pratumnak'],
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
        code: 'RU-TA',
        labels: { ru: 'Татарстан', en: 'Tatarstan', zh: '鞑靼斯坦', th: 'ตาตาร์สถาน' },
        cities: [
          {
            code: 'kazan',
            labels: { ru: 'Казань', en: 'Kazan', zh: '喀山', th: 'คาซาน' },
            districts: ['Центр', 'Вахитовский', 'Советский', 'Приволжский', 'Новая Савиновка'],
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
            districts: ['Seminyak', 'Canggu', 'Sanur', 'Kuta', 'Legian', 'Jimbaran'],
          },
          {
            code: 'ubud',
            labels: { ru: 'Убуд', en: 'Ubud', zh: '乌布', th: 'อูบุด' },
            districts: ['Central Ubud', 'Penestanan', 'Tegallalang', 'Sayan'],
          },
          {
            code: 'uluwatu',
            labels: { ru: 'Улувату', en: 'Uluwatu', zh: '乌鲁瓦图', th: 'อูลูวาตู' },
            districts: ['Pecatu', 'Bingin', 'Padang-Padang', 'Nusa Dua'],
          },
        ],
      },
      {
        code: 'ID-JK',
        labels: { ru: 'Джакарта', en: 'Jakarta', zh: '雅加达', th: 'จาการ์ตา' },
        cities: [
          {
            code: 'jakarta',
            labels: { ru: 'Джакарта', en: 'Jakarta', zh: '雅加达', th: 'จาการ์ตา' },
            districts: ['Menteng', 'Kemang', 'Kuningan', 'Sudirman', 'Senayan'],
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
            districts: ['Marina', 'Downtown', 'JBR', 'Palm Jumeirah', 'Business Bay', 'DIFC', 'Jumeirah'],
          },
        ],
      },
      {
        code: 'AE-AZ',
        labels: { ru: 'Абу-Даби', en: 'Abu Dhabi', zh: '阿布扎比', th: 'อาบูดาบี' },
        cities: [
          {
            code: 'abu-dhabi',
            labels: { ru: 'Абу-Даби', en: 'Abu Dhabi', zh: '阿布扎比', th: 'อาบูดาบี' },
            districts: ['Corniche', 'Yas Island', 'Saadiyat', 'Al Reem', 'Khalifa City'],
          },
        ],
      },
    ],
  },
  {
    code: 'TR',
    flag: '🇹🇷',
    labels: { ru: 'Турция', en: 'Turkey', zh: '土耳其', th: 'ตุรกี' },
    regions: [
      {
        code: 'TR-34',
        labels: { ru: 'Стамбул', en: 'Istanbul', zh: '伊斯坦布尔省', th: 'อิสตันบูล' },
        cities: [
          {
            code: 'istanbul',
            labels: { ru: 'Стамбул', en: 'Istanbul', zh: '伊斯坦布尔', th: 'อิสตันบูล' },
            districts: ['Beyoğlu', 'Sultanahmet', 'Beşiktaş', 'Kadıköy', 'Şişli', 'Bebek'],
          },
        ],
      },
      {
        code: 'TR-07',
        labels: { ru: 'Анталия', en: 'Antalya', zh: '安塔利亚省', th: 'อันตัลยา' },
        cities: [
          {
            code: 'antalya',
            labels: { ru: 'Анталия', en: 'Antalya', zh: '安塔利亚', th: 'อันตัลยา' },
            districts: ['Old Town (Kaleiçi)', 'Konyaaltı', 'Lara', 'Belek', 'Side'],
          },
        ],
      },
      {
        code: 'TR-48',
        labels: { ru: 'Мугла', en: 'Muğla', zh: '穆拉省', th: 'มูลา' },
        cities: [
          {
            code: 'bodrum',
            labels: { ru: 'Бодрум', en: 'Bodrum', zh: '博德鲁姆', th: 'บอดรุม' },
            districts: ['Bodrum Center', 'Yalıkavak', 'Türkbükü', 'Gümüşlük', 'Turgutreis'],
          },
          {
            code: 'fethiye',
            labels: { ru: 'Фетхие', en: 'Fethiye', zh: '费特希耶', th: 'เฟทิเย' },
            districts: ['Ölüdeniz', 'Çalış', 'Hisarönü', 'Kayaköy'],
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
