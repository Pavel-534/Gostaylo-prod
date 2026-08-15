import { ImageResponse } from 'next/og'
import { getCachedListingPdpBootstrap } from '@/lib/listing/get-cached-listing-pdp-bootstrap.js'
import { toPublicImageUrl } from '@/lib/public-image-url'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import { publicFileDataUri, ogFonts, absolutize, OG_BG } from '@/lib/seo/og-brand-card'

export const runtime = 'nodejs'
export const alt = 'Airento — rental'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function clamp(str, n) {
  const s = String(str || '').trim()
  return s.length > n ? `${s.slice(0, n - 1).trim()}…` : s
}

export default async function Image({ params }) {
  const listingId = params?.id != null ? String(params.id).trim() : ''
  const base = getPublicSiteUrl()
  const brand = getSiteDisplayName()

  let title = 'Rental'
  let district = ''
  let cover = null
  try {
    const bootstrap = await getCachedListingPdpBootstrap(listingId)
    const listing = bootstrap?.layoutRow
    if (listing) {
      title = clamp(listing.title || 'Rental', 64)
      district = clamp(listing.district || listing.metadata?.city || '', 40)
      const raw = listing.cover_image || (Array.isArray(listing.images) ? listing.images[0] : null)
      if (raw) cover = absolutize(toPublicImageUrl(raw), base)
    }
  } catch {
    /* fall back to branded card */
  }

  const lockup = publicFileDataUri('brand/airento-lockup-onbg.png')

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          fontFamily: 'Noto, system-ui, sans-serif',
          background: OG_BG,
        }}
      >
        {/* property photo */}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={1200}
            height={630}
            style={{ position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px', objectFit: 'cover' }}
          />
        ) : null}
        {/* bottom dark gradient for legibility */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '1200px',
            height: '460px',
            display: 'flex',
            background: 'linear-gradient(180deg, rgba(8,12,20,0) 0%, rgba(8,12,20,0.55) 45%, rgba(8,12,20,0.92) 100%)',
          }}
        />
        {/* lockup top-left */}
        <div style={{ position: 'absolute', top: 48, left: 56, display: 'flex' }}>
          {lockup ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lockup} alt="" height={54} />
          ) : (
            <div style={{ display: 'flex', color: '#fff', fontSize: 34, fontWeight: 700 }}>{brand}</div>
          )}
        </div>
        {/* content bottom-left */}
        <div
          style={{
            position: 'absolute',
            left: 56,
            bottom: 56,
            right: 56,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {district ? (
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                background: '#0d9488',
                color: '#ffffff',
                fontSize: 24,
                fontWeight: 700,
                padding: '8px 18px',
                borderRadius: 999,
                marginBottom: 20,
              }}
            >
              {district}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.08,
              textShadow: '0 2px 24px rgba(0,0,0,0.35)',
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() },
  )
}
