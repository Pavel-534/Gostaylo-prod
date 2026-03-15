-- Demo Listings Creation Script
-- Creates 4 premium demo listings showcasing all features

-- 1. LUXURY VILLA (Property Category)
INSERT INTO listings (
  id, owner_id, category_id, status, available, is_featured,
  title, description, district, address,
  base_price_thb, commission_rate, min_booking_days, max_booking_days,
  images, cover_image,
  metadata,
  rating, reviews_count, views, bookings_count,
  created_at
) VALUES (
  'demo-villa-luxury-001',
  'user-mmhsxted-zon',
  (SELECT id FROM categories WHERE name ILIKE '%villa%' OR name ILIKE '%property%' LIMIT 1),
  'active',
  true,
  true,
  'Luxury 5-Bedroom Villa with Private Pool & Sea View',
  'Experience ultimate luxury in this stunning 5-bedroom villa located in the prestigious Rawai area. This architectural masterpiece features floor-to-ceiling windows, a private infinity pool, and breathtaking panoramic sea views.

The villa spans 450 square meters across two levels, offering spacious living areas, a fully equipped gourmet kitchen, and elegant bedrooms with ensuite bathrooms. The master suite includes a private balcony perfect for sunset cocktails.

Outdoor amenities include a 15-meter infinity pool, tropical garden, outdoor dining area with BBQ, and covered parking for 3 vehicles. The property is fully staffed with daily housekeeping and optional private chef services.

Located just 5 minutes from Rawai Beach and 15 minutes from Phuket''s best restaurants and shopping. Perfect for families or groups seeking privacy and luxury.',
  'Rawai',
  'Soi Saiyuan, Rawai, Phuket 83130',
  15000.00,
  15.00,
  3,
  90,
  ARRAY[
    'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg',
    'https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg',
    'https://images.pexels.com/photos/1571467/pexels-photo-1571467.jpeg',
    'https://images.pexels.com/photos/1643384/pexels-photo-1643384.jpeg',
    'https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg',
    'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg',
    'https://images.pexels.com/photos/2119714/pexels-photo-2119714.jpeg'
  ],
  'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg',
  jsonb_build_object(
    'bedrooms', 5,
    'bathrooms', 5,
    'max_guests', 10,
    'area', 450,
    'property_type', 'Luxury Villa',
    'amenities', ARRAY['Wi-Fi', 'Pool', 'Parking', 'AC', 'Kitchen', 'Laundry', 'Security', 'Garden', 'Terrace', 'BBQ', 'Gym', 'Sauna']
  ),
  4.9,
  12,
  245,
  8,
  NOW()
);

-- 2. PREMIUM YACHT (Yacht Category)
INSERT INTO listings (
  id, owner_id, category_id, status, available, is_featured,
  title, description, district, address,
  base_price_thb, commission_rate, min_booking_days, max_booking_days,
  images, cover_image,
  metadata,
  rating, reviews_count, views, bookings_count,
  created_at
) VALUES (
  'demo-yacht-premium-002',
  'user-mmhsxted-zon',
  (SELECT id FROM categories WHERE name ILIKE '%yacht%' OR name ILIKE '%boat%' LIMIT 1),
  'active',
  true,
  true,
  'Luxury 60ft Motor Yacht - Private Island Hopping',
  'Set sail on the azure waters of the Andaman Sea aboard our luxurious 60-foot motor yacht. Perfect for island hopping, sunset cruises, or private parties with stunning views of Phi Phi Islands and Phang Nga Bay.

This premium yacht features:
- Spacious sun deck with lounge seating and sunbeds
- Air-conditioned indoor salon with entertainment system
- Fully equipped galley kitchen
- 2 luxury cabins with private bathrooms
- Professional captain and crew included
- Water sports equipment: snorkeling gear, kayaks, paddleboards
- Premium sound system and WiFi

Ideal for celebrations, romantic getaways, or family adventures. Catering and beverage packages available upon request. Departure from Chalong Pier with flexible itineraries to explore Phuket''s most beautiful islands.',
  'Chalong',
  'Chalong Bay, Phuket 83130',
  45000.00,
  15.00,
  1,
  30,
  ARRAY[
    'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg',
    'https://images.pexels.com/photos/261403/pexels-photo-261403.jpeg',
    'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg',
    'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg',
    'https://images.pexels.com/photos/1878293/pexels-photo-1878293.jpeg'
  ],
  'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg',
  jsonb_build_object(
    'passengers', 12,
    'engine', '2x 450HP Cummins',
    'length', '60 feet',
    'cabins', 2,
    'amenities', ARRAY['Wi-Fi', 'AC', 'Kitchen', 'Security', 'BBQ']
  ),
  4.8,
  8,
  189,
  5,
  NOW()
);

-- 3. ISLAND TOUR (Tours Category)
INSERT INTO listings (
  id, owner_id, category_id, status, available, is_featured,
  title, description, district, address,
  base_price_thb, commission_rate, min_booking_days, max_booking_days,
  images, cover_image,
  metadata,
  rating, reviews_count, views, bookings_count,
  created_at
) VALUES (
  'demo-tour-island-003',
  'user-mmhsxted-zon',
  (SELECT id FROM categories WHERE name ILIKE '%tour%' LIMIT 1),
  'active',
  true,
  true,
  'Phi Phi Islands Premium Day Tour - Snorkeling & Beach Paradise',
  'Discover the breathtaking beauty of Thailand''s most famous islands on this premium full-day tour. Visit Maya Bay (The Beach movie location), snorkel in crystal-clear waters, and relax on pristine white-sand beaches.

Tour Highlights:
- Maya Bay: Swimming and photo opportunities
- Pileh Lagoon: Emerald green waters perfect for swimming
- Viking Cave: Historical landmark and bird nest collection site
- Monkey Beach: Meet the local macaque inhabitants
- Bamboo Island: Stunning coral reefs and snorkeling paradise

Inclusions:
✓ Hotel pickup/drop-off in Phuket
✓ Speed boat transfers (90 minutes each way)
✓ Professional English-speaking guide
✓ Snorkeling equipment and life jackets
✓ Buffet lunch on Phi Phi Don
✓ Fresh fruits and soft drinks
✓ Travel insurance
✓ National park fees

Small group size (max 20 people) ensures personalized experience. Departure 7:30 AM, return 5:30 PM. Available daily except during monsoon season.',
  'Patong',
  'Patong Beach, Phuket 83150',
  3500.00,
  15.00,
  1,
  1,
  ARRAY[
    'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg',
    'https://images.pexels.com/photos/1007657/pexels-photo-1007657.jpeg',
    'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg',
    'https://images.pexels.com/photos/1268855/pexels-photo-1268855.jpeg',
    'https://images.pexels.com/photos/2166711/pexels-photo-2166711.jpeg'
  ],
  'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg',
  jsonb_build_object(
    'duration', '10 hours',
    'max_guests', 20,
    'includes', ARRAY['Transportation', 'Lunch', 'Snorkeling gear', 'Guide', 'Insurance'],
    'amenities', ARRAY['Wi-Fi']
  ),
  4.7,
  15,
  312,
  12,
  NOW()
);

-- 4. PREMIUM BIKE (Bikes/Transport Category)
INSERT INTO listings (
  id, owner_id, category_id, status, available, is_featured,
  title, description, district, address,
  base_price_thb, commission_rate, min_booking_days, max_booking_days,
  images, cover_image,
  metadata,
  rating, reviews_count, views, bookings_count,
  created_at
) VALUES (
  'demo-bike-premium-004',
  'user-mmhsxted-zon',
  (SELECT id FROM categories WHERE name ILIKE '%bike%' OR name ILIKE '%transport%' OR name ILIKE '%vehicle%' LIMIT 1),
  'active',
  true,
  true,
  'Honda PCX 160 - Premium Automatic Scooter (2024 Model)',
  'Explore Phuket in style with our brand new 2024 Honda PCX 160 automatic scooter. Perfect for couples or solo travelers who want comfort, reliability, and fuel efficiency.

Bike Specifications:
- Model: Honda PCX 160 (2024)
- Engine: 160cc liquid-cooled
- Transmission: Automatic CVT
- Fuel Economy: 50+ km/liter
- Top Speed: 110 km/h
- Storage: 28-liter under-seat compartment
- Features: LED lighting, digital display, USB charging port

Included:
✓ 2 helmets (full-face)
✓ Rain covers
✓ Phone mount
✓ Lock and chain
✓ Full insurance coverage
✓ 24/7 roadside assistance
✓ Free delivery/pickup in Patong, Kata, Karon areas

Perfect condition, regularly serviced, and thoroughly cleaned after each rental. International driving permit required. Minimum age: 21 years.

Flexible rental periods from 1 day to 1 month with special discounts for long-term rentals.',
  'Patong',
  'Patong Beach Road, Phuket 83150',
  800.00,
  15.00,
  1,
  90,
  ARRAY[
    'https://images.pexels.com/photos/2393816/pexels-photo-2393816.jpeg',
    'https://images.pexels.com/photos/2393817/pexels-photo-2393817.jpeg',
    'https://images.pexels.com/photos/1413412/pexels-photo-1413412.jpeg',
    'https://images.pexels.com/photos/2519370/pexels-photo-2519370.jpeg',
    'https://images.pexels.com/photos/1421903/pexels-photo-1421903.jpeg'
  ],
  'https://images.pexels.com/photos/2393816/pexels-photo-2393816.jpeg',
  jsonb_build_object(
    'vehicle_type', 'Automatic Scooter',
    'model', 'Honda PCX 160',
    'year', 2024,
    'passengers', 2,
    'engine', '160cc',
    'amenities', ARRAY['Parking']
  ),
  4.9,
  24,
  156,
  18,
  NOW()
);

-- Verify creation
SELECT 
  id,
  title,
  category_id,
  base_price_thb,
  array_length(images, 1) as image_count,
  rating,
  reviews_count
FROM listings
WHERE id LIKE 'demo-%'
ORDER BY created_at DESC;
