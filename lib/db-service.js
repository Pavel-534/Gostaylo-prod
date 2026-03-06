/**
 * Gostaylo - Database Service Layer
 * Provides unified access to data via Supabase or MockDB fallback
 */

import { supabaseAdmin, isSupabaseConfigured } from './supabase';

// Check if we should use real Supabase
const USE_SUPABASE = isSupabaseConfigured();

console.log(`[DB] Mode: ${USE_SUPABASE ? 'SUPABASE' : 'MOCK'}`);

// ============================================================================
// PROFILES
// ============================================================================

export const profilesService = {
  async findAll() {
    if (!USE_SUPABASE) return null; // Let caller use mockDB
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return transformProfiles(data);
  },

  async findById(id) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? transformProfile(data) : null;
  },

  async findByEmail(email) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? transformProfile(data) : null;
  },

  async findByRole(role) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', role)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return transformProfiles(data);
  },

  async create(profile) {
    if (!USE_SUPABASE) return null;
    const dbProfile = transformProfileToDB(profile);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert(dbProfile)
      .select()
      .single();
    if (error) throw error;
    return transformProfile(data);
  },

  async update(id, updates) {
    if (!USE_SUPABASE) return null;
    const dbUpdates = transformProfileToDB(updates);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return transformProfile(data);
  },

  async delete(id) {
    if (!USE_SUPABASE) return null;
    const { error } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

// ============================================================================
// CATEGORIES
// ============================================================================

export const categoriesService = {
  async findAll(activeOnly = false) {
    if (!USE_SUPABASE) return null;
    let query = supabaseAdmin.from('categories').select('*').order('order');
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return transformCategories(data);
  },

  async findById(id) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? transformCategory(data) : null;
  },

  async findBySlug(slug) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? transformCategory(data) : null;
  },

  async create(category) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        order: category.order || 0,
        is_active: category.isActive !== false
      })
      .select()
      .single();
    if (error) throw error;
    return transformCategory(data);
  },

  async update(id, updates) {
    if (!USE_SUPABASE) return null;
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.order !== undefined) dbUpdates.order = updates.order;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    
    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return transformCategory(data);
  },

  async toggleActive(id) {
    if (!USE_SUPABASE) return null;
    // First get current state
    const { data: current } = await supabaseAdmin
      .from('categories')
      .select('is_active')
      .eq('id', id)
      .single();
    
    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({ is_active: !current.is_active })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return transformCategory(data);
  }
};

// ============================================================================
// LISTINGS
// ============================================================================

export const listingsService = {
  async findAll(filters = {}) {
    if (!USE_SUPABASE) return null;
    
    let query = supabaseAdmin
      .from('listings')
      .select('*, categories(name, slug)')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.category) {
      const cat = await categoriesService.findBySlug(filters.category);
      if (cat) query = query.eq('category_id', cat.id);
    }
    if (filters.district) {
      query = query.eq('district', filters.district);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.ownerId) {
      query = query.eq('owner_id', filters.ownerId);
    }
    if (filters.minPrice) {
      query = query.gte('base_price_thb', filters.minPrice);
    }
    if (filters.maxPrice) {
      query = query.lte('base_price_thb', filters.maxPrice);
    }
    if (filters.available !== undefined) {
      query = query.eq('available', filters.available);
    }

    const { data, error } = await query;
    if (error) throw error;
    return transformListings(data);
  },

  async findById(id) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select('*, categories(name, slug)')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? transformListing(data) : null;
  },

  async create(listing) {
    if (!USE_SUPABASE) return null;
    const dbListing = transformListingToDB(listing);
    const { data, error } = await supabaseAdmin
      .from('listings')
      .insert(dbListing)
      .select()
      .single();
    if (error) throw error;
    return transformListing(data);
  },

  async update(id, updates) {
    if (!USE_SUPABASE) return null;
    const dbUpdates = transformListingToDB(updates);
    const { data, error } = await supabaseAdmin
      .from('listings')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return transformListing(data);
  },

  async delete(id) {
    if (!USE_SUPABASE) return null;
    const { error } = await supabaseAdmin
      .from('listings')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async incrementViews(id) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin.rpc('increment_listing_views', { listing_id: id });
    if (error) {
      // Fallback: manual increment
      const listing = await this.findById(id);
      if (listing) {
        await this.update(id, { views: (listing.views || 0) + 1 });
      }
    }
    return true;
  }
};

// ============================================================================
// BOOKINGS
// ============================================================================

export const bookingsService = {
  async findAll(filters = {}) {
    if (!USE_SUPABASE) return null;
    
    let query = supabaseAdmin
      .from('bookings')
      .select('*, listings(title, district, base_price_thb, images)')
      .order('created_at', { ascending: false });

    if (filters.renterId) query = query.eq('renter_id', filters.renterId);
    if (filters.partnerId) query = query.eq('partner_id', filters.partnerId);
    if (filters.listingId) query = query.eq('listing_id', filters.listingId);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return transformBookings(data);
  },

  async findById(id) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*, listings(title, district, base_price_thb, images, owner_id)')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? transformBooking(data) : null;
  },

  async create(booking) {
    if (!USE_SUPABASE) return null;
    const dbBooking = transformBookingToDB(booking);
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(dbBooking)
      .select()
      .single();
    if (error) throw error;
    return transformBooking(data);
  },

  async update(id, updates) {
    if (!USE_SUPABASE) return null;
    const dbUpdates = transformBookingToDB(updates);
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return transformBooking(data);
  }
};

// ============================================================================
// PROMO CODES
// ============================================================================

export const promoCodesService = {
  async findByCode(code) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? transformPromoCode(data) : null;
  },

  async incrementUse(id) {
    if (!USE_SUPABASE) return null;
    const { error } = await supabaseAdmin
      .from('promo_codes')
      .update({ current_uses: supabaseAdmin.raw('current_uses + 1') })
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

// ============================================================================
// EXCHANGE RATES
// ============================================================================

export const exchangeRatesService = {
  async findAll() {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('*');
    if (error) throw error;
    return data.map(r => ({
      code: r.currency_code,
      rateToThb: parseFloat(r.rate_to_thb),
      symbol: getCurrencySymbol(r.currency_code)
    }));
  }
};

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

export const systemSettingsService = {
  async get(key = 'general') {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.value || null;
  },

  async update(key, value) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data.value;
  }
};

// ============================================================================
// BLACKLIST
// ============================================================================

export const blacklistService = {
  async findAll() {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('blacklist')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(b => ({
      id: b.id,
      type: b.blacklist_type,
      value: b.value,
      reason: b.reason,
      createdAt: b.created_at
    }));
  },

  async check(type, value) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('blacklist')
      .select('id')
      .eq('blacklist_type', type)
      .eq('value', value)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  async add(entry) {
    if (!USE_SUPABASE) return null;
    const { data, error } = await supabaseAdmin
      .from('blacklist')
      .insert({
        blacklist_type: entry.type,
        value: entry.value,
        reason: entry.reason,
        added_by: entry.addedBy
      })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, type: data.blacklist_type, value: data.value };
  },

  async remove(id) {
    if (!USE_SUPABASE) return null;
    const { error } = await supabaseAdmin
      .from('blacklist')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

// ============================================================================
// TRANSFORM HELPERS (DB <-> App format)
// ============================================================================

function transformProfile(dbProfile) {
  if (!dbProfile) return null;
  return {
    id: dbProfile.id,
    email: dbProfile.email,
    phone: dbProfile.phone,
    role: dbProfile.role,
    verificationStatus: dbProfile.verification_status,
    isVerified: dbProfile.is_verified,
    verificationDocs: dbProfile.verification_docs,
    telegramId: dbProfile.telegram_id,
    telegramLinked: dbProfile.telegram_linked,
    referralCode: dbProfile.referral_code,
    referredBy: dbProfile.referred_by,
    balancePoints: parseFloat(dbProfile.balance_points) || 0,
    balanceUsdt: parseFloat(dbProfile.balance_usdt) || 0,
    escrowBalance: parseFloat(dbProfile.escrow_balance) || 0,
    availableBalance: parseFloat(dbProfile.available_balance) || 0,
    preferredCurrency: dbProfile.preferred_currency,
    customCommissionRate: dbProfile.custom_commission_rate ? parseFloat(dbProfile.custom_commission_rate) : null,
    firstName: dbProfile.first_name,
    lastName: dbProfile.last_name,
    name: `${dbProfile.first_name || ''} ${dbProfile.last_name || ''}`.trim(),
    avatar: dbProfile.avatar,
    language: dbProfile.language,
    externalCalUrl: dbProfile.external_cal_url,
    blockDates: dbProfile.block_dates || [],
    minStay: dbProfile.min_stay,
    maxStay: dbProfile.max_stay,
    instantBooking: dbProfile.instant_booking,
    notificationPreferences: dbProfile.notification_preferences || { email: true, telegram: false, telegramChatId: null },
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at,
    lastLoginAt: dbProfile.last_login_at,
    verifiedAt: dbProfile.verified_at,
    rejectedAt: dbProfile.rejected_at,
    rejectionReason: dbProfile.rejection_reason
  };
}

function transformProfiles(dbProfiles) {
  return dbProfiles?.map(transformProfile) || [];
}

function transformProfileToDB(profile) {
  const db = {};
  if (profile.email !== undefined) db.email = profile.email;
  if (profile.phone !== undefined) db.phone = profile.phone;
  if (profile.role !== undefined) db.role = profile.role;
  if (profile.verificationStatus !== undefined) db.verification_status = profile.verificationStatus;
  if (profile.isVerified !== undefined) db.is_verified = profile.isVerified;
  if (profile.verificationDocs !== undefined) db.verification_docs = profile.verificationDocs;
  if (profile.telegramId !== undefined) db.telegram_id = profile.telegramId;
  if (profile.telegramLinked !== undefined) db.telegram_linked = profile.telegramLinked;
  if (profile.referralCode !== undefined) db.referral_code = profile.referralCode;
  if (profile.referredBy !== undefined) db.referred_by = profile.referredBy;
  if (profile.balancePoints !== undefined) db.balance_points = profile.balancePoints;
  if (profile.balanceUsdt !== undefined) db.balance_usdt = profile.balanceUsdt;
  if (profile.escrowBalance !== undefined) db.escrow_balance = profile.escrowBalance;
  if (profile.availableBalance !== undefined) db.available_balance = profile.availableBalance;
  if (profile.preferredCurrency !== undefined) db.preferred_currency = profile.preferredCurrency;
  if (profile.customCommissionRate !== undefined) db.custom_commission_rate = profile.customCommissionRate;
  if (profile.firstName !== undefined) db.first_name = profile.firstName;
  if (profile.lastName !== undefined) db.last_name = profile.lastName;
  if (profile.avatar !== undefined) db.avatar = profile.avatar;
  if (profile.language !== undefined) db.language = profile.language;
  if (profile.externalCalUrl !== undefined) db.external_cal_url = profile.externalCalUrl;
  if (profile.blockDates !== undefined) db.block_dates = profile.blockDates;
  if (profile.minStay !== undefined) db.min_stay = profile.minStay;
  if (profile.maxStay !== undefined) db.max_stay = profile.maxStay;
  if (profile.instantBooking !== undefined) db.instant_booking = profile.instantBooking;
  if (profile.notificationPreferences !== undefined) db.notification_preferences = profile.notificationPreferences;
  if (profile.verifiedAt !== undefined) db.verified_at = profile.verifiedAt;
  if (profile.rejectedAt !== undefined) db.rejected_at = profile.rejectedAt;
  if (profile.rejectionReason !== undefined) db.rejection_reason = profile.rejectionReason;
  return db;
}

function transformCategory(dbCat) {
  if (!dbCat) return null;
  return {
    id: dbCat.id,
    name: dbCat.name,
    slug: dbCat.slug,
    description: dbCat.description,
    icon: dbCat.icon,
    order: dbCat.order,
    isActive: dbCat.is_active
  };
}

function transformCategories(dbCats) {
  return dbCats?.map(transformCategory) || [];
}

function transformListing(dbListing) {
  if (!dbListing) return null;
  return {
    id: dbListing.id,
    ownerId: dbListing.owner_id,
    categoryId: dbListing.category_id,
    category: dbListing.categories ? transformCategory(dbListing.categories) : null,
    status: dbListing.status,
    title: dbListing.title,
    description: dbListing.description,
    district: dbListing.district,
    latitude: dbListing.latitude,
    longitude: dbListing.longitude,
    address: dbListing.address,
    basePriceThb: parseFloat(dbListing.base_price_thb),
    commissionRate: parseFloat(dbListing.commission_rate),
    images: dbListing.images || [],
    coverImage: dbListing.cover_image,
    metadata: dbListing.metadata || {},
    available: dbListing.available,
    isFeatured: dbListing.is_featured,
    minBookingDays: dbListing.min_booking_days,
    maxBookingDays: dbListing.max_booking_days,
    views: dbListing.views || 0,
    bookingsCount: dbListing.bookings_count || 0,
    rating: parseFloat(dbListing.rating) || 0,
    reviewsCount: dbListing.reviews_count || 0,
    createdAt: dbListing.created_at,
    updatedAt: dbListing.updated_at,
    publishedAt: dbListing.published_at,
    moderatedAt: dbListing.moderated_at
  };
}

function transformListings(dbListings) {
  return dbListings?.map(transformListing) || [];
}

function transformListingToDB(listing) {
  const db = {};
  if (listing.ownerId !== undefined) db.owner_id = listing.ownerId;
  if (listing.categoryId !== undefined) db.category_id = listing.categoryId;
  if (listing.status !== undefined) db.status = listing.status;
  if (listing.title !== undefined) db.title = listing.title;
  if (listing.description !== undefined) db.description = listing.description;
  if (listing.district !== undefined) db.district = listing.district;
  if (listing.latitude !== undefined) db.latitude = listing.latitude;
  if (listing.longitude !== undefined) db.longitude = listing.longitude;
  if (listing.address !== undefined) db.address = listing.address;
  if (listing.basePriceThb !== undefined) db.base_price_thb = listing.basePriceThb;
  if (listing.commissionRate !== undefined) db.commission_rate = listing.commissionRate;
  if (listing.images !== undefined) db.images = listing.images;
  if (listing.coverImage !== undefined) db.cover_image = listing.coverImage;
  if (listing.metadata !== undefined) db.metadata = listing.metadata;
  if (listing.available !== undefined) db.available = listing.available;
  if (listing.isFeatured !== undefined) db.is_featured = listing.isFeatured;
  if (listing.minBookingDays !== undefined) db.min_booking_days = listing.minBookingDays;
  if (listing.maxBookingDays !== undefined) db.max_booking_days = listing.maxBookingDays;
  if (listing.views !== undefined) db.views = listing.views;
  if (listing.bookingsCount !== undefined) db.bookings_count = listing.bookingsCount;
  if (listing.rating !== undefined) db.rating = listing.rating;
  if (listing.reviewsCount !== undefined) db.reviews_count = listing.reviewsCount;
  if (listing.publishedAt !== undefined) db.published_at = listing.publishedAt;
  if (listing.moderatedAt !== undefined) db.moderated_at = listing.moderatedAt;
  return db;
}

function transformBooking(dbBooking) {
  if (!dbBooking) return null;
  return {
    id: dbBooking.id,
    listingId: dbBooking.listing_id,
    renterId: dbBooking.renter_id,
    partnerId: dbBooking.partner_id,
    listing: dbBooking.listings ? {
      title: dbBooking.listings.title,
      district: dbBooking.listings.district,
      basePriceThb: dbBooking.listings.base_price_thb,
      images: dbBooking.listings.images,
      ownerId: dbBooking.listings.owner_id
    } : null,
    status: dbBooking.status,
    checkIn: dbBooking.check_in,
    checkOut: dbBooking.check_out,
    priceThb: parseFloat(dbBooking.price_thb),
    currency: dbBooking.currency,
    pricePaid: parseFloat(dbBooking.price_paid),
    exchangeRate: parseFloat(dbBooking.exchange_rate),
    commissionThb: parseFloat(dbBooking.commission_thb),
    commissionPaid: dbBooking.commission_paid,
    guestName: dbBooking.guest_name,
    guestPhone: dbBooking.guest_phone,
    guestEmail: dbBooking.guest_email,
    specialRequests: dbBooking.special_requests,
    promoCodeUsed: dbBooking.promo_code_used,
    discountAmount: parseFloat(dbBooking.discount_amount) || 0,
    conversationId: dbBooking.conversation_id,
    createdAt: dbBooking.created_at,
    updatedAt: dbBooking.updated_at,
    confirmedAt: dbBooking.confirmed_at,
    cancelledAt: dbBooking.cancelled_at,
    completedAt: dbBooking.completed_at,
    checkedInAt: dbBooking.checked_in_at
  };
}

function transformBookings(dbBookings) {
  return dbBookings?.map(transformBooking) || [];
}

function transformBookingToDB(booking) {
  const db = {};
  if (booking.listingId !== undefined) db.listing_id = booking.listingId;
  if (booking.renterId !== undefined) db.renter_id = booking.renterId;
  if (booking.partnerId !== undefined) db.partner_id = booking.partnerId;
  if (booking.status !== undefined) db.status = booking.status;
  if (booking.checkIn !== undefined) db.check_in = booking.checkIn;
  if (booking.checkOut !== undefined) db.check_out = booking.checkOut;
  if (booking.priceThb !== undefined) db.price_thb = booking.priceThb;
  if (booking.currency !== undefined) db.currency = booking.currency;
  if (booking.pricePaid !== undefined) db.price_paid = booking.pricePaid;
  if (booking.exchangeRate !== undefined) db.exchange_rate = booking.exchangeRate;
  if (booking.commissionThb !== undefined) db.commission_thb = booking.commissionThb;
  if (booking.commissionPaid !== undefined) db.commission_paid = booking.commissionPaid;
  if (booking.guestName !== undefined) db.guest_name = booking.guestName;
  if (booking.guestPhone !== undefined) db.guest_phone = booking.guestPhone;
  if (booking.guestEmail !== undefined) db.guest_email = booking.guestEmail;
  if (booking.specialRequests !== undefined) db.special_requests = booking.specialRequests;
  if (booking.promoCodeUsed !== undefined) db.promo_code_used = booking.promoCodeUsed;
  if (booking.discountAmount !== undefined) db.discount_amount = booking.discountAmount;
  if (booking.conversationId !== undefined) db.conversation_id = booking.conversationId;
  if (booking.confirmedAt !== undefined) db.confirmed_at = booking.confirmedAt;
  if (booking.cancelledAt !== undefined) db.cancelled_at = booking.cancelledAt;
  if (booking.completedAt !== undefined) db.completed_at = booking.completedAt;
  if (booking.checkedInAt !== undefined) db.checked_in_at = booking.checkedInAt;
  return db;
}

function transformPromoCode(dbPromo) {
  if (!dbPromo) return null;
  return {
    id: dbPromo.id,
    code: dbPromo.code,
    type: dbPromo.promo_type,
    value: parseFloat(dbPromo.value),
    minAmount: parseFloat(dbPromo.min_amount) || 0,
    maxUses: dbPromo.max_uses,
    currentUses: dbPromo.current_uses || 0,
    validFrom: dbPromo.valid_from,
    validUntil: dbPromo.valid_until,
    isActive: dbPromo.is_active
  };
}

function getCurrencySymbol(code) {
  const symbols = { THB: '฿', RUB: '₽', USD: '$', USDT: '₮' };
  return symbols[code] || code;
}

// Export helper to check mode
export const isUsingSupabase = () => USE_SUPABASE;
