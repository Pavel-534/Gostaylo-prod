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
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
  ],
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
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
    'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1200&q=80'
  ],
  'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&q=80',
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
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80'
  ],
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
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
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1609630875171-b1321377ea65?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1568772585407-93651733e49e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1628527304949-b4cd854cb7d0?auto=format&fit=crop&w=1200&q=80'
  ],
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
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
