/**
 * Autonomous Data Seeding Script
 * Creates 2 live test listings programmatically via Supabase Admin API
 */

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'
const OWNER_ID = 'user-mmhsxted-zon' // 86boa@mail.ru

// Listing data
const listings = [
  {
    id: `lst-yacht-${Date.now()}`,
    title: 'Luxury Yacht - Andaman Dream',
    description: 'Experience the ultimate luxury aboard our stunning 80-foot yacht. Perfect for sunset cruises, island hopping, and exclusive sea adventures around Phuket\'s pristine waters. Equipped with premium amenities, spacious sun decks, and professional crew.',
    category_id: '4', // Yachts
    district: 'Chalong',
    address: 'Chalong Pier, Phuket',
    latitude: 7.82,
    longitude: 98.33,
    base_price_thb: 85000,
    commission_rate: 15,
    images: [
      'https://images.unsplash.com/photo-1632730958171-17a1bc0338fc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB5YWNodCUyMHNhaWxpbmclMjBwaHVrZXQlMjBvY2VhbnxlbnwwfHx8fDE3NzM1Nzg2ODR8MA&ixlib=rb-4.1.0&q=85',
      'https://images.unsplash.com/photo-1708998841930-ce1dfc4e5de5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjB5YWNodCUyMHNhaWxpbmclMjBwaHVrZXQlMjBvY2VhbnxlbnwwfHx8fDE3NzM1Nzg2ODR8MA&ixlib=rb-4.1.0&q=85',
      'https://images.unsplash.com/photo-1692768921250-953471af162f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjB5YWNodCUyMHNhaWxpbmclMjBwaHVrZXQlMjBvY2VhbnxlbnwwfHx8fDE3NzM1Nzg2ODR8MA&ixlib=rb-4.1.0&q=85',
      'https://images.unsplash.com/photo-1673627115153-f72db1f2edd7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHw0fHxsdXh1cnklMjB5YWNodCUyMHNhaWxpbmclMjBwaHVrZXQlMjBvY2VhbnxlbnwwfHx8fDE3NzM1Nzg2ODR8MA&ixlib=rb-4.1.0&q=85'
    ],
    cover_image: 'https://images.unsplash.com/photo-1632730958171-17a1bc0338fc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB5YWNodCUyMHNhaWxpbmclMjBwaHVrZXQlMjBvY2VhbnxlbnwwfHx8fDE3NzM1Nzg2ODR8MA&ixlib=rb-4.1.0&q=85',
    owner_id: OWNER_ID,
    status: 'ACTIVE',
    rating: 4.9,
    reviews_count: 27,
    min_booking_days: 1,
    max_booking_days: 7,
    metadata: {
      maxGuests: 12,
      bedrooms: 3,
      bathrooms: 2,
      squareMeters: 200,
      amenities: ['WiFi', 'AC', 'Kitchen', 'BBQ', 'Sun Deck', 'Water Sports Equipment', 'Sound System', 'Professional Crew'],
      checkInTime: '09:00',
      checkOutTime: '18:00',
      cancellationPolicy: 'MODERATE',
      houseRules: 'No smoking, Maximum 12 guests, Professional crew included',
      subcategory: 'Sailing Yacht'
    }
  },
  {
    id: `lst-villa-${Date.now() + 1}`,
    title: 'Beachfront Paradise Villa - Rawai',
    description: 'Stunning 5-bedroom beachfront villa with infinity pool overlooking the Andaman Sea. This architectural masterpiece combines modern luxury with tropical elegance. Features private beach access, spacious living areas, and breathtaking sunset views. Perfect for families and groups seeking ultimate privacy and comfort.',
    category_id: '1', // Property
    district: 'Rawai',
    address: 'Rawai Beach, Phuket',
    latitude: 7.78,
    longitude: 98.31,
    base_price_thb: 45000,
    commission_rate: 15,
    images: [
      'https://images.unsplash.com/photo-1567491634123-460945ea86dd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjB2aWxsYSUyMHBvb2wlMjBwaHVrZXQlMjB0cm9waWNhbHxlbnwwfHx8fDE3NzM1Nzg2ODV8MA&ixlib=rb-4.1.0&q=85',
      'https://images.unsplash.com/photo-1651213084058-c3420ea21852?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHw0fHxsdXh1cnklMjB2aWxsYSUyMHBvb2wlMjBwaHVrZXQlMjB0cm9waWNhbHxlbnwwfHx8fDE3NzM1Nzg2ODV8MA&ixlib=rb-4.1.0&q=85',
      'https://images.unsplash.com/photo-1667932978332-08c67911e7e8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjB2aWxsYSUyMHBvb2wlMjBwaHVrZXQlMjB0cm9waWNhbHxlbnwwfHx8fDE3NzM1Nzg2ODV8MA&ixlib=rb-4.1.0&q=85',
      'https://images.unsplash.com/photo-1562131470-af37433ba70c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB2aWxsYSUyMHBvb2wlMjBwaHVrZXQlMjB0cm9waWNhbHxlbnwwfHx8fDE3NzM1Nzg2ODV8MA&ixlib=rb-4.1.0&q=85'
    ],
    cover_image: 'https://images.unsplash.com/photo-1567491634123-460945ea86dd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjB2aWxsYSUyMHBvb2wlMjBwaHVrZXQlMjB0cm9waWNhbHxlbnwwfHx8fDE3NzM1Nzg2ODV8MA&ixlib=rb-4.1.0&q=85',
    owner_id: OWNER_ID,
    status: 'ACTIVE',
    rating: 5.0,
    reviews_count: 42,
    min_booking_days: 3,
    max_booking_days: 30,
    metadata: {
      maxGuests: 10,
      bedrooms: 5,
      bathrooms: 4,
      squareMeters: 450,
      amenities: ['WiFi', 'AC', 'Pool', 'Kitchen', 'Parking', 'Beach Access', 'BBQ', 'Garden', 'Smart TV', 'Washer', 'Security System'],
      checkInTime: '15:00',
      checkOutTime: '11:00',
      cancellationPolicy: 'STRICT',
      houseRules: 'No smoking indoors, No pets, No parties, Quiet hours 22:00-08:00',
      subcategory: 'Villa'
    }
  }
]

async function createListings() {
  console.log('🚀 Starting autonomous data seeding...\n')
  
  const results = []
  
  for (const listing of listings) {
    try {
      console.log(`📝 Creating: ${listing.title}`)
      console.log(`   Category: ${listing.category}`)
      console.log(`   Location: ${listing.district}, ${listing.city}`)
      console.log(`   Coordinates: [${listing.latitude}, ${listing.longitude}]`)
      console.log(`   Images: ${listing.images.length} photos`)
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(listing)
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`HTTP ${response.status}: ${error}`)
      }
      
      const created = await response.json()
      console.log(`   ✅ Created: ${created[0].id}\n`)
      
      results.push({
        id: created[0].id,
        title: listing.title,
        category: listing.category,
        url: `https://gostaylo.com/listings/${created[0].id}`
      })
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}\n`)
      results.push({
        id: listing.id,
        title: listing.title,
        error: error.message
      })
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 SEEDING RESULTS')
  console.log('='.repeat(60) + '\n')
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.title}`)
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`)
    } else {
      console.log(`   ✅ Live URL: ${result.url}`)
      console.log(`   📍 ID: ${result.id}`)
    }
    console.log('')
  })
  
  return results
}

// Execute
createListings()
  .then(results => {
    const successful = results.filter(r => !r.error).length
    console.log(`✅ Successfully created ${successful}/${results.length} listings`)
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  })
