import { ImageResponse } from 'next/og'
import { getSiteDisplayName } from '@/lib/site-url'
import { publicFileDataUri, ogFonts, OG_BG } from '@/lib/seo/og-brand-card'

export const runtime = 'nodejs'
export const alt = 'Airento'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Referral OG card — mark + brand word only (WhatsApp square-crops the center).
 * Uses `brand/airento-mark1.png` (A + infinity). No invite/subtitle lines.
 */
export default async function Image() {
  const brand = getSiteDisplayName() || 'Airento'
  const mark =
    publicFileDataUri('brand/airento-mark1.png') ||
    publicFileDataUri('brand/airento-mark.png')

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: OG_BG,
          fontFamily: 'Noto, system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(closest-side at 50% 40%, rgba(13,148,136,0.35), rgba(13,148,136,0))',
            display: 'flex',
          }}
        />
        {mark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mark}
            alt=""
            width={320}
            height={320}
            style={{
              borderRadius: 64,
              background: '#ffffff',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
            }}
          />
        ) : null}
        <div
          style={{
            display: 'flex',
            marginTop: 32,
            fontSize: 56,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          {brand}
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() },
  )
}
