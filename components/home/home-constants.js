import { proxifyUnsplashUrl } from '@/lib/proxify-unsplash-url'
import { Home, Bike, Map, Anchor } from 'lucide-react'

/** Внешние фото главной: unoptimized + proxify (см. GostayloHomeContent). */
export const HERO_BACKGROUND_IMAGE = proxifyUnsplashUrl(
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1920&q=80',
)

export const CATEGORY_CARD_IMAGES = [
  proxifyUnsplashUrl('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80'),
  proxifyUnsplashUrl('https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80'),
  proxifyUnsplashUrl('https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80'),
  proxifyUnsplashUrl('https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&q=80'),
]

export const HOME_CATEGORY_ICONS = {
  property: Home,
  vehicles: Bike,
  tours: Map,
  yachts: Anchor,
}
