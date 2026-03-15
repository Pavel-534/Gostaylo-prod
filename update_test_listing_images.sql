-- Update test listing with 5 high-quality property images for Bento Gallery

UPDATE listings
SET 
  images = ARRAY[
    'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg',
    'https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg',
    'https://images.pexels.com/photos/1571467/pexels-photo-1571467.jpeg',
    'https://images.pexels.com/photos/1643384/pexels-photo-1643384.jpeg',
    'https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg'
  ],
  cover_image = 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg'
WHERE id = 'lst-test-final-1772285152';

-- Verify update
SELECT 
  id,
  title,
  array_length(images, 1) as image_count,
  cover_image
FROM listings
WHERE id = 'lst-test-final-1772285152';
