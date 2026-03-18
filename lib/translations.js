/**
 * Gostaylo - Complete Multi-language Translations System
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
    heroTitle: 'Премиум аренда',
    heroTitleHighlight: 'по всему миру',
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
    profile: 'Профиль',
    favorites: 'Избранное',
    open: 'Открыть',
    browse: 'Смотреть объявления',
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
    ,
    // Renter
    memberSince: 'Участник с',
    profileCompletion: 'Заполненность профиля',
    completeProfileToUnlock: 'Заполните профиль, чтобы открыть все функции!',
    profileComplete: 'Профиль заполнен! 🎉',
    startEarning: 'Начните зарабатывать с Gostaylo',
    listYourProperty: 'Разместите объект и станьте партнёром уже сегодня!',
    commissionZero: '0% комиссия',
    keepAllEarnings: 'Сохраняйте весь доход',
    support247: 'Поддержка 24/7',
    alwaysHere: 'Всегда на связи',
    fastPayouts: 'Быстрые выплаты',
    quickPayments: 'Быстрые платежи',
    applyBecomePartner: 'Подать заявку на партнёра',
    telegramNotifications: 'Уведомления Telegram',
    instantUpdates: 'Получайте мгновенные обновления о бронированиях',
    sendCodeToBot: 'Отправьте этот код нашему боту:',
    copy: 'Копировать',
    codeCopied: 'Код скопирован!',
    generating: 'Генерация...',
    connectTelegram: 'Подключить Telegram',
    openTelegramBot: 'Открыть Telegram-бота',
    quickActions: 'Быстрые действия',
    partnerApplication: 'Заявка партнёра',
    partnerApplicationDesc: 'Расскажите о вашем опыте — мы рассмотрим заявку в течение 24 часов.',
    phoneNumber: 'Телефон',
    hostingExperience: 'Опыт размещения',
    submitApplication: 'Отправить заявку',
    applicationDeclined: 'Заявка отклонена',
    reapply: 'Подать заново',
    myBookingsTitle: 'Мои бронирования',
    manageTrips: 'Управление всеми вашими поездками',
    findStay: 'Найти жильё',
    all: 'Все',
    upcoming: 'Предстоящие',
    past: 'Прошедшие',
    cancelled: 'Отменённые',
    loadError: 'Ошибка загрузки',
    retry: 'Повторить',
    noBookings: 'Нет бронирований',
    noUpcomingTrips: 'Нет предстоящих поездок',
    noPastTrips: 'Нет прошедших поездок',
    noCancelledBookings: 'Нет отменённых бронирований',
    startSearchingPhuket: 'Начните поиск жилья на Пхукете',
    bookNextTrip: 'Забронируйте свою следующую поездку',
    noCompletedTrips: 'У вас ещё нет завершённых поездок',
    allBookingsActive: 'Все ваши бронирования активны',
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
    heroTitle: 'Premium Rentals',
    heroTitleHighlight: 'Worldwide',
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
    profile: 'Profile',
    favorites: 'Favorites',
    open: 'Open',
    browse: 'Browse listings',
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
    ,
    // Renter
    memberSince: 'Member since',
    profileCompletion: 'Profile completion',
    completeProfileToUnlock: 'Complete your profile to unlock all features!',
    profileComplete: 'Your profile is complete! 🎉',
    startEarning: 'Start earning with Gostaylo',
    listYourProperty: 'List your property and become a partner today!',
    commissionZero: '0% commission',
    keepAllEarnings: 'Keep all earnings',
    support247: '24/7 support',
    alwaysHere: 'Always here for you',
    fastPayouts: 'Fast payouts',
    quickPayments: 'Quick payments',
    applyBecomePartner: 'Apply to become a partner',
    telegramNotifications: 'Telegram notifications',
    instantUpdates: 'Get instant updates about your bookings',
    sendCodeToBot: 'Send this code to our bot:',
    copy: 'Copy',
    codeCopied: 'Code copied!',
    generating: 'Generating...',
    connectTelegram: 'Connect Telegram',
    openTelegramBot: 'Open Telegram bot',
    quickActions: 'Quick actions',
    partnerApplication: 'Partner application',
    partnerApplicationDesc: "Tell us about your hosting experience and we'll review your application within 24 hours.",
    phoneNumber: 'Phone number',
    hostingExperience: 'Hosting experience',
    submitApplication: 'Submit application',
    applicationDeclined: 'Application declined',
    reapply: 'Reapply',
    myBookingsTitle: 'My bookings',
    manageTrips: 'Manage all your trips',
    findStay: 'Find a stay',
    all: 'All',
    upcoming: 'Upcoming',
    past: 'Past',
    cancelled: 'Cancelled',
    loadError: 'Loading error',
    retry: 'Retry',
    noBookings: 'No bookings',
    noUpcomingTrips: 'No upcoming trips',
    noPastTrips: 'No past trips',
    noCancelledBookings: 'No cancelled bookings',
    startSearchingPhuket: 'Start searching in Phuket',
    bookNextTrip: 'Book your next trip',
    noCompletedTrips: 'You have no completed trips yet',
    allBookingsActive: 'All your bookings are active',
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
    profile: '个人资料',
    favorites: '收藏',
    open: '打开',
    browse: '浏览房源',
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
    ,
    // Renter
    memberSince: '加入于',
    profileCompletion: '资料完成度',
    completeProfileToUnlock: '完善资料以解锁全部功能！',
    profileComplete: '资料已完善！🎉',
    startEarning: '与 Gostaylo 一起赚钱',
    listYourProperty: '发布房源并立即成为合作伙伴！',
    commissionZero: '0% 佣金',
    keepAllEarnings: '保留全部收益',
    support247: '24/7 支持',
    alwaysHere: '随时为您服务',
    fastPayouts: '快速提现吗',
    quickPayments: '快速付款',
    applyBecomePartner: '申请成为合作伙伴',
    telegramNotifications: 'Telegram 通知',
    instantUpdates: '即时获取预订更新',
    sendCodeToBot: '将此代码发送给机器人：',
    copy: '复制',
    codeCopied: '已复制！',
    generating: '生成中...',
    connectTelegram: '连接 Telegram',
    openTelegramBot: '打开 Telegram 机器人',
    quickActions: '快捷操作',
    partnerApplication: '合作伙伴申请',
    partnerApplicationDesc: '告诉我们您的托管经验，我们会在 24 小时内审核。',
    phoneNumber: '电话号码',
    hostingExperience: '托管经验',
    submitApplication: '提交申请',
    applicationDeclined: '申请被拒绝',
    reapply: '重新申请',
    myBookingsTitle: '我的预订',
    manageTrips: '管理您的所有行程',
    findStay: '查找住宿',
    all: '全部',
    upcoming: '即将到来',
    past: '已结束',
    cancelled: '已取消',
    loadError: '加载错误',
    retry: '重试',
    noBookings: '暂无预订',
    noUpcomingTrips: '暂无即将到来的行程',
    noPastTrips: '暂无已结束的行程',
    noCancelledBookings: '暂无已取消的预订',
    startSearchingPhuket: '开始在普吉岛搜索住宿',
    bookNextTrip: '预订您的下一次行程',
    noCompletedTrips: '您还没有已完成的行程',
    allBookingsActive: '您的所有预订均为有效状态',
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
    profile: 'โปรไฟล์',
    favorites: 'รายการโปรด',
    open: 'เปิด',
    browse: 'ดูประกาศ',
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
    ,
    // Renter
    memberSince: 'เป็นสมาชิกตั้งแต่',
    profileCompletion: 'ความสมบูรณ์ของโปรไฟล์',
    completeProfileToUnlock: 'กรอกโปรไฟล์ให้ครบเพื่อปลดล็อกฟีเจอร์ทั้งหมด!',
    profileComplete: 'โปรไฟล์สมบูรณ์แล้ว! 🎉',
    startEarning: 'เริ่มสร้างรายได้กับ Gostaylo',
    listYourProperty: 'ลงประกาศที่พักและเป็นพาร์ทเนอร์วันนี้!',
    commissionZero: 'คอมมิชชั่น 0%',
    keepAllEarnings: 'เก็บรายได้ทั้งหมด',
    support247: 'ซัพพอร์ต 24/7',
    alwaysHere: 'พร้อมช่วยเสมอ',
    fastPayouts: 'จ่ายเงินเร็ว',
    quickPayments: 'ชำระเงินรวดเร็ว',
    applyBecomePartner: 'สมัครเป็นพาร์ทเนอร์',
    telegramNotifications: 'การแจ้งเตือน Telegram',
    instantUpdates: 'รับอัปเดตการจองทันที',
    sendCodeToBot: 'ส่งโค้ดนี้ให้บอท:',
    copy: 'คัดลอก',
    codeCopied: 'คัดลอกแล้ว!',
    generating: 'กำลังสร้าง...',
    connectTelegram: 'เชื่อมต่อ Telegram',
    openTelegramBot: 'เปิด Telegram บอท',
    quickActions: 'การกระทำด่วน',
    partnerApplication: 'สมัครพาร์ทเนอร์',
    partnerApplicationDesc: 'เล่าประสบการณ์ของคุณ เราจะพิจารณาภายใน 24 ชั่วโมง',
    phoneNumber: 'หมายเลขโทรศัพท์',
    hostingExperience: 'ประสบการณ์การปล่อยเช่า',
    submitApplication: 'ส่งใบสมัคร',
    applicationDeclined: 'คำขอถูกปฏิเสธ',
    reapply: 'สมัครใหม่',
    myBookingsTitle: 'การจองของฉัน',
    manageTrips: 'จัดการทริปทั้งหมดของคุณ',
    findStay: 'ค้นหาที่พัก',
    all: 'ทั้งหมด',
    upcoming: 'ที่จะมาถึง',
    past: 'ที่ผ่านมา',
    cancelled: 'ยกเลิกแล้ว',
    loadError: 'เกิดข้อผิดพลาดในการโหลด',
    retry: 'ลองใหม่',
    noBookings: 'ไม่มีการจอง',
    noUpcomingTrips: 'ไม่มีทริปที่กำลังจะมาถึง',
    noPastTrips: 'ไม่มีทริปที่ผ่านมา',
    noCancelledBookings: 'ไม่มีการจองที่ถูกยกเลิก',
    startSearchingPhuket: 'เริ่มค้นหาที่พักในภูเก็ต',
    bookNextTrip: 'จองทริปถัดไปของคุณ',
    noCompletedTrips: 'คุณยังไม่มีทริปที่เสร็จสิ้น',
    allBookingsActive: 'การจองทั้งหมดของคุณยังใช้งานอยู่',
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
  
  const stored = localStorage.getItem('gostaylo_language')
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
    localStorage.setItem('gostaylo_language', lang)
  }
}
