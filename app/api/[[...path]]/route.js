import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { generateReferralCode } from '@/lib/auth'
import { convertFromThb, convertToThb } from '@/lib/currency'
import { dispatchNotification, NotificationEvents } from '@/lib/notifications'
import { generateTelegramLinkCode } from '@/lib/telegram'

// Mock database (in real app, use Prisma)
const mockDB = {
  profiles: [
    {
      id: 'admin-777',
      email: 'owner@funnyrent.com',
      role: 'ADMIN',
      referralCode: 'FRADMIN',
      firstName: 'Павел',
      lastName: 'Б.',
      name: 'Павел Б.',
      balancePoints: 0,
      balanceUsdt: 0,
      escrowBalance: 0,
      availableBalance: 0,
      preferredCurrency: 'THB',
      isVerified: true,
      verificationDocs: null,
      notificationPreferences: {
        email: true,
        telegram: true,
        telegramChatId: '999888777',
      },
      createdAt: new Date('2025-01-01').toISOString(),
    },
    {
      id: 'partner-1',
      email: 'partner@funnyrent.com',
      role: 'PARTNER',
      referralCode: 'FR12345',
      firstName: 'Иван',
      lastName: 'Партнёров',
      name: 'Иван Партнёров',
      balancePoints: 1250,
      balanceUsdt: 450.50,
      escrowBalance: 0,
      availableBalance: 25000,
      preferredCurrency: 'THB',
      isVerified: true,
      verificationDocs: null,
      customCommissionRate: null,
      notificationPreferences: {
        email: true,
        telegram: false,
        telegramChatId: null,
      },
    },
    {
      id: 'renter-1',
      email: 'alexey@example.com',
      role: 'RENTER',
      firstName: 'Алексей',
      lastName: 'Иванов',
      name: 'Алексей Иванов',
      preferredCurrency: 'RUB',
      notificationPreferences: {
        email: true,
        telegram: false,
        telegramChatId: null,
      },
    },
    {
      id: 'renter-3',
      email: 'dmitry@example.com',
      role: 'RENTER',
      firstName: 'Dmitry',
      lastName: 'Sokolov',
      name: 'Dmitry Sokolov',
      preferredCurrency: 'USD',
      notificationPreferences: {
        email: true,
        telegram: false,
        telegramChatId: null,
      },
    },
    {
      id: 'renter-5',
      email: 'olga@example.com',
      role: 'RENTER',
      firstName: 'Ольга',
      lastName: 'Смирнова',
      name: 'Ольга Смирнова',
      preferredCurrency: 'RUB',
      notificationPreferences: {
        email: true,
        telegram: false,
        telegramChatId: null,
      },
    },
    {
      id: 'renter-7',
      email: 'sergey@example.com',
      role: 'RENTER',
      firstName: 'Сергей',
      lastName: 'Волков',
      name: 'Сергей Волков',
      preferredCurrency: 'THB',
      notificationPreferences: {
        email: true,
        telegram: false,
        telegramChatId: null,
      },
    },
    {
      id: 'partner-pending-1',
      email: 'newpartner1@funnyrent.com',
      role: 'PARTNER',
      referralCode: 'FRNEW01',
      firstName: 'Мария',
      lastName: 'Новикова',
      name: 'Мария Новикова',
      balancePoints: 0,
      balanceUsdt: 0,
      preferredCurrency: 'THB',
      isVerified: false,
      verificationDocs: {
        passport: 'https://example.com/docs/passport1.jpg',
        bankAccount: 'https://example.com/docs/bank1.jpg',
      },
      verificationStatus: 'PENDING',
      notificationPreferences: {
        email: true,
        telegram: false,
        telegramChatId: null,
      },
      createdAt: new Date('2026-02-20').toISOString(),
    },
    {
      id: 'partner-pending-2',
      email: 'newpartner2@funnyrent.com',
      role: 'PARTNER',
      referralCode: 'FRNEW02',
      firstName: 'Антон',
      lastName: 'Соколов',
      name: 'Антон Соколов',
      balancePoints: 0,
      balanceUsdt: 0,
      preferredCurrency: 'USDT',
      isVerified: false,
      verificationDocs: {
        passport: 'https://example.com/docs/passport2.jpg',
        businessLicense: 'https://example.com/docs/license2.jpg',
      },
      verificationStatus: 'PENDING',
      notificationPreferences: {
        email: true,
        telegram: true,
        telegramChatId: '555444333',
      },
      createdAt: new Date('2026-02-22').toISOString(),
    },
  ],
  categories: [
    { id: '1', name: 'Property', slug: 'property', icon: '🏠', order: 1, isActive: true },
    { id: '2', name: 'Vehicles', slug: 'vehicles', icon: '🏍️', order: 2, isActive: true },
    { id: '3', name: 'Tours', slug: 'tours', icon: '🗺️', order: 3, isActive: true },
    { id: '4', name: 'Yachts', slug: 'yachts', icon: '⛵', order: 4, isActive: false },
  ],
  listings: [
    {
      id: '1',
      ownerId: 'partner-1',
      categoryId: '1',
      status: 'ACTIVE',
      title: 'Роскошная вилла с видом на океан',
      description: 'Потрясающая вилла с 4 спальнями на пляже Раваи',
      district: 'Rawai',
      basePriceThb: 15000,
      commissionRate: 15,
      isFeatured: true,
      images: ['https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg'],
      rating: 4.0,
      reviewsCount: 1,
      available: true,
      views: 245,
      bookingsCount: 12,
      externalCalUrl: 'https://www.airbnb.com/calendar/ical/mock-villa-123.ics',
      metadata: { bedrooms: 4, bathrooms: 3, area: 250, amenities: ['pool', 'wifi', 'parking'] },
      createdAt: new Date('2025-01-15').toISOString(),
    },
    {
      id: '2',
      ownerId: 'partner-1',
      categoryId: '4',
      status: 'ACTIVE',
      title: 'Премиум яхта для морских прогулок',
      description: 'Роскошная яхта на 12 человек с экипажем',
      district: 'Chalong Bay',
      basePriceThb: 45000,
      commissionRate: 15,
      images: ['https://images.unsplash.com/photo-1566735201951-bc1cbeeb2964'],
      rating: 0,
      reviewsCount: 0,
      available: true,
      views: 189,
      bookingsCount: 8,
      metadata: { capacity: 12, length: 45, crew: true },
      createdAt: new Date('2025-02-01').toISOString(),
    },
    {
      id: '3',
      ownerId: 'partner-1',
      categoryId: '2',
      status: 'ACTIVE',
      title: 'Премиальный байк Honda CB650R',
      description: 'Спортивный мотоцикл премиум класса',
      district: 'Patong',
      basePriceThb: 2500,
      commissionRate: 15,
      images: ['https://images.pexels.com/photos/31342032/pexels-photo-31342032.jpeg'],
      rating: 5.0,
      reviewsCount: 1,
      available: true,
      views: 432,
      bookingsCount: 25,
      metadata: { brand: 'Honda', model: 'CB650R', year: 2024, transmission: 'Manual', cc: 650 },
      createdAt: new Date('2025-01-20').toISOString(),
    },
    {
      id: '4',
      ownerId: 'partner-1',
      categoryId: '3',
      status: 'ACTIVE',
      title: 'Тур на острова Пхи-Пхи',
      description: 'Незабываемая экскурсия на острова с обедом',
      district: 'Phi Phi Islands',
      basePriceThb: 3500,
      commissionRate: 15,
      images: ['https://images.pexels.com/photos/18277777/pexels-photo-18277777.jpeg'],
      rating: 5.0,
      reviewsCount: 1,
      available: true,
      views: 567,
      bookingsCount: 34,
      metadata: { duration: '8 hours', groupSize: 15, meals: true, included: ['lunch', 'guide', 'transport'] },
      createdAt: new Date('2025-01-10').toISOString(),
    },
    {
      id: 'listing-pending-1',
      ownerId: 'partner-pending-1',
      categoryId: '1',
      status: 'PENDING',
      title: 'Уютная вилла в Камале',
      description: 'Современная вилла с 3 спальнями, бассейном и видом на горы. Идеально для семейного отдыха.',
      district: 'Kamala',
      basePriceThb: 12000,
      commissionRate: 18,
      images: [
        'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg',
        'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg'
      ],
      rating: 0,
      reviewsCount: 0,
      available: false,
      views: 0,
      bookingsCount: 0,
      metadata: { bedrooms: 3, bathrooms: 2, area: 180, amenities: ['pool', 'wifi', 'kitchen', 'parking'] },
      createdAt: new Date('2026-02-21').toISOString(),
    },
    {
      id: 'listing-pending-2',
      ownerId: 'partner-pending-2',
      categoryId: '2',
      status: 'PENDING',
      title: 'Harley Davidson для аренды',
      description: 'Легендарный мотоцикл в отличном состоянии. Все документы и страховка включены.',
      district: 'Patong',
      basePriceThb: 2500,
      commissionRate: 20,
      images: [
        'https://images.unsplash.com/photo-1558981033-e7ede5e527bb',
      ],
      rating: 0,
      reviewsCount: 0,
      available: false,
      views: 0,
      bookingsCount: 0,
      metadata: { type: 'Cruiser', year: 2022, engine: '1200cc', insurance: true },
      createdAt: new Date('2026-02-23').toISOString(),
    },
  ],
  bookings: [
    {
      id: 'b1',
      listingId: '1',
      renterId: 'renter-1',
      status: 'CONFIRMED',
      checkIn: '2025-03-15',
      checkOut: '2025-03-20',
      priceThb: 75000,
      currency: 'THB',
      pricePaid: 75000,
      exchangeRate: 1,
      commissionThb: 11250,
      commissionPaid: true,
      guestName: 'Алексей Иванов',
      guestPhone: '+7 999 123 4567',
      guestEmail: 'alexey@example.com',
      createdAt: '2025-02-20T10:30:00Z',
    },
    {
      id: 'b2',
      listingId: '2',
      renterId: 'renter-2',
      status: 'CONFIRMED',
      checkIn: '2025-03-10',
      checkOut: '2025-03-10',
      priceThb: 45000,
      currency: 'RUB',
      pricePaid: 121621,
      exchangeRate: 0.37,
      commissionThb: 6750,
      commissionPaid: false,
      guestName: 'Мария Петрова',
      guestPhone: '+7 912 345 6789',
      guestEmail: 'maria@example.com',
      createdAt: '2025-02-23T14:20:00Z',
    },
    {
      id: 'b3',
      listingId: '3',
      renterId: 'renter-3',
      status: 'COMPLETED',
      checkIn: '2025-02-28',
      checkOut: '2025-03-05',
      priceThb: 17500,
      currency: 'USD',
      pricePaid: 522.39,
      exchangeRate: 33.5,
      commissionThb: 2625,
      commissionPaid: false,
      guestName: 'Dmitry Sokolov',
      guestPhone: '+7 905 876 5432',
      guestEmail: 'dmitry@example.com',
      createdAt: '2025-02-22T09:15:00Z',
    },
    {
      id: 'b-tour-1',
      listingId: '4',
      renterId: 'renter-5',
      status: 'COMPLETED',
      checkIn: '2025-02-14',
      checkOut: '2025-02-14',
      priceThb: 3500,
      currency: 'RUB',
      pricePaid: 9459,
      exchangeRate: 0.37,
      commissionThb: 525,
      commissionPaid: true,
      guestName: 'Ольга Смирнова',
      guestPhone: '+7 921 222 3333',
      guestEmail: 'olga@example.com',
      createdAt: '2025-02-10T12:00:00Z',
    },
    {
      id: 'b-villa-old',
      listingId: '1',
      renterId: 'renter-7',
      status: 'COMPLETED',
      checkIn: '2025-01-15',
      checkOut: '2025-01-18',
      priceThb: 45000,
      currency: 'THB',
      pricePaid: 45000,
      exchangeRate: 1,
      commissionThb: 6750,
      commissionPaid: true,
      guestName: 'Сергей Волков',
      guestPhone: '+66 82 123 4567',
      guestEmail: 'sergey@example.com',
      createdAt: '2025-01-10T08:00:00Z',
    },
  ],
  referrals: [
    {
      id: 'r1',
      referrerId: 'partner-1',
      referredId: 'user-1',
      referredEmail: 'user1@example.com',
      rewardPoints: 500,
      rewardUsdt: 50,
      rewardPaid: true,
      createdAt: '2025-01-25',
    },
    {
      id: 'r2',
      referrerId: 'partner-1',
      referredId: 'user-2',
      referredEmail: 'user2@example.com',
      rewardPoints: 500,
      rewardUsdt: 50,
      rewardPaid: true,
      createdAt: '2025-02-05',
    },
    {
      id: 'r3',
      referrerId: 'partner-1',
      referredId: 'user-3',
      referredEmail: 'user3@example.com',
      rewardPoints: 0,
      rewardUsdt: 0,
      rewardPaid: false,
      createdAt: '2025-02-20',
    },
  ],
  exchangeRates: [
    { currencyCode: 'THB', rateToThb: 1.0 },
    { currencyCode: 'RUB', rateToThb: 0.37 },
    { currencyCode: 'USD', rateToThb: 33.5 },
    { currencyCode: 'USDT', rateToThb: 33.5 },
  ],
  conversations: [
    {
      id: 'conv-1',
      listingId: '1',
      renterId: 'renter-1',
      renterName: 'Алексей Иванов',
      partnerId: 'partner-1',
      lastMessageAt: '2025-02-24T10:05:00Z',
      unreadCountPartner: 0,
      unreadCountRenter: 1,
      status: 'ACTIVE',
    },
  ],
  messages: [
    {
      id: 'm1',
      conversationId: 'conv-1',
      listingId: '1',
      senderId: 'renter-1',
      senderRole: 'RENTER',
      senderName: 'Алексей Иванов',
      message: 'Здравствуйте! Интересует ваша вилла на 5 дней.',
      type: 'USER',
      read: true,
      createdAt: '2025-02-24T10:00:00Z',
    },
    {
      id: 'm2',
      conversationId: 'conv-1',
      listingId: '1',
      senderId: 'system',
      senderRole: 'SYSTEM',
      message: 'Новый запрос на бронирование: 15-20 марта 2025',
      type: 'BOOKING_REQUEST',
      bookingId: 'b1',
      metadata: {
        checkIn: '2025-03-15',
        checkOut: '2025-03-20',
        totalPrice: 75000,
        basePrice: 75000,
        serviceFee: 11250,
      },
      read: true,
      createdAt: '2025-02-24T10:05:00Z',
    },
    {
      id: 'm3',
      conversationId: 'conv-1',
      listingId: '1',
      senderId: 'partner-1',
      senderRole: 'PARTNER',
      senderName: 'Иван Партнёров',
      message: 'Здравствуйте! Да, вилла свободна на эти даты.',
      type: 'USER',
      read: false,
      createdAt: '2025-02-24T14:30:00Z',
    },
  ],
  reviews: [
    {
      id: 'rev-1',
      listingId: '3',
      bookingId: 'b3',
      renterId: 'renter-3',
      renterName: 'Dmitry Sokolov',
      rating: 5,
      comment: 'Отличный байк! Всё в идеальном состоянии, катался с удовольствием. Партнёр очень отзывчивый, всё объяснил. Рекомендую!',
      photos: [
        'https://images.pexels.com/photos/2116475/pexels-photo-2116475.jpeg',
        'https://images.pexels.com/photos/2116473/pexels-photo-2116473.jpeg'
      ],
      partnerReply: {
        text: 'Спасибо за отзыв, Dmitry! Было приятно с вами работать. Всегда рады видеть вас снова!',
        createdAt: '2025-03-07T14:20:00Z',
      },
      createdAt: '2025-03-06T18:30:00Z',
    },
    {
      id: 'rev-2',
      listingId: '4',
      bookingId: 'b-tour-1',
      renterId: 'renter-5',
      renterName: 'Ольга Смирнова',
      rating: 5,
      comment: 'Незабываемая экскурсия! Гид профессионал, места потрясающие, обед вкусный. Всё организовано на высшем уровне.',
      photos: [
        'https://images.pexels.com/photos/1007657/pexels-photo-1007657.jpeg'
      ],
      partnerReply: null,
      createdAt: '2025-02-15T20:45:00Z',
    },
    {
      id: 'rev-3',
      listingId: '1',
      bookingId: 'b-villa-old',
      renterId: 'renter-7',
      renterName: 'Сергей Волков',
      rating: 4,
      comment: 'Хорошая вилла, красивый вид. Единственный минус - Wi-Fi не очень стабильный. В остальном всё отлично!',
      photos: [],
      partnerReply: {
        text: 'Спасибо за фидбек! Мы уже обновили роутер, теперь интернет работает стабильно. Будем рады видеть вас снова!',
        createdAt: '2025-01-22T10:15:00Z',
      },
      createdAt: '2025-01-20T16:00:00Z',
    },
  ],
  payments: [
    // Empty for now - will be populated when users make payments
  ],
  payouts: [
    {
      id: 'payout-1',
      partnerId: 'partner-1',
      amount: 127500,
      currency: 'THB',
      method: 'bank',
      destination: 'Bangkok Bank ***4567',
      status: 'PENDING',
      requestedAt: new Date('2026-02-20').toISOString(),
      metadata: {
        partnerName: 'Иван Партнёров',
        bookingsCount: 3,
        note: 'Monthly payout for January 2026',
      },
    },
    {
      id: 'payout-2',
      partnerId: 'partner-1',
      amount: 850,
      currency: 'USDT',
      method: 'crypto',
      destination: 'TXYZMockWallet12345AbCdEfGhIjKlMnOpQrStUvWxYz',
      status: 'PENDING',
      requestedAt: new Date('2026-02-23').toISOString(),
      metadata: {
        partnerName: 'Иван Партнёров',
        bookingsCount: 2,
        note: 'USDT withdrawal',
      },
    },
  ],
  unavailableDates: [
    // Example: blocked dates from external calendar
    {
      id: 'ud-1',
      listingId: '1',
      startDate: '2025-03-10',
      endDate: '2025-03-14',
      source: 'external',
      reason: 'Booked on Airbnb',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ud-2',
      listingId: '3',
      startDate: '2025-03-05',
      endDate: '2025-03-08',
      source: 'internal',
      reason: 'Maintenance',
      createdAt: new Date().toISOString(),
    },
  ],
  icalSyncStatus: {
    // Track last sync time for each listing
    '1': { lastSync: new Date().toISOString(), status: 'success' },
    '3': { lastSync: null, status: 'never' },
  },
  platformBalance: {
    totalEscrow: 245000,      // Money in escrow awaiting check-in
    totalCommission: 187500,   // Platform's earned commission
    totalRevenue: 1250000,     // Total revenue processed
    totalRevenueUsdt: 15200,   // Total revenue in USDT
  },
  systemSettings: {
    defaultCommissionRate: 15,
    maintenanceMode: false,
    maintenanceModeUpdatedAt: null,
    maintenanceModeUpdatedBy: null,
    heroTitle: 'Luxury Rentals in Phuket',
    heroSubtitle: 'Villas, Bikes, Yachts & Tours',
  },
  promoCodes: [
    {
      id: 'promo-1',
      code: 'PHUKET2025',
      type: 'PERCENT',
      value: 10,
      expiryDate: '2025-12-31',
      usageLimit: 100,
      usedCount: 23,
      isActive: true,
      createdBy: 'admin-777',
      createdAt: new Date('2025-01-01').toISOString(),
    },
    {
      id: 'promo-2',
      code: 'NEWYEAR',
      type: 'FIXED',
      value: 5000,
      expiryDate: '2025-01-15',
      usageLimit: 50,
      usedCount: 50,
      isActive: false,
      createdBy: 'admin-777',
      createdAt: new Date('2024-12-20').toISOString(),
    },
    {
      id: 'promo-3',
      code: 'WELCOME10',
      type: 'PERCENT',
      value: 10,
      expiryDate: '2026-12-31',
      usageLimit: 1000,
      usedCount: 5,
      isActive: true,
      createdBy: 'admin-777',
      createdAt: new Date('2025-02-01').toISOString(),
    },
    {
      id: 'promo-4',
      code: 'SAVE100',
      type: 'FIXED',
      value: 100,
      expiryDate: '2026-12-31',
      usageLimit: 500,
      usedCount: 12,
      isActive: true,
      createdBy: 'admin-777',
      createdAt: new Date('2025-02-01').toISOString(),
    },
  ],
  blacklist: {
    wallets: [
      { address: 'TBannedWallet123456789AbCdEf', reason: 'Fraud', addedAt: new Date('2025-02-01').toISOString() },
    ],
    phones: [
      { number: '+66999888777', reason: 'Multiple chargebacks', addedAt: new Date('2025-02-10').toISOString() },
    ],
  },
  seasonalPrices: [
    {
      id: 'sp-1',
      listingId: '1',
      startDate: '2025-12-15',
      endDate: '2026-01-15',
      label: 'Пик (Новый Год)',
      seasonType: 'PEAK',
      priceDaily: 25000,
      priceMonthly: 600000,
      description: 'Рождество и Новый Год — максимальный спрос',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sp-2',
      listingId: '1',
      startDate: '2025-11-01',
      endDate: '2025-12-14',
      label: 'Высокий сезон',
      seasonType: 'HIGH',
      priceDaily: 18000,
      priceMonthly: 450000,
      description: 'Начало туристического сезона',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sp-3',
      listingId: '1',
      startDate: '2025-05-01',
      endDate: '2025-10-31',
      label: 'Низкий сезон',
      seasonType: 'LOW',
      priceDaily: 8000,
      priceMonthly: 180000,
      description: 'Дождливый сезон, меньше туристов',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sp-4',
      listingId: '2',
      startDate: '2025-12-20',
      endDate: '2026-01-10',
      label: 'Пик',
      seasonType: 'PEAK',
      priceDaily: 55000,
      priceMonthly: null,
      description: 'Новогодние чартеры яхт',
      createdAt: new Date().toISOString(),
    },
  ],
  telegramLinkingCodes: [
    // Temporary codes for linking Telegram accounts
    // { code: '123456', userId: 'partner-1', expiresAt: '...', used: false }
  ],
}

// Phuket districts
const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
]

// Helper to extract path from URL
function getPathFromUrl(url) {
  const match = url.match(/\/api\/(.+?)(?:\?|$)/)
  return match ? match[1] : ''
}

// GET Handler
export async function GET(request) {
  try {
    const path = getPathFromUrl(request.url)
    const { searchParams } = new URL(request.url)

    // GET /api/categories
    if (path === 'categories') {
      // By default, only return active categories for public
      const includeInactive = searchParams.get('includeInactive') === 'true'
      
      const categories = includeInactive 
        ? mockDB.categories 
        : mockDB.categories.filter(c => c.isActive)
      
      return NextResponse.json({
        success: true,
        data: categories,
      })
    }

    // GET /api/listings
    if (path === 'listings') {
      const category = searchParams.get('category')
      const district = searchParams.get('district')
      const minPrice = parseFloat(searchParams.get('minPrice') || '0')
      const maxPrice = parseFloat(searchParams.get('maxPrice') || '999999')
      const checkIn = searchParams.get('checkIn')
      const checkOut = searchParams.get('checkOut')
      
      let filtered = mockDB.listings.filter(l => l.available)
      
      if (category && category !== 'all') {
        const cat = mockDB.categories.find(c => c.slug === category)
        if (cat) filtered = filtered.filter(l => l.categoryId === cat.id)
      }
      
      if (district && district !== 'all') {
        filtered = filtered.filter(l => l.district === district)
      }
      
      // Enhanced: Calculate seasonal prices for each listing
      const enhancedListings = filtered.map(listing => {
        const seasonalPricesForListing = mockDB.seasonalPrices.filter(sp => sp.listingId === listing.id)
        
        let currentPrice = listing.basePriceThb
        let lowestSeasonalPrice = listing.basePriceThb
        let hasSeasonalPricing = seasonalPricesForListing.length > 0
        
        // If dates are provided, calculate seasonal price
        if (checkIn && checkOut && hasSeasonalPricing) {
          try {
            const checkInDate = new Date(checkIn)
            const checkOutDate = new Date(checkOut)
            const days = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
            
            if (days > 0 && days <= 365) {
              // Calculate daily prices for the range
              let totalPrice = 0
              let currentDate = new Date(checkInDate)
              
              for (let i = 0; i < days; i++) {
                const applicableSeason = seasonalPricesForListing.find(sp => {
                  const start = new Date(sp.startDate)
                  const end = new Date(sp.endDate)
                  return currentDate >= start && currentDate <= end
                })
                
                const dayPrice = applicableSeason ? applicableSeason.priceDaily : listing.basePriceThb
                totalPrice += dayPrice
                currentDate.setDate(currentDate.getDate() + 1)
              }
              
              currentPrice = Math.round(totalPrice / days) // Average daily rate
            }
          } catch (error) {
            console.error('Error calculating seasonal price:', error)
          }
        }
        
        // Calculate lowest seasonal price for "от X" display
        if (hasSeasonalPricing) {
          const allPrices = seasonalPricesForListing.map(sp => sp.priceDaily)
          allPrices.push(listing.basePriceThb)
          lowestSeasonalPrice = Math.min(...allPrices)
        }
        
        return {
          ...listing,
          currentPrice, // For selected dates or base price
          lowestSeasonalPrice, // For "от X" display
          hasSeasonalPricing,
        }
      })
      
      // Filter by price (using currentPrice)
      const priceFiltered = enhancedListings.filter(l => 
        l.currentPrice >= minPrice && l.currentPrice <= maxPrice
      )
      
      // Sort by isFeatured first, then by date
      const finalFiltered = priceFiltered.sort((a, b) => {
        // Featured listings first
        if (a.isFeatured && !b.isFeatured) return -1
        if (!a.isFeatured && b.isFeatured) return 1
        
        // Then by date (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
      
      return NextResponse.json({
        success: true,
        data: finalFiltered,
        total: finalFiltered.length,
        filters: {
          checkIn,
          checkOut,
          category,
          district,
        },
      })
    }

    // GET /api/listings/:id/seasonal-prices (MUST BE BEFORE generic listings/:id)
    if (path.match(/^listings\/[^\/]+\/seasonal-prices$/)) {
      const listingId = path.split('/')[1]
      
      const prices = mockDB.seasonalPrices.filter(sp => sp.listingId === listingId)
      
      // Sort by startDate
      prices.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      
      return NextResponse.json({
        success: true,
        data: prices,
      })
    }

    // GET /api/listings/:id
    if (path.startsWith('listings/')) {
      const id = path.split('/')[1]
      const listing = mockDB.listings.find(l => l.id === id)
      
      if (!listing) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: listing,
      })
    }

    // GET /api/exchange-rates
    if (path === 'exchange-rates') {
      return NextResponse.json({
        success: true,
        data: mockDB.exchangeRates,
      })
    }

    // GET /api/districts
    if (path === 'districts') {
      return NextResponse.json({
        success: true,
        data: DISTRICTS,
      })
    }

    // === PARTNER ENDPOINTS ===

    // GET /api/partner/stats
    if (path === 'partner/stats') {
      const partnerId = 'partner-1' // Mock auth
      const partnerListings = mockDB.listings.filter(l => l.ownerId === partnerId)
      const partnerBookings = mockDB.bookings.filter(b => 
        partnerListings.some(l => l.id === b.listingId)
      )
      const activeBookings = partnerBookings.filter(b => 
        b.status === 'CONFIRMED' || b.status === 'PENDING'
      )
      
      const totalEarnings = partnerBookings
        .filter(b => b.status === 'CONFIRMED')
        .reduce((sum, b) => sum + (b.priceThb - b.commissionThb), 0)
      
      const totalCommissionPaid = partnerBookings
        .filter(b => b.commissionPaid)
        .reduce((sum, b) => sum + b.commissionThb, 0)
      
      const referralBonuses = mockDB.referrals
        .filter(r => r.referrerId === partnerId && r.rewardPaid)
        .reduce((sum, r) => sum + r.rewardUsdt, 0)

      return NextResponse.json({
        success: true,
        data: {
          totalListings: partnerListings.length,
          activeListings: partnerListings.filter(l => l.status === 'ACTIVE').length,
          activeBookings: activeBookings.length,
          totalBookings: partnerBookings.length,
          totalEarnings: totalEarnings,
          totalCommissionPaid: totalCommissionPaid,
          referralBonuses: referralBonuses,
          totalViews: partnerListings.reduce((sum, l) => sum + l.views, 0),
        },
      })
    }

    // GET /api/partner/listings
    if (path === 'partner/listings') {
      const partnerId = 'partner-1' // Mock auth
      const partnerListings = mockDB.listings.filter(l => l.ownerId === partnerId)
      
      return NextResponse.json({
        success: true,
        data: partnerListings,
        total: partnerListings.length,
      })
    }

    // GET /api/partner/bookings
    if (path === 'partner/bookings') {
      const partnerId = 'partner-1' // Mock auth
      const partnerListings = mockDB.listings.filter(l => l.ownerId === partnerId)
      const partnerBookings = mockDB.bookings.filter(b => 
        partnerListings.some(l => l.id === b.listingId)
      ).map(b => {
        const listing = mockDB.listings.find(l => l.id === b.listingId)
        return { ...b, listing }
      })
      
      return NextResponse.json({
        success: true,
        data: partnerBookings,
        total: partnerBookings.length,
      })
    }

    // GET /api/partner/referrals
    if (path === 'partner/referrals') {
      const partnerId = 'partner-1' // Mock auth
      const partner = mockDB.profiles.find(p => p.id === partnerId)
      const referrals = mockDB.referrals.filter(r => r.referrerId === partnerId)
      
      return NextResponse.json({
        success: true,
        data: {
          referralCode: partner?.referralCode,
          referrals: referrals,
          totalReferred: referrals.length,
          totalRewards: referrals.reduce((sum, r) => sum + r.rewardUsdt, 0),
        },
      })
    }

    // === MESSAGING ENDPOINTS ===

    // GET /api/conversations/:id/messages
    if (path.startsWith('conversations/') && path.includes('/messages')) {
      const conversationId = path.split('/')[1]
      const messages = mockDB.messages
        .filter(m => m.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      
      const conversation = mockDB.conversations.find(c => c.id === conversationId)
      const listing = mockDB.listings.find(l => l.id === conversation?.listingId)
      
      return NextResponse.json({
        success: true,
        data: { messages, conversation, listing },
      })
    }

    // GET /api/conversations (for current user)
    if (path === 'conversations') {
      const userId = searchParams.get('userId') || 'renter-1'
      const userRole = searchParams.get('role') || 'RENTER'
      
      const userConversations = mockDB.conversations.filter(c =>
        userRole === 'PARTNER' ? c.partnerId === userId : c.renterId === userId
      ).map(conv => {
        const listing = mockDB.listings.find(l => l.id === conv.listingId)
        const lastMessage = mockDB.messages
          .filter(m => m.conversationId === conv.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        
        return { ...conv, listing, lastMessage }
      })
      
      return NextResponse.json({
        success: true,
        data: userConversations,
      })
    }

    // GET /api/listings/:id/reviews
    if (path.match(/^listings\/(.+)\/reviews$/)) {
      const listingId = path.split('/')[1]
      const reviews = mockDB.reviews
        .filter(r => r.listingId === listingId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      // Calculate average rating
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0
      
      return NextResponse.json({
        success: true,
        data: {
          reviews,
          averageRating: parseFloat(avgRating.toFixed(1)),
          totalReviews: reviews.length,
        },
      })
    }

    // GET /api/partner/reviews
    if (path === 'partner/reviews') {
      const partnerId = searchParams.get('partnerId') || 'partner-1'
      
      // Get all listings of the partner
      const partnerListings = mockDB.listings.filter(l => l.ownerId === partnerId)
      const listingIds = partnerListings.map(l => l.id)
      
      // Get reviews for all partner's listings
      const reviews = mockDB.reviews
        .filter(r => listingIds.includes(r.listingId))
        .map(review => {
          const listing = mockDB.listings.find(l => l.id === review.listingId)
          return { ...review, listingTitle: listing?.title }
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      // Calculate stats
      const totalReviews = reviews.length
      const avgRating = totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0
      const reviewsWithoutReply = reviews.filter(r => !r.partnerReply).length
      
      return NextResponse.json({
        success: true,
        data: {
          reviews,
          stats: {
            totalReviews,
            averageRating: parseFloat(avgRating.toFixed(1)),
            reviewsWithoutReply,
          },
        },
      })
    }

    // GET /api/bookings/:id/can-review
    if (path.match(/^bookings\/(.+)\/can-review$/)) {
      const bookingId = path.split('/')[1]
      const booking = mockDB.bookings.find(b => b.id === bookingId)
      
      if (!booking) {
        return NextResponse.json(
          { success: false, error: 'Booking not found' },
          { status: 404 }
        )
      }
      
      // Check if booking is completed
      const canReview = booking.status === 'COMPLETED'
      
      // Check if review already exists
      const existingReview = mockDB.reviews.find(r => r.bookingId === bookingId)
      
      return NextResponse.json({
        success: true,
        data: {
          canReview: canReview && !existingReview,
          booking,
          existingReview: existingReview || null,
        },
      })
    }

    // GET /api/bookings/:id/payment-status
    if (path.match(/^bookings\/(.+)\/payment-status$/)) {
      const bookingId = path.split('/')[1]
      const booking = mockDB.bookings.find(b => b.id === bookingId)
      
      if (!booking) {
        return NextResponse.json(
          { success: false, error: 'Booking not found' },
          { status: 404 }
        )
      }
      
      const payment = mockDB.payments.find(p => p.bookingId === bookingId)
      const listing = mockDB.listings.find(l => l.id === booking.listingId)
      
      return NextResponse.json({
        success: true,
        data: {
          booking,
          payment: payment || null,
          listing: { id: listing?.id, title: listing?.title },
          canPay: booking.status === 'CONFIRMED' && !payment,
        },
      })
    }

    // GET /api/partner/balance
    if (path === 'partner/balance') {
      const partnerId = searchParams.get('partnerId') || 'partner-1'
      const partner = mockDB.profiles.find(p => p.id === partnerId)
      
      if (!partner) {
        return NextResponse.json(
          { success: false, error: 'Partner not found' },
          { status: 404 }
        )
      }
      
      // Calculate pending escrow (bookings with PAID status but not checked-in)
      const partnerListings = mockDB.listings.filter(l => l.ownerId === partnerId)
      const listingIds = partnerListings.map(l => l.id)
      const commissionRate = partner?.customCommissionRate ?? mockDB.systemSettings.defaultCommissionRate
      
      const pendingEscrow = mockDB.bookings
        .filter(b => listingIds.includes(b.listingId) && b.status === 'PAID')
        .reduce((sum, b) => {
          const netAmount = b.priceThb * (1 - commissionRate / 100)
          return sum + netAmount
        }, 0)
      
      return NextResponse.json({
        success: true,
        data: {
          availableBalance: partner.availableBalance || 0,
          escrowBalance: pendingEscrow,
          totalBalance: (partner.availableBalance || 0) + pendingEscrow,
          currency: partner.preferredCurrency || 'THB',
          minWithdrawal: { THB: 1000, USDT: 30 },
        },
      })
    }

    // GET /api/partner/payouts
    if (path === 'partner/payouts') {
      const partnerId = searchParams.get('partnerId') || 'partner-1'
      
      const payouts = mockDB.payouts
        .filter(p => p.partnerId === partnerId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      return NextResponse.json({
        success: true,
        data: payouts,
      })
    }

    // GET /api/listings/:id/unavailable-dates
    if (path.match(/^listings\/(.+)\/unavailable-dates$/)) {
      const listingId = path.split('/')[1]
      
      const unavailableDates = mockDB.unavailableDates.filter(d => d.listingId === listingId)
      
      return NextResponse.json({
        success: true,
        data: unavailableDates,
      })
    }

    // GET /api/listings/:id/ical-status
    if (path.match(/^listings\/(.+)\/ical-status$/)) {
      const listingId = path.split('/')[1]
      const listing = mockDB.listings.find(l => l.id === listingId)
      
      if (!listing) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      const syncStatus = mockDB.icalSyncStatus[listingId] || { lastSync: null, status: 'never' }
      
      return NextResponse.json({
        success: true,
        data: {
          externalCalUrl: listing.externalCalUrl || null,
          lastSync: syncStatus.lastSync,
          status: syncStatus.status,
        },
      })
    }

    // GET /api/profile
    if (path === 'profile') {
      // In real app, get user ID from auth session
      const userId = searchParams.get('userId') || 'partner-1'
      
      const user = mockDB.profiles.find(p => p.id === userId)
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: user,
      })
    }

    // GET /api/admin/stats
    if (path === 'admin/stats') {
      const totalUsers = mockDB.profiles.length
      const totalPartners = mockDB.profiles.filter(p => p.role === 'PARTNER').length
      const totalRenters = mockDB.profiles.filter(p => p.role === 'RENTER').length
      const activeBookings = mockDB.bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PAID').length
      const totalBookings = mockDB.bookings.length
      
      // Revenue by month (mock data for chart)
      const monthlyRevenue = [
        { month: 'Янв', thb: 180000, usdt: 2100 },
        { month: 'Фев', thb: 250000, usdt: 3500 },
        { month: 'Мар', thb: 320000, usdt: 4200 },
        { month: 'Апр', thb: 290000, usdt: 3800 },
        { month: 'Май', thb: 410000, usdt: 5400 },
      ]
      
      // Category distribution
      const categoryRevenue = [
        { category: 'Property', revenue: 850000, percentage: 68 },
        { category: 'Vehicles', revenue: 280000, percentage: 22 },
        { category: 'Tours', revenue: 95000, percentage: 8 },
        { category: 'Yachts', revenue: 25000, percentage: 2 },
      ]
      
      return NextResponse.json({
        success: true,
        data: {
          totalUsers,
          totalPartners,
          totalRenters,
          activeBookings,
          totalBookings,
          revenue: mockDB.platformBalance.totalRevenue,
          revenueUsdt: mockDB.platformBalance.totalRevenueUsdt,
          commission: mockDB.platformBalance.totalCommission,
          escrow: mockDB.platformBalance.totalEscrow,
          monthlyRevenue,
          categoryRevenue,
        },
      })
    }

    // GET /api/admin/pending-verifications
    if (path === 'admin/pending-verifications') {
      const pending = mockDB.profiles.filter(p => 
        p.role === 'PARTNER' && p.verificationStatus === 'PENDING'
      )
      
      return NextResponse.json({
        success: true,
        data: pending,
      })
    }

    // GET /api/admin/pending-listings
    if (path === 'admin/pending-listings') {
      const pending = mockDB.listings.filter(l => l.status === 'PENDING')
      
      // Enrich with owner info
      const enriched = pending.map(listing => {
        const owner = mockDB.profiles.find(p => p.id === listing.ownerId)
        return {
          ...listing,
          ownerName: owner?.name || 'Unknown',
          ownerEmail: owner?.email || '',
        }
      })
      
      return NextResponse.json({
        success: true,
        data: enriched,
      })
    }

    // GET /api/admin/payout-requests
    if (path === 'admin/payout-requests') {
      const status = searchParams.get('status') || 'PENDING'
      const payouts = mockDB.payouts.filter(p => p.status === status)
      
      return NextResponse.json({
        success: true,
        data: payouts,
      })
    }

    // GET /api/admin/users
    if (path === 'admin/users') {
      const role = searchParams.get('role')
      let users = mockDB.profiles
      
      if (role && role !== 'ALL') {
        users = users.filter(u => u.role === role)
      }
      
      return NextResponse.json({
        success: true,
        data: users,
      })
    }

    // GET /api/admin/activity-feed
    if (path === 'admin/activity-feed') {
      const limit = parseInt(searchParams.get('limit') || '10')
      
      // Combine recent activities
      const activities = []
      
      // Recent bookings
      mockDB.bookings.slice(-5).reverse().forEach(booking => {
        const listing = mockDB.listings.find(l => l.id === booking.listingId)
        const renter = mockDB.profiles.find(p => p.id === booking.renterId)
        activities.push({
          type: 'BOOKING',
          id: booking.id,
          description: `Новое бронирование: ${listing?.title || 'Unknown'}`,
          user: renter?.name || booking.guestName,
          timestamp: booking.createdAt,
          amount: booking.priceThb,
        })
      })
      
      // Recent users
      mockDB.profiles.slice(-3).reverse().forEach(profile => {
        if (profile.createdAt) {
          activities.push({
            type: 'SIGNUP',
            id: profile.id,
            description: `Новый пользователь: ${profile.role}`,
            user: profile.name || profile.email,
            timestamp: profile.createdAt,
          })
        }
      })
      
      // Recent payouts
      mockDB.payouts.forEach(payout => {
        activities.push({
          type: 'PAYOUT',
          id: payout.id,
          description: `Запрос на выплату: ${payout.amount} ${payout.currency}`,
          user: payout.metadata?.partnerName || 'Partner',
          timestamp: payout.requestedAt,
          amount: payout.amount,
        })
      })
      
      // Sort by timestamp
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      
      return NextResponse.json({
        success: true,
        data: activities.slice(0, limit),
      })
    }

    // GET /api/admin/categories
    if (path === 'admin/categories') {
      // Return all categories including inactive for admin
      return NextResponse.json({
        success: true,
        data: mockDB.categories.sort((a, b) => a.order - b.order),
      })
    }

    // GET /api/admin/settings
    if (path === 'admin/settings') {
      return NextResponse.json({
        success: true,
        data: mockDB.systemSettings,
      })
    }

    // GET /api/admin/promo-codes
    if (path === 'admin/promo-codes') {
      return NextResponse.json({
        success: true,
        data: mockDB.promoCodes,
      })
    }

    // GET /api/admin/blacklist
    if (path === 'admin/blacklist') {
      return NextResponse.json({
        success: true,
        data: mockDB.blacklist,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Endpoint not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST Handler
export async function POST(request) {
  try {
    const path = getPathFromUrl(request.url)
    
    // Try to parse JSON body, but handle empty body gracefully
    let body = {}
    try {
      const text = await request.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch (e) {
      // Empty or invalid JSON, use empty object
      body = {}
    }

    // POST /api/auth/register
    if (path === 'auth/register') {
      const { email, password, referredBy, name } = body
      
      const existing = mockDB.profiles.find(p => p.email === email)
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Email already registered' },
          { status: 400 }
        )
      }
      
      const newProfile = {
        id: uuidv4(),
        email,
        name: name || email.split('@')[0],
        role: 'RENTER',
        referralCode: generateReferralCode(),
        referredBy: referredBy || null,
        balancePoints: 0,
        balanceUsdt: 0,
        preferredCurrency: 'THB',
        verificationStatus: 'PENDING',
        notificationPreferences: {
          email: true,
          telegram: false,
          telegramChatId: null,
        },
        createdAt: new Date().toISOString(),
      }
      
      mockDB.profiles.push(newProfile)
      
      // Send welcome notification
      try {
        await dispatchNotification(NotificationEvents.USER_WELCOME, newProfile, {
          loginUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/login`,
        })
      } catch (error) {
        console.error('Failed to send welcome notification:', error)
      }
      
      return NextResponse.json({
        success: true,
        data: newProfile,
        message: 'Registration successful',
      })
    }

    // POST /api/auth/login
    if (path === 'auth/login') {
      const { email, password } = body
      
      let user = mockDB.profiles.find(p => p.email === email)
      
      if (!user) {
        user = {
          id: uuidv4(),
          email,
          role: 'RENTER',
          referralCode: generateReferralCode(),
          preferredCurrency: 'THB',
        }
      }
      
      return NextResponse.json({
        success: true,
        data: user,
        message: 'Login successful',
      })
    }

    // POST /api/bookings (with conversation creation)
    if (path === 'bookings') {
      const { listingId, checkIn, checkOut, guestName, guestPhone, guestEmail, initialMessage, renterId, currency } = body
      
      const listing = mockDB.listings.find(l => l.id === listingId)
      if (!listing) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      // Calculate days and price
      const days = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
      
      // Get seasonal prices for this listing
      const seasonalPrices = mockDB.seasonalPrices.filter(sp => sp.listingId === listingId)
      
      // Use seasonal price calculator
      const isMonthly = days >= 30
      let priceCalculation
      
      if (seasonalPrices.length > 0) {
        // Import price calculator (inline for now)
        // Calculate with seasonal pricing
        const checkInDate = new Date(checkIn)
        const checkOutDate = new Date(checkOut)
        let totalPrice = 0
        let breakdown = []
        
        // For each day, find applicable seasonal price
        let currentDate = new Date(checkInDate)
        for (let i = 0; i < days; i++) {
          const dateStr = currentDate.toISOString().split('T')[0]
          const applicableSeason = seasonalPrices.find(sp => {
            const start = new Date(sp.startDate)
            const end = new Date(sp.endDate)
            return currentDate >= start && currentDate <= end
          })
          
          const dayPrice = applicableSeason ? applicableSeason.priceDaily : listing.basePriceThb
          totalPrice += dayPrice
          
          currentDate.setDate(currentDate.getDate() + 1)
        }
        
        priceCalculation = {
          totalPrice,
          isSeasonalApplied: true,
        }
      } else {
        // Use base price
        priceCalculation = {
          totalPrice: listing.basePriceThb * days,
          isSeasonalApplied: false,
        }
      }
      
      const basePriceThb = priceCalculation.totalPrice
      const commissionThb = basePriceThb * (listing.commissionRate / 100)
      const totalPriceThb = basePriceThb
      
      // Create booking
      const booking = {
        id: uuidv4(),
        listingId,
        renterId: renterId || 'renter-1',
        status: 'PENDING',
        checkIn,
        checkOut,
        priceThb: totalPriceThb,
        currency: currency || 'THB',
        pricePaid: totalPriceThb,
        exchangeRate: 1,
        commissionThb,
        commissionPaid: false,
        guestName,
        guestPhone,
        guestEmail,
        createdAt: new Date().toISOString(),
      }
      
      mockDB.bookings.push(booking)
      
      // Create or find conversation
      let conversation = mockDB.conversations.find(
        c => c.listingId === listingId && c.renterId === (renterId || 'renter-1')
      )
      
      if (!conversation) {
        conversation = {
          id: uuidv4(),
          listingId,
          renterId: renterId || 'renter-1',
          renterName: guestName,
          partnerId: listing.ownerId,
          lastMessageAt: new Date().toISOString(),
          unreadCountPartner: 1,
          unreadCountRenter: 0,
          status: 'ACTIVE',
        }
        mockDB.conversations.push(conversation)
      }
      
      // Add initial message if provided
      if (initialMessage) {
        const userMessage = {
          id: uuidv4(),
          conversationId: conversation.id,
          listingId,
          senderId: renterId || 'renter-1',
          senderRole: 'RENTER',
          senderName: guestName,
          message: initialMessage,
          type: 'USER',
          read: false,
          createdAt: new Date().toISOString(),
        }
        mockDB.messages.push(userMessage)
      }
      
      // Add system booking message
      const systemMessage = {
        id: uuidv4(),
        conversationId: conversation.id,
        listingId,
        senderId: 'system',
        senderRole: 'SYSTEM',
        message: `Новый запрос на бронирование: ${new Date(checkIn).toLocaleDateString('ru-RU')} - ${new Date(checkOut).toLocaleDateString('ru-RU')}`,
        type: 'BOOKING_REQUEST',
        bookingId: booking.id,
        metadata: {
          checkIn,
          checkOut,
          days,
          basePrice: basePriceThb,
          serviceFee: commissionThb,
          totalPrice: totalPriceThb,
        },
        read: false,
        createdAt: new Date().toISOString(),
      }
      mockDB.messages.push(systemMessage)
      
      // Send notification to partner about new booking
      try {
        const partner = mockDB.profiles.find(p => p.id === listing.ownerId)
        const renter = mockDB.profiles.find(p => p.id === (renterId || 'renter-1'))
        
        if (partner) {
          // Calculate price breakdown for email
          const days = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
          const seasonalPricesForListing = mockDB.seasonalPrices.filter(sp => sp.listingId === listingId)
          let priceBreakdown = []
          
          if (seasonalPricesForListing.length > 0) {
            // Group consecutive days by season
            let currentDate = new Date(checkIn)
            let currentSeason = null
            let currentDays = 0
            let currentPrice = 0
            
            for (let i = 0; i < days; i++) {
              const applicableSeason = seasonalPricesForListing.find(sp => {
                const start = new Date(sp.startDate)
                const end = new Date(sp.endDate)
                return currentDate >= start && currentDate <= end
              })
              
              const dayPrice = applicableSeason ? applicableSeason.priceDaily : listing.basePriceThb
              const seasonLabel = applicableSeason ? applicableSeason.label : 'Базовая цена'
              
              if (seasonLabel === currentSeason) {
                currentDays++
                currentPrice += dayPrice
              } else {
                if (currentSeason) {
                  priceBreakdown.push({
                    label: `${currentDays} ${currentDays === 1 ? 'день' : currentDays < 5 ? 'дня' : 'дней'} × ${Math.round(currentPrice / currentDays).toLocaleString('ru-RU')} ₿ (${currentSeason})`,
                    amount: currentPrice,
                  })
                }
                currentSeason = seasonLabel
                currentDays = 1
                currentPrice = dayPrice
              }
              
              currentDate.setDate(currentDate.getDate() + 1)
            }
            
            // Add last group
            if (currentSeason) {
              priceBreakdown.push({
                label: `${currentDays} ${currentDays === 1 ? 'день' : currentDays < 5 ? 'дня' : 'дней'} × ${Math.round(currentPrice / currentDays).toLocaleString('ru-RU')} ₿ (${currentSeason})`,
                amount: currentPrice,
              })
            }
          }
          
          await dispatchNotification(NotificationEvents.NEW_BOOKING_REQUEST, partner, {
            booking,
            listing,
            renter: renter || { name: guestName },
            priceBreakdown: priceBreakdown.length > 0 ? priceBreakdown : null,
          })
        }
      } catch (error) {
        console.error('Failed to send booking notification:', error)
      }
      
      return NextResponse.json({
        success: true,
        data: { booking, conversation, message: systemMessage },
        message: 'Booking request created successfully',
      })
    }

    // POST /api/messages
    if (path === 'messages') {
      const { conversationId, senderId, senderRole, senderName, message, type = 'USER' } = body
      
      const newMessage = {
        id: uuidv4(),
        conversationId,
        listingId: mockDB.conversations.find(c => c.id === conversationId)?.listingId,
        senderId,
        senderRole,
        senderName,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString(),
      }
      
      mockDB.messages.push(newMessage)
      
      // Update conversation
      const conv = mockDB.conversations.find(c => c.id === conversationId)
      if (conv) {
        conv.lastMessageAt = new Date().toISOString()
        if (senderRole === 'RENTER') conv.unreadCountPartner++
        else conv.unreadCountRenter++
      }
      
      return NextResponse.json({
        success: true,
        data: newMessage,
        message: 'Message sent',
      })
    }

    // POST /api/partner/listings
    if (path === 'partner/listings') {
      const partnerId = 'partner-1' // Mock auth
      
      const newListing = {
        id: uuidv4(),
        ownerId: partnerId,
        status: 'PENDING',
        available: true,
        rating: 0,
        views: 0,
        bookingsCount: 0,
        createdAt: new Date().toISOString(),
        ...body,
      }
      
      mockDB.listings.push(newListing)
      
      return NextResponse.json({
        success: true,
        data: newListing,
        message: 'Listing created successfully',
      })
    }

    // POST /api/reviews
    if (path === 'reviews') {
      const { bookingId, renterId, renterName, listingId, rating, comment, photos = [] } = body
      
      // Validate booking exists and is completed
      const booking = mockDB.bookings.find(b => b.id === bookingId)
      if (!booking) {
        return NextResponse.json(
          { success: false, error: 'Booking not found' },
          { status: 404 }
        )
      }
      
      if (booking.status !== 'COMPLETED') {
        return NextResponse.json(
          { success: false, error: 'Can only review completed bookings' },
          { status: 400 }
        )
      }
      
      // Check if review already exists
      const existingReview = mockDB.reviews.find(r => r.bookingId === bookingId)
      if (existingReview) {
        return NextResponse.json(
          { success: false, error: 'Review already exists for this booking' },
          { status: 400 }
        )
      }
      
      // Create review
      const newReview = {
        id: uuidv4(),
        listingId,
        bookingId,
        renterId,
        renterName,
        rating,
        comment,
        photos,
        partnerReply: null,
        createdAt: new Date().toISOString(),
      }
      
      mockDB.reviews.push(newReview)
      
      // Update listing rating and reviewsCount
      const listingReviews = mockDB.reviews.filter(r => r.listingId === listingId)
      const avgRating = listingReviews.reduce((sum, r) => sum + r.rating, 0) / listingReviews.length
      const listing = mockDB.listings.find(l => l.id === listingId)
      if (listing) {
        listing.rating = parseFloat(avgRating.toFixed(1))
        listing.reviewsCount = listingReviews.length
      }
      
      // Mock notification to partner
      console.log(`[TELEGRAM] Новый отзыв ${rating}⭐ на объявление "${listing?.title}"`)
      
      return NextResponse.json({
        success: true,
        data: newReview,
        message: 'Review created successfully',
      })
    }

    // POST /api/reviews/:id/reply
    if (path.match(/^reviews\/(.+)\/reply$/)) {
      const reviewId = path.split('/')[1]
      const { replyText, partnerId } = body
      
      const review = mockDB.reviews.find(r => r.id === reviewId)
      if (!review) {
        return NextResponse.json(
          { success: false, error: 'Review not found' },
          { status: 404 }
        )
      }
      
      // Check if partner owns the listing
      const listing = mockDB.listings.find(l => l.id === review.listingId)
      if (!listing || listing.ownerId !== partnerId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        )
      }
      
      // Check if reply already exists
      if (review.partnerReply) {
        return NextResponse.json(
          { success: false, error: 'Reply already exists' },
          { status: 400 }
        )
      }
      
      // Add reply
      review.partnerReply = {
        text: replyText,
        createdAt: new Date().toISOString(),
      }
      
      // Mock notification to renter
      console.log(`[TELEGRAM] Партнёр ответил на ваш отзыв: "${listing.title}"`)
      
      return NextResponse.json({
        success: true,
        data: review,
        message: 'Reply added successfully',
      })
    }

    // POST /api/bookings/:id/payment/initiate
    if (path.match(/^bookings\/(.+)\/payment\/initiate$/)) {
      const bookingId = path.split('/')[1]
      const { method } = body // CARD, MIR, or CRYPTO
      
      const booking = mockDB.bookings.find(b => b.id === bookingId)
      if (!booking) {
        return NextResponse.json(
          { success: false, error: 'Booking not found' },
          { status: 404 }
        )
      }
      
      if (booking.status !== 'CONFIRMED') {
        return NextResponse.json(
          { success: false, error: 'Booking must be CONFIRMED to pay' },
          { status: 400 }
        )
      }
      
      // Check if payment already exists
      const existingPayment = mockDB.payments.find(p => p.bookingId === bookingId)
      if (existingPayment) {
        return NextResponse.json(
          { success: false, error: 'Payment already initiated' },
          { status: 400 }
        )
      }
      
      // Create payment record
      const payment = {
        id: uuidv4(),
        bookingId,
        amount: booking.priceThb,
        currency: booking.currency,
        method,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      }
      
      // For crypto, generate mock wallet address
      if (method === 'CRYPTO') {
        payment.metadata = {
          walletAddress: 'TXYZMockWallet12345AbCdEfGhIjKlMnOpQrStUvWxYz',
          network: 'TRC-20',
          amount: booking.currency === 'USDT' ? booking.pricePaid : (booking.priceThb / 33.5).toFixed(2),
        }
      }
      
      mockDB.payments.push(payment)
      
      return NextResponse.json({
        success: true,
        data: payment,
        message: 'Payment initiated',
      })
    }

    // POST /api/bookings/:id/payment/confirm
    if (path.match(/^bookings\/(.+)\/payment\/confirm$/)) {
      const bookingId = path.split('/')[1]
      const { txId, gatewayRef } = body
      
      const booking = mockDB.bookings.find(b => b.id === bookingId)
      const payment = mockDB.payments.find(p => p.bookingId === bookingId)
      
      if (!booking || !payment) {
        return NextResponse.json(
          { success: false, error: 'Booking or payment not found' },
          { status: 404 }
        )
      }
      
      // Update payment status
      payment.status = 'COMPLETED'
      payment.completedAt = new Date().toISOString()
      if (txId) payment.txId = txId
      if (gatewayRef) payment.gatewayRef = gatewayRef
      
      // Update booking status to PAID
      booking.status = 'PAID'
      
      // Add to platform escrow
      mockDB.platformBalance.totalEscrow += booking.priceThb
      
      // Send payment success notification
      try {
        const listing = mockDB.listings.find(l => l.id === booking.listingId)
        const renter = mockDB.profiles.find(p => p.id === booking.renterId)
        
        if (renter) {
          await dispatchNotification(NotificationEvents.PAYMENT_SUCCESS, renter, {
            booking,
            listing,
          })
        }
      } catch (error) {
        console.error('Failed to send payment notification:', error)
      }
      
      return NextResponse.json({
        success: true,
        data: { booking, payment },
        message: 'Payment confirmed! Booking is now PAID.',
      })
    }

    // POST /api/bookings/:id/check-in/confirm
    if (path.match(/^bookings\/(.+)\/check-in\/confirm$/)) {
      const bookingId = path.split('/')[1]
      
      const booking = mockDB.bookings.find(b => b.id === bookingId)
      if (!booking) {
        return NextResponse.json(
          { success: false, error: 'Booking not found' },
          { status: 404 }
        )
      }
      
      if (booking.status !== 'PAID') {
        return NextResponse.json(
          { success: false, error: 'Booking must be PAID to confirm check-in' },
          { status: 400 }
        )
      }
      
      // Get listing and partner
      const listing = mockDB.listings.find(l => l.id === booking.listingId)
      const partner = mockDB.profiles.find(p => p.id === listing?.ownerId)
      
      // Use custom commission rate if set, otherwise use global default
      const commissionRate = partner?.customCommissionRate ?? mockDB.systemSettings.defaultCommissionRate
      
      // Calculate commission and net amount
      const commission = booking.priceThb * (commissionRate / 100)
      const netAmount = booking.priceThb - commission
      
      // Update partner's available balance
      if (partner) {
        partner.availableBalance = (partner.availableBalance || 0) + netAmount
      }
      
      // Update platform balance
      mockDB.platformBalance.totalEscrow -= booking.priceThb
      mockDB.platformBalance.totalCommission += commission
      
      // Create commission record
      const commissionRecord = {
        id: uuidv4(),
        listingId: booking.listingId,
        bookingId: booking.id,
        partnerId: listing.ownerId,
        amountThb: commission,
        amountUsdt: commission / 33.5,
        paid: false,
        period: new Date().toISOString().slice(0, 7), // YYYY-MM
        bookingsCount: 1,
        createdAt: new Date().toISOString(),
      }
      
      // Check if commission record for this period exists
      const existingCommission = mockDB.commissions?.find(
        c => c.partnerId === listing.ownerId && c.period === commissionRecord.period
      )
      
      if (existingCommission) {
        existingCommission.amountThb += commission
        existingCommission.amountUsdt += commission / 33.5
        existingCommission.bookingsCount += 1
      } else {
        if (!mockDB.commissions) mockDB.commissions = []
        mockDB.commissions.push(commissionRecord)
      }
      
      // Mock notification
      console.log(`[TELEGRAM] Check-in подтверждён! ${netAmount} THB доступно для вывода.`)
      
      return NextResponse.json({
        success: true,
        data: {
          booking,
          commission,
          netAmount,
          partnerBalance: partner.availableBalance,
        },
        message: 'Check-in confirmed! Funds transferred to partner.',
      })
    }

    // POST /api/partner/payouts/request
    if (path === 'partner/payouts/request') {
      const { partnerId, amount, currency, method, walletAddress, bankAccount } = body
      
      const partner = mockDB.profiles.find(p => p.id === partnerId)
      if (!partner) {
        return NextResponse.json(
          { success: false, error: 'Partner not found' },
          { status: 404 }
        )
      }
      
      // Check minimum withdrawal
      const minWithdrawal = currency === 'USDT' ? 30 : 1000
      if (amount < minWithdrawal) {
        return NextResponse.json(
          { success: false, error: `Minimum withdrawal: ${minWithdrawal} ${currency}` },
          { status: 400 }
        )
      }
      
      // Check available balance
      if (amount > (partner.availableBalance || 0)) {
        return NextResponse.json(
          { success: false, error: 'Insufficient balance' },
          { status: 400 }
        )
      }
      
      // Create payout request
      const payout = {
        id: uuidv4(),
        partnerId,
        amount,
        currency,
        method,
        status: 'PENDING',
        walletAddress: method === 'USDT' ? walletAddress : null,
        bankAccount: method === 'PROMPTPAY' ? bankAccount : null,
        createdAt: new Date().toISOString(),
      }
      
      mockDB.payouts.push(payout)
      
      // Deduct from available balance
      partner.availableBalance -= amount
      
      // Mock notification
      console.log(`[TELEGRAM] Новый запрос на вывод: ${amount} ${currency} через ${method}`)
      
      return NextResponse.json({
        success: true,
        data: payout,
        message: 'Payout request submitted successfully',
      })
    }

    // POST /api/listings/:id/sync-ical
    if (path.match(/^listings\/(.+)\/sync-ical$/)) {
      const listingId = path.split('/')[1]
      
      const listing = mockDB.listings.find(l => l.id === listingId)
      if (!listing) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      if (!listing.externalCalUrl) {
        return NextResponse.json(
          { success: false, error: 'No iCal URL configured' },
          { status: 400 }
        )
      }
      
      // Mock iCal parsing (in real app, fetch and parse .ics file)
      // Simulate finding blocked dates
      const mockBlockedDates = [
        {
          id: uuidv4(),
          listingId,
          startDate: '2025-03-25',
          endDate: '2025-03-30',
          source: 'external',
          reason: 'Booked on Airbnb',
          createdAt: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          listingId,
          startDate: '2025-04-05',
          endDate: '2025-04-07',
          source: 'external',
          reason: 'Booked on Booking.com',
          createdAt: new Date().toISOString(),
        },
      ]
      
      // Remove old external dates for this listing
      mockDB.unavailableDates = mockDB.unavailableDates.filter(
        d => !(d.listingId === listingId && d.source === 'external')
      )
      
      // Add new dates
      mockDB.unavailableDates.push(...mockBlockedDates)
      
      // Update sync status
      mockDB.icalSyncStatus[listingId] = {
        lastSync: new Date().toISOString(),
        status: 'success',
        datesFound: mockBlockedDates.length,
      }
      
      console.log(`[iCAL SYNC] Listing ${listingId}: Found ${mockBlockedDates.length} blocked dates`)
      
      return NextResponse.json({
        success: true,
        data: {
          syncedAt: new Date().toISOString(),
          datesBlocked: mockBlockedDates.length,
          dates: mockBlockedDates,
        },
        message: 'Calendar synced successfully',
      })
    }

    // POST /api/listings/:id/seasonal-prices
    if (path.match(/^listings\/[^\/]+\/seasonal-prices$/)) {
      const listingId = path.split('/')[1]
      const { startDate, endDate, label, seasonType, priceDaily, priceMonthly, description } = body
      
      // Validate required fields
      if (!startDate || !endDate || !label || !priceDaily) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        )
      }
      
      // Validate dates and check overlaps
      const existingPrices = mockDB.seasonalPrices.filter(sp => sp.listingId === listingId)
      const newStart = new Date(startDate)
      const newEnd = new Date(endDate)
      
      if (newStart >= newEnd) {
        return NextResponse.json(
          { success: false, error: 'Дата начала должна быть раньше даты окончания' },
          { status: 400 }
        )
      }
      
      // Check for overlaps
      for (const range of existingPrices) {
        const existingStart = new Date(range.startDate)
        const existingEnd = new Date(range.endDate)
        
        const overlaps =
          (newStart >= existingStart && newStart <= existingEnd) ||
          (newEnd >= existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        
        if (overlaps) {
          return NextResponse.json(
            { 
              success: false, 
              error: `Этот диапазон дат пересекается с сезоном "${range.label}" (${range.startDate} - ${range.endDate})`,
            },
            { status: 400 }
          )
        }
      }
      
      // Create new seasonal price
      const newPrice = {
        id: `sp-${Date.now()}`,
        listingId,
        startDate,
        endDate,
        label,
        seasonType: seasonType || 'NORMAL',
        priceDaily: parseFloat(priceDaily),
        priceMonthly: priceMonthly ? parseFloat(priceMonthly) : null,
        description: description || null,
        createdAt: new Date().toISOString(),
      }
      
      mockDB.seasonalPrices.push(newPrice)
      
      console.log(`[SEASONAL PRICE] Created for listing ${listingId}: ${label} (${startDate} - ${endDate})`)
      
      return NextResponse.json({
        success: true,
        data: newPrice,
        message: 'Сезонная цена создана',
      })
    }

    // POST /api/telegram/link-code
    if (path === 'telegram/link-code') {
      const userId = body.userId || 'partner-1' // In real app, get from auth session
      
      // Generate 6-digit code
      const code = generateTelegramLinkCode()
      
      // Store code with expiration
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + 15) // 15 minutes expiry
      
      mockDB.telegramLinkingCodes.push({
        code,
        userId,
        expiresAt: expiresAt.toISOString(),
        used: false,
      })
      
      console.log(`[TELEGRAM] Link code generated for user ${userId}: ${code}`)
      
      return NextResponse.json({
        success: true,
        data: { code, expiresAt: expiresAt.toISOString() },
      })
    }

    // POST /api/admin/partners/:id/verify
    if (path.match(/^admin\/partners\/(.+)\/verify$/)) {
      const partnerId = path.split('/')[2]
      
      const partner = mockDB.profiles.find(p => p.id === partnerId && p.role === 'PARTNER')
      if (!partner) {
        return NextResponse.json(
          { success: false, error: 'Partner not found' },
          { status: 404 }
        )
      }
      
      // Update verification status
      partner.isVerified = true
      partner.verifiedAt = new Date().toISOString()
      
      // Send verification notification
      try {
        await dispatchNotification(NotificationEvents.PARTNER_VERIFIED, partner, {})
      } catch (error) {
        console.error('Failed to send verification notification:', error)
      }
      
      console.log(`[ADMIN] Partner ${partner.name} (${partnerId}) verified`)
      
      return NextResponse.json({
        success: true,
        data: partner,
        message: 'Partner verified successfully',
      })
    }

    // POST /api/admin/payouts/:id/process
    if (path.match(/^admin\/payouts\/(.+)\/process$/)) {
      const payoutId = path.split('/')[2]
      const { transactionId } = body
      
      const payout = mockDB.payouts.find(p => p.id === payoutId)
      if (!payout) {
        return NextResponse.json(
          { success: false, error: 'Payout not found' },
          { status: 404 }
        )
      }
      
      // Update payout status
      payout.status = 'COMPLETED'
      payout.processedAt = new Date().toISOString()
      payout.transactionId = transactionId || `TX-${Date.now()}`
      
      // Find partner
      const partner = mockDB.profiles.find(p => p.id === payout.partnerId)
      
      // Send payout notification
      if (partner) {
        try {
          await dispatchNotification(NotificationEvents.PAYOUT_PROCESSED, partner, {
            amount: payout.amount,
            currency: payout.currency || 'THB',
            method: payout.method,
            destination: payout.destination,
            transactionId: payout.transactionId,
          })
        } catch (error) {
          console.error('Failed to send payout notification:', error)
        }
      }
      
      console.log(`[ADMIN] Payout ${payoutId} processed for partner ${payout.partnerId}`)
      
      return NextResponse.json({
        success: true,
        data: payout,
        message: 'Payout processed successfully',
      })
    }

    // POST /api/admin/partners/:id/reject
    if (path.match(/^admin\/partners\/(.+)\/reject$/)) {
      const partnerId = path.split('/')[2]
      const { reason } = body
      
      const partner = mockDB.profiles.find(p => p.id === partnerId && p.role === 'PARTNER')
      if (!partner) {
        return NextResponse.json(
          { success: false, error: 'Partner not found' },
          { status: 404 }
        )
      }
      
      // Update verification status
      partner.isVerified = false
      partner.verificationStatus = 'REJECTED'
      partner.rejectionReason = reason || 'Does not meet requirements'
      partner.rejectedAt = new Date().toISOString()
      
      console.log(`[ADMIN] Partner ${partner.name} (${partnerId}) rejected`)
      
      return NextResponse.json({
        success: true,
        data: partner,
        message: 'Partner rejected',
      })
    }

    // POST /api/admin/categories
    if (path === 'admin/categories') {
      const { name, slug, icon, order } = body
      
      const newCategory = {
        id: `cat-${Date.now()}`,
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        icon: icon || '📦',
        order: order || mockDB.categories.length + 1,
        isActive: true,
      }
      
      mockDB.categories.push(newCategory)
      
      console.log(`[ADMIN] Category created: ${name} (${newCategory.id})`)
      
      return NextResponse.json({
        success: true,
        data: newCategory,
        message: 'Category created successfully',
      })
    }

    // POST /api/admin/promo-codes
    if (path === 'admin/promo-codes') {
      const { code, type, value, expiryDate, usageLimit } = body
      
      const newPromo = {
        id: `promo-${Date.now()}`,
        code: code.toUpperCase(),
        type,
        value: parseFloat(value),
        expiryDate,
        usageLimit: parseInt(usageLimit),
        usedCount: 0,
        isActive: true,
        createdBy: 'admin-777',
        createdAt: new Date().toISOString(),
      }
      
      mockDB.promoCodes.push(newPromo)
      
      console.log(`[ADMIN] Promo code created: ${code} (${type}: ${value})`)
      
      return NextResponse.json({
        success: true,
        data: newPromo,
        message: 'Promo code created',
      })
    }

    // POST /api/promo-codes/validate
    if (path === 'promo-codes/validate') {
      const { code, amount, bookingAmount } = body
      const priceAmount = amount || bookingAmount
      
      const promo = mockDB.promoCodes.find(p => p.code === code.toUpperCase())
      
      if (!promo) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: 'Промокод не найден',
        })
      }
      
      if (!promo.isActive) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: 'Промокод деактивирован',
        })
      }
      
      const now = new Date()
      const expiry = new Date(promo.expiryDate)
      if (now > expiry) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: 'Промокод истёк',
        })
      }
      
      if (promo.usedCount >= promo.usageLimit) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: 'Лимит использований исчерпан',
        })
      }
      
      let discountAmount = 0
      if (promo.type === 'PERCENT') {
        discountAmount = (priceAmount * promo.value) / 100
      } else {
        discountAmount = promo.value
      }
      
      const newTotal = Math.max(0, priceAmount - discountAmount)
      
      console.log(`[PROMO] Code ${code} validated: -${discountAmount} THB`)
      
      return NextResponse.json({
        success: true,
        valid: true,
        data: {
          code: promo.code,
          discountAmount,
          newTotal,
          type: promo.type,
          value: promo.value,
        },
        // Legacy fields for backward compatibility
        discount: discountAmount,
        promoType: promo.type,
        promoValue: promo.value,
      })
    }

    // POST /api/admin/blacklist/wallet
    if (path === 'admin/blacklist/wallet') {
      const { address, reason } = body
      
      mockDB.blacklist.wallets.push({
        address,
        reason: reason || 'No reason provided',
        addedAt: new Date().toISOString(),
      })
      
      console.log(`[SECURITY] Wallet blacklisted: ${address}`)
      
      return NextResponse.json({
        success: true,
        message: 'Wallet added to blacklist',
      })
    }

    // POST /api/admin/blacklist/phone
    if (path === 'admin/blacklist/phone') {
      const { number, reason } = body
      
      mockDB.blacklist.phones.push({
        number,
        reason: reason || 'No reason provided',
        addedAt: new Date().toISOString(),
      })
      
      console.log(`[SECURITY] Phone blacklisted: ${number}`)
      
      return NextResponse.json({
        success: true,
        message: 'Phone added to blacklist',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Endpoint not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT Handler
export async function PUT(request) {
  try {
    const path = getPathFromUrl(request.url)
    const body = await request.json()

    // PUT /api/partner/listings/:id
    if (path.startsWith('partner/listings/')) {
      const id = path.split('/')[2]
      const listingIndex = mockDB.listings.findIndex(l => l.id === id)
      
      if (listingIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      mockDB.listings[listingIndex] = {
        ...mockDB.listings[listingIndex],
        ...body,
        updatedAt: new Date().toISOString(),
      }
      
      return NextResponse.json({
        success: true,
        data: mockDB.listings[listingIndex],
        message: 'Listing updated successfully',
      })
    }

    // PUT /api/partner/bookings/:id/status
    if (path.match(/partner\/bookings\/(.+)\/status/)) {
      const id = path.split('/')[2]
      const bookingIndex = mockDB.bookings.findIndex(b => b.id === id)
      
      if (bookingIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Booking not found' },
          { status: 404 }
        )
      }
      
      mockDB.bookings[bookingIndex].status = body.status
      
      return NextResponse.json({
        success: true,
        data: mockDB.bookings[bookingIndex],
        message: 'Booking status updated',
      })
    }

    // PUT /api/listings/:listingId/seasonal-prices/:priceId
    if (path.match(/^listings\/[^\/]+\/seasonal-prices\/[^\/]+$/)) {
      const parts = path.split('/')
      const listingId = parts[1]
      const priceId = parts[3]
      
      const priceIndex = mockDB.seasonalPrices.findIndex(
        sp => sp.id === priceId && sp.listingId === listingId
      )
      
      if (priceIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Seasonal price not found' },
          { status: 404 }
        )
      }
      
      // Validate new dates
      const { startDate, endDate, label, seasonType, priceDaily, priceMonthly, description } = body
      
      if (startDate && endDate) {
        // Check for overlaps (excluding current price)
        const existingPrices = mockDB.seasonalPrices.filter(
          sp => sp.listingId === listingId && sp.id !== priceId
        )
        
        const newStart = new Date(startDate)
        const newEnd = new Date(endDate)
        
        if (newStart >= newEnd) {
          return NextResponse.json(
            { success: false, error: 'Дата начала должна быть раньше даты окончания' },
            { status: 400 }
          )
        }
        
        for (const range of existingPrices) {
          const existingStart = new Date(range.startDate)
          const existingEnd = new Date(range.endDate)
          
          const overlaps =
            (newStart >= existingStart && newStart <= existingEnd) ||
            (newEnd >= existingStart && newEnd <= existingEnd) ||
            (newStart <= existingStart && newEnd >= existingEnd)
          
          if (overlaps) {
            return NextResponse.json(
              { 
                success: false, 
                error: `Этот диапазон дат пересекается с сезоном "${range.label}"`,
              },
              { status: 400 }
            )
          }
        }
      }
      
      // Update fields
      if (startDate) mockDB.seasonalPrices[priceIndex].startDate = startDate
      if (endDate) mockDB.seasonalPrices[priceIndex].endDate = endDate
      if (label) mockDB.seasonalPrices[priceIndex].label = label
      if (seasonType) mockDB.seasonalPrices[priceIndex].seasonType = seasonType
      if (priceDaily) mockDB.seasonalPrices[priceIndex].priceDaily = parseFloat(priceDaily)
      if (priceMonthly !== undefined) {
        mockDB.seasonalPrices[priceIndex].priceMonthly = priceMonthly ? parseFloat(priceMonthly) : null
      }
      if (description !== undefined) mockDB.seasonalPrices[priceIndex].description = description
      
      mockDB.seasonalPrices[priceIndex].updatedAt = new Date().toISOString()
      
      console.log(`[SEASONAL PRICE] Updated price ${priceId} for listing ${listingId}`)
      
      return NextResponse.json({
        success: true,
        data: mockDB.seasonalPrices[priceIndex],
        message: 'Сезонная цена обновлена',
      })
    }

    // PUT /api/profile/notifications
    if (path === 'profile/notifications') {
      // In real app, get user ID from auth session
      const userId = body.userId || 'partner-1'
      const { email, telegram, telegramChatId } = body
      
      const user = mockDB.profiles.find(p => p.id === userId)
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }
      
      // Update notification preferences
      user.notificationPreferences = {
        email: email !== undefined ? email : user.notificationPreferences?.email ?? true,
        telegram: telegram !== undefined ? telegram : user.notificationPreferences?.telegram ?? false,
        telegramChatId: telegramChatId !== undefined ? telegramChatId : user.notificationPreferences?.telegramChatId ?? null,
      }
      
      console.log(`[PROFILE] Updated notification preferences for user ${userId}`)
      
      return NextResponse.json({
        success: true,
        data: user,
        message: 'Notification preferences updated',
      })
    }

    // PUT /api/admin/listings/:id/status
    if (path.match(/^admin\/listings\/(.+)\/status$/)) {
      const listingId = path.split('/')[2]
      const { status } = body
      
      const listing = mockDB.listings.find(l => l.id === listingId)
      if (!listing) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      listing.status = status
      listing.moderatedAt = new Date().toISOString()
      
      if (status === 'ACTIVE') {
        listing.available = true
      }
      
      console.log(`[ADMIN] Listing ${listingId} status changed to ${status}`)
      
      return NextResponse.json({
        success: true,
        data: listing,
        message: 'Listing status updated',
      })
    }

    // PUT /api/admin/users/:id/role
    if (path.match(/^admin\/users\/(.+)\/role$/)) {
      const userId = path.split('/')[2]
      const { role } = body
      
      const user = mockDB.profiles.find(u => u.id === userId)
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }
      
      const oldRole = user.role
      user.role = role
      
      console.log(`[ADMIN] User ${user.name} (${userId}) role changed: ${oldRole} → ${role}`)
      
      return NextResponse.json({
        success: true,
        data: user,
        message: `User role changed to ${role}`,
      })
    }

    // PUT /api/admin/listings/:id/feature
    if (path.match(/^admin\/listings\/(.+)\/feature$/)) {
      const listingId = path.split('/')[2]
      
      const listing = mockDB.listings.find(l => l.id === listingId)
      if (!listing) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      listing.isFeatured = !listing.isFeatured
      
      console.log(`[ADMIN] Listing ${listing.title} featured: ${listing.isFeatured ? 'ON' : 'OFF'}`)
      
      return NextResponse.json({
        success: true,
        data: listing,
        message: `Listing ${listing.isFeatured ? 'featured' : 'unfeatured'}`,
      })
    }

    // PUT /api/admin/listings/:id/featured (with explicit value)
    if (path.match(/^admin\/listings\/(.+)\/featured$/)) {
      const listingId = path.split('/')[2]
      const { isFeatured } = body
      
      const listing = mockDB.listings.find(l => l.id === listingId)
      if (!listing) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      listing.isFeatured = isFeatured
      
      console.log(`[ADMIN] Listing ${listing.title} featured status set to: ${isFeatured}`)
      
      return NextResponse.json({
        success: true,
        data: listing,
        message: `Listing ${isFeatured ? 'featured' : 'unfeatured'}`,
      })
    }

    // PUT /api/admin/partners/:id/commission
    if (path.match(/^admin\/partners\/(.+)\/commission$/)) {
      const partnerId = path.split('/')[2]
      const { customCommissionRate } = body
      
      const partner = mockDB.profiles.find(p => p.id === partnerId && p.role === 'PARTNER')
      if (!partner) {
        return NextResponse.json(
          { success: false, error: 'Partner not found' },
          { status: 404 }
        )
      }
      
      const oldRate = partner.customCommissionRate
      partner.customCommissionRate = customCommissionRate
      
      console.log(`[ADMIN] Partner ${partner.name} commission: ${oldRate || 'global'} → ${customCommissionRate || 'global'}`)
      
      return NextResponse.json({
        success: true,
        data: partner,
        message: 'Commission rate updated',
      })
    }

    // PUT /api/admin/categories/:id/toggle
    if (path.match(/^admin\/categories\/(.+)\/toggle$/)) {
      const categoryId = path.split('/')[2]
      
      const category = mockDB.categories.find(c => c.id === categoryId)
      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404 }
        )
      }
      
      category.isActive = !category.isActive
      
      console.log(`[ADMIN] Category ${category.name} (${categoryId}) toggled: ${category.isActive ? 'ON' : 'OFF'}`)
      
      return NextResponse.json({
        success: true,
        data: category,
        message: `Category ${category.isActive ? 'activated' : 'deactivated'}`,
      })
    }

    // PUT /api/admin/settings
    if (path === 'admin/settings') {
      const { defaultCommissionRate, maintenanceMode, heroTitle, heroSubtitle } = body
      
      if (defaultCommissionRate !== undefined) {
        mockDB.systemSettings.defaultCommissionRate = parseFloat(defaultCommissionRate)
      }
      
      if (maintenanceMode !== undefined) {
        mockDB.systemSettings.maintenanceMode = maintenanceMode
        mockDB.systemSettings.maintenanceModeUpdatedAt = new Date().toISOString()
        mockDB.systemSettings.maintenanceModeUpdatedBy = 'admin-777'
      }
      
      if (heroTitle !== undefined) {
        mockDB.systemSettings.heroTitle = heroTitle
      }
      
      if (heroSubtitle !== undefined) {
        mockDB.systemSettings.heroSubtitle = heroSubtitle
      }
      
      console.log(`[ADMIN] System settings updated:`, mockDB.systemSettings)
      
      return NextResponse.json({
        success: true,
        data: mockDB.systemSettings,
        message: 'Settings updated',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Endpoint not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE Handler
export async function DELETE(request) {
  try {
    const path = getPathFromUrl(request.url)

    // DELETE /api/partner/listings/:id
    if (path.startsWith('partner/listings/')) {
      const id = path.split('/')[2]
      const listingIndex = mockDB.listings.findIndex(l => l.id === id)
      
      if (listingIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Listing not found' },
          { status: 404 }
        )
      }
      
      mockDB.listings.splice(listingIndex, 1)
      
      return NextResponse.json({
        success: true,
        message: 'Listing deleted successfully',
      })
    }

    // DELETE /api/listings/:listingId/seasonal-prices/:priceId
    if (path.match(/^listings\/[^\/]+\/seasonal-prices\/[^\/]+$/)) {
      const parts = path.split('/')
      const listingId = parts[1]
      const priceId = parts[3]
      
      const priceIndex = mockDB.seasonalPrices.findIndex(
        sp => sp.id === priceId && sp.listingId === listingId
      )
      
      if (priceIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Seasonal price not found' },
          { status: 404 }
        )
      }
      
      mockDB.seasonalPrices.splice(priceIndex, 1)
      
      console.log(`[SEASONAL PRICE] Deleted price ${priceId} for listing ${listingId}`)
      
      return NextResponse.json({
        success: true,
        message: 'Сезонная цена удалена',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Endpoint not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}