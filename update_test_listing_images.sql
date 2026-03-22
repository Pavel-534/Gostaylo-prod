-- Update test listing with 5 high-quality property images for Bento Gallery
-- (Unsplash: старые ссылки Pexels часто отдают 404)

UPDATE listings
SET 
  images = ARRAY[
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
  ],
  cover_image = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80'
WHERE id = 'lst-test-final-1772285152';

-- Verify update
SELECT 
  id,
  title,
  array_length(images, 1) as image_count,
  cover_image
FROM listings
WHERE id = 'lst-test-final-1772285152';
