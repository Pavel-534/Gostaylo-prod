/**
 * FunnyRent 2.1 - Complete Multi-language Translations System
 * Supports: RU (Russian), EN (English), ZH (Chinese), TH (Thai)
 */

// Category translations
export const categoryTranslations = {
  'property': { ru: 'Недвижимость', en: 'Property', zh: '房产', th: 'อสังหาริมทรัพย์' },
  'vehicles': { ru: 'Транспорт', en: 'Vehicles', zh: '车辆', th: 'ยานพาหนะ' },
  'tours': { ru: 'Туры', en: 'Tours', zh: '旅游', th: 'ทัวร์' },
  'yachts': { ru: 'Яхты', en: 'Yachts', zh: '游艇', th: 'เรือยอชท์' },
  'fishing': { ru: 'Рыбалка', en: 'Fishing', zh: '钓鱼', th: 'ตกปลา' },
  'events': { ru: 'Мероприятия', en: 'Events', zh: '活动', th: 'กิจกรรม' },
  'services': { ru: 'Услуги', en: 'Services', zh: '服务', th: 'บริการ' }
}

// Complete UI Translations Dictionary
export const uiTranslations = {
  ru: {
    // Header & Navigation
    search: 'Поиск',
    searchPlaceholder: 'Поиск...',
    login: 'Войти',
    logout: 'Выход',
    register: 'Регистрация',
    backToHome: 'На главную',
    
    // Hero Section
    heroTitle: 'Роскошная аренда',
    heroTitleHighlight: 'на Пхукете',
    heroSubtitle: 'Виллы, яхты, автомобили и туры — всё в одном месте',
    
    // Search & Filters
    selectDates: 'Выбрать даты',
    allCategories: 'Все категории',
    allDistricts: 'Все районы',
    category: 'Категория',
    district: 'Район',
    
    // Date Picker
    datePickerTitle: 'Выберите даты',
    datePickerDesc: 'Выберите даты заезда и выезда',
    checkIn: 'Заезд',
    checkOut: 'Выезд',
    clear: 'Сбросить',
    apply: 'Применить',
    
    // Categories Section
    categories: 'Категории услуг',
    categoriesDesc: 'Выберите то, что вам нужно',
    
    // Listings Section
    currentListings: 'Актуальные предложения',
    found: 'Найдено',
    objects: 'объектов',
    loading: 'Загрузка...',
    noResults: 'Ничего не найдено',
    
    // Pricing
    pricePerDay: 'в день',
    priceFrom: 'от',
    
    // Buttons & Actions
    bookNow: 'Забронировать',
    viewDetails: 'Подробнее',
    sendMessage: 'Написать',
    
    // Dashboard
    dashboard: 'Панель управления',
    listings: 'Листинги',
    bookings: 'Бронирования',
    messages: 'Сообщения',
    settings: 'Настройки',
    users: 'Пользователи',
    finances: 'Финансы',
    
    // Auth Modal
    loginTitle: 'Вход в систему',
    email: 'Email',
    password: 'Пароль',
    loginButton: 'Войти',
    loginError: 'Неверный email или пароль',
    
    // Featured
    featured: 'Рекомендуем',
    rating: 'Рейтинг',
    available: 'Доступно',
    booked: 'Забронировано',
    pending: 'Ожидает',
    verified: 'Проверено',
    
    // Listing Details
    perNight: 'за ночь',
    guests: 'гостей',
    bedrooms: 'спален',
    bathrooms: 'ванных',
    location: 'Расположение',
    amenities: 'Удобства',
    reviews: 'Отзывы',
    
    // Footer
    allRightsReserved: 'Все права защищены',
    privacyPolicy: 'Политика конфиденциальности',
    terms: 'Условия использования',
    footerDesc: 'Глобальный агрегатор аренды и услуг на Пхукете',
    footerCategories: 'Категории',
    footerCompany: 'Компания',
    footerSupport: 'Поддержка',
    aboutUs: 'О нас',
    careers: 'Карьера',
    blog: 'Блог',
    helpCenter: 'Центр помощи',
    safetyInfo: 'Безопасность',
    contactUs: 'Связаться с нами'
  },
  
  en: {
    // Header & Navigation
    search: 'Search',
    searchPlaceholder: 'Search...',
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    backToHome: 'Back to Home',
    
    // Hero Section
    heroTitle: 'Luxury Rentals',
    heroTitleHighlight: 'in Phuket',
    heroSubtitle: 'Villas, yachts, cars and tours — all in one place',
    
    // Search & Filters
    selectDates: 'Select dates',
    allCategories: 'All categories',
    allDistricts: 'All districts',
    category: 'Category',
    district: 'District',
    
    // Date Picker
    datePickerTitle: 'Select dates',
    datePickerDesc: 'Select check-in and check-out dates',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    clear: 'Clear',
    apply: 'Apply',
    
    // Categories Section
    categories: 'Service categories',
    categoriesDesc: 'Choose what you need',
    
    // Listings Section
    currentListings: 'Current offers',
    found: 'Found',
    objects: 'objects',
    loading: 'Loading...',
    noResults: 'No results found',
    
    // Pricing
    pricePerDay: 'per day',
    priceFrom: 'from',
    
    // Buttons & Actions
    bookNow: 'Book now',
    viewDetails: 'View details',
    sendMessage: 'Send message',
    
    // Dashboard
    dashboard: 'Dashboard',
    listings: 'Listings',
    bookings: 'Bookings',
    messages: 'Messages',
    settings: 'Settings',
    users: 'Users',
    finances: 'Finances',
    
    // Auth Modal
    loginTitle: 'Sign In',
    email: 'Email',
    password: 'Password',
    loginButton: 'Sign In',
    loginError: 'Invalid email or password',
    
    // Featured
    featured: 'Featured',
    rating: 'Rating',
    available: 'Available',
    booked: 'Booked',
    pending: 'Pending',
    verified: 'Verified',
    
    // Listing Details
    perNight: 'per night',
    guests: 'guests',
    bedrooms: 'bedrooms',
    bathrooms: 'bathrooms',
    location: 'Location',
    amenities: 'Amenities',
    reviews: 'Reviews',
    
    // Footer
    allRightsReserved: 'All rights reserved',
    privacyPolicy: 'Privacy Policy',
    terms: 'Terms of Service',
    footerDesc: 'Global rental and services aggregator in Phuket',
    footerCategories: 'Categories',
    footerCompany: 'Company',
    footerSupport: 'Support',
    aboutUs: 'About Us',
    careers: 'Careers',
    blog: 'Blog',
    helpCenter: 'Help Center',
    safetyInfo: 'Safety',
    contactUs: 'Contact Us'
  },
  
  zh: {
    // Header & Navigation
    search: '搜索',
    searchPlaceholder: '搜索...',
    login: '登录',
    logout: '退出',
    register: '注册',
    
    // Hero Section
    heroTitle: '豪华租赁',
    heroTitleHighlight: '在普吉岛',
    heroSubtitle: '别墅、游艇、汽车和旅游——一站式服务',
    
    // Search & Filters
    selectDates: '选择日期',
    allCategories: '所有类别',
    allDistricts: '所有地区',
    category: '类别',
    district: '地区',
    
    // Date Picker
    datePickerTitle: '选择日期',
    datePickerDesc: '选择入住和退房日期',
    checkIn: '入住',
    checkOut: '退房',
    clear: '清除',
    apply: '确认',
    
    // Categories Section
    categories: '服务类别',
    categoriesDesc: '选择您需要的',
    
    // Listings Section
    currentListings: '当前优惠',
    found: '找到',
    objects: '个项目',
    loading: '加载中...',
    noResults: '未找到结果',
    
    // Pricing
    pricePerDay: '每天',
    priceFrom: '起价',
    
    // Buttons & Actions
    bookNow: '立即预订',
    viewDetails: '查看详情',
    sendMessage: '发送消息',
    
    // Dashboard
    dashboard: '控制面板',
    listings: '房源',
    bookings: '预订',
    messages: '消息',
    settings: '设置',
    users: '用户',
    finances: '财务',
    
    // Auth Modal
    loginTitle: '登录',
    email: '邮箱',
    password: '密码',
    loginButton: '登录',
    loginError: '邮箱或密码错误',
    
    // Featured
    featured: '推荐',
    rating: '评分',
    available: '可预订',
    booked: '已预订',
    pending: '待确认',
    verified: '已验证',
    
    // Listing Details
    perNight: '每晚',
    guests: '位客人',
    bedrooms: '间卧室',
    bathrooms: '间浴室',
    location: '位置',
    amenities: '设施',
    reviews: '评价',
    
    // Footer
    allRightsReserved: '版权所有',
    privacyPolicy: '隐私政策',
    terms: '服务条款',
    footerDesc: '普吉岛全球租赁和服务聚合平台',
    footerCategories: '分类',
    footerCompany: '公司',
    footerSupport: '支持',
    aboutUs: '关于我们',
    careers: '招聘',
    blog: '博客',
    helpCenter: '帮助中心',
    safetyInfo: '安全信息',
    contactUs: '联系我们'
  },
  
  th: {
    // Header & Navigation
    search: 'ค้นหา',
    searchPlaceholder: 'ค้นหา...',
    login: 'เข้าสู่ระบบ',
    logout: 'ออกจากระบบ',
    register: 'ลงทะเบียน',
    
    // Hero Section
    heroTitle: 'เช่าหรูหรา',
    heroTitleHighlight: 'ในภูเก็ต',
    heroSubtitle: 'วิลล่า เรือยอชท์ รถยนต์ และทัวร์ — ครบในที่เดียว',
    
    // Search & Filters
    selectDates: 'เลือกวันที่',
    allCategories: 'ทุกหมวดหมู่',
    allDistricts: 'ทุกเขต',
    category: 'หมวดหมู่',
    district: 'เขต',
    
    // Date Picker
    datePickerTitle: 'เลือกวันที่',
    datePickerDesc: 'เลือกวันเข้าพักและออก',
    checkIn: 'เช็คอิน',
    checkOut: 'เช็คเอาท์',
    clear: 'ล้าง',
    apply: 'ยืนยัน',
    
    // Categories Section
    categories: 'หมวดหมู่บริการ',
    categoriesDesc: 'เลือกสิ่งที่คุณต้องการ',
    
    // Listings Section
    currentListings: 'ข้อเสนอปัจจุบัน',
    found: 'พบ',
    objects: 'รายการ',
    loading: 'กำลังโหลด...',
    noResults: 'ไม่พบผลลัพธ์',
    
    // Pricing
    pricePerDay: 'ต่อวัน',
    priceFrom: 'เริ่มต้น',
    
    // Buttons & Actions
    bookNow: 'จองเลย',
    viewDetails: 'ดูรายละเอียด',
    sendMessage: 'ส่งข้อความ',
    
    // Dashboard
    dashboard: 'แดชบอร์ด',
    listings: 'รายการ',
    bookings: 'การจอง',
    messages: 'ข้อความ',
    settings: 'การตั้งค่า',
    users: 'ผู้ใช้',
    finances: 'การเงิน',
    
    // Auth Modal
    loginTitle: 'เข้าสู่ระบบ',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    loginButton: 'เข้าสู่ระบบ',
    loginError: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    
    // Featured
    featured: 'แนะนำ',
    rating: 'คะแนน',
    available: 'ว่าง',
    booked: 'จองแล้ว',
    pending: 'รอดำเนินการ',
    verified: 'ยืนยันแล้ว',
    
    // Listing Details
    perNight: 'ต่อคืน',
    guests: 'ผู้เข้าพัก',
    bedrooms: 'ห้องนอน',
    bathrooms: 'ห้องน้ำ',
    location: 'ที่ตั้ง',
    amenities: 'สิ่งอำนวยความสะดวก',
    reviews: 'รีวิว',
    
    // Footer
    allRightsReserved: 'สงวนลิขสิทธิ์',
    privacyPolicy: 'นโยบายความเป็นส่วนตัว',
    terms: 'เงื่อนไขการใช้งาน',
    footerDesc: 'แพลตฟอร์มรวมการเช่าและบริการระดับโลกในภูเก็ต',
    footerCategories: 'หมวดหมู่',
    footerCompany: 'บริษัท',
    footerSupport: 'ช่วยเหลือ',
    aboutUs: 'เกี่ยวกับเรา',
    careers: 'ร่วมงานกับเรา',
    blog: 'บล็อก',
    helpCenter: 'ศูนย์ช่วยเหลือ',
    safetyInfo: 'ข้อมูลความปลอดภัย',
    contactUs: 'ติดต่อเรา'
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
 */
export function getUIText(key, lang = 'ru') {
  return uiTranslations[lang]?.[key] || uiTranslations['ru'][key] || key
}

/**
 * Get translation function for a specific language (shorthand)
 */
export function t(lang = 'ru') {
  return (key) => getUIText(key, lang)
}

/**
 * Get translated listing field (title/description)
 * Checks for translations in listing metadata, falls back to original
 */
export function getListingText(listing, field, lang = 'ru') {
  // Check if listing has translations in metadata
  const translations = listing?.metadata?.[`${field}_translations`] || 
                       listing?.[`${field}_translations`]
  
  if (translations && translations[lang]) {
    return translations[lang]
  }
  
  // For non-Russian languages, show original with language indicator if no translation
  const original = listing?.[field] || ''
  
  // If we're not in the original language and no translation exists,
  // we could return a placeholder or the original - here we return original
  // to avoid empty content
  return original
}

/**
 * Detect user's preferred language from browser
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
 */
export function setLanguage(lang) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('funnyrent_language', lang)
  }
}
