import { ImageResponse } from 'next/og'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import { getUIText } from '@/lib/translations'
import { resolveOgLocale } from '@/lib/referral/resolve-og-locale.js'
import { publicFileDataUri, ogFonts, OG_BG } from '@/lib/seo/og-brand-card'

export const runtime = 'nodejs'
export const alt = 'Airento — invite'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Referral OG card (Stage 131.A5.E).
 *
 * WhatsApp/Telegram square-crop the *center* of 1200×630 — so the brand mark must
 * sit in the middle (same splash chip as PWA / header), not a giant fallback name.
 * SVG cannot be used as og:image; messengers need PNG. We embed the PWA splash PNG
 * (white plate + mark) which matches `airento-mark-badge.svg` / home-screen icon.
 */
export default async function Image({ params }) {
  const id = params?.id != null ? String(params.id).trim() : ''
  let displayName = ''
  const base = getPublicSiteUrl()
  const lang = await resolveOgLocale()
  const brand = getSiteDisplayName()
  const subtitle = getUIText('stage1322_ogSubtitle', lang).replace(/\{brand\}/g, brand)

  if (id && base) {
    try {
      const res = await fetch(`${base}/api/v2/referral/landing-meta/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const j = await res.json().catch(() => ({}))
        if (j?.success && j?.data?.displayName) {
          displayName = String(j.data.displayName).trim()
        }
      }
    } catch {
      /* ignore */
    }
  }

  const inviteLine = displayName
    ? getUIText('stage1322_ogInviteLine', lang).replace(/\{name\}/g, displayName)
    : getUIText('stage1322_ogInviteGeneric', lang).replace(/\{brand\}/g, brand)

  // Same visual family as header badge / home-screen icon (not the lockup wordmark).
  const mark =
    publicFileDataUri('icons/icon-splash-512x512.png') ||
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
          padding: '48px 64px',
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
            background: 'radial-gradient(closest-side at 50% 42%, rgba(13,148,136,0.38), rgba(13,148,136,0))',
            display: 'flex',
          }}
        />
        {mark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mark}
            alt=""
            width={280}
            height={280}
            style={{
              borderRadius: 56,
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
            }}
          />
        ) : (
          <div
            style={{
              width: 280,
              height: 280,
              borderRadius: 56,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0d9488',
              fontSize: 120,
              fontWeight: 700,
            }}
          >
            A
          </div>
        )}
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 52,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          {brand}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 14,
            fontSize: 28,
            color: '#5eead4',
            fontWeight: 400,
            textAlign: 'center',
            maxWidth: 920,
          }}
        >
          {inviteLine}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 10,
            fontSize: 22,
            color: '#94a3b8',
            fontWeight: 400,
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() },
  )
}
