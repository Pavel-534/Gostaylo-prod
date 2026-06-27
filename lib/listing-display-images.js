/**
 * Legacy PDP gallery URLs — full main quality (same as `getPdpHeroImageUrls`).
 * Catalog cards — SSOT `lib/media/image-delivery.js` → `getListingCardImageUrls`.
 */
export {
  getListingCardImageUrls,
  getPdpHeroImageUrls,
  getPdpLightboxImageUrls,
  getPdpHeroImageUrls as getListingDisplayImageUrls,
} from '@/lib/media/image-delivery'
