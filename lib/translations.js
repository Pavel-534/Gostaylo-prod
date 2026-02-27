/**
 * FunnyRent 2.1 - Multi-language Translations System
 * Supports: RU (Russian), EN (English), ZH (Chinese), TH (Thai)
 */

// Default translations for categories
export const categoryTranslations = {
  'property': {
    ru: 'Недвижимость',
    en: 'Property',
    zh: '房产',
    th: 'อสังหาริมทรัพย์'
  },
  'vehicles': {
    ru: 'Транспорт',
    en: 'Vehicles',
    zh: '车辆',
    th: 'ยานพาหนะ'
  },
  'tours': {
    ru: 'Туры',
    en: 'Tours',
    zh: '旅游',
    th: 'ทัวร์'
  },
  'yachts': {
    ru: 'Яхты',
    en: 'Yachts',
    zh: '游艇',
    th: 'เรือยอชท์'
  },
  'fishing': {
    ru: 'Рыбалка',
    en: 'Fishing',
    zh: '钓鱼',
    th: 'ตกปลา'
  },
  'events': {
    ru: 'Мероприятия',
    en: 'Events',
    zh: '活动',
    th: 'กิจกรรม'
  },
  'services': {
    ru: 'Услуги',
    en: 'Services',
    zh: '服务',
    th: 'บริการ'
  }
}

// UI Translations
export const uiTranslations = {
  ru: {
    search: 'Поиск',
    selectDates: 'Выбрать даты',
    allCategories: 'Все категории',
    allDistricts: 'Все районы',
    pricePerDay: 'в день',
    bookNow: 'Забронировать',
    login: 'Войти',
    logout: 'Выход',
    dashboard: 'Панель управления',
    listings: 'Листинги',
    bookings: 'Бронирования',
    messages: 'Сообщения',
    settings: 'Настройки',
    currentListings: 'Актуальные предложения',
    categories: 'Категории услуг',
    found: 'Найдено',
    objects: 'объектов'
  },
  en: {
    search: 'Search',
    selectDates: 'Select dates',
    allCategories: 'All categories',
    allDistricts: 'All districts',
    pricePerDay: 'per day',
    bookNow: 'Book now',
    login: 'Login',
    logout: 'Logout',
    dashboard: 'Dashboard',
    listings: 'Listings',
    bookings: 'Bookings',
    messages: 'Messages',
    settings: 'Settings',
    currentListings: 'Current offers',
    categories: 'Service categories',
    found: 'Found',
    objects: 'objects'
  },
  zh: {
    search: '搜索',
    selectDates: '选择日期',
    allCategories: '所有类别',
    allDistricts: '所有地区',
    pricePerDay: '每天',
    bookNow: '立即预订',
    login: '登录',
    logout: '退出',
    dashboard: '控制面板',
    listings: '房源',
    bookings: '预订',
    messages: '消息',
    settings: '设置',
    currentListings: '当前优惠',
    categories: '服务类别',
    found: '找到',
    objects: '个项目'
  },
  th: {
    search: 'ค้นหา',
    selectDates: 'เลือกวันที่',
    allCategories: 'ทุกหมวดหมู่',
    allDistricts: 'ทุกเขต',
    pricePerDay: 'ต่อวัน',
    bookNow: 'จองเลย',
    login: 'เข้าสู่ระบบ',
    logout: 'ออกจากระบบ',
    dashboard: 'แดชบอร์ด',
    listings: 'รายการ',
    bookings: 'การจอง',
    messages: 'ข้อความ',
    settings: 'การตั้งค่า',
    currentListings: 'ข้อเสนอปัจจุบัน',
    categories: 'หมวดหมู่บริการ',
    found: 'พบ',
    objects: 'รายการ'
  }
}

// Supported languages
export const supportedLanguages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' }
]

/**
 * Get category name in specified language
 * @param {string} slug - Category slug
 * @param {string} lang - Language code (ru, en, zh, th)
 * @param {string} fallback - Fallback name if translation not found
 * @returns {string} Translated category name
 */
export function getCategoryName(slug, lang = 'ru', fallback = '') {
  const translations = categoryTranslations[slug?.toLowerCase()]
  if (translations && translations[lang]) {
    return translations[lang]
  }
  return fallback || slug
}

/**
 * Get UI text in specified language
 * @param {string} key - Translation key
 * @param {string} lang - Language code
 * @returns {string} Translated text
 */
export function getUIText(key, lang = 'ru') {
  return uiTranslations[lang]?.[key] || uiTranslations['ru'][key] || key
}

/**
 * Detect user's preferred language from browser
 * @returns {string} Language code
 */
export function detectLanguage() {
  if (typeof window === 'undefined') return 'ru'
  
  const stored = localStorage.getItem('funnyrent_language')
  if (stored && supportedLanguages.find(l => l.code === stored)) {
    return stored
  }
  
  const browserLang = navigator.language?.slice(0, 2).toLowerCase()
  const supported = supportedLanguages.find(l => l.code === browserLang)
  return supported ? browserLang : 'ru'
}

/**
 * Set user's preferred language
 * @param {string} lang - Language code
 */
export function setLanguage(lang) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('funnyrent_language', lang)
  }
}
