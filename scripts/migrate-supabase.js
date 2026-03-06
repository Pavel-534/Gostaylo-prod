/**
 * Gostaylo - Database Migration & Seeding Script
 * Run with: node scripts/migrate-supabase.js
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testConnection() {
  console.log('🔌 Testing Supabase connection...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Supabase connection successful!');
      return true;
    } else {
      console.log('❌ Connection failed:', response.status, await response.text());
      return false;
    }
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    return false;
  }
}

async function checkTable(tableName) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?limit=1`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function insertData(tableName, data) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const error = await response.text();
      console.log(`  ⚠️ Insert to ${tableName} failed:`, error);
      return null;
    }
  } catch (error) {
    console.log(`  ❌ Error inserting to ${tableName}:`, error.message);
    return null;
  }
}

async function getData(tableName, filters = '') {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?${filters}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

async function seedData() {
  console.log('\n📦 Seeding initial data...');
  
  // Check if categories exist
  const existingCats = await getData('categories');
  if (existingCats && existingCats.length > 0) {
    console.log(`  ℹ️ Categories already exist (${existingCats.length} found)`);
  } else {
    console.log('  📁 Creating categories...');
    const categories = [
      { id: 'cat-property', name: 'Property', slug: 'property', icon: 'Home', order: 1, is_active: true },
      { id: 'cat-vehicles', name: 'Vehicles', slug: 'vehicles', icon: 'Car', order: 2, is_active: true },
      { id: 'cat-tours', name: 'Tours', slug: 'tours', icon: 'Map', order: 3, is_active: true },
      { id: 'cat-yachts', name: 'Yachts', slug: 'yachts', icon: 'Anchor', order: 4, is_active: false }
    ];
    
    for (const cat of categories) {
      const result = await insertData('categories', cat);
      if (result) {
        console.log(`    ✅ Created category: ${cat.name}`);
      }
    }
  }
  
  // Check if exchange rates exist
  const existingRates = await getData('exchange_rates');
  if (existingRates && existingRates.length > 0) {
    console.log(`  ℹ️ Exchange rates already exist (${existingRates.length} found)`);
  } else {
    console.log('  💱 Creating exchange rates...');
    const rates = [
      { currency_code: 'THB', rate_to_thb: 1.0 },
      { currency_code: 'RUB', rate_to_thb: 0.37 },
      { currency_code: 'USD', rate_to_thb: 35.5 },
      { currency_code: 'USDT', rate_to_thb: 35.5 }
    ];
    
    for (const rate of rates) {
      const result = await insertData('exchange_rates', rate);
      if (result) {
        console.log(`    ✅ Created rate: ${rate.currency_code}`);
      }
    }
  }
  
  // Check if admin exists
  const existingAdmin = await getData('profiles', 'id=eq.admin-777');
  if (existingAdmin && existingAdmin.length > 0) {
    console.log(`  ℹ️ Admin user already exists`);
  } else {
    console.log('  👤 Creating admin user (Pavel B.)...');
    const admin = {
      id: 'admin-777',
      email: 'admin@gostaylo.com',
      role: 'ADMIN',
      is_verified: true,
      verification_status: 'VERIFIED',
      first_name: 'Pavel',
      last_name: 'B.',
      referral_code: 'FRADMIN',
      preferred_currency: 'THB',
      notification_preferences: { email: true, telegram: true, telegramChatId: '999888777' }
    };
    
    const result = await insertData('profiles', admin);
    if (result) {
      console.log(`    ✅ Created admin: ${admin.email}`);
    }
  }
  
  // Check if promo codes exist
  const existingPromos = await getData('promo_codes');
  if (existingPromos && existingPromos.length > 0) {
    console.log(`  ℹ️ Promo codes already exist (${existingPromos.length} found)`);
  } else {
    console.log('  🎟️ Creating promo codes...');
    const promos = [
      { code: 'SAVE100', promo_type: 'FIXED', value: 100, is_active: true },
      { code: 'WELCOME10', promo_type: 'PERCENTAGE', value: 10, is_active: true }
    ];
    
    for (const promo of promos) {
      const result = await insertData('promo_codes', promo);
      if (result) {
        console.log(`    ✅ Created promo: ${promo.code}`);
      }
    }
  }
  
  // Check if system settings exist
  const existingSettings = await getData('system_settings');
  if (existingSettings && existingSettings.length > 0) {
    console.log(`  ℹ️ System settings already exist`);
  } else {
    console.log('  ⚙️ Creating system settings...');
    const settings = [
      { 
        key: 'general', 
        value: {
          defaultCommissionRate: 15,
          maintenanceMode: false,
          heroTitle: 'Luxury Rentals in Phuket',
          heroSubtitle: 'Villas, Bikes, Yachts & Tours',
          serviceFeePercent: 5
        }
      }
    ];
    
    for (const setting of settings) {
      const result = await insertData('system_settings', setting);
      if (result) {
        console.log(`    ✅ Created setting: ${setting.key}`);
      }
    }
  }
  
  console.log('\n✅ Seeding complete!');
}

async function verifyTables() {
  console.log('\n📊 Verifying tables...');
  
  const tables = [
    'profiles', 'categories', 'listings', 'bookings', 'payments',
    'conversations', 'messages', 'seasonal_prices', 'promo_codes',
    'blacklist', 'payouts', 'exchange_rates', 'system_settings',
    'referrals', 'activity_log', 'telegram_link_codes'
  ];
  
  for (const table of tables) {
    const exists = await checkTable(table);
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  }
}

async function main() {
  console.log('🚀 Gostaylo - Supabase Migration Script\n');
  
  // Test connection
  const connected = await testConnection();
  if (!connected) {
    console.log('\n❌ Cannot proceed without connection');
    process.exit(1);
  }
  
  // Verify tables
  await verifyTables();
  
  // Seed data
  await seedData();
  
  // Final verification
  console.log('\n📋 Final verification...');
  const admin = await getData('profiles', 'id=eq.admin-777');
  if (admin && admin.length > 0) {
    console.log('✅ Admin user visible in database:');
    console.log(`   ID: ${admin[0].id}`);
    console.log(`   Email: ${admin[0].email}`);
    console.log(`   Role: ${admin[0].role}`);
    console.log(`   Name: ${admin[0].first_name} ${admin[0].last_name}`);
  }
  
  const cats = await getData('categories', 'order=order.asc');
  if (cats && cats.length > 0) {
    console.log(`\n✅ Categories in database (${cats.length}):`);
    cats.forEach(c => console.log(`   - ${c.name} (${c.slug}) - ${c.is_active ? 'Active' : 'Inactive'}`));
  }
  
  console.log('\n🎉 Migration & seeding complete!');
}

main().catch(console.error);
